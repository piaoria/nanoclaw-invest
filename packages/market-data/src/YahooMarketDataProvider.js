import yahooFinance from "yahoo-finance2";
import { MarketDataProvider } from "./MarketDataProvider.js";

/**
 * Yahoo Finance 기반 시장 데이터 Provider (무료, 키 불필요).
 * 비공식 API 이므로 끊길 수 있다 → MarketDataProvider 인터페이스로 추상화하여
 * 추후 다른 소스로 교체 가능하게 유지한다.
 *
 * 티커는 종류를 가리지 않는다:
 *   ETF(SPY), 레버리지 ETF(TQQQ), 지수(^GSPC) 모두 동일하게 조회한다.
 */
export class YahooMarketDataProvider extends MarketDataProvider {
  /**
   * @param {{ client?: any }} [deps]  테스트 주입용
   */
  constructor({ client = yahooFinance } = {}) {
    super();
    this.client = client;
  }

  /**
   * 여러 종목의 현재 시세 스냅샷을 반환한다.
   * @param {string[]} symbols
   * @returns {Promise<Array<{symbol:string, price:number, changeRate:number|null, volume:number|null, capturedAt:string}>>}
   */
  async getSnapshot(symbols) {
    if (!Array.isArray(symbols) || symbols.length === 0) return [];
    const capturedAt = new Date().toISOString();
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const q = await this.client.quote(symbol);
        return {
          symbol,
          price: q.regularMarketPrice,
          changeRate:
            q.regularMarketChangePercent != null ? q.regularMarketChangePercent / 100 : null,
          volume: q.regularMarketVolume ?? null,
          capturedAt,
        };
      }),
    );
    return results;
  }

  /**
   * 지표 계산용 과거 일봉 종가 시계열(오래된→최신)을 반환한다.
   * @param {string} symbol
   * @param {{ days?: number }} [opts]
   * @returns {Promise<number[]>}
   */
  async getDailyCloses(symbol, { days = 200 } = {}) {
    const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.client.historical(symbol, { period1, interval: "1d" });
    return rows.map((r) => r.close).filter((c) => typeof c === "number");
  }
}
