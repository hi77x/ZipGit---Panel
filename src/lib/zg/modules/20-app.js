/* == app shell == */
const NAV = [
  { group:'nav_general', items:[
    { id:'overview', label:'nav_dashboard', ic:'home' },
    { id:'repos', label:'nav_repos', ic:'repo' } ]},
  { group:'nav_account', items:[
    { id:'gists', label:'nav_gists', ic:'gist' },
    { id:'activity', label:'nav_activity', ic:'pulse' },
    { id:'settings', label:'nav_settings', ic:'gear' } ]}
];
function renderSidebar(){
  $('#sideNav').innerHTML = NAV.map(g => `
    <div class="nav-group lbl-txt">${t(g.group)}</div>
    <div class="nav">${g.items.map(n =>
      `<div class="nav-item${state.view===n.id?' on':''}" data-act="nav" data-view="${n.id}">${icon(n.ic)}<span class="lbl-txt">${t(n.label)}</span></div>`).join('')}</div>`).join('');
}
function langSwitcher(){
  return `<div class="lang-sw"><button data-act="lang" data-lang="en" class="${state.lang==='en'?'on':''}">EN</button><button data-act="lang" data-lang="ru" class="${state.lang==='ru'?'on':''}">RU</button></div>`;
}
function renderTopbar(){
  const tb = $('#topbar');
  if (state.view === 'repo' && state.repo){
    tb.innerHTML = `
      <button class="btn btn-ghost btn-sm" data-act="nav" data-view="repos">${icon('back')}</button>
      <span class="crumb"><b>${esc(state.repo.full_name)}</b></span>
      <div class="top-actions">
        <select class="field" id="branchSel" style="width:auto;padding:6px 30px 6px 10px;font-size:12.5px" title="Branch">
          ${state.branches.map(b => `<option${b.name===state.branch?' selected':''}>${esc(b.name)}</option>`).join('')}
        </select>
        <span class="badge b-neutral" id="rateChip" title="${t('tb_rate')}">API: ${state.rate ?? '—'}</span>
        <button class="btn btn-ghost btn-icon" data-act="global-search" title="${t('gs_title')}">${icon('search')}</button>
        ${langSwitcher()}
      </div>`;
    const sel = tb.querySelector('#branchSel');
    if (sel) sel.addEventListener('change', () => {
      state.branch = sel.value;
      state.tree = { cache: new Map(), expanded: new Set(), loading: new Set() };
      state.editor = { path: null, sha: null, dirty: false };
      state.commitSel = null;
      renderRepo();
    });
  } else {
    const cur = NAV.flatMap(g => g.items).find(n => n.id === state.view);
    tb.innerHTML = `<h2>${cur ? t(cur.label) : ''}</h2>
      <div class="top-actions">
        <span class="badge b-neutral" id="rateChip" title="${t('tb_rate')}">API: ${state.rate ?? '—'}</span>
        <button class="btn btn-ghost btn-icon" data-act="global-search" title="${t('gs_title')}">${icon('search')}</button>
        ${langSwitcher()}
        <button class="btn btn-primary btn-sm" data-act="new-repo-modal">${icon('plus')}<span class="hide-m"> ${t('tb_new_repo')}</span></button>
      </div>`;
  }
}
function go(view){
  state.view = view;
  if (view !== 'repo') state.repo = null;
  try { sessionStorage.setItem('z2g_ui', JSON.stringify({ view, repoFull: state.repo?.full_name || null, tab: state.tab })); } catch(e){}
  renderSidebar(); renderTopbar();
  const c = $('#content');
  c.classList.remove('fade-in'); void c.offsetWidth; c.classList.add('fade-in');
  ({overview:renderOverview, repos:renderRepos, gists:renderGists, activity:renderActivity, settings:renderAppSettings, repo:renderRepo})[view]();
}
async function downloadCurrentFile(){
  if (!state.editor.path) return;
  try {
    const u8 = await fetchRawU8(state.repo.full_name, state.branch, state.editor.path);
    const url = URL.createObjectURL(new Blob([u8]));
    const a = document.createElement('a');
    a.href = url; a.download = state.editor.path.split('/').pop(); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch(e){ fail(e); }
}

/* == global search == */
function openSearchModal(){
  const m = openModal(`
    <div class="m-head"><h3>${icon('search')} ${t('gs_title')}</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
    <div class="m-body">
      <input class="field" id="gsIn" placeholder="${t('gs_ph')}">
      <div id="gsRes" style="margin-top:12px"><p class="hint">${t('gs_empty')}</p></div>
    </div>`, true);
  const inp = m.querySelector('#gsIn'); let to;
  inp.focus();
  inp.addEventListener('input', () => { clearTimeout(to); to = setTimeout(run, 450); });
  async function run(){
    const q = inp.value.trim();
    const res = m.querySelector('#gsRes');
    if (q.length < 2){ res.innerHTML = `<p class="hint">${t('gs_empty')}</p>`; return; }
    res.innerHTML = `<div style="text-align:center;padding:16px">${icon('spinner','ic spin')}</div>`;
    try {
      const [repos, users] = await Promise.all([
        gh(`/search/repositories?q=${encodeURIComponent(q)}&per_page=6`),
        gh(`/search/users?q=${encodeURIComponent(q)}&per_page=4`)
      ]);
      res.innerHTML = `
        <label class="lbl">${t('gs_repos')}</label>
        ${repos.items.map(r => `<div class="lrow" style="cursor:pointer;border-radius:10px" data-act="gs-open" data-full="${esc(r.full_name)}">
          <span style="color:var(--acc)">${icon(r.private?'lock':'repo')}</span>
          <div class="lt"><b>${esc(r.full_name)}</b><span>${esc((r.description||'').slice(0,90))} · ★ ${r.stargazers_count}</span></div>
        </div>`).join('') || '<p class="hint">—</p>'}
        <label class="lbl" style="margin-top:12px">${t('gs_users')}</label>
        ${users.items.map(u => `<a class="lrow" style="border-radius:10px" href="${esc(u.html_url)}" target="_blank" rel="noopener">
          <img src="${esc(u.avatar_url)}" style="width:26px;height:26px;border-radius:50%;flex:none">
          <div class="lt"><b>${esc(u.login)}</b></div>${icon('ext')}
        </a>`).join('') || '<p class="hint">—</p>'}`;
    } catch(e){ res.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
}

/* == delegation == */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const A = fn => { e.preventDefault(); e.stopPropagation(); Promise.resolve(fn()).catch(fail); };
  switch(act){
    case 'nav': go(el.dataset.view); break;
    case 'logout': case 'replace-token': logout(); break;
    case 'lang': setLang(el.dataset.lang); break;
    case 'eye-token': { const i=$('#tokenInput'); i.type = i.type==='password'?'text':'password'; break; }
    case 'overlay-click': if (e.target === el) closeModal(); break;
    case 'modal-close': closeModal(); break;
    case 'open-repo': A(() => openRepo(el.dataset.full)); break;
    case 'repo-settings': A(async () => { await openRepo(el.dataset.full); state.tab='rsettings'; renderRepo(); }); break;
    case 'del-repo-quick': A(() => delRepoFlow(el.dataset.full)); break;
    case 'tab': state.tab = el.dataset.tab; renderRepo(); break;
    /* tree */
    case 'tree-dir': A(async () => {
      const p = el.dataset.path;
      if (state.tree.expanded.has(p)) state.tree.expanded.delete(p);
      else { state.tree.expanded.add(p); if (!state.tree.cache.has(p)) await loadTreeDir(p); }
      renderTree();
    }); break;
    case 'tree-file': A(() => openFileInEditor(el.dataset.path)); break;
    case 'tree-rename': A(() => renameFileModal(el.dataset.path)); break;
    case 'tree-delete': A(() => deleteFileFlow(el.dataset.path)); break;
    case 'tree-newfile': newFileModal(el.dataset.path + '/'); break;
    case 'tree-refresh': A(refreshTree); break;
    case 'new-file-modal': newFileModal(); break;
    /* editor */
    case 'ed-toggle': setEditorMode(true); break;
    case 'ed-save': saveEditor(); break;
    case 'ed-rename': if (state.editor.path) renameFileModal(state.editor.path); break;
    case 'ed-dl': downloadCurrentFile(); break;
    case 'ed-del': if (state.editor.path) deleteFileFlow(state.editor.path); break;
    /* upload */
    case 'choose-zip': $('#zipInput') && $('#zipInput').click(); break;
    case 'choose-dir': handleDir(); break;
    /* repos */
    case 'new-repo-modal': newRepoModal(); break;
    case 'refresh-repos': A(async () => { state.repos = await ghAll('/user/repos?sort=updated'); renderRepos(); toast(t('ts_refreshed')); }); break;
    case 'copy-raw': if (navigator.clipboard) navigator.clipboard.writeText(el.dataset.text).catch(()=>{}); toast(t('ts_copied') + ': ' + el.dataset.text.slice(0,10)); break;
    /* branches */
    case 'new-branch': newBranch(); break;
    case 'del-branch': delBranch(el.dataset.name); break;
    case 'set-default': setDefaultBranch(el.dataset.name); break;
    case 'merge-branch': mergeBranch(el.dataset.name); break;
    /* PRs */
    case 'new-pr-modal': newPRModal(); break;
    case 'merge-pr': mergePR(el.dataset.n); break;
    case 'close-pr': setPRState(el.dataset.n, 'closed'); break;
    case 'reopen-pr': setPRState(el.dataset.n, 'open'); break;
    case 'pr-changes': prChanges(el.dataset.n); break;
    /* commits */
    case 'commit-open': commitOpen(el.dataset.sha); break;
    /* actions */
    case 'wf-dispatch': wfDispatch(el.dataset.id); break;
    /* pages */
    case 'pages-enable': pagesEnable(); break;
    case 'pages-disable': pagesDisable(); break;
    case 'pages-rebuild': pagesRebuild(); break;
    /* repo settings */
    case 'save-repo-settings': saveRepoSettings(); break;
    case 'del-repo-modal': delRepoFlow(state.repo.full_name); break;
    /* gists */
    case 'new-gist-modal': newGistModal(); break;
    case 'del-gist': delGist(el.dataset.id); break;
    /* quick */
    case 'qa-local': if (!window.showDirectoryPicker) toast(t('ts_fs_unsupported'),'warn'); else { go('repos'); toast(t('ts_pick_repo')); } break;
    case 'qa-pages': go('repos'); toast(t('ts_pick_repo_pages')); break;
    /* repo head */
    case 'star-toggle': toggleStar(); break;
    case 'watch-toggle': toggleWatch(); break;
    case 'fork-repo': forkRepo(); break;
    case 'copy-clone': copyClone(); break;
    /* issues / releases */
    case 'new-issue-modal': newIssueModal(); break;
    case 'toggle-issue': toggleIssue(el.dataset.n, el.dataset.state); break;
    case 'new-release-modal': newReleaseModal(); break;
    case 'del-release': delRelease(el.dataset.id); break;
    /* settings extras */
    case 'vis-apply': applyVisibility(); break;
    case 'collab-add': addCollab(); break;
    case 'collab-remove': removeCollab(el.dataset.user); break;
    /* global search */
    case 'global-search': openSearchModal(); break;
    case 'gs-open': closeModal(); openRepo(el.dataset.full); break;
    /* security / scanner */
    case 'gen-envex': {
      const p = state.pending;
      const env = p.files.find(f => /^\.env(\..+)?$/i.test(f.path.split('/').pop()));
      if (env && !p.files.some(f => f.path === '.env.example')){
        const content = envExampleFrom(env);
        p.files.push({ path:'.env.example', u8:new TextEncoder().encode(content), size:content.length });
        p.raw.push({ path:'.env.example', u8:new TextEncoder().encode(content), size:content.length });
        toast(t('sc_envex_done')); renderPendingUI();
      }
      break;
    }
    case 'show-token': {
      const el2 = $('#tokMask');
      if (!el2 || el2.dataset.on) break;
      el2.dataset.on = '1'; el2.textContent = state.token;
      setTimeout(() => { el2.textContent = el2.dataset.mask; delete el2.dataset.on; }, 5000);
      break;
    }
    /* review */
    case 'rv-line': { const [p, l] = el.dataset.rv.split(':'); rvLineClick(p, l); break; }
    case 'rv-submit': rvSubmit(); break;
  }
});
document.addEventListener('click', e => {
  const p = e.target.closest('#pushBtn');
  if (p && !p.disabled) doPush();
});

/* == rate chip == */
function updateRateChip(){
  const el = $('#rateChip');
  if (el) el.textContent = 'API: ' + (state.rate ?? '—');
}

/* == command palette (Cmd/Ctrl+K) == */
async function ensureFileIndex(){
  if (!state.repo) return [];
  if (state.fileIndex) return state.fileIndex;
  try {
    const { baseTree } = await headInfo(state.repo.full_name, state.branch);
    if (!baseTree) return [];
    const tr = await gh(`/repos/${state.repo.full_name}/git/trees/${baseTree}?recursive=1`);
    state.fileIndex = (tr.tree || []).filter(x => x.type === 'blob').map(x => x.path);
    return state.fileIndex;
  } catch(e){ return []; }
}
function openPalette(){
  const m = openModal(`
    <div class="m-head"><h3>${icon('search')} Cmd+K</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
    <div class="m-body">
      <input class="field" id="pkIn" placeholder="${t('pk_ph')}">
      <div id="pkRes" style="margin-top:10px;max-height:46vh;overflow:auto"></div>
    </div>`, true);
  const inp = m.querySelector('#pkIn'); inp.focus();
  const run = async () => {
    const q = inp.value.trim().toLowerCase();
    const res = m.querySelector('#pkRes');
    const acts = [
      { l: t('nav_dashboard'), run: () => go('overview') },
      { l: t('nav_repos'), run: () => go('repos') },
      { l: t('nav_gists'), run: () => go('gists') },
      { l: t('nav_activity'), run: () => go('activity') },
      { l: t('nav_settings'), run: () => go('settings') },
      { l: 'EN / RU', run: () => setLang(state.lang === 'en' ? 'ru' : 'en') },
      { l: t('tb_new_repo'), run: () => newRepoModal() },
      ...TABS.map(x => ({ l: state.repo ? state.repo.name + ' → ' + t(x.label) : t(x.label), run: () => { if (state.repo){ state.tab = x.id; renderRepo(); } } }))
    ].filter(a => !q || a.l.toLowerCase().includes(q));
    const repos = state.repos.filter(r => q && r.full_name.toLowerCase().includes(q)).slice(0, 6)
      .map(r => ({ l: icon('repo') + ' ' + r.full_name, run: () => openRepo(r.full_name), html: true }));
    let files = [];
    if (q && q.length > 1 && state.repo){
      const idx = await ensureFileIndex();
      files = idx.filter(p => p.toLowerCase().includes(q)).slice(0, 8)
        .map(p => ({ l: icon('file') + ' ' + p, run: () => { state.tab = 'files'; renderRepo(); setTimeout(() => openFileInEditor(p), 60); }, html: true }));
    }
    const all = [...repos, ...files, ...acts.map(a => ({ l: a.l, run: a.run, html: a.html }))].slice(0, 18);
    res.innerHTML = all.map((a, i) => `<div class="lrow" style="cursor:pointer;border-radius:10px" data-pk="${i}">${a.html ? a.l : esc(a.l)}</div>`).join('') || '<p class="hint">—</p>';
    res.querySelectorAll('[data-pk]').forEach(el => el.addEventListener('click', () => { closeModal(); all[+el.dataset.pk].run(); }));
  };
  inp.addEventListener('input', run); run();
}

/* == drag&drop zip onto repo card == */
document.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
document.addEventListener('drop', async e => {
  const card = e.target.closest('.repo-card');
  if (!card || !e.dataTransfer?.files?.length) return;
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (!/\.zip$/i.test(f.name) && f.type !== 'application/zip') return toast('ZIP only', 'warn');
  try {
    const files = await readZip(await f.arrayBuffer());
    await openRepo(card.dataset.full);
    state.tab = 'upload'; renderRepo();
    setPending(files);
    toast(f.name + ' → ' + card.dataset.full);
  } catch(err){ fail(err); }
});

/* == keyboard == */
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); closeModal(); openPalette(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && state.editor.editing && state.editor.path){ e.preventDefault(); saveEditor(); }
});

/* == boot == */
async function bootNow(){
  if (bootNow.done) return; bootNow.done = true;
  store.del('z2g_token'); // raw PAT never persisted (migration from old versions)
  initAuthBindings();
  applyI18nStatic();
  await probeProxy();
  const host = location.hostname;
  if (location.protocol !== 'file:' && host !== 'localhost' && host !== '127.0.0.1'){
    const w = $('#notLocalWarn'); if (w){ w.textContent = t('au_notlocal'); w.style.display = 'block'; }
  }
  if (store.get('z2g_enc')){ const u = $('#unlockBox'); if (u) u.style.display = 'block'; }
}
if (typeof window !== 'undefined') window.ZGBoot = bootNow;
if (typeof document !== 'undefined'){
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootNow);
  else if (document.getElementById('authScreen')) bootNow();
}
