// A port nobody listens on (asked from the OS), for a measuring script's own server: fixed ports collide with other
// sessions' servers on the same machine (a measurement must neither block nor be blocked by them).
import { createServer } from "node:net";

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer(); server.unref(); server.on("error", reject);
    server.listen(0, "127.0.0.1", () => { const address = server.address(); const port = typeof address === "object" && address !== null ? address.port : 0; server.close(() => resolve(port)); });
  });
}
