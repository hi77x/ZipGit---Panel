/* == api == */
/* same-origin backend proxy (Next) or direct browser→GitHub (static monolith) */
const ghBase = () => state.proxy ? '/api/github' : 'https://api.github.com';
async function probeProxy(){
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch('/api/health', { cache:'no-store', signal: ctl.signal });
    clearTimeout(to);
    state.proxy = r.ok;
  } catch(e){ state.proxy = false; }
  return state.proxy;
}
class ApiError extends Error { constructor(status,msg){ super(msg||('HTTP '+status)); this.status=status; } }
async function gh(path, opts={}){
  const headers = { 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28' };
  if (state.token) headers['Authorization'] = 'token ' + state.token;
  if (opts.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(ghBase() + path, { ...opts, headers });
  const sc = res.headers.get('x-oauth-scopes'); if (sc != null) state.scopes = sc;
  const rl = res.headers.get('x-ratelimit-remaining'); if (rl != null) state.rate = +rl;
  updateRateChip && updateRateChip();
  if (!res.ok){
    let msg = res.status + ' ' + res.statusText;
    try { const j = await res.json(); if (j.message) msg = j.message; } catch(e){}
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}
async function ghAll(path){
  const sep = path.includes('?') ? '&' : '?';
  let page = 1, out = [];
  for(;;){ const r = await gh(path + sep + 'per_page=100&page=' + page); out = out.concat(r); if (!Array.isArray(r) || r.length < 100) break; page++; if (page > 20) break; }
  return out;
}
async function fetchRawU8(full, branch, path){
  const res = await fetch(`${ghBase()}/repos/${full}/contents/${encPath(path)}?ref=${encodeURIComponent(branch)}`, {
    headers: { Accept:'application/vnd.github.raw+json', ...(state.token ? { Authorization:'token ' + state.token } : {}) } });
  if (!res.ok) throw new ApiError(res.status, 'Raw fetch failed: ' + path);
  return new Uint8Array(await res.arrayBuffer());
}
const encPath = p => encodeURIComponent(p).replace(/%2F/g,'/');

/* ---- Git Data pipeline ---- */
async function headInfo(full, branch){
  try {
    const ref = await gh(`/repos/${full}/git/ref/heads/${encodeURIComponent(branch)}`);
    const headSha = ref.object.sha;
    const base = await gh(`/repos/${full}/git/commits/${headSha}`);
    return { headSha, baseTree: base.tree.sha };
  } catch(e){
    if (e.status === 404 || e.status === 409) return { headSha: null, baseTree: null }; // empty repo
    throw e;
  }
}
/** entries: [{path, mode, type, sha}] — sha:null deletes the path */
async function commitTree({ full, branch, entries, message, useBase = true, onProgress }){
  const log = m => onProgress && onProgress(m);
  const { headSha, baseTree } = await headInfo(full, branch);
  const treeBody = { tree: entries };
  if (useBase && headSha && baseTree) treeBody.base_tree = baseTree;
  log(t('up_tree'));
  const tree = await gh(`/repos/${full}/git/trees`, { method:'POST', body: JSON.stringify(treeBody) });
  log(t('up_commit'));
  const commit = await gh(`/repos/${full}/git/commits`, { method:'POST', body: JSON.stringify({ message: redact(message), tree: tree.sha, parents: headSha ? [headSha] : [] }) });
  log(t('up_ref'));
  if (!headSha) await gh(`/repos/${full}/git/refs`, { method:'POST', body: JSON.stringify({ ref:'refs/heads/' + branch, sha: commit.sha }) });
  else await gh(`/repos/${full}/git/refs/heads/${encodeURIComponent(branch)}`, { method:'PATCH', body: JSON.stringify({ sha: commit.sha, force:true }) });
  log('✓');
  return commit;
}
async function commitFiles({ full, branch, files, message, mode, onProgress }){
  const log = m => onProgress && onProgress(m);
  const { headSha, baseTree } = await headInfo(full, branch);
  const entries = [];
  const BATCH = 10;
  for (let i = 0; i < files.length; i += BATCH){
    if (state.pushCtl?.cancelled) throw new Error(t('up_cancelled'));
    const batch = files.slice(i, i + BATCH);
    let res;
    for (let attempt = 1; ; attempt++){
      try {
        res = await Promise.all(batch.map(f =>
          gh(`/repos/${full}/git/blobs`, { method:'POST', body: JSON.stringify({ content: b64(f.u8), encoding:'base64' }) })
        ));
        break;
      } catch(e){
        if (attempt >= 2 || state.pushCtl?.cancelled) throw e;
        log('⚠ ' + e.message + ' — retry…');
        await sleep(1500);
      }
    }
    batch.forEach((f, j) => entries.push({ path: f.path, mode:'100644', type:'blob', sha: res[j].sha }));
    log(`${t('up_blobs')}: ${Math.min(i+BATCH, files.length)}/${files.length}`);
  }
  const useBase = mode !== 'replace';
  const treeBody = { tree: entries };
  if (useBase && headSha && baseTree) treeBody.base_tree = baseTree;
  log(t('up_tree'));
  const tree = await gh(`/repos/${full}/git/trees`, { method:'POST', body: JSON.stringify(treeBody) });
  log(t('up_commit'));
  const commit = await gh(`/repos/${full}/git/commits`, { method:'POST', body: JSON.stringify({ message: redact(message), tree: tree.sha, parents: headSha ? [headSha] : [] }) });
  log(t('up_ref'));
  if (!headSha) await gh(`/repos/${full}/git/refs`, { method:'POST', body: JSON.stringify({ ref:'refs/heads/' + branch, sha: commit.sha }) });
  else await gh(`/repos/${full}/git/refs/heads/${encodeURIComponent(branch)}`, { method:'PATCH', body: JSON.stringify({ sha: commit.sha, force:true }) });
  log('✓ ' + t('up_done'));
  return commit;
}
/** rename/move a file keeping its blob (single commit) */
async function renameFileCommit(full, branch, oldPath, newPath, message){
  const meta = await gh(`/repos/${full}/contents/${encPath(oldPath)}?ref=${encodeURIComponent(branch)}`);
  return commitTree({ full, branch, message, entries: [
    { path: newPath, mode:'100644', type:'blob', sha: meta.sha },
    { path: oldPath, mode:'100644', type:'blob', sha: null }
  ]});
}
async function deleteFileCommit(full, branch, path, message){
  const meta = await gh(`/repos/${full}/contents/${encPath(path)}?ref=${encodeURIComponent(branch)}`);
  return commitTree({ full, branch, message, entries: [ { path, mode:'100644', type:'blob', sha: null } ]});
}
