import { createHealthResponse } from "@iride/types";

export function GET() {
  return Response.json(
    createHealthResponse("api", process.env.APP_VERSION ?? "0.1.0"),
  );
}
