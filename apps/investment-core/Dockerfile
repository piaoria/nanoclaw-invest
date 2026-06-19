# investment-core 컨테이너 이미지 (pnpm workspace)
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# 워크스페이스 매니페스트만 먼저 복사해 의존성 캐시를 활용
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/investment-core/package.json apps/investment-core/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN pnpm install --frozen-lockfile --prod=false

# 소스 복사
COPY packages ./packages
COPY apps/investment-core ./apps/investment-core

EXPOSE 4001
CMD ["node", "apps/investment-core/src/index.js"]
