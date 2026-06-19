import { valuePortfolio, cumulativeReturn, dailyReturn, maxDrawdown } from "../domain/performance.js";

/**
 * 일간 보고서 생성.
 *
 * 포트폴리오 현재 상태로 평가액·수익률·MDD 를 계산해 daily_performance 에 저장하고,
 * 당일 판단 요약을 포함한 보고서를 reports 에 저장한다.
 *
 * 의존성(repo)은 주입받아 mock 으로 테스트 가능하다.
 *
 * @param {object} deps
 * @param {string} deps.portfolioId
 * @param {string} deps.date                         YYYY-MM-DD
 * @param {{cash:number, initialCapital:number, positions:Array<{symbol:string,quantity:number,avgCost:number}>}} deps.portfolio
 * @param {Map<string,number>} deps.prices           현재가
 * @param {number[]} deps.valuationHistory           과거 총평가액 시계열(오래된→최신, 당일 제외)
 * @param {Array<{action:string, result:string, portfolioComment?:string}>} [deps.decisions]  당일 판단
 * @param {{saveDailyPerformance:Function, saveReport:Function}} deps.repo
 * @param {{info:Function}} [deps.logger]
 */
export const generateDailyReport = async (deps) => {
  const { portfolioId, date, portfolio, prices, valuationHistory = [], decisions = [], repo, logger } = deps;

  // 현재 평가
  const { holdingsValue, totalValue, unrealizedPnl } = valuePortfolio({
    cash: portfolio.cash,
    positions: portfolio.positions,
    prices,
  });

  const prevValue = valuationHistory.length > 0 ? valuationHistory[valuationHistory.length - 1] : portfolio.initialCapital;
  const series = [...valuationHistory, totalValue];

  const perf = {
    dailyReturn: dailyReturn(totalValue, prevValue),
    cumulativeReturn: cumulativeReturn(totalValue, portfolio.initialCapital),
    maxDrawdown: maxDrawdown(series),
  };

  await repo.saveDailyPerformance({ portfolioId, date, ...perf });

  const content = {
    date,
    portfolioId,
    cash: portfolio.cash,
    holdingsValue,
    totalValue,
    unrealizedPnl,
    ...perf,
    positions: portfolio.positions,
    decisions: decisions.map((d) => ({
      action: d.action,
      result: d.result,
      comment: d.portfolioComment ?? null,
    })),
  };

  const reportId = await repo.saveReport({ type: "daily", period: date, content });

  logger?.info?.("일간 보고서 생성", { portfolioId, date, totalValue });
  return { reportId, content };
};
