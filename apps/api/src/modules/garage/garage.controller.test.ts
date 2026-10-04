import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { readGarageMultipartBody } from "./garage.controller";
function app() {
  const server = express();
  server.post("/upload", async (req, res) => {
    try {
      const bytes = await readGarageMultipartBody(req, 1024);
      res.status(200).json({ bytes: bytes.length });
    } catch (error) {
      res
        .status((error as { status: number }).status)
        .json({ error: (error as Error).message });
    }
  });
  return server;
}
describe("native multipart stream adapter", () => {
  it("preserves multipart bytes for web FormData parsing", async () => {
    const response = await request(app())
      .post("/upload")
      .set("Content-Type", "multipart/form-data; boundary=test")
      .send(Buffer.from("exact bytes"));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ bytes: 11 });
  });
  it("returns 413 rather than cancelling the HTTP connection for a declared oversized upload", async () => {
    const response = await request(app())
      .post("/upload")
      .set("Content-Type", "multipart/form-data; boundary=test")
      .send(Buffer.alloc(12000));
    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "GARAGE_DOCUMENT_TOO_LARGE" });
  });
  it("returns 413 for an oversized chunked upload with no declared length", async () => {
    const server = app().listen(0);
    await once(server, "listening");
    try {
      const response = await fetch(
        `http://127.0.0.1:${(server.address() as AddressInfo).port}/upload`,
        {
          method: "POST",
          headers: { "Content-Type": "multipart/form-data; boundary=test" },
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(12000));
              controller.close();
            },
          }),
          duplex: "half",
        } as RequestInit & { duplex: "half" },
      );
      expect(response.status).toBe(413);
    } finally {
      server.close();
    }
  });
});
