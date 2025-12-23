/**
 * AI图片生成脚本
 * 读取文章中的提示词，调用Gemini API生成图片
 *
 * 使用方法：
 *   npm run gen content/articles/xxx.md  # 生成指定文章的图片
 *   npm run gen:all                       # 生成所有文章的图片
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// 检查API Key
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ 错误：请在 .env 文件中配置 GEMINI_API_KEY');
  console.error('   参考 .env.example 文件');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 项目根目录
const ROOT_DIR = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'content', 'assets');

/**
 * 从Markdown文件中提取图片提示词
 * @param {string} content - Markdown内容
 * @returns {Array} 提示词数组
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
    // 提取图片名称（第一行）
    const nameMatch = block.match(/^(.+?)[\n\r]/);
    const name = nameMatch ? nameMatch[1].trim() : '未命名';

    // 提取英文提示词
    const promptMatch = block.match(/\*\*英文提示词\*\*[：:]\s*(.+?)(?:\n|$)/);
    if (promptMatch) {
      let prompt = promptMatch[1].trim();

      // 提取尺寸参数
      const arMatch = prompt.match(/--ar\s+([\d:.]+)/);
      const aspectRatio = arMatch ? arMatch[1] : '1:1';

      // 移除Midjourney特有参数（Gemini不支持）
      prompt = prompt.replace(/--ar\s+[\d:.]+/g, '')
                     .replace(/--style\s+\w+/g, '')
                     .replace(/--v\s+[\d.]+/g, '')
                     .trim();

      prompts.push({
        name: name,
        prompt: prompt,
        aspectRatio: aspectRatio,
        originalBlock: block
      });
    }
  }

  return prompts;
}

/**
 * 调用Gemini API生成图片
 * @param {string} prompt - 图片提示词
 * @returns {Buffer} 图片数据
 */
async function generateImage(prompt) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-preview-image-generation'
  });

  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: `Generate an image: ${prompt}` }]
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    });

    const response = await result.response;

    // 查找图片部分
    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData) {
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }
    }

    throw new Error('API返回中没有找到图片数据');
  } catch (error) {
    throw new Error(`图片生成失败: ${error.message}`);
  }
}

/**
 * 保存图片到文件
 * @param {Buffer} imageData - 图片数据
 * @param {string} filename - 文件名
 * @param {string} dateFolder - 日期文件夹
 * @returns {string} 保存的文件路径
 */
function saveImage(imageData, filename, dateFolder) {
  const folderPath = path.join(ASSETS_DIR, dateFolder);

  // 创建目录
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  // 清理文件名
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
 * @param {string} articlePath - 文章路径
 */
async function processArticle(articlePath) {
  console.log(`\n📄 处理文章: ${path.basename(articlePath)}`);

  // 读取文章内容
  const content = fs.readFileSync(articlePath, 'utf-8');

  // 提取提示词
  const prompts = extractPrompts(content);

  if (prompts.length === 0) {
    console.log('   ⚠️  未找到配图提示词，跳过');
    return;
  }

  console.log(`   找到 ${prompts.length} 个配图提示词`);

  // 从文件名提取日期
  const dateMatch = path.basename(articlePath).match(/^(\d{4}-\d{2}-\d{2})/);
  const dateFolder = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

  // 逐个生成图片
  for (let i = 0; i < prompts.length; i++) {
    const { name, prompt } = prompts[i];
    console.log(`\n   🎨 [${i + 1}/${prompts.length}] 生成: ${name}`);
    console.log(`      提示词: ${prompt.substring(0, 60)}...`);

    try {
      const imageData = await generateImage(prompt);
      const savedPath = saveImage(imageData, `${i + 1}-${name}`, dateFolder);
      console.log(`      ✅ 保存到: ${path.relative(ROOT_DIR, savedPath)}`);
    } catch (error) {
      console.error(`      ❌ 失败: ${error.message}`);
    }

    // 避免API限流，间隔2秒
    if (i < prompts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * 查找所有包含提示词的文章
 * @returns {Array} 文章路径数组
 */
function findAllArticles() {
  const articlesDir = path.join(ROOT_DIR, 'content', 'articles');
  const scriptsDir = path.join(ROOT_DIR, 'content', 'scripts');

  const articles = [];

  // 扫描articles目录
  if (fs.existsSync(articlesDir)) {
    const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));
    articles.push(...files.map(f => path.join(articlesDir, f)));
  }

  // 扫描scripts目录
  if (fs.existsSync(scriptsDir)) {
    const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.md'));
    articles.push(...files.map(f => path.join(scriptsDir, f)));
  }

  // 过滤出包含提示词的文件
  return articles.filter(articlePath => {
    const content = fs.readFileSync(articlePath, 'utf-8');
    return content.includes('## 配图提示词');
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 AI图片生成工具');
  console.log('==================\n');

  const args = process.argv.slice(2);

  if (args.includes('--all')) {
    // 批量生成所有文章的图片
    console.log('📂 扫描所有文章...');
    const articles = findAllArticles();

    if (articles.length === 0) {
      console.log('未找到包含配图提示词的文章');
      return;
    }

    console.log(`找到 ${articles.length} 篇文章需要处理`);

    for (const article of articles) {
      await processArticle(article);
    }
  } else if (args.length > 0) {
    // 处理指定文章
    const articlePath = path.resolve(args[0]);

    if (!fs.existsSync(articlePath)) {
      console.error(`❌ 文件不存在: ${articlePath}`);
      process.exit(1);
    }

    await processArticle(articlePath);
  } else {
    // 显示帮助
    console.log('使用方法:');
    console.log('  npm run gen <文章路径>   生成指定文章的图片');
    console.log('  npm run gen:all          生成所有文章的图片');
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
