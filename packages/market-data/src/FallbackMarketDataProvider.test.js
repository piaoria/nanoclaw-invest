import { describe, it, expect, vi } from "vitest";
import { FallbackMarketDataProvider } from "./FallbackMarketDataProvider.js";

const ok = (value) => ({ getSnapshot: async () => value });
const fail = (msg) => ({
  getSnapshot: async () => {
    throw new Error(msg);
  },
});

describe("FallbackMarketDataProvider", () => {
  it("첫 Provider 성공 시 그 결과를 쓴다", async () => {
    const p = new FallbackMarketDataProvider({ providers: [ok(["A"]), ok(["B"])] });
    expect(await p.getSnapshot(["SPY"])).toEqual(["A"]);
  });

  it("첫 Provider 실패 시 다음으로 넘어가고 훅을 호출한다", async () => {
    const onFallback = vi.fn();
    const p = new FallbackMarketDataProvider({
      providers: [fail("429"), ok(["B"])],
      onFallback,
    });
    expect(await p.getSnapshot(["SPY"])).toEqual(["B"]);
    expect(onFallback).toHaveBeenCalledOnce();
    expect(onFallback.mock.calls[0][0].error).toBe("429");
  });

  it("모두 실패하면 예외", async () => {
    const p = new FallbackMarketDataProvider({ providers: [fail("a"), fail("b")] });
    await expect(p.getSnapshot(["SPY"])).rejects.toThrow(/모든 Provider 실패/);
  });

  it("providers 가 없으면 생성 실패", () => {
    expect(() => new FallbackMarketDataProvider({ providers: [] })).toThrow();
  });
});
