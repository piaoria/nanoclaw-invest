/**
 * 포지션 갱신 순수 함수.
 * 매수 시 평균 매입가를 가중평균으로 갱신하고, 매도 시 실현 손익을 계산한다.
 * 평균 매입가는 매도로 바뀌지 않는다 (남은 수량의 원가 기준 유지).
 */

/**
 * 매수 적용.
 * @param {{ quantity:number, avgCost:number }} pos  기존 포지션
 * @param {{ quantity:number, fillPrice:number }} fill
 * @returns {{ quantity:number, avgCost:number }}
 */
export const applyBuy = (pos, fill) => {
  const totalQty = pos.quantity + fill.quantity;
  if (totalQty <= 0) return { quantity: 0, avgCost: 0 };
  const avgCost = (pos.quantity * pos.avgCost + fill.quantity * fill.fillPrice) / totalQty;
  return { quantity: totalQty, avgCost };
};

/**
 * 매도 적용. 보유 수량보다 많이 팔 수 없다(호출 전 검증 가정).
 * @param {{ quantity:number, avgCost:number }} pos
 * @param {{ quantity:number, fillPrice:number }} fill
 * @returns {{ position:{ quantity:number, avgCost:number }, realizedPnl:number }}
 */
export const applySell = (pos, fill) => {
  const remaining = pos.quantity - fill.quantity;
  const realizedPnl = (fill.fillPrice - pos.avgCost) * fill.quantity;
  if (remaining <= 0) {
    return { position: { quantity: 0, avgCost: 0 }, realizedPnl };
  }
  return { position: { quantity: remaining, avgCost: pos.avgCost }, realizedPnl };
};
