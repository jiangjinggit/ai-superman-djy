/**
 * 智谱清言 (Zhipu AI) 图片生成适配器
 *
 * 官网：https://open.bigmodel.cn
 * 支持模型：CogView-3
 * 免费额度：新用户有免费token
 */

const API_BASE = 'https://open.bigmodel.cn/api/paas/v4';

class ZhipuProvider {
  constructor() {
    this.apiKey = process.env.ZHIPU_API_KEY;

    if (!this.apiKey) {
      throw new Error(
        '请配置 ZHIPU_API_KEY\n' +
        '获取地址: https://open.bigmodel.cn/usercenter/apikeys'
      );
    }
  }

  /**
   * 生成图片
   * @param {string} prompt - 英文提示词
   * @param {Object} options - 选项
   * @returns {Promise<Buffer>} 图片数据
   */
  async generateImage(prompt, options = {}) {
    const size = this.parseSize(options.aspectRatio || '1:1');

    const response = await fetch(`${API_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'cogview-3-flash',
        prompt: prompt,
        size: size,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API错误 (${response.status}): ${error}`);
    }

    const data = await response.json();

    // 获取图片URL并下载
    if (data.data && data.data.length > 0) {
      const imageUrl = data.data[0].url;
      return await this.downloadImage(imageUrl);
    }

    throw new Error('API返回中没有图片数据');
  }

  /**
   * 下载图片
   */
  async downloadImage(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`下载图片失败: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * 解析比例为尺寸
   */
  parseSize(aspectRatio) {
    // CogView支持的尺寸
    const sizeMap = {
      '1:1': '1024x1024',
      '3:4': '768x1024',
      '4:3': '1024x768',
      '9:16': '720x1280',
      '16:9': '1280x720',
      '2:1': '1024x512',
      '2.35:1': '1024x436',
    };
    return sizeMap[aspectRatio] || '1024x1024';
  }

  /**
   * 获取服务信息
   */
  getInfo() {
    return {
      name: 'Zhipu AI (智谱清言)',
      model: 'cogview-3-flash',
      free: true,
      needProxy: false,
    };
  }
}

module.exports = new ZhipuProvider();
