import { readFileSync } from "node:fs";
import { request } from "node:http";
import { createServer } from "node:https";

createServer(
  {
    key: readFileSync(process.env.ACCOUNTS_TEST_TLS_KEY),
    cert: readFileSync(process.env.ACCOUNTS_TEST_TLS_CERT),
  },
  (incoming, outgoing) => {
    const api = incoming.url.startsWith("/api/");
    const upstream = request(
      {
        hostname: "127.0.0.1",
        port: api ? 3001 : 3000,
        path: api ? incoming.url.slice(4) : incoming.url,
        method: incoming.method,
        headers: incoming.headers,
      },
      (response) => {
        outgoing.writeHead(response.statusCode, response.headers);
        response.pipe(outgoing);
      },
    );
    upstream.on("error", () => {
      outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(upstream);
  },
).listen(3443, "127.0.0.1");
