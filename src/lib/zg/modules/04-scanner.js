/* == scanner == */
const SENSITIVE_FN = [/^\.env(\..+)?$/i,/credentials\.json$/i,/serviceaccount.*\.json$/i,/id_rsa$/i,/id_ed25519$/i,/\.pem$/i,/\.pfx$/i,/\.p12$/i,/secrets?\.ya?ml$/i,/secrets?\.json$/i];
/* files that can NEVER be included without an explicit per-file acknowledgement */
const NEVER_PUSH = [/^\.env(\.local)?$/i, /^\.env\.production$/i, /\.pem$/i, /id_rsa$/i, /id_ed25519$/i, /credentials\.json$/i, /serviceaccount.*\.json$/i];
const SECRET_PATTERNS = [
  { name:'AWS Access Key ID', re:/AKIA[0-9A-Z]{16}/g },
  { name:'AWS Secret Key', re:/aws(.{0,20})?(secret|access)?[_-]?key['"]?\s*[:=]\s*['"][A-Za-z0-9\/+=]{40}['"]/gi },
  { name:'GitHub Token', re:/gh[pousr]_[A-Za-z0-9]{36,255}/g },
  { name:'GitHub Fine-grained Token', re:/github_pat_[A-Za-z0-9_]{22,255}/g },
  { name:'Slack Token', re:/xox[baprs]-[A-Za-z0-9-]{10,72}/g },
  { name:'Stripe Key', re:/sk_(live|test)_[A-Za-z0-9]{16,64}/g },
  { name:'OpenAI/Anthropic-style Key', re:/sk-[A-Za-z0-9]{20,}/g },
  { name:'Google API Key', re:/AIza[0-9A-Za-z\-_]{35}/g },
  { name:'Private Key Block', re:/-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { name:'Generic API Key/Password', re:/(api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9_\-\/+=]{16,}['"]/gi },
  { name:'JWT', re:/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g }
];
const RISKY_PATTERNS = [
  { name:'eval()', re:/\beval\s*\(/g },
  { name:'innerHTML =', re:/\.innerHTML\s*=/g },
  { name:'dangerouslySetInnerHTML', re:/dangerouslySetInnerHTML/g },
  { name:'chmod 777', re:/chmod\s+777/g },
  { name:'document.write', re:/document\.write\s*\(/g },
  { name:'new Function()', re:/new\s+Function\s*\(/g },
  { name:'key in URL', re:/https?:\/\/[^/\s]*[:?][^/\s]*(gh[pousr]_|github_pat_|sk_live_)[A-Za-z0-9_-]+/g }
];
const BIN_EXT = new Set(['png','jpg','jpeg','gif','webp','ico','pdf','zip','tar','gz','7z','woff','woff2','ttf','eot','mp4','mp3','mov','exe','dll','so','dylib','bin','wasm','class','jar']);
function scanFiles(files){
  const td = new TextDecoder('utf-8', { fatal:false });
  const findings = [];
  for (const f of files){
    const base = f.path.split('/').pop();
    const locked = NEVER_PUSH.some(re => re.test(base));
    if (SENSITIVE_FN.some(re => re.test(base))){
      findings.push({ path:f.path, severity:'high', locked, excluded:!isAllowed(f.path),
        matches:[{ line:1, name:'Filename matches secrets-file profile' }] });
      continue;
    }
    const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
    if (BIN_EXT.has(ext) || f.size > 2_000_000) continue;
    let text; try { text = td.decode(f.u8); } catch(e){ continue; }
    if (text.includes('\0')) continue;
    const lines = text.split('\n');
    const matches = [];
    for (const p of SECRET_PATTERNS){
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(text))){
        const line = text.slice(0, m.index).split('\n').length;
        matches.push({ line, name: p.name, sample: m[0].slice(0, 12) + '…' });
        if (matches.length > 40) break;
      }
    }
    if (!matches.length) continue;
    findings.push({ path:f.path, severity: matches.some(x=>/Private Key|AWS/.test(x.name))?'high':'medium',
      locked, excluded: !isAllowed(f.path), matches, _lines: lines });
  }
  return findings.sort((a,b) => a.severity==='high' ? -1 : 1);
}
/* risky code patterns for the review preview */
function scanRisky(files){
  const td = new TextDecoder('utf-8', { fatal:false });
  const out = [];
  for (const f of files){
    const ext = f.path.split('/').pop().split('.').pop().toLowerCase();
    if (BIN_EXT.has(ext) || f.size > 1_000_000) continue;
    let text; try { text = td.decode(f.u8); } catch(e){ continue; }
    if (text.includes('\0')) continue;
    const hits = [];
    for (const p of RISKY_PATTERNS){
      p.re.lastIndex = 0;
      if (p.re.test(text)) hits.push(p.name);
    }
    if (hits.length) out.push({ path: f.path, hits });
  }
  return out;
}
/* per-repo allowlist (localStorage, not global) */
function allowKey(){ return 'z2g_allow_' + (state.repo ? state.repo.full_name : '_'); }
function isAllowed(path){
  try { const l = JSON.parse(localStorage.getItem(allowKey()) || '[]'); return l.includes(path); } catch(e){ return false; }
}
function allowForRepo(path){
  try {
    const l = JSON.parse(localStorage.getItem(allowKey()) || '[]');
    if (!l.includes(path)) l.push(path);
    localStorage.setItem(allowKey(), JSON.stringify(l));
  } catch(e){}
}
/* mask matched secrets inside file content (replace value with ***) */
function maskFinding(pending, finding){
  const f = pending.files.find(x => x.path === finding.path);
  if (!f || !finding._lines) return false;
  let text = finding._lines.join('\n');
  for (const p of SECRET_PATTERNS){
    p.re.lastIndex = 0;
    text = text.replace(p.re, m => m.slice(0, 4) + '***MASKED***');
  }
  f.u8 = new TextEncoder().encode(text);
  f.size = f.u8.length;
  finding.excluded = false;
  return true;
}
/* generate .env.example content from a .env file */
function envExampleFrom(f){
  const td = new TextDecoder('utf-8', { fatal:false });
  let text; try { text = td.decode(f.u8); } catch(e){ return ''; }
  return text.split('\n').map(line => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*=/);
    if (!m) return line.trim().startsWith('#') ? line : '';
    return m[1] + '=';
  }).filter(l => l !== '').join('\n') + '\n';
}
