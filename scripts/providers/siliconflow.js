/**
 * 硅基流动 (SiliconFlow) 图片生成适配器
 *
 * 官网：https://siliconflow.cn
 * 免费额度：注册送额度，日常有免费模型
 * 支持模型：FLUX、Stable Diffusion 等
 */

const API_BASE = 'https://api.siliconflow.cn/v1';

// 可用模型列表（免费模型优先）
const MODELS = {
  // 免费模型
  'flux-schnell': 'black-forest-labs/FLUX.1-schnell',
  // 付费模型（效果更好）
  'flux-dev': 'black-forest-labs/FLUX.1-dev',
  'sd-xl': 'stabilityai/stable-diffusion-xl-base-1.0',
  'sd-3': 'stabilityai/stable-diffusion-3-medium',
};

// 默认使用免费模型
const DEFAULT_MODEL = 'flux-schnell';

class SiliconFlowProvider {
  constructor() {
    this.apiKey = process.env.SILICONFLOW_API_KEY;
    this.model = process.env.SILICONFLOW_MODEL || DEFAULT_MODEL;

    if (!this.apiKey) {
      throw new Error(
        '请配置 SILICONFLOW_API_KEY\n' +
        '获取地址: https://cloud.siliconflow.cn/account/ak'
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
    const modelId = MODELS[this.model] || MODELS[DEFAULT_MODEL];

    // 解析尺寸
    const size = this.parseSize(options.aspectRatio || '1:1');

    const response = await fetch(`${API_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        prompt: prompt,
        image_size: size,
        num_inference_steps: 20,
        guidance_scale: 7.5,
        num_images: 1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API错误 (${response.status}): ${error}`);
    }

    const data = await response.json();

    // 获取图片URL并下载
    if (data.images && data.images.length > 0) {
      const imageUrl = data.images[0].url;
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
    const sizeMap = {
      '1:1': '1024x1024',
      '3:4': '768x1024',
      '4:3': '1024x768',
      '9:16': '576x1024',
      '16:9': '1024x576',
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
      name: 'SiliconFlow',
      model: this.model,
      modelId: MODELS[this.model],
      free: this.model === 'flux-schnell',
    };
  }
}

module.exports = new SiliconFlowProvider();
