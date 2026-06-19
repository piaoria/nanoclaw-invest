import { describe, it, expect, vi } from "vitest";
import { GeminiInvestorProvider } from "./GeminiInvestorProvider.js";

const input = {
  allowedSymbols: ["SPY"],
  market: [{ symbol: "SPY", price: 100, changeRate: 0.01, indicators: { ma_20: 98, rsi: 55 } }],
  portfolio: { cash: 10000, initialCapital: 10000, positions: [] },
};

describe("GeminiInvestorProvider", () => {
  it("generate 를 호출하고 메타와 함께 반환한다", async () => {
    const generate = vi.fn(async () => '{"action":"HOLD","confidence":0.5}');
    const p = new GeminiInvestorProvider({ model: "gemini-2.0-flash", temperature: 0.2, generate });
    const out = await p.decide(input);

    expect(out.raw).toContain("HOLD");
    expect(out.modelVersion).toBe("gemini-2.0-flash");
    expect(out.temperature).toBe(0.2);
    // 프롬프트에 시장 데이터와 출력 형식이 포함되는지
    const callArg = generate.mock.calls[0][0];
    expect(callArg.prompt).toContain("SPY");
    expect(callArg.prompt).toContain("출력 형식");
    expect(callArg.system).toContain("JSON");
  });

  it("키 없이 기본 generate 호출 시 에러", async () => {
    const p = new GeminiInvestorProvider({}); // apiKey 없음
    await expect(p.decide(input)).rejects.toThrow(/GEMINI_API_KEY/);
  });
});
