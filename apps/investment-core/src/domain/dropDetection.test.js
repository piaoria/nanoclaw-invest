import { describe, it, expect } from "vitest";
import { detectDrop, findDrops } from "./dropDetection.js";

describe("detectDrop", () => {
  it("전일 대비 급락이면 DAILY_DROP", () => {
    const r = detectDrop({ symbol: "A", price: 97, changeRate: -0.04, highPrice: 100 }, { dailyDropPct: 3 });
    expect(r.triggered).toBe(true);
    expect(r.reasons).toContain("DAILY_DROP");
  });

  it("당일 고가 대비 급락이면 INTRADAY_DROP", () => {
    const r = detectDrop({ symbol: "A", price: 94, changeRate: -0.01, highPrice: 100 }, { intradayDropPct: 5 });
    expect(r.reasons).toContain("INTRADAY_DROP");
    expect(r.intradayDrop).toBeCloseTo(-0.06, 6);
  });

  it("임계치 미만이면 트리거 안 됨", () => {
    const r = detectDrop({ symbol: "A", price: 99, changeRate: -0.01, highPrice: 100 });
    expect(r.triggered).toBe(false);
    expect(r.reasons).toEqual([]);
  });

  it("등락률/고가 없으면 안전하게 무시", () => {
    const r = detectDrop({ symbol: "A", price: 100, changeRate: null, highPrice: null });
    expect(r.triggered).toBe(false);
  });
});

describe("findDrops", () => {
  it("급락 종목만 추린다", () => {
    const snaps = [
      { symbol: "A", price: 97, changeRate: -0.04, highPrice: 100 },
      { symbol: "B", price: 100, changeRate: 0.01, highPrice: 100 },
    ];
    const drops = findDrops(snaps, { dailyDropPct: 3 });
    expect(drops).toHaveLength(1);
    expect(drops[0].symbol).toBe("A");
  });
});
