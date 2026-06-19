import { collectMarketData } from "./collectMarketData.js";
import { runInvestmentDecision } from "./runInvestmentDecision.js";

/**
 * 한 포트폴리오의 하루 사이클을 실행하는 오케스트레이터.
 *
 *   포트폴리오/전략 로드 → 시장 데이터 수집(스냅샷·지표 저장)
 *   → Gemini 판단 → 검증·체결 → 거래 저장 → 포트폴리오 상태 영속화
 *
 * 모든 외부 의존(repos, providers)은 주입받는다 (context 에서 와이어링).
 *
 * @param {object} deps
 * @param {string} deps.portfolioId
 * @param {{loadPortfolioState:Function, loadStrategyConfig:Function, getRecentDecisions:Function, persistPortfolioState:Function}} deps.portfolioRepo
 * @param {{saveMarketSnapshot:Function, saveTechnicalIndicators:Function}} deps.marketRepo
 * @param {{saveLlmRequest:Function, saveDecision:Function, saveOrder:Function, saveFill:Function}} deps.tradingRepo
 * @param {{getSnapshot:Function, getDailyCloses:Function}} deps.marketProvider
 * @param {{decide:Function}} deps.investorProvider
 * @param {{slippageBps:number, feeBps:number, source?:string}} deps.config
 * @param {{info:Function,warn:Function,error:Function}} [deps.logger]
 */
export const runDailyCycle = async (deps) => {
  const {
    portfolioId, portfolioRepo, marketRepo, tradingRepo,
    marketProvider, investorProvider, config, logger,
  } = deps;

  // 1. 포트폴리오 + 전략 설정 로드
  const pf = await portfolioRepo.loadPortfolioState(portfolioId);
  const strategy = await portfolioRepo.loadStrategyConfig(pf.strategyId);
  const symbols = [...strategy.allowedSymbols];

  // 2. 시장 데이터 수집 (스냅샷/지표 저장 + 판단용 입력 반환)
  const collected = await collectMarketData({
    provider: marketProvider,
    repo: marketRepo,
    symbols,
    source: config.source ?? "yahoo|stooq",
    logger,
  });

  if (collected.market.length === 0) {
    logger?.warn?.("수집된 시장 데이터 없음 — 판단 건너뜀", { portfolioId });
    return { status: "NO_MARKET_DATA", collected };
  }

  const prices = new Map(collected.market.map((m) => [m.symbol, m.price]));
  // 대표 스냅샷(첫 종목)을 이 사이클의 기준 스냅샷으로 decision 에 연결
  const snapshotId = collected.snapshotIds[collected.market[0].symbol];

  // 3. 최근 판단 (프롬프트 참고용)
  const recentDecisions = await portfolioRepo.getRecentDecisions(portfolioId, 5);

  // 4. 판단 + 검증 + 체결 + 저장
  const result = await runInvestmentDecision({
    provider: investorProvider,
    repo: tradingRepo,
    portfolio: { cash: pf.cash, initialCapital: pf.initialCapital, positions: pf.positions },
    market: collected.market,
    prices,
    config: {
      slippageBps: config.slippageBps,
      feeBps: config.feeBps,
      allowedSymbols: strategy.allowedSymbols,
      maxWeights: strategy.maxWeights,
    },
    portfolioId,
    snapshotId,
    recentDecisions,
    logger,
  });

  // 5. 체결로 변경된 포트폴리오 상태 영속화
  await portfolioRepo.persistPortfolioState(portfolioId, {
    cash: pf.cash,
    positions: pf.positions,
  });

  logger?.info?.("일일 사이클 완료", { portfolioId, status: result.status });
  return { status: result.status, decisionId: result.decisionId, collected, result };
};
