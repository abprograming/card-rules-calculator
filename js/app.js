(function () {
  'use strict';

  var CONFIG = window.CRC_CONFIG;
  var CATEGORIES = window.CRC_CATEGORIES;
  var BUILT_IN = window.CRC_CARDS;
  var STORE_KEY = 'crc-state-v1';
  var COLORS = ['#5b3fd6', '#0b7a53', '#c2410c', '#0369a1', '#a21caf', '#a16207', '#be123c', '#334155'];

  var $ = function (id) { return document.getElementById(id); };
  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var fmt = function (n) { return money.format(Math.round(n)); };
  var pct = function (share) { return Math.round(share * 100) + '%'; };

  // Build an element. Text always goes in as text nodes, never as HTML.
  function h(tag, props) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'style') node.setAttribute('style', v);
      else if (k in node && k !== 'list') node[k] = v;
      else node.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined || child === false) continue;
      (Array.isArray(child) ? child : [child]).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  // ---- state ---------------------------------------------------------------

  function exampleState() {
    var spend = {};
    CATEGORIES.forEach(function (c) { spend[c.id] = c.example; });
    return {
      wallet: ['amex_gold', 'bcp', 'cfu', 'double_cash'],
      custom: [],
      spend: spend,
      everyday: 'cfu',
      rules: {
        shareOn: true, sharePct: 50,
        utilOn: false, utilPct: 30, limits: {},
        bonusOn: false, bonusCard: '', bonusSpend: 4000, bonusMonths: 3, bonusValue: 600
      },
      pointValues: {}
    };
  }

  function loadState() {
    var base = exampleState();
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && Array.isArray(saved.wallet)) {
        base.wallet = saved.wallet;
        base.custom = Array.isArray(saved.custom) ? saved.custom : [];
        Object.keys(base.spend).forEach(function (k) { if (saved.spend && saved.spend[k] != null) base.spend[k] = saved.spend[k]; });
        base.everyday = saved.everyday || '';
        Object.keys(base.rules).forEach(function (k) { if (saved.rules && saved.rules[k] != null) base.rules[k] = saved.rules[k]; });
        base.pointValues = saved.pointValues || {};
      }
    } catch (e) { /* storage unavailable or corrupt: start from the example */ }
    return base;
  }

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* page still works without it */ }
  }

  var state = loadState();

  function allCards() { return BUILT_IN.concat(state.custom); }
  function cardById(id) { return allCards().filter(function (c) { return c.id === id; })[0]; }
  function walletCards() {
    return state.wallet.map(cardById).filter(Boolean);
  }
  function colorOf(id) {
    var i = state.wallet.indexOf(id);
    return COLORS[(i < 0 ? 0 : i) % COLORS.length];
  }
  function rateLabel(card, rate) { return card.currency === 'cash' ? rate + '%' : rate + 'x'; }
  function catLabel(id) { return CATEGORIES.filter(function (c) { return c.id === id; })[0].label; }

  // Drop references to cards that are no longer in the wallet.
  function tidy() {
    state.wallet = state.wallet.filter(cardById);
    if (state.wallet.indexOf(state.everyday) === -1) state.everyday = state.wallet[0] || '';
    if (state.wallet.indexOf(state.rules.bonusCard) === -1) state.rules.bonusCard = state.wallet[0] || '';
  }

  // ---- inputs --------------------------------------------------------------

  function renderCards() {
    var list = $('card-list');
    list.textContent = '';
    var issuers = [];
    BUILT_IN.forEach(function (c) { if (issuers.indexOf(c.issuer) === -1) issuers.push(c.issuer); });

    function row(card, removable) {
      var summary = [rateLabel(card, card.base) + ' base'];
      Object.keys(card.rates || {}).forEach(function (cat) {
        var r = card.rates[cat];
        summary.push(rateLabel(card, typeof r === 'number' ? r : r.rate) + ' ' + catLabel(cat).toLowerCase());
      });
      if (card.choice) summary.push(rateLabel(card, card.choice.rate) + ' top category');
      return h('label', { class: 'card-row' },
        h('input', { type: 'checkbox', checked: state.wallet.indexOf(card.id) !== -1, 'data-card': card.id }),
        h('span', { class: 'card-text' },
          h('span', { class: 'card-name' }, card.name),
          h('span', { class: 'card-rates' }, summary.join(' · ') + (card.fee ? ' · ' + fmt(card.fee) + ' fee' : ''))),
        removable ? h('button', { type: 'button', class: 'remove', 'data-remove': card.id, 'aria-label': 'Remove ' + card.name }, 'Remove') : null);
    }

    issuers.forEach(function (issuer) {
      list.appendChild(h('fieldset', { class: 'issuer' },
        h('legend', {}, issuer),
        BUILT_IN.filter(function (c) { return c.issuer === issuer; }).map(function (c) { return row(c, false); })));
    });
    if (state.custom.length) {
      list.appendChild(h('fieldset', { class: 'issuer' },
        h('legend', {}, 'Added by you'),
        state.custom.map(function (c) { return row(c, true); })));
    }
  }

  function renderSpend() {
    var list = $('spend-list');
    list.textContent = '';
    CATEGORIES.forEach(function (c) {
      list.appendChild(h('label', { class: 'spend-row' },
        h('span', {}, c.label),
        h('span', { class: 'money-input' }, '$',
          h('input', { type: 'number', min: '0', step: '10', inputMode: 'numeric', value: String(state.spend[c.id]), 'data-spend': c.id }))));
    });
    renderSpendTotal();
  }

  function renderSpendTotal() {
    var total = 0;
    CATEGORIES.forEach(function (c) { total += Number(state.spend[c.id]) || 0; });
    $('spend-total').textContent = fmt(total);
  }

  function fillSelect(select, cards, value, emptyText) {
    select.textContent = '';
    if (!cards.length) select.appendChild(h('option', { value: '' }, emptyText));
    cards.forEach(function (c) { select.appendChild(h('option', { value: c.id }, c.name)); });
    select.value = value;
    select.disabled = !cards.length;
  }

  function renderDependents() {
    var cards = walletCards();
    fillSelect($('everyday'), cards, state.everyday, 'Tick a card first');
    fillSelect($('bonus-card'), cards, state.rules.bonusCard, 'Tick a card first');

    var limits = $('limit-list');
    limits.textContent = '';
    cards.forEach(function (c) {
      limits.appendChild(h('label', { class: 'spend-row' },
        h('span', {}, c.name + ' limit'),
        h('span', { class: 'money-input' }, '$',
          h('input', { type: 'number', min: '0', step: '500', inputMode: 'numeric', placeholder: 'no ceiling',
            value: state.rules.limits[c.id] ? String(state.rules.limits[c.id]) : '', 'data-limit': c.id }))));
    });

    var programmes = [];
    cards.forEach(function (c) { if (c.currency !== 'cash' && programmes.indexOf(c.currency) === -1) programmes.push(c.currency); });
    $('values-panel').hidden = !programmes.length;
    var values = $('value-list');
    values.textContent = '';
    programmes.forEach(function (p) {
      values.appendChild(h('label', { class: 'spend-row' },
        h('span', {}, p),
        h('span', { class: 'money-input' },
          h('input', { type: 'number', min: '0', max: '5', step: '0.1', inputMode: 'decimal',
            value: String(state.pointValues[p] != null ? state.pointValues[p] : 1), 'data-value': p }), '¢')));
    });
  }

  function renderRules() {
    var r = state.rules;
    $('share-on').checked = r.shareOn;
    $('share-pct').value = r.sharePct;
    $('share-out').textContent = r.sharePct + '%';
    $('share-body').hidden = !r.shareOn;
    $('util-on').checked = r.utilOn;
    $('util-pct').value = r.utilPct;
    $('util-out').textContent = r.utilPct + '%';
    $('util-body').hidden = !r.utilOn;
    $('bonus-on').checked = r.bonusOn;
    $('bonus-body').hidden = !r.bonusOn;
    $('bonus-spend').value = r.bonusSpend;
    $('bonus-months').value = r.bonusMonths;
    $('bonus-value').value = r.bonusValue;
  }

  // ---- results -------------------------------------------------------------

  function activeRules() {
    var r = state.rules, rules = {};
    if (r.shareOn) rules.sharePct = r.sharePct;
    if (r.utilOn) rules.util = { pct: r.utilPct, limits: r.limits };
    if (r.bonusOn && r.bonusCard && r.bonusSpend > 0 && r.bonusMonths > 0) {
      rules.bonus = { cardId: r.bonusCard, spend: r.bonusSpend, months: r.bonusMonths, value: r.bonusValue };
    }
    return rules;
  }

  function compute() {
    var cards = walletCards();
    var input = { cards: cards, spend: state.spend, pointValues: state.pointValues };
    var everyday = cardById(state.everyday);
    return {
      cards: cards,
      plan: CRCSolver.solve({ cards: cards, spend: state.spend, pointValues: state.pointValues, rules: activeRules() }),
      free: CRCSolver.solve(input),
      today: everyday ? CRCSolver.solve({ cards: [everyday], spend: state.spend, pointValues: state.pointValues }) : null,
      everyday: everyday
    };
  }

  function dot(id) { return h('span', { class: 'dot', style: 'background:' + colorOf(id), 'aria-hidden': 'true' }); }

  function renderResults() {
    var box = $('results');
    box.textContent = '';
    var cards = walletCards();
    var total = 0;
    CATEGORIES.forEach(function (c) { total += Number(state.spend[c.id]) || 0; });

    if (!cards.length) {
      box.appendChild(h('div', { class: 'empty' }, h('p', { class: 'empty-title' }, 'No cards ticked'), h('p', {}, 'Tick at least one card under "Your cards" to see a plan.')));
      return;
    }
    if (total <= 0) {
      box.appendChild(h('div', { class: 'empty' }, h('p', { class: 'empty-title' }, 'No spending entered'), h('p', {}, 'Enter a monthly amount for at least one kind of spending.')));
      return;
    }

    var c = compute();
    var plan = c.plan, rules = activeRules();

    // Headline: what the plan adds over today's habit.
    var head = h('div', { class: 'headline' });
    if (c.today) {
      var gain = plan.annualValue - c.today.annualValue;
      if (gain >= 1) {
        head.appendChild(h('p', { class: 'eyebrow' }, 'Compared with ' + c.everyday.name + ' for everything'));
        head.appendChild(h('p', { class: 'figure' }, h('strong', {}, fmt(gain)), ' more a year'));
      } else {
        head.appendChild(h('p', { class: 'eyebrow' }, 'Compared with ' + c.everyday.name + ' for everything'));
        head.appendChild(h('p', { class: 'figure figure-flat' }, 'This plan earns no more than your current habit'));
      }
      head.appendChild(h('dl', { class: 'compare' },
        h('div', {}, h('dt', {}, 'Today'), h('dd', {}, fmt(c.today.annualValue) + ' a year')),
        h('div', {}, h('dt', {}, 'This plan'), h('dd', {}, fmt(plan.annualValue) + ' a year'))));
    }
    var ruleCost = c.free.annualValue - plan.annualValue;
    if (ruleCost >= 1) {
      head.appendChild(h('p', { class: 'rule-cost' }, 'Your rules cost about ' + fmt(ruleCost) + ' a year compared with chasing the top rate everywhere.'));
    } else if (rules.sharePct != null || rules.util || rules.bonus) {
      head.appendChild(h('p', { class: 'rule-cost' }, 'Your rules cost nothing here: the best split already keeps them.'));
    }
    if (cards.some(function (card) { return card.fee > 0; })) {
      head.appendChild(h('p', { class: 'rule-cost' }, 'Annual fees are not subtracted. You pay them whichever card you use.'));
    }
    box.appendChild(head);

    // Notices that change how the plan should be read.
    var notices = h('div', { class: 'notices' });
    plan.notes.forEach(function (n) {
      var card = n.cardId ? cardById(n.cardId) : null;
      if (n.type === 'unassigned') {
        notices.appendChild(h('p', { class: 'notice notice-warn' }, h('strong', {}, fmt(n.amount) + ' a month has no card. '),
          'Your ceilings leave no room for it. Raise a ceiling or add a card.'));
      } else if (n.type === 'bonus_on_track') {
        notices.appendChild(h('p', { class: 'notice notice-good' }, h('strong', {}, 'Welcome bonus on track. '),
          fmt(n.monthly) + ' a month on ' + card.name + ' reaches the target in ' + n.months + (n.months === 1 ? ' month' : ' months') +
          (rules.bonus.value > 0 ? ', for a one-time ' + fmt(rules.bonus.value) + ' not counted above.' : '.')));
      } else if (n.type === 'bonus_short') {
        notices.appendChild(h('p', { class: 'notice notice-warn' }, h('strong', {}, 'Welcome bonus out of reach. '),
          'The target needs ' + fmt(n.wanted) + ' a month on ' + card.name + ', and your total spending only puts ' + fmt(n.monthly) + ' there.'));
      } else if (n.type === 'bonus_blocked') {
        notices.appendChild(h('p', { class: 'notice notice-warn' }, h('strong', {}, 'Your rules conflict. '),
          'The welcome bonus needs ' + fmt(n.wanted) + ' a month on ' + card.name + ', but its ceiling allows ' + fmt(n.ceiling) + '.'));
      }
    });
    if (notices.childNodes.length) box.appendChild(notices);

    // Signature block: each card's share of the month, against the ceiling.
    var split = h('section', { class: 'block' }, h('h3', {}, 'How the month splits across your cards'));
    var bars = h('div', { class: 'bars' + (rules.sharePct != null ? ' has-ceiling' : ''), style: rules.sharePct != null ? '--ceiling:' + rules.sharePct + '%' : '' });
    plan.byCard.slice().sort(function (a, b) { return b.monthlySpend - a.monthlySpend; }).forEach(function (row) {
      var card = cardById(row.cardId);
      var detail = row.monthlySpend > 0
        ? 'Earns ' + fmt(row.annualValue) + ' a year' + (card.fee ? ', ' + fmt(card.fee) + ' fee' : '')
        : 'Not used in this plan' + (card.fee ? ', ' + fmt(card.fee) + ' fee' : '');
      var flag = card.fee > 0 && row.annualValue < card.fee ? h('span', { class: 'flag' }, 'Earns less than its fee here') : null;
      bars.appendChild(h('div', { class: 'bar-row' + (row.monthlySpend > 0 ? '' : ' is-idle') },
        h('div', { class: 'bar-label' }, h('span', { class: 'bar-name' }, dot(row.cardId), card.name),
          h('span', { class: 'bar-figure' }, fmt(row.monthlySpend) + ' · ' + pct(row.share))),
        h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: 'width:' + (row.share * 100).toFixed(2) + '%;background:' + colorOf(row.cardId) })),
        h('p', { class: 'bar-detail' }, detail, flag ? ' ' : null, flag)));
    });
    if (rules.sharePct != null) bars.appendChild(h('p', { class: 'ceiling-label' }, 'Line marks your ' + rules.sharePct + '% ceiling'));
    split.appendChild(bars);
    box.appendChild(split);

    // The plan itself: card to use for each kind of spending.
    var freeTop = {};
    c.free.byCategory.forEach(function (row) { if (row.parts.length) freeTop[row.cat] = row.parts[0].cardId; });

    var byCat = h('section', { class: 'block' }, h('h3', {}, 'Card to use, by kind of spending'));
    var table = h('div', { class: 'plan' });
    plan.byCategory.forEach(function (row) {
      var yearly = 0;
      row.parts.forEach(function (p) { yearly += p.amount * p.units * 12 / 10000; });
      var moved = row.parts.length && freeTop[row.cat] && row.parts[0].cardId !== freeTop[row.cat];
      var parts = row.parts.map(function (p) {
        var card = cardById(p.cardId);
        var split = row.parts.length > 1 || row.unassigned > 0;
        return h('li', {}, dot(p.cardId), h('span', { class: 'use-card' }, card.name), ' ',
          h('span', { class: 'use-rate' }, rateLabel(card, p.rate)),
          split ? h('span', { class: 'use-amount' }, ' for ' + fmt(p.amount) + ' a month') : null);
      });
      if (row.unassigned > 0) parts.push(h('li', { class: 'use-none' }, 'No card has room for ' + fmt(row.unassigned) + ' a month'));
      table.appendChild(h('div', { class: 'plan-row' },
        h('div', { class: 'plan-cat' }, h('span', { class: 'plan-name' }, catLabel(row.cat)), h('span', { class: 'plan-spend' }, fmt(row.spend) + ' a month')),
        h('ul', { class: 'plan-use' }, parts, moved ? h('li', { class: 'use-moved' }, 'Moved off ' + cardById(freeTop[row.cat]).name + ' by your rules') : null),
        h('div', { class: 'plan-earn' }, fmt(yearly), h('span', {}, ' a year'))));
    });
    byCat.appendChild(table);
    box.appendChild(byCat);

    // Card-specific caveats for the cards in this wallet.
    var caveats = cards.filter(function (card) { return card.note; });
    var chosen = Object.keys(plan.choices || {});
    if (caveats.length || chosen.length) {
      var list = h('ul', { class: 'caveats' });
      chosen.forEach(function (id) {
        list.appendChild(h('li', {}, h('strong', {}, cardById(id).name + ': '), 'this plan uses ' + catLabel(plan.choices[id]).toLowerCase() + ' as its top category.'));
      });
      caveats.forEach(function (card) { list.appendChild(h('li', {}, h('strong', {}, card.name + ': '), card.note)); });
      box.appendChild(h('section', { class: 'block' }, h('h3', {}, 'Good to know'), list));
    }
  }

  // ---- events --------------------------------------------------------------

  function refresh(what) {
    tidy();
    if (what === 'all') { renderCards(); renderSpend(); renderRules(); }
    if (what === 'all' || what === 'wallet') renderDependents();
    renderResults();
    saveState();
  }

  var num = function (el, fallback) {
    var v = parseFloat(el.value);
    return isFinite(v) && v >= 0 ? v : fallback;
  };

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset.spend) { state.spend[t.dataset.spend] = num(t, 0); renderSpendTotal(); refresh(); }
    else if (t.dataset.limit) { state.rules.limits[t.dataset.limit] = num(t, 0); refresh(); }
    else if (t.dataset.value) { state.pointValues[t.dataset.value] = num(t, 1); refresh(); }
    else if (t.id === 'share-pct') { state.rules.sharePct = num(t, 50); $('share-out').textContent = state.rules.sharePct + '%'; refresh(); }
    else if (t.id === 'util-pct') { state.rules.utilPct = num(t, 30); $('util-out').textContent = state.rules.utilPct + '%'; refresh(); }
    else if (t.id === 'bonus-spend') { state.rules.bonusSpend = num(t, 0); refresh(); }
    else if (t.id === 'bonus-months') { state.rules.bonusMonths = Math.max(1, Math.round(num(t, 1))); refresh(); }
    else if (t.id === 'bonus-value') { state.rules.bonusValue = num(t, 0); refresh(); }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.card) {
      var id = t.dataset.card, at = state.wallet.indexOf(id);
      if (t.checked && at === -1) state.wallet.push(id);
      if (!t.checked && at !== -1) state.wallet.splice(at, 1);
      refresh('wallet');
    }
    else if (t.id === 'everyday') { state.everyday = t.value; refresh(); }
    else if (t.id === 'bonus-card') { state.rules.bonusCard = t.value; refresh(); }
    else if (t.id === 'share-on') { state.rules.shareOn = t.checked; renderRules(); refresh(); }
    else if (t.id === 'util-on') { state.rules.utilOn = t.checked; renderRules(); refresh(); }
    else if (t.id === 'bonus-on') { state.rules.bonusOn = t.checked; renderRules(); refresh(); }
  });

  document.addEventListener('click', function (e) {
    var id = e.target.dataset && e.target.dataset.remove;
    if (!id) return;
    e.preventDefault();
    state.custom = state.custom.filter(function (c) { return c.id !== id; });
    renderCards();
    refresh('wallet');
  });

  $('custom-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('custom-name').value.trim();
    var base = parseFloat($('custom-base').value);
    var rate = parseFloat($('custom-rate').value);
    var msg = $('custom-msg');
    if (!name) { msg.textContent = 'Give the card a name.'; $('custom-name').focus(); return; }
    if (!isFinite(base) || base < 0 || base > 20) { msg.textContent = 'Enter a rate between 0 and 20.'; $('custom-base').focus(); return; }
    var rates = {};
    if (isFinite(rate) && rate > 0 && rate <= 20 && $('custom-cat').value) rates[$('custom-cat').value] = rate;
    var card = { id: 'custom_' + Date.now().toString(36), name: name, issuer: 'Added by you', fee: Math.max(0, parseFloat($('custom-fee').value) || 0), currency: 'cash', base: base, rates: rates };
    state.custom.push(card);
    state.wallet.push(card.id);
    e.target.reset();
    msg.textContent = 'Added ' + name + '.';
    renderCards();
    refresh('wallet');
  });

  $('reset').addEventListener('click', function () {
    if (!window.confirm('Replace your cards, spending and rules with the example?')) return;
    state = exampleState();
    refresh('all');
  });

  // ---- waitlist ------------------------------------------------------------

  (function waitlist() {
    var form = $('waitlist-form'), msg = $('wl-msg'), button = $('wl-submit');
    var W = window.CRCWaitlist;
    $('wl-consent').textContent = W.CONSENT_TEXT;

    var problem = W.configProblem(CONFIG.waitlist);
    if (problem) {
      button.disabled = true;
      $('wl-email').disabled = true;
      $('wl-price').disabled = true;
      msg.className = 'form-msg form-msg-setup';
      msg.textContent = problem;
      return;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('wl-email').value;
      if (!W.validEmail(email)) { msg.textContent = 'Enter a valid email address.'; $('wl-email').focus(); return; }
      // Spam trap: people never see this field, so anything in it came from a
      // bot. Answer as if it worked and send nothing.
      if ($('wl-website').value) { form.reset(); msg.textContent = 'You are on the waitlist.'; return; }

      var req = W.buildRequest(CONFIG.waitlist, { email: email, wouldPay: $('wl-price').value });
      button.disabled = true;
      msg.textContent = 'Joining…';
      fetch(req.url, req.options).then(function (res) {
        if (W.outcome(res.status) !== 'joined') throw new Error('status ' + res.status);
        form.reset();
        msg.textContent = 'You are on the waitlist.';
      }).catch(function () {
        msg.textContent = 'That did not go through, so you are not on the list yet. Try again in a moment.';
      }).then(function () { button.disabled = false; });
    });
  })();

  // ---- start ---------------------------------------------------------------

  document.title = CONFIG.appName;
  $('app-name').textContent = CONFIG.appName;
  $('rates-checked').textContent = CONFIG.ratesChecked;
  var customCat = $('custom-cat');
  customCat.appendChild(h('option', { value: '' }, 'None'));
  CATEGORIES.forEach(function (c) { if (c.id !== 'other') customCat.appendChild(h('option', { value: c.id }, c.label)); });

  refresh('all');
})();
