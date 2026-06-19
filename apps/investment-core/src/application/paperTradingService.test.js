import { describe, it, expect } from "vitest";
import { processDecision } from "./paperTradingService.js";

const makePortfolio = () => ({
  cash: 100000,
  positions: new Map(),
  realizedPnl: 0,
  initialCapital: 100000,
});

const config = {
  slippageBps: 5,
  feeBps: 1,
  allowedSymbols: new Set(["SPY", "QQQ"]),
  maxWeights: new Map([["SPY", 0.6], ["QQQ", 0.6]]),
};

describe("processDecision", () => {
  it("BUY 판단을 체결하고 현금·포지션을 갱신한다", () => {
    const portfolio = makePortfolio();
    const r = processDecision({
      portfolio,
      decision: { action: "BUY", orders: [{ symbol: "SPY", side: "BUY", quantity: 100 }] },
      prices: new Map([["SPY", 100]]),
      config,
    });
    expect(r.status).toBe("EXECUTED");
    expect(portfolio.cash).toBeLessThan(100000);
    expect(portfolio.positions.get("SPY").quantity).toBe(100);
  });

  it("HOLD 는 체결 없이 종료", () => {
    const portfolio = makePortfolio();
    const r = processDecision({
      portfolio,
      decision: { action: "HOLD", orders: [] },
      prices: new Map(),
      config,
    });
    expect(r.status).toBe("HOLD");
    expect(portfolio.cash).toBe(100000);
  });

  it("동일 스냅샷은 중복 처리하지 않는다", () => {
    const portfolio = makePortfolio();
    const executed = new Set();
    const args = {
      portfolio,
      decision: { action: "BUY", orders: [{ symbol: "SPY", side: "BUY", quantity: 10 }] },
      prices: new Map([["SPY", 100]]),
      config,
      snapshotKey: "p1:s1",
      executedSnapshotKeys: executed,
    };
    const first = processDecision(args);
    const second = processDecision(args);
    expect(first.status).toBe("EXECUTED");
    expect(second.status).toBe("SKIPPED");
    expect(second.reason).toBe("DUPLICATE_SNAPSHOT");
  });

  it("검증 실패 주문은 건너뛰고 사유를 남긴다", () => {
    const portfolio = makePortfolio();
    const r = processDecision({
      portfolio,
      decision: {
        action: "BUY",
        orders: [
          { symbol: "TSLA", side: "BUY", quantity: 1 }, // 허용 안 됨
          { symbol: "SPY", side: "BUY", quantity: 100 }, // 정상
        ],
      },
      prices: new Map([["SPY", 100], ["TSLA", 200]]),
      config,
    });
    expect(r.status).toBe("EXECUTED");
    expect(r.fills).toHaveLength(1);
    expect(r.rejections[0].reason).toBe("SYMBOL_NOT_ALLOWED");
  });

  it("매수 후 매도로 실현손익을 누적한다", () => {
    const portfolio = makePortfolio();
    processDecision({
      portfolio,
      decision: { action: "BUY", orders: [{ symbol: "SPY", side: "BUY", quantity: 100 }] },
      prices: new Map([["SPY", 100]]),
      config,
    });
    processDecision({
      portfolio,
      decision: { action: "SELL", orders: [{ symbol: "SPY", side: "SELL", quantity: 100 }] },
      prices: new Map([["SPY", 120]]),
      config,
    });
    expect(portfolio.positions.has("SPY")).toBe(false);
    expect(portfolio.realizedPnl).toBeGreaterThan(0);
  });
});
