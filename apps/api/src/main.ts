import "reflect-metadata";

import { getApiEnv } from "@iride/config/api";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

export async function createApiApplication() {
  getApiEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  return app;
}

async function bootstrap(): Promise<void> {
  const app = await createApiApplication();
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
}

if (require.main === module) {
  void bootstrap();
}
