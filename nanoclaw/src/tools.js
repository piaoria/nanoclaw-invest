import { investmentCore } from "./investmentCoreClient.js";

/**
 * NanoClaw 커스텀 도구 정의.
 *
 * 각 도구는 얇은 래퍼다: Investment Core HTTP API 를 호출해 결과를 돌려줄 뿐,
 * 투자 판단/체결/계산을 직접 수행하지 않는다 (공정성·재현성 통제는 Core 에 집중).
 *
 * 형식은 { name, description, inputSchema, handler } 로 통일했다.
 * NanoClaw(Claude Agent SDK in-process MCP)에 등록할 때 이 배열을 어댑터로 감싼다.
 * (정확한 등록 시그니처는 NanoClaw 설치 버전에 맞춰 adapter 에서 확정한다.)
 */
export const tools = [
  {
    name: "get_portfolio_status",
    description: "포트폴리오의 현금·보유종목·초기투자금 상태를 조회한다.",
    inputSchema: { portfolioId: "string" },
    handler: ({ portfolioId }) => investmentCore.getPortfolio(portfolioId),
  },
  {
    name: "run_daily_cycle",
    description: "시장 데이터를 수집하고 LLM 투자 판단을 실행해 모의주문까지 처리한다.",
    inputSchema: { portfolioId: "string" },
    handler: ({ portfolioId }) => investmentCore.runCycle(portfolioId),
  },
  {
    name: "get_recent_decisions",
    description: "포트폴리오의 최근 투자 판단과 근거를 조회한다.",
    inputSchema: { portfolioId: "string", limit: "number(optional)" },
    handler: ({ portfolioId, limit }) => investmentCore.getRecentDecisions(portfolioId, limit),
  },
  {
    name: "generate_daily_report",
    description: "포트폴리오의 일간 성과 보고서를 생성한다.",
    inputSchema: { portfolioId: "string", date: "string(optional)", prices: "object(optional)" },
    handler: ({ portfolioId, ...rest }) => investmentCore.generateDailyReport(portfolioId, rest),
  },
  {
    name: "get_latest_daily_report",
    description: "가장 최근에 생성된 일간 보고서를 조회한다.",
    inputSchema: {},
    handler: () => investmentCore.getLatestDailyReport(),
  },
];
