import { createClient } from "@supabase/supabase-js";

/**
 * Supabase 서비스 클라이언트를 생성한다.
 * service_role 키를 사용하므로 서버(투자 서비스) 내부에서만 호출한다.
 * 절대 브라우저나 외부 소비자(toss_cmd)에 노출하지 않는다.
 *
 * @param {{ url: string, serviceKey: string }} cfg
 */
export const createSupabaseClient = ({ url, serviceKey }) => {
  if (!url || !serviceKey) {
    throw new Error("Supabase url/serviceKey 가 필요합니다.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

/**
 * 연결 확인용 가벼운 핑. 마이그레이션 전에도 동작하도록
 * 존재하지 않는 테이블 오류는 "연결 성공"으로 간주한다.
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 */
export const pingDatabase = async (client) => {
  const { error } = await client.from("models").select("id").limit(1);
  if (!error) return { ok: true, hasSchema: true };
  // 42P01 = undefined_table → 연결은 됐으나 스키마 미적용
  if (error.code === "42P01") return { ok: true, hasSchema: false };
  return { ok: false, error: error.message };
};
