/* == ui == */
function toast(msg, type='ok'){
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = icon(type==='ok'?'check':type==='warn'?'warn':'x') + '<div>' + esc(msg) + '</div>';
  $('#toastRoot').appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(), 320); }, 4200);
}
function fail(e){
  console.error(redact(e.message || e));
  let m = redact(e.message) || 'Error';
  if (e.status === 401) m = t('er_401');
  else if (e.status === 404) m = t('er_404') + (e.message ? ' · ' + redact(e.message) : '');
  else if (e.status === 403 && /secondary rate limit/i.test(m)) m = t('er_secondary');
  else if (e.status === 403) m = t('er_403') + ' · ' + m;
  toast(m, 'bad');
}
function openModal(html, wide=false){
  $('#modalRoot').innerHTML = `<div class="overlay" data-act="overlay-click"><div class="modal${wide?' wide':''}">${html}</div></div>`;
  return $('#modalRoot .modal');
}
function closeModal(){ $('#modalRoot').innerHTML = ''; }
function confirmBox({ title, body, label, danger=false, requireText='' }){
  label = label || (danger ? t('c_delete') : t('c_confirm'));
  return new Promise(resolve => {
    const m = openModal(`
      <div class="m-head"><h3>${esc(title)}</h3><button class="btn btn-ghost btn-icon" data-act="modal-close">${icon('x')}</button></div>
      <div class="m-body"><p class="muted small" style="line-height:1.6">${body}</p>
        ${requireText ? `<label class="lbl" style="margin-top:14px">${t('c_confirm')}: <b class="mono" style="color:var(--text)">${esc(requireText)}</b></label><input class="field" id="cfmInput" autocomplete="off">` : ''}
      </div>
      <div class="m-foot"><button class="btn" data-act="modal-close">${t('c_cancel')}</button>
      <button class="btn ${danger?'btn-danger':'btn-primary'}" id="cfmYes" ${requireText?'disabled':''}>${esc(label)}</button></div>`);
    const inp = m.querySelector('#cfmInput'); const yes = m.querySelector('#cfmYes');
    if (inp) inp.addEventListener('input', () => yes.disabled = inp.value.trim() !== requireText);
    yes.addEventListener('click', () => { closeModal(); resolve(true); });
    m.parentElement.addEventListener('click', ev => {
      if (ev.target === m.parentElement || ev.target.closest('[data-act="modal-close"]')){ closeModal(); resolve(false); }
    });
  });
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* == charts == */
function eventsByDay(events, days){
  const map = new Map();
  const now = new Date(); now.setHours(0,0,0,0);
  for (const e of events || []){
    const d = new Date(e.created_at); d.setHours(0,0,0,0);
    const k = +d;
    map.set(k, (map.get(k)||0) + (e.type==='PushEvent' ? Math.min(e.payload?.commits?.length||1, 5) : 1));
  }
  const out = [];
  for (let i = days-1; i >= 0; i--){
    const d = new Date(+now - i*86400000);
    out.push({ date: d, count: map.get(+d) || 0 });
  }
  return out;
}
function heatmapHTML(days){
  const data = eventsByDay(state.events, days);
  const max = Math.max(1, ...data.map(d => d.count));
  const lvl = c => c===0?0 : c<=max*0.25?1 : c<=max*0.5?2 : c<=max*0.75?3 : 4;
  // pad to full weeks (Sunday start)
  const first = data[0].date.getDay();
  let cells = '';
  for (let i=0;i<first;i++) cells += '<i style="visibility:hidden"></i>';
  let months = ''; let lastMonth = -1;
  data.forEach(d => {
    if (d.date.getDate() <= 7 && d.date.getMonth() !== lastMonth){
      lastMonth = d.date.getMonth();
      months += `<span style="min-width:${(11+3)*4}px">${d.date.toLocaleDateString(state.lang==='ru'?'ru-RU':'en-US',{month:'short'})}</span>`;
    }
    cells += `<i class="l${lvl(d.count)}" title="${d.count} · ${d.date.toLocaleDateString()}"></i>`;
  });
  return `<div class="hm-wrap"><div class="hm-months">${months}</div><div class="hm">${cells}</div>
    <div class="hm-legend">${t('ov_less')} <i style="background:var(--hm0)"></i><i style="background:var(--hm1)"></i><i style="background:var(--hm2)"></i><i style="background:var(--hm3)"></i><i style="background:var(--hm4)"></i> ${t('ov_more')}</div></div>`;
}
function sparkHTML(series, color='var(--acc)'){
  const w = 220, h = 44, max = Math.max(1, ...series);
  const pts = series.map((v,i) => `${(i/(series.length-1||1))*w},${h-3-(v/max)*(h-8)}`).join(' ');
  const last = series[series.length-1] ?? 0;
  const lx = w, ly = h-3-(last/max)*(h-8);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>
    <circle cx="${lx}" cy="${ly}" r="2.6" fill="${color}"/></svg>`;
}
