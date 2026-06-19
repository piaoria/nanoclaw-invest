import { describe, it, expect, vi } from "vitest";
import { generateDailyReport } from "./generateDailyReport.js";

const makeRepo = () => ({
  saveDailyPerformance: vi.fn(async () => {}),
  saveReport: vi.fn(async () => "report-1"),
});

const basePortfolio = () => ({
  cash: 50000,
  initialCapital: 100000,
  positions: [{ symbol: "SPY", quantity: 500, avgCost: 100 }],
});

describe("generateDailyReport", () => {
  it("평가액·수익률·MDD 를 계산해 저장한다", async () => {
    const repo = makeRepo();
    const r = await generateDailyReport({
      portfolioId: "p1",
      date: "2026-06-19",
      portfolio: basePortfolio(),
      prices: new Map([["SPY", 110]]), // 보유 500 * 110 = 55000 + cash 50000 = 105000
      valuationHistory: [100000, 102000],
      decisions: [{ action: "BUY", result: "EXECUTED", portfolioComment: "추세 추종" }],
      repo,
    });

    expect(r.content.totalValue).toBe(105000);
    expect(r.content.cumulativeReturn).toBeCloseTo(0.05, 6); // 105000/100000 - 1
    expect(r.content.dailyReturn).toBeCloseTo(105000 / 102000 - 1, 6);
    expect(r.content.unrealizedPnl).toBe((110 - 100) * 500);
    expect(repo.saveDailyPerformance).toHaveBeenCalledOnce();
    expect(repo.saveReport).toHaveBeenCalledOnce();
    expect(r.content.decisions[0].action).toBe("BUY");
  });

  it("이력이 없으면 초기자본 대비로 일간수익률 계산", async () => {
    const repo = makeRepo();
    const r = await generateDailyReport({
      portfolioId: "p1",
      date: "2026-06-19",
      portfolio: { cash: 100000, initialCapital: 100000, positions: [] },
      prices: new Map(),
      valuationHistory: [],
      repo,
    });
    expect(r.content.totalValue).toBe(100000);
    expect(r.content.dailyReturn).toBeCloseTo(0, 6);
    expect(r.content.maxDrawdown).toBe(0);
  });

  it("하락 시 MDD 가 음수로 기록된다", async () => {
    const repo = makeRepo();
    const r = await generateDailyReport({
      portfolioId: "p1",
      date: "2026-06-19",
      portfolio: { cash: 80000, initialCapital: 100000, positions: [] },
      prices: new Map(),
      valuationHistory: [100000, 120000], // 고점 120000 → 당일 80000
      repo,
    });
    expect(r.content.maxDrawdown).toBeCloseTo(80000 / 120000 - 1, 6);
  });
});
