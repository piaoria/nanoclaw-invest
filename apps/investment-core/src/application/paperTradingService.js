import { validateOrder } from "../domain/validation.js";
import { simulateFill } from "../simulation/fillEngine.js";
import { applyBuy, applySell } from "../domain/position.js";
import { valuePortfolio } from "../domain/performance.js";

/**
 * 검증된 투자 판단(decision)을 받아 모의주문을 처리한다.
 * 순수 도메인 함수들을 엮는 오케스트레이션 계층이며, 부수효과(DB)는
 * 주입된 portfolio 상태 객체에만 적용한다. (Phase 2 는 in-memory)
 *
 * 처리 순서: 주문별 검증 → 체결 → 포지션/현금/실현손익 갱신.
 * 검증 실패 주문은 건너뛰고 결과에 사유를 남긴다 (임의 주문 금지).
 * 동일 스냅샷 중복 처리는 거부한다.
 */
export const processDecision = ({
  portfolio, // { cash, positions: Map<symbol,{quantity,avgCost}>, realizedPnl, initialCapital }
  decision, // { action, orders:[{symbol,side,quantity}] }
  prices, // Map<symbol, number> 판단 당시 가격
  config, // { slippageBps, feeBps, allowedSymbols:Set, maxWeights:Map }
  snapshotKey,
  executedSnapshotKeys = new Set(),
}) => {
  if (snapshotKey && executedSnapshotKeys.has(snapshotKey)) {
    return { status: "SKIPPED", reason: "DUPLICATE_SNAPSHOT", fills: [] };
  }

  if (decision.action === "HOLD" || decision.orders.length === 0) {
    if (snapshotKey) executedSnapshotKeys.add(snapshotKey);
    return { status: "HOLD", fills: [], rejections: [] };
  }

  const fills = [];
  const rejections = [];

  for (const order of decision.orders) {
    const price = prices.get(order.symbol);
    if (price == null) {
      rejections.push({ order, reason: "NO_PRICE" });
      continue;
    }

    // 현재 평가액 기준으로 비중 검증
    const { totalValue } = valuePortfolio({
      cash: portfolio.cash,
      positions: [...portfolio.positions.entries()].map(([symbol, p]) => ({ symbol, ...p })),
      prices,
    });

    const check = validateOrder({
      order,
      price,
      cash: portfolio.cash,
      positions: portfolio.positions,
      totalValue,
      maxWeights: config.maxWeights,
      allowedSymbols: config.allowedSymbols,
    });
    if (!check.ok) {
      rejections.push({ order, reason: check.reason });
      continue;
    }

    const fill = simulateFill({
      side: order.side,
      price,
      quantity: order.quantity,
      slippageBps: config.slippageBps,
      feeBps: config.feeBps,
    });

    // 현금 갱신
    portfolio.cash += fill.cashDelta;

    // 포지션 갱신
    const current = portfolio.positions.get(order.symbol) ?? { quantity: 0, avgCost: 0 };
    if (order.side === "BUY") {
      portfolio.positions.set(order.symbol, applyBuy(current, fill));
    } else {
      const { position, realizedPnl } = applySell(current, fill);
      portfolio.realizedPnl = (portfolio.realizedPnl ?? 0) + realizedPnl;
      if (position.quantity === 0) portfolio.positions.delete(order.symbol);
      else portfolio.positions.set(order.symbol, position);
    }

    fills.push({ order, fill });
  }

  if (snapshotKey) executedSnapshotKeys.add(snapshotKey);

  const status = fills.length > 0 ? "EXECUTED" : "FAILED";
  return { status, fills, rejections };
};
