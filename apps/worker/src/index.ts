import { getWorkerEnv } from "@iride/config/worker";

import { createWorkerServer } from "./server";
import {
  createMediaWorkerDependencies,
  startMediaWorker,
} from "./media-worker";
import {
  createMediaCleanupWorkerDependencies,
  startMediaCleanupWorker,
} from "./media-cleanup-worker";

const env = getWorkerEnv();
const version = process.env.APP_VERSION ?? "0.1.0";
const server = createWorkerServer(version);
const stopMediaWorker = startMediaWorker(createMediaWorkerDependencies(env));
const stopMediaCleanupWorker = startMediaCleanupWorker(
  createMediaCleanupWorkerDependencies(env),
);

server.listen(env.WORKER_PORT, "0.0.0.0", () => {
  console.info(
    JSON.stringify({
      level: "info",
      event: "worker_started",
      port: env.WORKER_PORT,
      version,
    }),
  );
});

function shutdown(signal: NodeJS.Signals) {
  stopMediaWorker();
  stopMediaCleanupWorker();
  console.info(
    JSON.stringify({ level: "info", event: "worker_stopping", signal }),
  );
  server.close((error) => {
    if (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "worker_stop_failed",
          message: error.message,
        }),
      );
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
