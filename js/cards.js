/*
 * Card and category data for the calculator.
 *
 * Reward rates change. Re-check this file against each issuer's page before
 * you promote the calculator, and update `ratesChecked` in js/config.js.
 *
 * Card fields
 *   id        unique, never reuse (saved wallets refer to it)
 *   fee       annual fee in dollars
 *   currency  'cash', or the name of a points programme (its value per point
 *             is set by the visitor, default 1 cent)
 *   base      rate on everything not listed in `rates`
 *   rates     per category: a number, or {rate, cap, per} where the bonus rate
 *             applies to the first `cap` dollars per 'year' | 'quarter' | 'month'
 *             and the base rate after that
 *   choice    one category from the list earns `rate` up to `cap`, chosen for
 *             whichever category benefits most (top-category cards)
 *   note      shown to the visitor when the card is in their wallet
 *
 * Only rates on ordinary purchases made directly with a merchant are counted.
 * Travel-portal rates, rotating quarterly categories and first-year promotions
 * are left out on purpose.
 */
window.CRC_CATEGORIES = [
  { id: 'groceries', label: 'Groceries', example: 600 },
  { id: 'dining', label: 'Dining', example: 400 },
  { id: 'gas', label: 'Gas', example: 150 },
  { id: 'flights_hotels', label: 'Flights and hotels', example: 250 },
  { id: 'transit', label: 'Transit and rideshare', example: 80 },
  { id: 'streaming', label: 'Streaming', example: 50 },
  { id: 'drugstores', label: 'Drugstores', example: 40 },
  { id: 'online', label: 'Online shopping', example: 300 },
  { id: 'other', label: 'Everything else', example: 900 }
];

window.CRC_CARDS = [
  { id: 'csp', name: 'Chase Sapphire Preferred', issuer: 'Chase', fee: 95, currency: 'Chase Ultimate Rewards', base: 1,
    rates: { dining: 3, streaming: 3, gas: 3, flights_hotels: 2, transit: 2 },
    note: '3x on online grocery orders is not counted.' },
  { id: 'csr', name: 'Chase Sapphire Reserve', issuer: 'Chase', fee: 795, currency: 'Chase Ultimate Rewards', base: 1,
    rates: { dining: 3, flights_hotels: 4 } },
  { id: 'cfu', name: 'Chase Freedom Unlimited', issuer: 'Chase', fee: 0, currency: 'Chase Ultimate Rewards', base: 1.5,
    rates: { dining: 3, drugstores: 3 } },
  { id: 'cff', name: 'Chase Freedom Flex', issuer: 'Chase', fee: 0, currency: 'Chase Ultimate Rewards', base: 1,
    rates: { dining: 3, drugstores: 3 },
    note: 'Rotating 5% quarterly categories are not counted.' },

  { id: 'amex_gold', name: 'American Express Gold', issuer: 'American Express', fee: 325, currency: 'Amex Membership Rewards', base: 1,
    rates: { dining: { rate: 4, cap: 50000, per: 'year' }, groceries: { rate: 4, cap: 25000, per: 'year' }, flights_hotels: 3 },
    note: 'The 3x travel rate applies to flights booked with the airline, not hotels.' },
  { id: 'amex_plat', name: 'American Express Platinum', issuer: 'American Express', fee: 895, currency: 'Amex Membership Rewards', base: 1,
    rates: { flights_hotels: { rate: 5, cap: 500000, per: 'year' } },
    note: 'The 5x rate applies to flights booked with the airline, not hotels booked directly.' },
  { id: 'bcp', name: 'Blue Cash Preferred', issuer: 'American Express', fee: 95, currency: 'cash', base: 1,
    rates: { groceries: { rate: 6, cap: 6000, per: 'year' }, streaming: 6, transit: 3, gas: 3 },
    note: 'The $95 fee is waived in the first year.' },
  { id: 'bce', name: 'Blue Cash Everyday', issuer: 'American Express', fee: 0, currency: 'cash', base: 1,
    rates: { groceries: { rate: 3, cap: 6000, per: 'year' }, gas: { rate: 3, cap: 6000, per: 'year' }, online: { rate: 3, cap: 6000, per: 'year' } } },

  { id: 'venture_x', name: 'Capital One Venture X', issuer: 'Capital One', fee: 395, currency: 'Capital One miles', base: 2, rates: {} },
  { id: 'savor', name: 'Capital One Savor', issuer: 'Capital One', fee: 0, currency: 'cash', base: 1,
    rates: { dining: 3, groceries: 3, streaming: 3 } },
  { id: 'quicksilver', name: 'Capital One Quicksilver', issuer: 'Capital One', fee: 0, currency: 'cash', base: 1.5, rates: {} },

  { id: 'double_cash', name: 'Citi Double Cash', issuer: 'Citi', fee: 0, currency: 'cash', base: 2, rates: {} },
  { id: 'custom_cash', name: 'Citi Custom Cash', issuer: 'Citi', fee: 0, currency: 'cash', base: 1, rates: {},
    choice: { rate: 5, cap: 500, per: 'month', categories: ['dining', 'gas', 'groceries', 'flights_hotels', 'transit', 'streaming', 'drugstores'] },
    note: '5% applies to your top eligible category each billing cycle, up to $500. Closed to new applicants since May 2026.' },
  { id: 'costco', name: 'Costco Anywhere Visa', issuer: 'Citi', fee: 0, currency: 'cash', base: 1,
    rates: { gas: { rate: 4, cap: 7000, per: 'year' }, dining: 3, flights_hotels: 3 },
    note: 'Requires a Costco membership. Rewards are paid once a year.' },

  { id: 'active_cash', name: 'Wells Fargo Active Cash', issuer: 'Wells Fargo', fee: 0, currency: 'cash', base: 2, rates: {} },
  { id: 'autograph', name: 'Wells Fargo Autograph', issuer: 'Wells Fargo', fee: 0, currency: 'Wells Fargo Rewards', base: 1,
    rates: { dining: 3, gas: 3, flights_hotels: 3, transit: 3, streaming: 3 } },

  { id: 'discover_it', name: 'Discover it Cash Back', issuer: 'Discover', fee: 0, currency: 'cash', base: 1, rates: {},
    note: 'Rotating 5% quarterly categories are not counted.' },
  { id: 'apple', name: 'Apple Card', issuer: 'Apple', fee: 0, currency: 'cash', base: 2, rates: {},
    note: 'Assumes you pay with Apple Pay. The physical card earns 1%.' }
];
