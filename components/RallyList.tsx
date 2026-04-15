import React, { useRef, useEffect } from 'react';
import { Edit, CheckSquare, Square, Clock, Zap, Filter, Scissors, Merge, Trash2 } from 'lucide-react';
import { RallyClipWithState } from '../types';

/**
 * P2-03：回合列表组件
 *
 * 展示回合列表，支持排序、筛选、选择、编辑模式。
 * 所有编辑操作通过 props 回调传入，不在此处维护业务状态。
 */

type SortOption = 'id' | 'duration' | 'hits';
type FilterOption = 'all' | 'long_rally' | 'game_point';

interface RallyListProps {
    displayRallies: RallyClipWithState[];
    analyzing: boolean;
    currentTime: number;
    activeRallyId: number | null;
    selectedRallyIds: Set<number>;
    isEditMode: boolean;
    sortOption: SortOption;
    filterOption: FilterOption;
    onSeek: (time: number) => void;
    onToggleSelection: (id: number) => void;
    onToggleSelectAll: () => void;
    onToggleEditMode: () => void;
    onSortChange: (opt: SortOption) => void;
    onFilterChange: (opt: FilterOption) => void;
    onToggleServer: (id: number) => void;
    onToggleWinner: (id: number) => void;
    onAdjustHits: (id: number, delta: number) => void;
    onSplitRally: (id: number) => void;
    onMergeRally: (id: number) => void;
    onDeleteRally: (id: number) => void;
}

const RallyList: React.FC<RallyListProps> = ({
    displayRallies,
    analyzing,
    currentTime,
    activeRallyId,
    selectedRallyIds,
    isEditMode,
    sortOption,
    filterOption,
    onSeek,
    onToggleSelection,
    onToggleSelectAll,
    onToggleEditMode,
    onSortChange,
    onFilterChange,
    onToggleServer,
    onToggleWinner,
    onAdjustHits,
    onSplitRally,
    onMergeRally,
    onDeleteRally,
}) => {
    const listRef = useRef<HTMLDivElement>(null);

    // 自动滚动到当前活跃回合
    useEffect(() => {
        if (activeRallyId !== null) {
            const el = document.getElementById(`rally-item-${activeRallyId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [activeRallyId]);

    return (
        <div
            ref={listRef}
            className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[500px]"
        >
            {/* 列表头部工具栏 */}
            <div className="p-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <span>回合列表</span>
                        <span className="text-slate-600 text-xs bg-slate-800 px-1.5 py-0.5 rounded-full">
                            {displayRallies.length}
                        </span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onToggleEditMode}
                            className={`p-1.5 rounded transition-colors ${isEditMode ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-white'}`}
                            title="人工修正模式 (调整比分/拆分/合并)"
                        >
                            <Edit size={14} />
                        </button>
                        <div className="h-4 w-[1px] bg-slate-700"></div>
                        <button
                            onClick={onToggleSelectAll}
                            className={`p-1.5 rounded transition-colors ${selectedRallyIds.size > 0 && selectedRallyIds.size === displayRallies.length ? 'text-emerald-400' : 'text-slate-500 hover:text-white'}`}
                            title="全选/取消全选"
                        >
                            {selectedRallyIds.size > 0 && selectedRallyIds.size === displayRallies.length
                                ? <CheckSquare size={16} />
                                : <Square size={16} />}
                        </button>
                    </div>
                </div>

                {/* 排序 & 筛选 */}
                <div className="flex items-center justify-between gap-2 text-[10px]">
                    <div className="flex items-center bg-slate-950 rounded p-0.5 border border-slate-800">
                        {(['id', 'duration', 'hits'] as SortOption[]).map(opt => (
                            <button
                                key={opt}
                                onClick={() => onSortChange(opt)}
                                className={`px-2 py-1 rounded flex items-center gap-1 ${sortOption === opt ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {opt === 'id' && <span>顺序</span>}
                                {opt === 'duration' && <><Clock size={10} /><span>时长</span></>}
                                {opt === 'hits' && <><Zap size={10} /><span>热度</span></>}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center bg-slate-950 rounded p-0.5 border border-slate-800">
                        <Filter size={10} className="ml-1 text-slate-600" />
                        <select
                            value={filterOption}
                            onChange={(e) => onFilterChange(e.target.value as FilterOption)}
                            className="bg-transparent text-slate-400 border-none outline-none text-[10px] pl-1"
                        >
                            <option value="all">显示全部</option>
                            <option value="long_rally">仅看多拍 ({'>'}8)</option>
                            <option value="game_point">仅看关键分</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 回合列表 */}
            <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
                {displayRallies.length === 0 && !analyzing && (
                    <div className="text-center py-10 text-slate-600 text-xs italic">
                        暂未检测到回合。
                    </div>
                )}
                {displayRallies.map((rally, index) => {
                    const isSelected = selectedRallyIds.has(rally.id);
                    const isCurrent = currentTime >= rally.start && currentTime <= rally.end;
                    const canSplit = isCurrent && currentTime > rally.start + 0.5 && currentTime < rally.end - 0.5;

                    return (
                        <div
                            key={rally.id}
                            id={`rally-item-${rally.id}`}
                            className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between group
                                ${isCurrent
                                    ? 'bg-emerald-500/10 border-emerald-500/50'
                                    : isSelected
                                        ? 'bg-slate-800/50 border-emerald-500/30'
                                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                }`}
                        >
                            {/* 选择框 */}
                            <div className="mr-3 flex items-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={() => onToggleSelection(rally.id)}
                                    className="text-slate-600 hover:text-emerald-400 transition-colors"
                                >
                                    {isSelected
                                        ? <CheckSquare size={16} className="text-emerald-500" />
                                        : <Square size={16} />}
                                </button>
                            </div>

                            {/* 左侧：信息 & 跳转 */}
                            <button onClick={() => onSeek(rally.start)} className="flex-1 text-left min-w-0">
                                <div className={`text-xs font-bold mb-0.5 flex items-center gap-2 ${isCurrent ? 'text-emerald-400' : 'text-slate-300'}`}>
                                    <span className="font-mono opacity-60 w-6">#{rally.id}</span>

                                    {isEditMode ? (
                                        <div className="flex items-center bg-slate-800 rounded px-1" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={() => onAdjustHits(rally.id, -1)} className="px-1.5 hover:text-white">-</button>
                                            <span className="text-[10px] w-4 text-center">{rally.hits}</span>
                                            <button onClick={() => onAdjustHits(rally.id, 1)} className="px-1.5 hover:text-white">+</button>
                                        </div>
                                    ) : (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center border ${
                                            rally.hits >= 8
                                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                : 'bg-slate-800 text-slate-400 border-slate-700'
                                        }`}>
                                            <Zap size={8} className="mr-1" /> {rally.hits} 拍
                                        </span>
                                    )}

                                    <span className="text-[9px] text-slate-500 ml-1">
                                        {(rally.end - rally.start).toFixed(1)}s
                                    </span>
                                </div>

                                {/* 比分流 / 胜方编辑 */}
                                <div className="text-[10px] text-slate-500 font-mono truncate pl-8 flex items-center gap-2">
                                    {isEditMode ? (
                                        <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-1" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => rally.winner !== 'A' && onToggleWinner(rally.id)}
                                                className={`px-1 hover:text-white ${rally.winner === 'A' ? 'text-yellow-500 font-bold' : 'text-slate-600'}`}
                                            >
                                                Near
                                            </button>
                                            <span className="mx-1 text-slate-700">|</span>
                                            <button
                                                onClick={() => rally.winner !== 'B' && onToggleWinner(rally.id)}
                                                className={`px-1 hover:text-white ${rally.winner === 'B' ? 'text-cyan-500 font-bold' : 'text-slate-600'}`}
                                            >
                                                Far
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {rally.scoreStateBefore.scoreA}-{rally.scoreStateBefore.scoreB}
                                            <span className="mx-1 text-slate-600">→</span>
                                            <span className={rally.winner === 'A' ? 'text-yellow-500' : 'text-cyan-500'}>
                                                {rally.scoreStateAfter.scoreA}-{rally.scoreStateAfter.scoreB}
                                            </span>
                                            {rally.scoreStateBefore.isGamePoint && (
                                                <span className="ml-2 text-rose-500 font-bold text-[9px] uppercase border border-rose-500/30 px-1 rounded">BP</span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </button>

                            {/* 右侧：操作按钮 */}
                            <div className="flex items-center space-x-1 pl-2">
                                {isEditMode ? (
                                    <>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onSplitRally(rally.id); }}
                                            className={`p-1.5 rounded border transition-colors ${canSplit ? 'text-orange-400 bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20' : 'text-slate-600 border-transparent opacity-30 cursor-not-allowed'}`}
                                            title={canSplit ? '此处拆分回合 (使用进度条定位)' : '移动进度条到回合中间以拆分'}
                                            disabled={!canSplit}
                                        >
                                            <Scissors size={12} />
                                        </button>

                                        {index < displayRallies.length - 1 && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onMergeRally(rally.id); }}
                                                className="p-1.5 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded border border-blue-500/30"
                                                title={`合并 #${rally.id} 和 #${rally.id + 1}`}
                                            >
                                                <Merge size={12} className="rotate-90" />
                                            </button>
                                        )}

                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDeleteRally(rally.id); }}
                                            className="p-1.5 text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 rounded border border-rose-500/30"
                                            title="删除此回合"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onToggleServer(rally.id); }}
                                        className={`flex items-center space-x-1 px-1.5 py-1 rounded text-[9px] font-bold border transition-colors w-12 justify-center ${
                                            rally.serverSide === 'A'
                                                ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/20'
                                                : 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30 hover:bg-cyan-500/20'
                                        }`}
                                        title="修正发球方 (影响比分)"
                                    >
                                        {rally.serverSide === 'A' ? 'Near' : 'Far'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RallyList;
