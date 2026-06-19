import { describe, it, expect, vi } from "vitest";
import { monitorTick } from "./monitorTick.js";

const baseDeps = (snapshots) => ({
  symbols: ["005930", "SPY"],
  marketProvider: { getSnapshot: async () => snapshots },
  alertRepo: { saveAlert: vi.fn(async () => "alert-1") },
  notify: vi.fn(async () => true),
  thresholds: { dailyDropPct: 3, intradayDropPct: 5 },
  cooldownMs: 1000,
  state: { lastAlert: new Map() },
});

describe("monitorTick", () => {
  it("급락 종목에 알림을 보내고 저장한다", async () => {
    const deps = baseDeps([
      { symbol: "005930", price: 96, changeRate: -0.04, highPrice: 100 },
      { symbol: "SPY", price: 500, changeRate: 0.0, highPrice: 500 },
    ]);
    const r = await monitorTick(deps);
    expect(r.alerted).toBe(1);
    expect(deps.notify).toHaveBeenCalledOnce();
    expect(deps.alertRepo.saveAlert).toHaveBeenCalledOnce();
    expect(deps.notify.mock.calls[0][0]).toContain("005930");
  });

  it("쿨다운 내 같은 종목은 재알림하지 않는다", async () => {
    const deps = baseDeps([{ symbol: "005930", price: 96, changeRate: -0.04, highPrice: 100 }]);
    await monitorTick(deps);
    deps.marketProvider.getSnapshot = async () => [
      { symbol: "005930", price: 95, changeRate: -0.05, highPrice: 100 },
    ];
    const r2 = await monitorTick(deps);
    expect(r2.alerted).toBe(0); // 쿨다운으로 스킵
  });

  it("급락 없으면 알림 0", async () => {
    const deps = baseDeps([{ symbol: "SPY", price: 500, changeRate: 0.01, highPrice: 500 }]);
    const r = await monitorTick(deps);
    expect(r.alerted).toBe(0);
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it("자동매매 ON 이면 사이클을 발동한다", async () => {
    const deps = baseDeps([{ symbol: "005930", price: 96, changeRate: -0.04, highPrice: 100 }]);
    const runCycleSpy = vi.fn(async () => ({ status: "EXECUTED" }));
    // runDailyCycle 은 cycleDeps 를 받아 동작 — 여기선 marketProvider 등 mock 으로 충분치 않으니
    // autoTrade 경로만 검증: portfolioRepo.loadPortfolioState 가 호출되는지로 간접 확인
    deps.autoTrade = {
      portfolioIds: ["p1"],
      cycleDeps: {
        portfolioRepo: {
          loadPortfolioState: vi.fn(async () => ({ strategyId: "s1", cash: 100, initialCapital: 100, positions: new Map() })),
          loadStrategyConfig: vi.fn(async () => ({ allowedSymbols: new Set(), maxWeights: new Map() })),
          getRecentDecisions: vi.fn(async () => []),
          persistPortfolioState: vi.fn(async () => {}),
        },
        marketRepo: { saveMarketSnapshot: vi.fn(), saveTechnicalIndicators: vi.fn() },
        tradingRepo: {},
        marketProvider: { getSnapshot: async () => [], getDailyCloses: async () => [] },
        investorProvider: { decide: async () => ({ raw: "{}", modelVersion: "m", temperature: 0 }) },
        config: { slippageBps: 5, feeBps: 1 },
      },
    };
    const r = await monitorTick(deps);
    expect(r.alerted).toBe(1);
    // 빈 allowedSymbols → 수집 0 → NO_MARKET_DATA 로 끝나지만 사이클 진입은 함
    expect(deps.autoTrade.cycleDeps.portfolioRepo.loadPortfolioState).toHaveBeenCalledWith("p1");
    expect(deps.alertRepo.saveAlert.mock.calls[0][0].triggeredCycle).toBe(true);
  });
});
