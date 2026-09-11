import { describe, expect, it } from "vitest";
import { tokenize } from "./syntax";

function text(tokens: Array<{ text: string; type: string }>): string {
  return tokens.map((token) => token.text).join("");
}

describe("syntax tokenizer", () => {
  it("highlights TypeScript keywords, strings, numbers, and comments", () => {
    const lines = tokenize("const answer = 42; // life\nconst name = \"deck\";", "code", "typescript");
    expect(lines).toHaveLength(2);
    const first = lines[0] ?? [];
    expect(first[0]).toMatchObject({ text: "const", type: "kw" });
    expect(first.some((token) => token.type === "num" && token.text === "42")).toBe(true);
    expect(first.some((token) => token.type === "com" && token.text.includes("life"))).toBe(true);
    const second = lines[1] ?? [];
    expect(second.some((token) => token.type === "str" && token.text === "\"deck\"")).toBe(true);
    expect(text([...first, ...second])).toBe("const answer = 42; // lifeconst name = \"deck\";");
  });

  it("does not treat JS private fields as comments", () => {
    const lines = tokenize("class A { #hidden = 1; }", "code", "javascript");
    expect(lines[0]?.some((token) => token.type === "com")).toBe(false);
  });

  it("marks function declarations and calls", () => {
    const lines = tokenize("function run() { return run(1); }", "code", "javascript");
    expect(lines[0]?.some((token) => token.type === "fn" && token.text === "run")).toBe(true);
  });

  it("highlights JSON keys as attributes", () => {
    const lines = tokenize(`{"key": "value", "n": 3, "ok": true}`, "json");
    const tokens = lines[0] ?? [];
    expect(tokens.some((token) => token.type === "attr" && token.text === "\"key\"")).toBe(true);
    expect(tokens.some((token) => token.type === "str" && token.text === "\"value\"")).toBe(true);
    expect(tokens.some((token) => token.type === "kw" && token.text === "true")).toBe(true);
  });

  it("highlights HTML tags, attributes, and comments", () => {
    const lines = tokenize(`<div class="box"><!-- note -->text</div>`, "html");
    const tokens = lines[0] ?? [];
    expect(tokens.some((token) => token.type === "tag" && token.text === "div")).toBe(true);
    expect(tokens.some((token) => token.type === "attr" && token.text === "class")).toBe(true);
    expect(tokens.some((token) => token.type === "com" && token.text.includes("note"))).toBe(true);
  });

  it("keeps python triple-quoted strings together", () => {
    const lines = tokenize(`x = """line one\nline two"""`, "python");
    expect(lines.length).toBe(2);
    expect(lines[0]?.some((token) => token.type === "str" && token.text.includes("line one"))).toBe(true);
  });

  it("tokenizes markdown headings and inline code", () => {
    const lines = tokenize("# Title\n\nUse `npm run dev` now", "markdown");
    expect(lines[0]?.[0]).toMatchObject({ type: "kw" });
    const last = lines[lines.length - 1] ?? [];
    expect(last.some((token) => token.type === "str" && token.text === "`npm run dev`")).toBe(true);
  });

  it("always terminates on adversarial input", () => {
    const lines = tokenize("<<<<<<<\"\"\"'''`````\\\\", "code", "javascript");
    expect(Array.isArray(lines)).toBe(true);
  });
});
