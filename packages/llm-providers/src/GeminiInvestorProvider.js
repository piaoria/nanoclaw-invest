import { InvestorProvider } from "./InvestorProvider.js";
import { SYSTEM_INSTRUCTION, buildDecisionPrompt } from "./prompt.js";

/**
 * Gemini 기반 투자 판단 Provider.
 *
 * 실제 SDK 호출은 `generate` 함수로 분리(주입)한다:
 *  - 기본값은 @google/genai 를 동적 import 하는 함수(키 필요)
 *  - 테스트에서는 mock generate 를 주입 → SDK/키 없이도 검증 가능
 *
 * decide() 는 원본 응답과 재현성 메타(modelVersion, temperature)를 반환하고,
 * 스키마 검증/저장은 Investment Core(파이프라인)가 담당한다.
 */
export class GeminiInvestorProvider extends InvestorProvider {
  /**
   * @param {object} cfg
   * @param {string} [cfg.apiKey]
   * @param {string} [cfg.model]
   * @param {number} [cfg.temperature]
   * @param {(args:{model:string, system:string, prompt:string, temperature:number})=>Promise<string>} [cfg.generate]
   */
  constructor({ apiKey, model = "gemini-2.0-flash", temperature = 0.2, generate } = {}) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.temperature = temperature;
    this.generate = generate ?? defaultGenerate(apiKey);
  }

  /**
   * @param {object} input  buildDecisionPrompt 입력
   * @returns {Promise<{raw:string, modelVersion:string, temperature:number, prompt:string}>}
   */
  async decide(input) {
    const prompt = buildDecisionPrompt(input);
    const raw = await this.generate({
      model: this.model,
      system: SYSTEM_INSTRUCTION,
      prompt,
      temperature: this.temperature,
    });
    return { raw, modelVersion: this.model, temperature: this.temperature, prompt };
  }
}

/**
 * @google/genai 를 사용하는 기본 generate 함수.
 * 동적 import 라서 이 함수를 호출하기 전까지는 패키지가 없어도 모듈 로드가 가능하다.
 * @param {string} apiKey
 */
const defaultGenerate = (apiKey) => async ({ model, system, prompt, temperature }) => {
  if (!apiKey) throw new Error("GEMINI_API_KEY 가 필요합니다.");
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: system,
      temperature,
      responseMimeType: "application/json",
    },
  });
  return res.text;
};
