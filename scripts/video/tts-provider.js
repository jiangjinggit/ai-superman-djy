/**
 * TTS配音服务适配器
 * 支持多种TTS服务：
 * - edge-tts: 微软Edge TTS（免费）
 * - siliconflow: 硅基流动 CosyVoice2（付费，更自然）
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Edge TTS 可用的中文语音列表
const EDGE_VOICES = {
  'zh-CN-YunxiNeural': '云希 - 成熟男声（推荐）',
  'zh-CN-XiaomoNeural': '晓墨 - 成熟女声（推荐）',
  'zh-CN-YunyangNeural': '云扬 - 新闻播报风格',
  'zh-CN-XiaoyiNeural': '小艺 - 年轻活泼女声',
  'zh-CN-XiaoxiaoNeural': '晓晓 - 新闻播报风格',
  'zh-CN-XiaohanNeural': '晓涵 - 温柔女声',
  'zh-CN-YunjianNeural': '云健 - 沉稳男声',
};

// SiliconFlow CosyVoice2 可用音色
const COSYVOICE_VOICES = {
  'alex': 'Alex - 成熟男声（推荐，最自然）',
  'anna': 'Anna - 成熟女声（推荐）',
  'bella': 'Bella - 温柔女声',
  'benjamin': 'Benjamin - 沉稳男声',
  'charles': 'Charles - 年轻男声',
  'claire': 'Claire - 知性女声',
  'david': 'David - 活力男声',
  'diana': 'Diana - 甜美女声',
};

// Python edge-tts 可执行路径
const EDGE_TTS_PATH = '/Users/daipeiyuan/Library/Python/3.9/bin/edge-tts';

// SiliconFlow API 配置
const SILICONFLOW_API_BASE = 'https://api.siliconflow.cn/v1';
const COSYVOICE_MODEL = 'FunAudioLLM/CosyVoice2-0.5B';

/**
 * TTS Provider 工厂函数
 * @param {Object} config - 配置
 * @returns {EdgeTTSProvider|SiliconFlowTTSProvider}
 */
function createTTSProvider(config = {}) {
  const provider = config.provider || process.env.TTS_PROVIDER || 'edge';

  if (provider === 'siliconflow' || provider === 'cosyvoice') {
    return new SiliconFlowTTSProvider(config);
  }

  return new EdgeTTSProvider(config);
}

/**
 * Edge TTS Provider（免费）
 */
class EdgeTTSProvider {
  constructor(config = {}) {
    this.voice = config.voice || 'zh-CN-YunxiNeural';
    this.speed = config.speed || 1.0;
    this.pitch = config.pitch || '+0Hz';
    this.name = 'Edge TTS';
  }

  async synthesize(text, outputPath) {
    console.log(`  服务: ${this.name}`);
    console.log(`  语音: ${this.voice} (${EDGE_VOICES[this.voice] || '未知'})`);

    const rate = this.formatRate(this.speed);
    const pitch = this.formatPitch(this.pitch);
    console.log(`  语速: ${rate}, 音调: ${pitch}`);

    const tempTextFile = outputPath + '.txt';
    fs.writeFileSync(tempTextFile, text, 'utf-8');

    try {
      const cmd = `"${EDGE_TTS_PATH}" --voice "${this.voice}" --rate="${rate}" --pitch="${pitch}" --file "${tempTextFile}" --write-media "${outputPath}"`;

      await new Promise((resolve, reject) => {
        exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`TTS生成失败: ${error.message}\n${stderr}`));
          } else {
            resolve();
          }
        });
      });

      fs.unlinkSync(tempTextFile);
      return outputPath;
    } catch (error) {
      if (fs.existsSync(tempTextFile)) {
        fs.unlinkSync(tempTextFile);
      }
      throw error;
    }
  }

  formatPitch(pitch) {
    if (typeof pitch === 'string') {
      if (pitch.includes('Hz')) return pitch;
      if (pitch.includes('%')) {
        const match = pitch.match(/([+-]?\d+)%/);
        if (match) return `${match[1]}Hz`;
      }
    }
    return '+0Hz';
  }

  formatRate(speed) {
    if (typeof speed === 'string') {
      if (speed.includes('%')) return speed;
      speed = parseFloat(speed) || 1.0;
    }
    const percentage = Math.round((speed - 1) * 100);
    return percentage >= 0 ? `+${percentage}%` : `${percentage}%`;
  }

  async getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
      const ffmpeg = require('fluent-ffmpeg');
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration);
      });
    });
  }
}

/**
 * SiliconFlow CosyVoice2 Provider（付费，更自然）
 */
class SiliconFlowTTSProvider {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.SILICONFLOW_API_KEY;
    // CosyVoice2 使用自己的音色ID，不使用脚本中的 Edge TTS 语音配置
    this.voice = process.env.SILICONFLOW_TTS_VOICE || 'alex';
    this.speed = config.speed || 1.0;
    this.gain = config.gain || 0;
    // MP3 格式需要 32000 或 44100Hz
    this.sampleRate = config.sampleRate || 32000;
    this.name = 'SiliconFlow CosyVoice2';

    if (!this.apiKey) {
      throw new Error(
        '使用 SiliconFlow TTS 需要配置 SILICONFLOW_API_KEY\n' +
        '获取地址: https://cloud.siliconflow.cn/account/ak'
      );
    }
  }

  async synthesize(text, outputPath) {
    console.log(`  服务: ${this.name}`);
    console.log(`  语音: ${this.voice} (${COSYVOICE_VOICES[this.voice] || '自定义'})`);
    console.log(`  语速: ${this.speed}, 采样率: ${this.sampleRate}Hz`);

    const voiceId = `${COSYVOICE_MODEL}:${this.voice}`;

    const response = await fetch(`${SILICONFLOW_API_BASE}/audio/speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: COSYVOICE_MODEL,
        input: text,
        voice: voiceId,
        response_format: 'mp3',
        sample_rate: this.sampleRate,
        stream: false,
        speed: this.speed,
        gain: this.gain,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SiliconFlow TTS API错误 (${response.status}): ${error}`);
    }

    // 获取音频数据并保存
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(outputPath, buffer);

    console.log(`  ✓ 音频生成完成: ${(buffer.length / 1024).toFixed(1)}KB`);
    return outputPath;
  }

  async getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
      const ffmpeg = require('fluent-ffmpeg');
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration);
      });
    });
  }
}

/**
 * 列出所有可用语音
 */
function listVoices() {
  console.log('\n=== Edge TTS 语音（免费）===\n');
  Object.entries(EDGE_VOICES).forEach(([id, name]) => {
    console.log(`  ${id}: ${name}`);
  });

  console.log('\n=== SiliconFlow CosyVoice2 语音（付费，更自然）===\n');
  Object.entries(COSYVOICE_VOICES).forEach(([id, name]) => {
    console.log(`  ${id}: ${name}`);
  });

  console.log('\n使用方法:');
  console.log('  Edge TTS: 在脚本中设置 语音: zh-CN-YunxiNeural');
  console.log('  CosyVoice2: 设置环境变量 TTS_PROVIDER=siliconflow，语音设置为 alex/anna 等');
  console.log('');
}

// 兼容旧的导出方式
class TTSProvider extends EdgeTTSProvider {}

module.exports = {
  TTSProvider,
  EdgeTTSProvider,
  SiliconFlowTTSProvider,
  createTTSProvider,
  listVoices,
  EDGE_VOICES,
  COSYVOICE_VOICES,
  VOICES: EDGE_VOICES, // 兼容旧代码
};
