/**
 * 급락 감지 (순수 함수).
 * 5분 폴링한 시세 스냅샷을 보고 "급락 트리거" 여부를 판정한다.
 *
 * 두 가지 기준 (둘 중 하나라도 충족하면 트리거):
 *   - DAILY_DROP    : 전일 대비 등락률이 임계치 이하  (예: -3%)
 *   - INTRADAY_DROP : 당일 고가 대비 낙폭이 임계치 이하 (예: -5%)
 */

/**
 * @param {{symbol:string, price:number, changeRate:number|null, highPrice:number|null}} snap
 * @param {{dailyDropPct?:number, intradayDropPct?:number}} [thresholds]  양수 % (예: 3 = -3%)
 * @returns {{ triggered:boolean, reasons:string[], dailyChange:number|null, intradayDrop:number|null }}
 */
export const detectDrop = (snap, { dailyDropPct = 3, intradayDropPct = 5 } = {}) => {
  const reasons = [];

  const dailyChange = snap.changeRate ?? null; // 소수 (예: -0.03)
  if (dailyChange != null && dailyChange <= -dailyDropPct / 100) {
    reasons.push("DAILY_DROP");
  }

  let intradayDrop = null;
  if (snap.highPrice && snap.highPrice > 0 && snap.price > 0) {
    intradayDrop = snap.price / snap.highPrice - 1; // 음수
    if (intradayDrop <= -intradayDropPct / 100) {
      reasons.push("INTRADAY_DROP");
    }
  }

  return { triggered: reasons.length > 0, reasons, dailyChange, intradayDrop };
};

/**
 * 여러 종목에서 급락 트리거된 것만 추려 반환한다.
 * @param {Array} snapshots  getSnapshot 결과
 * @param {object} thresholds
 * @returns {Array<{symbol:string, price:number, reasons:string[], dailyChange:number|null, intradayDrop:number|null}>}
 */
export const findDrops = (snapshots, thresholds) =>
  snapshots
    .map((s) => ({ snap: s, result: detectDrop(s, thresholds) }))
    .filter(({ result }) => result.triggered)
    .map(({ snap, result }) => ({
      symbol: snap.symbol,
      price: snap.price,
      reasons: result.reasons,
      dailyChange: result.dailyChange,
      intradayDrop: result.intradayDrop,
    }));
