// Server-side secret scanner (same rules as the client one; single source of truth for the API).
export const SENSITIVE_FN = [/^\.env(\..+)?$/i, /credentials\.json$/i, /serviceaccount.*\.json$/i, /id_rsa$/i, /id_ed25519$/i, /\.pem$/i, /\.pfx$/i, /\.p12$/i, /secrets?\.ya?ml$/i, /secrets?\.json$/i];
export const NEVER_PUSH = [/^\.env(\.local)?$/i, /^\.env\.production$/i, /\.pem$/i, /id_rsa$/i, /id_ed25519$/i, /credentials\.json$/i, /serviceaccount.*\.json$/i];
export const SECRET_PATTERNS = [
  { name: 'AWS Access Key ID', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'AWS Secret Key', re: /aws(.{0,20})?(secret|access)?[_-]?key['"]?\s*[:=]\s*['"][A-Za-z0-9\/+=]{40}['"]/gi },
  { name: 'GitHub Token', re: /gh[pousr]_[A-Za-z0-9]{36,255}/g },
  { name: 'GitHub Fine-grained Token', re: /github_pat_[A-Za-z0-9_]{22,255}/g },
  { name: 'Slack Token', re: /xox[baprs]-[A-Za-z0-9-]{10,72}/g },
  { name: 'Stripe Key', re: /sk_(live|test)_[A-Za-z0-9]{16,64}/g },
  { name: 'OpenAI/Anthropic-style Key', re: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'Google API Key', re: /AIza[0-9A-Za-z\-_]{35}/g },
  { name: 'Private Key Block', re: /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { name: 'Generic API Key/Password', re: /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9_\-\/+=]{16,}['"]/gi },
  { name: 'JWT', re: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g }
];

export function scanText(path, text) {
  const base = path.split('/').pop();
  const locked = NEVER_PUSH.some(re => re.test(base));
  if (SENSITIVE_FN.some(re => re.test(base))) {
    return { path, severity: 'high', locked, matches: [{ line: 1, name: 'Filename matches secrets-file profile' }] };
  }
  if (!text || text.includes('\0') || text.length > 2_000_000) return null;
  const matches = [];
  for (const p of SECRET_PATTERNS) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(text))) {
      matches.push({ line: text.slice(0, m.index).split('\n').length, name: p.name });
      if (matches.length > 40) break;
    }
  }
  if (!matches.length) return null;
  return { path, severity: matches.some(x => /Private Key|AWS/.test(x.name)) ? 'high' : 'medium', locked, matches };
}
