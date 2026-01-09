#!/usr/bin/env node
/**
 * 全自动内容生成统一入口
 *
 * 用法:
 *   node scripts/create-content.js --date 2026-01-02 --images-only
 *   node scripts/create-content.js --date 2026-01-02 --extract
 *
 * 功能:
 *   --images-only  从已有文章提取提示词并生成图片
 *   --extract      仅提取提示词，不生成图片（用于检查）
 *
 * 注意:
 *   文章生成由 Claude Code 直接完成（通过对话交互）
 *   此脚本主要用于图片生成的自动化
 */

const fs = require('fs');
const path = require('path');
const GeminiBrowser = require('./gemini-browser');

// 配置
const ARTICLES_DIR = path.join(__dirname, '../content/articles');
const ASSETS_DIR = path.join(__dirname, '../content/assets');

// 平台配置
const PLATFORMS = {
  xiaohongshu: { name: '小红书', prefix: '小红书' },
  wechat: { name: '公众号', prefix: '公众号' },
  juejin: { name: '掘金', prefix: '掘金' },
};

/**
 * 从文章中提取配图提示词
 */
function extractImagePrompts(articlePath) {
  const content = fs.readFileSync(articlePath, 'utf-8');
  const prompts = [];

  // 匹配 ## 配图提示词 部分
  const promptSection = content.match(/## 配图提示词[\s\S]*$/);
  if (!promptSection) {
    console.log(`  警告: ${path.basename(articlePath)} 没有配图提示词部分`);
    return prompts;
  }

  const section = promptSection[0];

  // 匹配每个图片的提示词
  // 格式: ### 图N：描述
  //       **中文描述**：...
  //       **英文提示词**：...
  const imageBlocks = section.split(/### 图\d+[：:]/);

  for (let i = 1; i < imageBlocks.length; i++) {
    const block = imageBlocks[i];

    // 提取标题（图片名称）
    const titleMatch = block.match(/^([^\n]+)/);
    const title = titleMatch ? titleMatch[1].trim() : `图${i}`;

    // 提取中文描述
    const chineseMatch = block.match(/\*\*中文描述\*\*[：:]\s*([^\n]+)/);
    const chinese = chineseMatch ? chineseMatch[1].trim() : '';

    // 提取英文提示词
    const englishMatch = block.match(/\*\*英文提示词\*\*[：:]\s*([^\n]+)/);
    const english = englishMatch ? englishMatch[1].trim() : '';

    if (chinese || english) {
      prompts.push({
        index: i,
        title,
        chinese,
        english,
        // 优先使用中文提示词（Gemini 支持中文）
        prompt: chinese || english,
      });
    }
  }

  return prompts;
}

/**
 * 从文章文件名解析平台信息
 */
function parsePlatformFromFilename(filename) {
  for (const [key, config] of Object.entries(PLATFORMS)) {
    if (filename.includes(key) || filename.includes(config.name)) {
      return { key, ...config };
    }
  }
  return null;
}

/**
 * 获取指定日期的所有文章
 */
function getArticlesForDate(date) {
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.log('文章目录不存在:', ARTICLES_DIR);
    return [];
  }

  const files = fs.readdirSync(ARTICLES_DIR);
  const articles = [];

  for (const file of files) {
    if (file.startsWith(date) && file.endsWith('.md')) {
      const platform = parsePlatformFromFilename(file);
      articles.push({
        filename: file,
        path: path.join(ARTICLES_DIR, file),
        platform,
        date,
      });
    }
  }

  return articles;
}

/**
 * 生成图片
 */
async function generateImages(date, prompts, platform) {
  const outputDir = path.join(ASSETS_DIR, date);

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\n📸 开始为 ${platform.name} 生成 ${prompts.length} 张图片...\n`);

  const browser = new GeminiBrowser({ headless: false });
  await browser.init();

  // 检查登录状态
  const loggedIn = await browser.isLoggedIn();
  if (!loggedIn) {
    console.log('⚠️  需要登录，请在浏览器中完成登录...');
    await browser.login();
  }

  const results = [];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    const outputFilename = `${platform.prefix}-${prompt.index}-${prompt.title}.png`;
    const outputPath = path.join(outputDir, outputFilename);

    console.log(`[${i + 1}/${prompts.length}] ${prompt.title}`);
    console.log(`  提示词: ${prompt.prompt.substring(0, 50)}...`);

    try {
      await browser.generateImage(prompt.prompt, outputPath);
      console.log(`  ✅ 已保存: ${outputFilename}`);
      results.push({ success: true, file: outputFilename });
    } catch (error) {
      console.log(`  ❌ 失败: ${error.message}`);
      results.push({ success: false, error: error.message });
    }

    // 每张图片之间等待
    if (i < prompts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  await browser.close();
  return results;
}

/**
 * 主函数
 */
async function main() {
  // 解析参数（args 已在入口处定义）
  const dateIndex = args.indexOf('--date');
  const date = dateIndex !== -1 ? args[dateIndex + 1] : new Date().toISOString().split('T')[0];
  const extractOnly = args.includes('--extract');
  const imagesOnly = args.includes('--images-only') || args.includes('--images');

  console.log('='.repeat(50));
  console.log('📝 全自动内容生成系统');
  console.log('='.repeat(50));
  console.log(`日期: ${date}`);
  console.log(`模式: ${extractOnly ? '仅提取提示词' : imagesOnly ? '生成图片' : '完整流程'}`);
  console.log('');

  // 获取文章列表
  const articles = getArticlesForDate(date);

  if (articles.length === 0) {
    console.log(`⚠️  未找到 ${date} 的文章`);
    console.log(`请先创建文章到 content/articles/${date}-*.md`);
    console.log('\n或者让 Claude Code 帮你生成文章：');
    console.log(`  "帮我生成${date}的文章，主题是..."`);
    return;
  }

  console.log(`找到 ${articles.length} 篇文章:\n`);

  // 提取所有文章的提示词
  const allPrompts = [];

  for (const article of articles) {
    console.log(`📄 ${article.filename}`);
    const prompts = extractImagePrompts(article.path);
    console.log(`   提取到 ${prompts.length} 个配图提示词`);

    if (prompts.length > 0 && article.platform) {
      allPrompts.push({
        article,
        prompts,
      });
    }
  }

  console.log(`\n总计: ${allPrompts.reduce((sum, p) => sum + p.prompts.length, 0)} 张图片待生成\n`);

  // 如果只是提取，输出详情
  if (extractOnly) {
    console.log('--- 提取的提示词详情 ---\n');
    for (const { article, prompts } of allPrompts) {
      console.log(`【${article.platform?.name || '未知平台'}】`);
      for (const prompt of prompts) {
        console.log(`  ${prompt.index}. ${prompt.title}`);
        console.log(`     ${prompt.prompt}`);
      }
      console.log('');
    }
    return;
  }

  // 生成图片
  if (imagesOnly || !extractOnly) {
    for (const { article, prompts } of allPrompts) {
      if (article.platform) {
        await generateImages(date, prompts, article.platform);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ 全部完成！');
    console.log(`图片保存在: content/assets/${date}/`);
    console.log('='.repeat(50));
  }
}

// 帮助信息
function showHelp() {
  console.log(`
全自动内容生成系统

用法:
  node scripts/create-content.js [选项]

选项:
  --date <日期>     指定日期 (格式: YYYY-MM-DD，默认今天)
  --images-only     从已有文章生成图片
  --extract         仅提取提示词，不生成图片

示例:
  node scripts/create-content.js --date 2026-01-02 --images-only
  node scripts/create-content.js --extract

工作流程:
  1. Claude Code 生成文章 (通过对话)
  2. 运行此脚本提取提示词并生成图片
  3. 发布到各平台
  `);
}

// 入口
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  showHelp();
} else {
  main().catch(console.error);
}
