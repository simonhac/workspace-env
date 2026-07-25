/**
 * Free-port discovery for the dev-server launch. Binds a throwaway server to
 * actually test each port (not a guess), so parallel worktrees never both grab
 * the same one. Start + span both come from config (`run.port.{from, span|to}`).
 */

import net from "node:net";

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "0.0.0.0");
  });
}

/**
 * First free port in `[from, from + span)`, scanning upward from `from` so a
 * project's primary worktree lands on its canonical port (for password-manager
 * autofill). Returns null if every port in the range is busy.
 */
export async function findFreePort(from: number, span = 20): Promise<number | null> {
  for (let port = from; port < from + span; port++) {
    if (await isPortFree(port)) return port;
  }
  return null;
}
