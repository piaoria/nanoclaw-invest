/**
 * 통합 실행 스크립트: 한 포트폴리오의 일일 사이클을 1회 실행한다.
 * NanoClaw 없이도 수집→판단→체결→저장 전체 루프를 직접 돌려볼 수 있다.
 *
 * 사용법:
 *   node scripts/runCycle.mjs <portfolioId>
 *
 * 필요한 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY
 * (시장 데이터는 기본 Provider = Stooq→야후 fallback)
 */
import { loadEnv, createLogger } from "@lab/shared";
import { createContext } from "../src/context.js";
import { runDailyCycle } from "../src/application/runDailyCycle.js";

const portfolioId = process.argv[2];
if (!portfolioId) {
  console.error("사용법: node scripts/runCycle.mjs <portfolioId>");
  process.exit(1);
}

const env = loadEnv();
const log = createLogger({ level: env.LOG_LEVEL, service: "run-cycle" });
const ctx = createContext(env, { logger: log });

try {
  const result = await runDailyCycle({
    portfolioId,
    portfolioRepo: ctx.portfolioRepo,
    marketRepo: ctx.marketRepo,
    tradingRepo: ctx.tradingRepo,
    marketProvider: ctx.marketProvider,
    investorProvider: ctx.investorProvider,
    config: ctx.tradeConfig,
    logger: log,
  });
  log.info("사이클 결과", { status: result.status, decisionId: result.decisionId });
  console.log(JSON.stringify({ status: result.status, decisionId: result.decisionId }, null, 2));
  process.exit(0);
} catch (err) {
  log.error("사이클 실행 실패", { error: err.message });
  process.exit(1);
}
