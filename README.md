# Card Rules Calculator

A free, single-page web calculator: a visitor ticks the credit cards they hold, enters monthly spending and their own rules, and sees which card to use for each kind of spending and how much more that earns than their current habit.

It is the phase 1 validation tool from the business plan. Everything runs in the visitor's browser. Nothing they enter is sent anywhere, except the waitlist form once you connect it.

## Run it locally

```bash
python -m http.server 5173
```

Then open http://localhost:5173. There is no build step and nothing to install.

## Before you share it

1. **Connect the waitlist.** Open `js/config.js` and set `waitlistEndpoint` to the address of a form service that accepts a JSON `POST` (Formspree and similar services do). Until you do, the form is switched off and shows a setup notice. Each sign-up sends `email`, `would_pay_per_year` and `source`.
2. **Re-check the reward rates.** `js/cards.js` holds 18 cards. The rates were checked on 17 November 2026; four American Express cards could only be checked against reviews, not the issuer's own pages. Update the file and `ratesChecked` in `js/config.js` whenever you re-check.
3. **Pick a name.** `appName` in `js/config.js` is a working title.
4. **Read the footer.** It says the site earns nothing from the cards shown. Change that sentence before adding any referral links.

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
| `js/app.js` | Form handling and rendering |
| `test/solver.test.js` | Solver tests |

## Tests

```bash
node test/solver.test.js
```
