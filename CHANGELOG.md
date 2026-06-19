# 변경 이력

형식: `## [YYYY-MM-DD] — 변경 내용`

## [2026-06-19] — Phase 3 (2): Stooq Provider · fallback 체인

- `StooqMarketDataProvider`: 공개 CSV 기반, 티커 자동 매핑(ETF/레버리지/지수)
- `FallbackMarketDataProvider`: 메인=Stooq, 보조=야후 순차 시도 + fallback 훅
- `createDefaultMarketDataProvider` 팩토리 (Stooq→야후)
- 테스트 48건 통과
- 알려진 이슈: 현재 개발 네트워크(공유/한국 IP)에서 야후 429, Stooq 봇차단(JS 검증)으로
  실데이터 수집 불가. 무료 키 기반 API 또는 실운영 IP에서 재검증 필요.

## [2026-06-19] — Phase 3 (1): 지표 계산 · 야후 Provider

- `@lab/indicators`: 이동평균·기간수익률·RSI(Wilder)·변동성·MDD·일괄계산 (테스트 10건)
- `@lab/market-data`: `YahooMarketDataProvider` (yahoo-finance2, 키 불필요, 티커로 ETF/레버리지/지수 통합 조회)
- 시세 정규화(등락률 소수화)·일봉 종가 시계열 조회, mock 테스트 3건
- 전체 테스트 38건 통과
- 알려진 이슈: 공유 IP 환경에서 야후 실호출 429 발생 가능 → fallback 소스 검토 예정

## [2026-06-19] — Phase 2: 모의투자 코어 (LLM 없이 순수 로직)

- 모의체결 엔진: 판단 당시가 + 슬리피지 + 수수료 즉시 체결(`fillEngine`)
- 포지션 도메인: 가중평균 매입가·실현손익(`position`)
- 주문 검증: 허용종목·현금·보유수량·최대비중·중복스냅샷(`validation`)
- 성과 계산: 평가액·미실현손익·누적/일간 수익률·MDD(`performance`)
- 주문 처리 서비스: 판단→검증→체결→상태갱신, 중복방지(`paperTradingService`)
- 단위/통합 테스트 25건 통과

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
