import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Eye, Scissors, RotateCcw } from 'lucide-react';
import { RallyClip, RallyClipWithState } from '../types';

interface SmartPlayerProps {
  videoUrl: string;
  rallies: RallyClip[];
  // P0-06 修复：直接接收 App.tsx 已处理好的带比分状态的回合列表
  // 避免 SmartPlayer 内部重复调用 scoreEngine，统一比分来源
  processedRallies: RallyClipWithState[];
  currentTime: number;
  setCurrentTime: (t: number) => void;
  isSmartMode: boolean;
  toggleSmartMode: () => void;
}

const SmartPlayer: React.FC<SmartPlayerProps> = ({ 
  videoUrl, 
  rallies,
  processedRallies,
  currentTime, 
  setCurrentTime,
  isSmartMode,
  toggleSmartMode
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMatchOver, setIsMatchOver] = useState(false);
  
  // Computed state for current moment
  const [currentRallyIdx, setCurrentRallyIdx] = useState(-1);
  const [displayScore, setDisplayScore] = useState({ 
      scoreA: 0, scoreB: 0, server: 'A', visualServiceCourt: 'Near Side (Right)' 
  });

  // Helper to translate Service Court strings
  const getLocalizedCourt = (text: string) => {
    return text
        .replace("Near Side", "近方")
        .replace("Far Side", "远方")
        .replace("Right", "右")
        .replace("Left", "左");
  };

  // P0-06 修复：直接使用 App.tsx 传入的 processedRallies，不再重复计算
  const ralliesWithState = processedRallies;

  // Sync Video Time
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Handle Time Updates & Logic
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    if (ralliesWithState.length === 0) return;

    // Identify current rally
    const idx = ralliesWithState.findIndex(r => t >= r.start && t <= r.end);
    setCurrentRallyIdx(idx);
    
    // Check if we are past the absolute last rally
    const lastRally = ralliesWithState[ralliesWithState.length - 1];
    const isPastEnd = t > lastRally.end;

    if (isPastEnd) {
        // MATCH OVER STATE
        // Show the score AFTER the last rally
        const lastState = lastRally.scoreStateAfter;
        setDisplayScore({
            scoreA: lastState.scoreA,
            scoreB: lastState.scoreB,
            server: lastState.server as 'A' | 'B',
            visualServiceCourt: 'GAME OVER'
        });
        setIsMatchOver(true);

        // Smart Mode: Pause at end
        if (isSmartMode && isPlaying && t > lastRally.end + 2.0) {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    } else {
        setIsMatchOver(false);
        
        if (idx !== -1) {
            // IN RALLY: Show score BEFORE this rally
            const state = ralliesWithState[idx].scoreStateBefore;
            setDisplayScore({
                scoreA: state.scoreA,
                scoreB: state.scoreB,
                server: state.server as 'A' | 'B',
                visualServiceCourt: state.visualServiceCourt
            });
        } else {
            // DEAD TIME: Logic "Update score at NEXT serve"
            const nextIdx = ralliesWithState.findIndex(r => r.start > t);
            
            if (nextIdx !== -1) {
                // We are waiting for Rally [nextIdx]
                if (nextIdx > 0) {
                    // Show previous rally's score (Wait for serve to update)
                    const prevRally = ralliesWithState[nextIdx - 1];
                    const state = prevRally.scoreStateBefore;
                    setDisplayScore({
                        scoreA: state.scoreA,
                        scoreB: state.scoreB,
                        server: state.server as 'A' | 'B',
                        visualServiceCourt: state.visualServiceCourt
                    });
                } else {
                    // Before 1st rally: Show 0-0
                    const state = ralliesWithState[nextIdx].scoreStateBefore;
                    setDisplayScore({
                        scoreA: state.scoreA,
                        scoreB: state.scoreB,
                        server: state.server as 'A' | 'B',
                        visualServiceCourt: state.visualServiceCourt
                    });
                }

                // Smart Skip Logic
                if (isSmartMode) {
                    if (t < ralliesWithState[nextIdx].start - 0.5) {
                        videoRef.current.currentTime = ralliesWithState[nextIdx].start;
                    }
                }
            }
        }
    }
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    
    // Logic: If playing, pause. If paused, play.
    // We use the video element's property as the source of truth for action,
    // but update react state to match UI.
    if (!videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
    } else {
        // If at the end, restart
        if (isMatchOver) {
            videoRef.current.currentTime = 0;
        }
        videoRef.current.play();
        setIsPlaying(true);
    }
  }, [isMatchOver]); // Removed isPlaying from dependency to rely on videoRef state, avoiding stale closure issues in useEffect

  // Keyboard Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Avoid conflict with input elements if any exist in the future
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

        if (e.code === 'Space') {
            e.preventDefault(); // Prevent page scroll
            togglePlay();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlay]);


  return (
    <div className="relative group rounded-xl overflow-hidden border border-slate-700 bg-black shadow-2xl">
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full aspect-video object-contain"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
      />

      {/* GAME OVER Overlay */}
      {isMatchOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none animate-in fade-in zoom-in duration-500">
            <div className="text-center transform -rotate-6 border-4 border-white/20 p-8 rounded-xl bg-slate-900/80 shadow-2xl">
                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-white to-cyan-400 tracking-wider drop-shadow-lg">
                    GAME OVER
                </div>
                <div className="text-2xl font-mono text-white mt-4 font-bold flex justify-center items-center gap-4">
                     <span className="text-yellow-400">{displayScore.scoreA}</span>
                     <span>-</span>
                     <span className="text-cyan-400">{displayScore.scoreB}</span>
                </div>
                <div className="text-sm text-slate-400 mt-2 tracking-widest uppercase">Final Score</div>
            </div>
        </div>
      )}

      {/* Overlay: Scoreboard (Hidden if Game Over overlay covers it, or kept for consistency) */}
      {!isMatchOver && (
      <div className="absolute top-4 right-4 flex flex-col items-end space-y-2">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-3 shadow-lg transition-all duration-300 min-w-[160px]">
            {/* Score Numbers */}
            <div className="flex items-center justify-between font-mono font-bold relative mb-2">
                {/* Player A (Near) */}
                <div className="flex flex-col items-center">
                    <div className={`text-2xl relative ${displayScore.server === 'A' ? 'text-yellow-400' : 'text-slate-500'}`}>
                        {displayScore.scoreA.toString().padStart(2, '0')}
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase mt-1">近方 (Near)</div>
                </div>

                <div className="text-slate-700 mx-3 text-lg">-</div>

                {/* Player B (Far) */}
                <div className="flex flex-col items-center">
                    <div className={`text-2xl relative ${displayScore.server === 'B' ? 'text-cyan-400' : 'text-slate-500'}`}>
                        {displayScore.scoreB.toString().padStart(2, '0')}
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase mt-1">远方 (Far)</div>
                </div>
            </div>

            {/* Service Court Indicator (Footer) */}
            <div className="border-t border-slate-800 pt-2 flex justify-center">
                 <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${displayScore.server === 'A' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-cyan-500/20 text-cyan-500'}`}>
                    {getLocalizedCourt(displayScore.visualServiceCourt)}
                </span>
            </div>
        </div>

        {/* Rally Info Tag */}
        {currentRallyIdx !== -1 && (
            <div className="bg-emerald-500/90 backdrop-blur px-3 py-1 rounded text-xs font-bold text-white shadow-lg animate-fade-in flex items-center gap-2">
                <span>Rally #{currentRallyIdx + 1}</span>
                <span className="bg-emerald-700/50 px-1.5 rounded-sm text-[10px]">{rallies[currentRallyIdx].hits} 拍</span>
            </div>
        )}
      </div>
      )}

      {/* Overlay: Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <button onClick={togglePlay} className="p-3 bg-white text-black rounded-full hover:scale-105 transition-transform">
                    {isMatchOver ? <RotateCcw size={20} /> : (isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />)}
                </button>
                
                <div className="flex flex-col">
                    <span className="text-white font-medium text-sm">
                        {currentTime.toFixed(1)}s
                    </span>
                    <span className="text-xs text-slate-400">
                        {isMatchOver ? 'Match Finished' : (currentRallyIdx !== -1 ? `Hit Count: ${rallies[currentRallyIdx].hits}` : 'Waiting for serve...')}
                    </span>
                </div>
            </div>

            <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-slate-800/80 rounded-full px-1 p-1">
                    <button 
                        onClick={() => !isSmartMode && toggleSmartMode()}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center space-x-1 ${!isSmartMode ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Eye size={14} />
                        <span>Raw</span>
                    </button>
                    <button 
                        onClick={() => isSmartMode && toggleSmartMode()}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center space-x-1 ${isSmartMode ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Scissors size={14} />
                        <span>Smart</span>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SmartPlayer;