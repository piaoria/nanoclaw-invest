/**
 * 모든 시장 데이터 소스가 구현해야 하는 공통 인터페이스.
 * 무료 소스로 시작하되, 추후 유료 소스로 교체 가능하도록 추상화한다.
 * 구현체는 Phase 3 에서 작성한다.
 */
export class MarketDataProvider {
  /**
   * 주어진 종목들의 현재 시세 스냅샷을 반환한다.
   * @param {string[]} _symbols
   * @returns {Promise<Array<{ symbol: string, price: number, changeRate: number, volume: number, capturedAt: string }>>}
   */
  async getSnapshot(_symbols) {
    throw new Error("getSnapshot() must be implemented");
  }
}
