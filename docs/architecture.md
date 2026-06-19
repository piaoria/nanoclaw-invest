# 아키텍처 설계

## 1. 시스템 개요

LLM 모의투자 연구소는 동일한 시장 데이터를 여러 LLM(Gemini/GPT/Claude)에 제공하고,
각 모델의 투자 판단·성과·성향을 장기간 기록·비교하는 실험 시스템이다.
실제 주문은 하지 않으며 모의주문만 수행한다.

## 2. 컴포넌트와 책임 경계

```text
┌─────────────────────────── Mac mini 호스트 ───────────────────────────┐
│                                                                       │
│  NanoClaw (호스트 직접 실행, Compose 밖)                               │
│   ├─ 두뇌: Claude (오케스트레이터) — NanoClaw 네이티브 provider        │
│   ├─ 세션 / 메모리 (SQLite, 영속 볼륨)                                 │
│   ├─ 예약 작업 (스케줄러)                                              │
│   └─ src/tools/  ← 우리가 만드는 "얇은 커스텀 도구" (in-process MCP)   │
│                     투자 로직 없음. Investment Core를 HTTP로 호출만.    │
│                                                                       │
│  Docker Compose (투자 서비스만)                                       │
│   ├─ investment-core    : 투자 실험의 실제 로직과 상태                 │
│   ├─ investment-worker  : 예약/배치 실행 (스냅샷·판단·보고서)          │
│   ├─ query-api          : 읽기 전용 조회 API (toss_cmd 등 외부 소비자) │
│   └─ agent-gateway      : (향후) 외부 채팅 ↔ NanoClaw 연결            │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                         클라우드 Supabase
                       (투자 실험 Source of Truth)

External APIs: Gemini / (향후) OpenAI / Anthropic
```

### 신뢰 경계 / 보안
- NanoClaw는 호스트 Docker를 제어한다(소켓 = 사실상 root 권한).
  이 권한을 **투자 서비스 컨테이너에 절대 넘기지 않는다.** Docker Socket 마운트 금지.
- NanoClaw ↔ 투자 서비스는 오직 HTTP/Tool 호출로만 통신한다.
  한쪽이 뚫려도 다른 쪽으로 번지지 않는다.
- 외부 메시징 채널(WhatsApp/Telegram 등)은 공격 표면이므로 MVP에서는 사용하지 않고
  로컬 CLI / 최소 테스트 채널만 사용한다.

## 3. 핵심 분리 원칙

### NanoClaw 두뇌 Claude ≠ 투자 펀드 Claude
- 오케스트레이터 Claude: 사용자 대화, 도구 호출, 결과 조회 (NanoClaw 네이티브)
- 투자 펀드 Claude: 시장 데이터를 보고 투자 판단 (Investment Core의 llm-providers에서 호출)
- 같은 모델이라도 프롬프트·세션·책임을 분리한다.

### 도구는 얇게, 로직은 Core에
- `nanoclaw/src/tools/` 함수는 Investment Core API를 부르는 얇은 래퍼.
- 시장데이터·LLM호출·검증·체결·계산·저장은 모두 Investment Core가 담당.
- 이유: 공정성·재현성 통제를 한 곳(Core)에 모으고, Query API 등 다른 소비자도 같은 Core를 재사용.

### 투자 LLM 호출은 NanoClaw provider를 쓰지 않는다
- NanoClaw provider는 "에이전트를 어떤 두뇌로 굴릴지" 선택용이라 목적이 다르다.
- 투자 판단은 호출마다 동일 스키마·temperature·prompt_snapshot·raw_response 저장이 필요하므로
  Investment Core의 `packages/llm-providers/`에서 직접 API를 호출한다.

## 4. Gemini × ETF MVP 데이터 흐름

```text
[1] 예약 작업 트리거 (NanoClaw 스케줄러 또는 investment-worker)
        │
[2] 시장 데이터 수집 (packages/market-data, 무료 소스 → Provider 추상화)
        │   현재가/등락률/거래량 등 원시 데이터
        ▼
[3] 정규화 + 기술적 지표 계산 (packages/indicators)
        │   이동평균(20/60/120), RSI, 변동성, MDD 등
        ▼
[4] 시장 스냅샷 저장 (Supabase: market_snapshots, technical_indicators)
        │   ※ 판단 시각의 가격 스냅샷 = 재현성의 핵심
        ▼
[5] LLM 입력 데이터 구성 (스냅샷 + 현재 포트폴리오 상태 + 최근 판단)
        ▼
[6] GeminiInvestorProvider.decide(input)  (packages/llm-providers)
        │   model_version / temperature 고정·기록
        ▼
[7] 응답 처리 파이프라인 (investment-core)
        JSON 파싱 → 스키마 검증(Zod) → 허용 종목 검증
        → 현금/보유수량 검증 → 최대 비중 검증 → 중복 주문 검증
        │   실패 시 HOLD 또는 FAILED로 기록 (임의 주문 금지)
        ▼
[8] 모의주문 생성 → 모의체결 (판단 당시가 + 수수료 + 슬리피지, 즉시 체결)
        ▼
[9] 포지션·현금·평균매입가 갱신 → 포트폴리오 평가 → 수익률/MDD 계산
        ▼
[10] Supabase 저장 (llm_requests, decisions, orders, fills, positions, portfolio_valuations, daily_performance ...)
        ▼
[11] NanoClaw 도구로 조회: 최근 판단·근거·포트폴리오·일간 보고서
```

### 중복 실행 방지
- 동일 시장 스냅샷에 대해 동일 포트폴리오의 주문을 중복 생성하지 않는다.
- 동일 판단(decision)을 중복 체결하지 않는다.
- DB 유니크 제약 + 애플리케이션 검증 양쪽으로 보장한다.

## 5. API 경계: Query API vs Agent Gateway

| 구분 | Query API | Agent Gateway |
|---|---|---|
| 목적 | 데이터 조회 (읽기 전용) | NanoClaw 대화 연결 |
| 소비자 | toss_cmd 등 외부 화면 | (향후) toss_cmd 채팅 패널 |
| 내용 | 포트폴리오/판단/수익률/보고서 | 세션·응답 스트리밍 |
| 상태 | MVP 이후 | MVP 이후 (확장) |
| 원칙 | Supabase 직접 조회 금지, API 경유 | 조회 로직 미포함, NanoClaw로 전달만 |

두 책임을 같은 서비스에 섞지 않는다. (조회 ≠ 대화)

## 6. 확장 경로
- Gemini × ETF → Gemini 레버리지/지수 → GPT Provider → Claude Investor Provider
- 모든 모델은 `InvestorProvider` 공통 인터페이스를 구현 (입력/출력 스키마 동일)
- 모델 비교는 결과 조회 시점에만 함께 묶는다. 한 모델 판단을 다른 모델에 전달하지 않는다.
