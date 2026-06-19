import { MarketDataProvider } from "./MarketDataProvider.js";

/**
 * 여러 Provider 를 순서대로 시도하는 fallback 체인.
 * 앞 Provider 가 실패(예: Stooq 장애)하면 다음 Provider(야후)로 넘어간다.
 * 어느 소스로 받았는지 로깅할 수 있도록 onFallback 훅을 제공한다.
 *
 * 메인=Stooq, 보조=야후 구성을 기본으로 한다.
 */
export class FallbackMarketDataProvider extends MarketDataProvider {
  /**
   * @param {object} cfg
   * @param {MarketDataProvider[]} cfg.providers  우선순위 순서 (앞이 메인)
   * @param {(info:{method:string, index:number, error:string})=>void} [cfg.onFallback]
   */
  constructor({ providers, onFallback } = {}) {
    super();
    if (!providers || providers.length === 0) {
      throw new Error("providers 가 필요합니다.");
    }
    this.providers = providers;
    this.onFallback = onFallback;
  }

  async #tryEach(method, args) {
    let lastError;
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      if (typeof provider[method] !== "function") continue;
      try {
        return await provider[method](...args);
      } catch (err) {
        lastError = err;
        this.onFallback?.({ method, index: i, error: err.message });
      }
    }
    throw new Error(`모든 Provider 실패 (${method}): ${lastError?.message ?? "unknown"}`);
  }

  getSnapshot(symbols) {
    return this.#tryEach("getSnapshot", [symbols]);
  }

  getDailyCloses(symbol, opts) {
    return this.#tryEach("getDailyCloses", [symbol, opts]);
  }
}
