// Fails if anything that looks like a private key is in a file git would
// publish. Run with: node test/no-secrets.test.js
// It also runs before every commit (see .githooks/pre-commit).
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
// Tracked files plus new files that are not ignored: everything a commit could carry.
const files = execSync('git ls-files --cached --others --exclude-standard', { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean);

const patterns = [
  { name: 'Supabase secret key', re: /sb_secret_[A-Za-z0-9_-]{16,}/ },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'database address with a password', re: /postgres(?:ql)?:\/\/[^:\s'"]+:[^@\s'"]{6,}@/ }
];

// Legacy Supabase keys are JWTs; the dangerous one carries the service_role claim.
function serviceRoleJwt(text) {
  const tokens = text.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) || [];
  return tokens.some(t => {
    try { return /service_role/.test(Buffer.from(t.split('.')[1], 'base64url').toString('utf8')); }
    catch (e) { return false; }
  });
}

const findings = [];
files.forEach(file => {
  const full = path.join(root, file);
  if (!fs.existsSync(full) || fs.statSync(full).size > 2e6) return;
  const text = fs.readFileSync(full, 'utf8');
  if (/^\.env(\..*)?$/.test(path.basename(file)) && file !== '.env.example') findings.push(file + ': an env file is not ignored by git');
  patterns.forEach(p => { if (p.re.test(text)) findings.push(file + ': ' + p.name); });
  if (serviceRoleJwt(text)) findings.push(file + ': Supabase service_role key');
});

if (findings.length) {
  console.error('Private values found in files that would be published:\n  ' + findings.join('\n  '));
  console.error('\nMove them to .env and, if they were ever committed or pushed, rotate them.');
  process.exit(1);
}
console.log('ok  no private keys in ' + files.length + ' publishable files');
