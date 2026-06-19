/**
 * 포트폴리오 상태 저장/로드 레이어.
 * DB(portfolios, positions, allowed_symbols, decisions) ↔ 메모리 상태 변환을 담당한다.
 * 도메인/엔진은 positions 를 Map 으로 다루므로 여기서 변환한다.
 */

/**
 * 포트폴리오 상태를 메모리 형태로 로드한다.
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} portfolioId
 * @returns {Promise<{id:string, strategyId:string, modelId:string, cash:number, initialCapital:number, positions:Map<string,{quantity:number,avgCost:number}>}>}
 */
export const loadPortfolioState = async (client, portfolioId) => {
  const { data: pf, error: e1 } = await client
    .from("portfolios")
    .select("id, model_id, strategy_id, initial_capital, cash")
    .eq("id", portfolioId)
    .single();
  if (e1) throw new Error(`loadPortfolioState 실패: ${e1.message}`);

  const { data: rows, error: e2 } = await client
    .from("positions")
    .select("symbol, quantity, avg_cost")
    .eq("portfolio_id", portfolioId);
  if (e2) throw new Error(`positions 조회 실패: ${e2.message}`);

  const positions = new Map(
    (rows ?? []).map((r) => [r.symbol, { quantity: Number(r.quantity), avgCost: Number(r.avg_cost) }]),
  );

  return {
    id: pf.id,
    modelId: pf.model_id,
    strategyId: pf.strategy_id,
    cash: Number(pf.cash),
    initialCapital: Number(pf.initial_capital),
    positions,
  };
};

/**
 * 체결 후 변경된 포트폴리오 상태(현금·포지션)를 DB에 반영한다.
 * 수량 0 인 포지션은 삭제한다.
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} portfolioId
 * @param {{cash:number, positions:Map<string,{quantity:number,avgCost:number}>}} portfolio
 */
export const persistPortfolioState = async (client, portfolioId, portfolio) => {
  const { error: eCash } = await client
    .from("portfolios")
    .update({ cash: portfolio.cash })
    .eq("id", portfolioId);
  if (eCash) throw new Error(`현금 갱신 실패: ${eCash.message}`);

  for (const [symbol, pos] of portfolio.positions.entries()) {
    if (pos.quantity <= 0) {
      await client.from("positions").delete().eq("portfolio_id", portfolioId).eq("symbol", symbol);
      continue;
    }
    const { error } = await client
      .from("positions")
      .upsert(
        { portfolio_id: portfolioId, symbol, quantity: pos.quantity, avg_cost: pos.avgCost, updated_at: new Date().toISOString() },
        { onConflict: "portfolio_id,symbol" },
      );
    if (error) throw new Error(`포지션 갱신 실패(${symbol}): ${error.message}`);
  }
};

/**
 * 전략의 허용 종목과 최대 비중을 로드한다.
 * @returns {Promise<{ allowedSymbols:Set<string>, maxWeights:Map<string,number> }>}
 */
export const loadStrategyConfig = async (client, strategyId) => {
  const { data, error } = await client
    .from("allowed_symbols")
    .select("symbol, max_weight")
    .eq("strategy_id", strategyId);
  if (error) throw new Error(`allowed_symbols 조회 실패: ${error.message}`);
  const allowedSymbols = new Set();
  const maxWeights = new Map();
  for (const r of data ?? []) {
    allowedSymbols.add(r.symbol);
    maxWeights.set(r.symbol, Number(r.max_weight));
  }
  return { allowedSymbols, maxWeights };
};

/**
 * 최근 판단 N건 조회 (조회/프롬프트용).
 */
export const getRecentDecisions = async (client, portfolioId, limit = 5) => {
  const { data, error } = await client
    .from("decisions")
    .select("action, result, portfolio_comment, created_at")
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getRecentDecisions 실패: ${error.message}`);
  return (data ?? []).map((d) => ({
    action: d.action,
    result: d.result,
    portfolioComment: d.portfolio_comment,
    createdAt: d.created_at,
  }));
};

export const createPortfolioRepository = (client) => ({
  loadPortfolioState: (id) => loadPortfolioState(client, id),
  persistPortfolioState: (id, pf) => persistPortfolioState(client, id, pf),
  loadStrategyConfig: (sid) => loadStrategyConfig(client, sid),
  getRecentDecisions: (id, limit) => getRecentDecisions(client, id, limit),
});
