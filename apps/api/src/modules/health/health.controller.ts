import { Controller, Get } from "@nestjs/common";
import { createHealthResponse } from "@iride/types";

@Controller("api/health")
export class HealthController {
  @Get()
  getHealth() {
    return createHealthResponse("api", process.env.APP_VERSION ?? "0.1.0");
  }
}
