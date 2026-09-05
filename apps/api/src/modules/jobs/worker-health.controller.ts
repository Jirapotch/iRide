import { Controller, Get } from "@nestjs/common";
import { createHealthResponse } from "@iride/types";

@Controller()
export class WorkerHealthController {
  @Get("health")
  health() {
    return createHealthResponse("worker", process.env.APP_VERSION ?? "0.1.0");
  }
}
