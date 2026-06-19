-- 0002_alerts.sql
-- 급락 감지 알림 기록.

create table if not exists alerts (
  id            uuid primary key default gen_random_uuid(),
  symbol        text not null,
  alert_type    text not null,                 -- 'DAILY_DROP' | 'INTRADAY_DROP' (복수면 쉼표결합)
  price         numeric not null,
  daily_change  numeric,                       -- 전일 대비(소수)
  intraday_drop numeric,                       -- 당일 고가 대비 낙폭(소수)
  reasons       jsonb not null default '[]'::jsonb,
  notified      boolean not null default false, -- Discord 전송 여부
  triggered_cycle boolean not null default false, -- 자동 판단 발동 여부
  created_at    timestamptz not null default now()
);

create index if not exists idx_alerts_symbol_time on alerts (symbol, created_at desc);
