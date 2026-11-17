# Card Rules Calculator

A free, single-page web calculator: a visitor ticks the credit cards they hold, enters monthly spending and their own rules, and sees which card to use for each kind of spending and how much more that earns than their current habit.

It is the phase 1 validation tool from the business plan. Everything runs in the visitor's browser. Nothing they enter is sent anywhere, except the waitlist form once you connect it.

## Run it locally

```bash
python -m http.server 5173
```

Then open http://localhost:5173. There is no build step and nothing to install.

## Before you share it

1. **Connect the waitlist.** Sign-ups are stored in a Supabase table. Follow "Connect the waitlist to Supabase" below. Until you do, the form is switched off and shows a setup notice.
2. **Re-check the reward rates.** `js/cards.js` holds 18 cards. The rates were checked on 17 November 2026; four American Express cards could only be checked against reviews, not the issuer's own pages. Update the file and `ratesChecked` in `js/config.js` whenever you re-check.
3. **Pick a name.** `appName` in `js/config.js` is a working title.
4. **Read the footer.** It says the site earns nothing from the cards shown. Change that sentence before adding any referral links.

## Connect the waitlist to Supabase

The page writes each sign-up straight into a Postgres table in your Supabase project. The table accepts new rows from the public and nothing else, so the key in this public repository can add a sign-up but cannot read the list.

1. Create a Supabase account and a new project. The free plan is enough to start.
2. In the dashboard, open the SQL Editor, paste the contents of `supabase/waitlist.sql` and run it.
3. In the project's API settings, copy the **Project URL** and the **publishable key** (it starts with `sb_publishable_`). Menu names in the dashboard may differ slightly.
4. Put both in `.env` (copy `.env.example` if `.env` does not exist), run `node scripts/apply-env.js` to copy them into `js/config.js`, then commit and push.
5. Sign up once on the live page and check that the row appears in the Table Editor.

Never put a secret key (`sb_secret_...`) in `js/config.js`. The file is public. The page refuses to run the form if it sees one.

### Where keys live

| Value | Where it goes | Why |
| --- | --- | --- |
| Project URL, publishable key | `.env`, then copied into `js/config.js` | The browser needs them to send a sign-up, so they are public by design. The table's rules are what protect the data |
| Secret key, database password | `.env` only | They can read and delete everything. The website never uses them |

`.env` is ignored by git. `.env.example` is the public template and holds placeholders only.

A check runs before every commit and blocks it if a file about to be published contains a secret key, a `service_role` key, a private key block or a database address with a password. Turn it on once per copy of the repository:

```bash
git config core.hooksPath .githooks
```

Run the same check by hand with `node test/no-secrets.test.js`.

**What each sign-up stores:** email, the optional "what would you pay" answer, the source (`calculator`), the consent wording the person saw, and the time.

**Exporting:** in the Table Editor, open `waitlist` and export to CSV. Email providers import CSV, and the `consent_text` and `created_at` columns are your record of opt-in.

**Limits to know about:**

- Supabase pauses free-plan projects after 7 days of low activity. While paused, sign-ups fail and visitors see an error. Restore it from the dashboard, or move to a paid plan, which is not paused.
- The form has a hidden spam-trap field that stops simple bots. Anyone determined can still post junk rows directly, so expect to clean the list before importing it.
- The same email cannot be added twice. A repeat sign-up shows the same success message, so the form never reveals who is on the list.

## Put it online

The folder is a ready-to-publish static site: `index.html` is the entry point, and `.nojekyll` tells GitHub Pages to serve the files as they are. Any static host works (GitHub Pages, Netlify, Cloudflare Pages).

To publish on GitHub Pages with the GitHub CLI, from this folder:

```bash
gh repo create card-rules-calculator --public --source=. --push
```

```bash
gh api -X POST "repos/{owner}/{repo}/pages" -f "source[branch]=main" -f "source[path]=/"
```

The first command creates a public repository and uploads the code. The second turns on GitHub Pages; the site appears at `https://<your-username>.github.io/card-rules-calculator/` a minute or two later. On a free GitHub account the repository must be public for Pages to work, so the source code is visible to anyone.

After that, publish each change with `git push`.

## What the rules do

| Rule | Effect |
| --- | --- |
| Share ceiling | No card takes more than the set share of total monthly spending |
| Credit-limit ceiling | A card's monthly spending stays under a share of the credit limit you enter for it |
| Welcome bonus first | The bonus card gets enough spending each month to reach the target in time, taken from wherever it costs least |

The solver finds the split that earns the most while keeping every rule. If the rules conflict, or leave spending with no card to go on, the page says so instead of hiding it.

## What it leaves out

- Travel-portal rates, rotating quarterly categories and first-year promotions.
- Annual fees are shown per card but not subtracted from the headline number.
- "Flights and hotels" is one category, although some cards (Amex Gold, Amex Platinum) pay the bonus on flights only. The page notes this when those cards are ticked.
- Monthly figures are a steady-state average: a yearly cap of $6,000 is treated as $500 a month.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | The page |
| `js/config.js` | Name, waitlist address, date the rates were checked |
| `js/cards.js` | Categories and card reward rates |
| `js/solver.js` | Finds the best split of spending under the rules |
| `js/waitlist.js` | Builds and checks the waitlist sign-up request |
| `js/app.js` | Form handling and rendering |
| `supabase/waitlist.sql` | Creates the waitlist table and its access rules |
| `test/solver.test.js`, `test/waitlist.test.js` | Tests |

## Tests

```bash
node test/solver.test.js
```

```bash
node test/waitlist.test.js
```
