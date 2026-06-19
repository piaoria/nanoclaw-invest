# LLM 모의투자 연구소 (llm-investment-lab)

Mac mini에서 상시 실행되는 **LLM 기반 모의투자 연구소**.
동일한 시장 데이터를 여러 LLM(Gemini/GPT/Claude)에 제공하고, 각 모델의 투자 판단·성과·성향을 장기간 기록·비교한다.

> 실제 자금을 주문하는 자동매매 시스템이 **아니다.** 모의주문만 수행한다.

## 핵심 개념

- **NanoClaw + Claude**: 비서/오케스트레이터. 사용자 대화, 도구 호출, 결과 조회.
- **Investment Core**: 투자 실험의 실제 로직. 시장데이터·LLM호출·검증·모의체결·계산·저장.
- **Supabase**: 투자 실험의 Source of Truth (클라우드 PostgreSQL 단일).
- **toss_cmd**: 별도 프로젝트. 필요 시 Query API로 조회만.

## 현재 상태

- ✅ 설계 검토 및 문서화 (`docs/`)
- 🚧 Phase 1: 기반 구성 (pnpm workspace · Docker Compose · Supabase 연결 · migration)

자세한 개발 단계는 `claude.md`의 기능 우선순위, 설계는 `docs/` 참고.

## 문서

- `docs/architecture.md` — 컴포넌트 경계, Gemini×ETF 데이터 흐름
- `docs/database.md` — Supabase 테이블 설계
- `docs/operations.md` — Mac mini 운영 구조
- `docs/decisions/` — 아키텍처 결정 기록(ADR)

## 기술 스택

Node.js · JavaScript(ESM) · pnpm workspace · Docker Compose · Supabase(PostgreSQL) · Zod · Vitest · NanoClaw + Claude Agent SDK · Gemini API

## 개발 메모

- 확정된 설계 결정: `docs/decisions/0001-foundational-decisions.md`
- 무료 시장 데이터로 시작 / 판단 당시가 + 슬리피지 즉시 체결 / 클라우드 Supabase 단일
- NanoClaw는 호스트 직접 실행(Compose 밖), 투자 서비스만 Compose

## 설치 / 실행

### 1. 사전 준비
- Node.js 22+ / pnpm 10+
- 클라우드 Supabase 프로젝트 (URL + service_role 키)

### 2. 환경변수
```bash
cp .env.example .env
# .env 에 SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY 등을 채운다
```

### 3. 의존성 설치 / 테스트
```bash
pnpm install
pnpm test
```

### 4. DB 마이그레이션
`supabase/migrations/0001_init.sql` 을 Supabase SQL Editor 또는 CLI로 실행한 뒤,
필요 시 `supabase/seed.sql` 로 Gemini × ETF 포트폴리오를 시드한다.

### 5. 로컬 실행
```bash
pnpm core:dev
# Health: http://localhost:4001/health , http://localhost:4001/health/db
```

### 6. Docker (투자 서비스)
```bash
docker compose -f infra/docker-compose.yml up --build
```
> NanoClaw 는 Compose 밖, Mac mini 호스트에 직접 실행한다.

### 7. 한 사이클 직접 실행 (NanoClaw 없이)
```bash
# SUPABASE_*, GEMINI_API_KEY 환경변수가 필요
pnpm --filter @lab/investment-core exec node scripts/runCycle.mjs <portfolioId>
```
수집 → Gemini 판단 → 검증 → 모의체결 → 저장까지 1회 실행한다.

## HTTP 엔드포인트 (investment-core)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/health`, `/health/db` | 헬스체크 |
| POST | `/portfolios/:id/cycle` | 수집+판단+체결 1회 실행 |
| GET | `/portfolios/:id` | 포트폴리오 상태 |
| GET | `/portfolios/:id/decisions` | 최근 판단 |
| POST | `/portfolios/:id/report/daily` | 일간 보고서 생성 |
| GET | `/reports/daily/latest` | 최신 일간 보고서 |

## 급락 모니터 (실시간)

한국투자증권(KIS) 시세로 감시 종목을 5분마다 폴링해 급락을 감지하고 Discord로 알린다.
- 데이터: `KIS_APP_KEY`/`KIS_APP_SECRET` 설정 시 KIS 메인(국내+미국), 미설정 시 무료 소스
- 트리거: 전일대비 `DAILY_DROP_PCT`%, 당일고가대비 `INTRADAY_DROP_PCT`%
- `ENABLE_AUTO_TRADE=true` + `MONITOR_PORTFOLIO_IDS` 지정 시 급락→자동 모의매수 사이클
- 실행: `docker compose` 의 `monitor-worker`, 또는
  ```bash
  pnpm --filter @lab/investment-core exec node src/worker.js
  ```

## NanoClaw 도구

`nanoclaw/src/tools.js` 에 얇은 커스텀 도구를 정의한다 (Core HTTP 호출만).
환경변수 `INVESTMENT_CORE_URL` 로 Core 주소를 지정한다.
- `get_portfolio_status` · `run_daily_cycle` · `get_recent_decisions`
- `generate_daily_report` · `get_latest_daily_report`
