/* == util == */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fmtBytes(n){ if(n==null) return ''; if(n<1024) return n+' B'; if(n<1048576) return (n/1024).toFixed(1)+' KB'; if(n<1073741824) return (n/1048576).toFixed(1)+' MB'; return (n/1073741824).toFixed(2)+' GB'; }
function relTime(iso){ const d=(Date.now()-new Date(iso).getTime())/1000; if(d<60) return t('time_now'); if(d<3600) return Math.floor(d/60)+' '+t('time_min'); if(d<86400) return Math.floor(d/3600)+' '+t('time_h'); if(d<2592000) return Math.floor(d/86400)+' '+t('time_d'); return new Date(iso).toLocaleDateString(state.lang==='ru'?'ru-RU':'en-US',{day:'numeric',month:'short',year:'numeric'}); }
function b64(u8){ let s=''; for(let i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000)); return btoa(s); }
function fromB64(s){ const bin=atob(s); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LANG_COLORS={JavaScript:'#f1e05a',TypeScript:'#3178c6',Python:'#3572A5',HTML:'#e34c26',CSS:'#663399',SCSS:'#c6538c',Java:'#b07219',Go:'#00ADD8',Rust:'#dea584',C:'#555555','C++':'#f34b7d',CSharp:'#178600',Ruby:'#701516',PHP:'#4F5D95',Shell:'#89e051',Dart:'#00B4AB',Kotlin:'#A97BFF',Swift:'#F05138',Vue:'#41b883',Svelte:'#ff3e00',Jupyter:'#DA5B0B',Dockerfile:'#384d54',Makefile:'#427819',Lua:'#000080'};
const MONACO_LANG={js:'javascript',jsx:'javascript',ts:'typescript',tsx:'typescript',json:'json',md:'markdown',html:'html',htm:'html',css:'css',scss:'scss',less:'less',py:'python',rb:'ruby',go:'go',rs:'rust',java:'java',c:'c',h:'c',cpp:'cpp',hpp:'cpp',cs:'csharp',php:'php',sh:'shell',bash:'shell',yml:'yaml',yaml:'yaml',xml:'xml',sql:'sql',kt:'kotlin',swift:'swift',dart:'dart',vue:'html',toml:'ini',ini:'ini',dockerfile:'dockerfile',lua:'lua',pl:'perl',r:'r'};
const langByPath = p => { const b=p.split('/').pop().toLowerCase(); if(b==='dockerfile') return 'dockerfile'; const e=b.includes('.')?b.split('.').pop():''; return MONACO_LANG[e]||'plaintext'; };

/* icons */
const IC = {
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
  repo:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  gist:'<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
  pulse:'<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  gear:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19"/>',
  upload:'<path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 20h16"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8A2 2 0 0 1 21 9.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  branch:'<circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M6 8.4v7.2"/><path d="M18 8.4A9.4 9.4 0 0 1 8.6 17.8"/>',
  commit:'<circle cx="12" cy="12" r="3.4"/><path d="M2.5 12h6M15.5 12h6"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.7 4 5.7 4 9s-1.5 6.3-4 9c-2.5-2.7-4-5.7-4-9s1.5-6.3 4-9z"/>',
  star:'<path d="m12 3 2.7 5.7 6.3.9-4.6 4.3 1.2 6.1-5.6-3-5.6 3 1.2-6.1L3 9.6l6.3-.9z"/>',
  fork:'<circle cx="6" cy="5" r="2.2"/><circle cx="18" cy="5" r="2.2"/><circle cx="12" cy="19" r="2.2"/><path d="M6 7.2v1.3A3.5 3.5 0 0 0 9.5 12h5A3.5 3.5 0 0 0 18 8.5V7.2"/><path d="M12 12v4.8"/>',
  lock:'<rect x="5" y="11" width="14" height="9.5" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  trash:'<path d="M4 7h16"/><path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2"/><path d="m6 7 .8 12.2A2 2 0 0 0 8.8 21h6.4a2 2 0 0 0 2-1.8L18 7"/>',
  edit:'<path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17z"/><path d="m13.5 6.5 3 3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  x:'<path d="m6 6 12 12M18 6 6 18"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4-4"/>',
  zip:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18"/><path d="M10 13.5h4"/>',
  download:'<path d="M12 4v11"/><path d="m6 10 6 6 6-6"/><path d="M4 20h16"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 3.2"/>',
  ext:'<path d="M14 4h6v6"/><path d="M20 4 10.5 13.5"/><path d="M20 14v5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19V6a1.5 1.5 0 0 1 1.5-1.5H10"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  issue:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>',
  warn:'<path d="M12 3 2.5 20h19z"/><path d="M12 9.5V14"/><circle cx="12" cy="17" r=".4" fill="currentColor"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  pr:'<circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M6 8.4v7.2"/><path d="M13 5h3a2 2 0 0 1 2 2v8.6"/>',
  merge:'<circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="12" r="2.4"/><path d="M6 8.4v7.2"/><path d="M6 8a8 8 0 0 0 9.5 3.6"/>',
  play:'<path d="M7 4.5v15l12-7.5z"/>',
  tag:'<path d="m3 12 9-9h9v9l-9 9z"/><circle cx="16.5" cy="7.5" r="1.4"/>',
  caret:'<path d="m9 6 6 6-6 6"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  people:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.7-3.5 3.4-5.5 6.5-5.5s5.8 2 6.5 5.5"/><circle cx="17" cy="9" r="3"/><path d="M15.5 14.7c2.8.2 5.2 2 5.9 5.3"/>',
  eye2:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/><path d="M12 5v-2"/>',
  spinner:'<path d="M21 12a9 9 0 1 1-9-9"/>',
  book:'<path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z"/><path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/>',
  back:'<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
  gh:'<path class="ic-f" d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12c0 4.6 3 8.6 7.2 10 .5.1.7-.2.7-.5v-1.8c-2.9.6-3.6-1.3-3.6-1.3-.5-1.2-1.2-1.5-1.2-1.5-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.3-.3-4.8-1.2-4.8-5.2 0-1.1.4-2 1.1-2.8-.1-.3-.5-1.4.1-2.8 0 0 .9-.3 2.9 1.1a10 10 0 0 1 5.2 0c2-1.4 2.9-1.1 2.9-1.1.6 1.4.2 2.5.1 2.8.7.8 1.1 1.7 1.1 2.8 0 4-2.5 4.9-4.8 5.2.4.3.7 1 .7 2v2.9c0 .3.2.6.7.5a10.5 10.5 0 0 0 7.2-10c0-5.8-4.7-10.5-10.5-10.5z"/>'
};
const icon = (n, cls='ic') => `<svg class="${cls}" viewBox="0 0 24 24">${IC[n]||''}</svg>`;

function updateRateChip(){ /* overridden in app module */ }

/* never let a PAT leak into URLs, logs, toasts, commit messages, gists */
const SECRET_RE = /gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{22,255}/g;
const redact = s => String(s ?? '').replace(SECRET_RE, '[REDACTED_TOKEN]');

/* default ignore rules applied to zip/folder sources */
const DEFAULT_IGNORE = ['.git/','node_modules/','dist/','build/','.next/','coverage/','__pycache__/','.venv/','.DS_Store','*.map'];
function isIgnored(path, patterns){
  return (patterns || []).some(raw => {
    const p = String(raw).trim();
    if (!p) return false;
    if (p.startsWith('*.')) return path.toLowerCase().endsWith(p.slice(1).toLowerCase());
    if (p.endsWith('/')){ const seg = p.slice(0,-1); return path === seg || path.startsWith(seg + '/') || path.split('/').includes(seg); }
    const base = path.split('/').pop();
    return path === p || base === p;
  });
}

/* safe storage */
const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k,v); } catch(e){} },
  del(k){ try { localStorage.removeItem(k); } catch(e){} }
};

/* state */
const state = {
  token: '', // memory-only by default; encrypted-at-rest is opt-in
  lang: store.get('z2g_lang') || ((navigator.language||'en').startsWith('ru') ? 'ru' : 'en'),
  user: null, scopes: '', repos: [], view: 'overview',
  repo: null, branches: [], branch: '', path: '', tab: 'files',
  repoQuery: '', repoSort: 'updated',
  pending: null, gists: null, events: null,
  tree: { cache: new Map(), expanded: new Set(), loading: new Set() },
  editor: { path: null, sha: null, dirty: false },
  commitSel: null, prState: 'open', prFiles: null,
  rate: null, pushCtl: null, fileIndex: null, remembered: false, idleTimer: null
};
