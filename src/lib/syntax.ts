export type TokenType = "plain" | "kw" | "str" | "num" | "com" | "fn" | "typ" | "tag" | "attr" | "punc" | "op";
export type Token = { text: string; type: TokenType };
export type HighlightedLine = Token[];
export type HighlightMode = "code" | "html" | "css" | "json" | "yaml" | "markdown" | "shell" | "sql" | "python";

const genericKeywords = new Set(["if", "else", "for", "while", "return", "break", "continue", "switch", "case", "default", "new", "delete", "try", "catch", "finally", "throw", "import", "export", "from", "as", "in", "of", "typeof", "instanceof", "void", "yield", "await", "async", "this", "super", "class", "extends", "implements", "interface", "enum", "const", "let", "var", "function", "static", "public", "private", "protected", "readonly", "abstract", "final", "override", "package", "namespace", "module", "with", "using", "init", "constructor", "true", "false", "null", "undefined", "None", "True", "False"]);

const languageKeywords: Record<string, string[]> = {
  typescript: ["type", "keyof", "infer", "is", "satisfies", "declare", "any", "unknown", "never", "string", "number", "boolean", "object", "symbol", "bigint", "asserts"],
  javascript: [],
  python: ["def", "lambda", "pass", "raise", "except", "global", "nonlocal", "assert", "del", "elif", "not", "and", "or", "is", "None", "True", "False", "self", "cls", "match"],
  go: ["func", "package", "defer", "go", "chan", "select", "struct", "map", "range", "nil", "make", "type", "interface"],
  rust: ["fn", "let", "mut", "impl", "trait", "struct", "enum", "match", "pub", "use", "crate", "mod", "where", "unsafe", "dyn", "ref", "move", "loop", "Some", "None", "Ok", "Err", "Self", "self"],
  java: ["boolean", "byte", "char", "short", "int", "long", "float", "double", "extends", "implements", "synchronized", "volatile", "transient", "native", "strictfp", "record", "sealed", "permits", "var"],
  kotlin: ["fun", "val", "var", "when", "object", "data", "suspend", "companion", "sealed", "init", "null", "is", "out"],
  csharp: ["using", "namespace", "struct", "record", "delegate", "event", "async", "await", "var", "dynamic", "params", "ref", "out", "is", "as", "nameof", "typeof", "where"],
  c: ["include", "define", "ifdef", "ifndef", "endif", "pragma", "typedef", "struct", "union", "enum", "extern", "register", "sizeof"],
  cpp: ["include", "namespace", "template", "typename", "class", "public", "private", "protected", "virtual", "override", "constexpr", "noexcept", "using", "new", "delete", "nullptr", "auto"],
  ruby: ["def", "end", "module", "require", "require_relative", "attr_accessor", "attr_reader", "attr_writer", "do", "begin", "rescue", "ensure", "yield", "nil", "true", "false", "self", "elsif", "unless", "until", "lambda", "proc", "then"],
  php: ["echo", "function", "namespace", "use", "require", "include", "foreach", "as", "array", "match", "fn", "public", "private", "protected", "static", "abstract", "interface", "trait", "extends", "implements", "new", "clone", "null", "true", "false"],
  swift: ["func", "let", "var", "guard", "defer", "struct", "class", "enum", "protocol", "extension", "where", "in", "as", "is", "try", "throws", "async", "await", "some", "any", "nil", "true", "false", "self"],
  dart: ["void", "final", "const", "var", "late", "required", "factory", "async", "await", "yield", "mixin", "extension", "on", "is", "as", "dynamic", "null", "true", "false"],
  elixir: ["def", "defmodule", "defp", "do", "end", "case", "cond", "fn", "use", "alias", "import", "require", "nil", "true", "false", "when"],
  haskell: ["data", "type", "newtype", "where", "let", "in", "do", "case", "of", "class", "instance", "module", "import", "deriving", "if", "then", "else"],
  scala: ["val", "var", "def", "object", "trait", "case", "match", "implicit", "given", "using", "extends", "with", "yield", "sealed", "lazy", "override"],
  lua: ["function", "local", "then", "end", "repeat", "until", "nil", "true", "false", "do", "elseif"],
  r: ["function", "library", "require", "TRUE", "FALSE", "NULL", "NA", "ifelse"],
  perl: ["sub", "my", "our", "use", "package", "require", "unless", "until", "elsif", "foreach", "given", "when", "say", "undef"],
  zig: ["fn", "const", "var", "pub", "comptime", "inline", "export", "extern", "struct", "enum", "union", "error", "try", "catch", "defer", "errdefer", "and", "or", "orelse", "null", "undefined", "true", "false"],
  terraform: ["resource", "variable", "output", "module", "provider", "data", "locals", "terraform", "for_each", "depends_on", "true", "false", "null"],
  graphql: ["query", "mutation", "subscription", "fragment", "on", "type", "input", "enum", "interface", "union", "schema", "scalar", "directive", "extend", "implements", "true", "false", "null"],
  prisma: ["model", "enum", "datasource", "generator", "provider", "url", "relation", "default", "unique", "id", "String", "Int", "Boolean", "DateTime", "Float", "Json"]
};

const languageFamilies: Record<string, keyof typeof languageKeywords | "generic"> = {
  typescript: "typescript", javascript: "javascript", tsx: "typescript", jsx: "javascript",
  python: "python", go: "go", rust: "rust", java: "java", kotlin: "kotlin", csharp: "csharp",
  c: "c", cpp: "cpp", ruby: "ruby", php: "php", swift: "swift", dart: "dart", elixir: "elixir",
  haskell: "haskell", scala: "scala", lua: "lua", r: "r", perl: "perl", zig: "zig",
  terraform: "terraform", graphql: "graphql", prisma: "prisma"
};

function keywordSet(languageId: string | undefined): Set<string> {
  const family = languageId ? languageFamilies[languageId] : undefined;
  const extra = family ? languageKeywords[family] ?? [] : [];
  return new Set([...genericKeywords, ...extra]);
}

const identStart = /[A-Za-z_$]/;
const identPart = /[A-Za-z0-9_$]/;
const digit = /[0-9]/;

export function tokenize(code: string, mode: HighlightMode, languageId?: string): HighlightedLine[] {
  if (!code) return [[]];
  const tokens = mode === "html"
    ? scanHtml(code)
    : mode === "json"
      ? scanJson(code)
      : mode === "yaml"
        ? scanYaml(code)
        : mode === "css"
          ? scanCss(code)
          : mode === "markdown"
            ? scanMarkdown(code)
            : mode === "shell"
              ? scanShell(code)
              : mode === "sql"
                ? scanSql(code)
                : mode === "python"
                  ? scanPython(code)
                  : scanCode(code, languageId);
  return splitLines(tokens);
}

function splitLines(tokens: Token[]): HighlightedLine[] {
  const lines: HighlightedLine[] = [[]];
  for (const token of tokens) {
    if (!token.text.includes("\n")) {
      if (token.text) lines[lines.length - 1]?.push(token);
      continue;
    }
    const parts = token.text.split("\n");
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index] ?? "";
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1]?.push({ text: part, type: token.type });
    }
  }
  return lines;
}

function readString(code: string, start: number, quote: string, escapes = true): number {
  let index = start + 1;
  while (index < code.length) {
    const char = code[index];
    if (escapes && char === "\\") { index += 2; continue; }
    if (char === quote) return index + 1;
    if (char === "\n" && quote !== "`" && quote !== "'") return index;
    index += 1;
  }
  return code.length;
}

function readWhile(code: string, start: number, test: (char: string) => boolean): number {
  let index = start;
  while (index < code.length && test(code[index] ?? "")) index += 1;
  return index;
}

function occursAt(code: string, index: number, needle: string): boolean {
  return code.startsWith(needle, index);
}

interface ScanOptions {
  lineComments: string[];
  blockComments: Array<[string, string]>;
  quotes: string[];
  keywords: Set<string>;
  typesCaseSensitive: boolean;
  readsFunctions: boolean;
}

function scanWithRules(code: string, options: ScanOptions): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let expectFunction = false;
  let previousType: TokenType | null = null;
  const push = (text: string, type: TokenType) => { if (text) tokens.push({ text, type }); };
  while (index < code.length) {
    const char = code[index] ?? "";
    let matched = false;
    for (const [open, close] of options.blockComments) {
      if (occursAt(code, index, open)) {
        const end = code.indexOf(close, index + open.length);
        const stop = end === -1 ? code.length : end + close.length;
        push(code.slice(index, stop), "com");
        index = stop;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    for (const lineComment of options.lineComments) {
      if (occursAt(code, index, lineComment) && (lineComment !== "#" || previousType !== "str")) {
        const end = code.indexOf("\n", index);
        const stop = end === -1 ? code.length : end;
        push(code.slice(index, stop), "com");
        index = stop;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const quote = options.quotes.find((candidate) => char === candidate || (candidate.length === 3 && occursAt(code, index, candidate)));
    if (quote) {
      if (quote.length === 3) {
        const end = code.indexOf(quote, index + 3);
        const stop = end === -1 ? code.length : end + 3;
        push(code.slice(index, stop), "str");
        index = stop;
      } else {
        const stop = readString(code, index, quote);
        push(code.slice(index, stop), "str");
        index = stop;
      }
      previousType = "str";
      continue;
    }
    if (digit.test(char) || (char === "." && digit.test(code[index + 1] ?? ""))) {
      const stop = readWhile(code, index, (current) => /[0-9a-fA-FxXbBoO._nul]/.test(current));
      push(code.slice(index, stop), "num");
      previousType = "num";
      index = stop;
      continue;
    }
    if (identStart.test(char)) {
      const stop = readWhile(code, index + 1, (current) => identPart.test(current));
      const word = code.slice(index, stop);
      let type: TokenType = "plain";
      const followedByParen = code.slice(stop, stop + 2).trimStart().startsWith("(");
      if (options.keywords.has(word)) {
        type = "kw";
        if (["function", "def", "fn", "func", "sub", "type", "struct", "class", "interface", "enum", "trait", "impl", "module", "namespace"].includes(word)) expectFunction = true;
      } else if (options.readsFunctions && (expectFunction || followedByParen)) {
        type = "fn";
        expectFunction = false;
      } else if (options.typesCaseSensitive && /^[A-Z]/.test(word)) {
        type = "typ";
      } else if (previousType === "punc" && tokens[tokens.length - 1]?.text === ".") {
        type = "plain";
      }
      push(word, type);
      previousType = type;
      index = stop;
      continue;
    }
    if (/[{}()[\];,]/.test(char)) { push(char, "punc"); previousType = "punc"; index += 1; continue; }
    if (/[=+\-*/%<>!&|^~?:@#]/.test(char)) {
      const stop = readWhile(code, index, (current) => /[=+\-*/%<>!&|^~?:@#]/.test(current));
      push(code.slice(index, stop), "op");
      previousType = "op";
      index = stop;
      continue;
    }
    const stop = readWhile(code, index, (current) => !/[A-Za-z0-9_$"'`]/.test(current) && !/[{}()[\];,=+\-*/%<>!&|^~?:@#]/.test(current));
    push(code.slice(index, Math.max(stop, index + 1)), "plain");
    previousType = "plain";
    index = Math.max(stop, index + 1);
    continue;
  }
  return tokens;
}

function scanCode(code: string, languageId?: string): Token[] {
  const family = languageId ? languageFamilies[languageId] : undefined;
  const hashLanguages = new Set(["python", "ruby", "elixir", "r", "perl", "terraform", "prisma", "graphql"]);
  const dashLanguages = new Set(["haskell", "lua"]);
  const lineComments = family && hashLanguages.has(family) ? ["#"] : family && dashLanguages.has(family) ? ["--", "//"] : ["//"];
  return scanWithRules(code, {
    lineComments,
    blockComments: [["/*", "*/"]],
    quotes: ["\"", "'", "`"],
    keywords: keywordSet(languageId),
    typesCaseSensitive: true,
    readsFunctions: true
  });
}

function scanPython(code: string): Token[] {
  return scanWithRules(code, {
    lineComments: ["#"],
    blockComments: [],
    quotes: ["\"\"\"", "'''", "\"", "'"],
    keywords: keywordSet("python"),
    typesCaseSensitive: true,
    readsFunctions: true
  });
}

function scanShell(code: string): Token[] {
  return scanWithRules(code, {
    lineComments: ["#"],
    blockComments: [],
    quotes: ["\"", "'"],
    keywords: new Set(["if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac", "function", "return", "export", "local", "readonly", "source", "set", "unset", "echo", "exit", "in"]),
    typesCaseSensitive: false,
    readsFunctions: true
  });
}

function scanSql(code: string): Token[] {
  return scanWithRules(code, {
    lineComments: ["--"],
    blockComments: [["/*", "*/"]],
    quotes: ["'", "\"", "`"],
    keywords: new Set(["select", "from", "where", "insert", "into", "values", "update", "set", "delete", "create", "table", "alter", "drop", "index", "view", "join", "left", "right", "inner", "outer", "on", "group", "by", "order", "having", "limit", "offset", "union", "all", "as", "and", "or", "not", "null", "is", "in", "between", "like", "exists", "case", "when", "then", "else", "end", "primary", "key", "foreign", "references", "default", "unique", "distinct", "count", "sum", "avg", "min", "max", "with", "returning", "begin", "commit", "rollback", "select", "constraint", "cascade"]),
    typesCaseSensitive: false,
    readsFunctions: true
  });
}

function scanJson(code: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  const push = (text: string, type: TokenType) => { if (text) tokens.push({ text, type }); };
  while (index < code.length) {
    const char = code[index] ?? "";
    if (char === "\"") {
      const stop = readString(code, index, "\"");
      const word = code.slice(index, stop);
      const after = code.slice(stop).trimStart();
      push(word, after.startsWith(":") ? "attr" : "str");
      index = stop;
      continue;
    }
    if (occursAt(code, index, "//")) {
      const end = code.indexOf("\n", index);
      const stop = end === -1 ? code.length : end;
      push(code.slice(index, stop), "com");
      index = stop;
      continue;
    }
    if (occursAt(code, index, "/*")) {
      const end = code.indexOf("*/", index + 2);
      const stop = end === -1 ? code.length : end + 2;
      push(code.slice(index, stop), "com");
      index = stop;
      continue;
    }
    if (/[{}\[\]:,]/.test(char)) { push(char, "punc"); index += 1; continue; }
    if (digit.test(char) || char === "-") {
      const stop = readWhile(code, index + 1, (current) => /[0-9.eE+\-]/.test(current));
      push(code.slice(index, stop), "num");
      index = stop;
      continue;
    }
    if (/[A-Za-z]/.test(char)) {
      const stop = readWhile(code, index + 1, (current) => /[A-Za-z]/.test(current));
      const word = code.slice(index, stop);
      if (["true", "false", "null"].includes(word)) { push(word, "kw"); index = stop; continue; }
      push(word, "plain");
      index = stop;
      continue;
    }
    push(char, "plain");
    index += 1;
  }
  return tokens;
}

function scanYaml(code: string): Token[] {
  const tokens: Token[] = [];
  const lines = code.split("\n");
  const keywords = new Set(["true", "false", "null", "yes", "no", "on", "off", "~"]);
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) tokens.push({ text: "\n", type: "plain" });
    const commentIndex = findYamlComment(line);
    const body = commentIndex === -1 ? line : line.slice(0, commentIndex);
    const comment = commentIndex === -1 ? "" : line.slice(commentIndex);
    const keyMatch = /^(\s*(?:-\s+)?)([\w.$-]+)(\s*:)/.exec(body);
    if (keyMatch) {
      if (keyMatch[1]) tokens.push({ text: keyMatch[1], type: "plain" });
      tokens.push({ text: keyMatch[2] ?? "", type: "attr" });
      tokens.push({ text: keyMatch[3] ?? "", type: "punc" });
      tokens.push(...scanInline(body.slice(keyMatch[0].length), keywords));
    } else {
      tokens.push(...scanInline(body, keywords));
    }
    if (comment) tokens.push({ text: comment, type: "com" });
  });
  return tokens;
}

function findYamlComment(line: string): number {
  let quote: string | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote) { if (char === quote && line[index - 1] !== "\\") quote = null; continue; }
    if (char === "\"" || char === "'") { quote = char; continue; }
    if (char === "#" && (index === 0 || /\s/.test(line[index - 1] ?? ""))) return index;
  }
  return -1;
}

function scanInline(body: string, keywords: Set<string>): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < body.length) {
    const char = body[index] ?? "";
    if (char === "\"" || char === "'") {
      const stop = readString(body, index, char);
      tokens.push({ text: body.slice(index, stop), type: "str" });
      index = stop;
      continue;
    }
    if (digit.test(char)) {
      const stop = readWhile(body, index + 1, (current) => /[0-9._-]/.test(current));
      tokens.push({ text: body.slice(index, stop), type: "num" });
      index = stop;
      continue;
    }
    if (/[\[\]{},|>&*!]/.test(char)) { tokens.push({ text: char, type: "punc" }); index += 1; continue; }
    if (/[A-Za-z0-9_$.-]/.test(char)) {
      const stop = readWhile(body, index + 1, (current) => /[A-Za-z0-9_$.-]/.test(current));
      const word = body.slice(index, stop);
      tokens.push({ text: word, type: keywords.has(word) ? "kw" : "plain" });
      index = stop;
      continue;
    }
    tokens.push({ text: char, type: "plain" });
    index += 1;
  }
  return tokens;
}

function scanCss(code: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let inBlock = 0;
  let expectingValue = false;
  const push = (text: string, type: TokenType) => { if (text) tokens.push({ text, type }); };
  while (index < code.length) {
    const char = code[index] ?? "";
    if (occursAt(code, index, "/*")) {
      const end = code.indexOf("*/", index + 2);
      const stop = end === -1 ? code.length : end + 2;
      push(code.slice(index, stop), "com");
      index = stop;
      continue;
    }
    if (char === "\"" || char === "'") {
      const stop = readString(code, index, char);
      push(code.slice(index, stop), "str");
      index = stop;
      continue;
    }
    if (char === "{") { inBlock += 1; expectingValue = false; push(char, "punc"); index += 1; continue; }
    if (char === "}") { inBlock = Math.max(0, inBlock - 1); push(char, "punc"); index += 1; continue; }
    if (char === ":" && inBlock > 0) { expectingValue = true; push(char, "punc"); index += 1; continue; }
    if (char === ";") { expectingValue = false; push(char, "punc"); index += 1; continue; }
    if (char === "@") {
      const stop = readWhile(code, index + 1, (current) => /[A-Za-z-]/.test(current));
      push(code.slice(index, stop), "kw");
      index = stop;
      continue;
    }
    if (char === "#" && /[0-9a-fA-F]/.test(code[index + 1] ?? "")) {
      const stop = readWhile(code, index + 1, (current) => /[0-9a-fA-F]/.test(current));
      push(code.slice(index, stop), "num");
      index = stop;
      continue;
    }
    if (digit.test(char)) {
      const stop = readWhile(code, index, (current) => /[0-9.%a-z-]/.test(current));
      push(code.slice(index, stop), "num");
      index = stop;
      continue;
    }
    if (identStart.test(char) || char === "-" || char === ".") {
      const stop = readWhile(code, index + 1, (current) => /[A-Za-z0-9_$.#-]/.test(current));
      const word = code.slice(index, stop);
      let type: TokenType = "plain";
      const remainder = code.slice(stop);
      if (inBlock > 0 && !expectingValue && /^\s*:/.test(remainder)) type = "attr";
      else if (inBlock === 0) type = "tag";
      push(word, type);
      index = stop;
      continue;
    }
    if (/[(),>+~*]/.test(char)) { push(char, "punc"); index += 1; continue; }
    const stop = readWhile(code, index, (current) => !/[A-Za-z0-9_$#."'{};:@(),>+~*]/.test(current));
    push(code.slice(index, Math.max(stop, index + 1)), "plain");
    index = Math.max(stop, index + 1);
  }
  return tokens;
}

function scanHtml(code: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  const push = (text: string, type: TokenType) => { if (text) tokens.push({ text, type }); };
  while (index < code.length) {
    if (occursAt(code, index, "<!--")) {
      const end = code.indexOf("-->", index + 4);
      const stop = end === -1 ? code.length : end + 3;
      push(code.slice(index, stop), "com");
      index = stop;
      continue;
    }
    if (code[index] === "<") {
      const isClose = code[index + 1] === "/";
      push(isClose ? "</" : "<", "punc");
      index += isClose ? 2 : 1;
      const stop = readWhile(code, index + 1, (current) => /[A-Za-z0-9-]/.test(current));
      push(code.slice(index, stop), "tag");
      index = stop;
      while (index < code.length && code[index] !== ">") {
        const char = code[index] ?? "";
        if (/\s/.test(char)) { push(char, "plain"); index += 1; continue; }
        if (char === "\"" || char === "'") {
          const quoteEnd = readString(code, index, char);
          push(code.slice(index, quoteEnd), "str");
          index = quoteEnd;
          continue;
        }
        if (char === "=" || char === "/") { push(char, "punc"); index += 1; continue; }
        const attrStop = readWhile(code, index + 1, (current) => /[\w@:.-]/.test(current));
        push(code.slice(index, attrStop), "attr");
        index = Math.max(attrStop, index + 1);
      }
      if (code[index] === ">") { push(">", "punc"); index += 1; }
      continue;
    }
    const stop = readWhile(code, index + 1, (current) => current !== "<");
    push(code.slice(index, Math.max(stop, index + 1)), "plain");
    index = Math.max(stop, index + 1);
  }
  return tokens;
}

function scanMarkdown(code: string): Token[] {
  const tokens: Token[] = [];
  const lines = code.split("\n");
  let fence = false;
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) tokens.push({ text: "\n", type: "plain" });
    if (/^\s*```/.test(line)) { fence = !fence; tokens.push({ text: line, type: "kw" }); return; }
    if (fence) { tokens.push({ text: line, type: "plain" }); return; }
    if (/^#{1,6}\s/.test(line)) { tokens.push({ text: line, type: "kw" }); return; }
    if (/^\s*>\s?/.test(line)) { tokens.push({ text: line, type: "com" }); return; }
    if (/^\s*(?:[-*+]|\d+\.)\s/.test(line)) {
      const match = /^(\s*(?:[-*+]|\d+\.)\s)(.*)$/.exec(line);
      tokens.push({ text: match?.[1] ?? "", type: "punc" });
      tokens.push(...scanInlineMarkdown(match?.[2] ?? ""));
      return;
    }
    tokens.push(...scanInlineMarkdown(line));
  });
  return tokens;
}

function scanInlineMarkdown(text: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]*\]\([^)]*\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) tokens.push({ text: text.slice(last, match.index), type: "plain" });
    if (match[1]) tokens.push({ text: match[1], type: "str" });
    else if (match[2]) tokens.push({ text: match[2], type: "typ" });
    else if (match[3]) tokens.push({ text: match[3], type: "attr" });
    last = match.index + match[0].length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), type: "plain" });
  return tokens;
}

export function tokenizeToLines(code: string, mode: HighlightMode, languageId?: string): HighlightedLine[] {
  return tokenize(code, mode, languageId);
}
