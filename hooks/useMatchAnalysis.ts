import { useState, useMemo } from 'react';
import { analyzeMatchAudio } from '../services/audioAnalysisService';
import { RallyFSM } from '../services/fsmService';
import { scoreEngine } from '../services/scoreService';
import { FrameFeature, RallyClip, MatchStats, RallyClipWithState } from '../types';
import { reindexRallies } from './useRallyEditor';

/**
 * P2-01：分析流程状态管理 Hook
 *
 * 封装：
 * - 文件上传与视频 URL 管理
 * - 音频分析 + FSM 回合识别流程
 * - JSON 导入/导出
 * - 比分计算（processedRallies / stats）
 * - 导入状态提示
 */

type SortOption = 'id' | 'duration' | 'hits';
type FilterOption = 'all' | 'long_rally' | 'game_point';

export function useMatchAnalysis() {
    // --- 文件 & 视频 ---
    const [file, setFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    // --- 分析流程 ---
    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [importStatus, setImportStatus] = useState<string | null>(null);

    // --- 核心数据 ---
    const [frames, setFrames] = useState<FrameFeature[]>([]);
    const [rallies, setRallies] = useState<RallyClip[]>([]);
    const [dataVersion, setDataVersion] = useState(0);

    // --- 文件上传 ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setFile(f);
            setVideoUrl(URL.createObjectURL(f));
            setFrames([]);
            setRallies([]);
            setDataVersion(v => v + 1);
        }
    };

    // --- 音频分析 + FSM ---
    const startAnalysis = async () => {
        if (!file || !videoUrl) return;
        setAnalyzing(true);
        setProgress(10);

        try {
            setProgress(30);
            const analyzedFrames = await analyzeMatchAudio(file);
            setFrames(analyzedFrames);
            setProgress(70);

            const fsm = new RallyFSM();
            const detectedRallies = fsm.processSignals(analyzedFrames);
            setRallies(detectedRallies);
            setDataVersion(v => v + 1);
            setProgress(100);
        } catch (e) {
            console.error('Analysis failed', e);
        } finally {
            setAnalyzing(false);
        }
    };

    // --- P2-04：派生状态（比分 + 统计）统一在此计算，作为唯一来源 ---
    const { stats, processedRallies } = useMemo(() => {
        const ralliesWithState: RallyClipWithState[] = scoreEngine.processRallies(rallies);

        const validDuration = rallies.reduce((acc, r) => acc + (r.end - r.start), 0);
        const totalHits = rallies.reduce((acc, r) => acc + r.hits, 0);
        const maxHits = rallies.reduce((acc, r) => Math.max(acc, r.hits), 0);

        const finalState = ralliesWithState.length > 0
            ? ralliesWithState[ralliesWithState.length - 1].scoreStateAfter
            : { scoreA: 0, scoreB: 0 };

        const derivedTotalDuration = frames.length > 0
            ? frames[frames.length - 1].t
            : (rallies.length > 0 ? rallies[rallies.length - 1].end : 0);

        const statsObj: MatchStats = {
            totalDuration: derivedTotalDuration,
            validDuration,
            rallyCount: rallies.length,
            averageRallyLen: rallies.length ? validDuration / rallies.length : 0,
            scoreA: finalState.scoreA,
            scoreB: finalState.scoreB,
            totalHits,
            avgHitsPerRally: rallies.length ? totalHits / rallies.length : 0,
            maxHits,
        };

        return { stats: statsObj, processedRallies: ralliesWithState };
    }, [rallies, frames]);

    // --- JSON 导出 ---
    const handleExportJSON = () => {
        if (rallies.length === 0) return;

        const dataToSave = {
            metadata: {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                sourceFile: file?.name || 'unknown',
            },
            rallies,
        };

        const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(file?.name || 'match').replace(/\.[^/.]+$/, '')}_rallies.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- JSON 导入 ---
    const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const fileReader = new FileReader();
            fileReader.onload = (ev) => {
                try {
                    const content = ev.target?.result as string;
                    const jsonData = JSON.parse(content);

                    if (!jsonData.rallies || !Array.isArray(jsonData.rallies)) {
                        setImportStatus('导入失败：文件格式无效');
                        return;
                    }

                    const sanitizedRallies: RallyClip[] = jsonData.rallies.map((r: any) => ({
                        id: Number(r.id),
                        start: Number(r.start),
                        end: Number(r.end),
                        hits: Number(r.hits),
                        serverSide: r.serverSide === 'B' ? 'B' : 'A',
                        winner: (r.winner === 'A' || r.winner === 'B') ? r.winner : undefined,
                    })).sort((a: RallyClip, b: RallyClip) => a.start - b.start);

                    setFrames([]);
                    setRallies(reindexRallies(sanitizedRallies));
                    setDataVersion(v => v + 1);
                    setImportStatus(`成功导入 ${sanitizedRallies.length} 个回合`);
                    setTimeout(() => setImportStatus(null), 3000);
                } catch (err) {
                    console.error(err);
                    setImportStatus('导入失败：JSON 解析错误');
                }
            };
            fileReader.readAsText(e.target.files[0]);
        }
        e.target.value = '';
    };

    // --- 状态提示工具 ---
    const showStatus = (msg: string, duration = 3000) => {
        setImportStatus(msg);
        setTimeout(() => setImportStatus(null), duration);
    };

    return {
        // 文件 & 视频
        file,
        videoUrl,
        handleFileUpload,
        // 分析流程
        analyzing,
        progress,
        startAnalysis,
        // 核心数据
        frames,
        rallies,
        setRallies,
        dataVersion,
        // 派生状态（P2-04 唯一来源）
        stats,
        processedRallies,
        // 导入导出
        handleExportJSON,
        handleImportJSON,
        // 状态提示
        importStatus,
        showStatus,
    };
}
