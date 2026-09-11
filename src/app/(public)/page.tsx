import { Archive, ArrowRight, BookOpen, Bot, Braces, Command, FileDiff, FolderTree, Gauge, Github, GitPullRequest, KeyRound, Layers, Radar, Search, ShieldCheck, Sparkles, Terminal, UploadCloud, Workflow, Zap } from "lucide-react";
import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import { safeCallbackUrl } from "@/lib/url";

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  if (await auth()) redirect("/dashboard");
  const query = await searchParams;
  const callbackUrl = safeCallbackUrl(query.callbackUrl);
  async function login() { "use server"; await signIn("github", { redirectTo: callbackUrl }); }
  const highlights = [
    { icon: FolderTree, title: "Code explorer", text: "Browse any branch, open files with fast self-written syntax highlighting, edit and commit without leaving the browser." },
    { icon: FileDiff, title: "Review-grade diffs", text: "Per-file diffs, path filter, viewed state that survives reloads, and lazy loading for huge patches — the GitHub review pain points, fixed." },
    { icon: Radar, title: "Repo Radar", text: "Health score, language composition, contributor map, commit heatmap, dependency inventory, and a custom secret scanner." },
    { icon: GitPullRequest, title: "Issues & pull requests", text: "Triage, comment, review, merge, and close — a focused workflow for repositories you already own on GitHub." },
    { icon: Command, title: "Keyboard first", text: "Command palette on ⌘K, instant fuzzy search across repositories, dark and light themes, zero click-waste." },
    { icon: ShieldCheck, title: "Self-hosted security", text: "The GitHub token never reaches browser JavaScript. CSP, typed errors, rate-limit telemetry, and strict server-side allowlists." }
  ];
  const painPoints = [
    { problem: "“Load diff” hides the files that matter", solution: "Per-file diffs with lazy loading, path filtering, and a reviewed counter" },
    { problem: "You lose your place in a 40-file review", solution: "Viewed state persisted per commit and pull request" },
    { problem: "No visibility into who reviews what", solution: "Review load and contributor analytics in Repo Radar" },
    { problem: "Secrets leak into public history", solution: "30-rule secret scanner with severity, masked snippets, and remediation" },
    { problem: "Repository health is a mystery", solution: "A weighted 14-check health score with concrete next actions" },
    { problem: "GitHub’s UI hides half of what you can do", solution: "Branches, releases, Pages, Actions, and file writes in one command deck" }
  ];
  const stats = [
    { value: "30+", label: "built-in tools" },
    { value: "0", label: "tokens in the browser" },
    { value: "1", label: "command to self-host" },
    { value: "100%", label: "open source" }
  ];
  return <main className="landing">
    <div className="landing-glow" aria-hidden="true"/>
    <div className="landing-glow-2" aria-hidden="true"/>
    <header className="landing-nav">
      <div className="brand"><span className="brand-mark"><Layers/></span><span><strong>RepoDeck</strong><small>v5 · command deck</small></span></div>
      <div className="cluster">
        <a href="#features">Features</a>
        <a href="#difference">Why RepoDeck</a>
        <a href="#deploy">Deploy</a>
        <a href="https://github.com/hi77x/ZipGit---Panel" target="_blank" rel="noopener noreferrer">Source <Github/></a>
      </div>
    </header>
    <section className="hero">
      <div className="hero-badge reveal"><span className="dot-live"/><Sparkles/> Self-hosted control plane for GitHub</div>
      <h1 className="reveal reveal-2"><em>Mission control<br/>for your GitHub.</em></h1>
      <p className="reveal reveal-3">RepoDeck turns your repositories into a workspace you actually want to use: explore code, review diffs file by file, audit secrets, ship releases, and keep the token on your own server.</p>
      <div className="hero-actions reveal reveal-4">
        {query.error ? <div className="inline-error" role="alert">GitHub sign-in did not complete. Please try again.</div> : null}
        <form action={login}><button className="button button-primary button-lg" type="submit"><Github/> Continue with GitHub</button></form>
        <a className="button button-lg" href="#features">Explore capabilities <ArrowRight/></a>
      </div>
      <span className="hero-note"><KeyRound/> OAuth session · server-side GitHub API · no browser token</span>
    </section>
    <section className="landing-stats" aria-label="Product highlights">
      {stats.map((stat) => <div className="landing-stat" key={stat.label}><b>{stat.value}</b><span>{stat.label}</span></div>)}
    </section>
    <section className="landing-features" id="features" style={{ marginTop: 80 }}>
      {highlights.map(({ icon: Icon, title, text }) => <article key={title}><Icon/><h2>{title}</h2><p>{text}</p></article>)}
    </section>
    <section className="landing-section" id="difference">
      <header>
        <span className="eyebrow"><Zap/> The difference</span>
        <h2>Built around the sharp edges of GitHub</h2>
        <p>Every feature started as a real complaint from developers who review code, audit repositories, and ship from a browser.</p>
      </header>
      <div className="grid-2">
        {painPoints.map((item) => <article className="card card-hover" key={item.problem}>
          <p className="muted text-sm" style={{ marginBottom: 6 }}>{item.problem}</p>
          <p style={{ margin: 0, fontWeight: 600 }}><ShieldCheck style={{ width: 16, height: 16, verticalAlign: "-2px", marginRight: 8, color: "var(--success)" }}/>{item.solution}</p>
        </article>)}
      </div>
    </section>
    <section className="landing-section">
      <header>
        <span className="eyebrow"><Braces/> Every surface you need</span>
        <h2>One deck for the whole repository lifecycle</h2>
      </header>
      <div className="landing-features">
        <article><Archive/><h2>ZIP import</h2><p>Publish a folder or archive as one auditable root commit, with path, collision, symlink, and secret preflight.</p></article>
        <article><BookOpen/><h2>README and docs</h2><p>Safe GFM rendering with URL rewriting, plus the raw source one click away.</p></article>
        <article><Workflow/><h2>Actions and Pages</h2><p>Dispatch workflows, re-run or cancel jobs, and manage Pages deployments with honest states.</p></article>
        <article><Search/><h2>Global search</h2><p>Search repositories, code, and issues through the GitHub API with a fuzzy local index as a fallback.</p></article>
        <article><Bot/><h2>Dependency inventory</h2><p>Detect npm, pip, Go, Cargo, Maven, and Composer manifests and understand what a repository actually pulls in.</p></article>
        <article><UploadCloud/><h2>Local deployment</h2><p>Run it with Docker Compose or plain npm on Windows, macOS, and Linux. One health check tells you what is missing.</p></article>
      </div>
    </section>
    <section className="landing-section" id="deploy">
      <header>
        <span className="eyebrow"><Terminal/> Self-host in minutes</span>
        <h2>Your server, your tokens, your data</h2>
        <p>RepoDeck speaks to GitHub’s API from the server only. Clone it, run the doctor, pick a launch path.</p>
      </header>
      <div className="grid-2">
        <article className="panel"><div className="panel-head"><h3><Terminal/> Local development</h3></div><div className="panel-body"><pre className="mono text-sm" style={{ margin: 0, overflowX: "auto" }}>{`git clone https://github.com/hi77x/ZipGit---Panel.git
cd ZipGit---Panel
npm install
npm run doctor
npm run dev`}</pre></div></article>
        <article className="panel"><div className="panel-head"><h3><UploadCloud/> One-command deploy</h3></div><div className="panel-body"><pre className="mono text-sm" style={{ margin: 0, overflowX: "auto" }}>{`cp .env.example .env
# add AUTH_SECRET and GitHub OAuth keys
docker compose up -d --build
# open http://localhost:3000`}</pre></div></article>
      </div>
    </section>
    <section className="landing-cta">
      <span className="eyebrow"><Gauge/> Ready when you are</span>
      <h1 style={{ fontSize: "clamp(2rem, 4.5vw, 3.2rem)" }}>Give your repositories a real command deck.</h1>
      <p className="muted" style={{ maxWidth: 560, margin: "0 auto 24px" }}>Sign in with GitHub and RepoDeck maps every repository you can already access. Nothing is copied, nothing is locked in.</p>
      <form action={login}><button className="button button-primary button-lg" type="submit"><Github/> Continue with GitHub</button></form>
    </section>
    <footer className="landing-footer">
      <span>RepoDeck · MIT licensed · built with Next.js, Auth.js, and the GitHub API</span>
      <nav><a href="#features">Features</a><a href="#deploy">Deploy</a><a href="https://github.com/hi77x/ZipGit---Panel" target="_blank" rel="noopener noreferrer">GitHub</a></nav>
    </footer>
  </main>;
}
