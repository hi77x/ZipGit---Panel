/* == views: repo (branches, PRs, commits+diff, actions, pages, settings) == */

/* ---------- branches ---------- */
async function renderTabBranches(){
  const box = $('#repoTab');
  const cmp = {};
  await Promise.all(state.branches.filter(b => b.name !== state.repo.default_branch).map(async b => {
    try {
      const c = await gh(`/repos/${state.repo.full_name}/compare/${encodeURIComponent(state.repo.default_branch)}...${encodeURIComponent(b.name)}`);
      cmp[b.name] = { a: c.ahead_by, b: c.behind_by };
    } catch(e){}
  }));
  box.innerHTML = `
    <div class="glass pad" style="max-width:620px;margin-bottom:14px">
      <div class="sec-head"><h3>${icon('branch')} ${t('br_new')}</h3></div>
      <div style="display:flex;gap:9px">
        <input class="field" id="nbName" placeholder="${t('br_ph')}">
        <button class="btn btn-primary" data-act="new-branch">${icon('plus')} ${t('br_create')}</button>
      </div>
      <p class="hint">${t('br_from')} ${esc(state.branch)}.</p>
    </div>
    <div class="glass">
      ${state.branches.map(b => `
        <div class="lrow">
          <span style="color:var(--acc)">${icon('branch')}</span>
          <div class="lt"><b class="mono">${esc(b.name)}</b><span>${String(b.commit.sha).slice(0,7)}</span></div>
          ${cmp[b.name] ? `<span class="cmp-badge" title="${t('bs_ahead')}/${t('bs_behind')} ${t('bs_compare')}">↑${cmp[b.name].a} ↓${cmp[b.name].b}</span>` : ''}
          ${b.name === state.repo.default_branch ? `<span class="badge b-acc">${t('br_default')}</span>` : `
            <button class="btn btn-ghost btn-sm hide-m" title="${t('br_merge_into')} ${esc(state.repo.default_branch)}" data-act="merge-branch" data-name="${esc(b.name)}">${icon('merge')}<span class="hide-m"> ${t('br_merge_into')} ${esc(state.repo.default_branch)}</span></button>
            <button class="btn btn-ghost btn-sm hide-m" data-act="set-default" data-name="${esc(b.name)}">${t('br_set_default')}</button>
            <button class="btn btn-ghost btn-icon" data-act="del-branch" data-name="${esc(b.name)}" title="${t('fl_delete')}">${icon('trash')}</button>`}
        </div>`).join('')}
    </div>`;
}
async function newBranch(){
  const name = $('#nbName').value.trim();
  if (!name) return toast(t('br_ph'), 'warn');
  try {
    const ref = await gh(`/repos/${state.repo.full_name}/git/ref/heads/${encodeURIComponent(state.branch)}`);
    await gh(`/repos/${state.repo.full_name}/git/refs`, { method:'POST', body: JSON.stringify({ ref:'refs/heads/' + name, sha: ref.object.sha }) });
    toast(t('ts_branch_created') + ': ' + name);
    state.branches = await ghAll(`/repos/${state.repo.full_name}/branches`);
    renderTopbar(); renderTabBranches();
  } catch(e){ fail(e); }
}
async function delBranch(name){
  const ok = await confirmBox({ title: t('br_delete_title'), body: `<b class="mono">${esc(name)}</b> ${t('br_delete_s')}`, danger: true });
  if (!ok) return;
  try {
    await gh(`/repos/${state.repo.full_name}/git/refs/heads/${encodeURIComponent(name)}`, { method:'DELETE' });
    toast(t('ts_branch_deleted'));
    state.branches = await ghAll(`/repos/${state.repo.full_name}/branches`);
    renderTopbar(); renderTabBranches();
  } catch(e){ fail(e); }
}
async function setDefaultBranch(name){
  try {
    state.repo = await gh(`/repos/${state.repo.full_name}`, { method:'PATCH', body: JSON.stringify({ default_branch: name }) });
    toast(t('ts_default_set') + ' ' + name);
    renderTabBranches();
  } catch(e){ fail(e); }
}
async function mergeBranch(name){
  try {
    await gh(`/repos/${state.repo.full_name}/merges`, { method:'POST', body: JSON.stringify({ base: state.repo.default_branch, head: name, commit_message: `Merge ${name} into ${state.repo.default_branch} (ZipToGit Pro)` }) });
    toast(t('br_merged') + ': ' + name + ' → ' + state.repo.default_branch);
  } catch(e){
    if (e.status === 204) toast(t('br_merged') + ' (no-op)');
    else if (/conflict/i.test(e.message)) toast('Merge conflict — resolve via PR', 'warn');
    else fail(e);
  }
}

/* ---------- pull requests ---------- */
async function renderTabPRs(){
  const box = $('#repoTab');
  box.innerHTML = `
    <div class="toolbar">
      <select class="field" id="prState" style="width:auto">
        <option value="open"${state.prState==='open'?' selected':''}>Open</option>
        <option value="closed"${state.prState==='closed'?' selected':''}>Closed</option>
        <option value="all"${state.prState==='all'?' selected':''}>All</option>
      </select>
      <div class="spacer"></div>
      <button class="btn btn-primary btn-sm" data-act="new-pr-modal">${icon('plus')} ${t('pr_new')}</button>
    </div>
    <div id="prList" class="glass" style="padding:26px;text-align:center">${icon('spinner','ic spin')}</div>`;
  const load = async () => {
    try {
      const prs = await gh(`/repos/${state.repo.full_name}/pulls?state=${box.querySelector('#prState').value}&per_page=50`);
      box.querySelector('#prList').innerHTML = prs.map(p => `
        <div class="lrow">
          <span style="color:${p.state==='open'?'var(--ok)':'#8b93d8'}">${icon(p.merged_at?'merge':'pr')}</span>
          <div class="lt"><b>${esc(p.title)}</b><span>#${p.number} · ${t('pr_by')} ${esc(p.user.login)} · ${relTime(p.created_at)} · ${p.state}${p.merged_at?' (merged)':''}</span></div>
          ${p.state==='open' ? `
            <button class="btn btn-ok btn-sm" data-act="merge-pr" data-n="${p.number}">${icon('merge')} ${t('pr_merge')}</button>
            <button class="btn btn-ghost btn-sm hide-m" data-act="close-pr" data-n="${p.number}">${t('pr_close')}</button>`
          : `<button class="btn btn-ghost btn-sm hide-m" data-act="reopen-pr" data-n="${p.number}">${t('pr_reopen')}</button>`}
          <button class="btn btn-ghost btn-sm" data-act="pr-changes" data-n="${p.number}">${t('pr_changes')}</button>
        </div>`).join('') || `<div class="empty">${t('pr_empty')}</div>`;
    } catch(e){ box.querySelector('#prList').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  };
  box.querySelector('#prState').addEventListener('change', e => { state.prState = e.target.value; load(); });
  load();
}
function newPRModal(){
  const nonDefault = state.branches.map(b => b.name);
  const m = openModal(`
    <div class="m-head"><h3>${icon('pr')} ${t('pr_new')}</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
    <div class="m-body">
      <label class="lbl">${t('pr_title_ph')} *</label><input class="field" id="prTitle">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
        <div><label class="lbl">${t('pr_head')}</label><select class="field" id="prHead">${nonDefault.map(b => `<option${b===state.branch?' selected':''}>${esc(b)}</option>`).join('')}</select></div>
        <div><label class="lbl">${t('pr_base')}</label><select class="field" id="prBase">${nonDefault.map(b => `<option${b===state.repo.default_branch?' selected':''}>${esc(b)}</option>`).join('')}</select></div>
      </div>
      <label class="lbl" style="margin-top:12px">${t('pr_body')}</label><textarea class="field" id="prBody" style="min-height:90px"></textarea>
    </div>
    <div class="m-foot"><button class="btn" data-act="modal-close">${t('c_cancel')}</button><button class="btn btn-primary" id="prGo">${icon('check')} ${t('pr_create')}</button></div>`);
  m.querySelector('#prGo').addEventListener('click', async () => {
    const title = m.querySelector('#prTitle').value.trim();
    if (!title) return toast(t('ts_title'), 'warn');
    try {
      const pr = await gh(`/repos/${state.repo.full_name}/pulls`, { method:'POST', body: JSON.stringify({ title, head: m.querySelector('#prHead').value, base: m.querySelector('#prBase').value, body: m.querySelector('#prBody').value }) });
      closeModal(); toast('PR #' + pr.number + ' ✓'); renderTabPRs();
    } catch(e){ fail(e); }
  });
}
async function mergePR(n){
  try {
    const [pr, files] = await Promise.all([
      gh(`/repos/${state.repo.full_name}/pulls/${n}`),
      ghAll(`/repos/${state.repo.full_name}/pulls/${n}/files`)
    ]);
    const blockers = [], warnings = [];
    for (const f of files){
      if (!f.patch) continue;
      for (const p of SECRET_PATTERNS){ p.re.lastIndex = 0; if (p.re.test(f.patch)){ blockers.push(`${t('rv_block_secrets')}: <b class="mono">${esc(f.filename)}</b>`); break; } }
    }
    const wfDel = files.some(f => f.status === 'removed' && f.filename.startsWith('.github/workflows'));
    if (!pr.body) warnings.push(t('rv_warn_desc'));
    const churn = files.reduce((s,f) => s + (f.additions||0) + (f.deletions||0), 0);
    if (files.length > 30 || churn > 1500) warnings.push(`${t('rv_warn_big')} (${files.length} files, ${churn} lines)`);
    const hard = blockers.length > 0;
    const m = openModal(`
      <div class="m-head"><h3>${icon('merge')} PR #${n} — pre-merge checks</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
      <div class="m-body">
        ${blockers.map(b => `<p class="err">⛔ ${b}</p>`).join('')}
        ${wfDel ? `<p class="err">⛔ ${t('rv_block_wf')}</p>
          <label class="small muted" style="display:flex;gap:8px;align-items:center;margin-top:8px;cursor:pointer"><input type="checkbox" id="wfAck" style="accent-color:var(--bad)"> ${t('rv_wf_ack')}</label>` : ''}
        ${warnings.map(warn => `<p class="hint" style="color:var(--warn)">⚠ ${warn}</p>`).join('')}
        ${!blockers.length && !wfDel && !warnings.length ? `<p class="hint" style="color:var(--ok)">✓ OK</p>` : ''}
      </div>
      <div class="m-foot"><button class="btn" data-act="modal-close">${t('c_cancel')}</button>
        <button class="btn ${hard?'btn-danger':'btn-primary'}" id="mgGo" ${hard?'disabled':''}>${icon('merge')} ${t('pr_merge')}</button></div>`);
    const go = m.querySelector('#mgGo');
    const wf = m.querySelector('#wfAck');
    const refresh = () => { go.disabled = hard || (wfDel && wf && !wf.checked); };
    if (wf) wf.addEventListener('change', refresh);
    refresh();
    go.addEventListener('click', async () => {
      closeModal();
      try {
        await gh(`/repos/${state.repo.full_name}/pulls/${n}/merge`, { method:'PUT', body: JSON.stringify({ merge_method:'merge' }) });
        toast(t('pr_merged') + ' #' + n); renderTabPRs();
      } catch(e){ fail(e); }
    });
  } catch(e){ fail(e); }
}
async function setPRState(n, st){
  try {
    await gh(`/repos/${state.repo.full_name}/pulls/${n}`, { method:'PATCH', body: JSON.stringify({ state: st }) });
    renderTabPRs();
  } catch(e){ fail(e); }
}
async function prChanges(n){
  state.prReviewN = n; state.rvComments = [];
  const m = openModal(`<div class="m-head"><h3>${icon('pr')} PR #${n} · ${t('pr_changes')}</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
  <div class="m-body"><div style="text-align:center;padding:20px">${icon('spinner','ic spin')}</div></div>`, true);
  try {
    const files = await ghAll(`/repos/${state.repo.full_name}/pulls/${n}/files`);
    m.querySelector('.m-body').innerHTML = `
      <p class="hint" style="margin-bottom:10px">${icon('eye2')} ${t('rv_click_line')}</p>
      ${diffFilesHTML(files) || '<div class="empty">—</div>'}
      <div class="divider"></div>
      <div class="sec-head"><h3>${icon('edit')} ${t('rv_title')}</h3></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <label class="badge b-ok" style="cursor:pointer"><input type="radio" name="rve" value="APPROVE" checked style="accent-color:var(--ok)"> ${t('rv_approve')}</label>
        <label class="badge b-warn" style="cursor:pointer"><input type="radio" name="rve" value="COMMENT" style="accent-color:var(--warn)"> ${t('rv_comment')}</label>
        <label class="badge b-bad" style="cursor:pointer"><input type="radio" name="rve" value="REQUEST_CHANGES" style="accent-color:var(--bad)"> ${t('rv_request')}</label>
      </div>
      <textarea class="field" id="rvBody" style="min-height:70px" placeholder="${t('rv_body')}"></textarea>
      <div id="rvList" style="margin-top:8px"></div>
      <div class="sec-head" style="margin-top:12px"><h3>${t('rv_checklist')}</h3></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap" class="small muted">
        ${['rv_c1','rv_c2','rv_c3','rv_c4','rv_c5'].map(k => `<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" style="accent-color:var(--ok)"> ${t(k)}</label>`).join('')}
      </div>
      <button class="btn btn-primary" data-act="rv-submit" style="margin-top:14px">${icon('check')} ${t('rv_submit')}</button>`;
  } catch(e){ m.querySelector('.m-body').innerHTML = `<div class="empty">${esc(redact(e.message))}</div>`; }
}
function rvLineClick(path, line){
  const m = openModal(`
    <div class="m-head"><h3>${icon('edit')} ${esc(path)}:${line}</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
    <div class="m-body"><textarea class="field" id="rvC" style="min-height:80px" placeholder="${t('rv_line_comment')}"></textarea></div>
    <div class="m-foot"><button class="btn" data-act="modal-close">${t('c_cancel')}</button><button class="btn btn-primary" id="rvAdd">${icon('plus')} OK</button></div>`);
  m.querySelector('#rvAdd').addEventListener('click', () => {
    const body = m.querySelector('#rvC').value.trim();
    if (body){ state.rvComments.push({ path, line: +line, body, side:'RIGHT' }); renderRvList(); }
    closeModal();
  });
}
function renderRvList(){
  const el = $('#rvList'); if (!el) return;
  el.innerHTML = state.rvComments.map((c,i) => `<div class="scan-item"><span class="badge b-acc mono">${esc(c.path)}:${c.line}</span><div class="tiny" style="flex:1">${esc(c.body)}</div><button class="btn btn-ghost btn-icon" data-rvrm="${i}">${icon('x')}</button></div>`).join('');
  el.querySelectorAll('[data-rvrm]').forEach(b => b.addEventListener('click', () => { state.rvComments.splice(+b.dataset.rvrm,1); renderRvList(); }));
}
async function rvSubmit(){
  const event = document.querySelector('input[name="rve"]:checked')?.value || 'COMMENT';
  const body = $('#rvBody')?.value || '';
  try {
    await gh(`/repos/${state.repo.full_name}/pulls/${state.prReviewN}/reviews`, { method:'POST', body: JSON.stringify({ event, body, comments: state.rvComments }) });
    toast(t('rv_submitted')); closeModal();
  } catch(e){ fail(e); }
}

/* ---------- issues ---------- */
async function renderTabIssues(){
  const box = $('#repoTab');
  box.innerHTML = `
    <div class="toolbar">
      <select class="field" id="issState" style="width:auto">
        <option value="open">Open</option><option value="closed">Closed</option><option value="all">All</option>
      </select>
      <div class="spacer"></div>
      <button class="btn btn-primary btn-sm" data-act="new-issue-modal">${icon('plus')} ${t('is_new')}</button>
    </div>
    <div id="issList" class="glass" style="padding:26px;text-align:center">${icon('spinner','ic spin')}</div>`;
  const load = async () => {
    try {
      const issues = (await gh(`/repos/${state.repo.full_name}/issues?state=${box.querySelector('#issState').value}&per_page=50`)).filter(i => !i.pull_request);
      box.querySelector('#issList').innerHTML = issues.map(i => `
        <div class="lrow">
          <span style="color:${i.state==='open'?'var(--ok)':'#8b93d8'}">${icon('issue')}</span>
          <div class="lt"><b>${esc(i.title)}</b><span>#${i.number} · ${esc(i.user.login)} · ${relTime(i.created_at)} · 💬 ${i.comments}</span></div>
          ${(i.labels||[]).slice(0,3).map(l => `<span class="badge b-neutral" style="border-color:#${l.color}55;color:#${l.color}">${esc(l.name)}</span>`).join('')}
          <button class="btn btn-ghost btn-sm" data-act="toggle-issue" data-n="${i.number}" data-state="${i.state}">${i.state==='open'?t('pr_close'):t('pr_reopen')}</button>
          <a class="btn btn-ghost btn-icon" href="${esc(i.html_url)}" target="_blank" rel="noopener">${icon('ext')}</a>
        </div>`).join('') || `<div class="empty">${t('is_empty')}</div>`;
    } catch(e){ box.querySelector('#issList').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  };
  box.querySelector('#issState').addEventListener('change', load);
  load();
}
function newIssueModal(){
  const m = openModal(`
    <div class="m-head"><h3>${icon('issue')} ${t('is_new')}</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
    <div class="m-body">
      <label class="lbl">${t('pr_title_ph')} *</label><input class="field" id="issTitle">
      <label class="lbl" style="margin-top:12px">${t('pr_body')}</label><textarea class="field" id="issBody" style="min-height:110px"></textarea>
    </div>
    <div class="m-foot"><button class="btn" data-act="modal-close">${t('c_cancel')}</button><button class="btn btn-primary" id="issGo">${icon('check')} ${t('c_create')}</button></div>`);
  m.querySelector('#issGo').addEventListener('click', async () => {
    const title = m.querySelector('#issTitle').value.trim();
    if (!title) return toast(t('ts_title'), 'warn');
    try {
      await gh(`/repos/${state.repo.full_name}/issues`, { method:'POST', body: JSON.stringify({ title, body: m.querySelector('#issBody').value }) });
      closeModal(); toast('Issue ✓'); renderTabIssues();
    } catch(e){ fail(e); }
  });
}
async function toggleIssue(n, cur){
  try {
    await gh(`/repos/${state.repo.full_name}/issues/${n}`, { method:'PATCH', body: JSON.stringify({ state: cur==='open'?'closed':'open' }) });
    renderTabIssues();
  } catch(e){ fail(e); }
}

/* ---------- releases ---------- */
async function renderTabReleases(){
  const box = $('#repoTab');
  box.innerHTML = `<div class="glass" style="padding:26px;text-align:center">${icon('spinner','ic spin')}</div>`;
  try {
    const [rels, tags] = await Promise.all([
      gh(`/repos/${state.repo.full_name}/releases?per_page=30`).catch(() => []),
      gh(`/repos/${state.repo.full_name}/tags?per_page=30`).catch(() => [])
    ]);
    box.innerHTML = `
      <div class="grid-2" style="grid-template-columns:1.4fr 1fr">
        <div class="glass">
          <div class="sec-head" style="padding:14px 16px 0"><h3>${icon('tag')} ${t('tab_releases')}</h3>
            <button class="btn btn-primary btn-sm" data-act="new-release-modal">${icon('plus')} ${t('rl_new')}</button></div>
          ${rels.map(r => `
            <div class="lrow">
              <span style="color:var(--ok)">${icon('tag')}</span>
              <div class="lt"><b>${esc(r.name || r.tag_name)}</b><span class="mono">${esc(r.tag_name)} · ${relTime(r.created_at)}</span></div>
              ${r.draft ? '<span class="badge b-warn">draft</span>' : ''}
              ${r.prerelease ? '<span class="badge b-neutral">pre</span>' : ''}
              <a class="btn btn-ghost btn-icon" href="${esc(r.html_url)}" target="_blank" rel="noopener">${icon('ext')}</a>
              <button class="btn btn-ghost btn-icon" data-act="del-release" data-id="${r.id}">${icon('trash')}</button>
            </div>`).join('') || `<div class="empty">${t('rl_empty')}</div>`}
        </div>
        <div class="glass">
          <div class="sec-head" style="padding:14px 16px 0"><h3>${icon('branch')} ${t('rl_tags')}</h3></div>
          ${tags.map(g => `
            <div class="lrow">
              <span style="color:var(--acc)">${icon('tag')}</span>
              <div class="lt"><b class="mono">${esc(g.name)}</b></div>
              <span class="sha-chip" data-act="copy-raw" data-text="${g.commit.sha}">${String(g.commit.sha).slice(0,7)}</span>
            </div>`).join('') || `<div class="empty">—</div>`}
        </div>
      </div>`;
  } catch(e){ box.innerHTML = `<div class="glass empty">${esc(e.message)}</div>`; }
}
function newReleaseModal(){
  const m = openModal(`
    <div class="m-head"><h3>${icon('tag')} ${t('rl_new')}</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
    <div class="m-body">
      <label class="lbl">${t('rl_tag')}</label><input class="field mono" id="rlTag" placeholder="v1.0.0">
      <label class="lbl" style="margin-top:12px">${t('rl_name')}</label><input class="field" id="rlName" placeholder="v1.0.0">
      <label class="lbl" style="margin-top:12px">${t('rl_body')}</label><textarea class="field" id="rlBody" style="min-height:100px"></textarea>
      <div style="display:flex;gap:10px;align-items:center;margin-top:12px">
        <label class="switch"><input type="checkbox" id="rlPre"><i></i></label><span class="small muted">Prerelease</span>
      </div>
    </div>
    <div class="m-foot"><button class="btn" data-act="modal-close">${t('c_cancel')}</button><button class="btn btn-primary" id="rlGo">${icon('check')} ${t('c_create')}</button></div>`);
  m.querySelector('#rlGo').addEventListener('click', async () => {
    const tag = m.querySelector('#rlTag').value.trim();
    if (!tag) return toast(t('rl_tag'), 'warn');
    try {
      await gh(`/repos/${state.repo.full_name}/releases`, { method:'POST', body: JSON.stringify({
        tag_name: tag, name: m.querySelector('#rlName').value || tag, body: m.querySelector('#rlBody').value,
        prerelease: m.querySelector('#rlPre').checked, target_commitish: state.branch }) });
      closeModal(); toast(t('rl_created') + ': ' + tag); renderTabReleases();
    } catch(e){ fail(e); }
  });
}
async function delRelease(id){
  const ok = await confirmBox({ title:'Delete release?', body:'—', danger:true });
  if (!ok) return;
  try { await gh(`/repos/${state.repo.full_name}/releases/${id}`, { method:'DELETE' }); renderTabReleases(); } catch(e){ fail(e); }
}

/* ---------- commits + diff ---------- */
function diffFilesHTML(files){
  if (!files || !files.length) return '';
  return files.map(f => {
    let nl = 0;
    const lines = (f.patch || '').split('\n').map(l => {
      let cls = '', attr = '';
      if (l.startsWith('@@')){ cls = 'hunk'; const m = l.match(/\+(\d+)/); nl = m ? +m[1] : 0; }
      else if (l.startsWith('+++') || l.startsWith('---')) cls = 'meta';
      else if (l.startsWith('+')){ cls = 'add'; attr = ` data-rv="${esc(f.filename)}:${nl}" style="cursor:pointer"`; nl++; }
      else if (l.startsWith('-')){ cls = 'del'; }
      else nl++;
      return `<span class="dl ${cls}"${attr}>${esc(l) || ' '}</span>`;
    }).join('');
    return `
    <div class="diff" style="margin-bottom:12px">
      <div class="dh"><span class="mono" style="flex:1;word-break:break-all">${esc(f.filename)}</span>
        <span class="badge b-ok">+${f.additions}</span><span class="badge b-bad">−${f.deletions}</span>
        <span class="badge b-neutral">${esc(f.status)}</span></div>
      <div style="padding:6px 0">${lines || `<span class="dl meta">(binary / no patch)</span>`}</div>
    </div>`;
  }).join('');
}
async function renderTabCommits(){
  const box = $('#repoTab');
  box.innerHTML = `<div class="glass" style="padding:26px;text-align:center">${icon('spinner','ic spin')}</div>`;
  try {
    const commits = await gh(`/repos/${state.repo.full_name}/commits?sha=${encodeURIComponent(state.branch)}&per_page=40`);
    box.innerHTML = `<div class="glass">${commits.map(c => `
      <div class="lrow" style="cursor:pointer" data-act="commit-open" data-sha="${c.sha}">
        <span style="color:var(--ok)">${icon('commit')}</span>
        <div class="lt"><b>${esc((c.commit.message||'').split('\n')[0])}</b>
          <span>${esc(c.commit.author?.name||'')} · ${relTime(c.commit.author?.date||'')}</span></div>
        <span class="badge b-neutral hide-m">${c.files && 0}${''}</span>
        <button class="btn btn-ghost btn-sm" data-act="commit-open" data-sha="${c.sha}">${t('cm_diff')}</button>
        <span class="sha-chip" data-act="copy-raw" data-text="${c.sha}">${c.sha.slice(0,7)}</span>
      </div>`).join('') || `<div class="empty">${t('cm_empty')}</div>`}</div>
    <div id="diffPanel" style="margin-top:14px"></div>`;
  } catch(e){ box.innerHTML = `<div class="glass empty">${esc(e.message)}</div>`; }
}
async function commitOpen(sha){
  const panel = $('#diffPanel');
  if (!panel) return;
  panel.innerHTML = `<div class="glass" style="padding:26px;text-align:center">${icon('spinner','ic spin')}</div>`;
  panel.scrollIntoView && panel.scrollIntoView({ behavior:'smooth', block:'start' });
  try {
    const c = await gh(`/repos/${state.repo.full_name}/commits/${sha}`);
    panel.innerHTML = `
      <div class="glass pad">
        <div class="sec-head"><h3>${icon('commit')} ${esc((c.commit.message||'').split('\n')[0])}</h3>
          <span class="sha-chip">${sha.slice(0,7)}</span></div>
        <p class="muted small" style="margin-bottom:12px">${esc(c.commit.author?.name||'')} · ${new Date(c.commit.author?.date||Date.now()).toLocaleString(state.lang==='ru'?'ru-RU':'en-US')} · ${c.files.length} ${t('cm_files')} · <span style="color:var(--ok)">+${c.stats.additions}</span> <span style="color:var(--bad)">−${c.stats.deletions}</span></p>
        ${diffFilesHTML(c.files)}
      </div>`;
  } catch(e){ fail(e); panel.innerHTML = ''; }
}

/* ---------- actions ---------- */
async function renderTabActions(){
  const box = $('#repoTab');
  box.innerHTML = `<div class="glass" style="padding:26px;text-align:center">${icon('spinner','ic spin')}</div>`;
  try {
    const [wf, runs] = await Promise.all([
      gh(`/repos/${state.repo.full_name}/actions/workflows`).catch(() => ({ workflows: [] })),
      gh(`/repos/${state.repo.full_name}/actions/runs?per_page=15`).catch(() => ({ workflow_runs: [] }))
    ]);
    const wfList = wf.workflows || [];
    const runList = runs.workflow_runs || [];
    box.innerHTML = `
      <div class="grid-2" style="grid-template-columns:1fr 1.3fr">
        <div class="glass">
          <div class="sec-head" style="padding:14px 16px 0"><h3>${icon('play')} ${t('ac_workflows')}</h3></div>
          ${wfList.map(w => `
            <div class="lrow">
              <span style="color:var(--acc)">${icon('play')}</span>
              <div class="lt"><b>${esc(w.name)}</b><span class="mono tiny">${esc(w.path)}</span></div>
              ${w.state === 'active' ? `<button class="btn btn-sm btn-primary" data-act="wf-dispatch" data-id="${w.id}">${t('ac_dispatch')}</button>` : `<span class="badge b-neutral">${esc(w.state)}</span>`}
            </div>`).join('') || `<div class="empty">${t('ac_no_workflows')}</div>`}
        </div>
        <div class="glass">
          <div class="sec-head" style="padding:14px 16px 0"><h3>${icon('clock')} ${t('ac_runs')}</h3></div>
          ${runList.map(r => {
            const [col, label] = r.status === 'completed'
              ? (r.conclusion === 'success' ? ['var(--ok)','success'] : r.conclusion === 'skipped' ? ['var(--dim)','skipped'] : ['var(--bad)', r.conclusion||'failure'])
              : r.status === 'in_progress' ? ['var(--warn)','in progress'] : ['var(--dim)', r.status];
            return `<div class="lrow">
              <span class="status-dot" style="background:${col}"></span>
              <div class="lt"><b>${esc(r.name || r.head_branch)}</b><span>${esc(r.event)} · ${esc(r.head_branch)} · ${relTime(r.created_at)} · <span style="color:${col}">${label}</span></span></div>
              <a class="btn btn-ghost btn-icon" href="${esc(r.html_url)}" target="_blank" rel="noopener" title="${t('ac_view')}">${icon('ext')}</a>
            </div>`; }).join('') || `<div class="empty">${t('ac_no_runs')}</div>`}
        </div>
      </div>`;
  } catch(e){ box.innerHTML = `<div class="glass empty">${esc(e.message)}</div>`; }
}
async function wfDispatch(id){
  const m = openModal(`
    <div class="m-head"><h3>${icon('play')} ${t('ac_dispatch')}</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
    <div class="m-body"><label class="lbl">${t('pg_branch')}</label>
      <select class="field" id="wdRef">${state.branches.map(b => `<option${b.name===state.branch?' selected':''}>${esc(b.name)}</option>`).join('')}</select></div>
    <div class="m-foot"><button class="btn" data-act="modal-close">${t('c_cancel')}</button><button class="btn btn-primary" id="wdGo">${icon('play')} ${t('ac_dispatch')}</button></div>`);
  m.querySelector('#wdGo').addEventListener('click', async () => {
    try {
      await gh(`/repos/${state.repo.full_name}/actions/workflows/${id}/dispatches`, { method:'POST', body: JSON.stringify({ ref: m.querySelector('#wdRef').value }) });
      closeModal(); toast(t('ac_dispatched'));
      setTimeout(() => state.tab === 'actions' && renderTabActions(), 1500);
    } catch(e){ fail(e); }
  });
}

/* ---------- pages ---------- */
async function renderTabPages(){
  const box = $('#repoTab');
  box.innerHTML = `<div class="glass" style="padding:30px;text-align:center">${icon('spinner','ic spin')}</div>`;
  const full = state.repo.full_name;
  let pages = null;
  try { pages = await gh(`/repos/${full}/pages`); } catch(e){ if (e.status !== 404){ fail(e); return; } }
  const branchOpts = state.branches.map(b => `<option${b.name===state.branch?' selected':''}>${esc(b.name)}</option>`).join('');
  box.innerHTML = `
    <div class="glass pad" style="max-width:620px">
      <div class="sec-head"><h3>${icon('globe')} ${t('pg_title')}</h3>
        ${pages ? (pages.status==='built' ? `<span class="badge b-ok">${t('pg_deployed')}</span>` : `<span class="badge b-warn">${esc(pages.status)}</span>`) : `<span class="badge b-neutral">${t('pg_off_badge')}</span>`}
      </div>
      ${pages ? `
        <div class="kv"><span>${t('pg_url')}</span><a href="${esc(pages.html_url)}" target="_blank" rel="noopener">${esc(pages.html_url)} ${icon('ext','ic')}</a></div>
        <div class="kv"><span>${t('pg_source')}</span><span class="mono">${esc(pages.source?.branch||'—')} ${esc(pages.source?.path||'')}</span></div>
        <div class="kv"><span>${t('pg_status')}</span><span>${esc(pages.status)}</span></div>
        <div style="display:flex;gap:9px;margin-top:16px;flex-wrap:wrap">
          <a class="btn btn-primary btn-sm" href="${esc(pages.html_url)}" target="_blank" rel="noopener">${icon('ext')} ${t('c_open')}</a>
          <button class="btn btn-sm" data-act="pages-rebuild">${icon('refresh')} ${t('pg_rebuild')}</button>
          <button class="btn btn-danger btn-sm" data-act="pages-disable">${icon('trash')} ${t('pg_disable')}</button>
        </div>` : `
        <p class="muted small" style="margin-bottom:14px">${t('pg_note')}</p>
        <label class="lbl">${t('pg_branch')}</label>
        <select class="field" id="pgBranch">${branchOpts}</select>
        <label class="lbl" style="margin-top:10px">${t('pg_folder')}</label>
        <select class="field" id="pgPath"><option value="/">/ (root)</option><option value="/docs">/docs</option></select>
        <button class="btn btn-primary" data-act="pages-enable" style="margin-top:14px">${icon('globe')} ${t('pg_enable')}</button>`}
    </div>`;
}
async function pagesEnable(){
  try {
    await gh(`/repos/${state.repo.full_name}/pages`, { method:'POST', body: JSON.stringify({ source: { branch: $('#pgBranch').value, path: $('#pgPath').value } }) });
    toast(t('pg_on_toast')); renderTabPages();
  } catch(e){ fail(e); }
}
async function pagesDisable(){
  const ok = await confirmBox({ title: t('pg_disable_title'), body: t('pg_disable_s'), danger: true, label: t('pg_disable') });
  if (!ok) return;
  try { await gh(`/repos/${state.repo.full_name}/pages`, { method:'DELETE' }); toast(t('pg_off_toast')); renderTabPages(); } catch(e){ fail(e); }
}
async function pagesRebuild(){
  try { await gh(`/repos/${state.repo.full_name}/pages/builds`, { method:'POST' }); toast(t('pg_rebuild_toast')); } catch(e){ fail(e); }
}

/* ---------- repo settings ---------- */
async function renderTabRepoSettings(){
  const r = state.repo;
  let topics = [];
  try { topics = (await gh(`/repos/${r.full_name}`)).topics || []; } catch(e){}
  $('#repoTab').innerHTML = `
    <div class="glass pad" style="max-width:620px">
      <div class="sec-head"><h3>${icon('gear')} ${t('rs_title')}</h3></div>
      <label class="lbl">${t('rs_name')}</label>
      <input class="field" id="rsName" value="${esc(r.name)}">
      <label class="lbl" style="margin-top:12px">${t('rs_desc')}</label>
      <input class="field" id="rsDesc" value="${esc(r.description||'')}">
      <label class="lbl" style="margin-top:12px">${t('rs_home')}</label>
      <input class="field" id="rsHome" value="${esc(r.homepage||'')}">
      <label class="lbl" style="margin-top:12px">${t('rs_topics')}</label>
      <input class="field" id="rsTopicIn" placeholder="${t('rs_topics_ph')}">
      <div class="chips" id="rsTopics">${topics.map(x => `<span class="chip">${esc(x)}<button data-topic="${esc(x)}">${icon('x')}</button></span>`).join('')}</div>
      <div class="divider"></div>
      <label class="lbl">${t('rs_default_branch')}</label>
      <select class="field" id="rsDefault">${state.branches.map(b => `<option${b.name===r.default_branch?' selected':''}>${esc(b.name)}</option>`).join('')}</select>
      <button class="btn btn-primary" data-act="save-repo-settings" style="margin-top:16px">${icon('check')} ${t('rs_save')}</button>
    </div>
    <div class="glass pad" style="max-width:620px;margin-top:14px">
      <div class="sec-head"><h3>${icon(r.private?'lock':'globe')} ${t('vis_title')}</h3>
        ${r.private ? `<span class="badge b-private">${t('c_private')}</span>` : `<span class="badge b-public">${t('c_public')}</span>`}</div>
      <div class="mode-cards" style="grid-template-columns:1fr 1fr" id="visModes">
        <label class="mode-card${!r.private?' on':''}" data-vis="public"><input type="radio" name="vis" ${!r.private?'checked':''}><span class="mrad"></span>
          <div><b>${t('c_public')}</b></div></label>
        <label class="mode-card${r.private?' on':''}" data-vis="private"><input type="radio" name="vis" ${r.private?'checked':''}><span class="mrad"></span>
          <div><b>${t('c_private')}</b></div></label>
      </div>
      <button class="btn" data-act="vis-apply" style="margin-top:12px">${icon('check')} ${t('vis_apply')}</button>
    </div>
    <div class="glass" style="max-width:620px;margin-top:14px">
      <div class="sec-head" style="padding:14px 16px 0"><h3>${icon('people')} ${t('pe_title')}</h3></div>
      <div id="collabList" style="padding:0 0 6px"><div style="padding:14px 16px" class="dim small">${icon('spinner','ic spin')}</div></div>
      <div style="display:flex;gap:8px;padding:0 16px 16px">
        <input class="field" id="collabIn" placeholder="${t('pe_add_ph')}">
        <button class="btn btn-primary" data-act="collab-add">${icon('plus')} ${t('pe_add')}</button>
      </div>
    </div>
    <div class="glass pad danger-zone" style="max-width:620px;margin-top:14px">
      <div class="sec-head"><h3 style="color:#f08ba0">${icon('warn')} ${t('rs_danger')}</h3></div>
      <p class="muted small" style="margin-bottom:12px">${t('rs_danger_s')}</p>
      <button class="btn btn-danger" data-act="del-repo-modal">${icon('trash')} ${t('rs_delete')}</button>
    </div>`;
  state._topics = [...topics];
  const inp = $('#rsTopicIn');
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && inp.value.trim()){
      e.preventDefault();
      const v = inp.value.trim().toLowerCase().replace(/\s+/g,'-');
      if (!state._topics.includes(v)) state._topics.push(v);
      inp.value = '';
      renderTopics();
    }
  });
  function renderTopics(){
    $('#rsTopics').innerHTML = state._topics.map(x => `<span class="chip">${esc(x)}<button data-topic="${esc(x)}">${icon('x')}</button></span>`).join('');
  }
  $('#rsTopics').addEventListener('click', e => {
    const b = e.target.closest('[data-topic]');
    if (b){ state._topics = state._topics.filter(x => x !== b.dataset.topic); renderTopics(); }
  });
  $('#visModes').querySelectorAll('.mode-card').forEach(mc => mc.addEventListener('click', () => {
    $('#visModes').querySelectorAll('.mode-card').forEach(x => x.classList.remove('on'));
    mc.classList.add('on');
  }));
  loadCollabs();
}
async function loadCollabs(){
  const box = $('#collabList');
  if (!box) return;
  try {
    const cs = await gh(`/repos/${state.repo.full_name}/collaborators?per_page=100`);
    box.innerHTML = cs.length ? cs.map(c => `
      <div class="lrow">
        <img src="${esc(c.avatar_url)}" style="width:26px;height:26px;border-radius:50%;flex:none">
        <div class="lt"><b>${esc(c.login)}</b><span>${esc(c.role_name || '')}</span></div>
        <button class="btn btn-ghost btn-icon" data-act="collab-remove" data-user="${esc(c.login)}">${icon('x')}</button>
      </div>`).join('') : `<div class="tiny dim" style="padding:12px 16px">${t('pe_empty')}</div>`;
  } catch(e){ box.innerHTML = `<div class="tiny dim" style="padding:12px 16px">${esc(e.message)}</div>`; }
}
async function addCollab(){
  const u = $('#collabIn').value.trim();
  if (!u) return;
  try {
    await gh(`/repos/${state.repo.full_name}/collaborators/${encodeURIComponent(u)}`, { method:'PUT', body: JSON.stringify({ permission:'push' }) });
    toast(t('pe_added'));
    $('#collabIn').value = '';
    loadCollabs();
  } catch(e){ fail(e); }
}
async function removeCollab(u){
  const ok = await confirmBox({ title:'Remove collaborator?', body:`<b>${esc(u)}</b>`, danger:true });
  if (!ok) return;
  try { await gh(`/repos/${state.repo.full_name}/collaborators/${encodeURIComponent(u)}`, { method:'DELETE' }); toast(t('pe_removed')); loadCollabs(); } catch(e){ fail(e); }
}
async function applyVisibility(){
  const want = $('#visModes .mode-card.on').dataset.vis;
  if ((want === 'private') === state.repo.private) return;
  if (want === 'public'){
    const ok = await confirmBox({ title:t('vis_confirm_t'), body:t('vis_confirm_s'), label:t('vis_apply') });
    if (!ok) return;
  }
  try {
    state.repo = await gh(`/repos/${state.repo.full_name}`, { method:'PATCH', body: JSON.stringify({ private: want === 'private' }) });
    toast(t('vis_done'));
    state.repos = await ghAll('/user/repos?sort=updated');
    renderTopbar(); renderRepo();
  } catch(e){ toast(t('vis_err') + ': ' + e.message, 'bad'); }
}
async function saveRepoSettings(){
  const oldFull = state.repo.full_name;
  const newName = $('#rsName').value.trim();
  try {
    const patch = { description: $('#rsDesc').value, homepage: $('#rsHome').value };
    if (newName && newName !== state.repo.name) patch.name = newName;
    if ($('#rsDefault').value !== state.repo.default_branch) patch.default_branch = $('#rsDefault').value;
    state.repo = await gh(`/repos/${oldFull}`, { method:'PATCH', body: JSON.stringify(patch) });
    await gh(`/repos/${state.repo.full_name}/topics`, { method:'PUT', body: JSON.stringify({ names: state._topics || [] }) });
    toast(t('rs_saved'));
    state.repos = await ghAll('/user/repos?sort=updated');
    if (state.repo.full_name !== oldFull){ state.branches = await ghAll(`/repos/${state.repo.full_name}/branches`); }
    renderTopbar(); renderRepo();
  } catch(e){ fail(e); }
}
async function delRepoFlow(full){
  const ok = await confirmBox({ title: t('rs_delete_title'), body: `<b>${esc(full)}</b> ${t('rs_delete_s')}`, label: t('rs_delete'), danger: true, requireText: full });
  if (!ok) return;
  try {
    await gh(`/repos/${full}`, { method:'DELETE' });
    toast(t('ts_repo_deleted'));
    state.repos = await ghAll('/user/repos?sort=updated');
    go('repos');
  } catch(e){ fail(e); }
}
