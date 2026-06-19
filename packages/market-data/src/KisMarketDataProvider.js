import { MarketDataProvider } from "./MarketDataProvider.js";

/**
 * 한국투자증권(KIS) Open API 기반 시장 데이터 Provider.
 * 키 기반 정식 API라 5분 인트라데이 폴링이 가능하다 (공유 IP 429/봇차단 회피).
 *
 * 시세 조회 전용으로만 사용한다 (실제 주문 호출 없음). 모의투자는 자체 엔진이 담당.
 *
 * 종목 구분:
 *   - 6자리 숫자  → 국내 (예: "005930")
 *   - 그 외 영문  → 미국 (예: "SPY"), 거래소코드는 exchangeMap 으로 지정(기본 NAS)
 *
 * 토큰은 24시간 유효 → 캐싱 후 만료 임박 시 재발급한다 (발급 호출도 제한이 있어 캐싱 필수).
 *
 * 참고: KIS 응답 필드명은 공식 문서 기준으로 작성했으나, 실제 키로 호출 시
 *       응답 스키마가 다르면 parse* 함수만 조정하면 된다.
 */
export class KisMarketDataProvider extends MarketDataProvider {
  /**
   * @param {object} cfg
   * @param {string} cfg.appKey
   * @param {string} cfg.appSecret
   * @param {string} [cfg.baseUrl]        실전 https://openapi.koreainvestment.com:9443
   * @param {Map<string,string>} [cfg.exchangeMap]  미국 종목 → 거래소(NAS/NYS/AMS)
   * @param {typeof fetch} [cfg.fetchImpl]
   */
  constructor({
    appKey,
    appSecret,
    baseUrl = "https://openapi.koreainvestment.com:9443",
    exchangeMap = new Map(),
    fetchImpl = fetch,
  } = {}) {
    super();
    this.appKey = appKey;
    this.appSecret = appSecret;
    this.baseUrl = baseUrl;
    this.exchangeMap = exchangeMap;
    this.fetchImpl = fetchImpl;
    this._token = null;
    this._tokenExpiry = 0;
  }

  /** 국내 종목 여부 (6자리 숫자) */
  isDomestic(symbol) {
    return /^\d{6}$/.test(symbol);
  }

  /** 접근토큰 발급/캐싱. 만료 60초 전이면 재발급. */
  async getToken() {
    if (this._token && Date.now() < this._tokenExpiry - 60_000) return this._token;
    const res = await this.fetchImpl(`${this.baseUrl}/oauth2/tokenP`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: this.appKey,
        appsecret: this.appSecret,
      }),
    });
    if (!res.ok) throw new Error(`KIS 토큰 발급 실패: HTTP ${res.status}`);
    const data = await res.json();
    this._token = data.access_token;
    // expires_in(초) 기준, 없으면 24시간으로 가정
    this._tokenExpiry = Date.now() + (Number(data.expires_in ?? 86400) * 1000);
    return this._token;
  }

  async #headers(trId) {
    const token = await this.getToken();
    return {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      appkey: this.appKey,
      appsecret: this.appSecret,
      tr_id: trId,
    };
  }

  /** 국내 현재가 1건 */
  async #domesticQuote(symbol) {
    const url = new URL(`${this.baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price`);
    url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
    url.searchParams.set("FID_INPUT_ISCD", symbol);
    const res = await this.fetchImpl(url, { headers: await this.#headers("FHKST01010100") });
    if (!res.ok) throw new Error(`KIS 국내 시세 실패(${symbol}): HTTP ${res.status}`);
    const o = (await res.json()).output ?? {};
    return {
      price: Number(o.stck_prpr),
      changeRate: o.prdy_ctrt != null ? Number(o.prdy_ctrt) / 100 : null,
      volume: o.acml_vol != null ? Number(o.acml_vol) : null,
      highPrice: o.stck_hgpr != null ? Number(o.stck_hgpr) : null,
    };
  }

  /** 미국 현재가 1건 */
  async #overseasQuote(symbol) {
    const excd = this.exchangeMap.get(symbol) ?? "NAS";
    const url = new URL(`${this.baseUrl}/uapi/overseas-price/v1/quotations/price`);
    url.searchParams.set("AUTH", "");
    url.searchParams.set("EXCD", excd);
    url.searchParams.set("SYMB", symbol);
    const res = await this.fetchImpl(url, { headers: await this.#headers("HHDFS00000300") });
    if (!res.ok) throw new Error(`KIS 해외 시세 실패(${symbol}): HTTP ${res.status}`);
    const o = (await res.json()).output ?? {};
    return {
      price: Number(o.last),
      changeRate: o.rate != null ? Number(o.rate) / 100 : null,
      volume: o.tvol != null ? Number(o.tvol) : null,
      highPrice: o.high != null ? Number(o.high) : null,
    };
  }

  /**
   * 현재 시세 스냅샷 (국내/미국 자동 분기). 급락 감지를 위해 highPrice(당일 고가)도 포함.
   * @param {string[]} symbols
   */
  async getSnapshot(symbols) {
    if (!Array.isArray(symbols) || symbols.length === 0) return [];
    const capturedAt = new Date().toISOString();
    return Promise.all(
      symbols.map(async (symbol) => {
        const q = this.isDomestic(symbol)
          ? await this.#domesticQuote(symbol)
          : await this.#overseasQuote(symbol);
        return { symbol, capturedAt, ...q };
      }),
    );
  }

  /**
   * 일봉 종가 시계열(오래된→최신).
   * @param {string} symbol
   * @param {{ days?: number }} [opts]
   */
  async getDailyCloses(symbol, { days = 100 } = {}) {
    if (this.isDomestic(symbol)) {
      const end = ymd(new Date());
      const start = ymd(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
      const url = new URL(`${this.baseUrl}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`);
      url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
      url.searchParams.set("FID_INPUT_ISCD", symbol);
      url.searchParams.set("FID_INPUT_DATE_1", start);
      url.searchParams.set("FID_INPUT_DATE_2", end);
      url.searchParams.set("FID_PERIOD_DIV_CODE", "D");
      url.searchParams.set("FID_ORG_ADJ_PRC", "0");
      const res = await this.fetchImpl(url, { headers: await this.#headers("FHKST03010100") });
      if (!res.ok) throw new Error(`KIS 국내 일봉 실패(${symbol}): HTTP ${res.status}`);
      const rows = (await res.json()).output2 ?? [];
      // KIS 는 최신→과거 순으로 주므로 역순 정렬
      return rows.map((r) => Number(r.stck_clpr)).filter(Number.isFinite).reverse();
    }
    const excd = this.exchangeMap.get(symbol) ?? "NAS";
    const url = new URL(`${this.baseUrl}/uapi/overseas-price/v1/quotations/dailyprice`);
    url.searchParams.set("AUTH", "");
    url.searchParams.set("EXCD", excd);
    url.searchParams.set("SYMB", symbol);
    url.searchParams.set("GUBN", "0"); // 0:일
    url.searchParams.set("BYMD", "");
    url.searchParams.set("MODP", "1");
    const res = await this.fetchImpl(url, { headers: await this.#headers("HHDFS76240000") });
    if (!res.ok) throw new Error(`KIS 해외 일봉 실패(${symbol}): HTTP ${res.status}`);
    const rows = (await res.json()).output2 ?? [];
    return rows.map((r) => Number(r.clos)).filter(Number.isFinite).reverse();
  }
}

/** Date → "YYYYMMDD" */
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
