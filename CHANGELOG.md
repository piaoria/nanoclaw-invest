# 변경 이력

형식: `## [YYYY-MM-DD] — 변경 내용`

## [2026-06-19] — Phase 1: 기반 구성

- pnpm workspace 구성 (apps/* , packages/*)
- 공통 패키지: `@lab/shared`(env 검증·JSON 로거), `@lab/contracts`(투자판단 Zod 스키마)
- `@lab/database`(Supabase 클라이언트·ping), 인터페이스 골격(indicators/market-data/llm-providers)
- `investment-core` 앱: Health Check 서버(/health, /health/db)
- Supabase 초기 마이그레이션(`0001_init.sql`) 및 시드(`seed.sql`)
- Docker Compose(투자 서비스) 및 investment-core Dockerfile
- 단위 테스트(vitest) 4건 통과

## [2026-06-19] — 설계 검토 및 기반 문서화

- 기획서 검토, NanoClaw 구조 파악, 핵심 설계 결정 확정
- `claude.md` 에 확정된 설계 결정 반영 (체결 방식·데이터 소스·저장소·NanoClaw 실행)
- 설계 문서 작성: `docs/architecture.md`, `docs/database.md`, `docs/operations.md`
- 아키텍처 결정 기록: `docs/decisions/0001-foundational-decisions.md`
- 저장소 초기화: `.gitignore`, `README.md`, `CHANGELOG.md`
