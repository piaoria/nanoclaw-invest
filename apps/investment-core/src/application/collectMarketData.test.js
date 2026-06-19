import { describe, it, expect, vi } from "vitest";
import { collectMarketData } from "./collectMarketData.js";

const makeProvider = (overrides = {}) => ({
  getSnapshot: async (symbols) =>
    symbols.map((symbol) => ({
      symbol,
      price: 100,
      changeRate: 0.01,
      volume: 1000,
      capturedAt: "2026-06-19T00:00:00.000Z",
    })),
  getDailyCloses: async () => Array.from({ length: 130 }, (_, i) => 100 + i),
  ...overrides,
});

const makeRepo = () => {
  let counter = 0;
  return {
    saveMarketSnapshot: vi.fn(async () => `snap-${++counter}`),
    saveTechnicalIndicators: vi.fn(async () => {}),
  };
};

describe("collectMarketData", () => {
  it("스냅샷과 지표를 저장한다", async () => {
    const repo = makeRepo();
    const r = await collectMarketData({
      provider: makeProvider(),
      repo,
      symbols: ["SPY", "QQQ"],
      source: "test",
    });
    expect(r.saved).toBe(2);
    expect(r.failed).toEqual([]);
    expect(repo.saveMarketSnapshot).toHaveBeenCalledTimes(2);
    expect(repo.saveTechnicalIndicators).toHaveBeenCalledTimes(2);
    // 지표가 ma_120 까지 계산되었는지 (130개 종가 → 충분)
    const indicatorsArg = repo.saveTechnicalIndicators.mock.calls[0][1];
    expect(indicatorsArg.ma_120).not.toBeNull();
  });

  it("빈 심볼은 아무것도 하지 않는다", async () => {
    const repo = makeRepo();
    const r = await collectMarketData({ provider: makeProvider(), repo, symbols: [] });
    expect(r.saved).toBe(0);
    expect(repo.saveMarketSnapshot).not.toHaveBeenCalled();
  });

  it("스냅샷 없는 종목은 failed 로 기록", async () => {
    const provider = makeProvider({ getSnapshot: async () => [] });
    const repo = makeRepo();
    const r = await collectMarketData({ provider, repo, symbols: ["SPY"] });
    expect(r.saved).toBe(0);
    expect(r.failed).toEqual([{ symbol: "SPY", reason: "NO_SNAPSHOT" }]);
  });

  it("지표 실패해도 스냅샷은 저장된다", async () => {
    const provider = makeProvider({
      getDailyCloses: async () => {
        throw new Error("data source down");
      },
    });
    const repo = makeRepo();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const r = await collectMarketData({ provider, repo, symbols: ["SPY"], logger });
    expect(r.saved).toBe(1); // 스냅샷은 저장됨
    expect(repo.saveTechnicalIndicators).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("스냅샷 저장 실패는 failed 로 기록", async () => {
    const repo = makeRepo();
    repo.saveMarketSnapshot = vi.fn(async () => {
      throw new Error("db error");
    });
    const r = await collectMarketData({ provider: makeProvider(), repo, symbols: ["SPY"] });
    expect(r.saved).toBe(0);
    expect(r.failed[0].reason).toBe("db error");
  });
});
