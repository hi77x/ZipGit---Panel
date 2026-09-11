export type DetectedManifest = {
  path: string;
  ecosystem: string;
  label: string;
  runtime: number;
  development: number;
  sample: string[];
};

export function detectManifests(files: Array<{ path: string; content: string }>): DetectedManifest[] {
  const manifests: DetectedManifest[] = [];
  for (const file of files) {
    const name = file.path.split("/").pop()?.toLowerCase() ?? "";
    const parsed = parseManifest(name, file.content);
    if (parsed) manifests.push({ path: file.path, ...parsed });
  }
  return manifests;
}

function parseManifest(name: string, content: string): Omit<DetectedManifest, "path"> | null {
  if (name === "package.json") {
    try {
      const json = JSON.parse(content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string> };
      const runtime = Object.keys(json.dependencies ?? {});
      const development = Object.keys(json.devDependencies ?? {});
      const peer = Object.keys(json.peerDependencies ?? {});
      if (runtime.length + development.length + peer.length === 0) return null;
      return { ecosystem: "npm", label: "Node.js", runtime: runtime.length + peer.length, development: development.length, sample: [...runtime, ...peer].slice(0, 8).map((item) => String(item)) };
    } catch { return null; }
  }
  if (name === "requirements.txt" || name === "requirements-dev.txt") {
    const packages = content.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && !line.startsWith("-"));
    return { ecosystem: "pip", label: "Python", runtime: packages.length, development: name.includes("dev") ? packages.length : 0, sample: packages.slice(0, 8).map((line) => line.split(/[=<>!~]/)[0] ?? line) };
  }
  if (name === "pyproject.toml") {
    const matches = [...content.matchAll(/^\s*([A-Za-z0-9_.-]+)\s*=\s*["']/gm)].map((match) => match[1] ?? "").filter((item) => item && !["name", "version", "description", "requires-python", "readme", "license", "authors", "classifiers"].includes(item));
    if (!matches.length) return null;
    return { ecosystem: "pip", label: "Python", runtime: matches.length, development: 0, sample: matches.slice(0, 8) };
  }
  if (name === "go.mod") {
    const requires = [...content.matchAll(/^\s*([\w./-]+\.[\w./-]+)\s+v[\w.-]+/gm)].map((match) => match[1] ?? "");
    return { ecosystem: "go", label: "Go modules", runtime: requires.length, development: 0, sample: requires.slice(0, 8) };
  }
  if (name === "cargo.toml") {
    const section = content.split(/\[/).find((part) => part.startsWith("dependencies]")) ?? "";
    const packages = [...section.matchAll(/^\s*([A-Za-z0-9_-]+)\s*=/gm)].map((match) => match[1] ?? "");
    return { ecosystem: "cargo", label: "Rust", runtime: packages.length, development: 0, sample: packages.slice(0, 8) };
  }
  if (name === "composer.json") {
    try {
      const json = JSON.parse(content) as { require?: Record<string, string>; "require-dev"?: Record<string, string> };
      const runtime = Object.keys(json.require ?? {}).filter((key) => key !== "php");
      const development = Object.keys(json["require-dev"] ?? {});
      if (!runtime.length && !development.length) return null;
      return { ecosystem: "composer", label: "PHP", runtime: runtime.length, development: development.length, sample: runtime.slice(0, 8) };
    } catch { return null; }
  }
  if (name === "gemfile") {
    const gems = [...content.matchAll(/^\s*gem\s+["']([^"']+)["']/gm)].map((match) => match[1] ?? "");
    return { ecosystem: "bundler", label: "Ruby", runtime: gems.length, development: 0, sample: gems.slice(0, 8) };
  }
  if (name === "pom.xml") {
    const dependencies = content.match(/<dependency>/g)?.length ?? 0;
    return { ecosystem: "maven", label: "Java", runtime: dependencies, development: 0, sample: [] };
  }
  if (name === "build.gradle" || name === "build.gradle.kts") {
    const dependencies = content.match(/^\s*(?:implementation|api|compileOnly|runtimeOnly)\s*\(/gm)?.length ?? 0;
    return { ecosystem: "gradle", label: "Gradle", runtime: dependencies, development: 0, sample: [] };
  }
  if (name === "dockerfile") {
    return { ecosystem: "docker", label: "Docker", runtime: 0, development: 0, sample: [] };
  }
  return null;
}

export function hasTestSignals(paths: string[], manifests: DetectedManifest[]): boolean {
  if (paths.some((path) => /(^|\/)(tests?|__tests__|spec)(\/|$)|\.(test|spec)\.[a-z]+$/i.test(path))) return true;
  return manifests.some((manifest) => manifest.path.endsWith("package.json"));
}
