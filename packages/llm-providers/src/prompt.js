/**
 * 투자 판단 프롬프트 빌더 (모델 공통).
 * 정리된 시장 데이터 + 포트폴리오 상태를 받아 LLM 에게 줄 텍스트를 만든다.
 * LLM 은 계산하지 않고, 주어진 값으로 최종 판단만 내린다.
 * 응답은 반드시 InvestmentDecision JSON 스키마를 따르도록 지시한다.
 */

export const SYSTEM_INSTRUCTION = [
  "당신은 보수적이고 일관된 ETF 투자 판단가입니다.",
  "주어진 시장 데이터와 포트폴리오 상태만 보고 판단합니다. 외부 지식이나 추측을 더하지 마세요.",
  "반드시 JSON 한 개만 출력합니다. 코드블록·설명 문장을 덧붙이지 마세요.",
  "허용된 종목만 거래하고, 현금/보유수량/최대비중 제약을 넘기지 마세요.",
  "확신이 없으면 action 을 HOLD 로 두세요. 임의의 매매를 만들지 마세요.",
].join("\n");

/**
 * 응답 JSON 형태 안내 (스키마 설명).
 */
export const RESPONSE_SHAPE = `{
  "action": "BUY | SELL | HOLD | REBALANCE",
  "orders": [{ "symbol": "SPY", "side": "BUY | SELL", "targetWeight": 0~1(선택), "quantity": 양수(선택) }],
  "confidence": 0~1,
  "rationale": ["판단 근거"],
  "riskFlags": ["위험 요인"],
  "invalidationConditions": ["이 판단이 틀리는 조건"],
  "portfolioComment": "포트폴리오에 대한 코멘트"
}`;

/**
 * @param {object} input
 * @param {string[]} input.allowedSymbols
 * @param {Array<{symbol:string, price:number, changeRate:number|null, indicators?:object}>} input.market
 * @param {{cash:number, initialCapital:number, positions:Array<{symbol:string, quantity:number, avgCost:number}>}} input.portfolio
 * @param {Array<{action:string, createdAt?:string}>} [input.recentDecisions]
 * @returns {string}
 */
export const buildDecisionPrompt = (input) => {
  const { allowedSymbols, market, portfolio, recentDecisions = [] } = input;
  const lines = [];

  lines.push("## 투자 가능 종목");
  lines.push(allowedSymbols.join(", "));

  lines.push("\n## 시장 데이터");
  for (const m of market) {
    const ind = m.indicators ?? {};
    lines.push(
      `- ${m.symbol}: price=${m.price}, change=${fmtPct(m.changeRate)}, ` +
        `ma20=${fmt(ind.ma_20)}, ma60=${fmt(ind.ma_60)}, rsi=${fmt(ind.rsi)}, ` +
        `vol=${fmt(ind.volatility)}, ddFromHigh=${fmtPct(ind.drawdown_from_high)}`,
    );
  }

  lines.push("\n## 포트폴리오 상태");
  lines.push(`- 현금: ${portfolio.cash}`);
  lines.push(`- 초기 투자금: ${portfolio.initialCapital}`);
  if (portfolio.positions.length === 0) {
    lines.push("- 보유 종목: 없음");
  } else {
    for (const p of portfolio.positions) {
      lines.push(`- 보유: ${p.symbol} ${p.quantity}주 (평균단가 ${p.avgCost})`);
    }
  }

  if (recentDecisions.length > 0) {
    lines.push("\n## 최근 판단");
    for (const d of recentDecisions.slice(0, 5)) {
      lines.push(`- ${d.createdAt ?? ""} ${d.action}`);
    }
  }

  lines.push("\n## 출력 형식");
  lines.push("아래 JSON 형태로만 응답하세요:");
  lines.push(RESPONSE_SHAPE);

  return lines.join("\n");
};

const fmt = (v) => (v == null ? "n/a" : typeof v === "number" ? v.toFixed(2) : String(v));
const fmtPct = (v) => (v == null ? "n/a" : `${(v * 100).toFixed(2)}%`);
