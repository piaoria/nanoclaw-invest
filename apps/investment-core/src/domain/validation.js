/**
 * 주문 검증. LLM 응답이 스키마를 통과해도, 모의주문 실행 전에
 * 포트폴리오 제약을 반드시 재검증한다. 하나라도 실패하면 주문하지 않는다.
 *
 * 검증 항목:
 *  - 허용된 종목인지
 *  - 현금이 충분한지 (매수)
 *  - 보유 수량보다 많이 매도하지 않는지
 *  - 최대 투자 비중을 넘지 않는지
 *  - 같은 스냅샷에 대한 중복 주문이 아닌지
 */

/**
 * @param {object} ctx
 * @param {{ symbol:string, side:"BUY"|"SELL", quantity:number }} ctx.order
 * @param {number} ctx.price                    판단 당시 가격
 * @param {number} ctx.cash                     현재 현금
 * @param {Map<string,{quantity:number,avgCost:number}>} ctx.positions  symbol -> position
 * @param {number} ctx.totalValue               포트폴리오 총 평가액 (비중 계산 기준)
 * @param {Map<string,number>} ctx.maxWeights   symbol -> 허용 최대 비중(0~1)
 * @param {Set<string>} ctx.allowedSymbols      허용 종목
 * @param {Set<string>} [ctx.executedSnapshotKeys]  이미 처리한 (portfolio,snapshot) 키
 * @param {string} [ctx.snapshotKey]
 * @returns {{ ok:true } | { ok:false, reason:string }}
 */
export const validateOrder = (ctx) => {
  const { order, price, cash, positions, totalValue, maxWeights, allowedSymbols } = ctx;

  if (!allowedSymbols.has(order.symbol)) {
    return { ok: false, reason: "SYMBOL_NOT_ALLOWED" };
  }
  if (order.quantity <= 0 || price <= 0) {
    return { ok: false, reason: "INVALID_QUANTITY_OR_PRICE" };
  }
  if (ctx.executedSnapshotKeys && ctx.snapshotKey && ctx.executedSnapshotKeys.has(ctx.snapshotKey)) {
    return { ok: false, reason: "DUPLICATE_SNAPSHOT" };
  }

  if (order.side === "BUY") {
    const notional = price * order.quantity;
    if (notional > cash) {
      return { ok: false, reason: "INSUFFICIENT_CASH" };
    }
    // 최대 비중: 매수 후 해당 종목 평가액이 총 평가액 대비 한도를 넘지 않아야 한다.
    const maxWeight = maxWeights.get(order.symbol) ?? 1;
    const current = positions.get(order.symbol);
    const currentValue = current ? current.quantity * price : 0;
    const projectedValue = currentValue + notional;
    if (totalValue > 0 && projectedValue / totalValue > maxWeight + 1e-9) {
      return { ok: false, reason: "MAX_WEIGHT_EXCEEDED" };
    }
    return { ok: true };
  }

  // SELL
  const held = positions.get(order.symbol);
  if (!held || held.quantity < order.quantity) {
    return { ok: false, reason: "INSUFFICIENT_POSITION" };
  }
  return { ok: true };
};
