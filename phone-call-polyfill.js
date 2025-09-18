// Taro H5 环境下的拨号功能增强
// 支持原生自定义协议 callTel 和 call_tel

/**
 * 检测是否在 iOS 环境
 */
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * 检测是否在 WebView 环境
 */
function isWebView() {
  const ua = navigator.userAgent;
  return /WebView/.test(ua) || 
         (window.webkit && window.webkit.messageHandlers) ||
         window.__wxjs_environment === 'miniprogram';
}

/**
 * 尝试使用自定义协议拨打电话
 * @param {string} phoneNumber 电话号码
 * @param {string} protocol 协议名称 ('callTel' 或 'call_tel')
 * @returns {boolean} 是否成功调用
 */
function tryCustomProtocol(phoneNumber, protocol) {
  try {
    const customUrl = `${protocol}://${phoneNumber}`;
    
    // 方法1: 直接跳转
    window.location.href = customUrl;
    
    // 方法2: 创建隐藏的 iframe (备用方案)
    setTimeout(() => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = customUrl;
      document.body.appendChild(iframe);
      
      // 清理 iframe
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 100);
    
    return true;
  } catch (error) {
    console.warn(`Failed to use custom protocol ${protocol}:`, error);
    return false;
  }
}

/**
 * 增强的拨号函数
 * @param {string} phoneNumber 电话号码
 * @param {object} options 配置选项
 */
function enhancedMakePhoneCall(phoneNumber, options = {}) {
  // 清理电话号码
  const cleanNumber = phoneNumber.replace(/[^\d+\-\s()]/g, '');
  
  if (isIOS() && isWebView()) {
    // iOS WebView 环境，优先使用自定义协议
    
    // 尝试使用 callTel 协议
    if (tryCustomProtocol(cleanNumber, 'callTel')) {
      console.log('使用 callTel 协议拨号:', cleanNumber);
      return Promise.resolve({ errMsg: 'makePhoneCall:ok' });
    }
    
    // 尝试使用 call_tel 协议
    if (tryCustomProtocol(cleanNumber, 'call_tel')) {
      console.log('使用 call_tel 协议拨号:', cleanNumber);
      return Promise.resolve({ errMsg: 'makePhoneCall:ok' });
    }
    
    // 降级到 tel 协议
    console.log('降级使用 tel 协议:', cleanNumber);
    window.location.href = `tel:${cleanNumber}`;
    return Promise.resolve({ errMsg: 'makePhoneCall:ok' });
  } else {
    // 非 iOS 或非 WebView 环境，使用标准 tel 协议
    window.location.href = `tel:${cleanNumber}`;
    return Promise.resolve({ errMsg: 'makePhoneCall:ok' });
  }
}

/**
 * 重写 Taro 的 makePhoneCall 方法
 */
if (typeof Taro !== 'undefined' && Taro.makePhoneCall) {
  const originalMakePhoneCall = Taro.makePhoneCall;
  
  Taro.makePhoneCall = function(options) {
    const { phoneNumber, success, fail, complete } = options;
    
    try {
      enhancedMakePhoneCall(phoneNumber, options)
        .then((result) => {
          success && success(result);
          complete && complete(result);
        })
        .catch((error) => {
          const errorResult = { errMsg: 'makePhoneCall:fail', error };
          fail && fail(errorResult);
          complete && complete(errorResult);
        });
    } catch (error) {
      // 降级到原始实现
      console.warn('Enhanced makePhoneCall failed, fallback to original:', error);
      return originalMakePhoneCall.call(this, options);
    }
  };
}

// 导出增强函数供直接使用
window.enhancedMakePhoneCall = enhancedMakePhoneCall;

console.log('Phone call polyfill loaded with custom protocol support');