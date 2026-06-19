import express from "express";
import { pingDatabase } from "@lab/database";
import { runDailyCycle } from "./application/runDailyCycle.js";
import { generateDailyReport } from "./application/generateDailyReport.js";

/**
 * investment-core HTTP 서버.
 * NanoClaw 의 얇은 도구가 호출하는 엔드포인트를 제공한다.
 * 라우트는 application 서비스로 위임만 하고, 투자 로직을 직접 구현하지 않는다.
 *
 * @param {object} ctx  createContext() 결과
 */
export const createServer = (ctx) => {
  const app = express();
  app.use(express.json());

  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      ctx.logger?.error?.("요청 처리 실패", { path: req.path, error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  };

  // --- Health ---
  app.get("/health", (_req, res) => res.json({ ok: true, service: "investment-core" }));
  app.get(
    "/health/db",
    wrap(async (_req, res) => {
      const r = await pingDatabase(ctx.supabase);
      res.status(r.ok ? 200 : 503).json(r);
    }),
  );

  // --- 일일 사이클: 수집 + 판단 + 체결 + 저장 ---
  app.post(
    "/portfolios/:id/cycle",
    wrap(async (req, res) => {
      const result = await runDailyCycle({
        portfolioId: req.params.id,
        portfolioRepo: ctx.portfolioRepo,
        marketRepo: ctx.marketRepo,
        tradingRepo: ctx.tradingRepo,
        marketProvider: ctx.marketProvider,
        investorProvider: ctx.investorProvider,
        config: ctx.tradeConfig,
        logger: ctx.logger,
      });
      res.json({ ok: true, ...result });
    }),
  );

  // --- 포트폴리오 상태 조회 ---
  app.get(
    "/portfolios/:id",
    wrap(async (req, res) => {
      const pf = await ctx.portfolioRepo.loadPortfolioState(req.params.id);
      const positions = [...pf.positions.entries()].map(([symbol, p]) => ({ symbol, ...p }));
      res.json({
        ok: true,
        portfolio: {
          id: pf.id,
          cash: pf.cash,
          initialCapital: pf.initialCapital,
          positions,
        },
      });
    }),
  );

  // --- 최근 판단 조회 ---
  app.get(
    "/portfolios/:id/decisions",
    wrap(async (req, res) => {
      const limit = Number(req.query.limit ?? 10);
      const decisions = await ctx.portfolioRepo.getRecentDecisions(req.params.id, limit);
      res.json({ ok: true, decisions });
    }),
  );

  // --- 일간 보고서 생성 ---
  app.post(
    "/portfolios/:id/report/daily",
    wrap(async (req, res) => {
      const pf = await ctx.portfolioRepo.loadPortfolioState(req.params.id);
      const positions = [...pf.positions.entries()].map(([symbol, p]) => ({ symbol, ...p }));
      const date = req.body?.date ?? new Date().toISOString().slice(0, 10);
      // 현재가는 요청 body 로 주거나(테스트/지연 회피), 없으면 평가는 보유수량 기준 0 처리
      const prices = new Map(Object.entries(req.body?.prices ?? {}).map(([k, v]) => [k, Number(v)]));
      const r = await generateDailyReport({
        portfolioId: req.params.id,
        date,
        portfolio: { cash: pf.cash, initialCapital: pf.initialCapital, positions },
        prices,
        valuationHistory: req.body?.valuationHistory ?? [],
        decisions: await ctx.portfolioRepo.getRecentDecisions(req.params.id, 10),
        repo: ctx.reportRepo,
        logger: ctx.logger,
      });
      res.json({ ok: true, report: r.content, reportId: r.reportId });
    }),
  );

  // --- 최신 보고서 조회 ---
  app.get(
    "/reports/daily/latest",
    wrap(async (_req, res) => {
      const report = await ctx.reportRepo.getLatestReport("daily");
      res.json({ ok: true, report });
    }),
  );

  return app;
};
