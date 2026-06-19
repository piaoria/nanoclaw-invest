import { describe, it, expect } from "vitest";
import { simulateFill } from "./fillEngine.js";

describe("simulateFill", () => {
  it("매수는 슬리피지만큼 비싸게 체결되고 현금이 감소한다", () => {
    const r = simulateFill({ side: "BUY", price: 100, quantity: 10, slippageBps: 5, feeBps: 1 });
    expect(r.fillPrice).toBeCloseTo(100.05, 6); // +0.05%
    expect(r.notional).toBeCloseTo(1000.5, 6);
    expect(r.fee).toBeCloseTo(1000.5 * 0.0001, 6);
    expect(r.cashDelta).toBeLessThan(0);
    expect(r.cashDelta).toBeCloseTo(-(r.notional + r.fee), 6);
    expect(r.fillRule).toBe("IMMEDIATE_PRICE_PLUS_SLIPPAGE");
  });

  it("매도는 슬리피지만큼 싸게 체결되고 현금이 증가한다", () => {
    const r = simulateFill({ side: "SELL", price: 100, quantity: 10, slippageBps: 5, feeBps: 1 });
    expect(r.fillPrice).toBeCloseTo(99.95, 6);
    expect(r.cashDelta).toBeGreaterThan(0);
    expect(r.cashDelta).toBeCloseTo(r.notional - r.fee, 6);
  });

  it("잘못된 입력은 예외", () => {
    expect(() => simulateFill({ side: "BUY", price: 0, quantity: 1 })).toThrow();
    expect(() => simulateFill({ side: "BUY", price: 1, quantity: 0 })).toThrow();
  });
});
