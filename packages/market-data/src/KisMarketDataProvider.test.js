import { describe, it, expect, vi } from "vitest";
import { KisMarketDataProvider } from "./KisMarketDataProvider.js";

const jsonRes = (body) => ({ ok: true, status: 200, json: async () => body });

describe("KisMarketDataProvider", () => {
  it("국내/미국 종목을 구분한다", () => {
    const p = new KisMarketDataProvider({ appKey: "k", appSecret: "s" });
    expect(p.isDomestic("005930")).toBe(true);
    expect(p.isDomestic("SPY")).toBe(false);
  });

  it("토큰을 발급하고 캐싱한다", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ access_token: "tok", expires_in: 86400 }));
    const p = new KisMarketDataProvider({ appKey: "k", appSecret: "s", fetchImpl });
    const t1 = await p.getToken();
    const t2 = await p.getToken();
    expect(t1).toBe("tok");
    expect(t2).toBe("tok");
    expect(fetchImpl).toHaveBeenCalledOnce(); // 캐싱되어 1회만
  });

  it("국내 현재가를 정규화한다 (등락률 소수, 고가 포함)", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes("tokenP")) return jsonRes({ access_token: "tok", expires_in: 86400 });
      return jsonRes({ output: { stck_prpr: "70000", prdy_ctrt: "-4.5", acml_vol: "1000", stck_hgpr: "73000" } });
    });
    const p = new KisMarketDataProvider({ appKey: "k", appSecret: "s", fetchImpl });
    const [snap] = await p.getSnapshot(["005930"]);
    expect(snap.price).toBe(70000);
    expect(snap.changeRate).toBeCloseTo(-0.045, 6);
    expect(snap.highPrice).toBe(73000);
  });

  it("미국 현재가를 조회한다", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes("tokenP")) return jsonRes({ access_token: "tok", expires_in: 86400 });
      return jsonRes({ output: { last: "500.5", rate: "-3.2", tvol: "2000", high: "515" } });
    });
    const p = new KisMarketDataProvider({ appKey: "k", appSecret: "s", fetchImpl });
    const [snap] = await p.getSnapshot(["SPY"]);
    expect(snap.price).toBe(500.5);
    expect(snap.changeRate).toBeCloseTo(-0.032, 6);
  });

  it("국내 일봉은 과거→최신 순으로 반환", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes("tokenP")) return jsonRes({ access_token: "tok", expires_in: 86400 });
      // KIS 는 최신→과거로 줌
      return jsonRes({ output2: [{ stck_clpr: "103" }, { stck_clpr: "102" }, { stck_clpr: "101" }] });
    });
    const p = new KisMarketDataProvider({ appKey: "k", appSecret: "s", fetchImpl });
    const closes = await p.getDailyCloses("005930");
    expect(closes).toEqual([101, 102, 103]);
  });
});
