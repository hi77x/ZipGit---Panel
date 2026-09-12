import { describe, expect, it } from "vitest";
import { isBinaryPath, languageColor, languageFromPath, syntaxModeFor } from "./language";

describe("language detection", () => {
  it("maps extensions to languages, colors, and syntax modes", () => {
    expect(languageFromPath("src/index.ts")).toMatchObject({ id: "typescript", syntax: "code" });
    expect(languageFromPath("app/page.tsx")?.id).toBe("tsx");
    expect(languageFromPath("styles/main.scss")?.syntax).toBe("css");
    expect(languageFromPath("config/settings.json")?.syntax).toBe("json");
    expect(languageFromPath("docs/guide.md")?.syntax).toBe("markdown");
    expect(languageFromPath("scripts/deploy.sh")?.syntax).toBe("shell");
    expect(languageFromPath("Dockerfile")).toMatchObject({ id: "dockerfile", syntax: "shell" });
    expect(languageFromPath("Makefile")?.id).toBe("makefile");
    expect(languageFromPath("unknown.zzz")).toBeNull();
    expect(languageFromPath(".gitignore")?.syntax).toBe("shell");
  });

  it("provides a stable color and syntax fallback", () => {
    expect(languageColor("TypeScript")).toBe("#3178c6");
    expect(languageColor("typescript")).toBe("#3178c6");
    expect(languageColor(null)).toBe("#5c6170");
    expect(languageColor("Klingon")).toBe("#5c6170");
    expect(syntaxModeFor("mystery.bin")).toBe("code");
  });

  it("classifies binary extensions", () => {
    expect(isBinaryPath("assets/logo.png")).toBe(true);
    expect(isBinaryPath("dist/app.exe")).toBe(true);
    expect(isBinaryPath("archive.tar.gz")).toBe(true);
    expect(isBinaryPath("src/main.rs")).toBe(false);
    expect(isBinaryPath("README.md")).toBe(false);
  });
});
