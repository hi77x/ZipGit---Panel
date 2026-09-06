/* == views: main == */
/* ---- Web Crypto at-rest encryption (key = user password, never stored) ---- */
async function deriveKey(pw, salt){
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations: 120000, hash:'SHA-256' }, km, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
async function saveEncrypted(token, pw){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pw, salt);
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, new TextEncoder().encode(token));
  store.set('z2g_enc', JSON.stringify({ s:b64(salt), i:b64(iv), c:b64(new Uint8Array(ct)) }));
  state.remembered = true;
}
async function loadEncrypted(pw){
  let d; try { d = JSON.parse(store.get('z2g_enc') || 'null'); } catch(e){ return null; }
  if (!d) return null;
  try {
    const key = await deriveKey(pw, fromB64(d.s));
    const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv: fromB64(d.i) }, key, fromB64(d.c));
    return new TextDecoder().decode(pt);
  } catch(e){ return null; }
}
function askPassword(unlock=false){
  return new Promise(resolve => {
    const m = openModal(`
      <div class="m-head"><h3>${icon('lock')} ${t('au_pass_t')}</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
      <div class="m-body">
        ${unlock ? `<input class="field" id="pwA" type="password" placeholder="${t('au_unlock_ph')}">` : `
        <input class="field" id="pwA" type="password" placeholder="${t('au_pass_ph')}">
        <input class="field" id="pwB" type="password" placeholder="${t('au_pass2_ph')}" style="margin-top:10px">`}
        <div class="err" id="pwErr" style="display:none"></div>
      </div>
      <div class="m-foot"><button class="btn" data-act="modal-close">${t('c_cancel')}</button><button class="btn btn-primary" id="pwGo">${icon('check')} OK</button></div>`);
    m.querySelector('#pwGo').addEventListener('click', () => {
      const a = m.querySelector('#pwA').value;
      const bEl = m.querySelector('#pwB');
      if (!unlock && (a.length < 6 || a !== bEl.value)){ const e = m.querySelector('#pwErr'); e.textContent = t('au_pass_err'); e.style.display='block'; return; }
      closeModal(); resolve(a);
    });
    m.parentElement.addEventListener('click', ev => { if (ev.target === m.parentElement || ev.target.closest('[data-act="modal-close"]')){ closeModal(); resolve(null); } });
  });
}
function initAuthBindings(){
  const ti = $('#tokenInput'), cb = $('#connectBtn');
  if (ti) ti.addEventListener('keydown', e => { if (e.key === 'Enter') connect(); });
  if (cb) cb.addEventListener('click', connect);
  const ub = $('#unlockBtn');
  if (ub) ub.addEventListener('click', async () => {
    const pw = $('#unlockPass').value;
    const token = await loadEncrypted(pw);
    if (!token){ const e = $('#unlockErr'); e.textContent = t('au_unlock_err'); e.style.display='block'; return; }
    state.token = token; state.remembered = true;
    try { state.user = await gh('/user'); enterApp(); } catch(err){ state.token=''; fail(err); }
  });
  // scope scenarios
  const SCN = { full:'repo,workflow,user,gist', up:'repo,workflow', read:'' };
  const applyScn = () => {
    const scn = $('#scnModes .mode-card.on')?.dataset.scn || 'full';
    $('#scopeChips').innerHTML = (SCN[scn] ? SCN[scn].split(',') : ['—']).map(s => `<span class="badge b-acc">${s}</span>`).join('');
    $('#tokenLink').href = 'https://github.com/settings/tokens/new?scopes=' + SCN[scn] + '&description=ZipToGit%20Pro';
    $('#tokenLink').style.display = scn === 'read' ? 'none' : '';
  };
  $$('#scnModes .mode-card').forEach(mc => mc.addEventListener('click', () => {
    $$('#scnModes .mode-card').forEach(x => x.classList.remove('on'));
    mc.classList.add('on'); applyScn();
  }));
  applyScn();
  $('#delRepoNote').textContent = t('au_del_note');
}
async function connect(){
  const token = redact($('#tokenInput').value.trim());
  const raw = $('#tokenInput').value.trim();
  const err = $('#authErr'); err.style.display = 'none';
  if (!raw){ err.textContent = '•••'; err.style.display='block'; return; }
  $('#connectBtn').disabled = true;
  try {
    await probeProxy();
    state.token = raw;
    const user = await gh('/user');
    const type = raw.startsWith('github_pat_') ? t('au_fine') : t('au_classic');
    toast(`${user.login} · ${t('au_type')}: ${type} · ${t('au_scopes_found')}: ${state.scopes || '(fine-grained)'}`);
    if ($('#rememberChk').checked){
      if (crypto?.subtle){
        const pw = await askPassword();
        if (pw) await saveEncrypted(raw, pw);
      } else toast('Web Crypto unavailable — token stays in memory only', 'warn');
    }
    state.user = user;
    enterApp(true);
  } catch(e){
    state.token = '';
    err.textContent = redact(e.message);
    err.style.display = 'block';
  }
  $('#tokenInput').value = '';
  $('#connectBtn').disabled = false;
}
function welcomeWizard(){
  if (store.get('z2g_seen')) return;
  store.set('z2g_seen', '1');
  openModal(`
    <div class="m-head"><h3>${icon('home')} ${t('wl_title')}</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
    <div class="m-body">
      <p class="muted small" style="margin-bottom:12px">${t('wl_s')}</p>
      <div style="display:grid;gap:9px">
        <div class="qa" data-act="nav" data-view="repos"><div class="sic" style="background:rgba(125,140,255,.13);color:#a3adff">${icon('zip')}</div><div><b>${t('ov_qa_zip_t')}</b><span>${t('ov_qa_zip_s')}</span></div></div>
        <div class="qa" data-act="qa-local"><div class="sic" style="background:rgba(76,195,138,.12);color:#4cc38a">${icon('folder')}</div><div><b>${t('ov_qa_dir_t')}</b><span>${t('ov_qa_dir_s')}</span></div></div>
        <div class="qa" data-act="nav" data-view="overview"><div class="sic" style="background:rgba(78,168,222,.12);color:#4ea8de">${icon('home')}</div><div><b>${t('nav_dashboard')}</b><span>heatmap + stats</span></div></div>
      </div>
      <p class="hint" style="margin-top:12px">${t('gh_note')}</p>
    </div>`);
}
function startIdleLogout(){
  const reset = () => {
    clearTimeout(state.idleTimer);
    if (state.remembered) return; // stored (encrypted) token survives idle
    state.idleTimer = setTimeout(() => { toast('Idle logout', 'warn'); location.reload(); }, 30*60*1000);
  };
  ['click','keydown','mousemove'].forEach(ev => document.addEventListener(ev, reset, { passive:true }));
  reset();
}
async function enterApp(first){
  $('#authScreen').style.display = 'none';
  $('#appShell').classList.add('on');
  renderSidebar();
  startIdleLogout();
  try {
    if (!state.user) state.user = await gh('/user');
    $('#userChip').innerHTML = `<img src="${esc(state.user.avatar_url)}" alt=""><div><b>${esc(state.user.login)}</b><span>${esc(state.user.name || state.user.login)}</span></div>`;
    const [repos, events] = await Promise.all([
      ghAll('/user/repos?sort=updated'),
      gh(`/users/${state.user.login}/events/public?per_page=100`).catch(() => [])
    ]);
    state.repos = repos; state.events = events;
    if (first) welcomeWizard();
    // restore UI state (never the token) from sessionStorage
    let ui = null; try { ui = JSON.parse(sessionStorage.getItem('z2g_ui') || 'null'); } catch(e){}
    if (ui && ui.view === 'repo' && ui.repoFull && repos.some(r => r.full_name === ui.repoFull)){
      await openRepo(ui.repoFull);
      if (ui.tab){ state.tab = ui.tab; renderRepo(); }
    } else go(ui && NAV_FLAT.includes(ui.view) ? ui.view : 'overview');
  } catch(e){ fail(e); }
}
const NAV_FLAT = ['overview','repos','gists','activity','settings','repo'];
function logout(){ store.del('z2g_token'); location.reload(); }

/* ---- overview ---- */
function renderOverview(){
  const u = state.user, repos = state.repos;
  const priv = repos.filter(r => r.private).length;
  const stars = repos.reduce((s,r) => s + (r.stargazers_count||0), 0);
  const forks = repos.reduce((s,r) => s + (r.forks_count||0), 0);
  const sizeMb = Math.round(repos.reduce((s,r) => s + (r.size||0), 0) / 1024);
  const recent = repos.slice(0, 6);
  const byDay = eventsByDay(state.events, 84);
  const weekly = []; for (let i=0;i<byDay.length;i+=7) weekly.push(byDay.slice(i,i+7).reduce((s,d)=>s+d.count,0));
  $('#content').innerHTML = `
    <div class="hero glass">
      <img src="${esc(u.avatar_url)}" alt="">
      <div style="flex:1;min-width:200px">
        <h1>${t('ov_hello')}, ${esc(u.login)} 👋</h1>
        <p class="muted small" style="margin-top:3px">${esc(u.bio || t('ov_sub'))}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" data-act="nav" data-view="repos">${icon('upload')} ${t('ov_upload')}</button>
        <button class="btn" data-act="new-repo-modal">${icon('plus')} ${t('ov_new_repo')}</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat glass"><div class="sic" style="background:rgba(125,140,255,.13);color:#a3adff">${icon('repo')}</div><div><b>${repos.length}</b><span>${t('ov_repos')}</span></div></div>
      <div class="stat glass"><div class="sic" style="background:rgba(226,176,74,.12);color:#e2b04a">${icon('lock')}</div><div><b>${priv}</b><span>${t('ov_private')}</span></div></div>
      <div class="stat glass"><div class="sic" style="background:rgba(76,195,138,.12);color:#4cc38a">${icon('star')}</div><div><b>${stars}</b><span>${t('ov_stars')}</span></div></div>
      <div class="stat glass"><div class="sic" style="background:rgba(78,168,222,.12);color:#4ea8de">${icon('fork')}</div><div><b>${forks}</b><span>${t('ov_forks')}</span></div></div>
    </div>
    <div class="grid-2">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="glass pad">
          <div class="sec-head"><h3>${t('ov_contrib')} <span class="badge b-neutral">${t('ov_last90')}</span></h3>
            <span class="tiny dim">${weekly.reduce((a,b)=>a+b,0)} events</span></div>
          ${heatmapHTML(91)}
        </div>
        <div class="glass pad">
          <div class="sec-head"><h3>${t('ov_recent')}</h3><button class="btn btn-ghost btn-sm" data-act="nav" data-view="repos">${t('ov_all')} →</button></div>
          <div style="margin:-6px -6px 0">
          ${recent.map(r => `
            <div class="lrow" style="border-radius:10px;cursor:pointer" data-act="open-repo" data-full="${esc(r.full_name)}">
              <span style="color:var(--acc)">${icon(r.private?'lock':'repo')}</span>
              <div class="lt"><b>${esc(r.name)}</b><span>${t('rp_updated')} ${relTime(r.pushed_at||r.updated_at)}</span></div>
              ${r.private ? `<span class="badge b-private">${t('c_private')}</span>` : `<span class="badge b-public">${t('c_public')}</span>`}
            </div>`).join('') || `<div class="empty">—</div>`}
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="glass pad">
          <div class="sec-head"><h3>${t('ov_activity')}</h3></div>
          ${sparkHTML(weekly.length>1?weekly:[0,0])}
          <div class="hint" style="margin-top:6px">${(state.events||[]).length ? relTime(state.events[0].created_at) : '—'}</div>
        </div>
        <div class="glass pad">
          <div class="sec-head"><h3>${t('ov_quick')}</h3></div>
          <div class="qa-grid" style="display:grid;gap:9px">
            <div class="qa" data-act="nav" data-view="repos"><div class="sic" style="background:rgba(125,140,255,.13);color:#a3adff">${icon('zip')}</div><div><b>${t('ov_qa_zip_t')}</b><span>${t('ov_qa_zip_s')}</span></div></div>
            <div class="qa" data-act="qa-local"><div class="sic" style="background:rgba(76,195,138,.12);color:#4cc38a">${icon('folder')}</div><div><b>${t('ov_qa_dir_t')}</b><span>${t('ov_qa_dir_s')}</span></div></div>
            <div class="qa" data-act="nav" data-view="gists"><div class="sic" style="background:rgba(226,176,74,.12);color:#e2b04a">${icon('gist')}</div><div><b>${t('ov_qa_gist_t')}</b><span>${t('ov_qa_gist_s')}</span></div></div>
            <div class="qa" data-act="qa-pages"><div class="sic" style="background:rgba(78,168,222,.12);color:#4ea8de">${icon('globe')}</div><div><b>${t('ov_qa_pages_t')}</b><span>${t('ov_qa_pages_s')}</span></div></div>
          </div>
        </div>
      </div>
    </div>`;
}

/* ---- repos ---- */
function renderRepos(){
  const q = state.repoQuery.toLowerCase();
  let list = state.repos.filter(r => !q || r.full_name.toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q));
  if (state.repoSort === 'stars') list = [...list].sort((a,b) => b.stargazers_count - a.stargazers_count);
  if (state.repoSort === 'name') list = [...list].sort((a,b) => a.name.localeCompare(b.name));
  if (state.repoSort === 'size') list = [...list].sort((a,b) => b.size - a.size);
  $('#content').innerHTML = `
    <div class="toolbar">
      <div style="position:relative;flex:1;max-width:340px">
        <span style="position:absolute;left:11px;top:8px;color:var(--dim)">${icon('search')}</span>
        <input class="field" id="repoSearch" placeholder="${t('rp_search')}" value="${esc(state.repoQuery)}" style="padding-left:34px">
      </div>
      <select class="field" id="repoSort" style="width:auto">
        <option value="updated"${state.repoSort==='updated'?' selected':''}>${t('rp_sort_updated')}</option>
        <option value="stars"${state.repoSort==='stars'?' selected':''}>${t('rp_sort_stars')}</option>
        <option value="size"${state.repoSort==='size'?' selected':''}>${t('rp_sort_size')}</option>
        <option value="name"${state.repoSort==='name'?' selected':''}>${t('rp_sort_name')}</option>
      </select>
      <div class="spacer"></div>
      <button class="btn" data-act="refresh-repos">${icon('refresh')}<span class="hide-m"> ${t('rp_refresh')}</span></button>
    </div>
    <div class="repo-grid">
      ${list.map(r => `
      <div class="repo-card glass" data-act="open-repo" data-full="${esc(r.full_name)}">
        <div class="rc-acts">
          <button class="btn btn-ghost btn-icon" title="${t('tab_settings')}" data-act="repo-settings" data-full="${esc(r.full_name)}">${icon('gear')}</button>
          <button class="btn btn-ghost btn-icon" title="${t('rs_delete')}" data-act="del-repo-quick" data-full="${esc(r.full_name)}">${icon('trash')}</button>
        </div>
        <div class="rc-top">${icon('repo')}<b>${esc(r.name)}</b>${r.private ? `<span class="badge b-private">${t('c_private')}</span>` : `<span class="badge b-public">${t('c_public')}</span>`}</div>
        <p>${esc(r.description || '—')}</p>
        <div class="rc-meta">
          ${r.language ? `<span><i class="dot" style="background:${LANG_COLORS[r.language]||'#888'}"></i>${esc(r.language)}</span>` : ''}
          <span>${icon('star')}${r.stargazers_count}</span>
          <span>${icon('fork')}${r.forks_count}</span>
          <span>${fmtBytes((r.size||0)*1024)}</span>
          <span style="margin-left:auto">${relTime(r.pushed_at||r.updated_at)}</span>
        </div>
      </div>`).join('') || `<div class="empty" style="grid-column:1/-1">${icon('search')}<br>${t('rp_empty')}</div>`}
    </div>`;
  $('#repoSearch').addEventListener('input', e => { state.repoQuery = e.target.value; renderRepos(); const el=$('#repoSearch'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
  $('#repoSort').addEventListener('change', e => { state.repoSort = e.target.value; renderRepos(); });
}

/* ---- new repo modal ---- */
function newRepoModal(){
  const m = openModal(`
    <div class="m-head"><h3>${icon('plus')} ${t('tb_new_repo')}</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
    <div class="m-body">
      <label class="lbl">Name *</label><input class="field" id="nrName" placeholder="my-project">
      <label class="lbl" style="margin-top:12px">${t('rs_desc')}</label><input class="field" id="nrDesc">
      <div style="display:flex;gap:10px;align-items:center;margin-top:12px">
        <label class="switch"><input type="checkbox" id="nrPriv" checked><i></i></label><span class="small muted">${t('up_private')}</span>
      </div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:9px">
        <label class="switch"><input type="checkbox" id="nrInit"><i></i></label><span class="small muted">README (init)</span>
      </div>
      <label class="lbl" style="margin-top:12px">${t('up_license')}</label>
      <select class="field" id="nrLic"><option value="">${t('up_no_license')}</option></select>
    </div>
    <div class="m-foot"><button class="btn" data-act="modal-close">${t('c_cancel')}</button><button class="btn btn-primary" id="nrSave">${icon('check')} ${t('c_create')}</button></div>`);
  const sel = m.querySelector('#nrLic');
  gh('/licenses').then(l => sel.innerHTML = `<option value="">${t('up_no_license')}</option>` + l.map(x => `<option value="${x.key}">${esc(x.name)}</option>`).join('')).catch(()=>{});
  m.querySelector('#nrSave').addEventListener('click', async () => {
    const name = m.querySelector('#nrName').value.trim();
    if (!name) return toast(t('ts_repo_name'), 'warn');
    try {
      const r = await gh('/user/repos', { method:'POST', body: JSON.stringify({
        name, description: m.querySelector('#nrDesc').value || undefined,
        private: m.querySelector('#nrPriv').checked, auto_init: m.querySelector('#nrInit').checked,
        license_template: m.querySelector('#nrLic').value || undefined })});
      closeModal(); toast(t('ts_repo_created') + ': ' + r.full_name);
      state.repos = await ghAll('/user/repos?sort=updated');
      openRepo(r.full_name);
    } catch(e){ fail(e); }
  });
}

/* ---- gists ---- */
async function renderGists(){
  const c = $('#content');
  c.innerHTML = `
    <div class="toolbar"><div class="spacer"></div>
      <button class="btn btn-primary btn-sm" data-act="new-gist-modal">${icon('plus')} ${t('gi_new')}</button>
    </div>
    <div class="glass" style="padding:30px;text-align:center">${icon('spinner','ic spin')}</div>`;
  try {
    const gists = await ghAll('/gists');
    c.querySelector('.glass').outerHTML = `<div class="glass">${gists.map(g => {
      const fn = Object.keys(g.files)[0];
      return `<div class="lrow">
        <span style="color:var(--warn)">${icon('gist')}</span>
        <div class="lt"><b class="mono">${esc(g.description || fn)}</b><span>${esc(fn)}${Object.keys(g.files).length>1?` +${Object.keys(g.files).length-1}`:''} · ${relTime(g.updated_at)}</span></div>
        ${g.public ? `<span class="badge b-public">${t('c_public')}</span>` : `<span class="badge b-private">${t('gi_secret')}</span>`}
        <a class="btn btn-ghost btn-icon" href="${esc(g.html_url)}" target="_blank" rel="noopener">${icon('ext')}</a>
        <button class="btn btn-ghost btn-icon" data-act="del-gist" data-id="${g.id}">${icon('trash')}</button>
      </div>`; }).join('') || `<div class="empty">${t('gi_empty')}</div>`}</div>`;
  } catch(e){ c.querySelector('.glass').outerHTML = `<div class="glass empty">${esc(e.message)}</div>`; }
}
function newGistModal(){
  const m = openModal(`
    <div class="m-head"><h3>${icon('gist')} ${t('gi_new')}</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
    <div class="m-body">
      <label class="lbl">${t('rs_desc')}</label><input class="field" id="gDesc">
      <label class="lbl" style="margin-top:12px">File</label><input class="field mono" id="gFile" value="snippet.js">
      <label class="lbl" style="margin-top:12px">Content</label><textarea class="field mono" id="gContent" style="min-height:160px;font-size:12.5px"></textarea>
      <div style="display:flex;gap:10px;align-items:center;margin-top:12px">
        <label class="switch"><input type="checkbox" id="gPub"><i></i></label><span class="small muted">${t('c_public')}</span>
      </div>
    </div>
    <div class="m-foot"><button class="btn" data-act="modal-close">${t('c_cancel')}</button><button class="btn btn-primary" id="gSave">${icon('check')} ${t('c_create')}</button></div>`, true);
  m.querySelector('#gSave').addEventListener('click', async () => {
    const fn = m.querySelector('#gFile').value.trim() || 'snippet.txt';
    try {
      await gh('/gists', { method:'POST', body: JSON.stringify({ description: m.querySelector('#gDesc').value, public: m.querySelector('#gPub').checked, files: { [fn]: { content: m.querySelector('#gContent').value || ' ' } } }) });
      closeModal(); toast('Gist ✓'); renderGists();
    } catch(e){ fail(e); }
  });
}
async function delGist(id){
  const ok = await confirmBox({ title:'Delete gist?', body:'—', danger:true });
  if (!ok) return;
  try { await gh('/gists/' + id, { method:'DELETE' }); toast('Gist ✕'); renderGists(); } catch(e){ fail(e); }
}

/* ---- activity ---- */
async function renderActivity(){
  const c = $('#content');
  c.innerHTML = `<div class="glass pad" style="margin-bottom:14px"><div class="sec-head"><h3>${t('ov_contrib')} <span class="badge b-neutral">${t('ov_last90')}</span></h3></div>${heatmapHTML(91)}</div>
  <div class="glass" style="padding:30px;text-align:center">${icon('spinner','ic spin')}</div>`;
  try {
    const evs = state.events || await gh(`/users/${state.user.login}/events/public?per_page=100`);
    c.querySelectorAll('.glass')[1].outerHTML = `<div class="glass">${evs.map(e => {
      let txt = '', icn = 'commit', col = 'var(--acc)';
      const repo = e.repo?.name || '';
      if (e.type === 'PushEvent'){ txt = `push · ${e.payload.commits?.length||0} commit(s) → <b>${esc(repo)}</b>`; col='var(--ok)'; }
      else if (e.type === 'CreateEvent'){ txt = `create ${e.payload.ref_type} <b>${esc(e.payload.ref||repo)}</b>`; icn='plus'; }
      else if (e.type === 'DeleteEvent'){ txt = `delete ${e.payload.ref_type} <b>${esc(e.payload.ref||'')}</b> · ${esc(repo)}`; icn='trash'; col='var(--bad)'; }
      else if (e.type === 'IssuesEvent'){ txt = `${e.payload.action} issue · <b>${esc(repo)}</b>: ${esc(e.payload.issue?.title||'')}`; icn='issue'; col='var(--warn)'; }
      else if (e.type === 'WatchEvent'){ txt = `star → <b>${esc(repo)}</b>`; icn='star'; col='var(--warn)'; }
      else if (e.type === 'ForkEvent'){ txt = `fork → <b>${esc(repo)}</b>`; icn='fork'; }
      else if (e.type === 'PullRequestEvent'){ txt = `${e.payload.action} PR · <b>${esc(repo)}</b>: ${esc(e.payload.pull_request?.title||'')}`; icn='pr'; col='#8b93d8'; }
      else if (e.type === 'ReleaseEvent'){ txt = `release ${esc(e.payload.release?.tag_name||'')} · <b>${esc(repo)}</b>`; icn='tag'; col='var(--ok)'; }
      else txt = `${e.type} · <b>${esc(repo)}</b>`;
      return `<div class="lrow"><span style="color:${col}">${icon(icn)}</span><div class="lt"><b style="font-weight:500">${txt}</b><span>${relTime(e.created_at)}</span></div></div>`;
    }).join('') || `<div class="empty">${t('act_empty')}</div>`}</div>`;
  } catch(e){ c.querySelectorAll('.glass')[1].outerHTML = `<div class="glass empty">${esc(e.message)}</div>`; }
}

/* ---- app settings ---- */
function renderAppSettings(){
  const u = state.user;
  $('#content').innerHTML = `
    <div class="grid-2">
      <div class="glass pad">
        <div class="sec-head"><h3>${icon('user')} ${t('as_profile')}</h3></div>
        <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">
          <img src="${esc(u.avatar_url)}" style="width:56px;height:56px;border-radius:16px;border:1px solid var(--stroke-2)">
          <div><b style="font-size:15.5px">${esc(u.login)}</b><br><span class="muted small">${esc(u.name||'')}</span></div>
        </div>
        <div class="kv"><span>${t('as_account')}</span><span>${esc(u.type||'User')}</span></div>
        <div class="kv"><span>${t('as_pub_repos')}</span><span>${u.public_repos}</span></div>
        <div class="kv"><span>${t('as_followers')}</span><span>${u.followers}</span></div>
        <div class="kv"><span>${t('as_since')}</span><span>${new Date(u.created_at).toLocaleDateString(state.lang==='ru'?'ru-RU':'en-US')}</span></div>
        ${u.bio ? `<div class="kv"><span>${t('as_bio')}</span><span>${esc(u.bio)}</span></div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="glass pad">
          <div class="sec-head"><h3>${icon('lock')} ${t('as_token')}</h3></div>
          <div class="kv"><span>Token</span><span style="display:flex;gap:8px;align-items:center"><span class="mono" id="tokMask" data-mask="${esc(state.token.slice(0,6))}••••••••${esc(state.token.slice(-4))}">${esc(state.token.slice(0,6))}••••••••${esc(state.token.slice(-4))}</span><button class="btn btn-ghost btn-sm" data-act="show-token" title="${t('as_show_note')}">${icon('eye2')}</button></span></div>
          <div class="kv"><span>${t('as_scopes')}</span><span>${state.scopes ? state.scopes.split(',').map(s=>`<span class="badge b-acc" style="margin:2px">${esc(s.trim())}</span>`).join('') : '—'}</span></div>
          <div style="display:flex;gap:9px;margin-top:14px;flex-wrap:wrap">
            <button class="btn btn-sm" data-act="replace-token">${icon('refresh')} ${t('as_replace')}</button>
            <button class="btn btn-danger btn-sm" data-act="logout">${icon('x')} ${t('as_logout')}</button>
          </div>
        </div>
        <div class="glass pad">
          <div class="sec-head"><h3>${icon('gear')} ${t('as_about')}</h3></div>
          <p class="muted small" style="line-height:1.65">${t('as_about_t')}</p>
        </div>
      </div>
    </div>`;
}
