import { describe, expect, it } from "vitest";
import { resolveReadmeUrl, sanitizeReadmeHtml } from "./readme-service";

const context = { owner: "octo", repo: "project", ref: "main", readmePath: "docs/README.md" };

describe("README security", () => {
  it("rewrites relative links and images using README directory", () => {
    expect(resolveReadmeUrl("guide.md", context, false)).toBe("https://github.com/octo/project/blob/main/docs/guide.md");
    expect(resolveReadmeUrl("assets/x.png", context, true)).toBe("https://raw.githubusercontent.com/octo/project/main/docs/assets/x.png");
  });
  it("removes script, handlers, javascript URLs, and unknown image hosts", () => {
    const html = sanitizeReadmeHtml('<script>alert(1)</script><a href="javascript:alert(1)">bad</a><img src="https://evil.example/x" onerror="alert(1)"><p>safe</p>', context);
    expect(html).not.toMatch(/script|javascript|onerror|evil\.example/);
    expect(html).toContain("<p>safe</p>");
  });
});
