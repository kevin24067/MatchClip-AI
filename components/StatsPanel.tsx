import React from 'react';
import { BarChart3, Download, Film, FileCode, Save, FolderInput, RefreshCw } from 'lucide-react';
import { MatchStats, RallyClipWithState } from '../types';

/**
 * P2-03：统计面板组件
 *
 * 展示比赛数据统计、比分、导出操作。
 * 所有数据来自 App.tsx 传入的 props（派生自 useMatchAnalysis），不在此重复计算。
 */

interface StatsPanelProps {
    stats: MatchStats;
    ralliesCount: number;
    selectedCount: number;
    analyzing: boolean;
    exportingVideo: boolean;
    processedRallies: RallyClipWithState[];
    selectedRallyIds: Set<number>;
    onExportVideo: () => void;
    onExportFFmpegScript: () => void;
    onExportJSON: () => void;
    onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRecalculate: () => void;
}

const StatsPanel: React.FC<StatsPanelProps> = ({
    stats,
    ralliesCount,
    selectedCount,
    analyzing,
    exportingVideo,
    onExportVideo,
    onExportFFmpegScript,
    onExportJSON,
    onImportJSON,
    onRecalculate,
}) => {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 size={16} /> 比赛数据
                </h3>
                <button
                    onClick={onRecalculate}
                    className="p-1.5 hover:bg-slate-800 rounded-full text-slate-500 hover:text-emerald-400 transition-colors"
                    title="基于当前调整重新校验整体数据"
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            {ralliesCount > 0 ? (
                <div className="space-y-4">
                    {/* 时长 & 节奏 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                            <div className="text-xs text-slate-500">有效时长占比</div>
                            <div className="text-xl font-mono text-emerald-400">
                                {stats.totalDuration > 0
                                    ? Math.round((stats.validDuration / stats.totalDuration) * 100)
                                    : 0}%
                            </div>
                        </div>
                        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                            <div className="text-xs text-slate-500">平均回合时长</div>
                            <div className="text-xl font-mono text-white">
                                {stats.averageRallyLen.toFixed(1)}s
                            </div>
                        </div>
                    </div>

                    {/* 比分 */}
                    <div className="pt-4 border-t border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-slate-400">当前比分 (近方 vs 远方)</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-950 p-4 rounded-lg border border-slate-800">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-yellow-500">{stats.scoreA}</div>
                                <div className="text-[10px] text-slate-500 uppercase">近方 (Near)</div>
                            </div>
                            <div className="text-slate-700 font-mono text-xl">VS</div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-cyan-500">{stats.scoreB}</div>
                                <div className="text-[10px] text-slate-500 uppercase">远方 (Far)</div>
                            </div>
                        </div>
                    </div>

                    {/* 导出操作 */}
                    <div className="pt-4 mt-2 border-t border-slate-800">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                {selectedCount > 0 ? `导出选中 (${selectedCount})` : '导出全部'}
                            </span>
                            <Download size={14} className="text-slate-600" />
                        </div>

                        {/* P3-01/P3-02：导出按钮能力边界说明 */}
                        <div className="flex gap-2 mb-3">
                            <button
                                onClick={onExportVideo}
                                disabled={ralliesCount === 0 || exportingVideo}
                                className="flex-1 flex items-center justify-center space-x-2 px-3 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                                title="演示下载：直接下载原始视频文件，不执行剪辑。真实剪辑请使用 FFmpeg 脚本。"
                            >
                                {exportingVideo ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <Film size={18} />
                                )}
                                <span>{selectedCount > 0 ? '下载原视频 (演示)' : '下载原视频 (演示)'}</span>
                            </button>

                            <button
                                onClick={onExportFFmpegScript}
                                disabled={ralliesCount === 0}
                                className="px-3 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 font-bold border border-slate-700 transition-colors disabled:opacity-50"
                                title="下载 FFmpeg 处理脚本（含比分字幕）。在本地终端执行脚本完成真实剪辑。"
                            >
                                <FileCode size={18} />
                            </button>
                        </div>

                        {/* P3-02：能力边界说明文字 */}
                        <p className="text-[10px] text-slate-600 mb-3 leading-relaxed">
                            <span className="text-slate-500">📋 FFmpeg 脚本</span>：含比分字幕，本地执行完成真实剪辑<br />
                            <span className="text-slate-500">🎬 下载原视频</span>：演示用，不执行剪辑
                        </p>

                        {/* 项目存档 */}
                        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-800/50">
                            <button
                                onClick={onExportJSON}
                                disabled={ralliesCount === 0}
                                className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30"
                                title="保存项目为 JSON"
                            >
                                <Save size={14} /> 保存项目
                            </button>
                            <div className="h-4 w-[1px] bg-slate-800"></div>
                            <label className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
                                <FolderInput size={14} /> 导入数据
                                <input type="file" accept=".json" className="hidden" onChange={onImportJSON} />
                            </label>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 text-slate-600 text-sm">
                    {analyzing ? '正在计算统计数据...' : '运行分析以查看比赛数据'}
                </div>
            )}
        </div>
    );
};

export default StatsPanel;
