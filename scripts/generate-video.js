/**
 * AI视频生成脚本
 * 从视频脚本自动生成图文混排+配音类型的视频
 *
 * 使用方法：
 *   npm run video <脚本路径>           # 生成指定脚本的视频
 *   npm run video <脚本路径> --douyin  # 只生成抖音版本
 *   npm run video <脚本路径> --bilibili # 只生成B站版本
 *   npm run video -- --voices          # 列出可用语音
 *   npm run video -- --help            # 显示帮助
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { ScriptParser } = require('./video/script-parser');
const { createTTSProvider, listVoices } = require('./video/tts-provider');
const { SubtitleGenerator } = require('./video/subtitle-generator');
const { VideoComposer } = require('./video/video-composer');

// 项目根目录
const ROOT_DIR = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'content', 'assets');

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  console.log('🎬 AI视频生成工具');
  console.log('==================\n');

  // 处理命令行参数
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  if (args.includes('--voices')) {
    listVoices();
    return;
  }

  // 获取脚本路径
  const scriptPath = args.find((a) => !a.startsWith('-'));
  if (!scriptPath) {
    console.error('❌ 请提供视频脚本路径');
    console.log('\n使用方法: npm run video <脚本路径>');
    console.log('例如: npm run video content/scripts/2026-01-01-video-xxx.md');
    process.exit(1);
  }

  // 检查文件是否存在
  const fullPath = path.isAbsolute(scriptPath) ? scriptPath : path.join(ROOT_DIR, scriptPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ 文件不存在: ${fullPath}`);
    process.exit(1);
  }

  // 解析平台参数
  let targetPlatforms = null;
  if (args.includes('--douyin')) {
    targetPlatforms = ['抖音'];
  } else if (args.includes('--bilibili')) {
    targetPlatforms = ['b站'];
  }

  try {
    await processScript(fullPath, targetPlatforms);
  } catch (error) {
    console.error(`\n❌ 生成失败: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * 处理单个脚本文件
 */
async function processScript(scriptPath, targetPlatforms = null) {
  console.log(`📄 处理脚本: ${path.basename(scriptPath)}\n`);

  // 1. 解析脚本
  console.log('📝 解析脚本...');
  const content = fs.readFileSync(scriptPath, 'utf-8');
  const parser = new ScriptParser();
  const script = parser.parse(content);

  console.log(`  标题: ${script.meta.title}`);
  console.log(`  时长: ${script.meta.duration}秒`);
  console.log(`  场景数: ${script.scenes.length}`);
  console.log(`  配图数: ${script.prompts.length}`);

  // 确定目标平台
  const platforms = targetPlatforms || script.meta.platforms;
  console.log(`  目标平台: ${platforms.join(', ')}`);

  // 创建输出目录
  const dateFolder = parser.extractDateFromPath(scriptPath);
  const outputDir = path.join(ASSETS_DIR, dateFolder, 'video');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 2. 检查配图是否存在
  console.log('\n🎨 检查配图...');
  const imageDir = path.join(ASSETS_DIR, dateFolder);
  const images = findImages(imageDir, script.scenes.length);

  if (images.length === 0) {
    console.log('  ⚠️ 未找到配图，请先运行 npm run gen 生成配图');
    console.log(`  提示: npm run gen ${scriptPath}`);
    process.exit(1);
  }
  console.log(`  找到 ${images.length} 张配图`);

  // 3. 生成配音
  console.log('\n🎤 生成配音...');
  const tts = createTTSProvider(script.ttsConfig);
  const voiceText = parser.getFullVoiceText(script.scenes);
  const audioPath = path.join(outputDir, 'audio.mp3');

  console.log(`  文案字数: ${voiceText.length}`);
  await tts.synthesize(voiceText, audioPath);
  console.log('  ✓ 配音生成完成');

  // 4. 获取音频时长
  const audioDuration = await VideoComposer.getAudioDuration(audioPath);
  console.log(`  音频时长: ${audioDuration.toFixed(1)}秒`);

  // 5. 生成字幕
  console.log('\n📝 生成字幕...');
  const subtitleGen = new SubtitleGenerator();
  const srt = subtitleGen.generateSRT(voiceText, audioDuration);
  const subtitlePath = path.join(outputDir, 'subtitle.srt');
  fs.writeFileSync(subtitlePath, srt, 'utf-8');
  console.log('  ✓ 字幕生成完成');

  // 6. 合成视频
  console.log('\n🎥 合成视频...');
  const composer = new VideoComposer();

  for (const platform of platforms) {
    const platformName = platform.toLowerCase().replace('b站', 'bilibili');
    const outputPath = path.join(outputDir, `${platformName}.mp4`);

    await composer.compose({
      images: images,
      audioPath: audioPath,
      subtitlePath: subtitlePath,
      outputPath: outputPath,
      platform: platform,
      audioDuration: audioDuration,
    });
  }

  // 7. 完成
  console.log('\n✨ 视频生成完成！');
  console.log(`\n输出目录: ${outputDir}`);
  console.log('生成的文件:');
  console.log(`  - audio.mp3 (配音)`);
  console.log(`  - subtitle.srt (字幕)`);
  for (const platform of platforms) {
    const platformName = platform.toLowerCase().replace('b站', 'bilibili');
    console.log(`  - ${platformName}.mp4 (视频)`);
  }
}

/**
 * 查找配图文件
 */
function findImages(imageDir, sceneCount) {
  if (!fs.existsSync(imageDir)) {
    return [];
  }

  const files = fs.readdirSync(imageDir);
  const images = files
    .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
    .map((f) => path.join(imageDir, f))
    .sort();

  // 如果找到的图片数量与场景数匹配，直接返回
  if (images.length >= sceneCount) {
    return images.slice(0, sceneCount);
  }

  return images;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`使用方法:
  npm run video <脚本路径>           生成指定脚本的视频
  npm run video <脚本路径> --douyin  只生成抖音版本（竖屏 9:16）
  npm run video <脚本路径> --bilibili 只生成B站版本（横屏 16:9）
  npm run video -- --voices          列出所有可用的TTS语音
  npm run video -- --help            显示此帮助信息

示例:
  npm run video content/scripts/2026-01-01-video-ai入门.md
  npm run video content/scripts/2026-01-01-video-ai入门.md --douyin

工作流程:
  1. 解析脚本中的分镜和配音文案
  2. 检查配图是否已生成（如未生成，请先运行 npm run gen）
  3. 使用 Edge TTS 生成配音音频
  4. 根据音频时长生成字幕
  5. 使用 FFmpeg 合成最终视频

输出目录:
  content/assets/<日期>/video/
  ├── audio.mp3      配音文件
  ├── subtitle.srt   字幕文件
  ├── douyin.mp4     抖音版本（1080x1920）
  └── bilibili.mp4   B站版本（1920x1080）
`);
}

// 运行主函数
main().catch(console.error);
