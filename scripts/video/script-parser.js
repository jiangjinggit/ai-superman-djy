/**
 * 视频脚本解析器
 * 从Markdown格式的视频脚本中提取分镜、配音文案、配图提示词等信息
 */

class ScriptParser {
  /**
   * 解析视频脚本
   * @param {string} content - Markdown格式的脚本内容
   * @returns {Object} 解析后的脚本数据
   */
  parse(content) {
    return {
      meta: this.parseMeta(content),
      ttsConfig: this.parseTTSConfig(content),
      scenes: this.parseScenes(content),
      prompts: this.parsePrompts(content),
    };
  }

  /**
   * 解析视频元信息
   */
  parseMeta(content) {
    const titleMatch = content.match(/\*\*标题\*\*[：:]\s*(.+)/);
    const durationMatch = content.match(/\*\*时长\*\*[：:]\s*(\d+)/);
    const platformMatch = content.match(/\*\*平台\*\*[：:]\s*(.+)/);
    const styleMatch = content.match(/\*\*风格\*\*[：:]\s*(.+)/);

    // 从文件名提取日期
    const dateMatch = content.match(/(\d{4}-\d{2}-\d{2})/);

    return {
      title: titleMatch ? titleMatch[1].trim() : '未命名视频',
      duration: durationMatch ? parseInt(durationMatch[1]) : 60,
      platforms: platformMatch
        ? platformMatch[1].split(/[,，]/).map((s) => s.trim().toLowerCase())
        : ['抖音'],
      style: styleMatch ? styleMatch[1].trim() : '图文混排+配音',
      date: dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10),
    };
  }

  /**
   * 解析TTS配置
   */
  parseTTSConfig(content) {
    const voiceMatch = content.match(/\*\*语音\*\*[：:]\s*(.+)/);
    const speedMatch = content.match(/\*\*语速\*\*[：:]\s*(.+)/);
    const pitchMatch = content.match(/\*\*音调\*\*[：:]\s*(.+)/);

    return {
      voice: voiceMatch ? voiceMatch[1].trim() : 'zh-CN-XiaoyiNeural',
      speed: speedMatch ? parseFloat(speedMatch[1]) : 1.0,
      pitch: pitchMatch ? pitchMatch[1].trim() : '+0%',
    };
  }

  /**
   * 解析分镜信息
   */
  parseScenes(content) {
    const scenes = [];

    // 匹配 ## 分镜脚本 部分
    const scriptSection = content.match(
      /## 分镜脚本[\s\S]*?(?=## 配图提示词|$)/
    );
    if (!scriptSection) {
      return scenes;
    }

    // 分割每个场景
    const sceneBlocks = scriptSection[0].split(/### 场景\d+[：:]/);

    for (let i = 1; i < sceneBlocks.length; i++) {
      const block = sceneBlocks[i];

      // 提取场景标题（第一行）
      const titleMatch = block.match(/^(.+?)[\n\r]/);
      const title = titleMatch ? titleMatch[1].trim() : `场景${i}`;

      // 提取配图提示词
      const promptMatch = block.match(/\*\*配图提示词\*\*[：:]\s*(.+?)[\n\r]/);
      const imagePrompt = promptMatch ? this.cleanPrompt(promptMatch[1]) : '';

      // 提取配音文案（支持多行引用格式）
      const voiceMatch = block.match(
        /\*\*配音文案\*\*[：:]\s*\n([\s\S]*?)(?=\n###|\n---|\n##|$)/
      );
      let voiceText = '';
      if (voiceMatch) {
        voiceText = voiceMatch[1]
          .split('\n')
          .map((line) => line.replace(/^>\s*/, '').trim())
          .filter((line) => line)
          .join('\n');
      }

      if (voiceText) {
        scenes.push({
          index: i,
          title: title,
          imagePrompt: imagePrompt,
          voiceText: voiceText,
        });
      }
    }

    return scenes;
  }

  /**
   * 解析配图提示词（用于图片生成）
   * 复用现有generate-images.js的格式
   */
  parsePrompts(content) {
    const prompts = [];

    // 匹配 ## 配图提示词汇总 部分
    const promptSection = content.match(/## 配图提示词[\s\S]*$/);
    if (!promptSection) {
      return prompts;
    }

    const section = promptSection[0];

    // 匹配每个图片块
    const imageBlocks = section.split(/### 图\d+[：:]/);

    for (let i = 1; i < imageBlocks.length; i++) {
      const block = imageBlocks[i];

      // 提取图片名称
      const nameMatch = block.match(/^(.+?)[\n\r]/);
      const name = nameMatch ? nameMatch[1].trim() : `图${i}`;

      // 提取英文提示词
      const promptMatch = block.match(/\*\*英文提示词\*\*[：:]\s*(.+?)(?:\n|$)/);
      if (promptMatch) {
        let prompt = promptMatch[1].trim();

        // 提取尺寸参数
        const arMatch = prompt.match(/--ar\s+([\d:.]+)/);
        const aspectRatio = arMatch ? arMatch[1] : '9:16';

        // 移除Midjourney特有参数
        prompt = this.cleanPrompt(prompt);

        prompts.push({
          index: i,
          name: name,
          prompt: prompt,
          aspectRatio: aspectRatio,
        });
      }
    }

    return prompts;
  }

  /**
   * 清理提示词，移除Midjourney参数
   */
  cleanPrompt(prompt) {
    return prompt
      .replace(/--ar\s+[\d:.]+/g, '')
      .replace(/--style\s+\w+/g, '')
      .replace(/--v\s+[\d.]+/g, '')
      .replace(/--seed\s+\d+/g, '')
      .replace(/--q\s+[\d.]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 获取完整的配音文案（合并所有场景）
   */
  getFullVoiceText(scenes) {
    return scenes.map((scene) => scene.voiceText).join('\n\n');
  }

  /**
   * 从文件路径提取日期
   */
  extractDateFromPath(filePath) {
    const match = filePath.match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : new Date().toISOString().slice(0, 10);
  }
}

module.exports = { ScriptParser };
