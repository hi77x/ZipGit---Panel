import { auth } from "@/auth";
import { Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState, PermissionState } from "@/components/feedback/states";
import { RepositoryCard } from "@/features/repository-list/repository-card";
import { requireGitHubSession } from "@/server/auth/require-session";
import { GitHubClient } from "@/server/github/client";
import { RepositoryService } from "@/server/services/repository-service";
import { AppError } from "@/shared/contracts/api-error";

export default async function DashboardPage() {
  const session = await auth();
  let data: Awaited<ReturnType<RepositoryService["list"]>> | null = null;
  let loadError: unknown;
  try {
    const { accessToken } = await requireGitHubSession();
    data = await new RepositoryService(new GitHubClient(accessToken, crypto.randomUUID())).list({ affiliation: "owner,collaborator,organization_member", sort: "updated", direction: "desc", page: 1, perPage: 6 });
  } catch (error) {
    loadError = error;
  }
  if (loadError) {
    if (loadError instanceof AppError && (loadError.code === "UNAUTHENTICATED" || loadError.code === "AUTH_RECONNECT_REQUIRED")) return <div className="page"><PermissionState message={loadError.message}/></div>;
    return <div className="page"><ErrorState message="GitHub repositories could not be loaded. Your existing data has not been changed."/></div>;
  }
  return <div className="page"><header className="page-header"><div><span className="eyebrow">Workspace overview</span><h1>Welcome back, {session?.user.login}</h1><p>Your recently updated repositories and the fastest path to a clean import.</p></div><ButtonLink href="/import" variant="primary"><Upload/> Import ZIP</ButtonLink></header>
    <section className="section-heading"><div><h2>Recent repositories</h2><p>Latest accessible GitHub repositories; metrics reflect only this loaded selection.</p></div><ButtonLink href="/repositories">View all</ButtonLink></section>
    {data?.repositories.length ? <div className="grid">{data.repositories.map((repo) => <RepositoryCard key={repo.id} repository={repo}/>)}</div> : <EmptyState title="No repositories yet" message="Import a ZIP to create your first repository."/>}
  </div>;
}
