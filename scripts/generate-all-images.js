/**
 * 批量生成图片脚本
 *
 * 使用持久化登录的浏览器自动生成所有文章配图
 * 用法: node generate-all-images.js [--date 2026-01-01]
 */

const GeminiBrowser = require('./gemini-browser');
const path = require('path');
const fs = require('fs');

// 获取日期参数
function getDate() {
  const args = process.argv.slice(2);
  const dateIndex = args.indexOf('--date');
  if (dateIndex !== -1 && args[dateIndex + 1]) {
    return args[dateIndex + 1];
  }
  // 默认使用今天的日期
  return new Date().toISOString().split('T')[0];
}

// 图片配置
function getImageConfig(date) {
  const assetsDir = path.join(__dirname, '../content/assets', date);

  return {
    小红书: [
      {
        name: '封面图',
        prompt: '一个人举着写有"2026 AI挑战"的旗帜，表情既兴奋又有点心虚，扁平插画风格，蓝紫色渐变背景，极简可爱卡通风格，竖版3:4比例',
        output: path.join(assetsDir, '小红书-1-封面图.png'),
      },
      {
        name: '为什么学AI',
        prompt: '三个并列的信息卡片，分别展示学AI的三个理由："门槛低"、"效率高10倍"、"趁早学"，扁平设计风格，蓝紫色主题，简洁布局，信息图风格，竖版3:4比例',
        output: path.join(assetsDir, '小红书-2-为什么学AI.png'),
      },
      {
        name: '尴尬的过去',
        prompt: '一个手机屏幕上有很多AI应用图标，但都落满灰尘和蜘蛛网，表示被遗忘的APP，扁平插画风格，幽默风格，蓝灰色调，竖版3:4比例',
        output: path.join(assetsDir, '小红书-3-尴尬的过去.png'),
      },
      {
        name: '365天计划',
        prompt: '一个日历上画满了打卡标记，旁边一个充满干劲的人竖起大拇指，365天挑战概念，扁平插画风格，蓝紫色渐变，充满活力，竖版3:4比例',
        output: path.join(assetsDir, '小红书-4-365天计划.png'),
      },
      {
        name: '分享内容',
        prompt: '三个图标分别代表"技巧"、"踩坑"、"真实效果"，社交媒体内容预告，扁平设计，蓝紫色主题，清晰的信息图风格，竖版3:4比例',
        output: path.join(assetsDir, '小红书-5-分享内容.png'),
      },
      {
        name: '关注引导',
        prompt: '两个人互相加油打气，一起学习的场景，扁平插画风格，蓝紫色渐变，正能量，一起关注一起成长，竖版3:4比例',
        output: path.join(assetsDir, '小红书-6-关注引导.png'),
      },
    ],
    公众号: [
      {
        name: '封面头图',
        prompt: '一个人站在巨大的AI字母前，充满期待地望向未来，科技感十足，扁平插画风格，蓝紫色渐变背景，极简风格，横版2.35:1比例',
        output: path.join(assetsDir, '公众号-1-封面头图.png'),
      },
      {
        name: '焦虑配图',
        prompt: '一个人被各种AI应用图标包围，表情迷茫焦虑，扁平插画风格，蓝灰色调，横版16:9比例',
        output: path.join(assetsDir, '公众号-2-焦虑配图.png'),
      },
      {
        name: '计划配图',
        prompt: '一个人在日历上标记365天的打卡计划，充满干劲，扁平插画风格，蓝紫色渐变，横版16:9比例',
        output: path.join(assetsDir, '公众号-3-计划配图.png'),
      },
      {
        name: '结尾配图',
        prompt: '多个人一起学习AI的场景，互相帮助讨论，扁平插画风格，蓝紫色渐变，温馨正能量，横版16:9比例',
        output: path.join(assetsDir, '公众号-4-结尾配图.png'),
      },
    ],
    掘金: [
      {
        name: '封面图',
        prompt: '程序员面对电脑屏幕显示AI助手界面，科技感十足，扁平插画风格，蓝紫色渐变，专业氛围，横版16:9比例',
        output: path.join(assetsDir, '掘金-1-封面图.png'),
      },
      {
        name: '效率对比',
        prompt: '两个人赛跑，一个人骑着写有"AI"的火箭飞速前进，另一个人在后面跑步追赶，效率对比概念，扁平插画风格，蓝紫色渐变，横版16:9比例',
        output: path.join(assetsDir, '掘金-2-效率对比.png'),
      },
      {
        name: '工具清单',
        prompt: '各种AI工具的图标整齐排列像工具箱，包括ChatGPT、Claude、Cursor等，扁平插画风格，蓝紫色渐变，横版16:9比例',
        output: path.join(assetsDir, '掘金-3-工具清单.png'),
      },
    ],
  };
}

// 主函数
async function main() {
  const date = getDate();
  const config = getImageConfig(date);

  console.log(`\n🎨 开始生成 ${date} 的配图\n`);

  // 收集所有图片
  const allImages = [];
  for (const [platform, images] of Object.entries(config)) {
    for (const img of images) {
      allImages.push({
        platform,
        name: img.name,
        prompt: img.prompt,
        output: img.output,
      });
    }
  }

  console.log(`总共需要生成 ${allImages.length} 张图片：`);
  for (const [platform, images] of Object.entries(config)) {
    console.log(`  - ${platform}: ${images.length} 张`);
  }
  console.log('');

  // 初始化浏览器
  const browser = new GeminiBrowser({ headless: false });

  try {
    await browser.init();

    // 检查登录状态
    const loggedIn = await browser.isLoggedIn();
    if (!loggedIn) {
      console.log('⚠️  未登录，请先登录 Google 账号\n');
      await browser.login();
    } else {
      console.log('✅ 已登录，开始生成图片...\n');
    }

    // 批量生成
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < allImages.length; i++) {
      const img = allImages[i];
      console.log(`\n[${i + 1}/${allImages.length}] ${img.platform} - ${img.name}`);

      try {
        await browser.generateImage(img.prompt, img.output);
        successCount++;
        console.log(`✅ 成功: ${img.output}`);
      } catch (error) {
        failCount++;
        console.log(`❌ 失败: ${error.message}`);
      }

      // 每张图片之间等待一下
      if (i < allImages.length - 1) {
        console.log('等待 3 秒...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // 输出统计
    console.log('\n========================================');
    console.log(`生成完成！`);
    console.log(`  成功: ${successCount} 张`);
    console.log(`  失败: ${failCount} 张`);
    console.log(`  输出目录: content/assets/${date}/`);
    console.log('========================================\n');

  } finally {
    await browser.close();
  }
}

// 运行
main().catch(error => {
  console.error('错误:', error);
  process.exit(1);
});
