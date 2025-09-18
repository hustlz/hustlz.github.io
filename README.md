# Taro H5 拨号功能增强

解决 `taro.makePhoneCall` 在 iOS H5 环境中不生效的问题，支持原生自定义协议 `callTel` 和 `call_tel`。

## 问题背景

原生应用已经支持了 `callTel` 和 `call_tel` 自定义协议，但 Taro 的 `makePhoneCall` 在 H5 编译后仍然使用默认的 `tel:` 协议，导致在 iOS WebView 环境中无法正常工作。

## 解决方案

通过以下方式增强 Taro H5 环境下的拨号功能：

1. **协议优先级**：`callTel` > `call_tel` > `tel`
2. **自动降级**：当自定义协议不可用时，自动降级到标准 `tel:` 协议
3. **环境检测**：根据运行环境选择最佳的拨号方式

## 集成步骤

### 1. 复制文件到项目

将以下文件复制到您的 Taro 项目中：

```
├── phone-call-polyfill.js      # 核心增强脚本
├── taro-phone-call-plugin.js   # Taro 插件
├── debug-phone-call.js         # 调试工具（可选）
└── phone-call-example.jsx      # 使用示例（可选）
```

### 2. 配置 Taro 项目

在 `config/index.js` 中添加插件配置：

```javascript
const config = {
  // ... 其他配置
  plugins: [
    // 添加拨号功能增强插件
    ['./taro-phone-call-plugin.js', {
      protocols: ['callTel', 'call_tel'],
      fallbackToTel: true,
      debug: process.env.NODE_ENV === 'development'
    }]
  ],
  // ...
}
```

### 3. 在页面中使用

#### 方式一：直接使用 Taro.makePhoneCall（推荐）

```javascript
import Taro from '@tarojs/taro';

// 使用方式与之前完全一致
Taro.makePhoneCall({
  phoneNumber: '10086',
  success: (res) => {
    console.log('拨号成功:', res);
  },
  fail: (err) => {
    console.error('拨号失败:', err);
  }
});
```

#### 方式二：使用增强函数

```javascript
// 直接调用增强函数
window.enhancedMakePhoneCall('10086')
  .then(() => console.log('拨号成功'))
  .catch(err => console.error('拨号失败:', err));
```

#### 方式三：手动指定协议

```javascript
// 手动使用特定协议
const link = document.createElement('a');
link.href = 'callTel://10086';
link.click();
```

### 4. 调试和测试

在开发环境中，可以使用调试工具：

```javascript
// 在浏览器控制台中
window.phoneDebugger.testPhoneCall('10086');
window.phoneDebugger.exportDebugReport();
```

## 工作原理

### 协议检测流程

1. **环境检测**：判断是否在 iOS WebView 环境
2. **协议测试**：依次测试 `callTel`、`call_tel`、`tel` 协议的可用性
3. **自动选择**：选择第一个可用的协议进行拨号
4. **错误处理**：提供完整的成功/失败回调

### 实现方式

```javascript
// 核心逻辑伪代码
function enhancedMakePhoneCall(phoneNumber) {
  if (isIOSWebView()) {
    // 尝试自定义协议
    if (tryProtocol('callTel', phoneNumber)) return;
    if (tryProtocol('call_tel', phoneNumber)) return;
  }
  
  // 降级到标准协议
  window.location.href = `tel:${phoneNumber}`;
}
```

## 兼容性说明

- ✅ iOS Safari 浏览器
- ✅ iOS WebView (WKWebView/UIWebView)
- ✅ Android 浏览器和 WebView
- ✅ 微信内置浏览器
- ✅ 支付宝内置浏览器

## 注意事项

1. **用户交互要求**：iOS 要求拨号必须由用户主动触发，不能自动执行
2. **协议注册**：确保原生应用正确注册了 `callTel` 和 `call_tel` 协议
3. **权限配置**：原生应用需要配置相应的 URL Scheme 处理
4. **测试建议**：在真实设备上测试，模拟器可能表现不一致

## 故障排除

### 问题：点击后没有反应

**可能原因**：
1. 原生应用未正确注册协议
2. 协议名称不匹配
3. 在非用户交互事件中调用

**解决方案**：
1. 检查原生应用的协议注册
2. 使用调试工具检测协议可用性
3. 确保在用户点击事件中调用

### 问题：总是使用 tel: 协议

**可能原因**：
1. 自定义协议检测失败
2. 环境检测不准确

**解决方案**：
1. 启用调试模式查看日志
2. 手动测试协议可用性
3. 检查插件配置

## 更新日志

- **v1.0.0**：初始版本，支持 callTel 和 call_tel 协议
- 支持自动协议检测和降级
- 提供完整的调试工具

## 技术支持

如有问题，请提供以下信息：
1. 调试报告（使用 `window.phoneDebugger.exportDebugReport()`）
2. 设备型号和 iOS 版本
3. 原生应用的协议注册代码
4. 具体的错误信息和复现步骤