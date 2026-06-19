import { StooqMarketDataProvider } from "./StooqMarketDataProvider.js";
import { YahooMarketDataProvider } from "./YahooMarketDataProvider.js";
import { FallbackMarketDataProvider } from "./FallbackMarketDataProvider.js";

/**
 * 기본 시장 데이터 Provider 를 생성한다.
 * 메인 = Stooq(공유 IP 안정), 보조 = 야후(fallback).
 * @param {{ onFallback?: (info:any)=>void }} [opts]
 */
export const createDefaultMarketDataProvider = ({ onFallback } = {}) =>
  new FallbackMarketDataProvider({
    providers: [new StooqMarketDataProvider(), new YahooMarketDataProvider()],
    onFallback,
  });
