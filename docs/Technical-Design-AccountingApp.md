# 记账本 APP - 技术方案与架构设计

## 1. 技术栈
- 客户端：Flutter（推荐）或 React Native；离线优先与流畅动画。
- 本地数据库：SQLite（SQLCipher 加密）。
- 同步后端（可选）：Node.js + TypeScript + PostgreSQL；REST/GraphQL。
- 云存储：对象存储（附件）；推送：FCM/APNs。
- 机器学习：本地轻量分类器 + 云端微服务（可选）。

## 2. 架构概览
- Offline-first：核心操作本地完成；后台增量同步。
- 分层：UI → 应用层（用例/服务）→ 数据层（Repository + DB/Network）。
- 同步：per-row `updated_at` + `deleted` 软删，乐观合并；冲突策略 LWW + 领域规则（转账一致性）。
- 多账本（Ledger）：账本级配置包含 `month_start_day`。

## 3. 数据模型（SQLite/PostgreSQL 对齐）
- `users(id, email, display_name, created_at, updated_at, deleted)`
- `ledgers(id, name, owner_id, month_start_day INTEGER CHECK(1<=month_start_day AND month_start_day<=28), currency, created_at, updated_at, deleted)`
- `members(id, ledger_id, user_id, role, created_at, updated_at, deleted)`
- `accounts(id, ledger_id, name, type, currency, initial_balance, created_at, updated_at, deleted)`
- `categories(id, ledger_id, parent_id, name, type CHECK(type IN ('expense','income')), icon, color, created_at, updated_at, deleted)`
- `transactions(id, ledger_id, type CHECK(type IN ('expense','income','transfer')), amount_cents INTEGER NOT NULL, account_id, account_id_to, category_id, merchant, note, tags_text, occurred_at DATETIME NOT NULL, created_at, updated_at, deleted)`
  - 约束：`transfer` 需 `account_id` 与 `account_id_to`；不计入收支汇总。
- `attachments(id, transaction_id, kind, url_or_path, created_at, updated_at, deleted)`
- `budgets(id, ledger_id, cycle_kind CHECK(cycle_kind IN ('monthly','yearly')), category_id NULL, amount_cents, start_date, end_date NULL, created_at, updated_at, deleted)`
- `settings(id, ledger_id, key, value, created_at, updated_at, deleted)`

索引建议：`transactions(ledger_id, occurred_at, updated_at)`；`categories(ledger_id, type)`；`accounts(ledger_id)`；`budgets(ledger_id, cycle_kind)`。

## 4. 关键领域逻辑
### 4.1 自定义账期（月起始日）
- 定义：给定 `month_start_day = S (1..28)`，账期区间为 `[cycle_start, next_cycle_start)`。
- 伪代码：
```pseudo
function computeCycleStart(date d, int S):
  if day(d) >= S:
    return date(year(d), month(d), S)
  else:
    let d0 = addMonths(date(year(d), month(d), 1), -1)
    return date(year(d0), month(d0), S)
```
- SQLite 分组（排除转账）：
```sql
WITH cte AS (
  SELECT t.category_id,
         t.type,
         t.amount_cents,
         CAST(STRFTIME('%d', t.occurred_at, 'localtime') AS INTEGER) AS d,
         DATE(t.occurred_at, 'localtime', 'start of month') AS m0,
         DATE(t.occurred_at, 'localtime', 'start of month', '-1 month') AS pm0
  FROM transactions t
  WHERE t.ledger_id = :ledger_id AND t.deleted = 0 AND t.type <> 'transfer'
), g AS (
  SELECT category_id,
         CASE WHEN d >= :start_day
              THEN DATE(m0, printf('+%d days', :start_day - 1))
              ELSE DATE(pm0, printf('+%d days', :start_day - 1))
         END AS cycle_start,
         CASE WHEN type='expense' THEN -amount_cents ELSE amount_cents END AS signed_amount
  FROM cte
)
SELECT cycle_start,
       DATE(cycle_start, '+1 month') AS cycle_end,
       category_id,
       SUM(signed_amount) AS total_cents
FROM g
GROUP BY cycle_start, category_id
ORDER BY cycle_start DESC;
```

### 4.2 预算执行与提醒
- 存储：`budgets(cycle_kind, category_id, amount_cents)`。
- 计算：沿用 4.1 的 `cycle_start`；执行率 `spent/limit`。
- 提醒：本地定时任务；阈值（70%/100%）触发通知；跨设备使用推送。

### 4.3 多账户与转账一致性
- 记录转账：原子写入两条流水（或单条含 `account_id_to` 并在视图层拆分），保持余额正确。

## 5. API 设计（后端可选）
- 鉴权：OAuth/Email+Magic Link；`Authorization: Bearer`。
- 资源：
  - `POST /sync/pull`（自上次 `cursor` 起的变更）
  - `POST /sync/push`（上传本地变更）
  - `GET/POST/PUT/DELETE /accounts`
  - `GET/POST/PUT/DELETE /categories`
  - `GET/POST/PUT/DELETE /transactions`
  - `GET /reports/summary?scope=monthly&start=YYYY-MM&limit=N`
  - `GET /budgets`、`POST /budgets`

统一字段：`id, created_at, updated_at, deleted`；金额用 `amount_cents`。

## 6. 报表与查询
- 月度/年度汇总：见 4.1 SQL；年度默认自然年，亦可提供账期年。
- 维度扩展：账户、标签、商家分组；大表建议物化视图或增量汇总表。

## 7. 客户端实现要点
- 状态管理：Flutter Riverpod/Bloc；表单可编辑缓存；失败重试。
- DB 抽象：Repository 封装查询；统一金额换算与币种。
- 国际化与无障碍：Intl；动态字体；深色模式。
- 媒体：附件压缩、懒加载；权限网关。

## 8. 安全与隐私
- 本地：SQLCipher 或平台安全区；应用锁（生物识别）。
- 传输：HTTPS；后端敏感字段加密；最小权限访问。
- 合规：GDPR/本地法规；数据导出/删除权。

## 9. 同步与冲突
- 策略：LWW + 领域校验；转账成对核对；分类重命名保留历史引用。
- 版本：每条记录 `version` 自增；返回冲突集供客户端合并。

## 10. 性能与观测
- 关键路径 < 100ms；本地报表 < 300ms。
- 观测：客户端埋点 + 后端 Prometheus/Grafana；崩溃上报。

## 11. 测试
- 单元：账期算法、预算计算、同步合并。
- 集成：多账户转账一致性、离线→在线回放。
- 端到端：TTB、导入/导出、报表正确性。

## 12. 交付与部署（后端）
- 容器化：Docker；数据库迁移：Prisma/Knex/Flyway。
- 环境：dev/staging/prod；备份与只读副本；对象存储生命周期策略。

## 13. 创新可行性
- 智能账期：周期聚类（如按发薪/还款日）。
- AI 分类纠错：本地关键词 + 轻量模型，云端精修。
- 现金流预测：ARIMA/Prophet 或轻量回归。
- 规则自动化：可视化规则（IFTTT风格），沙箱执行。

# 记账本 APP - 技术方案与架构设计

## 1. 技术栈选择
- 客户端：Flutter（推荐）或 React Native；优先离线可用与流畅动画。
- 本地数据库：SQLite（SQLCipher 加密）。
- 同步后端（可选）：Node.js + TypeScript + PostgreSQL；REST/GraphQL 均可。
- 云存储：对象存储（图片附件）；推送：FCM/APNs。
- 机器学习：本地轻量分类器 + 云端微服务（可选）。

## 2. 架构概览
- Offline-first：所有核心操作本地完成；后台增量同步。
- 分层：UI → 应用层（用例/服务）→ 数据层（Repository + DB/Network）。
- 同步：基于 per-row `updated_at` 与 `deleted` 软删，乐观合并；冲突策略 LWW + 领域规则（如转账双记录一致性）。
- 多账本（Ledger）：支持个人与家庭共享，账本级配置包含 `month_start_day`。

## 3. 数据模型（SQLite/PostgreSQL 对齐）
- `users(id, email, display_name, created_at, updated_at, deleted)`
- `ledgers(id, name, owner_id, month_start_day INTEGER CHECK(1<=month_start_day AND month_start_day<=28), currency, created_at, updated_at, deleted)`
- `members(id, ledger_id, user_id, role, created_at, updated_at, deleted)`
- `accounts(id, ledger_id, name, type, currency, initial_balance, created_at, updated_at, deleted)`
- `categories(id, ledger_id, parent_id, name, type CHECK(type IN ('expense','income')), icon, color, created_at, updated_at, deleted)`
- `transactions(id, ledger_id, type CHECK(type IN ('expense','income','transfer')), amount_cents INTEGER NOT NULL, account_id, account_id_to, category_id, merchant, note, tags_text, occurred_at DATETIME NOT NULL, created_at, updated_at, deleted)`
  - 约束：`transfer` 需 `account_id` 与 `account_id_to`；不计入收支汇总。
- `attachments(id, transaction_id, kind, url_or_path, created_at, updated_at, deleted)`
- `budgets(id, ledger_id, cycle_kind CHECK(cycle_kind IN ('monthly','yearly')), category_id NULL, amount_cents, start_date, end_date NULL, created_at, updated_at, deleted)`
- `settings(id, ledger_id, key, value, created_at, updated_at, deleted)` 用于扩展。

索引建议：
- `transactions(ledger_id, occurred_at, updated_at)`；`categories(ledger_id, type)`；`accounts(ledger_id)`；`budgets(ledger_id, cycle_kind)`。

## 4. 关键领域逻辑
### 4.1 自定义账期（月起始日）
- 定义：给定账本配置 `month_start_day = S (1..28)`，账期为区间 `[cycle_start, next_cycle_start)`。
- 算法（伪代码）：
```pseudo
function computeCycleStart(date d, int S):
  if day(d) >= S:
    return date(year(d), month(d), S)
  else:
    let d0 = addMonths(date(year(d), month(d), 1), -1)
    return date(year(d0), month(d0), S)
```
- 年度（自然年）与账期年：
  - 年度报表默认按自然年。
  - 可选支持“账期年”（由 `S` 锚定），用于预算与趋势一致性。

- SQLite 按账期分组示例：
```sql
-- 参数：:ledger_id, :start_day
WITH tx AS (
  SELECT t.* FROM transactions t
  WHERE t.ledger_id = :ledger_id AND t.deleted = 0
), base AS (
  SELECT
    id,
    occurred_at,
    CAST(STRFTIME('%d', occurred_at, 'localtime') AS INTEGER) AS d,
    DATE(occurred_at, 'localtime', 'start of month') AS month_start,
    DATE(occurred_at, 'localtime', 'start of month', '-1 month') AS prev_month_start
  FROM tx
), cycle AS (
  SELECT
    id,
    CASE WHEN d >= :start_day
         THEN DATE(month_start, printf('+%d days', :start_day - 1))
         ELSE DATE(prev_month_start, printf('+%d days', :start_day - 1))
    END AS cycle_start
  FROM base
)
SELECT DATE(cycle_start) AS cycle_start,
       DATE(cycle_start, '+1 month') AS cycle_end
FROM cycle;
```

- 按账期统计（分类，排除转账）：
```sql
WITH cte AS (
  SELECT t.category_id,
         t.type,
         t.amount_cents,
         CAST(STRFTIME('%d', t.occurred_at, 'localtime') AS INTEGER) AS d,
         DATE(t.occurred_at, 'localtime', 'start of month') AS m0,
         DATE(t.occurred_at, 'localtime', 'start of month', '-1 month') AS pm0
  FROM transactions t
  WHERE t.ledger_id = :ledger_id AND t.deleted = 0 AND t.type <> 'transfer'
), g AS (
  SELECT category_id,
         CASE WHEN d >= :start_day
              THEN DATE(m0, printf('+%d days', :start_day - 1))
              ELSE DATE(pm0, printf('+%d days', :start_day - 1))
         END AS cycle_start,
         CASE WHEN type='expense' THEN -amount_cents ELSE amount_cents END AS signed_amount
  FROM cte
)
SELECT cycle_start,
       DATE(cycle_start, '+1 month') AS cycle_end,
       category_id,
       SUM(signed_amount) AS total_cents
FROM g
GROUP BY cycle_start, category_id
ORDER BY cycle_start DESC;
```

### 4.2 预算执行与提醒
- 存储：`budgets(cycle_kind, category_id, amount_cents)`。
- 计算：与 4.1 相同的 `cycle_start` 锚定；预算执行率 `spent/limit`。
- 提醒：本地定时任务轮询；阈值（70%/100%）触发通知；跨设备用推送。

### 4.3 多账户与转账一致性
- 记录一笔转账时，需原子写入两条明细（或一条带 `account_id_to` 字段的记录并在视图层拆分），保持余额正确。

## 5. API 设计（后端可选）
- 鉴权：OAuth/Email+Magic Link；请求携带 `Authorization: Bearer`。
- 资源：
  - `POST /sync/pull`（自上次 `cursor` 起的变更）
  - `POST /sync/push`（上传本地变更，服务端打时间戳）
  - `GET/POST/PUT/DELETE /accounts`
  - `GET/POST/PUT/DELETE /categories`
  - `GET/POST/PUT/DELETE /transactions`
  - `GET /reports/summary?scope=monthly&start=YYYY-MM&limit=N`
  - `GET /budgets`、`POST /budgets`

响应字段统一：`id, created_at, updated_at, deleted`；金额以 `amount_cents` 传输。

## 6. 报表与查询
- 月度/年度汇总：见 4.1 SQL；年度用 `strftime('%Y', occurred_at)` 自然年或按账期年（可选）。
- 维度扩展：按账户、标签、商家分组；大表场景建议加物化视图或增量汇总表。

## 7. 客户端实现要点
- 状态管理：Flutter Riverpod/Bloc；表单可编辑缓存；提交失败重试。
- DB 抽象：Repository 层封装查询；统一金额换算与币种。
- 国际化与无障碍：Intl、多语言文案；动态字体；深色模式。
- 媒体：附件压缩与懒加载；权限网关。

## 8. 安全与隐私
- 本地：SQLCipher 或平台安全区加密密钥；应用锁（生物识别）。
- 传输：HTTPS + HSTS；后端敏感字段加密；最小权限访问策略。
- 合规：GDPR/本地法规；数据导出与删除权。

## 9. 同步与冲突
- 策略：LWW + 领域校验；转账成对核对；分类重命名保留历史引用。
- 版本：每条记录 `version` 自增；服务端检测并返回冲突集，客户端弹性合并。

## 10. 性能与观测
- 关键路径 < 100ms；报表查询本地 < 300ms。
- 观测：客户端埋点 + 后端 Prometheus/Grafana；崩溃上报。

## 11. 测试
- 单元：账期算法、预算计算、同步合并。
- 集成：多账户转账一致性、离线→在线回放。
- 端到端：首笔记账TTB、导入/导出、报表正确性。

## 12. 交付与部署（后端）
- 容器化：Docker；数据库迁移：Prisma/Knex/Flyway。
- 环境：dev/staging/prod；备份与只读副本；对象存储生命周期策略。

## 13. 创新功能可行性
- 智能账期建议：周期聚类（如 k-means 对发薪/还款日）。
- AI 分类纠错：本地关键词 + 轻量模型，云端精修。
- 现金流预测：ARIMA/Prophet 或轻量回归，按类别与周期分层。
- 规则自动化：可视化规则（IFTTT风格），沙箱执行。

## 14. 路线图（技术）
- M1：核心数据模型与账期查询、记一笔全链路。
- M2：预算与报表、导入导出、加密。
- M3：同步与共享、多端发布。
- M4：AI/自动化与预测能力。
