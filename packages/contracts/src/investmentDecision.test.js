import { describe, it, expect } from "vitest";
import { parseInvestmentDecision } from "./investmentDecision.js";

describe("parseInvestmentDecision", () => {
  it("유효한 판단을 통과시킨다", () => {
    const res = parseInvestmentDecision({
      action: "BUY",
      orders: [{ symbol: "SPY", side: "BUY", targetWeight: 0.5 }],
      confidence: 0.7,
      rationale: ["상승 추세"],
      riskFlags: [],
      invalidationConditions: [],
      portfolioComment: "",
    });
    expect(res.ok).toBe(true);
  });

  it("잘못된 JSON 문자열은 PARSE_FAIL", () => {
    const res = parseInvestmentDecision("{not json");
    expect(res).toEqual({ ok: false, error: "PARSE_FAIL" });
  });

  it("스키마 위반은 SCHEMA_FAIL", () => {
    const res = parseInvestmentDecision({ action: "GAMBLE", confidence: 2 });
    expect(res).toEqual({ ok: false, error: "SCHEMA_FAIL" });
  });

  it("기본값을 채운다", () => {
    const res = parseInvestmentDecision({ action: "HOLD", confidence: 0.1 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.orders).toEqual([]);
      expect(res.data.rationale).toEqual([]);
    }
  });
});
