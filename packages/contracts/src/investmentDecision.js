import { z } from "zod";

/**
 * LLM 투자 판단 응답 스키마.
 * LLM 응답은 자유 텍스트가 아니라 이 스키마를 통과한 JSON만 신뢰한다.
 * 검증 실패 시 임의로 주문하지 않고 HOLD 또는 FAILED 로 기록한다.
 */
export const orderSchema = z.object({
  symbol: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  // 목표 비중(0~1) 또는 수량 중 하나 이상을 제시한다.
  targetWeight: z.number().min(0).max(1).optional(),
  quantity: z.number().positive().optional(),
});

export const investmentDecisionSchema = z.object({
  action: z.enum(["BUY", "SELL", "HOLD", "REBALANCE"]),
  orders: z.array(orderSchema).default([]),
  confidence: z.number().min(0).max(1),
  rationale: z.array(z.string()).default([]),
  riskFlags: z.array(z.string()).default([]),
  invalidationConditions: z.array(z.string()).default([]),
  portfolioComment: z.string().default(""),
});

/**
 * @typedef {z.infer<typeof investmentDecisionSchema>} InvestmentDecision
 */

/**
 * 원본 LLM 응답 문자열/객체를 파싱·검증한다.
 * @param {unknown} raw
 * @returns {{ ok: true, data: InvestmentDecision } | { ok: false, error: string }}
 */
export const parseInvestmentDecision = (raw) => {
  let candidate = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return { ok: false, error: "PARSE_FAIL" };
    }
  }
  const result = investmentDecisionSchema.safeParse(candidate);
  if (!result.success) {
    return { ok: false, error: "SCHEMA_FAIL" };
  }
  return { ok: true, data: result.data };
};
