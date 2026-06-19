import { describe, it, expect } from "vitest";
import { validateOrder } from "./validation.js";

const base = () => ({
  price: 100,
  cash: 10000,
  positions: new Map(),
  totalValue: 10000,
  maxWeights: new Map([["SPY", 0.6]]),
  allowedSymbols: new Set(["SPY", "QQQ"]),
});

describe("validateOrder", () => {
  it("허용되지 않은 종목 거부", () => {
    const r = validateOrder({ ...base(), order: { symbol: "TSLA", side: "BUY", quantity: 1 } });
    expect(r).toEqual({ ok: false, reason: "SYMBOL_NOT_ALLOWED" });
  });

  it("현금 부족 매수 거부", () => {
    const r = validateOrder({ ...base(), cash: 50, order: { symbol: "SPY", side: "BUY", quantity: 10 } });
    expect(r).toEqual({ ok: false, reason: "INSUFFICIENT_CASH" });
  });

  it("최대 비중 초과 매수 거부", () => {
    // 100 * 70 = 7000, 총평가 10000 → 70% > 60%
    const r = validateOrder({ ...base(), order: { symbol: "SPY", side: "BUY", quantity: 70 } });
    expect(r).toEqual({ ok: false, reason: "MAX_WEIGHT_EXCEEDED" });
  });

  it("비중 한도 내 매수 허용", () => {
    const r = validateOrder({ ...base(), order: { symbol: "SPY", side: "BUY", quantity: 50 } });
    expect(r).toEqual({ ok: true });
  });

  it("보유 수량 초과 매도 거부", () => {
    const positions = new Map([["SPY", { quantity: 3, avgCost: 100 }]]);
    const r = validateOrder({ ...base(), positions, order: { symbol: "SPY", side: "SELL", quantity: 5 } });
    expect(r).toEqual({ ok: false, reason: "INSUFFICIENT_POSITION" });
  });

  it("중복 스냅샷 거부", () => {
    const r = validateOrder({
      ...base(),
      order: { symbol: "SPY", side: "BUY", quantity: 1 },
      executedSnapshotKeys: new Set(["p1:s1"]),
      snapshotKey: "p1:s1",
    });
    expect(r).toEqual({ ok: false, reason: "DUPLICATE_SNAPSHOT" });
  });
});
