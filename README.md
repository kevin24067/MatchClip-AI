<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# MatchClip AI — 羽毛球智能剪辑

基于 Web Audio API 的羽毛球比赛视频智能剪辑工具。

## 核心能力

- **音频击球检测**：通过 Web Audio API 解析视频音轨，识别击球峰值信号
- **有限状态机回合识别**：基于音频信号序列，自动划定每个回合的起止时间
- **发球序列计分推导**：根据回合间发球方变化，推导每分的胜负（21 分制）
- **人工修正**：支持手动调整发球方、胜方、拆分/合并/删除回合
- **FFmpeg 脚本导出**：生成带比分字幕的视频剪辑脚本
- **JSON 项目存档**：支持导出/导入回合数据，方便二次编辑

## 能力边界说明

> 当前版本为**音频分析 MVP**，视觉信号（持球检测、落地检测）为占位实现，不参与真实分析。
> 比分推导基于发球序列，非视觉 AI 识别。

## 本地运行

**前置条件**：Node.js

```bash
npm install
npm run dev
```

> 无需任何 API Key，所有分析在浏览器本地完成。