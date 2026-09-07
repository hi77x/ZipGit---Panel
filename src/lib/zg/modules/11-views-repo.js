/* == views: repo (files tree, editor, upload) == */
async function openRepo(full){
  toast(t('ts_open_repo') + ' ' + full + '…');
  try {
    let r = state.repos.find(x => x.full_name === full);
    if (!r) r = await gh('/repos/' + full);
    state.repo = r;
    state.branch = r.default_branch;
    state.tab = 'files';
    state.view = 'repo';
    state.commitSel = null;
    state.editor = { path: null, sha: null, dirty: false };
    state.tree = { cache: new Map(), expanded: new Set(), loading: new Set() };
    const [branches, starred, sub, langs] = await Promise.all([
      ghAll(`/repos/${full}/branches`),
      gh(`/user/starred/${full}`).then(() => true).catch(() => false),
      gh(`/repos/${full}/subscription`).then(s => !!s?.subscribed).catch(() => false),
      gh(`/repos/${full}/languages`).catch(() => ({}))
    ]);
    state.branches = branches;
    state.repoMeta = { starred, watching: sub, langs };
    renderSidebar(); renderTopbar(); renderRepo();
  } catch(e){ fail(e); }
}
async function toggleStar(){
  const full = state.repo.full_name;
  try {
    if (state.repoMeta.starred){ await gh(`/user/starred/${full}`, { method:'DELETE' }); state.repoMeta.starred = false; toast(t('head_unstarred')); }
    else { await gh(`/user/starred/${full}`, { method:'PUT' }); state.repoMeta.starred = true; toast(t('head_starred')); }
    renderRepo();
  } catch(e){ fail(e); }
}
async function toggleWatch(){
  const full = state.repo.full_name;
  try {
    if (state.repoMeta.watching){ await gh(`/repos/${full}/subscription`, { method:'DELETE' }); state.repoMeta.watching = false; }
    else await gh(`/repos/${full}/subscription`, { method:'PUT', body: JSON.stringify({ subscribed:true }) }), state.repoMeta.watching = true;
    renderRepo();
  } catch(e){ fail(e); }
}
async function forkRepo(){
  try {
    await gh(`/repos/${state.repo.full_name}/forks`, { method:'POST' });
    toast(t('head_forked'));
    state.repos = await ghAll('/user/repos?sort=updated');
  } catch(e){ fail(e); }
}
function copyClone(){
  const url = 'https://github.com/' + state.repo.full_name + '.git';
  if (navigator.clipboard) navigator.clipboard.writeText(url).catch(()=>{});
  toast(t('ts_copied') + ': ' + url);
}
const TABS = [
  { id:'files', label:'tab_files', ic:'file' },
  { id:'upload', label:'tab_upload', ic:'upload' },
  { id:'branches', label:'tab_branches', ic:'branch' },
  { id:'prs', label:'tab_prs', ic:'pr' },
  { id:'issues', label:'tab_issues', ic:'issue' },
  { id:'commits', label:'tab_commits', ic:'commit' },
  { id:'releases', label:'tab_releases', ic:'tag' },
  { id:'actions', label:'tab_actions', ic:'play' },
  { id:'pages', label:'tab_pages', ic:'globe' },
  { id:'rsettings', label:'tab_settings', ic:'gear' }
];
function langBarHTML(){
  const langs = state.repoMeta?.langs || {};
  const entries = Object.entries(langs);
  if (!entries.length) return '';
  const total = entries.reduce((s,[,v]) => s+v, 0);
  return `<div class="langbar">${entries.map(([k,v]) => `<i style="width:${(v/total*100).toFixed(1)}%;background:${LANG_COLORS[k]||'#666'}" title="${esc(k)} ${(v/total*100).toFixed(0)}%"></i>`).join('')}</div>
  <div class="lang-legend">${entries.slice(0,6).map(([k,v]) => `<span><i class="dot" style="background:${LANG_COLORS[k]||'#666'}"></i>${esc(k)} ${(v/total*100).toFixed(0)}%</span>`).join('')}</div>`;
}
function renderRepo(){
  const c = $('#content');
  const r = state.repo;
  c.innerHTML = `
    <div class="repo-head glass">
      <div class="rt">
        <h2>${icon(r.private?'lock':'repo')} ${esc(r.name)}
          ${r.private ? `<span class="badge b-private">${t('c_private')}</span>` : `<span class="badge b-public">${t('c_public')}</span>`}
          ${r.fork ? `<span class="badge b-neutral">${t('c_fork')}</span>` : ''}
        </h2>
        <p class="muted small" style="margin-top:3px">${esc(r.description || '')} ${r.language ? `· <i class="dot" style="width:8px;height:8px;border-radius:50%;display:inline-block;background:${LANG_COLORS[r.language]||'#888'}"></i> ${esc(r.language)}` : ''} · ${fmtBytes((r.size||0)*1024)} · ★ ${r.stargazers_count}</p>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="btn btn-sm${state.repoMeta?.starred?' btn-ok':''}" data-act="star-toggle" title="Star">${icon('star')} ${r.stargazers_count + (state.repoMeta?.starred?0:0)}</button>
        <button class="btn btn-sm${state.repoMeta?.watching?' btn-ok':''}" data-act="watch-toggle" title="Watch">${icon('eye2')}</button>
        <button class="btn btn-sm hide-m" data-act="fork-repo" title="${t('head_fork')}">${icon('fork')}</button>
        <button class="btn btn-sm hide-m" data-act="copy-clone" title="${t('head_clone')}">${icon('copy')}</button>
        <a class="btn btn-sm hide-m" target="_blank" rel="noopener" href="${esc(r.html_url)}">${icon('ext')}</a>
        <a class="btn btn-sm hide-m" target="_blank" rel="noopener" href="https://github.com/${esc(r.full_name)}/archive/refs/heads/${encodeURIComponent(state.branch||r.default_branch)}.zip">${icon('download')}</a>
      </div>
    </div>
    ${langBarHTML() ? `<div class="glass pad" style="padding:14px 18px;margin:-6px 0 14px">${langBarHTML()}</div>` : ''}
    <div class="tabs">${TABS.map(x => `<button class="tab${state.tab===x.id?' on':''}" data-act="tab" data-tab="${x.id}">${icon(x.ic)}${t(x.label)}</button>`).join('')}</div>
    <div id="repoTab"></div>`;
  ({files:renderTabFiles, upload:renderTabUpload, branches:renderTabBranches, prs:renderTabPRs, issues:renderTabIssues, commits:renderTabCommits, releases:renderTabReleases, actions:renderTabActions, pages:renderTabPages, rsettings:renderTabRepoSettings})[state.tab]();
}

/* ---------- file tree ---------- */
async function loadTreeDir(path){
  const full = state.repo.full_name;
  state.tree.loading.add(path);
  try {
    const raw = await gh(`/repos/${full}/contents/${encPath(path)}?ref=${encodeURIComponent(state.branch)}`).catch(() => []);
    const items = Array.isArray(raw) ? raw : [];
    const sorted = [...items].sort((a,b) => (a.type===b.type ? a.name.localeCompare(b.name) : a.type==='dir' ? -1 : 1));
    state.tree.cache.set(path, sorted);
  } finally { state.tree.loading.delete(path); }
}
function treeNodeHTML(item, depth){
  const isDir = item.type === 'dir';
  const pad = 8 + depth*14;
  let html = `<div class="tnode${isDir?' dir':''}${state.editor.path===item.path?' on':''}" style="padding-left:${pad}px"
      data-act="${isDir?'tree-dir':'tree-file'}" data-path="${esc(item.path)}">
    ${isDir ? `<span class="caret${state.tree.expanded.has(item.path)?' open':''}">${icon('caret','ic caret'+(state.tree.expanded.has(item.path)?' open':''))}</span>` : '<span style="width:14px;flex:none"></span>'}
    <span class="n-ic">${icon(isDir?'folder':'file')}</span><b>${esc(item.name)}</b>
    <span class="t-act">
      ${isDir ? `<button title="${t('fl_new_file')}" data-act="tree-newfile" data-path="${esc(item.path)}">${icon('plus')}</button>`
              : `<button title="${t('fl_rename')}" data-act="tree-rename" data-path="${esc(item.path)}">${icon('edit')}</button>
                 <button title="${t('fl_delete')}" data-act="tree-delete" data-path="${esc(item.path)}">${icon('trash')}</button>`}
    </span>
  </div>`;
  if (isDir && state.tree.expanded.has(item.path)){
    const kids = state.tree.cache.get(item.path);
    if (!kids) html += `<div class="tnode" style="padding-left:${pad+18}px"><span class="dim tiny">${icon('spinner','ic spin')} …</span></div>`;
    else if (!kids.length) html += `<div class="tnode dim tiny" style="padding-left:${pad+18}px">—</div>`;
    else html += kids.map(k => treeNodeHTML(k, depth+1)).join('');
  }
  return html;
}
async function renderTree(){
  const root = $('#treeRoot');
  if (!root) return;
  if (!state.tree.cache.has('')){ await loadTreeDir(''); }
  const items = state.tree.cache.get('') || [];
  root.innerHTML = items.length ? items.map(i => treeNodeHTML(i, 0)).join('') : `<div class="empty tiny">${t('fl_empty_dir')}</div>`;
}
async function renderTabFiles(){
  const box = $('#repoTab');
  if (!state.branches.length){
    box.innerHTML = `<div class="glass empty">${icon('repo')}<br><b style="font-size:15px">${t('fl_empty_repo_t')}</b><br><span class="muted small">${t('fl_empty_repo_s')}</span><br><button class="btn btn-primary btn-sm" style="margin-top:14px" data-act="tab" data-tab="upload">${icon('upload')} ${t('fl_go_upload')}</button></div>`;
    return;
  }
  box.innerHTML = `
    <div class="fs-split">
      <div class="glass tree-pane">
        <div style="display:flex;gap:6px;align-items:center;padding:2px 4px 9px;border-bottom:1px solid var(--stroke);margin-bottom:8px">
          <span class="small muted" style="flex:1;font-weight:600">${icon('branch')} ${esc(state.branch)}</span>
          <button class="btn btn-ghost btn-icon" title="${t('fl_new_file')}" data-act="new-file-modal">${icon('plus')}</button>
          <button class="btn btn-ghost btn-icon" title="${t('fl_refresh')}" data-act="tree-refresh">${icon('refresh')}</button>
        </div>
        <div id="treeRoot"><div class="empty tiny">${icon('spinner','ic spin')}</div></div>
      </div>
      <div class="glass editor-pane">
        <div class="ed-bar">
          <span class="path" id="edPath">—</span>
          <span class="badge b-neutral" id="edMode">${t('fl_view')}</span>
          <input class="field" id="edMsg" style="width:200px;display:none" placeholder="${t('fl_commit_msg')}">
          <button class="btn btn-sm" id="edToggle" style="display:none" data-act="ed-toggle">${icon('edit')} ${t('fl_editing')}</button>
          <button class="btn btn-sm btn-primary" id="edSave" style="display:none" data-act="ed-save">${icon('check')} ${t('fl_save')}</button>
          <button class="btn btn-ghost btn-icon" id="edRename" style="display:none" title="${t('fl_rename')}" data-act="ed-rename">${icon('edit')}</button>
          <button class="btn btn-ghost btn-icon" id="edDl" style="display:none" title="${t('fl_download')}" data-act="ed-dl">${icon('download')}</button>
          <button class="btn btn-ghost btn-icon" id="edDel" style="display:none" title="${t('fl_delete')}" data-act="ed-del">${icon('trash')}</button>
        </div>
        <div class="ed-body" id="edBody"><div class="empty">${icon('file')}<br><span class="small">Monaco Editor</span></div></div>
      </div>
    </div>`;
  renderTree();
}
async function refreshTree(){
  state.tree.cache.clear(); state.tree.expanded.clear();
  await renderTree();
}
let onEditorDirty = dirty => {
  state.editor.dirty = dirty;
  const b = $('#edMode'); if (b) b.textContent = dirty ? '● ' + t('fl_editing') : t(state.editor.editing ? 'fl_editing' : 'fl_view');
};
async function openFileInEditor(path){
  const full = state.repo.full_name;
  const edBody = $('#edBody');
  edBody.innerHTML = `<div class="empty">${icon('spinner','ic spin')}</div>`;
  try {
    const meta = await gh(`/repos/${full}/contents/${encPath(path)}?ref=${encodeURIComponent(state.branch)}`);
    let u8 = meta.size > 950000 ? await fetchRawU8(full, state.branch, path) : fromB64((meta.content||'').replace(/\n/g,''));
    const isText = !u8.subarray(0, 4000).includes(0);
    state.editor = { path, sha: meta.sha, dirty: false, editing: false, isText };
    $('#edPath').textContent = path;
    ['edRename','edDl','edDel'].forEach(id => $('#'+id).style.display = '');
    if (!isText){
      $('#edToggle').style.display = 'none';
      edBody.innerHTML = `<div class="empty">${icon('zip')}<br>${t('fl_binary')} · ${fmtBytes(meta.size)}</div>`;
      renderTree();
      return;
    }
    $('#edToggle').style.display = '';
    const text = new TextDecoder().decode(u8);
    await Editor.open(edBody, { path, text, readOnly: true });
    setEditorMode(false);
    renderTree();
  } catch(e){ fail(e); edBody.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
function setEditorMode(editing){
  state.editor.editing = editing;
  Editor.setReadOnly(!editing);
  $('#edToggle').style.display = editing ? 'none' : '';
  $('#edSave').style.display = editing ? '' : 'none';
  $('#edMsg').style.display = editing ? '' : 'none';
  $('#edMode').textContent = editing ? t('fl_editing') : t('fl_view');
  $('#edMode').className = 'badge ' + (editing ? 'b-warn' : 'b-neutral');
  if (editing && !$('#edMsg').value) $('#edMsg').value = 'Update ' + (state.editor.path||'').split('/').pop();
}
async function saveEditor(){
  const path = state.editor.path;
  const val = Editor.getValue();
  $('#edSave').disabled = true; $('#edSave').innerHTML = icon('spinner','ic spin') + ' ' + t('fl_saving');
  try {
    let sha = state.editor.sha;
    let cur = null;
    try { cur = await gh(`/repos/${state.repo.full_name}/contents/${encPath(path)}?ref=${encodeURIComponent(state.branch)}`); } catch(e){}
    if (cur && sha && cur.sha !== sha){
      const ok = await confirmBox({ title: t('ed_conflict_t'), body: t('ed_conflict_s'), label: t('ed_overwrite'), danger: true });
      if (!ok){ openFileInEditor(path); return; }
      sha = cur.sha; // overwrite with latest remote sha
    } else if (cur) sha = cur.sha;
    const res = await gh(`/repos/${state.repo.full_name}/contents/${encPath(path)}`, { method:'PUT', body: JSON.stringify({
      message: $('#edMsg').value || 'Update ' + path,
      content: b64(new TextEncoder().encode(val)),
      ...(sha ? { sha } : {}), branch: state.branch })});
    state.editor.sha = res.content?.sha || state.editor.sha;
    state.editor.dirty = false;
    toast(t('fl_saved'));
    setEditorMode(false);
    refreshTree();
  } catch(e){ fail(e); }
  $('#edSave').disabled = false; $('#edSave').innerHTML = icon('check') + ' ' + t('fl_save');
}
function newFileModal(prefill=''){
  const m = openModal(`
    <div class="m-head"><h3>${icon('plus')} ${t('fl_new_file_title')}</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
    <div class="m-body">
      <label class="lbl">Path</label>
      <input class="field mono" id="nfPath" placeholder="src/index.js" value="${esc(prefill)}">
    </div>
    <div class="m-foot"><button class="btn" data-act="modal-close">${t('c_cancel')}</button><button class="btn btn-primary" id="nfGo">${icon('check')} ${t('c_create')}</button></div>`);
  m.querySelector('#nfGo').addEventListener('click', async () => {
    const p = m.querySelector('#nfPath').value.trim();
    if (!p) return toast(t('ts_path'), 'warn');
    closeModal();
    state.editor = { path: p, sha: null, dirty: false, editing: true, isText: true };
    $('#edPath').textContent = p;
    ['edRename','edDl','edDel'].forEach(id => $('#'+id).style.display = 'none');
    $('#edToggle').style.display = 'none';
    $('#edSave').style.display = ''; $('#edMsg').style.display = '';
    $('#edMsg').value = 'Add ' + p.split('/').pop();
    $('#edMode').textContent = t('fl_editing'); $('#edMode').className = 'badge b-warn';
    await Editor.open($('#edBody'), { path: p, text: '', readOnly: false });
  });
}
async function renameFileModal(oldPath){
  const m = openModal(`
    <div class="m-head"><h3>${icon('edit')} ${t('fl_rename_title')}</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
    <div class="m-body">
      <label class="lbl mono tiny">${esc(oldPath)}</label>
      <input class="field mono" id="rnPath" value="${esc(oldPath)}" placeholder="${t('fl_rename_ph')}">
      <label class="lbl" style="margin-top:12px">${t('fl_commit_msg')}</label>
      <input class="field" id="rnMsg" value="Rename ${esc(oldPath.split('/').pop())}">
    </div>
    <div class="m-foot"><button class="btn" data-act="modal-close">${t('c_cancel')}</button><button class="btn btn-primary" id="rnGo">${icon('check')} ${t('fl_rename')}</button></div>`);
  m.querySelector('#rnGo').addEventListener('click', async () => {
    const np = m.querySelector('#rnPath').value.trim();
    if (!np || np === oldPath) return;
    closeModal();
    try {
      await renameFileCommit(state.repo.full_name, state.branch, oldPath, np, m.querySelector('#rnMsg').value || 'Rename ' + oldPath);
      toast(t('fl_renamed'));
      if (state.editor.path === oldPath) state.editor.path = np;
      await refreshTree();
      if (state.editor.path === np) openFileInEditor(np);
    } catch(e){ fail(e); }
  });
}
async function deleteFileFlow(path){
  const ok = await confirmBox({ title: t('fl_delete_title'), body: `<b class="mono">${esc(path)}</b> ${t('fl_delete_s')} <b>${esc(state.branch)}</b>.`, danger: true });
  if (!ok) return;
  try {
    await deleteFileCommit(state.repo.full_name, state.branch, path, 'Delete ' + path);
    toast(t('fl_deleted'));
    if (state.editor.path === path){ state.editor.path = null; $('#edPath').textContent = '—'; }
    await refreshTree();
  } catch(e){ fail(e); }
}

/* ---------- upload tab ---------- */
function renderTabUpload(){
  const box = $('#repoTab');
  box.innerHTML = `
    <div class="up-grid">
      <div class="glass pad">
        <div class="sec-head"><h3>${t('up_src')}</h3></div>
        <div class="dropzone" id="dropzone">
          ${icon('zip')}
          <b style="font-size:14px">${t('up_drop_t')}</b>
          <p class="muted small" style="margin-top:5px">${t('up_drop_or')}</p>
          <div style="display:flex;gap:9px;justify-content:center;margin-top:10px;flex-wrap:wrap">
            <button class="btn btn-sm" data-act="choose-zip">${icon('zip')} ${t('up_pick_zip')}</button>
            <button class="btn btn-sm" data-act="choose-dir" id="dirBtn">${icon('folder')} ${t('up_pick_dir')}</button>
          </div>
        </div>
        <input type="file" id="zipInput" accept=".zip,application/zip" hidden>
        <label class="lbl" style="margin-top:14px">${t('up_ignores')}</label>
        <textarea class="field mono tiny" id="upIgn" style="min-height:74px">${DEFAULT_IGNORE.join('\n')}</textarea>
        <div id="srcInfo" style="margin-top:10px"></div>
        <div id="scanBox"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="glass pad">
          <div class="sec-head"><h3>${t('up_dst')}</h3></div>
          <div class="mode-cards" id="destModes">
            <label class="mode-card on" data-mode="existing"><input type="radio" name="dest" checked><span class="mrad"></span>
              <div><b>${t('up_dst_existing')}</b><span>${esc(state.repo.full_name)}</span></div></label>
            <label class="mode-card" data-mode="new"><input type="radio" name="dest"><span class="mrad"></span>
              <div><b>${t('up_dst_new')}</b><span>${t('up_dst_new_s')}</span></div></label>
          </div>
          <div id="newRepoBox" style="display:none;margin-top:12px">
            <label class="lbl">${t('up_new_name')}</label>
            <input class="field" id="upNewName" placeholder="my-awesome-project">
            <div style="display:flex;gap:9px;align-items:center;margin-top:10px">
              <label class="switch"><input type="checkbox" id="upNewPriv" checked><i></i></label><span class="small muted">${t('up_private')}</span>
            </div>
            <label class="lbl" style="margin-top:10px">${t('up_license')}</label>
            <select class="field" id="upNewLic"><option value="">${t('up_no_license')}</option></select>
          </div>
          <div id="pushModeBox" style="margin-top:12px">
            <div class="mode-cards" id="pushModes">
              <label class="mode-card on" data-pm="newbr"><input type="radio" name="pm" checked><span class="mrad"></span>
                <div><b>${t('up_branch_new')}</b><span>upload/YYYY-MM-DD → PR → ${esc(state.repo.default_branch)}</span></div></label>
              <label class="mode-card" data-pm="direct"><input type="radio" name="pm"><span class="mrad"></span>
                <div><b>${t('up_branch_direct')} ${esc(state.branch)}</b></div></label>
            </div>
            <label class="small muted" style="display:flex;gap:8px;align-items:center;margin-top:9px;cursor:pointer">
              <input type="checkbox" id="directAck" style="accent-color:var(--warn)"> ${t('up_direct_ack')}</label>
          </div>
        </div>
        <div class="glass pad">
          <div class="sec-head"><h3>${t('up_mode')}</h3></div>
          <div class="mode-cards" id="writeModes">
            <label class="mode-card on" data-wmode="merge"><input type="radio" name="wm" checked><span class="mrad"></span>
              <div><b>${t('up_merge_t')}</b><span>${t('up_merge_s')}</span></div></label>
            <label class="mode-card" data-wmode="replace"><input type="radio" name="wm"><span class="mrad"></span>
              <div><b>${t('up_replace_t')}</b><span>${t('up_replace_s')}</span></div></label>
          </div>
          <div id="prevBox" style="margin-top:12px"></div>
          <label class="lbl" style="margin-top:12px">${t('up_msg')}</label>
          <input class="field" id="upMsg" value="Deploy via ZipToGit Pro">
          <div style="display:flex;gap:9px;margin-top:12px">
            <button class="btn btn-primary" id="pushBtn" style="flex:1;justify-content:center" disabled>${icon('upload')} ${t('up_push')}</button>
            <button class="btn btn-danger" id="pushCancelBtn" style="display:none">${t('up_cancel')}</button>
          </div>
          <div id="pushProg"></div>
        </div>
      </div>
    </div>`;
  const dz = box.querySelector('#dropzone');
  const zi = box.querySelector('#zipInput');
  if (!window.showDirectoryPicker){ const db = box.querySelector('#dirBtn'); db.disabled = true; db.title = 'File System API N/A'; }
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) handleZip(f); });
  dz.addEventListener('click', e => { if (!e.target.closest('button')) zi.click(); });
  zi.addEventListener('change', () => zi.files[0] && handleZip(zi.files[0]));
  box.querySelectorAll('#destModes .mode-card').forEach(mc => mc.addEventListener('click', () => {
    box.querySelectorAll('#destModes .mode-card').forEach(x => x.classList.remove('on'));
    mc.classList.add('on');
    box.querySelector('#newRepoBox').style.display = mc.dataset.mode === 'new' ? 'block' : 'none';
    box.querySelector('#pushModeBox').style.display = mc.dataset.mode === 'new' ? 'none' : 'block';
    computePreview();
  }));
  box.querySelectorAll('#pushModes .mode-card').forEach(mc => mc.addEventListener('click', () => {
    box.querySelectorAll('#pushModes .mode-card').forEach(x => x.classList.remove('on'));
    mc.classList.add('on'); updatePushBtn();
  }));
  box.querySelectorAll('#writeModes .mode-card').forEach(mc => mc.addEventListener('click', () => {
    box.querySelectorAll('#writeModes .mode-card').forEach(x => x.classList.remove('on'));
    mc.classList.add('on'); renderPreviewUI(); updatePushBtn();
  }));
  const ign = box.querySelector('#upIgn');
  ign.addEventListener('change', () => { if (state.pending) setPending(state.pending.raw); });
  box.querySelector('#pushCancelBtn').addEventListener('click', () => { if (state.pushCtl) state.pushCtl.cancelled = true; });
  loadLicenses();
  renderPendingUI();
  updatePushBtn();
}
function updatePushBtn(){
  const b = $('#pushBtn'); if (!b) return;
  if (!state.pending){ b.disabled = true; return; }
  const wm = $('#writeModes .mode-card.on')?.dataset.wmode;
  const pm = $('#pushModes .mode-card.on')?.dataset.pm;
  const dest = $('#destModes .mode-card.on')?.dataset.mode;
  let ok = true;
  if (wm === 'replace') ok = !!state.pending.preview && !!$('#replaceAck')?.checked;
  if (dest === 'existing' && pm === 'direct') ok = ok && !!$('#directAck')?.checked;
  b.disabled = !ok;
}
async function loadLicenses(){
  const sel = $('#upNewLic'); if (!sel || sel.dataset.loaded) return;
  try {
    const l = await gh('/licenses');
    sel.innerHTML = `<option value="">${t('up_no_license')}</option>` + l.map(x => `<option value="${x.key}">${esc(x.name)}</option>`).join('');
    sel.dataset.loaded = '1';
  } catch(e){}
}
async function handleZip(file){
  toast('ZIP: ' + file.name);
  try { setPending(await readZip(await file.arrayBuffer())); } catch(e){ fail(e); }
}
async function handleDir(){
  try {
    const dir = await window.showDirectoryPicker();
    const files = await readFolder(dir);
    if (!files.length) return toast(t('ts_dir_empty'), 'warn');
    setPending(files);
  } catch(e){ if (e.name !== 'AbortError') fail(e); }
}
function setPending(rawFiles){
  const patterns = ($('#upIgn')?.value ?? DEFAULT_IGNORE.join('\n')).split('\n');
  const skipped = rawFiles.filter(f => isIgnored(f.path, patterns));
  const files = rawFiles.filter(f => !isIgnored(f.path, patterns) && f.size <= 100*1048576);
  const over100 = rawFiles.filter(f => !isIgnored(f.path, patterns) && f.size > 100*1048576);
  const root = zipCommonRoot(files);
  state.pending = {
    raw: rawFiles, files, root, strip: !!root, skipped: skipped.length,
    findings: scanFiles(files), risky: scanRisky(files),
    large: files.filter(f => f.size > 50*1048576), over100,
    preview: null
  };
  renderPendingUI();
  computePreview();
  updatePushBtn();
}
async function computePreview(){
  const p = state.pending; const box = $('#prevBox');
  if (!p || !box) return;
  const dest = $('#destModes .mode-card.on')?.dataset.mode;
  if (dest !== 'existing'){ p.preview = null; box.innerHTML = ''; return; }
  box.innerHTML = `<span class="dim small">${icon('spinner','ic spin')} ${t('up_prev_compute')}…</span>`;
  try {
    const { baseTree } = await headInfo(state.repo.full_name, state.branch);
    let cur = new Set();
    if (baseTree){
      const tr = await gh(`/repos/${state.repo.full_name}/git/trees/${baseTree}?recursive=1`);
      cur = new Set((tr.tree || []).filter(x => x.type === 'blob').map(x => x.path));
    }
    const stripRe = p.strip && p.root ? new RegExp('^' + p.root.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '/') : null;
    const news = new Set(p.files.map(f => stripRe ? f.path.replace(stripRe, '') : f.path));
    let add = 0, change = 0;
    news.forEach(x => cur.has(x) ? change++ : add++);
    let rem = 0; cur.forEach(x => { if (!news.has(x)) rem++; });
    p.preview = { add, change, rem };
  } catch(e){ p.preview = null; box.innerHTML = `<span class="dim small">${esc(redact(e.message))}</span>`; }
  renderPreviewUI();
  updatePushBtn();
}
function renderPreviewUI(){
  const p = state.pending; const box = $('#prevBox');
  if (!p || !box) return;
  if ($('#destModes .mode-card.on')?.dataset.mode !== 'existing') { box.innerHTML = ''; return; }
  if (!p.preview) return;
  const v = p.preview;
  const wm = $('#writeModes .mode-card.on')?.dataset.wmode;
  box.innerHTML = `
    <div class="sec-head"><h3>${t('up_preview')}</h3></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <span class="badge b-ok">+${v.add} ${t('up_prev_added')}</span>
      <span class="badge b-warn">~${v.change} ${t('up_prev_changed')}</span>
      ${wm === 'replace' ? `<span class="badge b-bad">−${v.rem} ${t('up_prev_removed')}</span>` : ''}
    </div>
    ${wm === 'replace' ? `<label class="small muted" style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;cursor:pointer">
      <input type="checkbox" id="replaceAck" style="accent-color:var(--bad);margin-top:2px"> ${t('up_replace_ack')}</label>` : ''}`;
  const ra = $('#replaceAck'); if (ra) ra.addEventListener('change', updatePushBtn);
}
function renderPendingUI(){
  const p = state.pending;
  const info = $('#srcInfo'), sb = $('#scanBox');
  if (!p || !info) return;
  const total = p.files.reduce((s,f) => s + f.size, 0);
  info.innerHTML = `
    <div class="glass-2" style="padding:11px 13px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="color:var(--ok)">${icon('check')}</span>
      <div style="flex:1" class="small"><b>${p.files.length} ${t('up_files')}</b> · ${fmtBytes(total)}${p.skipped ? ` · ignore: ${p.skipped}` : ''}</div>
      ${p.root ? `<label style="display:flex;align-items:center;gap:6px;cursor:pointer" class="small muted"><input type="checkbox" id="stripChk" ${p.strip?'checked':''} style="accent-color:var(--acc)"> ${t('up_strip')} «${esc(p.root)}/»</label>` : ''}
    </div>
    ${p.over100.length ? `<p class="hint" style="color:var(--bad)">${t('up_skip100')}: ${p.over100.map(f => esc(f.path)).join(', ')}</p>` : ''}
    ${p.large.length ? `<p class="hint" style="color:var(--warn)">${t('up_large')} ${p.large.map(f => `<span class="mono">${esc(f.path)}</span> (${fmtBytes(f.size)})`).join(', ')}</p>` : ''}`;
  if (!sb) return;
  const hasEnv = p.files.some(f => /^\.env(\..+)?$/i.test(f.path.split('/').pop()));
  sb.innerHTML = p.findings.length ? `
    <div class="sec-head" style="margin-top:12px"><h3 style="color:var(--warn)">${icon('warn')} ${t('up_scan')}: ${p.findings.length}</h3>
      ${hasEnv ? `<button class="btn btn-sm" data-act="gen-envex">${icon('file')} ${t('sc_envex')}</button>` : ''}</div>
    ${p.findings.map((f,i) => `
      <div class="scan-item">
        <span class="badge ${f.severity==='high'?'b-bad':'b-warn'}">${f.severity==='high'?'HIGH':'MED'}</span>
        <div class="mono tiny" style="flex:1;word-break:break-all">${esc(f.path)}
          <div class="dim" style="margin-top:2px">${f.matches.slice(0,3).map(m => `${esc(m.name)} · ${t('sc_line')} ${m.line}`).join(' · ')}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
          <label class="tiny muted" style="display:flex;align-items:center;gap:5px;cursor:${f.locked?'not-allowed':'pointer'}">
            <input type="checkbox" data-fndx="${i}" ${f.excluded?'checked':''} ${f.locked?'disabled':''} style="accent-color:var(--bad)"> ${t('sc_excl')}</label>
          <div style="display:flex;gap:5px">
            ${f._lines ? `<button class="btn btn-ghost btn-sm" data-fndm="${i}">${t('sc_mask')}</button>` : ''}
            ${f.locked ? `<button class="btn btn-danger btn-sm" data-fndack="${i}">${t('sc_never_ack')}</button>` :
              `<button class="btn btn-ghost btn-sm" data-fnda="${i}">${t('sc_send')}</button>
               <button class="btn btn-ghost btn-sm" data-fndr="${i}">${t('sc_allow_repo')}</button>`}
          </div>
        </div>
      </div>`).join('')}
    <p class="hint">${t('up_high_note')}</p>`
  : `<p class="hint" style="margin-top:10px">${icon('check')} ${t('up_scan_clean')}</p>`;
  sb.querySelectorAll('[data-fndx]').forEach(ch => ch.addEventListener('change', () => { p.findings[+ch.dataset.fndx].excluded = ch.checked; updatePushBtn(); }));
  sb.querySelectorAll('[data-fndm]').forEach(b => b.addEventListener('click', () => { maskFinding(p, p.findings[+b.dataset.fndm]); toast('✓ masked'); renderPendingUI(); }));
  sb.querySelectorAll('[data-fnda]').forEach(b => b.addEventListener('click', () => { p.findings[+b.dataset.fnda].excluded = false; renderPendingUI(); }));
  sb.querySelectorAll('[data-fndr]').forEach(b => b.addEventListener('click', () => { allowForRepo(p.findings[+b.dataset.fndr].path); p.findings[+b.dataset.fndr].excluded = false; renderPendingUI(); }));
  sb.querySelectorAll('[data-fndack]').forEach(b => b.addEventListener('click', async () => {
    const f = p.findings[+b.dataset.fndack];
    const ok = await confirmBox({ title: t('sc_never_t'), body: `<b class="mono">${esc(f.path)}</b><br>${t('sc_never_s')}`, label: t('sc_never_ack'), danger: true });
    if (ok){ f.locked = false; f.excluded = false; renderPendingUI(); }
  }));
  const sc = $('#stripChk'); if (sc) sc.addEventListener('change', () => { p.strip = sc.checked; computePreview(); });
}
async function doPush(){
  const box = $('#repoTab');
  const destMode = box.querySelector('#destModes .mode-card.on').dataset.mode;
  const writeMode = box.querySelector('#writeModes .mode-card.on').dataset.wmode;
  const pushMode = box.querySelector('#pushModes .mode-card.on').dataset.pm;
  const msg = redact(box.querySelector('#upMsg').value.trim()) || 'Deploy via ZipToGit Pro';
  const excluded = new Set(state.pending.findings.filter(f => f.excluded).map(f => f.path));
  let files = state.pending.files.filter(f => !excluded.has(f.path));
  if (state.pending.strip && state.pending.root){
    const root = state.pending.root + '/';
    files = files.map(f => ({ ...f, path: f.path.startsWith(root) ? f.path.slice(root.length) : f.path })).filter(f => f.path);
  }
  if (!files.length) return toast(t('ts_no_files'), 'warn');
  state.pushCtl = { cancelled: false };
  box.querySelector('#pushProg').innerHTML = `<div style="margin-top:14px"><div class="pbar"><i id="pbarI"></i></div><div class="plog" id="plog"></div><div id="postPush" style="margin-top:8px"></div></div>`;
  box.querySelector('#pushCancelBtn').style.display = '';
  const plog = box.querySelector('#plog');
  const log = m => { plog.textContent += m + '\n'; plog.scrollTop = 1e9; const n = m.match(/(\d+)\/(\d+)/); if (n) box.querySelector('#pbarI').style.width = (n[1]/n[2]*90) + '%'; };
  const btn = box.querySelector('#pushBtn'); btn.disabled = true;
  try {
    let full, branch;
    if (destMode === 'new'){
      const name = box.querySelector('#upNewName').value.trim();
      if (!name) throw new Error(t('ts_repo_name'));
      log(t('up_creating_repo'));
      const lic = box.querySelector('#upNewLic').value;
      const created = await gh('/user/repos', { method:'POST', body: JSON.stringify({ name, private: box.querySelector('#upNewPriv').checked, auto_init: false }) });
      full = created.full_name; branch = 'main';
      if (lic){ try { const lt = await gh('/licenses/' + lic); files = [...files, { path:'LICENSE', u8: new TextEncoder().encode(lt.body||''), size:(lt.body||'').length }]; } catch(e){} }
      await commitFiles({ full, branch, files, message: msg, mode:'init', onProgress: log });
    } else if (pushMode === 'newbr'){
      full = state.repo.full_name;
      const { headSha } = await headInfo(full, state.branch);
      branch = 'upload/' + new Date().toISOString().slice(0,10) + '-' + String(Date.now()).slice(-4);
      if (headSha) await gh(`/repos/${full}/git/refs`, { method:'POST', body: JSON.stringify({ ref:'refs/heads/' + branch, sha: headSha }) });
      await commitFiles({ full, branch, files, message: msg, mode: headSha ? 'merge' : 'init', onProgress: log });
      if (headSha){
        const pr = await gh(`/repos/${full}/pulls`, { method:'POST', body: JSON.stringify({ title: msg, head: branch, base: state.repo.default_branch, body: 'Created by ZipToGit Pro (upload wizard)' }) });
        log('PR #' + pr.number + ' → ' + pr.html_url);
        toast(t('up_pr_created') + ' #' + pr.number);
      }
    } else {
      full = state.repo.full_name; branch = state.branch;
      await commitFiles({ full, branch, files, message: msg, mode: writeMode, onProgress: log });
    }
    box.querySelector('#pbarI').style.width = '100%';
    log('✅ ' + t('up_done'));
    toast(t('up_done'));
    if (state.pending.findings.length){
      box.querySelector('#postPush').innerHTML = `<p class="hint">${t('sc_after')} <a href="https://github.com/${esc(full)}/settings/secret_scanning" target="_blank" rel="noopener">${t('sc_alerts')} →</a></p>`;
    }
    state.repos = await ghAll('/user/repos?sort=updated');
    btn.innerHTML = icon('check') + ' ✓';
    setTimeout(() => { btn.disabled = false; btn.innerHTML = icon('upload') + ' ' + t('up_push'); updatePushBtn(); }, 2200);
    if (state.tab === 'files') refreshTree();
  } catch(e){ fail(e); log('❌ ' + redact(e.message)); btn.disabled = false; updatePushBtn(); }
  state.pushCtl = null;
  box.querySelector('#pushCancelBtn').style.display = 'none';
}
