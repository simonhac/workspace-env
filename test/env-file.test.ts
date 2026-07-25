import { describe, it, expect } from "vitest";
import { parseEnvFile } from "../src/lib/env-file";

describe("parseEnvFile", () => {
  it("handles export, quotes, lowercase keys, op:// refs; ignores comments/blank/no-eq", () => {
    const out = parseEnvFile(
      [
        "# a comment",
        "",
        "FOO=bar",
        'QUOTED="hello world"',
        "SINGLE='x y'",
        "export EXP=1",
        "lower_case=ok",
        "URL=op://demo-dev/env/URL",
        "noeq",
      ].join("\n"),
    );
    expect(out.FOO).toBe("bar");
    expect(out.QUOTED).toBe("hello world");
    expect(out.SINGLE).toBe("x y");
    expect(out.EXP).toBe("1");
    expect(out.lower_case).toBe("ok");
    expect(out.URL).toBe("op://demo-dev/env/URL");
    expect("noeq" in out).toBe(false);
  });
});
