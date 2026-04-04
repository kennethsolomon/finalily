import { describe, it, expect } from "vitest";
import { sm2, ratingToQuality } from "@/lib/sm2";

describe("ratingToQuality", () => {
  it("maps again to 1", () => {
    expect(ratingToQuality("again")).toBe(1);
  });

  it("maps hard to 3", () => {
    expect(ratingToQuality("hard")).toBe(3);
  });

  it("maps good to 4", () => {
    expect(ratingToQuality("good")).toBe(4);
  });

  it("maps easy to 5", () => {
    expect(ratingToQuality("easy")).toBe(5);
  });
});

describe("sm2", () => {
  describe("failure (quality < 3)", () => {
    it("resets repetitions to 0 and interval to 1", () => {
      const result = sm2({ quality: 1, easeFactor: 2.5, intervalDays: 10, repetitions: 5 });
      expect(result.repetitions).toBe(0);
      expect(result.intervalDays).toBe(1);
    });

    it("decreases ease factor by 0.2", () => {
      const result = sm2({ quality: 1, easeFactor: 2.5, intervalDays: 10, repetitions: 5 });
      expect(result.easeFactor).toBe(2.3);
    });

    it("enforces minimum ease factor of 1.3", () => {
      const result = sm2({ quality: 0, easeFactor: 1.3, intervalDays: 1, repetitions: 0 });
      expect(result.easeFactor).toBe(1.3);
    });

    it("clamps ease factor at 1.3 when it would go below", () => {
      const result = sm2({ quality: 2, easeFactor: 1.4, intervalDays: 1, repetitions: 0 });
      expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
    });
  });

  describe("success (quality >= 3)", () => {
    it("increments repetitions", () => {
      const result = sm2({ quality: 4, easeFactor: 2.5, intervalDays: 0, repetitions: 0 });
      expect(result.repetitions).toBe(1);
    });

    it("sets interval to 1 on first repetition", () => {
      const result = sm2({ quality: 4, easeFactor: 2.5, intervalDays: 0, repetitions: 0 });
      expect(result.intervalDays).toBe(1);
    });

    it("sets interval to 6 on second repetition", () => {
      const result = sm2({ quality: 4, easeFactor: 2.5, intervalDays: 1, repetitions: 1 });
      expect(result.intervalDays).toBe(6);
    });

    it("calculates interval as round(prevInterval * ease) on 3rd+ repetition", () => {
      const result = sm2({ quality: 4, easeFactor: 2.5, intervalDays: 6, repetitions: 2 });
      expect(result.intervalDays).toBe(15); // round(6 * 2.5)
    });

    it("ease factor unchanged for quality=4 with default ease", () => {
      const result = sm2({ quality: 4, easeFactor: 2.5, intervalDays: 0, repetitions: 0 });
      expect(result.easeFactor).toBe(2.5);
    });

    it("increases ease factor for quality=5", () => {
      const result = sm2({ quality: 5, easeFactor: 2.5, intervalDays: 0, repetitions: 0 });
      expect(result.easeFactor).toBe(2.6);
    });

    it("decreases ease factor for quality=3", () => {
      const result = sm2({ quality: 3, easeFactor: 2.5, intervalDays: 0, repetitions: 0 });
      expect(result.easeFactor).toBe(2.36);
    });
  });

  describe("nextReviewAt", () => {
    it("returns a Date in the future", () => {
      const before = new Date();
      const result = sm2({ quality: 4, easeFactor: 2.5, intervalDays: 0, repetitions: 0 });
      expect(result.nextReviewAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it("adds intervalDays to today", () => {
      const result = sm2({ quality: 4, easeFactor: 2.5, intervalDays: 1, repetitions: 1 });
      const expected = new Date();
      expected.setDate(expected.getDate() + 6);
      // Compare dates ignoring time (within same day)
      expect(result.nextReviewAt.toDateString()).toBe(expected.toDateString());
    });
  });

  describe("edge cases", () => {
    it("handles first ever review with default values", () => {
      const result = sm2({ quality: 4, easeFactor: 2.5, intervalDays: 0, repetitions: 0 });
      expect(result.repetitions).toBe(1);
      expect(result.intervalDays).toBe(1);
      expect(result.easeFactor).toBe(2.5);
    });

    it("handles repeated failures", () => {
      let state = { quality: 1, easeFactor: 2.5, intervalDays: 10, repetitions: 5 };
      for (let i = 0; i < 5; i++) {
        const result = sm2(state);
        state = { quality: 1, easeFactor: result.easeFactor, intervalDays: result.intervalDays, repetitions: result.repetitions };
      }
      expect(state.easeFactor).toBe(1.5); // 2.5 - 5 * 0.2 = 1.5
      expect(state.repetitions).toBe(0);
      expect(state.intervalDays).toBe(1);
    });

    it("handles recovery after failure", () => {
      // Fail then succeed
      const failed = sm2({ quality: 1, easeFactor: 2.5, intervalDays: 10, repetitions: 5 });
      expect(failed.repetitions).toBe(0);
      const recovered = sm2({ quality: 4, easeFactor: failed.easeFactor, intervalDays: failed.intervalDays, repetitions: failed.repetitions });
      expect(recovered.repetitions).toBe(1);
      expect(recovered.intervalDays).toBe(1);
    });
  });
});
