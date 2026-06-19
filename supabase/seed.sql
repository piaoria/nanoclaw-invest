-- seed.sql
-- MVP 기준 시드 데이터: Gemini × ETF 포트폴리오 1개를 생성한다.

-- 모델
insert into models (name, display_name)
values ('gemini', 'Gemini')
on conflict (name) do nothing;

-- 전략
insert into strategies (name, description)
values ('etf', '일반 ETF 투자')
on conflict (name) do nothing;

-- 투자 가능 종목 (ETF 전략) — MVP 예시
insert into allowed_symbols (strategy_id, symbol, max_weight)
select s.id, v.symbol, v.max_weight
from strategies s
cross join (values
  ('SPY', 0.6),
  ('QQQ', 0.6),
  ('IWM', 0.4)
) as v(symbol, max_weight)
where s.name = 'etf'
on conflict (strategy_id, symbol) do nothing;

-- Gemini × ETF 포트폴리오 (초기 자본 100,000)
insert into portfolios (model_id, strategy_id, initial_capital, cash)
select m.id, s.id, 100000, 100000
from models m, strategies s
where m.name = 'gemini' and s.name = 'etf'
on conflict (model_id, strategy_id) do nothing;
