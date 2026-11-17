// Settings you are expected to change. Nothing else needs editing to launch.
window.CRC_CONFIG = {
  // Working title shown in the page header and browser tab.
  appName: 'Card Rules Calculator',

  // Waitlist sign-ups go to a Supabase table (set it up with
  // supabase/waitlist.sql, steps in README.md). While these are empty the
  // form is switched off and shows a setup notice, so no sign-up is lost.
  waitlist: {
    // Project URL, e.g. 'https://abcdefghijkl.supabase.co'
    supabaseUrl: 'https://kfwvnbalmbxgpnvdfwdo.supabase.co',
    // PUBLISHABLE key only (starts with sb_publishable_). It is safe in this
    // public file because the table only allows adding rows. Never paste a
    // secret key (sb_secret_...) here: this file is visible to everyone.
    publishableKey: 'sb_publishable_ruGH-S6RpC-JAelTWhY_iQ_338UHY7j',
    table: 'waitlist'
  },

  // Shown to visitors next to the reward rates. Update it whenever you
  // re-check js/cards.js against the issuers' pages.
  ratesChecked: '17 November 2026'
};
