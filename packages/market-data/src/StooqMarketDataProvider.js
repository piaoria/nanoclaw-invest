import { MarketDataProvider } from "./MarketDataProvider.js";

/**
 * Stooq 기반 시장 데이터 Provider (무료, 키 불필요, 공개 CSV).
 * 공유 IP 환경에서도 야후보다 안정적이라 메인 소스로 사용한다.
 *
 * 티커 매핑:
 *   - 미국 종목/ETF:  소문자 + ".us"   (SPY -> spy.us, TQQQ -> tqqq.us)
 *   - 지수:           '^' 접두 유지     (^SPX, ^NDX) → 소문자로 변환
 * 호출부에서는 표준 티커(SPY, ^GSPC 등)를 쓰고, 여기서 Stooq 형식으로 변환한다.
 */
export class StooqMarketDataProvider extends MarketDataProvider {
  /**
   * @param {{ fetchImpl?: typeof fetch }} [deps]  테스트 주입용
   */
  constructor({ fetchImpl = fetch } = {}) {
    super();
    this.fetchImpl = fetchImpl;
  }

  /**
   * 표준 티커를 Stooq 심볼로 변환한다.
   * @param {string} symbol
   */
  toStooqSymbol(symbol) {
    if (symbol.startsWith("^")) return symbol.toLowerCase(); // 지수
    return `${symbol.toLowerCase()}.us`; // 미국 종목/ETF
  }

  /**
   * 일봉 종가 시계열(오래된→최신)을 반환한다.
   * Stooq 일별 CSV: Date,Open,High,Low,Close,Volume
   * @param {string} symbol
   * @returns {Promise<Array<{date:string, close:number, volume:number|null}>>}
   */
  async getDailyHistory(symbol) {
    const s = this.toStooqSymbol(symbol);
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`;
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new Error(`Stooq HTTP ${res.status} (${symbol})`);
    const text = await res.text();
    return parseStooqCsv(text);
  }

  /**
   * 일봉 종가 배열만 반환 (지표 계산용).
   * @param {string} symbol
   * @param {{ days?: number }} [opts]
   * @returns {Promise<number[]>}
   */
  async getDailyCloses(symbol, { days = 200 } = {}) {
    const rows = await this.getDailyHistory(symbol);
    const closes = rows.map((r) => r.close);
    return days > 0 ? closes.slice(-days) : closes;
  }

  /**
   * 현재 시세 스냅샷. Stooq 일별 데이터의 마지막 행을 현재가로 사용하고,
   * 등락률은 직전 종가 대비로 계산한다 (하루 1회 스냅샷 용도에 충분).
   * @param {string[]} symbols
   * @returns {Promise<Array<{symbol:string, price:number, changeRate:number|null, volume:number|null, capturedAt:string}>>}
   */
  async getSnapshot(symbols) {
    if (!Array.isArray(symbols) || symbols.length === 0) return [];
    const capturedAt = new Date().toISOString();
    return Promise.all(
      symbols.map(async (symbol) => {
        const rows = await this.getDailyHistory(symbol);
        if (rows.length === 0) throw new Error(`Stooq empty data (${symbol})`);
        const last = rows[rows.length - 1];
        const prev = rows[rows.length - 2];
        const changeRate = prev && prev.close !== 0 ? last.close / prev.close - 1 : null;
        return { symbol, price: last.close, changeRate, volume: last.volume, capturedAt };
      }),
    );
  }
}

/**
 * Stooq CSV 텍스트를 파싱한다. 헤더 1줄 + 데이터.
 * @param {string} text
 * @returns {Array<{date:string, close:number, volume:number|null}>}
 */
export const parseStooqCsv = (text) => {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const header = lines[0].toLowerCase();
  // 데이터가 없으면 Stooq 는 "N/D" 등을 반환 → 무시
  if (!header.includes("close")) return [];
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 5) continue;
    const close = Number(cols[4]);
    if (!Number.isFinite(close)) continue;
    const volume = cols[5] != null ? Number(cols[5]) : null;
    out.push({ date: cols[0], close, volume: Number.isFinite(volume) ? volume : null });
  }
  return out;
};
