/**
 * 급락 알림 저장 레이어.
 */

/**
 * 알림 1건 저장.
 * @returns {Promise<string>} alert id
 */
export const saveAlert = async (client, a) => {
  const row = {
    symbol: a.symbol,
    alert_type: (a.reasons ?? []).join(","),
    price: a.price,
    daily_change: a.dailyChange ?? null,
    intraday_drop: a.intradayDrop ?? null,
    reasons: a.reasons ?? [],
    notified: a.notified ?? false,
    triggered_cycle: a.triggeredCycle ?? false,
  };
  const { data, error } = await client.from("alerts").insert(row).select("id").single();
  if (error) throw new Error(`saveAlert 실패: ${error.message}`);
  return data.id;
};

export const createAlertRepository = (client) => ({
  saveAlert: (a) => saveAlert(client, a),
});
