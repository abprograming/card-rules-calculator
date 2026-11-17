// Run with: node test/waitlist.test.js
const assert = require('assert');
const W = require('../js/waitlist.js');

const good = { supabaseUrl: 'https://abcdefghijkl.supabase.co', publishableKey: 'sb_publishable_example', table: 'waitlist' };
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };

test('empty settings are reported as setup needed', () => {
  assert.match(W.configProblem({ supabaseUrl: '', publishableKey: '' }), /not connected/);
  assert.match(W.configProblem(undefined), /not connected/);
});

test('a secret key is refused', () => {
  assert.match(W.configProblem({ ...good, publishableKey: 'sb_secret_abc' }), /secret key/);
});

test('a wrong-looking project address is refused', () => {
  assert.match(W.configProblem({ ...good, supabaseUrl: 'http://example.com' }), /should look like/);
});

test('good settings pass', () => {
  assert.strictEqual(W.configProblem(good), null);
  assert.strictEqual(W.configProblem({ ...good, supabaseUrl: good.supabaseUrl + '/' }), null);
});

test('email validation', () => {
  assert.ok(W.validEmail(' person@example.com '));
  assert.ok(!W.validEmail('person@example'));
  assert.ok(!W.validEmail('two words@example.com'));
  assert.ok(!W.validEmail(''));
});

test('request goes to the table with the key in the apikey header only', () => {
  const { url, options } = W.buildRequest({ ...good, supabaseUrl: good.supabaseUrl + '/' }, { email: ' Person@Example.com ', wouldPay: '72' });
  assert.strictEqual(url, 'https://abcdefghijkl.supabase.co/rest/v1/waitlist');
  assert.strictEqual(options.method, 'POST');
  assert.strictEqual(options.headers.apikey, 'sb_publishable_example');
  assert.strictEqual(options.headers.Authorization, undefined);
  assert.strictEqual(options.headers.Prefer, 'return=minimal');
  assert.deepStrictEqual(JSON.parse(options.body), {
    email: 'person@example.com', would_pay_per_year: 72, source: 'calculator', consent_text: W.CONSENT_TEXT
  });
});

test('no price answer is sent as null', () => {
  const body = JSON.parse(W.buildRequest(good, { email: 'a@b.co', wouldPay: '' }).options.body);
  assert.strictEqual(body.would_pay_per_year, null);
  assert.strictEqual(JSON.parse(W.buildRequest(good, { email: 'a@b.co', wouldPay: '0' }).options.body).would_pay_per_year, 0);
});

test('consent text fits the table limit', () => {
  assert.ok(W.CONSENT_TEXT.length >= 10 && W.CONSENT_TEXT.length <= 300);
});

test('a duplicate email looks the same as a new sign-up', () => {
  assert.strictEqual(W.outcome(201), 'joined');
  assert.strictEqual(W.outcome(409), 'joined');
  assert.strictEqual(W.outcome(401), 'failed');
  assert.strictEqual(W.outcome(540), 'failed');
});

console.log(`\n${passed} tests passed`);
