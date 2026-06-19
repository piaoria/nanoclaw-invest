/**
 * 최소 JSON 구조화 로거.
 * 비밀값(API 키, 인증 헤더)을 절대 인자로 넘기지 않는다.
 */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * @param {{ level?: string, service?: string }} [opts]
 */
export const createLogger = ({ level = "info", service = "app" } = {}) => {
  const threshold = LEVELS[level] ?? LEVELS.info;

  const emit = (lvl, msg, meta) => {
    if (LEVELS[lvl] < threshold) return;
    const line = {
      ts: new Date().toISOString(),
      level: lvl,
      service,
      msg,
      ...(meta ? { meta } : {}),
    };
    const out = lvl === "error" || lvl === "warn" ? process.stderr : process.stdout;
    out.write(`${JSON.stringify(line)}\n`);
  };

  return {
    debug: (msg, meta) => emit("debug", msg, meta),
    info: (msg, meta) => emit("info", msg, meta),
    warn: (msg, meta) => emit("warn", msg, meta),
    error: (msg, meta) => emit("error", msg, meta),
  };
};
