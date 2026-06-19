# Supabase 데이터베이스 설계 (초안)

투자 실험의 Source of Truth. 클라우드 Supabase PostgreSQL 단일 인스턴스.
금액·수량은 `numeric`을 사용한다 (부동소수점 금지).
모든 테이블은 `id uuid default gen_random_uuid()`, `created_at timestamptz default now()` 기본 포함.

> 이 문서는 MVP(Gemini × ETF) 기준 초안이다. 마이그레이션 작성 시 확정한다.

---

## 1. 마스터 / 설정

### models — 투자 모델(LLM) 정보
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| name | text | 'gemini' / 'gpt' / 'claude' |
| display_name | text | 표시명 |
| is_active | boolean | 활성 여부 |

### strategies — 투자 방식
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| name | text | 'etf' / 'leverage_etf' / 'index' |
| description | text | |

### allowed_symbols — 투자 가능 종목 (전략별)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| strategy_id | uuid | FK strategies |
| symbol | text | 예: 'SPY' |
| max_weight | numeric | 최대 투자 비중 (0~1) |

### prompt_versions — 프롬프트 스냅샷 (재현성)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| model_id | uuid | FK models |
| version | text | 버전 태그 |
| content | text | 프롬프트 원문 (prompt_snapshot) |
| is_active | boolean | |

---

## 2. 포트폴리오 상태

### portfolios — 모델 × 전략 조합
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| model_id | uuid | FK models |
| strategy_id | uuid | FK strategies |
| initial_capital | numeric | 초기 투자금 |
| cash | numeric | 현재 현금 |
| is_active | boolean | |
| UNIQUE | (model_id, strategy_id) | 조합당 1개 |

### positions — 보유 종목
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| portfolio_id | uuid | FK portfolios |
| symbol | text | |
| quantity | numeric | 보유 수량 |
| avg_cost | numeric | 평균 매입가 |
| UNIQUE | (portfolio_id, symbol) | |

### portfolio_valuations — 포트폴리오 평가 스냅샷
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| portfolio_id | uuid | FK |
| valued_at | timestamptz | 평가 시각 |
| cash | numeric | |
| holdings_value | numeric | 보유 평가액 |
| total_value | numeric | 총 평가액 |
| realized_pnl | numeric | 실현 손익 |
| unrealized_pnl | numeric | 미실현 손익 |

---

## 3. 시장 데이터

### market_snapshots — 시장 데이터 스냅샷 (판단 시각 가격 = 재현 핵심)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| symbol | text | |
| captured_at | timestamptz | 수집 시각 |
| price | numeric | 현재가 |
| change_rate | numeric | 일간 등락률 |
| volume | numeric | 거래량 |
| source | text | 데이터 출처 |
| UNIQUE | (symbol, captured_at) | |

### technical_indicators — 기술적 지표
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| snapshot_id | uuid | FK market_snapshots |
| ma_20 / ma_60 / ma_120 | numeric | 이동평균 |
| rsi | numeric | |
| volatility | numeric | |
| drawdown_from_high | numeric | 최근 고점 대비 낙폭 |
| return_5d / return_20d / return_60d | numeric | 기간 수익률 |

---

## 4. LLM 판단 (재현성 핵심)

### llm_requests — LLM 요청/응답 기록
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| portfolio_id | uuid | FK |
| prompt_version_id | uuid | FK prompt_versions |
| model_version | text | 실제 호출된 모델 버전 |
| temperature | numeric | 고정값 기록 |
| input_payload | jsonb | LLM 입력 (스냅샷+포트폴리오+최근판단) |
| raw_response | jsonb | 원본 응답 (검증 전) |
| status | text | 'OK' / 'PARSE_FAIL' / 'SCHEMA_FAIL' / 'API_FAIL' |
| requested_at | timestamptz | |

### decisions — 검증된 투자 판단
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| portfolio_id | uuid | FK |
| llm_request_id | uuid | FK llm_requests |
| snapshot_id | uuid | FK market_snapshots (판단 기준 스냅샷) |
| action | text | BUY / SELL / HOLD / REBALANCE |
| confidence | numeric | 0~1 |
| rationale | jsonb | 근거 배열 |
| risk_flags | jsonb | |
| invalidation_conditions | jsonb | |
| portfolio_comment | text | |
| result | text | 'EXECUTED' / 'HOLD' / 'FAILED' |
| UNIQUE | (portfolio_id, snapshot_id) | 동일 스냅샷 중복 판단 방지 |

---

## 5. 모의주문 / 체결

### orders — 모의주문
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| decision_id | uuid | FK decisions |
| portfolio_id | uuid | FK |
| symbol | text | |
| side | text | BUY / SELL |
| quantity | numeric | |
| target_weight | numeric | nullable |
| status | text | 'PENDING' / 'FILLED' / 'REJECTED' |

### fills — 모의체결
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| order_id | uuid | FK orders |
| fill_price | numeric | 체결가 (판단 당시가 기준) |
| slippage | numeric | 반영된 슬리피지 |
| fee | numeric | 수수료 |
| quantity | numeric | |
| filled_at | timestamptz | |
| fill_rule | text | 'IMMEDIATE_PRICE_PLUS_SLIPPAGE' (체결 규칙 기록) |

---

## 6. 성과 / 보고서 / 운영

### daily_performance — 일별 성과
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| portfolio_id | uuid | FK |
| date | date | |
| daily_return | numeric | 일간 수익률 |
| cumulative_return | numeric | 누적 수익률 |
| max_drawdown | numeric | 최대 낙폭 |
| UNIQUE | (portfolio_id, date) | |

### reports — 일간·주간 보고서
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| type | text | 'daily' / 'weekly' |
| period | text | 기간 식별 |
| content | jsonb | 보고서 본문 |
| generated_at | timestamptz | |

### job_runs — 작업 실행 로그
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| job_type | text | 'snapshot' / 'decision' / 'report' |
| status | text | 'SUCCESS' / 'FAILED' |
| started_at / finished_at | timestamptz | |
| error_id | uuid | FK error_logs (nullable) |

### error_logs — 오류 기록
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| context | text | 발생 위치 |
| message | text | (인증 헤더/키 미포함) |
| detail | jsonb | |

---

## 설계 메모
- 재현성: `market_snapshots` + `llm_requests`(model_version·temperature·prompt·raw_response) +
  `fills.fill_rule` 조합으로 과거 실험을 완전히 재현할 수 있어야 한다.
- 공정성: 모든 포트폴리오가 동일 `market_snapshots`를 참조하도록 한다.
- toss_cmd는 이 테이블을 직접 조회하지 않는다. Query API를 경유한다.
