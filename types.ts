export enum RallyState {
  IDLE = 'IDLE',
  SERVE_PREP = 'SERVE_PREP', // New state: Visually detected player holding ball
  RALLY = 'RALLY',
  END_PENDING = 'END_PENDING'
}

export interface FrameFeature {
  t: number;          // Timestamp in seconds
  motion_score: number; // 0.0 to 1.0
  hit_audio: boolean;   // Detected hit sound
  hit_visual: boolean;  // Detected visual hit action
  // New Visual Signals
  shuttle_held: boolean;   // Player holding shuttlecock (Service stance)
  shuttle_ground: boolean; // Shuttlecock detected on floor (Dead ball)
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
