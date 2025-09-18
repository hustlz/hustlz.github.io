// Taro 组件使用示例
// 展示如何使用增强后的拨号功能

import React from 'react';
import Taro from '@tarojs/taro';
import { View, Button } from '@tarojs/components';

const PhoneCallExample = () => {
  
  // 方法1: 使用增强后的 Taro.makePhoneCall
  const handleTaroCall = (phoneNumber) => {
    Taro.makePhoneCall({
      phoneNumber: phoneNumber,
      success: (res) => {
        console.log('拨号成功:', res);
        Taro.showToast({
          title: '拨号成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('拨号失败:', err);
        Taro.showToast({
          title: '拨号失败',
          icon: 'error'
        });
      }
    });
  };
  
  // 方法2: 直接使用增强函数
  const handleDirectCall = (phoneNumber) => {
    if (window.enhancedMakePhoneCall) {
      window.enhancedMakePhoneCall(phoneNumber)
        .then(() => {
          console.log('拨号成功');
        })
        .catch((err) => {
          console.error('拨号失败:', err);
        });
    } else {
      // 降级处理
      handleTaroCall(phoneNumber);
    }
  };
  
  // 方法3: 手动触发自定义协议
  const handleCustomProtocolCall = (phoneNumber, protocol = 'callTel') => {
    try {
      // 创建临时链接
      const link = document.createElement('a');
      link.href = `${protocol}://${phoneNumber}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      
      // 模拟点击
      link.click();
      
      // 清理
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
      
      console.log(`使用 ${protocol} 协议拨号:`, phoneNumber);
    } catch (error) {
      console.error('自定义协议拨号失败:', error);
      // 降级到标准方式
      handleTaroCall(phoneNumber);
    }
  };
  
  return (
    <View className="phone-call-demo">
      <View className="title">拨号功能测试</View>
      
      <View className="button-group">
        <Button 
          type="primary" 
          onClick={() => handleTaroCall('10086')}
          style={{ margin: '10px 0' }}
        >
          使用 Taro.makePhoneCall 拨打 10086
        </Button>
        
        <Button 
          type="default" 
          onClick={() => handleDirectCall('10010')}
          style={{ margin: '10px 0' }}
        >
          使用增强函数拨打 10010
        </Button>
        
        <Button 
          type="warn" 
          onClick={() => handleCustomProtocolCall('95588', 'callTel')}
          style={{ margin: '10px 0' }}
        >
          使用 callTel 协议拨打 95588
        </Button>
        
        <Button 
          type="warn" 
          onClick={() => handleCustomProtocolCall('400-800-8888', 'call_tel')}
          style={{ margin: '10px 0' }}
        >
          使用 call_tel 协议拨打 400-800-8888
        </Button>
      </View>
      
      <View className="tips">
        <View>💡 提示：</View>
        <View>• 在 iOS Safari 中，需要用户主动点击才能触发拨号</View>
        <View>• 在 WebView 中，会优先使用自定义协议</View>
        <View>• 自定义协议不可用时会自动降级到 tel: 协议</View>
      </View>
    </View>
  );
};

export default PhoneCallExample;