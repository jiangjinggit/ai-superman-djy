/**
 * 视频合成器
 * 使用FFmpeg将图片、音频、字幕合成为视频
 */

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// 尝试使用ffmpeg-static，如果不可用则使用系统FFmpeg
try {
  const ffmpegPath = require('ffmpeg-static');
  if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  }
} catch (e) {
  // 使用系统FFmpeg
  console.log('  使用系统FFmpeg');
}

// 平台配置
const PLATFORM_SPECS = {
  抖音: {
    name: 'douyin',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    subtitleStyle: {
      fontName: 'Helvetica',
      fontSize: 22,           // 缩小字体
      marginV: 25,            // 底部边距
      boxHeight: 80,          // 底部字幕条高度
      boxOpacity: 0.6,        // 背景透明度
    },
  },
  douyin: {
    name: 'douyin',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    subtitleStyle: {
      fontName: 'Helvetica',
      fontSize: 22,
      marginV: 25,
      boxHeight: 80,
      boxOpacity: 0.6,
    },
  },
  b站: {
    name: 'bilibili',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    subtitleStyle: {
      fontName: 'Helvetica',
      fontSize: 20,
      marginV: 20,
      boxHeight: 60,
      boxOpacity: 0.6,
    },
  },
  bilibili: {
    name: 'bilibili',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    subtitleStyle: {
      fontName: 'Helvetica',
      fontSize: 20,
      marginV: 20,
      boxHeight: 60,
      boxOpacity: 0.6,
    },
  },
};

class VideoComposer {
  constructor() {
    this.tempDir = '';
  }

  /**
   * 合成视频
   * @param {Object} options - 合成选项
   * @returns {Promise<string>} 输出视频路径
   */
  async compose(options) {
    const {
      images,
      audioPath,
      subtitlePath,
      outputPath,
      platform = 'douyin',
      audioDuration,
    } = options;

    const spec = PLATFORM_SPECS[platform.toLowerCase()] || PLATFORM_SPECS.douyin;
    console.log(`\n  合成 ${spec.name} 版本 (${spec.width}x${spec.height})...`);

    // 1. 创建临时目录
    this.tempDir = path.join(path.dirname(outputPath), 'temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    try {
      // 2. 处理图片（调整尺寸和比例）
      const processedImages = await this.processImages(images, spec);

      // 3. 创建图片幻灯片视频
      const slideshowPath = path.join(this.tempDir, 'slideshow.mp4');
      await this.createSlideshow(processedImages, audioDuration, spec, slideshowPath);

      // 4. 合并音频
      const withAudioPath = path.join(this.tempDir, 'with_audio.mp4');
      await this.mergeAudio(slideshowPath, audioPath, withAudioPath);

      // 5. 烧录字幕
      await this.burnSubtitles(withAudioPath, subtitlePath, outputPath, spec);

      // 6. 清理临时文件
      this.cleanup();

      console.log(`  ✓ 完成: ${path.basename(outputPath)}`);
      return outputPath;
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * 处理图片：调整尺寸以适配目标平台
   */
  async processImages(images, spec) {
    const processedImages = [];

    for (let i = 0; i < images.length; i++) {
      const inputPath = images[i];
      const outputPath = path.join(this.tempDir, `processed_${i}.png`);

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-vf',
            `scale=${spec.width}:${spec.height}:force_original_aspect_ratio=decrease,` +
              `pad=${spec.width}:${spec.height}:(ow-iw)/2:(oh-ih)/2:black`,
          ])
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      processedImages.push(outputPath);
    }

    return processedImages;
  }

  /**
   * 创建图片幻灯片视频
   */
  async createSlideshow(images, audioDuration, spec, outputPath) {
    const imageDuration = audioDuration / images.length;

    // 创建concat文件
    const concatFile = path.join(this.tempDir, 'concat.txt');
    const concatContent = images
      .map((img) => `file '${img}'\nduration ${imageDuration}`)
      .join('\n');
    fs.writeFileSync(concatFile, concatContent + `\nfile '${images[images.length - 1]}'`);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatFile)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-r',
          '30',
          '-t',
          String(audioDuration),
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  /**
   * 合并音频
   */
  async mergeAudio(videoPath, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions(['-c:v', 'copy', '-c:a', 'aac', '-shortest'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  /**
   * 烧录字幕（带底部半透明背景条）
   */
  async burnSubtitles(videoPath, subtitlePath, outputPath, spec) {
    // 复制字幕文件到临时目录，避免路径问题
    const tempSubtitlePath = path.join(this.tempDir, 'subtitle.srt');
    fs.copyFileSync(subtitlePath, tempSubtitlePath);

    const style = spec.subtitleStyle;
    const boxHeight = style.boxHeight || 80;
    const boxOpacity = style.boxOpacity || 0.6;

    // 构建滤镜：先画底部半透明黑色条，再叠加字幕
    // drawbox: 在底部画一个半透明黑色矩形
    // subtitles: 在矩形内显示字幕
    const filterComplex = [
      // 底部半透明黑色条
      `drawbox=y=ih-${boxHeight}:w=iw:h=${boxHeight}:color=black@${boxOpacity}:t=fill`,
      // 字幕（Alignment=2表示底部居中）
      `subtitles=${tempSubtitlePath}:force_style='` +
        `FontName=${style.fontName},` +
        `FontSize=${style.fontSize},` +
        `PrimaryColour=&H00FFFFFF,` +
        `OutlineColour=&H00000000,` +
        `Outline=1,` +
        `Alignment=2,` +
        `MarginV=${style.marginV}'`,
    ].join(',');

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions(['-vf', filterComplex, '-c:a', 'copy'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  /**
   * 清理临时文件
   */
  cleanup() {
    if (this.tempDir && fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
  }

  /**
   * 获取音频时长
   */
  static async getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration);
        }
      });
    });
  }
}

module.exports = { VideoComposer, PLATFORM_SPECS };
