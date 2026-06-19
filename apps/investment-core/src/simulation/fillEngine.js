/**
 * 모의체결 엔진.
 * 확정 규칙: 판단 당시 가격 + 슬리피지 + 수수료 즉시 체결
 * (IMMEDIATE_PRICE_PLUS_SLIPPAGE). 거래 캘린더/시가 체결은 사용하지 않는다.
 *
 * 슬리피지는 체결을 불리하게 만든다:
 *  - 매수: 가격이 위로 밀림 (비싸게 산다)
 *  - 매도: 가격이 아래로 밀림 (싸게 판다)
 * 수수료는 체결 금액(notional)에 비례한다.
 */
export const FILL_RULE = "IMMEDIATE_PRICE_PLUS_SLIPPAGE";

/**
 * @param {object} params
 * @param {"BUY"|"SELL"} params.side
 * @param {number} params.price        판단 당시 가격
 * @param {number} params.quantity     체결 수량
 * @param {number} params.slippageBps  슬리피지 (bps, 1bp=0.01%)
 * @param {number} params.feeBps       수수료 (bps)
 * @returns {{ fillPrice:number, slippage:number, fee:number, quantity:number,
 *            notional:number, cashDelta:number, fillRule:string }}
 */
export const simulateFill = ({ side, price, quantity, slippageBps = 0, feeBps = 0 }) => {
  if (price <= 0) throw new Error("price must be > 0");
  if (quantity <= 0) throw new Error("quantity must be > 0");

  const slipRate = slippageBps / 10000;
  const fillPrice = side === "BUY" ? price * (1 + slipRate) : price * (1 - slipRate);
  const slippage = Math.abs(fillPrice - price) * quantity;

  const notional = fillPrice * quantity;
  const fee = notional * (feeBps / 10000);

  // 현금 변화: 매수는 (체결금액+수수료)만큼 감소, 매도는 (체결금액-수수료)만큼 증가
  const cashDelta = side === "BUY" ? -(notional + fee) : notional - fee;

  return { fillPrice, slippage, fee, quantity, notional, cashDelta, fillRule: FILL_RULE };
};
