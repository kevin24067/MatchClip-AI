export enum RallyState {
  IDLE = 'IDLE',
  SERVE_PREP = 'SERVE_PREP', // New state: Visually detected player holding ball
  RALLY = 'RALLY',
  END_PENDING = 'END_PENDING'
}

/**
 * 每帧的特征信号。
 *
 * 数据来源分级：
 * - 【真实】：基于 Web Audio API 音频分析，结果可信
 * - 【占位】：当前版本为固定值或启发式估算，不参与真实分析，仅用于演示/调试
 *
 * 注意：UI 展示层（SignalChart）应区分真实信号与占位信号，避免误导用户。
 */
export interface FrameFeature {
  /** 时间戳（秒）【真实】 */
  t: number;
  /** 运动强度评分 0.0~1.0。音频分析时为基于音频活跃度的启发式估算【启发式】 */
  motion_score: number;
  /** 音频击球检测：基于峰值检测【真实】 */
  hit_audio: boolean;
  /** 视觉击球检测：需 CV 模型支持，当前版本为占位值 false【占位】 */
  hit_visual: boolean;
  /** 持球检测（发球准备姿态）：需 CV 模型支持，当前版本为占位值 false【占位】 */
  shuttle_held: boolean;
  /** 落地检测（死球信号）：需 CV 模型支持，当前版本为占位值 false【占位】 */
  shuttle_ground: boolean;
}

export interface RallyClip {
  id: number;
  start: number;
  end: number;
  hits: number;
  // serverSide is the current best-known serving side for this rally.
  // Auto-detected rallies default to a deterministic guess and can be corrected manually.
  serverSide: 'A' | 'B'; // A = Near Side, B = Far Side
  // Optional explicit override from manual correction or imported data.
  // Leave undefined for auto-detected rallies so score can be inferred from server flow.
  winner?: 'A' | 'B';
}

export interface ScoreState {
  scoreA: number; // Near Side Score
  scoreB: number; // Far Side Score
  server: 'A' | 'B'; // A=Near, B=Far
  serviceSide: 'Right' | 'Left'; // Player's perspective (Even=Right, Odd=Left)
  visualServiceCourt: string; // e.g., "Near (Right)", "Far (Left)"
  isGamePoint: boolean;
  isInterval: boolean; // 11 point break
}

export interface RallyClipWithState extends RallyClip {
  scoreStateBefore: ScoreState;
  scoreStateAfter: ScoreState;
}

export interface MatchStats {
  totalDuration: number;
  validDuration: number;
  rallyCount: number;
  averageRallyLen: number;
  scoreA: number;
  scoreB: number;
  // Hit Stats
  totalHits: number;
  avgHitsPerRally: number;
  maxHits: number;
}
