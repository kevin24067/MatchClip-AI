import { RallyClip, RallyClipWithState, ScoreState } from '../types';

/**
 * Service to manage Badminton Score Logic (Rally Point System - 21 Points)
 * 
 * Core policy:
 * - `winner` is treated as an explicit manual/import override only.
 * - If `winner` is absent, infer it from the sequence of `serverSide`.
 * 
 * Logic:
 * If Server(N+1) == Server(N) -> Server(N) won Rally(N). (Retained service)
 * If Server(N+1) != Server(N) -> Receiver(N) won Rally(N). (Side out)
 */
export class BadmintonScoreEngine {
  
  /**
   * Processes a list of raw rallies and attaches score state to each.
   * Uses "Lookahead" logic to determine winners.
   */
  public processRallies(rallies: RallyClip[]): RallyClipWithState[] {
    // 1. Initialize State
    let currentScoreA = 0;
    let currentScoreB = 0;

    const result: RallyClipWithState[] = [];

    for (let i = 0; i < rallies.length; i++) {
      const currentRally = rallies[i];
      const nextRally = i < rallies.length - 1 ? rallies[i + 1] : null;

      // --- Determine State BEFORE this rally starts ---
      // The 'serverSide' stored on the rally clip is the Ground Truth for who is serving NOW.
      const currentServer = currentRally.serverSide; // 'A' or 'B'
      
      // Calculate Service Court based on CURRENT score of the Server
      const serverScore = currentServer === 'A' ? currentScoreA : currentScoreB;
      const isEven = serverScore % 2 === 0;
      const serviceSide = isEven ? 'Right' : 'Left';
      
      let visualServiceCourt = '';
      if (currentServer === 'A') {
          // Near Side (Back to Camera): Player's Right is Screen Right
          visualServiceCourt = isEven ? 'Near Side (Right)' : 'Near Side (Left)';
      } else {
          // Far Side (Facing Camera): Player's Right is Screen Left
          // We output the SCREEN side to assist visual verification by the operator
          visualServiceCourt = isEven ? 'Far Side (Left)' : 'Far Side (Right)';
      }

      const stateBefore: ScoreState = {
        scoreA: currentScoreA,
        scoreB: currentScoreB,
        server: currentServer,
        serviceSide: serviceSide,
        visualServiceCourt: visualServiceCourt,
        isGamePoint: Math.max(currentScoreA, currentScoreB) >= 20,
        isInterval: false // Calculated later
      };

      // --- Determine Winner of THIS rally ---
      let winner: 'A' | 'B';

      // `winner` should only be present for manual overrides/imported ground truth.
      if (currentRally.winner) {
          winner = currentRally.winner;
          console.log(`[ScoreEngine] Rally #${currentRally.id}: Explicit winner '${winner}' found.`);
      } else if (nextRally) {
        // Look at who serves next
        if (nextRally.serverSide === currentServer) {
          // If the same person serves next, they won this point
          winner = currentServer;
        } else {
          // If the server changes, the receiver won this point
          winner = currentServer === 'A' ? 'B' : 'A';
        }
      } else {
        // End of Match Handling (Last Rally)
        // Since there is no "next server", we cannot deductively know the winner.
        // Fall back to an explicit override if present, otherwise keep the current server
        // so the last rally remains deterministic instead of random.
        winner = currentRally.winner || currentServer; 
      }

      // --- CRITICAL FIX: Do not mutate currentRally in place ---
      // We create a new object spreading currentRally, then override winner.
      // This ensures React detects changes and doesn't pollute the source array if it's reused.
      const rallyWithWinner = { ...currentRally, winner };

      // --- Calculate State AFTER this rally ---
      if (winner === 'A') currentScoreA++;
      else currentScoreB++;

      const stateAfter: ScoreState = {
        scoreA: currentScoreA,
        scoreB: currentScoreB,
        server: winner, // The winner is nominally the "server" for the next calculation state
        serviceSide: 'Right', // Placeholder, recalculated in next iteration's "Before"
        visualServiceCourt: '',
        isGamePoint: Math.max(currentScoreA, currentScoreB) >= 20,
        isInterval: false
      };

      // Interval Logic (Simple check)
      if (Math.max(currentScoreA, currentScoreB) === 11 && 
          (stateBefore.scoreA !== 11 && stateBefore.scoreB !== 11)) {
         stateAfter.isInterval = true; // Technically flag belongs to the break *after* the rally
      }

      result.push({
        ...rallyWithWinner,
        scoreStateBefore: stateBefore,
        scoreStateAfter: stateAfter
      });
    }

    return result;
  }
}

export const scoreEngine = new BadmintonScoreEngine();