/**
 * 图片生成服务选择器
 * 根据配置选择不同的服务提供商
 */

const providers = {
  gemini3: () => require('./gemini3'),
  siliconflow: () => require('./siliconflow'),
  gemini: () => require('./gemini'),
  zhipu: () => require('./zhipu'),
};

/**
 * 获取图片生成服务
 * @param {string} providerName - 服务名称
 * @returns {Object} 服务实例
 */
function getProvider(providerName) {
  const name = providerName.toLowerCase();

  if (!providers[name]) {
    const available = Object.keys(providers).join(', ');
    throw new Error(`未知的服务: ${name}，可用服务: ${available}`);
  }

  return providers[name]();
}

/**
 * 列出所有可用服务
 */
function listProviders() {
  return [
    {
      name: 'gemini3',
      displayName: 'Gemini 3 (中转站)',
      description: '效果最好，文字渲染准确，推荐使用',
      free: true,
      needProxy: false,
    },
    {
      name: 'siliconflow',
      displayName: '硅基流动 (SiliconFlow)',
      description: '国内可用，注册送免费额度，支持FLUX/SD模型',
      free: true,
      needProxy: false,
    },
    {
      name: 'gemini',
      displayName: 'Google Gemini',
      description: 'Google官方，需要付费账户，效果好',
      free: false,
      needProxy: true,
    },
    {
      name: 'zhipu',
      displayName: '智谱清言 (Zhipu AI)',
      description: '国内可用，CogView模型，有免费额度',
      free: true,
      needProxy: false,
    },
  ];
}

module.exports = { getProvider, listProviders };
