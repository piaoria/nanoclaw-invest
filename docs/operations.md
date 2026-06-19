# Mac mini 운영 구조

## 1. 실행 토폴로지

```text
Mac mini (상시 실행)
│
├─ NanoClaw           ← 호스트에 직접 설치 (Docker Compose 밖)
│   ├─ 두뇌 Claude (오케스트레이터)
│   ├─ SQLite / 세션 / 메모리   (영속 디렉터리)
│   ├─ CLAUDE.md / 워크스페이스 (영속 디렉터리)
│   ├─ 예약 작업 (스케줄러)
│   └─ src/tools/ 커스텀 도구
│       └─ 호스트 Docker 제어 + 투자 서비스 HTTP 호출
│
└─ Docker Compose (투자 서비스)
    ├─ investment-core
    ├─ investment-worker
    ├─ query-api      (MVP 이후)
    └─ agent-gateway  (확장)
        └─ 어떤 컨테이너도 호스트 docker.sock 을 마운트하지 않는다
```

## 2. NanoClaw를 컨테이너에 넣지 않는 이유

NanoClaw 자체가 에이전트를 Docker 컨테이너로 띄우는 런타임이다.
이를 다시 Compose 컨테이너 안에 넣으면 Docker-in-Docker(DinD)가 되어
권한·보안·복잡도 문제가 생긴다.

해결: NanoClaw는 호스트에 직접 실행(네이티브)한다. DinD도 DooD도 아니다.
- NanoClaw = 호스트에서 호스트 Docker를 자연스럽게 사용
- 투자 서비스 = Compose가 관리, 호스트 Docker 접근 불가

## 3. 보안 경계

- 호스트 docker.sock 접근 권한 = 사실상 root. NanoClaw만 보유한다.
- 투자 서비스 컨테이너에 docker.sock 을 마운트하지 않는다.
- NanoClaw ↔ 투자 서비스: HTTP/Tool 호출만. 직접 DB 조작·체결 금지.
- API 키: `.env` 관리, Git 커밋 금지, 로그·프롬프트·에러 메시지에 노출 금지.
- service_role 키는 브라우저/외부로 전달 금지 (Query API 서버에서만 사용).
- 외부 메시징 채널은 MVP에서 비활성. 로컬 CLI / 최소 테스트 채널만.

## 4. 영속성 (재시작 후 유지)

다음은 Mac mini 재부팅·컨테이너 재시작 후에도 유지되어야 한다.
- NanoClaw SQLite / 세션 / 메모리 / CLAUDE.md / 워크스페이스 / 예약 작업
  → NanoClaw 영속 디렉터리(볼륨)에 보관
- 투자 공식 데이터 → 클라우드 Supabase (별도 백업은 Supabase가 담당)
- Compose 서비스는 `restart: unless-stopped` 정책으로 자동 재기동

## 5. 자동 재기동

- NanoClaw: 공식 권장 방식으로 호스트 부팅 시 자동 실행 (launchd 등 — 설치 시 확정)
- 투자 서비스: Docker Compose `restart` 정책 + Docker 데몬 부팅 자동 시작
- 모든 주요 서비스는 재부팅 후 사람 개입 없이 복구되어야 한다.

## 6. Health Check / 로깅

- 각 Compose 서비스는 health check 엔드포인트를 제공한다.
- 로그는 JSON 구조화 로그로 출력한다 (인증 정보 미포함).
- 작업 실행/오류는 Supabase `job_runs` / `error_logs` 에도 기록한다.

## 7. 환경변수 (.env.example 에 키 이름만)

```text
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
# OPENAI_API_KEY=        (확장 시)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
MARKET_DATA_API_KEY=     (무료 소스라도 키 필요 시)
```
