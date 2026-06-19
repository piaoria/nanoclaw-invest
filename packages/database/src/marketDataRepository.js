/**
 * 시장 데이터 저장 레이어.
 * Supabase 호출은 이 계층에서만 수행한다 (도메인 로직과 분리).
 * 모든 함수는 Supabase 클라이언트를 첫 인자로 받는다.
 */

/**
 * 시장 스냅샷 1건을 저장하고 id 를 반환한다.
 * (symbol, captured_at) 가 이미 있으면 기존 id 를 재사용한다 → 중복 수집 방지.
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {{symbol:string, capturedAt:string, price:number, changeRate:number|null, volume:number|null, source:string}} snap
 * @returns {Promise<string>} snapshot id
 */
export const saveMarketSnapshot = async (client, snap) => {
  const row = {
    symbol: snap.symbol,
    captured_at: snap.capturedAt,
    price: snap.price,
    change_rate: snap.changeRate ?? null,
    volume: snap.volume ?? null,
    source: snap.source,
  };
  // 동일 (symbol, captured_at) 충돌 시 갱신 후 id 반환
  const { data, error } = await client
    .from("market_snapshots")
    .upsert(row, { onConflict: "symbol,captured_at" })
    .select("id")
    .single();
  if (error) throw new Error(`saveMarketSnapshot 실패: ${error.message}`);
  return data.id;
};

/**
 * 스냅샷에 연결된 기술적 지표를 저장한다.
 * snapshot 당 1건(unique) 이므로 upsert 한다.
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} snapshotId
 * @param {object} indicators  computeIndicators 결과
 */
export const saveTechnicalIndicators = async (client, snapshotId, indicators) => {
  const row = { snapshot_id: snapshotId, ...indicators };
  const { error } = await client
    .from("technical_indicators")
    .upsert(row, { onConflict: "snapshot_id" });
  if (error) throw new Error(`saveTechnicalIndicators 실패: ${error.message}`);
};

/**
 * Supabase 클라이언트를 캡처한 repository 객체를 만든다.
 * 서비스 계층에 주입해서 사용한다 (테스트 시 mock 으로 대체 가능).
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 */
export const createMarketDataRepository = (client) => ({
  saveMarketSnapshot: (snap) => saveMarketSnapshot(client, snap),
  saveTechnicalIndicators: (snapshotId, indicators) =>
    saveTechnicalIndicators(client, snapshotId, indicators),
});
