import { RallyClip, RallyClipWithState } from '../types';
import { scoreEngine } from './scoreService';

/**
 * Generates a shell script containing the FFmpeg command to process the video.
 * Supports exporting a subset of rallies while keeping original scores if provided.
 */
export const generateFFmpegScript = (inputFilename: string, rallies: (RallyClip | RallyClipWithState)[]): string => {
  const outputFilename = "highlights_scored.mp4";
  
  if (rallies.length === 0) {
    return "# No rallies detected.";
  }

  // Determine if input is already processed with state, or needs processing
  let ralliesWithState: RallyClipWithState[];
  
  // Check if the first element has scoreStateBefore (Type Guardish check)
  if ('scoreStateBefore' in rallies[0]) {
      // Use existing state (Preserves original match score context for highlights)
      ralliesWithState = rallies as RallyClipWithState[];
  } else {
      // Process from scratch (Recalculates sequence 0-0, 1-0, etc.)
      ralliesWithState = scoreEngine.processRallies(rallies as RallyClip[]);
  }

  // Build Filter Complex
  let filterComplex = "";
  let inputs = "";
  
  inputs = ` -i "${inputFilename}" `;

  ralliesWithState.forEach((r, i) => {
    // Get score entering the rally
    const state = r.scoreStateBefore;
    
    // Video Filter: Trim -> SetPTS -> DrawText (Score) -> DrawText (Rally #) -> DrawText (Server/Court)
    const vLabel = `v${i}`;
    const aLabel = `a${i}`;
    
    // Text Formatting
    // Scores: Near (A) vs Far (B)
    const scoreText = `Near ${state.scoreA} - ${state.scoreB} Far`;

    // Service Indicator
    // "Serve: Near (R)" or "Serve: Far (L)"
    // Using visualServiceCourt string like "Near Side (Right)"
    // Shorten for video: "Sv: Near (Right)"
    // CRITICAL FIX: Escape the colon after 'Sv' because it's a separator in FFmpeg filter syntax.
    const serveText = `Sv\\: ${state.visualServiceCourt}`;

    // Escape characters for FFmpeg
    // We need to ensure that the colon inside the TEXT VALUE is escaped with a backslash
    // so FFmpeg doesn't treat it as the end of the 'text' option.
    // In JS string literal, '\\' becomes '\'.
    // So `Score\\:` becomes `Score\:` in the string. FFmpeg reads `Score\:`. Correct.
    
    const escapedScore = `Score\\: ${scoreText}`;
    // Include Hit Count in Rally Label
    const escapedRally = `Rally \\#${r.id} (${r.hits} Hits)`;
    const escapedServe = `${serveText}`;
    
    // DrawText Filters
    // 1. Score (Top Right)
    const drawScore = `drawtext=text='${escapedScore}':fontcolor=white:fontsize=48:x=w-tw-20:y=20:box=1:boxcolor=black@0.5:boxborderw=5`;
    
    // 2. Rally ID (Top Left)
    const drawRally = `drawtext=text='${escapedRally}':fontcolor=0x10b981:fontsize=32:x=20:y=20:box=1:boxcolor=black@0.5:boxborderw=5`;

    // 3. Service Side Hint (Bottom Right)
    // Dynamic Color: Yellow for Near serving, Cyan for Far serving
    const serveColor = state.server === 'A' ? 'yellow' : 'cyan';
    const drawServe = `drawtext=text='${escapedServe}':fontcolor=${serveColor}:fontsize=32:x=w-tw-20:y=80:box=1:boxcolor=black@0.5:boxborderw=2`;

    filterComplex += `[0:v]trim=start=${r.start}:end=${r.end},setpts=PTS-STARTPTS,${drawScore},${drawRally},${drawServe}[${vLabel}];`;
    filterComplex += `[0:a]atrim=start=${r.start}:end=${r.end},asetpts=PTS-STARTPTS[${aLabel}];`;
  });

  // Concat Filter
  ralliesWithState.forEach((_, i) => {
    filterComplex += `[v${i}][a${i}]`;
  });
  filterComplex += `concat=n=${rallies.length}:v=1:a=1[outv][outa]`;

  // Construct Final Command
  const scriptContent = `#!/bin/bash
# 羽毛球智能剪辑 - FFmpeg 处理脚本
# 生成时间: ${new Date().toISOString()}
# 包含片段数: ${rallies.length}
# 规则引擎: 21分制 (Near/Far Player)

echo "开始处理视频..."

ffmpeg ${inputs} \\
-filter_complex "${filterComplex}" \\
-map "[outv]" -map "[outa]" \\
-c:v libx264 -preset fast -crf 22 \\
-c:a aac -b:a 128k \\
"${outputFilename}"

echo "处理完成！输出文件: ${outputFilename}"
`;

  return scriptContent;
};