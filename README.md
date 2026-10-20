# 🚇 中国城市地铁可视化

<div align="center">
  <img src="./preview.png" alt="地铁可视化预览" width="800">
</div>

<h2 align="center">
基于 Vue3 和 Deck.gl 的中国城市地铁可视化应用
</h2><br>

<pre align="center">
🚇 数据截止：2023年6月
</pre>

## 项目简介

这是一个展示中国**部分**城市地铁线路的可视化应用，使用现代 Web 技术栈构建，提供交互式的地铁网络浏览体验。

## 技术栈

### 核心技术

- **前端框架**: Vue 3 + Nuxt 3
- **可视化**: Deck.gl
- **状态管理**: Pinia
- **类型检查**: TypeScript
- **构建工具**: Vite


## 数据说明

- 📊 **数据来源**: 中国部分城市地铁官方数据
- 📅 **数据时间**: 截止至 2023年6月
- 🏙️ **覆盖城市**: 包含北京、上海、广州、深圳等主要城市

- 🔄 **更新数据**: `pnpm data:update` 从高德地铁图拉取最新线路和站点并写入 `datasource/data.json`（加 `--dry-run` 只打印变化）。设置 `AMAP_KEY`（[高德开放平台](https://console.amap.com/dev/key/app) Web 服务 Key）可同时获取线路真实走向，否则新线路和站点有变化的线路会以站点连线显示

## 许可证

MIT License
