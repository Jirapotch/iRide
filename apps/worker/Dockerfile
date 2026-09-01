FROM node:22-alpine AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN pnpm install --frozen-lockfile

COPY apps/worker apps/worker
COPY packages packages
RUN pnpm --filter @iride/worker build
RUN pnpm --filter @iride/worker --prod deploy --legacy /prod/worker \
  && cp -R /app/apps/worker/dist /prod/worker/dist

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV WORKER_PORT=3002
WORKDIR /app

COPY --from=build /prod/worker ./

EXPOSE 3002
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3002/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

USER node
CMD ["node", "dist/index.js"]
