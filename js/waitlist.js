/*
 * Waitlist sign-up, sent straight to a Supabase table from the browser.
 *
 * The table accepts inserts only (see supabase/waitlist.sql), so the public
 * key in js/config.js can add a sign-up but can never read the list.
 *
 * Plain script in the browser (window.CRCWaitlist), require() in Node tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CRCWaitlist = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Shown on the form and stored with every sign-up, so the stored consent is
  // always the wording the person saw. Changing it only affects new sign-ups.
  var CONSENT_TEXT = 'By joining, you agree to get one email when the app is ready. Your email and answer are stored for that purpose only and are never shared.';

  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  // Returns null when the settings are usable, or a message saying what to fix.
  function configProblem(cfg) {
    if (!cfg || !cfg.supabaseUrl || !cfg.publishableKey) {
      return 'Setup needed: the waitlist is not connected yet. Add your Supabase project address and publishable key in js/config.js.';
    }
    if (/^sb_secret_/.test(cfg.publishableKey) || /service_role/.test(cfg.publishableKey)) {
      return 'Setup needed: js/config.js holds a secret key. Replace it with the publishable key and rotate the secret key in Supabase.';
    }
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.supabaseUrl)) {
      return 'Setup needed: the Supabase address in js/config.js should look like https://your-project.supabase.co';
    }
    return null;
  }

  function validEmail(email) {
    var e = String(email || '').trim();
    return e.length >= 5 && e.length <= 254 && EMAIL.test(e);
  }

  // The request that adds one sign-up. Supabase wants the publishable key in
  // the `apikey` header (not Authorization), and `return=minimal` because the
  // public role is not allowed to read the row back.
  function buildRequest(cfg, fields) {
    var price = fields.wouldPay === '' || fields.wouldPay == null ? null : Number(fields.wouldPay);
    return {
      url: cfg.supabaseUrl.replace(/\/+$/, '') + '/rest/v1/' + encodeURIComponent(cfg.table || 'waitlist'),
      options: {
        method: 'POST',
        headers: {
          'apikey': cfg.publishableKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          email: String(fields.email).trim().toLowerCase(),
          would_pay_per_year: price,
          source: 'calculator',
          consent_text: CONSENT_TEXT
        })
      }
    };
  }

  // 201 = added. 409 = that email is already on the list, which is reported
  // the same way so the form never reveals who has signed up.
  function outcome(status) {
    return status === 201 || status === 409 ? 'joined' : 'failed';
  }

  return { CONSENT_TEXT: CONSENT_TEXT, configProblem: configProblem, validEmail: validEmail, buildRequest: buildRequest, outcome: outcome };
});
