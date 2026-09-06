import "reflect-metadata";

import { getApiEnv } from "@iride/config/api";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

export async function createApiApplication() {
  getApiEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  return app;
}

export async function startApiServer(): Promise<void> {
  const app = await createApiApplication();
  app.enableShutdownHooks();
  const port = resolveApiPort();
  await app.listen(port, "0.0.0.0");
}

export function resolveApiPort(
  input: Record<string, string | undefined> = process.env,
): number {
  return Number(input.PORT ?? (input.VERCEL ? 3000 : 3001));
}
