/**
 * 투자 판단/주문 저장 레이어.
 * llm_requests · decisions · orders · fills 를 저장한다.
 * Supabase 호출은 이 계층에서만 수행한다.
 */

/**
 * LLM 요청/응답 기록 (재현성 핵심: model_version, temperature, prompt, raw).
 * @returns {Promise<string>} llm_request id
 */
export const saveLlmRequest = async (client, req) => {
  const row = {
    portfolio_id: req.portfolioId,
    prompt_version_id: req.promptVersionId ?? null,
    model_version: req.modelVersion,
    temperature: req.temperature,
    input_payload: req.inputPayload,
    raw_response: req.rawResponse ?? null,
    status: req.status,
  };
  const { data, error } = await client.from("llm_requests").insert(row).select("id").single();
  if (error) throw new Error(`saveLlmRequest 실패: ${error.message}`);
  return data.id;
};

/**
 * 검증된 투자 판단 저장. (portfolio_id, snapshot_id) 중복은 DB unique 로 방지.
 * @returns {Promise<string>} decision id
 */
export const saveDecision = async (client, d) => {
  const row = {
    portfolio_id: d.portfolioId,
    llm_request_id: d.llmRequestId ?? null,
    snapshot_id: d.snapshotId ?? null,
    action: d.action,
    confidence: d.confidence ?? null,
    rationale: d.rationale ?? [],
    risk_flags: d.riskFlags ?? [],
    invalidation_conditions: d.invalidationConditions ?? [],
    portfolio_comment: d.portfolioComment ?? null,
    result: d.result,
  };
  const { data, error } = await client.from("decisions").insert(row).select("id").single();
  if (error) throw new Error(`saveDecision 실패: ${error.message}`);
  return data.id;
};

/**
 * 모의주문 저장.
 * @returns {Promise<string>} order id
 */
export const saveOrder = async (client, o) => {
  const row = {
    decision_id: o.decisionId,
    portfolio_id: o.portfolioId,
    symbol: o.symbol,
    side: o.side,
    quantity: o.quantity,
    target_weight: o.targetWeight ?? null,
    status: o.status ?? "FILLED",
  };
  const { data, error } = await client.from("orders").insert(row).select("id").single();
  if (error) throw new Error(`saveOrder 실패: ${error.message}`);
  return data.id;
};

/**
 * 모의체결 저장.
 */
export const saveFill = async (client, f) => {
  const row = {
    order_id: f.orderId,
    fill_price: f.fillPrice,
    slippage: f.slippage,
    fee: f.fee,
    quantity: f.quantity,
    fill_rule: f.fillRule,
  };
  const { error } = await client.from("fills").insert(row);
  if (error) throw new Error(`saveFill 실패: ${error.message}`);
};

/**
 * Supabase 클라이언트를 캡처한 trading repository.
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 */
export const createTradingRepository = (client) => ({
  saveLlmRequest: (req) => saveLlmRequest(client, req),
  saveDecision: (d) => saveDecision(client, d),
  saveOrder: (o) => saveOrder(client, o),
  saveFill: (f) => saveFill(client, f),
});
