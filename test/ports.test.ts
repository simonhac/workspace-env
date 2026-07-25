import { describe, it, expect } from "vitest";
import net from "node:net";
import { findFreePort } from "../src/lib/ports";

describe("findFreePort", () => {
  it("returns a free port within the range", async () => {
    const p = await findFreePort(41000, 5);
    expect(p).not.toBeNull();
    expect(p!).toBeGreaterThanOrEqual(41000);
    expect(p!).toBeLessThan(41005);
  });

  it("returns null when every port in the range is busy", async () => {
    const server = net.createServer();
    await new Promise<void>((res) => server.listen(41010, "0.0.0.0", () => res()));
    const p = await findFreePort(41010, 1);
    expect(p).toBeNull();
    await new Promise<void>((res) => server.close(() => res()));
  });
});
