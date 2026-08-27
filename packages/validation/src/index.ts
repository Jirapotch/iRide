import { z } from "zod";

import { serviceNames, type HealthResponse } from "@iride/types";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.enum(serviceNames),
  version: z.string().min(1),
}) satisfies z.ZodType<HealthResponse>;
