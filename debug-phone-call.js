// 拨号功能调试工具
// 用于测试和调试自定义协议的工作状态

class PhoneCallDebugger {
  constructor() {
    this.logs = [];
    this.protocols = ['callTel', 'call_tel', 'tel'];
    this.init();
  }
  
  init() {
    console.log('📱 拨号调试工具已启动');
    this.detectEnvironment();
    this.setupProtocolTests();
  }
  
  // 检测当前环境
  detectEnvironment() {
    const env = {
      userAgent: navigator.userAgent,
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
      isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
      isWebView: /WebView/.test(navigator.userAgent),
      hasWebKit: !!(window.webkit && window.webkit.messageHandlers),
      isTaroH5: process.env.TARO_ENV === 'h5',
      supportedProtocols: []
    };
    
    console.log('🔍 环境检测结果:', env);
    this.environment = env;
    return env;
  }
  
  // 测试协议支持情况
  async testProtocolSupport(protocol, phoneNumber = '10086') {
    return new Promise((resolve) => {
      const testUrl = `${protocol}://${phoneNumber}`;
      const startTime = Date.now();
      
      try {
        // 创建隐藏的 iframe 进行测试
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        
        let resolved = false;
        
        // 超时处理
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            document.body.removeChild(iframe);
            resolve({
              protocol,
              supported: false,
              error: 'timeout',
              duration: Date.now() - startTime
            });
          }
        }, 2000);
        
        // 成功处理
        iframe.onload = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            document.body.removeChild(iframe);
            resolve({
              protocol,
              supported: true,
              duration: Date.now() - startTime
            });
          }
        };
        
        // 错误处理
        iframe.onerror = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            document.body.removeChild(iframe);
            resolve({
              protocol,
              supported: false,
              error: 'load_error',
              duration: Date.now() - startTime
            });
          }
        };
        
        document.body.appendChild(iframe);
        iframe.src = testUrl;
        
      } catch (error) {
        resolve({
          protocol,
          supported: false,
          error: error.message,
          duration: Date.now() - startTime
        });
      }
    });
  }
  
  // 设置协议测试
  async setupProtocolTests() {
    console.log('🧪 开始测试协议支持...');
    
    const results = await Promise.all(
      this.protocols.map(protocol => this.testProtocolSupport(protocol))
    );
    
    console.log('📊 协议测试结果:', results);
    this.protocolResults = results;
    
    // 更新环境信息
    this.environment.supportedProtocols = results
      .filter(r => r.supported)
      .map(r => r.protocol);
    
    return results;
  }
  
  // 获取最佳协议
  getBestProtocol() {
    const customProtocols = this.environment.supportedProtocols
      .filter(p => p !== 'tel');
    
    if (customProtocols.length > 0) {
      return customProtocols[0]; // 返回第一个可用的自定义协议
    }
    
    return 'tel'; // 降级到标准协议
  }
  
  // 执行拨号测试
  testPhoneCall(phoneNumber, protocol) {
    const testProtocol = protocol || this.getBestProtocol();
    const url = `${testProtocol}://${phoneNumber}`;
    
    console.log(`📞 测试拨号: ${url}`);
    
    try {
      // 记录日志
      this.log('test_call', {
        phoneNumber,
        protocol: testProtocol,
        url,
        timestamp: new Date().toISOString()
      });
      
      // 执行拨号
      window.location.href = url;
      
      return { success: true, protocol: testProtocol, url };
    } catch (error) {
      console.error('拨号测试失败:', error);
      this.log('test_call_error', { error: error.message, protocol: testProtocol });
      return { success: false, error: error.message };
    }
  }
  
  // 记录日志
  log(type, data) {
    const logEntry = {
      type,
      data,
      timestamp: Date.now(),
      readable: new Date().toLocaleString()
    };
    
    this.logs.push(logEntry);
    console.log(`📝 [${type}]`, data);
  }
  
  // 获取调试报告
  getDebugReport() {
    return {
      environment: this.environment,
      protocolResults: this.protocolResults,
      logs: this.logs,
      bestProtocol: this.getBestProtocol()
    };
  }
  
  // 导出调试报告
  exportDebugReport() {
    const report = this.getDebugReport();
    const reportStr = JSON.stringify(report, null, 2);
    
    console.log('📋 调试报告:', report);
    
    // 复制到剪贴板
    if (navigator.clipboard) {
      navigator.clipboard.writeText(reportStr);
      console.log('✅ 调试报告已复制到剪贴板');
    }
    
    return report;
  }
}

// 全局暴露调试器
window.PhoneCallDebugger = PhoneCallDebugger;

// 自动启动调试器
if (typeof window !== 'undefined') {
  window.phoneDebugger = new PhoneCallDebugger();
}

console.log('🔧 拨号调试工具已加载，使用 window.phoneDebugger 访问');