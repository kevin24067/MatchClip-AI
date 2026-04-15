import { FrameFeature } from '../types';

/**
 * Mock 数据生成服务（P1-01 / P4-05 拆分）
 *
 * 职责：为开发调试和音频解码失败时提供兜底的模拟帧序列。
 * 模拟了完整的比赛状态机（持球准备 → 回合 → 落地 → 空闲），
 * 包含视觉信号占位（shuttle_held / shuttle_ground）。
 *
 * 注意：此文件不包含任何真实分析逻辑，仅用于测试和演示。
 * 真实音频分析请使用 audioAnalysisService.ts。
 */

/**
 * 生成模拟帧序列（兜底 / 演示用）
 * @param durationSeconds 模拟视频时长（秒）
 */
export const generateMockSignalData = (durationSeconds: number): FrameFeature[] => {
  const fps = 10;
  const frames: FrameFeature[] = [];
  let currentTime = 0;

  let timeInState = 0;
  let nextStateTime = 3;

  // 0 = 持球准备, 1 = 回合中, 2 = 落地结束, 3 = 空闲
  let simState = 3;

  while (currentTime < durationSeconds) {
    let hit_audio = false;
    let shuttle_held = false;
    let shuttle_ground = false;
    let motion_score = 0.1;

    if (timeInState > nextStateTime) {
      timeInState = 0;
      simState = (simState + 1) % 4;

      if (simState === 0) nextStateTime = 2.0;
      if (simState === 1) nextStateTime = 5 + Math.random() * 10;
      if (simState === 2) nextStateTime = 1.5;
      if (simState === 3) nextStateTime = 4.0;
    }

    switch (simState) {
      case 0: // 持球准备
        shuttle_held = true;
        motion_score = 0.05;
        break;
      case 1: // 回合中
        hit_audio = Math.random() > 0.85;
        motion_score = 0.6 + Math.random() * 0.4;
        break;
      case 2: // 落地结束
        shuttle_ground = true;
        motion_score = 0.1;
        break;
      case 3: // 空闲
        motion_score = 0.2;
        break;
    }

    frames.push({
      t: parseFloat(currentTime.toFixed(2)),
      motion_score,
      hit_audio,
      hit_visual: hit_audio && Math.random() > 0.5,
      shuttle_held,
      shuttle_ground
    });

    currentTime += 1 / fps;
    timeInState += 1 / fps;
  }

  return frames;
};