import { Archive, Github, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import { safeCallbackUrl } from "@/lib/url";

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  if (await auth()) redirect("/dashboard");
  const query = await searchParams;
  const callbackUrl = safeCallbackUrl(query.callbackUrl);
  async function login() { "use server"; await signIn("github", { redirectTo: callbackUrl }); }
  return <main className="landing">
    <div className="landing-glow" aria-hidden="true"/>
    <header className="landing-nav"><div className="brand"><span className="brand-mark"><Archive/></span><span><strong>ZipToGit</strong><small>Pro</small></span></div><a href="https://github.com/hi77x/ZipGit---Panel" target="_blank" rel="noopener noreferrer">View source <Github/></a></header>
    <section className="hero">
      <div className="eyebrow"><Sparkles/> GitHub-native project delivery</div>
      <h1>From ZIP archive to a clean Git repository.</h1>
      <p>Validate every path, protect credentials, and publish one auditable root commit—without exposing your GitHub token to browser JavaScript.</p>
      {query.error ? <div className="inline-error" role="alert">GitHub sign-in did not complete. Please try again.</div> : null}
      <form action={login}><button className="button button-primary button-large" type="submit"><Github/> Continue with GitHub</button></form>
      <span className="hero-note"><ShieldCheck/> OAuth session · server-side GitHub API · no browser token</span>
    </section>
    <section className="landing-features" aria-label="Product highlights">
      <article><UploadCloud/><h2>Safe ZIP preflight</h2><p>Traversal, collisions, secrets, symlinks, encryption, and size limits are checked before GitHub is mutated.</p></article>
      <article><Github/><h2>One root commit</h2><p>Binary-safe Git Data API import with controlled concurrency and an honest partial-failure state.</p></article>
      <article><ShieldCheck/><h2>Real repository tools</h2><p>README, activity, Pages, and Actions reflect GitHub’s current state—never invented counters or mock data.</p></article>
    </section>
  </main>;
}
