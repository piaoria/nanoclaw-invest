/**
 * 성과/보고서 저장·조회 레이어.
 * daily_performance · reports.
 */

/**
 * 일별 성과 저장. (portfolio_id, date) unique → upsert.
 * @returns {Promise<void>}
 */
export const saveDailyPerformance = async (client, p) => {
  const row = {
    portfolio_id: p.portfolioId,
    date: p.date,
    daily_return: p.dailyReturn ?? null,
    cumulative_return: p.cumulativeReturn ?? null,
    max_drawdown: p.maxDrawdown ?? null,
  };
  const { error } = await client
    .from("daily_performance")
    .upsert(row, { onConflict: "portfolio_id,date" });
  if (error) throw new Error(`saveDailyPerformance 실패: ${error.message}`);
};

/**
 * 보고서 저장.
 * @returns {Promise<string>} report id
 */
export const saveReport = async (client, r) => {
  const row = { type: r.type, period: r.period, content: r.content };
  const { data, error } = await client.from("reports").insert(row).select("id").single();
  if (error) throw new Error(`saveReport 실패: ${error.message}`);
  return data.id;
};

/**
 * 최신 보고서 1건 조회.
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {"daily"|"weekly"} type
 */
export const getLatestReport = async (client, type) => {
  const { data, error } = await client
    .from("reports")
    .select("*")
    .eq("type", type)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestReport 실패: ${error.message}`);
  return data;
};

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 */
export const createReportRepository = (client) => ({
  saveDailyPerformance: (p) => saveDailyPerformance(client, p),
  saveReport: (r) => saveReport(client, r),
  getLatestReport: (type) => getLatestReport(client, type),
});
