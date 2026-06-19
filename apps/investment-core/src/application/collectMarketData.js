import { computeIndicators } from "@lab/indicators";

/**
 * 시장 데이터 수집 파이프라인.
 * Provider 로 시세 스냅샷과 일봉 종가를 받아 지표를 계산하고 저장한다.
 *
 * 의존성은 모두 주입받는다 (Provider, repository) → 데이터 소스/DB 와 무관하게
 * 테스트 가능하고, 소스 확정 시 Provider 만 교체하면 된다.
 *
 * 공정성: 모든 모델이 동일 스냅샷을 보도록, 수집은 모델과 독립적으로 1회 수행한다.
 *
 * @param {object} deps
 * @param {{getSnapshot:Function, getDailyCloses:Function}} deps.provider
 * @param {{saveMarketSnapshot:Function, saveTechnicalIndicators:Function}} deps.repo
 * @param {string[]} deps.symbols
 * @param {string} [deps.source]   기록용 소스 이름
 * @param {{info:Function, warn:Function, error:Function}} [deps.logger]
 * @returns {Promise<{ saved:number, failed:Array<{symbol:string, reason:string}>, snapshotIds:Record<string,string> }>}
 */
export const collectMarketData = async ({ provider, repo, symbols, source = "unknown", logger }) => {
  if (!symbols || symbols.length === 0) {
    return { saved: 0, failed: [], snapshotIds: {} };
  }

  // 시세 스냅샷 (여러 종목 한 번에)
  const snapshots = await provider.getSnapshot(symbols);
  const bySymbol = new Map(snapshots.map((s) => [s.symbol, s]));

  const failed = [];
  const snapshotIds = {};
  const market = []; // 판단 파이프라인 재사용을 위한 시장 입력 (중복 호출 방지)
  let saved = 0;

  for (const symbol of symbols) {
    const snap = bySymbol.get(symbol);
    if (!snap) {
      failed.push({ symbol, reason: "NO_SNAPSHOT" });
      continue;
    }
    try {
      const snapshotId = await repo.saveMarketSnapshot({ ...snap, source });

      // 지표 계산용 일봉 종가 (실패해도 스냅샷은 이미 저장됨)
      let indicators = null;
      try {
        const closes = await provider.getDailyCloses(symbol, { days: 200 });
        indicators = computeIndicators(closes);
        await repo.saveTechnicalIndicators(snapshotId, indicators);
      } catch (err) {
        logger?.warn?.("지표 계산/저장 실패", { symbol, error: err.message });
        // 지표 실패는 치명적이지 않다 → 스냅샷만 저장된 상태로 둔다
      }

      snapshotIds[symbol] = snapshotId;
      market.push({
        symbol,
        price: snap.price,
        changeRate: snap.changeRate ?? null,
        indicators: indicators ?? {},
      });
      saved += 1;
    } catch (err) {
      logger?.error?.("스냅샷 저장 실패", { symbol, error: err.message });
      failed.push({ symbol, reason: err.message });
    }
  }

  logger?.info?.("시장 데이터 수집 완료", { saved, failed: failed.length, source });
  return { saved, failed, snapshotIds, market };
};
