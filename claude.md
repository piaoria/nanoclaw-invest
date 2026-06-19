# CLAUDE.md — llm_investment_lab

## 프로젝트 개요

Mac mini에서 상시 실행되는 **LLM 기반 모의투자 연구소**.

동일한 시장 데이터를 Gemini, GPT, Claude 등 여러 LLM에 제공하고, 각 모델의 투자 판단·성과·성향을 장기간 기록하고 비교한다.

이 프로젝트는 실제 자금을 주문하는 자동매매 시스템이 아니다.

* 실제 주문 금지
* 모의주문만 허용
* 초기 MVP는 `Gemini × ETF`
* 이후 GPT, Claude 및 레버리지·지수 전략 확장
* NanoClaw는 비서 및 오케스트레이터로 사용
* Supabase는 투자 실험의 공식 데이터 저장소로 사용
* `toss_cmd`는 별도 프로젝트이며 선택적으로 조회 API만 연결

---

## 확정된 설계 결정 (2026-06-19)

기획서에서 열려 있던 항목을 다음과 같이 확정한다.

* **시장 데이터**: 무료 소스로 시작한다. 단 `packages/market-data/`는 Provider 인터페이스로 추상화하여 추후 유료 소스로 교체 가능하게 한다.
* **모의체결 방식**: 판단 당시 가격 + 슬리피지로 **즉시 체결**한다. (시가 체결 방식은 채택하지 않음 → 거래 캘린더·휴장일 로직 불필요)
  * 단, 재현을 위해 **판단 시각의 가격 스냅샷**을 반드시 DB에 저장한다.
* **데이터 저장소**: 클라우드 Supabase 단일 인스턴스를 사용한다. (별도 로컬 PostgreSQL을 두지 않음)
* **NanoClaw 실행**: Docker Compose에 넣지 않고 Mac mini 호스트에 직접 실행한다. (Docker-in-Docker 회피)
* **실험 재현성**: LLM 호출마다 `model_version`, `temperature`, `prompt_snapshot`, `raw_response`를 Supabase에 함께 저장한다.

---

## 핵심 아키텍처 원칙

각 영역의 책임을 반드시 분리한다.

### NanoClaw / Claude 오케스트레이터

담당 역할:

* 사용자와의 대화
* 대화 세션과 메모리 관리
* 예약 작업 실행
* Investment Core Tool 호출
* 최근 투자 판단 조회
* 모델별 성과 비교
* 일간·주간 보고서 생성

금지 사항:

* 포트폴리오 금액 직접 수정
* DB 직접 조작
* 모의주문 직접 체결
* 수익률 임의 계산
* 검증되지 않은 LLM 응답 실행

### Investment Core

투자 실험의 실제 상태와 규칙을 관리한다.

담당 역할:

* 시장 데이터 수집
* 기술적 지표 계산
* LLM 입력 데이터 생성
* LLM Provider 호출
* 구조화 응답 검증
* 모의주문과 모의체결
* 현금·포지션 관리
* 포트폴리오 평가
* 수익률 및 MDD 계산
* Supabase 저장
* 중복 실행 방지

### LLM Investor

각 LLM은 동일한 인터페이스를 구현한다.

```js
/**
 * 모든 투자 모델이 구현해야 하는 공통 인터페이스.
 * 모델별 API 호출 방식은 달라도 입력과 출력 형식은 동일하게 유지한다.
 */
class InvestorProvider {
  async decide(input) {
    throw new Error("decide() must be implemented");
  }
}
```

초기 구현:

* `GeminiInvestorProvider`

향후 구현:

* `OpenAIInvestorProvider`
* `ClaudeInvestorProvider`

### Supabase

Supabase는 투자 연구소의 **Source of Truth**다.

반드시 저장할 데이터:

* 모델 및 에이전트 정보
* 전략 프로필
* 시장 데이터 스냅샷
* 기술적 지표
* 프롬프트 버전 (`prompt_snapshot`)
* LLM 요청과 응답 (`raw_response`, `model_version`, `temperature` 포함)
* 투자 판단과 근거
* 모의주문과 체결
* 현금과 보유 종목
* 포트폴리오 평가
* 일별 성과
* 작업 실행 및 오류 기록
* 일간·주간 보고서

NanoClaw 내부 메모리는 대화 연속성을 위한 것이며, 투자 원장으로 사용하지 않는다.

---

## toss_cmd와의 관계

`toss_cmd`는 이 프로젝트와 별개의 프로젝트다.

```text
llm_investment_lab
= 독립적인 투자 실험 서비스

toss_cmd
= 필요할 때 연구소 데이터를 표시하는 외부 조회 화면
```

원칙:

* 별도 Git 저장소 유지
* 직접적인 소스 코드 공유 금지
* `toss_cmd`가 없어도 연구소는 정상 작동
* 연결 시 읽기 전용 HTTP API 사용
* `toss_cmd`에서 Supabase 테이블 직접 조회 금지
* 투자 판단·체결·스케줄 로직을 `toss_cmd`에 구현하지 않음

예상 조회 API:

```text
GET /api/v1/lab/summary
GET /api/v1/portfolios
GET /api/v1/decisions
GET /api/v1/performance/comparison
GET /api/v1/reports/daily/latest
GET /api/v1/reports/weekly/latest
```

채팅 기능은 조회 API와 분리한다.

```text
Query API
= 포트폴리오, 판단, 수익률, 보고서 조회

Agent Gateway
= NanoClaw 대화, 세션 연결, 응답 스트리밍
```

`toss_cmd` 연동은 MVP 필수 기능이 아니다.

---

## 기술 스택

* **언어**: JavaScript

  * Node.js
  * ESM 우선
  * `const`와 `async/await` 사용
* **패키지 관리**: pnpm
* **런타임 검증**: Zod 또는 유사한 경량 스키마 라이브러리
* **에이전트**: NanoClaw + Claude
* **초기 투자 모델**: Gemini API
* **데이터베이스**: 클라우드 Supabase PostgreSQL 단일 (로컬 Postgres 미사용)
* **시장 데이터**: 무료 소스로 시작, `packages/market-data/` Provider 인터페이스로 추상화
* **실행 환경**: Mac mini
* **컨테이너**: Docker, Docker Compose
* **테스트**: Vitest 또는 Node.js Test Runner
* **로깅**: JSON 구조화 로그

Python은 기본 구현 언어로 사용하지 않는다.

다음 상황에서만 별도 서비스나 스크립트로 추가할 수 있다.

* Pandas·NumPy 기반 대량 분석
* 복잡한 백테스트
* 시계열 모델
* 머신러닝 기능
* JavaScript 생태계로 구현하기 어려운 금융 계산

Python 도입 시 기존 Node.js 코어와 명확한 API 경계를 둔다.

---

## 권장 디렉터리 구조

```text
llm_investment_lab/
├── apps/
│   ├── investment-core/
│   │   └── src/
│   │       ├── domain/
│   │       ├── application/
│   │       ├── infrastructure/
│   │       ├── simulation/
│   │       └── index.js
│   │
│   ├── investment-worker/
│   │   └── src/
│   │
│   ├── query-api/
│   │   └── src/
│   │
│   └── agent-gateway/
│       └── src/
│
├── packages/
│   ├── contracts/
│   ├── database/
│   ├── indicators/
│   ├── llm-providers/
│   ├── market-data/
│   └── shared/
│
├── nanoclaw/
│   ├── tools/
│   └── channel-adapter/
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── infra/
│   ├── docker-compose.yml
│   └── scripts/
│
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── prompts.md
│   ├── operations.md
│   └── decisions/
│
├── CLAUDE.md
├── README.md
├── CHANGELOG.md
├── .env.example
├── pnpm-workspace.yaml
└── package.json
```

---

## 모듈 및 파일 원칙

* 한 파일은 하나의 명확한 책임만 가진다.
* 파일명은 역할이 드러나도록 작성한다.
* 클래스 파일은 PascalCase를 사용한다.

  * `GeminiInvestorProvider.js`
  * `PaperOrderService.js`
* 함수 및 유틸리티 파일은 camelCase 또는 kebab-case 중 프로젝트 기준을 통일한다.
* 도메인 로직과 외부 API 호출을 같은 파일에 섞지 않는다.
* Supabase 호출은 `packages/database/` 또는 infrastructure 계층에서만 수행한다.
* Gemini·OpenAI·Claude API 호출은 `packages/llm-providers/`에서만 수행한다.
* 이동평균, RSI, MDD 등 순수 계산 함수는 `packages/indicators/`에 둔다.
* HTTP Route에서 직접 투자 계산이나 DB 로직을 구현하지 않는다.

---

## 코드 스타일

* 들여쓰기: 스페이스 2칸
* 세미콜론: 사용
* 변수: `const` 우선, 재할당 필요 시 `let`
* `var` 금지
* 함수: 화살표 함수 우선
* 비동기 처리: `async/await` 우선
* CommonJS보다 ESM 우선
* 파일 인코딩: UTF-8
* 불필요한 전역 상태 금지
* 금액과 수량 계산에 일반 부동소수점 사용 주의
* 금액은 PostgreSQL `numeric` 또는 Decimal 계열 사용

주석은 코드 내용을 그대로 설명하기보다 다음을 설명할 때 작성한다.

* 해당 검증이 필요한 이유
* 중복 실행을 막아야 하는 이유
* 데이터가 어디에서 들어와 어디로 전달되는지
* 실패 시 어떤 상태로 복구하는지
* 외부 API 제약사항

---

## 투자 판단 원칙

LLM은 자유 형식 문장이 아니라 구조화된 JSON을 반환해야 한다.

```js
const investmentDecisionSchema = {
  action: "BUY | SELL | HOLD | REBALANCE",
  orders: [
    {
      symbol: "string",
      side: "BUY | SELL",
      targetWeight: "number | optional",
      quantity: "number | optional"
    }
  ],
  confidence: "0~1",
  rationale: ["string"],
  riskFlags: ["string"],
  invalidationConditions: ["string"],
  portfolioComment: "string"
};
```

LLM 응답은 반드시 다음 순서로 처리한다.

```text
LLM 응답
→ JSON 파싱
→ 스키마 검증
→ 허용 종목 검증
→ 현금 및 보유 수량 검증
→ 최대 비중 검증
→ 중복 주문 검증
→ 모의주문
→ 모의체결
→ Supabase 저장
```

검증에 실패하면 주문하지 않는다.

기본 처리:

* `HOLD`
* 또는 해당 실행을 `FAILED`로 기록

LLM의 자유 텍스트를 직접 주문 명령으로 사용하지 않는다.

---

## 모의투자 원칙

* 실제 주문 API 호출 금지
* 실제 계좌 연결 금지
* 모의주문만 허용
* 허용 종목 외 주문 금지
* 현금보다 많은 매수 금지
* 보유 수량보다 많은 매도 금지
* 동일 판단 중복 실행 금지
* 동일 시장 스냅샷 중복 주문 금지
* 레버리지 전략은 별도 위험 제한 적용

모의체결 방식은 설정으로 관리하고 DB에 기록한다.

확정된 방식 (2026-06-19):

```text
판단 당시 가격
→ 수수료와 슬리피지 반영 후 즉시 모의체결
```

판단 시각의 가격 스냅샷을 DB에 저장하여 재현성을 보장한다.
"다음 거래일 시가 체결" 방식은 채택하지 않는다.

---

## 투자 실험 구조

투자 모델:

* Gemini
* GPT
* Claude

투자 방식:

* ETF
* 레버리지 ETF
* 지수 투자

최종 확장 목표:

```text
Gemini × ETF
Gemini × 레버리지
Gemini × 지수

GPT × ETF
GPT × 레버리지
GPT × 지수

Claude × ETF
Claude × 레버리지
Claude × 지수
```

각 조합은 독립적인 포트폴리오를 가진다.

모델 비교 시 반드시 동일한 조건을 적용한다.

* 동일 시장 데이터
* 동일 분석 시각
* 동일 초기 투자금
* 동일 수수료와 슬리피지
* 동일 위험 제한
* 동일 응답 스키마
* 동일 모의체결 기준

다른 모델의 판단을 서로에게 전달하지 않는다.

---

## 기능 우선순위

### MVP

1. 프로젝트 및 Docker 환경 구성
2. Supabase 스키마와 Migration
3. 포트폴리오·현금·포지션 모델
4. 모의주문 및 모의체결
5. 시장 데이터 Provider
6. 기술적 지표 계산
7. Gemini 구조화 응답
8. `Gemini × ETF` 포트폴리오
9. 일간 성과 계산
10. NanoClaw Tool 연결
11. NanoClaw 대화 및 메모리 영속화
12. 일간 보고서 생성

### 이후 확장

1. Gemini 레버리지·지수 포트폴리오
2. GPT Provider
3. Claude Investor Provider
4. 모델별 성과 비교
5. Query API
6. `toss_cmd` 조회 화면
7. Agent Gateway 및 채팅 연동
8. 뉴스·공시·거시경제 데이터

---

## Docker 운영 원칙

Mac mini에서 장시간 실행한다.

권장 구분:

```text
NanoClaw
= 공식 방식으로 Mac mini 호스트에서 직접 실행 (Compose 미포함, 확정)

Docker Compose
├── investment-core
├── investment-worker
├── query-api
└── agent-gateway
```

NanoClaw가 Docker 컨테이너를 직접 관리하는 경우, Docker Socket을 무분별하게 다른 컨테이너에 마운트하지 않는다.

컨테이너 재시작 후에도 다음 데이터가 유지되어야 한다.

* NanoClaw SQLite
* NanoClaw 세션
* `CLAUDE.md`
* 에이전트 워크스페이스
* 예약 작업
* 로컬 운영 로그

투자 관련 공식 데이터는 Supabase에 저장한다.

---

## 환경변수 및 보안

다음 정보는 코드에 하드코딩하지 않는다.

* Anthropic API Key
* Gemini API Key
* OpenAI API Key
* Supabase URL
* Supabase Key
* 시장 데이터 Provider Key

원칙:

* `.env` Git 커밋 금지
* `.env.example`에는 키 이름만 작성
* API Key 로그 출력 금지
* API Key를 LLM 프롬프트에 포함하지 않음
* 브라우저에 `service_role` 키 전달 금지
* 에러 메시지에 인증 Header 출력 금지

---

## 변경 관리

기능 추가 또는 수정 시 `CHANGELOG.md`를 갱신한다.

형식:

```text
## [YYYY-MM-DD] — 변경 내용
```

커밋 메시지:

```text
[feat] Gemini 투자 판단 Provider 추가
[fix] 동일 스냅샷 중복 주문 방지
[docs] NanoClaw 메모리 구조 문서화
[refactor] 포트폴리오 계산 로직 분리
[chore] Docker health check 추가
```

사용 가능한 타입:

* `feat`
* `fix`
* `test`
* `docs`
* `refactor`
* `style`
* `chore`

아키텍처 결정이나 기존 계획 변경 시 다음 경로에 기록한다.

```text
docs/decisions/
```

---

## 개발 환경

모든 개발은 모바일 `/rc` Remote Control 모드로 진행할 수 있다.

Claude 응답 규칙:

* 한국어로 응답
* 모바일 화면 기준으로 짧게 작성
* 넓은 표와 긴 ASCII 다이어그램 지양
* 헤더와 짧은 불릿 중심
* 한 번에 너무 많은 작업을 수행하지 않음
* 변경되지 않은 전체 파일을 반복 출력하지 않음
* 변경된 부분과 새 파일 중심으로 설명
* 명령어는 복사 가능한 코드 블록으로 제공

각 작업 시작 전 다음을 먼저 안내한다.

* 이번 작업 목표
* 변경 또는 생성할 파일
* DB 변경 여부
* Docker 변경 여부
* 완료 확인 방법

각 작업 완료 후 다음을 정리한다.

* 구현 결과
* 변경된 파일
* 실행 방법
* 테스트 방법
* 남은 문제
* 다음 작업

---

## Claude와 협업 시 주의사항

* 전체 코드를 한 번에 만들지 않는다.
* 먼저 설계와 현재 프로젝트 상태를 확인한다.
* 사용자가 이미 결정한 내용을 반복해서 질문하지 않는다.
* 외부 라이브러리 도입 전 필요성과 번들·런타임 영향을 설명한다.
* 과도한 추상화와 불필요한 마이크로서비스를 피한다.
* Kafka, Kubernetes 등은 명확한 필요가 없는 한 도입하지 않는다.
* DB 모델 변경 시 Migration과 관련 서비스 코드를 먼저 수정한다.
* LLM Provider 추가 시 공통 인터페이스와 테스트를 함께 수정한다.
* 투자 로직 변경 시 기존 포트폴리오 재현성에 미치는 영향을 설명한다.
* 기능 완료 후 `CHANGELOG.md` 업데이트를 제안한다.
* API 응답 형식 변경 시 `toss_cmd` 등 외부 Consumer 영향을 확인한다.
* 실제 주문 기능을 추가하지 않는다.
* 사용자 요청 없이 운영 DB 데이터를 삭제하거나 초기화하지 않는다.
* `rm -rf`, 강제 Migration 초기화 등 위험 명령은 실행 전 반드시 경고한다.

---

## 첫 작업 원칙

구현을 시작하기 전에 다음을 먼저 확인한다.

1. 현재 NanoClaw 버전과 공식 실행 구조
2. NanoClaw의 세션 및 메모리 저장 위치
3. NanoClaw와 Docker Compose 서비스 경계
4. Supabase와 NanoClaw 메모리의 책임 구분
5. Gemini Free Tier 및 API 제한
6. 시장 데이터 Provider 후보
7. 모의체결 기준
8. MVP Supabase 테이블
9. `Gemini × ETF` 전체 데이터 흐름

확인되지 않은 NanoClaw 내부 구조를 추측으로 구현하지 않는다.

설계 검토 결과와 위험 요소를 먼저 보고한 뒤 Phase 단위로 구현한다.
