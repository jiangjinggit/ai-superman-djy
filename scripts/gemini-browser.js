/**
 * Gemini 浏览器自动化 - 持久化登录版
 *
 * 使用 Playwright 持久化浏览器上下文实现：
 * - 首次手动登录 Google 账号
 * - 之后自动复用登录状态
 * - 批量生成图片
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// 配置
const USER_DATA_DIR = path.join(__dirname, '../.browser-data');
const DOWNLOAD_DIR = path.join(__dirname, '../.browser-data/downloads');
const ASSETS_DIR = path.join(__dirname, '../content/assets');

class GeminiBrowser {
  constructor(options = {}) {
    this.context = null;
    this.page = null;
    this.headless = options.headless || false;
    this.verbose = options.verbose !== false;
  }

  log(message) {
    if (this.verbose) {
      console.log(`[Gemini] ${message}`);
    }
  }

  /**
   * 初始化浏览器（使用持久化上下文）
   */
  async init() {
    // 确保目录存在
    if (!fs.existsSync(USER_DATA_DIR)) {
      fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    this.log('启动浏览器...');

    // 使用持久化上下文 - 关键！这会保存登录状态
    this.context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: this.headless,
      channel: 'chrome',  // 使用系统 Chrome
      viewport: { width: 1400, height: 900 },
      acceptDownloads: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
    });

    // 设置下载路径
    this.page = await this.context.newPage();

    this.log('浏览器已启动');
    return this;
  }

  /**
   * 检查是否已登录
   */
  async isLoggedIn() {
    await this.page.goto('https://gemini.google.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.page.waitForTimeout(3000);

    // 检查是否有登录按钮或提示
    const loginButton = await this.page.$('text=登录');
    const signInButton = await this.page.$('text=Sign in');

    return !loginButton && !signInButton;
  }

  /**
   * 手动登录流程
   */
  async login() {
    this.log('打开 Gemini 页面...');
    await this.page.goto('https://gemini.google.com');

    console.log('\n========================================');
    console.log('请在浏览器中登录 Google 账号');
    console.log('登录完成后，按 Enter 继续...');
    console.log('========================================\n');

    // 等待用户按 Enter
    await new Promise(resolve => {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question('', () => {
        rl.close();
        resolve();
      });
    });

    // 验证登录状态
    const loggedIn = await this.isLoggedIn();
    if (loggedIn) {
      this.log('登录成功！状态已保存到: ' + USER_DATA_DIR);
    } else {
      this.log('警告：可能未成功登录，请重试');
    }

    return loggedIn;
  }

  /**
   * 生成单张图片
   * @param {string} prompt - 图片提示词
   * @param {string} outputPath - 输出路径
   */
  async generateImage(prompt, outputPath) {
    this.log(`生成图片: ${prompt.substring(0, 50)}...`);

    // 打开新对话 - 使用更宽松的等待策略
    await this.page.goto('https://gemini.google.com', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await this.page.waitForTimeout(3000);

    // 点击"发起新对话"（如果存在）
    const newChatBtn = await this.page.$('button:has-text("发起新对话")');
    if (newChatBtn) {
      await newChatBtn.click();
      await this.page.waitForTimeout(1500);
    }

    // 点击"制作图片"按钮
    const makeImageBtn = await this.page.$('button:has-text("制作图片")');
    if (makeImageBtn) {
      await makeImageBtn.click();
      await this.page.waitForTimeout(1000);
    }

    // 输入提示词
    const inputSelector = '[aria-label="在此处输入提示"], [placeholder*="提示"], textarea';
    await this.page.waitForSelector(inputSelector, { timeout: 15000 });
    await this.page.fill(inputSelector, prompt);
    await this.page.keyboard.press('Enter');

    this.log('等待图片生成...');

    // 等待图片生成（最长60秒）
    await this.page.waitForTimeout(3000);

    // 等待下载按钮出现
    try {
      await this.page.waitForSelector('button:has-text("下载"), [aria-label*="下载"]', {
        timeout: 60000
      });
    } catch (e) {
      this.log('警告：未找到下载按钮，可能生成失败');
      return null;
    }

    await this.page.waitForTimeout(2000);

    // 下载图片
    this.log('下载图片...');

    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 设置下载监听
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 30000 }),
      this.page.click('button:has-text("下载完整尺寸"), button:has-text("下载"), [aria-label*="下载"]'),
    ]);

    // 保存文件
    await download.saveAs(outputPath);
    this.log(`图片已保存: ${outputPath}`);

    return outputPath;
  }

  /**
   * 批量生成图片
   * @param {Array} images - 图片配置数组 [{prompt, output}]
   */
  async generateBatch(images) {
    const results = [];

    for (let i = 0; i < images.length; i++) {
      const { prompt, output } = images[i];
      this.log(`\n进度: ${i + 1}/${images.length}`);

      try {
        const result = await this.generateImage(prompt, output);
        results.push({ success: true, output: result });
      } catch (error) {
        this.log(`错误: ${error.message}`);
        results.push({ success: false, error: error.message });
      }

      // 每张图片之间间隔一下
      if (i < images.length - 1) {
        await this.page.waitForTimeout(2000);
      }
    }

    return results;
  }

  /**
   * 关闭浏览器
   */
  async close() {
    if (this.context) {
      await this.context.close();
      this.log('浏览器已关闭');
    }
  }
}

// CLI 模式
async function main() {
  const args = process.argv.slice(2);
  const browser = new GeminiBrowser({ headless: false });

  try {
    await browser.init();

    if (args.includes('--login')) {
      // 登录模式
      await browser.login();
    } else if (args.includes('--check')) {
      // 检查登录状态
      const loggedIn = await browser.isLoggedIn();
      console.log(loggedIn ? '已登录' : '未登录');
    } else if (args.includes('--test')) {
      // 测试生成一张图片
      const testPrompt = '一只可爱的猫咪，扁平插画风格，蓝紫色渐变';
      const testOutput = path.join(ASSETS_DIR, 'test-image.png');
      await browser.generateImage(testPrompt, testOutput);
    } else {
      console.log(`
Gemini 浏览器自动化工具

用法:
  node gemini-browser.js --login    首次登录（保存登录状态）
  node gemini-browser.js --check    检查登录状态
  node gemini-browser.js --test     测试生成一张图片

说明:
  首次使用需要运行 --login 手动登录 Google 账号
  登录状态保存在 .browser-data/ 目录
  之后可以直接生成图片，无需再次登录
      `);
    }
  } finally {
    await browser.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = GeminiBrowser;
