import type { Request, Response } from "express";

import { createApiApplication } from "../src/main";

let server: ((request: Request, response: Response) => void) | undefined;

export default async function handler(
  request: Request,
  response: Response,
): Promise<void> {
  if (!server) {
    const app = await createApiApplication();
    await app.init();
    server = app.getHttpAdapter().getInstance() as typeof server;
  }
  server!(request, response);
}
