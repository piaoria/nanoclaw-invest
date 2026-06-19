/**
 * 포트폴리오 평가 및 수익률 계산 순수 함수.
 */

/**
 * 포트폴리오 총 평가액과 미실현 손익을 계산한다.
 * @param {object} p
 * @param {number} p.cash
 * @param {Array<{symbol:string, quantity:number, avgCost:number}>} p.positions
 * @param {Map<string,number>} p.prices   symbol -> 현재가
 * @returns {{ holdingsValue:number, totalValue:number, unrealizedPnl:number }}
 */
export const valuePortfolio = ({ cash, positions, prices }) => {
  let holdingsValue = 0;
  let unrealizedPnl = 0;
  for (const pos of positions) {
    const price = prices.get(pos.symbol) ?? 0;
    holdingsValue += pos.quantity * price;
    unrealizedPnl += (price - pos.avgCost) * pos.quantity;
  }
  return { holdingsValue, totalValue: cash + holdingsValue, unrealizedPnl };
};

/**
 * 누적 수익률.
 * @param {number} totalValue
 * @param {number} initialCapital
 */
export const cumulativeReturn = (totalValue, initialCapital) =>
  initialCapital > 0 ? totalValue / initialCapital - 1 : 0;

/**
 * 일간 수익률.
 * @param {number} todayValue
 * @param {number} prevValue
 */
export const dailyReturn = (todayValue, prevValue) =>
  prevValue > 0 ? todayValue / prevValue - 1 : 0;

/**
 * 최대 낙폭(MDD). 평가액 시계열에서 가장 큰 고점 대비 하락폭(음수).
 * @param {number[]} valueSeries
 * @returns {number} 0 이하 값 (예: -0.2 = -20%)
 */
export const maxDrawdown = (valueSeries) => {
  let peak = -Infinity;
  let mdd = 0;
  for (const v of valueSeries) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = v / peak - 1;
      if (dd < mdd) mdd = dd;
    }
  }
  return mdd;
};
