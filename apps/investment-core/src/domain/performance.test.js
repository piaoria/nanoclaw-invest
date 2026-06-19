import { describe, it, expect } from "vitest";
import { valuePortfolio, cumulativeReturn, dailyReturn, maxDrawdown } from "./performance.js";

describe("valuePortfolio", () => {
  it("총 평가액과 미실현 손익을 계산한다", () => {
    const r = valuePortfolio({
      cash: 1000,
      positions: [{ symbol: "SPY", quantity: 10, avgCost: 100 }],
      prices: new Map([["SPY", 120]]),
    });
    expect(r.holdingsValue).toBe(1200);
    expect(r.totalValue).toBe(2200);
    expect(r.unrealizedPnl).toBe(200);
  });
});

describe("수익률", () => {
  it("누적/일간 수익률", () => {
    expect(cumulativeReturn(110, 100)).toBeCloseTo(0.1, 6);
    expect(dailyReturn(102, 100)).toBeCloseTo(0.02, 6);
    expect(cumulativeReturn(100, 0)).toBe(0);
  });
});

describe("maxDrawdown", () => {
  it("고점 대비 최대 낙폭을 음수로 반환", () => {
    expect(maxDrawdown([100, 120, 90, 130])).toBeCloseTo(-0.25, 6); // 120 -> 90
    expect(maxDrawdown([100, 110, 120])).toBe(0);
  });
});
