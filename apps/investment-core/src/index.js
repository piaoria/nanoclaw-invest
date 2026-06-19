import { loadEnv, createLogger } from "@lab/shared";
import { createContext } from "./context.js";
import { createServer } from "./server.js";

const env = loadEnv();
const log = createLogger({ level: env.LOG_LEVEL, service: "investment-core" });

const ctx = createContext(env, { logger: log });
const app = createServer(ctx);

const server = app.listen(env.INVESTMENT_CORE_PORT, () => {
  log.info("investment-core started", { port: env.INVESTMENT_CORE_PORT });
});

const shutdown = (signal) => {
  log.info("shutting down", { signal });
  server.close(() => process.exit(0));
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
