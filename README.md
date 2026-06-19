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

> Phase 1 진행 중. 완료 시 이 섹션에 설치·실행 방법을 작성한다.
