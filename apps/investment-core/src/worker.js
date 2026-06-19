import { loadEnv, createLogger } from "@lab/shared";
import { createContext } from "./context.js";
import { monitorTick } from "./application/monitorTick.js";

/**
 * 급락 모니터 워커.
 * MONITOR_INTERVAL_MS(기본 5분)마다 감시 종목 시세를 폴링해 급락을 감지하고
 * Discord 알림 + (ENABLE_AUTO_TRADE 시) 자동 사이클을 발동한다.
 *
 * NanoClaw 는 호스트에 직접 실행하고, 이 워커는 투자 서비스(Compose)로 돌린다.
 */
const env = loadEnv();
const log = createLogger({ level: env.LOG_LEVEL, service: "monitor-worker" });
const ctx = createContext(env, { logger: log });

const { symbols, portfolioIds, intervalMs, cooldownMs, thresholds, autoTrade } = ctx.monitorConfig;

if (symbols.length === 0) {
  log.warn("MONITOR_SYMBOLS 가 비어 있어 감시할 종목이 없습니다. 워커를 종료합니다.");
  process.exit(0);
}

// 자동매매 사이클에 필요한 의존성 묶음 (트리거 시 사용)
const cycleDeps = {
  portfolioRepo: ctx.portfolioRepo,
  marketRepo: ctx.marketRepo,
  tradingRepo: ctx.tradingRepo,
  marketProvider: ctx.marketProvider,
  investorProvider: ctx.investorProvider,
  config: ctx.tradeConfig,
};

const state = { lastAlert: new Map() };

const tick = () =>
  monitorTick({
    symbols,
    marketProvider: ctx.marketProvider,
    alertRepo: ctx.alertRepo,
    notify: ctx.notify,
    thresholds,
    cooldownMs,
    state,
    autoTrade: autoTrade && portfolioIds.length > 0 ? { portfolioIds, cycleDeps } : null,
    logger: log,
  }).catch((err) => log.error("모니터 틱 예외", { error: err.message }));

log.info("급락 모니터 시작", { symbols: symbols.length, intervalMs, autoTrade });
tick(); // 시작 즉시 1회
const timer = setInterval(tick, intervalMs);

const shutdown = (signal) => {
  log.info("모니터 종료", { signal });
  clearInterval(timer);
  process.exit(0);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
