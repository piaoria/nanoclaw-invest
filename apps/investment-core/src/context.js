import { createSupabaseClient } from "@lab/database";
import {
  createMarketDataRepository,
  createTradingRepository,
  createReportRepository,
  createPortfolioRepository,
  createAlertRepository,
} from "@lab/database";
import {
  createDefaultMarketDataProvider,
  KisMarketDataProvider,
  YahooMarketDataProvider,
  FallbackMarketDataProvider,
} from "@lab/market-data";
import { GeminiInvestorProvider } from "@lab/llm-providers";
import { createDiscordNotifier } from "./notify/discordNotifier.js";

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

  const onFallback = (info) => logger?.warn?.("시장데이터 fallback", info);

  // KIS 키가 있으면 인트라데이 가능한 KIS 를 메인으로, 야후를 fallback 으로.
  // 없으면 기존 무료 소스(Stooq→야후) 체인.
  const marketProvider =
    env.KIS_APP_KEY && env.KIS_APP_SECRET
      ? new FallbackMarketDataProvider({
          providers: [
            new KisMarketDataProvider({
              appKey: env.KIS_APP_KEY,
              appSecret: env.KIS_APP_SECRET,
              baseUrl: env.KIS_BASE_URL,
            }),
            new YahooMarketDataProvider(),
          ],
          onFallback,
        })
      : createDefaultMarketDataProvider({ onFallback });

  return {
    env,
    logger,
    supabase,
    marketRepo: createMarketDataRepository(supabase),
    tradingRepo: createTradingRepository(supabase),
    reportRepo: createReportRepository(supabase),
    portfolioRepo: createPortfolioRepository(supabase),
    alertRepo: createAlertRepository(supabase),
    marketProvider,
    investorProvider: new GeminiInvestorProvider({ apiKey: env.GEMINI_API_KEY }),
    tradeConfig: { slippageBps: env.SLIPPAGE_BPS, feeBps: env.FEE_BPS },
    notify: createDiscordNotifier(env.DISCORD_WEBHOOK_URL),
    monitorConfig: {
      symbols: parseList(env.MONITOR_SYMBOLS),
      portfolioIds: parseList(env.MONITOR_PORTFOLIO_IDS),
      intervalMs: env.MONITOR_INTERVAL_MS,
      cooldownMs: env.ALERT_COOLDOWN_MS,
      thresholds: { dailyDropPct: env.DAILY_DROP_PCT, intradayDropPct: env.INTRADAY_DROP_PCT },
      autoTrade: env.ENABLE_AUTO_TRADE,
    },
  };
};

/** "A,B,C" → ["A","B","C"] (공백/빈값 제거) */
const parseList = (s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);
