import { createSupabaseClient } from "@lab/database";
import {
  createMarketDataRepository,
  createTradingRepository,
  createReportRepository,
  createPortfolioRepository,
} from "@lab/database";
import { createDefaultMarketDataProvider } from "@lab/market-data";
import { GeminiInvestorProvider } from "@lab/llm-providers";

/**
 * 환경설정으로부터 모든 의존성(클라이언트·repo·provider)을 묶은 context 를 만든다.
 * 라우트 핸들러와 스크립트가 이 context 를 공유한다.
 *
 * @param {object} env  loadEnv() 결과
 * @param {{logger?:object}} [opts]
 */
export const createContext = (env, { logger } = {}) => {
  const supabase = createSupabaseClient({
    url: env.SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_KEY,
  });

  return {
    env,
    logger,
    supabase,
    marketRepo: createMarketDataRepository(supabase),
    tradingRepo: createTradingRepository(supabase),
    reportRepo: createReportRepository(supabase),
    portfolioRepo: createPortfolioRepository(supabase),
    marketProvider: createDefaultMarketDataProvider({
      onFallback: (info) => logger?.warn?.("시장데이터 fallback", info),
    }),
    investorProvider: new GeminiInvestorProvider({ apiKey: env.GEMINI_API_KEY }),
    tradeConfig: { slippageBps: env.SLIPPAGE_BPS, feeBps: env.FEE_BPS },
  };
};
