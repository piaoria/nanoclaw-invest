/**
 * Discord Webhook 알림.
 * webhook URL 이 없으면 조용히 무시한다 (알림 비활성 상태로 동작).
 */

/**
 * @param {string|undefined} webhookUrl
 * @param {typeof fetch} [fetchImpl]
 * @returns {(content:string)=>Promise<boolean>} 전송 성공 여부
 */
export const createDiscordNotifier = (webhookUrl, fetchImpl = fetch) => async (content) => {
  if (!webhookUrl) return false;
  const res = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return res.ok;
};

/**
 * 급락 알림 메시지를 사람이 읽기 좋게 포맷한다.
 * @param {{symbol:string, price:number, reasons:string[], dailyChange:number|null, intradayDrop:number|null}} drop
 */
export const formatDropMessage = (drop) => {
  const parts = [`🚨 **급락 감지: ${drop.symbol}**`, `현재가 ${drop.price}`];
  if (drop.dailyChange != null) parts.push(`전일대비 ${(drop.dailyChange * 100).toFixed(2)}%`);
  if (drop.intradayDrop != null) parts.push(`당일고가대비 ${(drop.intradayDrop * 100).toFixed(2)}%`);
  parts.push(`(${drop.reasons.join(", ")})`);
  return parts.join(" · ");
};
