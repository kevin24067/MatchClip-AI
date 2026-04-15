import { describe, it, expect } from 'vitest';
import { BadmintonScoreEngine } from '../services/scoreService';
import { RallyClip } from '../types';

/**
 * P4-01：计分引擎单元测试
 *
 * 覆盖场景：
 * 1. 基础发球序列推导（保发 / 换发）
 * 2. 显式 winner 优先于发球序列推导
 * 3. 末回合默认当前发球方赢
 * 4. 关键分（Game Point）标记
 * 5. 中场休息（11分）标记
 * 6. 混合场景（部分显式 winner + 部分推导）
 */

const engine = new BadmintonScoreEngine();

/** 构造最小 RallyClip */
function makeRally(id: number, serverSide: 'A' | 'B', winner?: 'A' | 'B'): RallyClip {
    return { id, start: id * 10, end: id * 10 + 8, hits: 5, serverSide, winner };
}

describe('BadmintonScoreEngine', () => {

    // ─── 1. 基础发球序列推导 ───────────────────────────────────────────────

    it('保发：下一回合发球方相同 → 当前发球方赢', () => {
        const rallies: RallyClip[] = [
            makeRally(1, 'A'), // 下一回合仍是 A 发球 → A 赢
            makeRally(2, 'A'), // 末回合，默认 A 赢
        ];
        const result = engine.processRallies(rallies);
        expect(result[0].scoreStateAfter.scoreA).toBe(1);
        expect(result[0].scoreStateAfter.scoreB).toBe(0);
    });

    it('换发：下一回合发球方不同 → 接球方赢', () => {
        const rallies: RallyClip[] = [
            makeRally(1, 'A'), // 下一回合是 B 发球 → B 赢（换发）
            makeRally(2, 'B'), // 末回合，默认 B 赢
        ];
        const result = engine.processRallies(rallies);
        expect(result[0].scoreStateAfter.scoreA).toBe(0);
        expect(result[0].scoreStateAfter.scoreB).toBe(1);
    });

    it('连续多回合比分累计正确', () => {
        // A 赢 3 分，B 赢 2 分
        const rallies: RallyClip[] = [
            makeRally(1, 'A'), // A 保发 → A 赢
            makeRally(2, 'A'), // A 换发 → B 赢
            makeRally(3, 'B'), // B 保发 → B 赢
            makeRally(4, 'B'), // B 换发 → A 赢
            makeRally(5, 'A'), // 末回合 → A 赢
        ];
        const result = engine.processRallies(rallies);
        const final = result[result.length - 1].scoreStateAfter;
        expect(final.scoreA).toBe(3);
        expect(final.scoreB).toBe(2);
    });

    // ─── 2. 显式 winner 优先 ──────────────────────────────────────────────

    it('显式 winner 优先于发球序列推导', () => {
        const rallies: RallyClip[] = [
            makeRally(1, 'A', 'B'), // 显式 winner=B，即使 A 发球
            makeRally(2, 'A'),
        ];
        const result = engine.processRallies(rallies);
        expect(result[0].scoreStateAfter.scoreA).toBe(0);
        expect(result[0].scoreStateAfter.scoreB).toBe(1);
    });

    it('显式 winner 与发球序列混合：只有显式 winner 的回合被覆盖', () => {
        const rallies: RallyClip[] = [
            makeRally(1, 'A', 'B'), // 显式 B 赢
            makeRally(2, 'A'),       // 无显式，A 保发 → A 赢
            makeRally(3, 'A'),       // 末回合，A 赢
        ];
        const result = engine.processRallies(rallies);
        expect(result[0].scoreStateAfter.scoreB).toBe(1); // B 赢第1分
        expect(result[1].scoreStateAfter.scoreA).toBe(1); // A 赢第2分
        expect(result[2].scoreStateAfter.scoreA).toBe(2); // A 赢第3分
    });

    // ─── 3. 末回合策略 ────────────────────────────────────────────────────

    it('末回合无显式 winner → 默认当前发球方赢', () => {
        const rallies: RallyClip[] = [makeRally(1, 'B')];
        const result = engine.processRallies(rallies);
        expect(result[0].scoreStateAfter.scoreB).toBe(1);
        expect(result[0].scoreStateAfter.scoreA).toBe(0);
    });

    it('末回合有显式 winner → 使用显式值', () => {
        const rallies: RallyClip[] = [makeRally(1, 'B', 'A')];
        const result = engine.processRallies(rallies);
        expect(result[0].scoreStateAfter.scoreA).toBe(1);
        expect(result[0].scoreStateAfter.scoreB).toBe(0);
    });

    // ─── 4. 关键分（Game Point）标记 ─────────────────────────────────────

    it('20分时 isGamePoint 为 true', () => {
        // 构造 A 已得 20 分的场景：20 个 A 保发回合
        const rallies: RallyClip[] = Array.from({ length: 21 }, (_, i) =>
            makeRally(i + 1, 'A')
        );
        const result = engine.processRallies(rallies);
        // 第 21 回合前，A 已有 20 分，isGamePoint 应为 true
        expect(result[20].scoreStateBefore.isGamePoint).toBe(true);
    });

    it('19分时 isGamePoint 为 false', () => {
        const rallies: RallyClip[] = Array.from({ length: 20 }, (_, i) =>
            makeRally(i + 1, 'A')
        );
        const result = engine.processRallies(rallies);
        // 第 20 回合前，A 有 19 分，isGamePoint 应为 false
        expect(result[19].scoreStateBefore.isGamePoint).toBe(false);
    });

    // ─── 5. 中场休息（11分）标记 ─────────────────────────────────────────

    it('某方得第 11 分时，stateAfter.isInterval 为 true', () => {
        const rallies: RallyClip[] = Array.from({ length: 12 }, (_, i) =>
            makeRally(i + 1, 'A')
        );
        const result = engine.processRallies(rallies);
        // 第 11 回合结束后 A 得 11 分，isInterval 应为 true
        expect(result[10].scoreStateAfter.isInterval).toBe(true);
    });

    // ─── 6. 空列表边界 ────────────────────────────────────────────────────

    it('空回合列表返回空数组', () => {
        expect(engine.processRallies([])).toEqual([]);
    });

    // ─── 7. 发球方计算（偶数分右侧，奇数分左侧）────────────────────────

    it('发球方得 0 分时 serviceSide 为 Right', () => {
        const rallies: RallyClip[] = [makeRally(1, 'A'), makeRally(2, 'A')];
        const result = engine.processRallies(rallies);
        expect(result[0].scoreStateBefore.serviceSide).toBe('Right'); // A 有 0 分，偶数 → Right
    });

    it('发球方得 1 分时 serviceSide 为 Left', () => {
        const rallies: RallyClip[] = [
            makeRally(1, 'A'), // A 赢 → A 得 1 分
            makeRally(2, 'A'), // A 发球，此时 A 有 1 分
        ];
        const result = engine.processRallies(rallies);
        expect(result[1].scoreStateBefore.serviceSide).toBe('Left'); // A 有 1 分，奇数 → Left
    });
});
