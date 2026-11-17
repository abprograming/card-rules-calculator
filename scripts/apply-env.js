/*
 * Copies the two public Supabase values from .env into js/config.js.
 *
 *   node scripts/apply-env.js           write js/config.js
 *   node scripts/apply-env.js --check   report what would happen, change nothing
 *
 * Only SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are ever read. The private
 * values in .env (secret key, database password) are never touched, and a
 * secret key put in the publishable slot by mistake is refused.
 */
const fs = require('fs');
const path = require('path');
const W = require('../js/waitlist.js');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const envPath = args.find(a => !a.startsWith('--')) || path.join(root, '.env');
const configPath = path.join(root, 'js', 'config.js');

function fail(message) {
  console.error('Not applied: ' + message);
  process.exit(1);
}

if (!fs.existsSync(envPath)) fail('no .env file found. Copy .env.example to .env and fill it in.');

const env = {};
fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
});

const cfg = { supabaseUrl: env.SUPABASE_URL || '', publishableKey: env.SUPABASE_PUBLISHABLE_KEY || '' };

if (!cfg.supabaseUrl || !cfg.publishableKey) fail('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must both be filled in .env.');
if (/['"\\\s]/.test(cfg.supabaseUrl + cfg.publishableKey)) fail('the values contain quotes, spaces or backslashes.');
if (env.SUPABASE_SECRET_KEY && cfg.publishableKey === env.SUPABASE_SECRET_KEY) fail('SUPABASE_PUBLISHABLE_KEY holds the same value as SUPABASE_SECRET_KEY.');
const problem = W.configProblem(cfg);
if (/^sb_secret_|service_role/.test(cfg.publishableKey)) fail('SUPABASE_PUBLISHABLE_KEY holds a secret key. Put the publishable key (sb_publishable_...) there.');
if (problem) fail(problem.replace(/^Setup needed: /, '').replace(/js\/config\.js/g, '.env'));

const before = fs.readFileSync(configPath, 'utf8');
let replaced = 0;
const after = before
  .replace(/(supabaseUrl:\s*)'[^']*'/, (_, p) => { replaced++; return p + "'" + cfg.supabaseUrl.replace(/\/+$/, '') + "'"; })
  .replace(/(publishableKey:\s*)'[^']*'/, (_, p) => { replaced++; return p + "'" + cfg.publishableKey + "'"; });
if (replaced !== 2) fail('could not find supabaseUrl and publishableKey in js/config.js.');

const masked = cfg.publishableKey.slice(0, 15) + '…' + cfg.publishableKey.slice(-4);
if (check) {
  console.log('Check passed. Would write to js/config.js:');
} else {
  fs.writeFileSync(configPath, after);
  console.log(after === before ? 'js/config.js already up to date:' : 'Updated js/config.js:');
}
console.log('  supabaseUrl    ' + cfg.supabaseUrl);
console.log('  publishableKey ' + masked);
