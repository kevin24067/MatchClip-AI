import React, { useState, useMemo } from 'react';
import { Upload, Activity, Info, PlayCircle, BarChart3 } from 'lucide-react';
import { generateFFmpegScript } from './services/ffmpegService';
import { useMatchAnalysis } from './hooks/useMatchAnalysis';
import { useRallyEditor } from './hooks/useRallyEditor';
import SignalChart from './components/SignalChart';
import SmartPlayer from './components/SmartPlayer';
import StatsPanel from './components/StatsPanel';
import RallyList from './components/RallyList';

// P2-04：排序/筛选类型定义集中在 App 层，传递给子组件
type SortOption = 'id' | 'duration' | 'hits';
type FilterOption = 'all' | 'long_rally' | 'game_point';

export default function App() {
  // P2-01：分析流程状态（文件、音频分析、JSON导入导出、比分计算）
  const {
    file,
    videoUrl,
    handleFileUpload,
    analyzing,
    progress,
    startAnalysis,
    frames,
    rallies,
    setRallies,
    dataVersion,
    stats,
    processedRallies,
    handleExportJSON,
    handleImportJSON,
    importStatus,
    showStatus,
  } = useMatchAnalysis();

  // UI 状态
  const [sortOption, setSortOption] = useState<SortOption>('id');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [selectedRallyIds, setSelectedRallyIds] = useState<Set<number>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSmartMode, setIsSmartMode] = useState(true);
  const [exportingVideo, setExportingVideo] = useState(false);

  // P2-02：回合编辑逻辑
  const {
    toggleServer,
    toggleRallyWinner,
    adjustHits,
    deleteRally,
    handleSplitRally,
    handleMergeRally,
  } = useRallyEditor({ rallies, setRallies, selectedRallyIds, setSelectedRallyIds, currentTime });

  // P2-04：派生状态——排序筛选后的展示列表（不影响比分计算）
  const displayRallies = useMemo(() => {
    let result = [...processedRallies];
    if (filterOption === 'long_rally') result = result.filter(r => r.hits >= 8);
    else if (filterOption === 'game_point') result = result.filter(r => r.scoreStateBefore.isGamePoint);
    result.sort((a, b) => {
      if (sortOption === 'duration') return (b.end - b.start) - (a.end - a.start);
      if (sortOption === 'hits') return b.hits - a.hits;
      return a.id - b.id;
    });
    return result;
  }, [processedRallies, sortOption, filterOption]);

  // P2-04：当前活跃回合 ID
  const activeRallyId = useMemo(() => {
    const active = displayRallies.find(r => currentTime >= r.start && currentTime <= r.end);
    return active ? active.id : null;
  }, [currentTime, displayRallies]);

  // 选择逻辑
  const toggleSelection = (id: number) => {
    setSelectedRallyIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRallyIds.size === displayRallies.length) {
      setSelectedRallyIds(new Set());
    } else {
      setSelectedRallyIds(new Set(displayRallies.map(r => r.id)));
    }
  };

  // 导出逻辑
  const getRalliesToExport = () => {
    if (selectedRallyIds.size > 0) return processedRallies.filter(r => selectedRallyIds.has(r.id));
    return processedRallies;
  };

  const handleExportFFmpegScript = () => {
    const exportList = getRalliesToExport();
    if (exportList.length === 0) return;
    const script = generateFFmpegScript(file?.name || 'input_video.mp4', exportList);
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `process_highlights_${selectedRallyIds.size > 0 ? 'selected' : 'all'}.sh`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // P3-01：导出视频为演示行为（下载原始视频），明确能力边界
  const handleExportVideo = async () => {
    const exportList = getRalliesToExport();
    if (exportList.length === 0 || !videoUrl) return;
    setExportingVideo(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const filename = (file?.name || 'match_video').replace(/\.[^/.]+$/, '');
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `${filename}_original.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setExportingVideo(false);
    showStatus(`原始视频已下载（演示）。真实剪辑请使用 FFmpeg 脚本。`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="text-emerald-500" />
            <span className="font-bold text-xl tracking-tight text-white">
              Match<span className="text-emerald-500">Clip</span> AI
            </span>
          </div>

          {/* 状态提示 Toast */}
          {importStatus && (
            <div className="absolute top-16 left-1/2 transform -translate-x-1/2 mt-2 px-4 py-2 bg-emerald-600/90 text-white text-sm font-bold rounded-full shadow-lg animate-fade-in-down z-50">
              {importStatus}
            </div>
          )}

          <div className="flex items-center space-x-6 text-sm font-medium text-slate-400">
            <span className="hover:text-white cursor-pointer transition-colors">文档</span>
            <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20 text-xs">
              v2.2.0 Beta
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8" key={dataVersion}>
        {!videoUrl ? (
          /* 上传状态 */
          <div className="flex flex-col items-center justify-center min-h-[60vh] border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/30 hover:bg-slate-900/50 transition-colors group">
            <div className="p-6 rounded-full bg-slate-900 group-hover:scale-110 transition-transform duration-300 shadow-xl shadow-emerald-900/10">
              <Upload className="w-12 h-12 text-emerald-500" />
            </div>
            <h2 className="mt-6 text-2xl font-bold text-white">上传比赛视频</h2>
            <p className="mt-2 text-slate-400 max-w-md text-center">
              支持 MP4, MOV 格式（单固定机位）。<br />
              通过 Web Audio API 解析音轨进行击球检测。
            </p>
            <label className="mt-8 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg cursor-pointer transition-colors shadow-lg shadow-emerald-500/20">
              选择视频文件
              <input type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
            </label>
            <div className="mt-8 flex items-center space-x-2 text-xs text-slate-500">
              <Info size={14} />
              <span>本地 Web Audio API 实时分析，无需 API Key</span>
            </div>
          </div>
        ) : (
          /* 仪表盘状态 */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* 左列：播放器 & 信号图 */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <PlayCircle className="text-emerald-500" size={20} />
                  <span>比赛回放</span>
                </h2>
                {analyzing ? (
                  <span className="text-sm text-emerald-400 animate-pulse">
                    正在进行音频分析... {progress.toFixed(0)}%
                  </span>
                ) : !analyzing && rallies.length === 0 ? (
                  <button
                    onClick={startAnalysis}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    开始 AI 分析
                  </button>
                ) : null}
              </div>

              <SmartPlayer
                videoUrl={videoUrl}
                rallies={rallies}
                processedRallies={processedRallies}
                currentTime={currentTime}
                setCurrentTime={setCurrentTime}
                isSmartMode={isSmartMode}
                toggleSmartMode={() => setIsSmartMode(!isSmartMode)}
              />

              {frames.length > 0 && (
                <SignalChart
                  data={frames}
                  rallies={rallies}
                  currentTime={currentTime}
                  onSeek={setCurrentTime}
                />
              )}
            </div>

            {/* 右列：统计 & 回合列表 */}
            <div className="space-y-6">
              {/* P2-03：统计面板组件 */}
              <StatsPanel
                stats={stats}
                ralliesCount={rallies.length}
                selectedCount={selectedRallyIds.size}
                analyzing={analyzing}
                exportingVideo={exportingVideo}
                processedRallies={processedRallies}
                selectedRallyIds={selectedRallyIds}
                onExportVideo={handleExportVideo}
                onExportFFmpegScript={handleExportFFmpegScript}
                onExportJSON={handleExportJSON}
                onImportJSON={handleImportJSON}
                onRecalculate={() => showStatus(`数据已刷新: ${stats.scoreA} - ${stats.scoreB}`)}
              />

              {/* P2-03：回合列表组件 */}
              <RallyList
                displayRallies={displayRallies}
                analyzing={analyzing}
                currentTime={currentTime}
                activeRallyId={activeRallyId}
                selectedRallyIds={selectedRallyIds}
                isEditMode={isEditMode}
                sortOption={sortOption}
                filterOption={filterOption}
                onSeek={setCurrentTime}
                onToggleSelection={toggleSelection}
                onToggleSelectAll={toggleSelectAll}
                onToggleEditMode={() => setIsEditMode(!isEditMode)}
                onSortChange={setSortOption}
                onFilterChange={setFilterOption}
                onToggleServer={toggleServer}
                onToggleWinner={toggleRallyWinner}
                onAdjustHits={adjustHits}
                onSplitRally={handleSplitRally}
                onMergeRally={handleMergeRally}
                onDeleteRally={deleteRally}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}