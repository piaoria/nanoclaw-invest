import { describe, it, expect } from "vitest";
import { YahooMarketDataProvider } from "./YahooMarketDataProvider.js";

const mockClient = {
  quote: async (symbol) => ({
    regularMarketPrice: 100,
    regularMarketChangePercent: 1.5, // %
    regularMarketVolume: 1000,
  }),
  historical: async () => [
    { close: 98 },
    { close: 99 },
    { close: null }, // 결측은 걸러져야 함
    { close: 100 },
  ],
};

describe("YahooMarketDataProvider", () => {
  it("스냅샷을 정규화한다 (등락률은 소수로)", async () => {
    const p = new YahooMarketDataProvider({ client: mockClient });
    const [snap] = await p.getSnapshot(["SPY"]);
    expect(snap.symbol).toBe("SPY");
    expect(snap.price).toBe(100);
    expect(snap.changeRate).toBeCloseTo(0.015, 6);
    expect(snap.volume).toBe(1000);
    expect(typeof snap.capturedAt).toBe("string");
  });

  it("빈 입력은 빈 배열", async () => {
    const p = new YahooMarketDataProvider({ client: mockClient });
    expect(await p.getSnapshot([])).toEqual([]);
  });

  it("일봉 종가에서 결측을 제거한다", async () => {
    const p = new YahooMarketDataProvider({ client: mockClient });
    const closes = await p.getDailyCloses("SPY");
    expect(closes).toEqual([98, 99, 100]);
  });
});
