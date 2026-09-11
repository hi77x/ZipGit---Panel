export type LanguageInfo = { id: string; name: string; color: string; syntax: SyntaxMode };
export type SyntaxMode = "code" | "html" | "css" | "json" | "yaml" | "markdown" | "shell" | "sql" | "python";

const languages: Record<string, LanguageInfo> = {
  ts: { id: "typescript", name: "TypeScript", color: "#3178c6", syntax: "code" },
  tsx: { id: "tsx", name: "TypeScript React", color: "#3178c6", syntax: "code" },
  js: { id: "javascript", name: "JavaScript", color: "#f1e05a", syntax: "code" },
  jsx: { id: "jsx", name: "JavaScript React", color: "#f1e05a", syntax: "code" },
  mjs: { id: "javascript", name: "JavaScript", color: "#f1e05a", syntax: "code" },
  cjs: { id: "javascript", name: "JavaScript", color: "#f1e05a", syntax: "code" },
  py: { id: "python", name: "Python", color: "#3572a5", syntax: "python" },
  rb: { id: "ruby", name: "Ruby", color: "#701516", syntax: "code" },
  go: { id: "go", name: "Go", color: "#00add8", syntax: "code" },
  rs: { id: "rust", name: "Rust", color: "#dea584", syntax: "code" },
  java: { id: "java", name: "Java", color: "#b07219", syntax: "code" },
  kt: { id: "kotlin", name: "Kotlin", color: "#a97bff", syntax: "code" },
  c: { id: "c", name: "C", color: "#8a8f9b", syntax: "code" },
  h: { id: "c", name: "C", color: "#8a8f9b", syntax: "code" },
  cpp: { id: "cpp", name: "C++", color: "#f34b7d", syntax: "code" },
  cc: { id: "cpp", name: "C++", color: "#f34b7d", syntax: "code" },
  hpp: { id: "cpp", name: "C++", color: "#f34b7d", syntax: "code" },
  cs: { id: "csharp", name: "C#", color: "#178600", syntax: "code" },
  php: { id: "php", name: "PHP", color: "#4f5d95", syntax: "code" },
  swift: { id: "swift", name: "Swift", color: "#f05138", syntax: "code" },
  dart: { id: "dart", name: "Dart", color: "#00b4ab", syntax: "code" },
  ex: { id: "elixir", name: "Elixir", color: "#6e4a7e", syntax: "code" },
  exs: { id: "elixir", name: "Elixir", color: "#6e4a7e", syntax: "code" },
  hs: { id: "haskell", name: "Haskell", color: "#5e5086", syntax: "code" },
  scala: { id: "scala", name: "Scala", color: "#c22d40", syntax: "code" },
  lua: { id: "lua", name: "Lua", color: "#000080", syntax: "code" },
  r: { id: "r", name: "R", color: "#198ce7", syntax: "code" },
  pl: { id: "perl", name: "Perl", color: "#0298c3", syntax: "code" },
  zig: { id: "zig", name: "Zig", color: "#ec915c", syntax: "code" },
  html: { id: "html", name: "HTML", color: "#e34c26", syntax: "html" },
  htm: { id: "html", name: "HTML", color: "#e34c26", syntax: "html" },
  xml: { id: "xml", name: "XML", color: "#8a8f9b", syntax: "html" },
  svg: { id: "xml", name: "SVG", color: "#ff9900", syntax: "html" },
  vue: { id: "vue", name: "Vue", color: "#41b883", syntax: "html" },
  svelte: { id: "svelte", name: "Svelte", color: "#ff3e00", syntax: "html" },
  css: { id: "css", name: "CSS", color: "#563d7c", syntax: "css" },
  scss: { id: "scss", name: "SCSS", color: "#c6538c", syntax: "css" },
  less: { id: "less", name: "Less", color: "#1d365d", syntax: "css" },
  json: { id: "json", name: "JSON", color: "#8a8f9b", syntax: "json" },
  jsonc: { id: "json", name: "JSON", color: "#8a8f9b", syntax: "json" },
  yml: { id: "yaml", name: "YAML", color: "#cb171e", syntax: "yaml" },
  yaml: { id: "yaml", name: "YAML", color: "#cb171e", syntax: "yaml" },
  toml: { id: "toml", name: "TOML", color: "#9c4221", syntax: "yaml" },
  ini: { id: "ini", name: "INI", color: "#8a8f9b", syntax: "yaml" },
  md: { id: "markdown", name: "Markdown", color: "#8a8f9b", syntax: "markdown" },
  mdx: { id: "markdown", name: "MDX", color: "#8a8f9b", syntax: "markdown" },
  sh: { id: "shell", name: "Shell", color: "#89e051", syntax: "shell" },
  bash: { id: "shell", name: "Bash", color: "#89e051", syntax: "shell" },
  zsh: { id: "shell", name: "Zsh", color: "#89e051", syntax: "shell" },
  ps1: { id: "powershell", name: "PowerShell", color: "#012456", syntax: "shell" },
  bat: { id: "batch", name: "Batch", color: "#8a8f9b", syntax: "shell" },
  cmd: { id: "batch", name: "Batch", color: "#8a8f9b", syntax: "shell" },
  sql: { id: "sql", name: "SQL", color: "#e38c00", syntax: "sql" },
  dockerfile: { id: "dockerfile", name: "Dockerfile", color: "#384d54", syntax: "shell" },
  makefile: { id: "makefile", name: "Makefile", color: "#8a8f9b", syntax: "code" },
  tf: { id: "terraform", name: "Terraform", color: "#844fba", syntax: "code" },
  graphql: { id: "graphql", name: "GraphQL", color: "#e10098", syntax: "code" },
  gql: { id: "graphql", name: "GraphQL", color: "#e10098", syntax: "code" },
  prisma: { id: "prisma", name: "Prisma", color: "#2d3748", syntax: "code" },
  env: { id: "dotenv", name: "Dotenv", color: "#8a8f9b", syntax: "yaml" }
};

const specialNames: Record<string, string> = {
  dockerfile: "dockerfile", makefile: "makefile", "cmakelists.txt": "code", license: "markdown", notice: "markdown",
  ".gitignore": "shell", ".dockerignore": "shell", ".env": "env", ".editorconfig": "ini", gemfile: "rb", rakefile: "rb",
  "go.mod": "go", "go.sum": "go", cargo: "toml"
};

export function languageFromPath(path: string): LanguageInfo | null {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  const lower = path.toLowerCase();
  if (specialNames[name]) return languages[specialNames[name]] ?? null;
  if (lower.includes("dockerfile")) return languages.dockerfile ?? null;
  const extension = name.includes(".") ? name.split(".").pop() ?? "" : "";
  return languages[extension] ?? null;
}

export function languageColor(language: string | null | undefined): string {
  if (!language) return "#5c6170";
  const found = Object.values(languages).find((item) => item.name.toLowerCase() === language.toLowerCase() || item.id === language.toLowerCase());
  return found?.color ?? "#5c6170";
}

export function isBinaryPath(path: string): boolean {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return ["png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp", "pdf", "zip", "gz", "tar", "jar", "war", "7z", "rar", "exe", "dll", "so", "dylib", "woff", "woff2", "ttf", "otf", "eot", "mp3", "mp4", "mov", "avi", "mkv", "webm", "wav", "ogg", "flac", "psd", "ai", "sketch", "fig", "class", "pyc", "wasm", "bin", "dat", "db", "sqlite", "woff2"].includes(extension);
}

export function syntaxModeFor(path: string): SyntaxMode {
  return languageFromPath(path)?.syntax ?? "code";
}
