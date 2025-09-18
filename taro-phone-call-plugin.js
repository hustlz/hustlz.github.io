// Taro 插件：增强 H5 环境下的拨号功能
// 支持自定义协议 callTel 和 call_tel

module.exports = (ctx, options) => {
  const { framework } = ctx;
  
  // 在 H5 环境下注入拨号增强脚本
  ctx.onBuildStart(() => {
    console.log('🔧 正在配置拨号功能增强...');
  });
  
  // 修改 webpack 配置
  ctx.modifyWebpackChain(({ chain, webpack }) => {
    // 只在 H5 环境下生效
    if (process.env.TARO_ENV === 'h5') {
      // 注入全局脚本
      chain.plugin('phone-call-polyfill')
        .use(webpack.BannerPlugin, [{
          banner: `
// Taro H5 拨号功能增强 - 支持自定义协议
(function() {
  ${require('fs').readFileSync(require('path').join(__dirname, 'phone-call-polyfill.js'), 'utf8')}
})();
          `,
          raw: true,
          entryOnly: true
        }]);
    }
  });
  
  // 修改 HTML 模板
  ctx.modifyBuildAssets(({ assets }) => {
    if (process.env.TARO_ENV === 'h5') {
      Object.keys(assets).forEach(key => {
        if (key.endsWith('.html')) {
          let content = assets[key].source();
          
          // 在 head 中添加 meta 标签支持自定义协议
          const metaTags = `
    <meta name="format-detection" content="telephone=yes">
    <!-- 支持自定义协议 -->
    <meta name="apple-itunes-app" content="app-argument=callTel://">
          `;
          
          content = content.replace('<head>', `<head>${metaTags}`);
          
          // 更新资源内容
          assets[key] = {
            source: () => content,
            size: () => content.length
          };
        }
      });
    }
  });
  
  console.log('✅ 拨号功能增强插件已加载');
};