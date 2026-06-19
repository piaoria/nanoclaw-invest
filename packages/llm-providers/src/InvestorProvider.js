/**
 * 모든 투자 모델(Gemini/GPT/Claude)이 구현해야 하는 공통 인터페이스.
 * 모델별 API 호출 방식은 달라도 입력과 출력 형식은 동일하게 유지한다.
 * 공정 비교를 위해 한 모델의 판단을 다른 모델에 전달하지 않는다.
 *
 * 구현체(GeminiInvestorProvider 등)는 Phase 4 에서 작성한다.
 */
export class InvestorProvider {
  /**
   * 정리된 시장 데이터 + 포트폴리오 상태를 받아 투자 판단을 반환한다.
   * 반환값은 @lab/contracts 의 investmentDecisionSchema 를 통과해야 한다.
   * 호출 메타데이터(model_version, temperature, prompt, raw_response)는
   * 재현성을 위해 Investment Core 에서 저장한다.
   * @param {object} _input
   * @returns {Promise<{ raw: unknown, modelVersion: string, temperature: number }>}
   */
  async decide(_input) {
    throw new Error("decide() must be implemented");
  }
}
