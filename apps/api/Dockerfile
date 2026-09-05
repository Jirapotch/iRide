FROM node:24-alpine AS build

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages packages
RUN pnpm --filter @iride/api build
RUN pnpm --filter @iride/api --prod deploy --legacy /prod/api \
  && cp -R /app/apps/api/dist /prod/api/dist

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /prod/api ./
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
