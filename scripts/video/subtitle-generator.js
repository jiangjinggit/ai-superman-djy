/**
 * 字幕生成器
 * 从配音文案自动生成SRT格式字幕
 */

class SubtitleGenerator {
  /**
   * 从文案生成SRT格式字幕
   * @param {string} text - 完整的配音文案
   * @param {number} audioDuration - 音频总时长（秒）
   * @returns {string} SRT格式字幕内容
   */
  generateSRT(text, audioDuration) {
    // 分句
    const sentences = this.splitSentences(text);
    if (sentences.length === 0) {
      return '';
    }

    // 计算总字符数
    const totalChars = sentences.reduce((sum, s) => sum + s.length, 0);

    // 每个字符的平均时长
    const avgCharDuration = audioDuration / totalChars;

    // 最小句子时长（秒），避免短句闪过太快
    const minDuration = 0.5;

    // 生成SRT
    let srt = '';
    let currentTime = 0;

    sentences.forEach((sentence, index) => {
      // 基于字符数计算时长，但确保最小时长
      let duration = sentence.length * avgCharDuration;
      duration = Math.max(duration, minDuration);

      // 确保不超过剩余时间
      const remainingTime = audioDuration - currentTime;
      if (index === sentences.length - 1) {
        // 最后一句使用剩余所有时间
        duration = remainingTime;
      } else if (duration > remainingTime * 0.8) {
        // 避免占用过多时间
        duration = remainingTime * 0.5;
      }

      const startTime = this.formatTime(currentTime);
      const endTime = this.formatTime(currentTime + duration);

      srt += `${index + 1}\n`;
      srt += `${startTime} --> ${endTime}\n`;
      srt += `${sentence}\n\n`;

      currentTime += duration;
    });

    return srt;
  }

  /**
   * 按标点符号分句
   * @param {string} text - 原始文案
   * @returns {string[]} 分句后的数组
   */
  splitSentences(text) {
    // 按中文标点和换行分句
    return text
      .replace(/([。！？\n])/g, '$1|')
      .replace(/([,，])/g, '$1|') // 逗号也分句，避免字幕太长
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s && s.length > 0)
      .map((s) => this.truncateSentence(s)); // 确保每句不会太长
  }

  /**
   * 截断过长的句子
   * @param {string} sentence - 原始句子
   * @param {number} maxLength - 最大长度（默认20字）
   * @returns {string} 处理后的句子
   */
  truncateSentence(sentence, maxLength = 20) {
    if (sentence.length <= maxLength) {
      return sentence;
    }
    // 如果句子太长，在中间加换行
    const mid = Math.ceil(sentence.length / 2);
    return sentence.slice(0, mid) + '\n' + sentence.slice(mid);
  }

  /**
   * 将秒数转换为SRT时间格式
   * @param {number} seconds - 秒数
   * @returns {string} 格式如 00:00:00,000
   */
  formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  /**
   * 生成ASS格式字幕（支持更丰富的样式）
   * @param {string} text - 配音文案
   * @param {number} audioDuration - 音频时长
   * @param {Object} style - 样式配置
   * @returns {string} ASS格式字幕
   */
  generateASS(text, audioDuration, style = {}) {
    const {
      fontName = 'Source Han Sans CN',
      fontSize = 28,
      primaryColor = '&H00FFFFFF',
      outlineColor = '&H00000000',
      outline = 2,
      marginV = 150,
    } = style;

    const sentences = this.splitSentences(text);
    const totalChars = sentences.reduce((sum, s) => sum + s.length, 0);

    // ASS头部
    let ass = `[Script Info]
Title: Auto Generated Subtitle
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},&H000000FF,${outlineColor},&H00000000,0,0,0,0,100,100,0,0,1,${outline},0,2,10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    let currentTime = 0;
    sentences.forEach((sentence) => {
      const duration = (sentence.length / totalChars) * audioDuration;
      const start = this.formatASSTime(currentTime);
      const end = this.formatASSTime(currentTime + duration);

      ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${sentence.replace(/\n/g, '\\N')}\n`;
      currentTime += duration;
    });

    return ass;
  }

  /**
   * 将秒数转换为ASS时间格式
   * @param {number} seconds - 秒数
   * @returns {string} 格式如 0:00:00.00
   */
  formatASSTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds % 1) * 100);

    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }
}

module.exports = { SubtitleGenerator };
