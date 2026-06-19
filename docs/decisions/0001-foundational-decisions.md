# ADR 0001 — 기반 설계 결정

- 상태: 확정
- 날짜: 2026-06-19

기획서에서 열려 있던 항목과 설계 검토 과정에서 합의한 결정을 기록한다.

## 결정

### 1. 시장 데이터 — 무료 소스로 시작
- 무료 소스로 MVP를 시작한다 (비용 0, 지연·정확도 한계는 감수).
- 단 `packages/market-data/` 는 Provider 인터페이스로 추상화하여 추후 유료 소스로 교체 가능하게 한다.
- 근거: 목적이 "실제 가격 정확도"가 아니라 "동일 데이터로 모델 비교"이므로 MVP에 충분하다.

### 2. 모의체결 — 판단 당시가 + 슬리피지 즉시 체결
- "다음 거래일 시가 체결" 방식은 채택하지 않는다.
- 판단 당시 가격에 수수료·슬리피지를 반영하여 즉시 체결한다.
- 판단 시각의 가격 스냅샷을 DB에 저장해 재현성을 보장한다.
- 부수 효과: 거래 캘린더·휴장일 로직이 불필요해져 MVP가 단순해진다.
- 체결 규칙은 `fills.fill_rule = 'IMMEDIATE_PRICE_PLUS_SLIPPAGE'` 로 기록한다.

### 3. 데이터 저장소 — 클라우드 Supabase 단일
- 클라우드 Supabase PostgreSQL 단일 인스턴스를 사용한다.
- 별도 로컬 PostgreSQL을 두지 않는다 (Supabase = 관리형 Postgres).
- toss_cmd는 Supabase를 직접 조회하지 않고 Query API를 경유한다.

### 4. NanoClaw — 호스트 직접 실행 (Compose 밖)
- NanoClaw를 Docker Compose에 넣지 않고 Mac mini 호스트에 직접 실행한다.
- 근거: NanoClaw 자체가 에이전트를 컨테이너로 띄우는 런타임이라,
  Compose에 넣으면 Docker-in-Docker가 된다. 호스트 네이티브 실행으로 회피한다.
- 투자 서비스 컨테이너에 호스트 docker.sock 을 마운트하지 않는다.

### 5. 실험 재현성 — LLM 호출 메타데이터 저장
- LLM 호출마다 `model_version`, `temperature`, `prompt_snapshot`, `raw_response` 를
  Supabase(`llm_requests`, `prompt_versions`)에 저장한다.
- market_snapshot + 위 메타데이터 + fill_rule 로 과거 실험을 완전히 재현할 수 있어야 한다.

### 6. 투자 LLM 호출 — NanoClaw provider를 사용하지 않음
- NanoClaw provider는 "에이전트 두뇌 선택"용이라 목적이 다르다.
- 투자 판단용 Gemini/GPT/Claude 호출은 `packages/llm-providers/` 에서 직접 수행한다.
- 공정성·재현성 통제를 Investment Core 한 곳에 모으기 위함이다.

### 7. NanoClaw 도구 — 얇은 래퍼
- `nanoclaw/src/tools/` 의 커스텀 도구(in-process MCP 함수)는 투자 로직을 포함하지 않는다.
- Investment Core API를 호출하는 얇은 껍데기로만 구현한다.

### 8. 구현 언어 — JavaScript (ESM)
- CLAUDE.md 기준에 맞춰 JavaScript(ESM)로 통일한다.
  (기획서는 TypeScript로 언급했으나 CLAUDE.md의 JS 명시를 우선한다.)
- 런타임 검증은 Zod, 테스트는 Vitest 또는 Node test runner.

## 진행 방식
- 전체 코드를 한 번에 작성하지 않는다.
- 설계 검토 → 설계 문서(docs/) → Phase 단위 구현 순으로 진행한다.
