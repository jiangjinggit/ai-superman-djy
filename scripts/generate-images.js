/**
 * AI图片生成脚本
 * 支持多服务切换：硅基流动（免费）、Gemini（付费）、智谱清言（免费）
 *
 * 使用方法：
 *   npm run gen <文章路径>     # 生成指定文章的图片
 *   npm run gen:all           # 生成所有文章的图片
 *   npm run gen -- --list     # 列出可用服务
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getProvider, listProviders } = require('./providers');

// 项目根目录
const ROOT_DIR = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'content', 'assets');

// 默认服务（可在.env中配置 IMAGE_PROVIDER）
const DEFAULT_PROVIDER = 'siliconflow';

/**
 * 从Markdown文件中提取图片提示词
 */
function extractPrompts(content) {
  const prompts = [];

  // 匹配 ## 配图提示词 之后的内容
  const promptSection = content.match(/## 配图提示词[\s\S]*$/);
  if (!promptSection) {
    return prompts;
  }

  const section = promptSection[0];

  // 匹配每个图片块
  const imageBlocks = section.split(/### 图\d+：|### 封面图|### 片头|### 片尾|### 文中配图/).slice(1);

  for (const block of imageBlocks) {
    // 提取图片名称
    const nameMatch = block.match(/^(.+?)[\n\r]/);
    const name = nameMatch ? nameMatch[1].trim() : '未命名';

    // 提取英文提示词
    const promptMatch = block.match(/\*\*英文提示词\*\*[：:]\s*(.+?)(?:\n|$)/);
    if (promptMatch) {
      let prompt = promptMatch[1].trim();

      // 提取尺寸参数
      const arMatch = prompt.match(/--ar\s+([\d:.]+)/);
      const aspectRatio = arMatch ? arMatch[1] : '1:1';

      // 移除Midjourney特有参数
      prompt = prompt.replace(/--ar\s+[\d:.]+/g, '')
                     .replace(/--style\s+\w+/g, '')
                     .replace(/--v\s+[\d.]+/g, '')
                     .trim();

      prompts.push({
        name: name,
        prompt: prompt,
        aspectRatio: aspectRatio,
      });
    }
  }

  return prompts;
}

/**
 * 保存图片到文件
 */
function saveImage(imageData, filename, dateFolder) {
  const folderPath = path.join(ASSETS_DIR, dateFolder);

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const safeName = filename
    .replace(/[：:]/g, '-')
    .replace(/[^\w\u4e00-\u9fa5\-]/g, '')
    .substring(0, 50);

  const filePath = path.join(folderPath, `${safeName}.png`);
  fs.writeFileSync(filePath, imageData);

  return filePath;
}

/**
 * 处理单个文章
 */
async function processArticle(articlePath, provider) {
  console.log(`\n📄 处理文章: ${path.basename(articlePath)}`);

  const content = fs.readFileSync(articlePath, 'utf-8');
  const prompts = extractPrompts(content);

  if (prompts.length === 0) {
    console.log('   ⚠️  未找到配图提示词，跳过');
    return { success: 0, failed: 0 };
  }

  console.log(`   找到 ${prompts.length} 个配图提示词`);

  // 从文件名提取日期
  const dateMatch = path.basename(articlePath).match(/^(\d{4}-\d{2}-\d{2})/);
  const dateFolder = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

  let success = 0;
  let failed = 0;

  for (let i = 0; i < prompts.length; i++) {
    const { name, prompt, aspectRatio } = prompts[i];
    console.log(`\n   🎨 [${i + 1}/${prompts.length}] 生成: ${name}`);
    console.log(`      提示词: ${prompt.substring(0, 50)}...`);

    try {
      const imageData = await provider.generateImage(prompt, { aspectRatio });
      const savedPath = saveImage(imageData, `${i + 1}-${name}`, dateFolder);
      console.log(`      ✅ 保存到: ${path.relative(ROOT_DIR, savedPath)}`);
      success++;
    } catch (error) {
      console.error(`      ❌ 失败: ${error.message}`);
      failed++;
    }

    // 避免API限流
    if (i < prompts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return { success, failed };
}

/**
 * 查找所有包含提示词的文章
 */
function findAllArticles() {
  const articlesDir = path.join(ROOT_DIR, 'content', 'articles');
  const scriptsDir = path.join(ROOT_DIR, 'content', 'scripts');

  const articles = [];

  if (fs.existsSync(articlesDir)) {
    const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));
    articles.push(...files.map(f => path.join(articlesDir, f)));
  }

  if (fs.existsSync(scriptsDir)) {
    const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.md'));
    articles.push(...files.map(f => path.join(scriptsDir, f)));
  }

  return articles.filter(articlePath => {
    const content = fs.readFileSync(articlePath, 'utf-8');
    return content.includes('## 配图提示词');
  });
}

/**
 * 显示可用服务列表
 */
function showProviders() {
  console.log('\n📋 可用的图片生成服务:\n');

  const providers = listProviders();
  providers.forEach((p, i) => {
    const freeTag = p.free ? '🆓 免费' : '💰 付费';
    const proxyTag = p.needProxy ? '🌐 需代理' : '🇨🇳 国内直连';
    console.log(`   ${i + 1}. ${p.displayName}`);
    console.log(`      ${freeTag} | ${proxyTag}`);
    console.log(`      ${p.description}\n`);
  });

  console.log('💡 切换服务方法：在 .env 中设置 IMAGE_PROVIDER=服务名');
  console.log('   例如：IMAGE_PROVIDER=siliconflow\n');
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  // 显示服务列表
  if (args.includes('--list') || args.includes('-l')) {
    showProviders();
    return;
  }

  console.log('🚀 AI图片生成工具');
  console.log('==================\n');

  // 获取服务
  const providerName = process.env.IMAGE_PROVIDER || DEFAULT_PROVIDER;
  let provider;

  try {
    provider = getProvider(providerName);
    const info = provider.getInfo();
    console.log(`📦 当前服务: ${info.name}`);
    console.log(`   模型: ${info.model}`);
    console.log(`   免费: ${info.free ? '是' : '否'}\n`);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    console.log('\n💡 提示：运行 npm run gen -- --list 查看可用服务');
    process.exit(1);
  }

  // 处理文章
  if (args.includes('--all')) {
    console.log('📂 扫描所有文章...');
    const articles = findAllArticles();

    if (articles.length === 0) {
      console.log('未找到包含配图提示词的文章');
      return;
    }

    console.log(`找到 ${articles.length} 篇文章需要处理`);

    let totalSuccess = 0;
    let totalFailed = 0;

    for (const article of articles) {
      const { success, failed } = await processArticle(article, provider);
      totalSuccess += success;
      totalFailed += failed;
    }

    console.log(`\n📊 统计: 成功 ${totalSuccess} 张, 失败 ${totalFailed} 张`);

  } else if (args.length > 0 && !args[0].startsWith('-')) {
    const articlePath = path.resolve(args[0]);

    if (!fs.existsSync(articlePath)) {
      console.error(`❌ 文件不存在: ${articlePath}`);
      process.exit(1);
    }

    const { success, failed } = await processArticle(articlePath, provider);
    console.log(`\n📊 统计: 成功 ${success} 张, 失败 ${failed} 张`);

  } else {
    console.log('使用方法:');
    console.log('  npm run gen <文章路径>   生成指定文章的图片');
    console.log('  npm run gen:all          生成所有文章的图片');
    console.log('  npm run gen -- --list    列出可用服务');
    console.log('');
    console.log('示例:');
    console.log('  npm run gen content/articles/2026-01-01-wechat-用AI重塑自己.md');
  }

  console.log('\n✨ 完成!');
}

main().catch(error => {
  console.error('❌ 发生错误:', error.message);
  process.exit(1);
});
