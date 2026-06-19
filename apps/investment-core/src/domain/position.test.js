import { describe, it, expect } from "vitest";
import { applyBuy, applySell } from "./position.js";

describe("applyBuy", () => {
  it("신규 매수는 평균가가 체결가와 같다", () => {
    const p = applyBuy({ quantity: 0, avgCost: 0 }, { quantity: 10, fillPrice: 100 });
    expect(p).toEqual({ quantity: 10, avgCost: 100 });
  });

  it("추가 매수는 가중평균으로 평균가를 갱신한다", () => {
    const p = applyBuy({ quantity: 10, avgCost: 100 }, { quantity: 10, fillPrice: 120 });
    expect(p.quantity).toBe(20);
    expect(p.avgCost).toBeCloseTo(110, 6);
  });
});

describe("applySell", () => {
  it("일부 매도 시 평균가는 유지되고 실현손익이 계산된다", () => {
    const r = applySell({ quantity: 10, avgCost: 100 }, { quantity: 4, fillPrice: 130 });
    expect(r.position).toEqual({ quantity: 6, avgCost: 100 });
    expect(r.realizedPnl).toBeCloseTo((130 - 100) * 4, 6);
  });

  it("전량 매도 시 포지션이 비워진다", () => {
    const r = applySell({ quantity: 10, avgCost: 100 }, { quantity: 10, fillPrice: 90 });
    expect(r.position).toEqual({ quantity: 0, avgCost: 0 });
    expect(r.realizedPnl).toBeCloseTo((90 - 100) * 10, 6);
  });
});
