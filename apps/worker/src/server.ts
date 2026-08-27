import { createServer, type Server } from "node:http";

import { createHealthResponse } from "@iride/types";

export function createWorkerServer(version = "0.1.0"): Server {
  return createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
      });
      response.end(JSON.stringify(createHealthResponse("worker", version)));
      return;
    }

    response.writeHead(404, {
      "content-type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify({ error: "not_found" }));
  });
}
