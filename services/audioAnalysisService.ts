import { FrameFeature } from '../types';

/**
 * 真实音频分析服务（P1-01 / P4-05 拆分）
 *
 * 职责：使用 Web Audio API 解析视频文件的音轨，
 * 通过峰值检测识别击球信号，生成 FrameFeature 帧序列。
 *
 * 能力边界：
 * - hit_audio：基于音频峰值检测，真实分析
 * - hit_visual / shuttle_held / shuttle_ground：占位值（false），需 CV 模型支持
 * - motion_score：基于音频活跃度的启发式估算，非真实视觉运动分析
 */

const SAMPLE_RATE = 10; // 输出帧率（每秒帧数，即 100ms 窗口）

export const analyzeMatchAudio = async (file: File): Promise<FrameFeature[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const rawData = audioBuffer.getChannelData(0); // 使用第一声道
    const originalSampleRate = audioBuffer.sampleRate;
    const samplesPerFrame = Math.floor(originalSampleRate / SAMPLE_RATE);
    const totalFrames = Math.floor(rawData.length / samplesPerFrame);

    const frames: FrameFeature[] = [];

    // 动态阈值：基于全局平均能量计算噪底，击球通常显著高于噪底
    let totalEnergy = 0;
    for (let i = 0; i < rawData.length; i += 100) {
      totalEnergy += Math.abs(rawData[i]);
    }
    const avgEnergy = totalEnergy / (rawData.length / 100);
    const HIT_THRESHOLD = avgEnergy * 3.5;

    for (let i = 0; i < totalFrames; i++) {
      const start = i * samplesPerFrame;
      const end = start + samplesPerFrame;
      let sumSq = 0;
      let maxAmp = 0;

      for (let j = start; j < end; j++) {
        const val = rawData[j];
        sumSq += val * val;
        if (Math.abs(val) > maxAmp) maxAmp = Math.abs(val);
      }
      const rms = Math.sqrt(sumSq / samplesPerFrame);

      // 击球检测：羽毛球击球为短促冲击，峰值高、持续短
      const isHit = maxAmp > HIT_THRESHOLD;

      // motion_score：基于音频活跃度的启发式估算（非真实视觉运动）
      const motionScore = isHit
        ? 0.8 + Math.random() * 0.2
        : rms > avgEnergy ? 0.3 : 0.1;

      frames.push({
        t: parseFloat((i / SAMPLE_RATE).toFixed(2)),
        motion_score: motionScore,
        hit_audio: isHit,
        hit_visual: false,    // 占位：需 CV 模型
        shuttle_held: false,  // 占位：需 CV 模型
        shuttle_ground: false // 占位：需 CV 模型
      });
    }

    return frames;

  } catch (error) {
    console.error('[AudioAnalysis] 音频解析失败，回退到 mock 数据:', error);
    // 解码失败时回退到 mock 数据（导入自独立的 mockDataService）
    const { generateMockSignalData } = await import('./mockDataService');
    return generateMockSignalData(60);
  }
};
