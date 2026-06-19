-- 0001_init.sql
-- LLM 모의투자 연구소 초기 스키마 (MVP: Gemini × ETF)
-- 금액·수량은 numeric 사용 (부동소수점 금지).
-- 재현성: market_snapshots + llm_requests(메타) + fills.fill_rule 로 과거 실험 재현.

-- ============================================================
-- 1. 마스터 / 설정
-- ============================================================

create table if not exists models (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,          -- 'gemini' | 'gpt' | 'claude'
  display_name  text not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists strategies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,          -- 'etf' | 'leverage_etf' | 'index'
  description   text,
  created_at    timestamptz not null default now()
);

create table if not exists allowed_symbols (
  id            uuid primary key default gen_random_uuid(),
  strategy_id   uuid not null references strategies(id) on delete cascade,
  symbol        text not null,
  max_weight    numeric not null default 1.0,  -- 0~1
  created_at    timestamptz not null default now(),
  unique (strategy_id, symbol)
);

create table if not exists prompt_versions (
  id            uuid primary key default gen_random_uuid(),
  model_id      uuid not null references models(id) on delete cascade,
  version       text not null,
  content       text not null,                 -- prompt_snapshot
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (model_id, version)
);

-- ============================================================
-- 2. 포트폴리오 상태
-- ============================================================

create table if not exists portfolios (
  id               uuid primary key default gen_random_uuid(),
  model_id         uuid not null references models(id),
  strategy_id      uuid not null references strategies(id),
  initial_capital  numeric not null,
  cash             numeric not null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (model_id, strategy_id)
);

create table if not exists positions (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references portfolios(id) on delete cascade,
  symbol        text not null,
  quantity      numeric not null default 0,
  avg_cost      numeric not null default 0,
  updated_at    timestamptz not null default now(),
  unique (portfolio_id, symbol)
);

create table if not exists portfolio_valuations (
  id              uuid primary key default gen_random_uuid(),
  portfolio_id    uuid not null references portfolios(id) on delete cascade,
  valued_at       timestamptz not null default now(),
  cash            numeric not null,
  holdings_value  numeric not null,
  total_value     numeric not null,
  realized_pnl    numeric not null default 0,
  unrealized_pnl  numeric not null default 0
);

-- ============================================================
-- 3. 시장 데이터
-- ============================================================

create table if not exists market_snapshots (
  id            uuid primary key default gen_random_uuid(),
  symbol        text not null,
  captured_at   timestamptz not null,
  price         numeric not null,
  change_rate   numeric,
  volume        numeric,
  source        text,
  created_at    timestamptz not null default now(),
  unique (symbol, captured_at)
);

create table if not exists technical_indicators (
  id                  uuid primary key default gen_random_uuid(),
  snapshot_id         uuid not null references market_snapshots(id) on delete cascade,
  ma_20               numeric,
  ma_60               numeric,
  ma_120              numeric,
  rsi                 numeric,
  volatility          numeric,
  drawdown_from_high  numeric,
  return_5d           numeric,
  return_20d          numeric,
  return_60d          numeric,
  created_at          timestamptz not null default now(),
  unique (snapshot_id)
);

-- ============================================================
-- 4. LLM 판단 (재현성 핵심)
-- ============================================================

create table if not exists llm_requests (
  id                  uuid primary key default gen_random_uuid(),
  portfolio_id        uuid not null references portfolios(id),
  prompt_version_id   uuid references prompt_versions(id),
  model_version       text not null,
  temperature         numeric not null,
  input_payload       jsonb not null,
  raw_response        jsonb,
  status              text not null,           -- 'OK'|'PARSE_FAIL'|'SCHEMA_FAIL'|'API_FAIL'
  requested_at        timestamptz not null default now()
);

create table if not exists decisions (
  id                        uuid primary key default gen_random_uuid(),
  portfolio_id              uuid not null references portfolios(id),
  llm_request_id            uuid references llm_requests(id),
  snapshot_id               uuid references market_snapshots(id),
  action                    text not null,     -- BUY|SELL|HOLD|REBALANCE
  confidence                numeric,
  rationale                 jsonb not null default '[]'::jsonb,
  risk_flags                jsonb not null default '[]'::jsonb,
  invalidation_conditions   jsonb not null default '[]'::jsonb,
  portfolio_comment         text,
  result                    text not null,     -- 'EXECUTED'|'HOLD'|'FAILED'
  created_at                timestamptz not null default now(),
  -- 동일 스냅샷에 대한 동일 포트폴리오의 중복 판단 방지
  unique (portfolio_id, snapshot_id)
);

-- ============================================================
-- 5. 모의주문 / 체결
-- ============================================================

create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  decision_id   uuid not null references decisions(id) on delete cascade,
  portfolio_id  uuid not null references portfolios(id),
  symbol        text not null,
  side          text not null,                 -- BUY|SELL
  quantity      numeric not null,
  target_weight numeric,
  status        text not null default 'PENDING', -- PENDING|FILLED|REJECTED
  created_at    timestamptz not null default now()
);

create table if not exists fills (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  fill_price    numeric not null,
  slippage      numeric not null default 0,
  fee           numeric not null default 0,
  quantity      numeric not null,
  fill_rule     text not null,                 -- 'IMMEDIATE_PRICE_PLUS_SLIPPAGE'
  filled_at     timestamptz not null default now()
);

-- ============================================================
-- 6. 성과 / 보고서 / 운영
-- ============================================================

create table if not exists daily_performance (
  id                 uuid primary key default gen_random_uuid(),
  portfolio_id       uuid not null references portfolios(id) on delete cascade,
  date               date not null,
  daily_return       numeric,
  cumulative_return  numeric,
  max_drawdown       numeric,
  created_at         timestamptz not null default now(),
  unique (portfolio_id, date)
);

create table if not exists reports (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,                 -- 'daily'|'weekly'
  period        text not null,
  content       jsonb not null,
  generated_at  timestamptz not null default now()
);

create table if not exists error_logs (
  id            uuid primary key default gen_random_uuid(),
  context       text,
  message       text,                          -- 인증 정보/키 미포함
  detail        jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists job_runs (
  id            uuid primary key default gen_random_uuid(),
  job_type      text not null,                 -- 'snapshot'|'decision'|'report'
  status        text not null,                 -- 'SUCCESS'|'FAILED'
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  error_id      uuid references error_logs(id)
);

-- ============================================================
-- 인덱스
-- ============================================================
create index if not exists idx_market_snapshots_symbol_time on market_snapshots (symbol, captured_at desc);
create index if not exists idx_decisions_portfolio_time on decisions (portfolio_id, created_at desc);
create index if not exists idx_llm_requests_portfolio_time on llm_requests (portfolio_id, requested_at desc);
create index if not exists idx_orders_portfolio on orders (portfolio_id);
create index if not exists idx_daily_perf_portfolio_date on daily_performance (portfolio_id, date desc);
