/**
 * Google Gemini 图片生成适配器
 *
 * 需要付费账户
 * 需要代理访问
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiProvider {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;

    if (!this.apiKey) {
      throw new Error(
        '请配置 GEMINI_API_KEY\n' +
        '获取地址: https://aistudio.google.com/app/apikey'
      );
    }

    // 配置代理
    this.setupProxy();

    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp-image-generation'
    });
  }

  /**
   * 配置代理
   */
  setupProxy() {
    const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    if (proxyUrl) {
      try {
        const { ProxyAgent, setGlobalDispatcher } = require('undici');
        setGlobalDispatcher(new ProxyAgent(proxyUrl));
        console.log(`   🌐 Gemini使用代理: ${proxyUrl}`);
      } catch (e) {
        console.warn('   ⚠️ 代理配置失败，请确保安装了undici');
      }
    }
  }

  /**
   * 生成图片
   * @param {string} prompt - 英文提示词
   * @param {Object} options - 选项
   * @returns {Promise<Buffer>} 图片数据
   */
  async generateImage(prompt, options = {}) {
    try {
      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: `Generate an image: ${prompt}` }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE']
        }
      });

      const response = await result.response;

      // 查找图片部分
      for (const candidate of response.candidates || []) {
        for (const part of candidate.content?.parts || []) {
          if (part.inlineData) {
            return Buffer.from(part.inlineData.data, 'base64');
          }
        }
      }

      throw new Error('API返回中没有图片数据');
    } catch (error) {
      throw new Error(`图片生成失败: ${error.message}`);
    }
  }

  /**
   * 获取服务信息
   */
  getInfo() {
    return {
      name: 'Google Gemini',
      model: 'gemini-2.0-flash-exp-image-generation',
      free: false,
      needProxy: true,
    };
  }
}

module.exports = new GeminiProvider();
