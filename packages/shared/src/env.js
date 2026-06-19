import { z } from "zod";

/**
 * 환경변수 스키마. 서비스 시작 시 1회 검증하여 잘못된 설정으로
 * 런타임 중간에 실패하는 상황을 막는다.
 * 비밀값은 여기서만 읽고, 절대 로그로 출력하지 않는다.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Supabase (클라우드 단일 인스턴스)
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),

  // LLM
  GEMINI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),

  // 시장 데이터 (무료 소스는 키 없이도 동작 가능 → optional)
  MARKET_DATA_API_KEY: z.string().optional(),

  // 한국투자증권(KIS) — 있으면 인트라데이 시세의 메인 소스로 사용
  KIS_APP_KEY: z.string().optional(),
  KIS_APP_SECRET: z.string().optional(),
  KIS_BASE_URL: z.string().url().default("https://openapi.koreainvestment.com:9443"),

  // 투자 엔진
  FILL_RULE: z.string().default("IMMEDIATE_PRICE_PLUS_SLIPPAGE"),
  SLIPPAGE_BPS: z.coerce.number().nonnegative().default(5),
  FEE_BPS: z.coerce.number().nonnegative().default(1),

  // 서비스
  INVESTMENT_CORE_PORT: z.coerce.number().int().positive().default(4001),

  // 급락 모니터 워커
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  MONITOR_SYMBOLS: z.string().optional(), // 쉼표구분 (최대 50개 내외)
  MONITOR_PORTFOLIO_IDS: z.string().optional(), // 쉼표구분 (자동매매 대상)
  MONITOR_INTERVAL_MS: z.coerce.number().int().positive().default(300000), // 5분
  DAILY_DROP_PCT: z.coerce.number().positive().default(3),
  INTRADAY_DROP_PCT: z.coerce.number().positive().default(5),
  ALERT_COOLDOWN_MS: z.coerce.number().int().nonnegative().default(1800000), // 30분
  ENABLE_AUTO_TRADE: z.coerce.boolean().default(false),
});

/**
 * process.env 를 검증해 반환한다. 실패 시 어떤 키가 문제인지 출력하고 종료한다.
 * 검증 메시지에 실제 값은 포함하지 않는다.
 * @param {NodeJS.ProcessEnv} [source]
 */
export const loadEnv = (source = process.env) => {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(`[env] 환경변수 검증 실패:\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
};
