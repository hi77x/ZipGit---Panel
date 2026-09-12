export type SecretSeverity = "critical" | "high" | "medium" | "low" | "info";

export type SecretRule = {
  id: string;
  name: string;
  description: string;
  severity: SecretSeverity;
  pattern: RegExp;
  remediation: string;
  entropyFloor?: number;
};

export type SecretFinding = {
  id: string;
  ruleId: string;
  name: string;
  description: string;
  severity: SecretSeverity;
  path: string;
  line: number;
  column: number;
  match: string;
  masked: string;
  snippet: string;
  remediation: string;
};

export type PublicSecretFinding = Omit<SecretFinding, "match">;

export function toPublicFinding(finding: SecretFinding): PublicSecretFinding {
  return {
    id: finding.id,
    ruleId: finding.ruleId,
    name: finding.name,
    description: finding.description,
    severity: finding.severity,
    path: finding.path,
    line: finding.line,
    column: finding.column,
    masked: finding.masked,
    snippet: finding.snippet,
    remediation: finding.remediation
  };
}

const placeholderPattern = /example|dummy|sample|placeholder|changeme|your[_-]|redacted|xxxx|<[^>]+>|\$\{|process\.env|os\.environ/i;

export const secretRules: SecretRule[] = [
  { id: "aws-access-key", name: "AWS access key ID", description: "An AWS access key ID grants programmatic access to an AWS account.", severity: "critical", pattern: /\b(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/, remediation: "Rotate the key in IAM immediately and load credentials from environment variables or a secrets manager." },
  { id: "aws-secret-key", name: "AWS secret access key", description: "A 40-character AWS secret combined with a key ID allows full API access.", severity: "critical", pattern: /(?:aws[_\s-]?secret[_\s-]?access[_\s-]?key|aws[_\s-]?secret)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})/, remediation: "Rotate the credential in IAM and remove it from the repository history." },
  { id: "github-token", name: "GitHub token", description: "A GitHub personal access token can read or write repositories and workflows.", severity: "critical", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{22,255})\b/, remediation: "Revoke the token in GitHub settings, then create a replacement stored as an encrypted secret." },
  { id: "gitlab-token", name: "GitLab personal access token", description: "A GitLab PAT can access repositories and the API on your behalf.", severity: "critical", pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/, remediation: "Revoke the token in GitLab user settings." },
  { id: "google-api-key", name: "Google API key", description: "A Google API key can consume billed services if it is unrestricted.", severity: "critical", pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/, remediation: "Regenerate the key and apply HTTP referrer or IP restrictions in Google Cloud Console." },
  { id: "openai-key", name: "OpenAI API key", description: "An OpenAI key can spend credits and access models on your account.", severity: "critical", pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]{20,}\b/, remediation: "Revoke the key at platform.openai.com and load it from the environment." },
  { id: "anthropic-key", name: "Anthropic API key", description: "An Anthropic key can spend credits on Claude models.", severity: "critical", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/, remediation: "Revoke the key in the Anthropic console." },
  { id: "stripe-live-key", name: "Stripe live secret key", description: "A live Stripe key can create charges, refunds, and read customer data.", severity: "critical", pattern: /\b(?:sk|rk)_live_[0-9a-zA-Z]{24,}\b/, remediation: "Roll the key in the Stripe dashboard immediately." },
  { id: "npm-token", name: "npm access token", description: "An npm token can publish packages under your account.", severity: "critical", pattern: /\bnpm_[A-Za-z0-9]{36}\b/, remediation: "Revoke the token with `npm token revoke` and publish through trusted CI." },
  { id: "pypi-token", name: "PyPI upload token", description: "A PyPI token can publish or yank releases.", severity: "critical", pattern: /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}\b/, remediation: "Delete the token in PyPI account settings." },
  { id: "sendgrid-key", name: "SendGrid API key", description: "A SendGrid key can send mail as your domain.", severity: "critical", pattern: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{30,}\b/, remediation: "Delete the key in SendGrid and issue a restricted replacement." },
  { id: "digitalocean-token", name: "DigitalOcean token", description: "A DO token can manage droplets and infrastructure.", severity: "critical", pattern: /\bdop_v1_[a-f0-9]{64}\b/, remediation: "Revoke the token in the DigitalOcean control panel." },
  { id: "shopify-token", name: "Shopify access token", description: "A Shopify token can read and modify store data.", severity: "critical", pattern: /\bshpat_[a-fA-F0-9]{32}\b/, remediation: "Uninstall the app or rotate the token in the Shopify admin." },
  { id: "azure-account-key", name: "Azure storage account key", description: "An Azure storage key grants full access to blob, file, and queue data.", severity: "critical", pattern: /AccountKey=([A-Za-z0-9+/=]{80,})/, remediation: "Rotate the storage key in the Azure portal." },
  { id: "private-key", name: "Private key material", description: "Committed private keys allow impersonation of servers, users, or certificate authorities.", severity: "critical", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/, remediation: "Remove the key, rotate the associated certificate or credential, and store keys outside the repository." },
  { id: "slack-token", name: "Slack token", description: "A Slack token can read messages and post as the workspace app.", severity: "high", pattern: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/, remediation: "Revoke the token in the Slack app configuration." },
  { id: "slack-webhook", name: "Slack incoming webhook", description: "Anyone with the URL can post messages into your Slack channels.", severity: "high", pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]{8,}\/[A-Z0-9]{8,}\/[A-Za-z0-9]{20,}/, remediation: "Delete the webhook and create a new one stored as a secret." },
  { id: "discord-webhook", name: "Discord webhook URL", description: "A Discord webhook URL allows posting to a channel without authentication.", severity: "high", pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]{50,}/, remediation: "Delete the webhook in Discord channel settings." },
  { id: "telegram-bot-token", name: "Telegram bot token", description: "A bot token gives full control over the Telegram bot.", severity: "high", pattern: /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/, remediation: "Revoke the token via BotFather." },
  { id: "mailgun-key", name: "Mailgun API key", description: "A Mailgun key can send email and access logs.", severity: "high", pattern: /\bkey-[0-9a-zA-Z]{32}\b/, remediation: "Roll the key in the Mailgun dashboard." },
  { id: "twilio-key", name: "Twilio API key", description: "A Twilio key can send SMS and manage phone numbers.", severity: "high", pattern: /\bSK[0-9a-fA-F]{32}\b/, remediation: "Revoke the key in the Twilio console." },
  { id: "huggingface-token", name: "Hugging Face token", description: "An HF token can access private models and datasets.", severity: "high", pattern: /\bhf_[A-Za-z0-9]{30,}\b/, remediation: "Revoke the token in Hugging Face settings." },
  { id: "square-token", name: "Square access token", description: "A Square token can access payments and customer data.", severity: "high", pattern: /\bsq0atp-[0-9A-Za-z-_]{22,}\b/, remediation: "Rotate the token in the Square developer dashboard." },
  { id: "connection-string", name: "Database connection string with password", description: "A connection string embeds live database credentials.", severity: "high", pattern: /(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|amqp|mssql):\/\/[^:\s/@]+:[^@\s/]{4,}@[^\s"']+/, remediation: "Rotate the database password and inject the connection string from environment variables." },
  { id: "basic-auth-url", name: "Credentials in URL", description: "Embedding credentials in a URL leaks them into logs and history.", severity: "medium", pattern: /https?:\/\/[^\s/:@]+:[^\s/@]{6,}@[^\s/]+/, remediation: "Move credentials out of URLs and rotate them." },
  { id: "jwt", name: "JSON Web Token", description: "A committed JWT may still be valid depending on its expiry and audience.", severity: "medium", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, remediation: "Rotate the signing secret if the token is a long-lived credential." },
  { id: "generic-secret", name: "Secret assignment", description: "A high-entropy value is assigned to a secret-like variable name.", severity: "low", pattern: /(?:api[_-]?key|apikey|auth[_-]?token|access[_-]?token|client[_-]?secret|private[_-]?key|secret[_-]?key|password|passwd|pwd)\s*[:=]\s*["']([^"'\s]{16,})["']/i, remediation: "Confirm the value is not a live credential; if it is, rotate it and move it to an encrypted secret.", entropyFloor: 3.2 }
];

export function shannonEntropy(value: string): number {
  if (!value) return 0;
  const counts = new Map<string, number>();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

export function severityWeight(severity: SecretSeverity): number {
  return { critical: 40, high: 20, medium: 8, low: 3, info: 1 }[severity];
}

export function severityRank(severity: SecretSeverity): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[severity];
}

export function maskValue(value: string): string {
  if (value.length <= 8) return "•".repeat(Math.min(8, value.length));
  return `${value.slice(0, 4)}${"•".repeat(Math.min(12, value.length - 8))}${value.slice(-4)}`;
}

export function scanText(text: string, path: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = text.split(/\r?\n/);
  for (const rule of secretRules) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`);
    lines.forEach((line, index) => {
      if (line.length > 4000) return;
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        const raw = match[1] ?? match[0];
        if (!raw) break;
        if (placeholderPattern.test(raw)) continue;
        if (rule.entropyFloor && shannonEntropy(raw) < rule.entropyFloor) continue;
        const column = (match.index ?? 0) + match[0].indexOf(raw) + 1;
        const masked = maskValue(raw);
        findings.push({
          id: `${rule.id}:${path}:${index + 1}:${column}`,
          ruleId: rule.id,
          name: rule.name,
          description: rule.description,
          severity: rule.severity,
          path,
          line: index + 1,
          column,
          match: raw,
          masked,
          snippet: line.replace(raw, masked).trim().slice(0, 400),
          remediation: rule.remediation
        });
        if (!pattern.global) break;
        if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
      }
    });
  }
  return findings;
}

export function scanFiles(files: Array<{ path: string; content: string }>, options: { maxFileBytes?: number } = {}): SecretFinding[] {
  const maxBytes = options.maxFileBytes ?? 512 * 1024;
  const findings: SecretFinding[] = [];
  for (const file of files) {
    if (file.content.length > maxBytes) continue;
    findings.push(...scanText(file.content, file.path));
  }
  return findings.sort((left, right) => severityRank(left.severity) - severityRank(right.severity) || left.path.localeCompare(right.path) || left.line - right.line);
}

export function summarizeFindings(findings: SecretFinding[]) {
  const bySeverity: Record<SecretSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) bySeverity[finding.severity] += 1;
  const riskScore = Math.min(100, findings.reduce((total, finding) => total + severityWeight(finding.severity), 0));
  const affectedFiles = new Set(findings.map((finding) => finding.path)).size;
  return { total: findings.length, bySeverity, riskScore, affectedFiles };
}
