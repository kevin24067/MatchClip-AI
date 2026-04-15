import { useCallback } from 'react';
import { RallyClip } from '../types';

/**
 * P2-02：回合编辑逻辑 Hook
 *
 * 封装所有人工修正操作：
 * - toggleServer：切换发球方
 * - toggleRallyWinner：切换胜方（只写显式 winner，不修改 serverSide）
 * - adjustHits：调整击球数
 * - deleteRally：删除回合
 * - handleSplitRally：拆分回合（按当前播放时间）
 * - handleMergeRally：合并相邻回合
 */

/** 将回合列表按时间排序并重新编号 */
export const reindexRallies = (list: RallyClip[]): RallyClip[] => {
    const sorted = [...list].sort((a, b) => a.start - b.start);
    return sorted.map((r, idx) => ({ ...r, id: idx + 1 }));
};

interface UseRallyEditorOptions {
    rallies: RallyClip[];
    setRallies: React.Dispatch<React.SetStateAction<RallyClip[]>>;
    selectedRallyIds: Set<number>;
    setSelectedRallyIds: React.Dispatch<React.SetStateAction<Set<number>>>;
    currentTime: number;
}

export function useRallyEditor({
    rallies,
    setRallies,
    selectedRallyIds,
    setSelectedRallyIds,
    currentTime,
}: UseRallyEditorOptions) {

    /** 切换发球方 */
    const toggleServer = useCallback((rallyId: number) => {
        setRallies(prev => prev.map(r =>
            r.id === rallyId ? { ...r, serverSide: r.serverSide === 'A' ? 'B' : 'A' } : r
        ));
    }, [setRallies]);

    /**
     * P0-03 修复：人工修正胜方
     * 只写入显式 winner 字段，不修改 serverSide。
     * scoreEngine 会优先消费显式 winner，后续回合的发球序列推导不受影响。
     */
    const toggleRallyWinner = useCallback((rallyId: number) => {
        setRallies(prev => {
            const idx = prev.findIndex(r => r.id === rallyId);
            if (idx === -1) return prev;

            const currentRally = prev[idx];
            const currentServer = currentRally.serverSide;

            // 确定当前有效胜方（优先显式 winner，否则从发球序列推导）
            let currentWinner = currentRally.winner;
            if (!currentWinner) {
                const nextRally = idx < prev.length - 1 ? prev[idx + 1] : null;
                if (nextRally) {
                    currentWinner = nextRally.serverSide === currentServer
                        ? currentServer
                        : (currentServer === 'A' ? 'B' : 'A');
                } else {
                    currentWinner = currentServer; // 末回合默认
                }
            }

            const newWinner: 'A' | 'B' = currentWinner === 'A' ? 'B' : 'A';
            const updated = [...prev];
            updated[idx] = { ...currentRally, winner: newWinner };
            return updated;
        });
    }, [setRallies]);

    /** 调整击球数 */
    const adjustHits = useCallback((rallyId: number, delta: number) => {
        setRallies(prev => prev.map(r =>
            r.id === rallyId ? { ...r, hits: Math.max(1, r.hits + delta) } : r
        ));
    }, [setRallies]);

    /** 删除回合 */
    const deleteRally = useCallback((rallyId: number) => {
        if (window.confirm(`确定要删除回合 #${rallyId} 吗？\n删除后后续比分将自动重新计算。`)) {
            setRallies(prev => reindexRallies(prev.filter(r => r.id !== rallyId)));
            setSelectedRallyIds(prev => {
                const next = new Set(prev);
                next.delete(rallyId);
                return next;
            });
        }
    }, [setRallies, setSelectedRallyIds]);

    /** 拆分回合（按当前播放时间） */
    const handleSplitRally = useCallback((rallyId: number) => {
        const targetRally = rallies.find(r => r.id === rallyId);
        if (!targetRally) return;

        if (currentTime <= targetRally.start + 0.5 || currentTime >= targetRally.end - 0.5) {
            console.warn('拆分失败：请确保播放进度条位于该回合中间（两端需留至少0.5秒）。');
            return;
        }

        const totalDur = targetRally.end - targetRally.start;
        const firstDur = currentTime - targetRally.start;
        const ratio = firstDur / totalDur;
        const hits1 = Math.max(1, Math.round(targetRally.hits * ratio));
        const hits2 = Math.max(1, targetRally.hits - hits1);

        const part1: RallyClip = { ...targetRally, end: parseFloat(currentTime.toFixed(2)), hits: hits1, id: -1 };
        const part2: RallyClip = { ...targetRally, start: parseFloat(currentTime.toFixed(2)), hits: hits2, id: -1 };

        setRallies(prev => reindexRallies([...prev.filter(r => r.id !== rallyId), part1, part2]));
    }, [rallies, currentTime, setRallies]);

    /** 合并相邻回合（rallyId 与 rallyId+1） */
    const handleMergeRally = useCallback((rallyId: number) => {
        const currentRally = rallies.find(r => r.id === rallyId);
        const nextRally = rallies.find(r => r.id === rallyId + 1);

        if (!currentRally) return;
        if (!nextRally) {
            console.warn('无法合并：这是最后一个回合。');
            return;
        }

        const merged: RallyClip = {
            ...currentRally,
            end: nextRally.end,
            hits: currentRally.hits + nextRally.hits,
        };

        setRallies(prev => reindexRallies([
            ...prev.filter(r => r.id !== rallyId && r.id !== nextRally.id),
            merged
        ]));
    }, [rallies, setRallies]);

    return {
        toggleServer,
        toggleRallyWinner,
        adjustHits,
        deleteRally,
        handleSplitRally,
        handleMergeRally,
    };
}
