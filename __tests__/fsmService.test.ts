import { describe, it, expect, beforeEach } from 'vitest';
import { RallyFSM } from '../services/fsmService';
import { FrameFeature } from '../types';

/**
 * P4-02：FSM 状态机单元测试
 *
 * 覆盖场景：
 * 1. 正常回合：音频击球触发 → 超时结束
 * 2. 视觉确认回合：shuttle_held 触发 → 降低击球门槛
 * 3. 落地立即结束：shuttle_ground 信号
 * 4. 误检过滤：击球数不足 MIN_HITS_FOR_RALLY
 * 5. SERVE_PREP 超时回退：8秒无击球 → 回到 IDLE
 * 6. 热身跳过：WARMUP_SKIP_SECONDS 内的信号不触发回合
 * 7. 自动分析不生成随机 winner（P0-01 修复验证）
 */

/** 构造帧序列的辅助函数 */
function makeFrame(t: number, overrides: Partial<FrameFeature> = {}): FrameFeature {
    return {
        t,
        motion_score: 0.1,
        hit_audio: false,
        hit_visual: false,
        shuttle_held: false,
        shuttle_ground: false,
        ...overrides,
    };
}

/** 生成一段连续的击球帧序列（每次击球之间插入 3 帧静默，避免 debounce 过滤）*/
function makeHitSequence(startT: number, count: number): FrameFeature[] {
    const frames: FrameFeature[] = [];
    for (let i = 0; i < count; i++) {
        const hitT = startT + i * 0.5;
        // 击球帧
        frames.push(makeFrame(hitT, { hit_audio: true }));
        // 3 帧静默（确保 debounce 不过滤下一次击球）
        frames.push(makeFrame(hitT + 0.1));
        frames.push(makeFrame(hitT + 0.2));
        frames.push(makeFrame(hitT + 0.3));
    }
    return frames;
}

/** 生成一段静默帧序列（无信号） */
function makeSilence(startT: number, durationSeconds: number, step = 0.1): FrameFeature[] {
    const count = Math.round(durationSeconds / step);
    return Array.from({ length: count }, (_, i) => makeFrame(startT + i * step));
}

describe('RallyFSM', () => {
    let fsm: RallyFSM;

    beforeEach(() => {
        fsm = new RallyFSM();
    });

    // ─── 1. 正常回合：音频击球触发 ────────────────────────────────────────

    it('正常回合：足够击球数 → 识别为一个回合', () => {
        const frames: FrameFeature[] = [
            ...makeSilence(0, 3),                    // 热身期
            ...makeHitSequence(4, 6),                // 6 次击球（>= MIN_HITS_FOR_RALLY=4）
            ...makeSilence(7, 3),                    // 超时结束
        ];
        const rallies = fsm.processSignals(frames);
        expect(rallies.length).toBe(1);
        expect(rallies[0].hits).toBeGreaterThanOrEqual(4);
    });

    it('击球数不足 → 不识别为回合（误检过滤）', () => {
        const frames: FrameFeature[] = [
            ...makeSilence(0, 3),
            ...makeHitSequence(4, 2),                // 只有 2 次击球（< MIN_HITS_FOR_RALLY=4）
            ...makeSilence(6, 3),
        ];
        const rallies = fsm.processSignals(frames);
        expect(rallies.length).toBe(0);
    });

    // ─── 2. 视觉确认回合：降低击球门槛 ──────────────────────────────────

    it('shuttle_held 触发 SERVE_PREP → 视觉确认回合只需 2 次击球', () => {
        const frames: FrameFeature[] = [
            ...makeSilence(0, 3),
            makeFrame(3.5, { shuttle_held: true }),  // 持球准备
            ...makeHitSequence(4, 2),                // 只有 2 次击球（视觉确认门槛 = 2）
            ...makeSilence(5, 3),
        ];
        const rallies = fsm.processSignals(frames);
        expect(rallies.length).toBe(1);
    });

    // ─── 3. 落地立即结束 ──────────────────────────────────────────────────

    it('shuttle_ground 信号 → 立即结束当前回合', () => {
        const frames: FrameFeature[] = [
            ...makeSilence(0, 3),
            ...makeHitSequence(4, 5),                // 5 次击球
            makeFrame(6.5, { shuttle_ground: true }), // 落地
            ...makeSilence(7, 2),
        ];
        const rallies = fsm.processSignals(frames);
        expect(rallies.length).toBe(1);
        // 回合结束时间应接近落地时间
        expect(rallies[0].end).toBeCloseTo(6.5, 1);
    });

    // ─── 4. SERVE_PREP 超时回退 ───────────────────────────────────────────

    it('SERVE_PREP 超过 8 秒无击球 → 回退到 IDLE，不生成回合', () => {
        const frames: FrameFeature[] = [
            ...makeSilence(0, 3),
            makeFrame(3.5, { shuttle_held: true }),  // 进入 SERVE_PREP
            ...makeSilence(4, 10),                   // 10 秒无击球（> 8s 超时）
        ];
        const rallies = fsm.processSignals(frames);
        expect(rallies.length).toBe(0);
    });

    // ─── 5. 热身跳过 ──────────────────────────────────────────────────────

    it('热身期（前 3 秒）内的击球信号不触发回合', () => {
        const frames: FrameFeature[] = [
            ...makeHitSequence(0.5, 6),              // 热身期内的击球
            ...makeSilence(3, 3),
        ];
        const rallies = fsm.processSignals(frames);
        expect(rallies.length).toBe(0);
    });

    // ─── 6. P0-01 修复验证：自动分析不生成 winner ─────────────────────────

    it('自动分析生成的回合 winner 字段为 undefined（P0-01 修复）', () => {
        const frames: FrameFeature[] = [
            ...makeSilence(0, 3),
            ...makeHitSequence(4, 6),
            ...makeSilence(7, 3),
        ];
        const rallies = fsm.processSignals(frames);
        expect(rallies.length).toBeGreaterThan(0);
        rallies.forEach(r => {
            expect(r.winner).toBeUndefined();
        });
    });

    // ─── 7. 多回合连续识别 ────────────────────────────────────────────────

    it('两段独立击球序列 → 识别为两个回合', () => {
        const frames: FrameFeature[] = [
            ...makeSilence(0, 3),
            ...makeHitSequence(4, 5),                // 第一回合
            ...makeSilence(6.5, 4),                  // 间隔
            ...makeHitSequence(11, 5),               // 第二回合
            ...makeSilence(13.5, 3),
        ];
        const rallies = fsm.processSignals(frames);
        expect(rallies.length).toBe(2);
        expect(rallies[0].id).toBe(1);
        expect(rallies[1].id).toBe(2);
    });

    // ─── 8. 回合 ID 连续递增 ──────────────────────────────────────────────

    it('回合 ID 从 1 开始连续递增', () => {
        const frames: FrameFeature[] = [
            ...makeSilence(0, 3),
            ...makeHitSequence(4, 5),
            ...makeSilence(6.5, 4),
            ...makeHitSequence(11, 5),
            ...makeSilence(13.5, 3),
        ];
        const rallies = fsm.processSignals(frames);
        rallies.forEach((r, i) => {
            expect(r.id).toBe(i + 1);
        });
    });
});
