"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { Badge, Card, Panel, PanelHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/states";
import { useToast } from "@/components/feedback/toast-provider";
import { apiRequest } from "@/features/api-client";
import { formatBytes, formatNumber, relativeTime } from "@/lib/format";
import type { ReleaseDto } from "@/shared/contracts/misc";

type ReleaseDraft = { tagName: string; name: string; body: string; draft: boolean; prerelease: boolean };

const emptyDraft: ReleaseDraft = { tagName: "", name: "", body: "", draft: false, prerelease: false };

export function ReleaseManager({ owner, repo, releases }: { owner: string; repo: string; releases: ReleaseDto[] }) {
  const base = `/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`;
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<ReleaseDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<ReleaseDraft>(emptyDraft);
  const [pending, setPending] = useState<string | null>(null);

  async function createRelease(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tagName = draft.tagName.trim();
    if (!tagName) {
      toast("A release tag is required.", "error");
      return;
    }
    setPending("create");
    try {
      await apiRequest<ReleaseDto>(base, {
        method: "POST",
        body: JSON.stringify({ tagName, name: draft.name.trim() || undefined, body: draft.body || undefined, draft: draft.draft, prerelease: draft.prerelease })
      });
      setDraft(emptyDraft);
      toast(`Release ${tagName} created.`, "success");
      router.refresh();
    } catch (unknownError) {
      toast(unknownError instanceof Error ? unknownError.message : "Release could not be created.", "error");
    } finally {
      setPending(null);
    }
  }

  function startEdit(release: ReleaseDto) {
    setEditingId(release.id);
    setEditDraft({ tagName: release.tagName, name: release.name, body: release.body, draft: release.draft, prerelease: release.prerelease });
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault();
    const tagName = editDraft.tagName.trim();
    if (!tagName) {
      toast("A release tag is required.", "error");
      return;
    }
    setPending(`edit-${id}`);
    try {
      await apiRequest<ReleaseDto>(`${base}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ tagName, name: editDraft.name.trim(), body: editDraft.body, draft: editDraft.draft, prerelease: editDraft.prerelease })
      });
      setEditingId(null);
      toast("Release updated.", "success");
      router.refresh();
    } catch (unknownError) {
      toast(unknownError instanceof Error ? unknownError.message : "Release could not be updated.", "error");
    } finally {
      setPending(null);
    }
  }

  async function deleteRelease(release: ReleaseDto) {
    if (!window.confirm(`Delete release ${release.tagName}? This cannot be undone.`)) return;
    setPending(`delete-${release.id}`);
    try {
      await apiRequest<{ deleted: boolean }>(`${base}/${release.id}`, { method: "DELETE" });
      if (editingId === release.id) setEditingId(null);
      toast(`Release ${release.tagName} deleted.`, "success");
      router.refresh();
    } catch (unknownError) {
      toast(unknownError instanceof Error ? unknownError.message : "Release could not be deleted.", "error");
    } finally {
      setPending(null);
    }
  }

  return <div className="feature-stack">
    <Panel>
      <PanelHead title="Create a release" icon={<Plus/>} actions={<span className="muted text-xs">Generated from Git tags</span>}/>
      <form className="panel-body" onSubmit={(event) => void createRelease(event)}>
        <div className="form-grid">
          <label className="field"><span>Tag</span><input value={draft.tagName} onChange={(event) => setDraft((current) => ({ ...current, tagName: event.target.value }))} placeholder="v1.0.0" maxLength={200} required/></label>
          <label className="field"><span>Release title</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Optional display name" maxLength={256}/></label>
          <label className="field full-field"><span>Release notes</span><textarea value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} placeholder="Describe what changed in this release" maxLength={125000}/></label>
        </div>
        <div className="spread">
          <div className="cluster">
            <label className="switch"><input type="checkbox" checked={draft.draft} onChange={(event) => setDraft((current) => ({ ...current, draft: event.target.checked }))}/><span className="switch-track"/>Draft</label>
            <label className="switch"><input type="checkbox" checked={draft.prerelease} onChange={(event) => setDraft((current) => ({ ...current, prerelease: event.target.checked }))}/><span className="switch-track"/>Pre-release</label>
          </div>
          <Button type="submit" variant="primary" loading={pending === "create"}><Plus/>Publish release</Button>
        </div>
      </form>
    </Panel>

    <section className="section-heading"><div><h2>Releases</h2><p>Releases generated from Git tags, including drafts and pre-releases.</p></div></section>

    {releases.length ? <div className="stack">{releases.map((release) => {
      const downloads = release.assets.reduce((total, asset) => total + asset.downloadCount, 0);
      const editing = editingId === release.id;
      return <Card key={release.id}>
        <div className="spread">
          <div>
            <div className="cluster">
              <span className="tag"><Tag/>{release.tagName}</span>
              {release.name ? <strong>{release.name}</strong> : null}
              <Badge tone={release.draft ? "warning" : release.prerelease ? "info" : "success"}>{release.draft ? "draft" : release.prerelease ? "pre-release" : "latest"}</Badge>
            </div>
            <p className="muted text-xs" style={{ margin: "10px 0 0" }}>{release.author?.login ?? "GitHub user"} · <time dateTime={release.publishedAt ?? release.createdAt}>{relativeTime(release.publishedAt ?? release.createdAt)}</time> · {formatNumber(downloads)} downloads</p>
          </div>
          <div className="row-actions">
            <a className="button button-sm" href={release.url} target="_blank" rel="noopener noreferrer"><ExternalLink/>GitHub</a>
            <Button type="button" size="sm" onClick={() => startEdit(release)}><Pencil/>Edit</Button>
            <Button type="button" size="sm" variant="danger" loading={pending === `delete-${release.id}`} onClick={() => void deleteRelease(release)}><Trash2/>Delete</Button>
          </div>
        </div>

        {editing ? <form className="stack-sm" style={{ marginTop: 16 }} onSubmit={(event) => void saveEdit(event, release.id)}>
          <div className="form-grid" style={{ margin: 0 }}>
            <label className="field"><span>Tag</span><input value={editDraft.tagName} onChange={(event) => setEditDraft((current) => ({ ...current, tagName: event.target.value }))} maxLength={200} required/></label>
            <label className="field"><span>Release title</span><input value={editDraft.name} onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))} maxLength={256}/></label>
            <label className="field full-field"><span>Release notes</span><textarea value={editDraft.body} onChange={(event) => setEditDraft((current) => ({ ...current, body: event.target.value }))} maxLength={125000}/></label>
          </div>
          <div className="spread">
            <div className="cluster">
              <label className="switch"><input type="checkbox" checked={editDraft.draft} onChange={(event) => setEditDraft((current) => ({ ...current, draft: event.target.checked }))}/><span className="switch-track"/>Draft</label>
              <label className="switch"><input type="checkbox" checked={editDraft.prerelease} onChange={(event) => setEditDraft((current) => ({ ...current, prerelease: event.target.checked }))}/><span className="switch-track"/>Pre-release</label>
            </div>
            <div className="row-actions">
              <Button type="button" onClick={() => setEditingId(null)}><X/>Cancel</Button>
              <Button type="submit" variant="primary" loading={pending === `edit-${release.id}`}><Pencil/>Save changes</Button>
            </div>
          </div>
        </form> : release.body ? <div className="text-sm" style={{ marginTop: 16, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{release.body}</div> : null}

        {release.assets.length ? <div className="cluster" style={{ marginTop: 16 }}>{release.assets.map((asset) => <a className="tag" key={asset.id} href={asset.url} title={`${asset.name} · ${formatBytes(asset.size)}`}><Download/>{asset.name} · {formatNumber(asset.downloadCount)}</a>)}</div> : null}
      </Card>;
    })}</div> : <EmptyState title="No releases yet" message="Create the first release above. GitHub builds downloadable archives from the selected tag automatically."/>}
  </div>;
}
