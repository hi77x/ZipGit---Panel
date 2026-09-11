import { IssueForm } from "@/features/issues/issue-form";

export default async function NewIssuePage({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  return <div style={{ maxWidth: 760, margin: "0 auto" }}><IssueForm owner={owner} repo={repo} mode="create"/></div>;
}
