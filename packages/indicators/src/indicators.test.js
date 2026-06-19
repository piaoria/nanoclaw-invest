import { describe, it, expect } from "vitest";
import {
  movingAverage,
  periodReturn,
  rsi,
  volatility,
  drawdownFromHigh,
  computeIndicators,
} from "./indicators.js";

describe("movingAverage", () => {
  it("최근 window 평균", () => {
    expect(movingAverage([1, 2, 3, 4, 5], 3)).toBeCloseTo(4, 6); // (3+4+5)/3
  });
  it("데이터 부족 시 null", () => {
    expect(movingAverage([1, 2], 3)).toBeNull();
  });
});

describe("periodReturn", () => {
  it("기간 수익률", () => {
    expect(periodReturn([100, 110], 1)).toBeCloseTo(0.1, 6);
  });
  it("부족 시 null", () => {
    expect(periodReturn([100], 1)).toBeNull();
  });
});

describe("rsi", () => {
  it("상승만 있으면 100에 수렴", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(closes, 14)).toBe(100);
  });
  it("부족 시 null", () => {
    expect(rsi([1, 2, 3], 14)).toBeNull();
  });
});

describe("volatility", () => {
  it("변동 없으면 0", () => {
    const closes = Array(25).fill(100);
    expect(volatility(closes, 20)).toBeCloseTo(0, 6);
  });
});

describe("drawdownFromHigh", () => {
  it("고점 대비 낙폭", () => {
    expect(drawdownFromHigh([100, 120, 90])).toBeCloseTo(90 / 120 - 1, 6);
  });
  it("빈 배열 0", () => {
    expect(drawdownFromHigh([])).toBe(0);
  });
});

describe("computeIndicators", () => {
  it("부족한 데이터는 null 로 채운다", () => {
    const r = computeIndicators([100, 101, 102]);
    expect(r.ma_20).toBeNull();
    expect(r.drawdown_from_high).toBeLessThanOrEqual(0);
  });
});
