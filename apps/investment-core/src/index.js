import http from "node:http";
import { loadEnv, createLogger } from "@lab/shared";
import { createSupabaseClient, pingDatabase } from "@lab/database";

const env = loadEnv();
const log = createLogger({ level: env.LOG_LEVEL, service: "investment-core" });

const supabase = createSupabaseClient({
  url: env.SUPABASE_URL,
  serviceKey: env.SUPABASE_SERVICE_KEY,
});

/**
 * Health Check 엔드포인트.
 * - /health      : 프로세스 생존 여부 (항상 200)
 * - /health/db   : Supabase 연결 + 스키마 적용 여부
 */
const server = http.createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.url === "/health") {
    return send(200, { ok: true, service: "investment-core" });
  }

  if (req.url === "/health/db") {
    const result = await pingDatabase(supabase);
    return send(result.ok ? 200 : 503, result);
  }

  return send(404, { ok: false, error: "not found" });
});

server.listen(env.INVESTMENT_CORE_PORT, () => {
  log.info("investment-core started", { port: env.INVESTMENT_CORE_PORT });
});

const shutdown = (signal) => {
  log.info("shutting down", { signal });
  server.close(() => process.exit(0));
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
