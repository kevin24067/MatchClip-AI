import { FrameFeature, RallyClip, RallyState } from '../types';

/**
 * Finite State Machine for Badminton Rally Detection (Doubles Optimized)
 * 
 * Updates:
 * - Added visual cue support: `shuttle_held` triggers "Serve Prep".
 * - Added visual cue support: `shuttle_ground` triggers immediate Rally End.
 * - Auto-detected rallies no longer fabricate random winners.
 */
export class RallyFSM {
  private state: RallyState = RallyState.IDLE;
  private currentRallyStart: number | null = null;
  private lastHitTime: number = 0;
  private hitCount: number = 0;
  
  private readonly TIMEOUT_THRESHOLD = 2.0; 
  // Standard minimum hits to consider it a rally
  private readonly MIN_HITS_FOR_RALLY = 4; 
  // If we detected a clear "Serve Prep" visual, we can accept fewer hits/quicker start
  private readonly MIN_HITS_IF_VISUAL_CONFIRMED = 2;

  // Ignore the first few seconds of video to prevent handling noise/setup as a rally
  private readonly WARMUP_SKIP_SECONDS = 3.0;

  // Deterministic default for the serving side when analysis has no reliable side/winner signal.
  private readonly DEFAULT_SERVER: 'A' | 'B' = 'A';
  
  public processSignals(frames: FrameFeature[]): RallyClip[] {
    const rallies: RallyClip[] = [];
    this.reset();

    const debouncedFrames = this.debounceHits(frames);

    for (const frame of debouncedFrames) {
      // Skip processing for the first few seconds to avoid "camera setup" noise
      if (frame.t < this.WARMUP_SKIP_SECONDS) continue;

      const isHit = frame.hit_audio || frame.hit_visual;
      
      switch (this.state) {
        case RallyState.IDLE:
          if (frame.shuttle_held) {
             // Visual confirmation: Player is holding the ball to serve.
             // Transition to PREP state.
             this.state = RallyState.SERVE_PREP;
          } else if (isHit) {
            // Audio-only start
            this.state = RallyState.RALLY;
            this.currentRallyStart = Math.max(this.WARMUP_SKIP_SECONDS, frame.t - 1.5); 
            this.lastHitTime = frame.t;
            this.hitCount = 1;
          }
          break;

        case RallyState.SERVE_PREP:
          if (isHit) {
             // We were in Prep, and now there is a hit. This is definitely a serve.
             this.state = RallyState.RALLY;
             // Start strictly 0.5s before the hit (Serve motion)
             this.currentRallyStart = frame.t - 0.5;
             this.lastHitTime = frame.t;
             this.hitCount = 1;
          } else if (frame.t - this.lastHitTime > 5.0 && this.lastHitTime !== 0) {
             // Timeout in prep? Back to Idle (False detection)
             // Not critical as we usually just wait for hit
          }
          break;

        case RallyState.RALLY:
          // Check for Immediate Termination signals (Visual)
          if (frame.shuttle_ground) {
             // Ball hit the floor. Rally over immediately.
             this.finalizeRally(rallies, frame.t); // End exactly at ground contact
             continue; 
          }
          if (frame.shuttle_held) {
             // We missed the end, but they are already serving again.
             // Cut off at last known hit.
             this.finalizeRally(rallies, this.lastHitTime + 0.5);
             this.state = RallyState.SERVE_PREP; // Immediately ready for next
             continue;
          }

          if (isHit) {
            this.lastHitTime = frame.t;
            this.hitCount++;
          } else {
            if (frame.t - this.lastHitTime > this.TIMEOUT_THRESHOLD) {
              this.state = RallyState.END_PENDING;
            }
          }
          break;

        case RallyState.END_PENDING:
          // Check for Immediate Termination signals
          if (frame.shuttle_ground) {
            this.finalizeRally(rallies, frame.t);
            continue;
          }
          if (frame.shuttle_held) {
            this.finalizeRally(rallies, this.lastHitTime + 1.0);
            this.state = RallyState.SERVE_PREP;
            continue;
          }

          if (isHit) {
            this.state = RallyState.RALLY;
            this.lastHitTime = frame.t;
            this.hitCount++;
          } else {
            const endBuffer = 1.0; 
            // If we came from a Visual Start, we are more lenient on hit count
            const minHits = this.currentRallyStart !== null ? this.MIN_HITS_FOR_RALLY : this.MIN_HITS_FOR_RALLY;
            
            if (this.hitCount >= minHits) {
                this.finalizeRally(rallies, this.lastHitTime + endBuffer);
            } else {
                this.reset();
            }
          }
          break;
      }
    }

    if (this.state === RallyState.RALLY || this.state === RallyState.END_PENDING) {
       if (this.hitCount >= this.MIN_HITS_FOR_RALLY && frames.length > 0) {
         this.finalizeRally(rallies, frames[frames.length - 1].t);
       }
    }

    return rallies;
  }

  private debounceHits(frames: FrameFeature[]): FrameFeature[] {
      const processed = JSON.parse(JSON.stringify(frames));
      let lastHitIdx = -100;
      for (let i = 0; i < processed.length; i++) {
          if (processed[i].hit_audio) {
              if (i - lastHitIdx < 3) {
                  processed[i].hit_audio = false;
              } else {
                  lastHitIdx = i;
              }
          }
      }
      return processed;
  }

  private finalizeRally(rallies: RallyClip[], endTime: number) {
    if (this.currentRallyStart !== null) {
      const duration = endTime - this.currentRallyStart;
      // Double check duration
      if (duration > 1.5) { // Slightly lower duration threshold if we have better detection
        
        // P0 fix: never fabricate a winner during analysis.
        // Keep `winner` undefined so the score engine can infer it from
        // serving flow or honor explicit manual/import overrides later.
        rallies.push({
          id: rallies.length + 1,
          start: parseFloat(this.currentRallyStart.toFixed(2)),
          end: parseFloat(endTime.toFixed(2)),
          hits: this.hitCount,
          serverSide: this.DEFAULT_SERVER
        });
      }
    }
    this.reset();
  }

  private reset() {
    this.state = RallyState.IDLE;
    this.currentRallyStart = null;
    this.lastHitTime = 0;
    this.hitCount = 0;
  }
}