import { describe, it, expect, vi } from "vitest";
import { runInvestmentDecision } from "./runInvestmentDecision.js";

const makePortfolio = () => ({
  cash: 100000,
  initialCapital: 100000,
  positions: new Map(),
});

const config = {
  slippageBps: 5,
  feeBps: 1,
  allowedSymbols: new Set(["SPY"]),
  maxWeights: new Map([["SPY", 0.6]]),
};

const makeRepo = () => {
  let n = 0;
  return {
    saveLlmRequest: vi.fn(async () => `req-${++n}`),
    saveDecision: vi.fn(async () => `dec-${++n}`),
    saveOrder: vi.fn(async () => `ord-${++n}`),
    saveFill: vi.fn(async () => {}),
  };
};

const baseDeps = (raw) => ({
  provider: { decide: async () => ({ raw, modelVersion: "gemini-2.0-flash", temperature: 0.2 }) },
  repo: makeRepo(),
  portfolio: makePortfolio(),
  market: [{ symbol: "SPY", price: 100, changeRate: 0.01, indicators: {} }],
  prices: new Map([["SPY", 100]]),
  config,
  portfolioId: "p1",
  snapshotId: "s1",
});

describe("runInvestmentDecision", () => {
  it("정상 BUY 판단을 체결하고 전부 저장한다", async () => {
    const deps = baseDeps(
      JSON.stringify({
        action: "BUY",
        orders: [{ symbol: "SPY", side: "BUY", quantity: 100 }],
        confidence: 0.7,
      }),
    );
    const r = await runInvestmentDecision(deps);

    expect(r.status).toBe("EXECUTED");
    expect(deps.repo.saveLlmRequest).toHaveBeenCalledOnce();
    expect(deps.repo.saveDecision).toHaveBeenCalledOnce();
    expect(deps.repo.saveOrder).toHaveBeenCalledOnce();
    expect(deps.repo.saveFill).toHaveBeenCalledOnce();
    expect(deps.portfolio.positions.get("SPY").quantity).toBe(100);
    // llm_request 는 OK 상태로 기록
    expect(deps.repo.saveLlmRequest.mock.calls[0][0].status).toBe("OK");
  });

  it("HOLD 는 주문 없이 decision 만 저장", async () => {
    const deps = baseDeps(JSON.stringify({ action: "HOLD", confidence: 0.4 }));
    const r = await runInvestmentDecision(deps);
    expect(r.status).toBe("HOLD");
    expect(deps.repo.saveOrder).not.toHaveBeenCalled();
  });

  it("잘못된 JSON 은 FAILED 로 기록하고 주문하지 않는다", async () => {
    const deps = baseDeps("not json at all");
    const r = await runInvestmentDecision(deps);
    expect(r.status).toBe("FAILED");
    expect(r.reason).toBe("PARSE_FAIL");
    expect(deps.repo.saveLlmRequest.mock.calls[0][0].status).toBe("PARSE_FAIL");
    expect(deps.repo.saveOrder).not.toHaveBeenCalled();
    // FAILED decision 은 기록됨
    expect(deps.repo.saveDecision).toHaveBeenCalledOnce();
    expect(deps.portfolio.cash).toBe(100000); // 현금 변화 없음
  });

  it("스키마 위반은 SCHEMA_FAIL", async () => {
    const deps = baseDeps(JSON.stringify({ action: "GAMBLE", confidence: 5 }));
    const r = await runInvestmentDecision(deps);
    expect(r.reason).toBe("SCHEMA_FAIL");
    expect(deps.repo.saveOrder).not.toHaveBeenCalled();
  });

  it("허용되지 않은 종목 주문은 체결되지 않는다", async () => {
    const deps = baseDeps(
      JSON.stringify({
        action: "BUY",
        orders: [{ symbol: "TSLA", side: "BUY", quantity: 1 }],
        confidence: 0.9,
      }),
    );
    deps.prices.set("TSLA", 200); // 가격은 있으나 허용 종목이 아님
    const r = await runInvestmentDecision(deps);
    // 체결 0건 → FAILED, 주문 저장 없음
    expect(deps.repo.saveOrder).not.toHaveBeenCalled();
    expect(r.rejections[0].reason).toBe("SYMBOL_NOT_ALLOWED");
  });
});
