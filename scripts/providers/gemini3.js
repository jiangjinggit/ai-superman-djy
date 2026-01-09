/**
 * Gemini 3 中转站适配器
 *
 * 使用第三方中转API访问Gemini 3图片生成
 * 效果最好，文字渲染准确
 */

const API_BASE = 'https://chatapi.onechats.ai/v1beta/models';
const MODEL = 'gemini-3-pro-image';

class Gemini3Provider {
  constructor() {
    this.apiKey = process.env.GEMINI3_API_KEY;

    if (!this.apiKey) {
      throw new Error(
        '请配置 GEMINI3_API_KEY\n' +
        '这是Gemini 3中转站的API Key'
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
    const aspectRatio = this.parseAspectRatio(options.aspectRatio || '1:1');

    const response = await fetch(`${API_BASE}/${MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio
          }
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API错误 (${response.status}): ${error}`);
    }

    const data = await response.json();

    // 检查错误
    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }

    // 提取图片数据
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const parts = data.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData) {
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }
    }

    throw new Error('API返回中没有图片数据');
  }

  /**
   * 解析比例
   */
  parseAspectRatio(ratio) {
    // Gemini 3 支持的比例格式
    const ratioMap = {
      '1:1': '1:1',
      '3:4': '3:4',
      '4:3': '4:3',
      '9:16': '9:16',
      '16:9': '16:9',
      '2:1': '16:9',      // 近似
      '2.35:1': '16:9',   // 近似
    };
    return ratioMap[ratio] || '1:1';
  }

  /**
   * 获取服务信息
   */
  getInfo() {
    return {
      name: 'Gemini 3 (中转站)',
      model: MODEL,
      free: true,  // 取决于中转站
      needProxy: false,
    };
  }
}

module.exports = new Gemini3Provider();
