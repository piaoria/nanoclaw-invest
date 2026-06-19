import { parseInvestmentDecision } from "@lab/contracts";
import { processDecision } from "./paperTradingService.js";

/**
 * 투자 판단 루프 (MVP 핵심).
 *
 *   LLM 입력 구성 → provider.decide → 스키마 검증(parse)
 *   → llm_requests 저장(재현성) → 검증/체결 → decisions/orders/fills 저장
 *
 * 검증 실패 시 임의 주문하지 않고 HOLD/FAILED 로 기록한다.
 * 모든 외부 의존(provider, repo)은 주입받아 mock 으로 테스트 가능하다.
 *
 * @param {object} deps
 * @param {{decide:Function}} deps.provider
 * @param {{saveLlmRequest:Function, saveDecision:Function, saveOrder:Function, saveFill:Function}} deps.repo
 * @param {{cash:number, initialCapital:number, positions:Map}} deps.portfolio  (가변: 체결 시 갱신)
 * @param {Array<{symbol:string, price:number, changeRate:number|null, indicators?:object}>} deps.market
 * @param {Map<string,number>} deps.prices
 * @param {{slippageBps:number, feeBps:number, allowedSymbols:Set<string>, maxWeights:Map<string,number>}} deps.config
 * @param {string} [deps.portfolioId]
 * @param {string} [deps.snapshotId]
 * @param {string} [deps.promptVersionId]
 * @param {Array} [deps.recentDecisions]
 * @param {Set<string>} [deps.executedSnapshotKeys]
 * @param {{info:Function,warn:Function,error:Function}} [deps.logger]
 */
export const runInvestmentDecision = async (deps) => {
  const {
    provider, repo, portfolio, market, prices, config,
    portfolioId, snapshotId, promptVersionId, recentDecisions = [],
    executedSnapshotKeys, logger,
  } = deps;

  // 1. LLM 입력 구성 (포지션 Map → 배열)
  const input = {
    allowedSymbols: [...config.allowedSymbols],
    market,
    portfolio: {
      cash: portfolio.cash,
      initialCapital: portfolio.initialCapital,
      positions: [...portfolio.positions.entries()].map(([symbol, p]) => ({ symbol, ...p })),
    },
    recentDecisions,
  };

  // 2. 판단 요청
  const out = await provider.decide(input);

  // 3. 스키마 검증
  const parsed = parseInvestmentDecision(out.raw);
  const status = parsed.ok ? "OK" : parsed.error; // PARSE_FAIL | SCHEMA_FAIL

  // 4. llm_requests 저장 (성공/실패 모두 기록 — 재현성)
  const llmRequestId = await repo.saveLlmRequest({
    portfolioId,
    promptVersionId,
    modelVersion: out.modelVersion,
    temperature: out.temperature,
    inputPayload: input,
    rawResponse: typeof out.raw === "string" ? { text: out.raw } : out.raw,
    status,
  });

  // 5. 검증 실패 → 주문하지 않고 FAILED 로 기록
  if (!parsed.ok) {
    logger?.warn?.("LLM 응답 검증 실패", { status });
    await repo.saveDecision({
      portfolioId, llmRequestId, snapshotId,
      action: "HOLD", result: "FAILED",
      portfolioComment: `검증 실패: ${status}`,
    });
    return { status: "FAILED", reason: status, llmRequestId };
  }

  const decision = parsed.data;

  // 6. 검증 + 체결 (Phase 2 엔진)
  const proc = processDecision({
    portfolio, decision, prices, config,
    snapshotKey: snapshotId ? `${portfolioId}:${snapshotId}` : undefined,
    executedSnapshotKeys,
  });

  const result =
    proc.status === "EXECUTED" ? "EXECUTED" : proc.status === "HOLD" ? "HOLD" : "FAILED";

  // 7. decision 저장
  const decisionId = await repo.saveDecision({
    portfolioId, llmRequestId, snapshotId,
    action: decision.action,
    confidence: decision.confidence,
    rationale: decision.rationale,
    riskFlags: decision.riskFlags,
    invalidationConditions: decision.invalidationConditions,
    portfolioComment: decision.portfolioComment,
    result,
  });

  // 8. 체결된 주문 저장
  for (const { order, fill } of proc.fills ?? []) {
    const orderId = await repo.saveOrder({
      decisionId, portfolioId,
      symbol: order.symbol, side: order.side,
      quantity: fill.quantity, targetWeight: order.targetWeight, status: "FILLED",
    });
    await repo.saveFill({
      orderId,
      fillPrice: fill.fillPrice, slippage: fill.slippage,
      fee: fill.fee, quantity: fill.quantity, fillRule: fill.fillRule,
    });
  }

  logger?.info?.("투자 판단 처리 완료", {
    result, fills: proc.fills?.length ?? 0, rejections: proc.rejections?.length ?? 0,
  });

  return { status: result, decisionId, llmRequestId, fills: proc.fills ?? [], rejections: proc.rejections ?? [] };
};
