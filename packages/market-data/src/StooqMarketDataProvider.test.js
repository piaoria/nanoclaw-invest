import { describe, it, expect } from "vitest";
import { StooqMarketDataProvider, parseStooqCsv } from "./StooqMarketDataProvider.js";

const CSV = `Date,Open,High,Low,Close,Volume
2026-06-15,100,101,99,100.5,1000
2026-06-16,100.5,103,100,102.0,1500
2026-06-17,102,104,101,103.5,2000`;

const makeFetch = (text, ok = true, status = 200) => async () => ({
  ok,
  status,
  text: async () => text,
});

describe("parseStooqCsv", () => {
  it("CSV 를 행으로 파싱한다", () => {
    const rows = parseStooqCsv(CSV);
    expect(rows).toHaveLength(3);
    expect(rows[2]).toEqual({ date: "2026-06-17", close: 103.5, volume: 2000 });
  });
  it("데이터 없으면 빈 배열", () => {
    expect(parseStooqCsv("No data")).toEqual([]);
  });
});

describe("StooqMarketDataProvider", () => {
  it("티커를 Stooq 심볼로 변환한다", () => {
    const p = new StooqMarketDataProvider({ fetchImpl: makeFetch(CSV) });
    expect(p.toStooqSymbol("SPY")).toBe("spy.us");
    expect(p.toStooqSymbol("TQQQ")).toBe("tqqq.us");
    expect(p.toStooqSymbol("^SPX")).toBe("^spx");
  });

  it("종가 시계열을 반환한다", async () => {
    const p = new StooqMarketDataProvider({ fetchImpl: makeFetch(CSV) });
    expect(await p.getDailyCloses("SPY")).toEqual([100.5, 102.0, 103.5]);
  });

  it("스냅샷의 등락률을 직전 종가 대비로 계산한다", async () => {
    const p = new StooqMarketDataProvider({ fetchImpl: makeFetch(CSV) });
    const [snap] = await p.getSnapshot(["SPY"]);
    expect(snap.price).toBe(103.5);
    expect(snap.changeRate).toBeCloseTo(103.5 / 102.0 - 1, 6);
  });

  it("HTTP 오류는 예외", async () => {
    const p = new StooqMarketDataProvider({ fetchImpl: makeFetch("", false, 503) });
    await expect(p.getDailyCloses("SPY")).rejects.toThrow(/503/);
  });
});
