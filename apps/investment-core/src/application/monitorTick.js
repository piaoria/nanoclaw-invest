import { findDrops } from "../domain/dropDetection.js";
import { runDailyCycle } from "./runDailyCycle.js";
import { formatDropMessage } from "../notify/discordNotifier.js";

/**
 * 급락 모니터 1회 실행 (5분마다 호출된다).
 *
 *   감시 종목 시세 폴링 → 급락 판정 → (쿨다운 통과 시)
 *   Discord 알림 + alerts 저장 + (자동매매 ON 이면) 관련 포트폴리오 사이클 발동
 *
 * 쿨다운: 같은 종목이 짧은 시간에 반복 알림되지 않도록 state.lastAlert 으로 막는다.
 *
 * @param {object} deps
 * @param {string[]} deps.symbols
 * @param {{getSnapshot:Function}} deps.marketProvider
 * @param {{saveAlert:Function}} deps.alertRepo
 * @param {(msg:string)=>Promise<boolean>} deps.notify
 * @param {{dailyDropPct:number, intradayDropPct:number}} deps.thresholds
 * @param {number} deps.cooldownMs
 * @param {{lastAlert:Map<string,number>}} deps.state
 * @param {null|{portfolioIds:string[], cycleDeps:object}} [deps.autoTrade]
 * @param {{info:Function,warn:Function,error:Function}} [deps.logger]
 */
export const monitorTick = async (deps) => {
  const { symbols, marketProvider, alertRepo, notify, thresholds, cooldownMs, state, autoTrade, logger } = deps;
  if (!symbols || symbols.length === 0) return { checked: 0, alerted: 0 };

  let snapshots;
  try {
    snapshots = await marketProvider.getSnapshot(symbols);
  } catch (err) {
    logger?.error?.("시세 폴링 실패", { error: err.message });
    return { checked: 0, alerted: 0, error: err.message };
  }

  const drops = findDrops(snapshots, thresholds);
  const now = Date.now();
  let alerted = 0;

  for (const drop of drops) {
    // 쿨다운 체크
    const last = state.lastAlert.get(drop.symbol) ?? 0;
    if (now - last < cooldownMs) continue;
    state.lastAlert.set(drop.symbol, now);

    const message = formatDropMessage(drop);
    let notified = false;
    try {
      notified = await notify(message);
    } catch (err) {
      logger?.warn?.("Discord 알림 실패", { symbol: drop.symbol, error: err.message });
    }

    // 자동매매: 급락이 트리거가 되어 지정 포트폴리오 사이클 발동
    let triggeredCycle = false;
    if (autoTrade) {
      for (const portfolioId of autoTrade.portfolioIds) {
        try {
          await runDailyCycle({ portfolioId, ...autoTrade.cycleDeps, logger });
          triggeredCycle = true;
        } catch (err) {
          logger?.error?.("자동 사이클 실패", { portfolioId, error: err.message });
        }
      }
    }

    try {
      await alertRepo.saveAlert({ ...drop, notified, triggeredCycle });
    } catch (err) {
      logger?.error?.("알림 저장 실패", { symbol: drop.symbol, error: err.message });
    }
    alerted += 1;
  }

  logger?.info?.("모니터 틱 완료", { checked: symbols.length, alerted });
  return { checked: symbols.length, alerted };
};
