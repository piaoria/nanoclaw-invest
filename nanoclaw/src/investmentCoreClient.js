/**
 * Investment Core HTTP 클라이언트.
 * NanoClaw 도구는 투자 로직을 직접 다루지 않고, 이 클라이언트로 Core API 만 호출한다.
 * base URL 은 환경변수 INVESTMENT_CORE_URL 로 주입한다.
 */
const BASE_URL = process.env.INVESTMENT_CORE_URL ?? "http://localhost:4001";

const request = async (method, path, body) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Core 응답 파싱 실패 (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(json.error ?? `Core HTTP ${res.status}`);
  return json;
};

export const investmentCore = {
  getPortfolio: (id) => request("GET", `/portfolios/${id}`),
  runCycle: (id) => request("POST", `/portfolios/${id}/cycle`),
  getRecentDecisions: (id, limit = 10) => request("GET", `/portfolios/${id}/decisions?limit=${limit}`),
  generateDailyReport: (id, payload = {}) => request("POST", `/portfolios/${id}/report/daily`, payload),
  getLatestDailyReport: () => request("GET", `/reports/daily/latest`),
};
