# /daily - 生成每日内容

当用户输入 `/daily 日期 主题：xxx` 时，执行以下任务：

## 触发格式

```
/daily 2026-01-03 主题：Cursor使用技巧入门
```

或自然语言：
```
帮我生成2026年1月3日的内容，主题是"Cursor使用技巧入门"
```

## 执行步骤

### 步骤1：生成三平台文章

按顺序生成以下文章，保存到 `content/articles/` 目录：

| 平台 | 文件名格式 | 配图数量 | 图片比例 |
|-----|-----------|---------|---------|
| 小红书 | `日期-xiaohongshu-标题.md` | 6张 | 3:4 竖版 |
| 公众号 | `日期-wechat-标题.md` + `.html` | 4张 | 16:9 横版 |
| 掘金 | `日期-juejin-标题.md` | 3张 | 16:9 横版 |

每篇文章末尾必须包含 `## 配图提示词` 部分。

**公众号特殊要求**：同时生成 `.md` 和 `.html` 两个文件，HTML 使用青色主题。

### 步骤2：用 MCP Playwright 生成配图

1. 打开 Gemini (https://gemini.google.com)
2. 逐张输入提示词生成图片
3. 下载图片到 `.playwright-mcp/` 临时目录
4. 整理到 `content/assets/日期/` 目录
5. 按平台和序号重命名

### 步骤3：更新主题记录

在 `TOPICS.md` 的已发布主题表格中添加新记录。

### 步骤4：返回完成报告

```
✅ 日期 内容生成完成

文章：
- content/articles/日期-xiaohongshu-xxx.md
- content/articles/日期-wechat-xxx.md
- content/articles/日期-juejin-xxx.md

配图：
- content/assets/日期/ (13张)

请检查后发布。
```

## 关键质量要求

### ⚠️ 图片与文章内容必须匹配

- 如果文章讲的是**国产AI工具**（豆包、通义、Kimi等），图片中也必须体现国产工具
- 提示词要明确指定文章中提到的具体工具名称
- 避免生成通用的"AI"图片，要有针对性

### 配图提示词规范

1. **具体化**：明确提及文章中的具体工具/概念名称
2. **中文元素**：需要时包含中文文字
3. **风格统一**：扁平插画风格，蓝紫色渐变主题
4. **比例正确**：
   - 小红书：竖版 3:4
   - 公众号/掘金：横版 16:9

### 文章风格要求

参考 `CLAUDE.md` 中的风格规范：
- 语气轻松，像朋友聊天
- 适度幽默，有段子和调侃
- 接地气，用大白话
- 节奏明快，短句为主

## 平台特点

### 小红书
- 风格：轻松、实用、种草
- 标题：吸引眼球，可用emoji
- 字数：500-1000字

### 公众号
- 风格：深度、专业、有价值
- 标题：清晰、有信息量
- 字数：1500-2500字
- **主题色**：青色 `#06B6D4`
- **输出格式**：同时生成 `.md` 和 `.html` 文件

### 公众号 HTML 模板样式

```html
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 16px;
    line-height: 1.8;
    color: #333;
    max-width: 680px;
    margin: 0 auto;
    padding: 20px;
  }
  h1 { font-size: 22px; font-weight: bold; text-align: center; margin-bottom: 20px; }
  h2 { font-size: 18px; font-weight: bold; color: #1a1a1a; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #06B6D4; padding-left: 12px; }
  h3 { font-size: 16px; font-weight: bold; color: #333; margin-top: 20px; margin-bottom: 10px; }
  p { margin: 15px 0; text-align: justify; }
  blockquote { background: #f0fdfa; border-left: 4px solid #06B6D4; padding: 10px 15px; margin: 15px 0; color: #666; font-size: 14px; }
  strong { color: #06B6D4; }
  ul, ol { padding-left: 20px; margin: 15px 0; }
  li { margin: 8px 0; }
  hr { border: none; border-top: 1px solid #eee; margin: 25px 0; }
</style>
```

### 掘金
- 风格：技术向、有代码、有干货
- 标题：直接、技术关键词
- 字数：1500-3000字
