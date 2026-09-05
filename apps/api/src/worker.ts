import "reflect-metadata";

import { getWorkerEnv } from "@iride/config/worker";
import { NestFactory } from "@nestjs/core";

import { WorkerModule } from "./worker.module";

async function bootstrap(): Promise<void> {
  const env = getWorkerEnv();
  const app = await NestFactory.create(WorkerModule, { bufferLogs: true });
  app.enableShutdownHooks();
  await app.listen(env.WORKER_PORT, "0.0.0.0");
}

void bootstrap();
