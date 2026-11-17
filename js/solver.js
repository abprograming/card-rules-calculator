/*
 * Rules solver for the card calculator.
 *
 * Given a wallet, monthly spending by category and the user's rules, it finds
 * the split of spending across cards that earns the most while keeping every
 * rule. The problem is a small minimum-cost flow:
 *
 *   source -> category -> card -> sink
 *
 * - a category's supply is its monthly spend
 * - a bonus rate with a cap becomes two parallel arcs (bonus rate up to the
 *   cap, base rate beyond it)
 * - a card's ceiling (share of spend, utilization) is the capacity of its arc
 *   to the sink
 * - a welcome-bonus target is a "must fill" arc on that card
 * - spending no card has room for goes to an "unassigned" node and is reported
 *
 * Works in whole dollars per month. Loaded as a plain script in the browser
 * (window.CRCSolver) and with require() in Node for the tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CRCSolver = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var INF = 1e9;      // "no limit" capacity
  var BIGM = 1e6;     // pull toward a welcome-bonus target, larger than any real rate
  var PENALTY = 1e7;  // cost of leaving a dollar unassigned, larger than BIGM

  function monthlyCap(cap, per) {
    if (per === 'year') return Math.floor(cap / 12);
    if (per === 'quarter') return Math.floor(cap / 3);
    return Math.floor(cap);
  }

  // ---- minimum-cost flow (successive shortest paths, SPFA) ----------------

  function makeGraph(n) {
    var head = [];
    for (var i = 0; i < n; i++) head.push(-1);
    return { n: n, head: head, to: [], cap: [], cost: [], next: [] };
  }

  function addEdge(g, u, v, cap, cost) {
    g.to.push(v); g.cap.push(cap); g.cost.push(cost); g.next.push(g.head[u]); g.head[u] = g.to.length - 1;
    g.to.push(u); g.cap.push(0); g.cost.push(-cost); g.next.push(g.head[v]); g.head[v] = g.to.length - 1;
    return g.to.length - 2; // index of the forward edge; the reverse edge is index + 1
  }

  function minCostFlow(g, s, t) {
    var total = 0;
    for (;;) {
      var dist = [], inQueue = [], prevEdge = [];
      for (var i = 0; i < g.n; i++) { dist.push(Infinity); inQueue.push(false); prevEdge.push(-1); }
      dist[s] = 0;
      var queue = [s];
      while (queue.length) {
        var u = queue.shift();
        inQueue[u] = false;
        for (var e = g.head[u]; e !== -1; e = g.next[e]) {
          if (g.cap[e] > 0 && dist[u] + g.cost[e] < dist[g.to[e]]) {
            dist[g.to[e]] = dist[u] + g.cost[e];
            prevEdge[g.to[e]] = e;
            if (!inQueue[g.to[e]]) { inQueue[g.to[e]] = true; queue.push(g.to[e]); }
          }
        }
      }
      if (dist[t] === Infinity) break;
      var push = INF;
      for (var v = t; v !== s; v = g.to[prevEdge[v] ^ 1]) push = Math.min(push, g.cap[prevEdge[v]]);
      for (var w = t; w !== s; w = g.to[prevEdge[w] ^ 1]) { g.cap[prevEdge[w]] -= push; g.cap[prevEdge[w] ^ 1] += push; }
      total += push * dist[t];
    }
    return total;
  }

  // ---- model ---------------------------------------------------------------

  // The rate tiers a card pays in one category: [{cap, rate}], best first.
  function tiers(card, cat, choiceCat) {
    if (card.choice && choiceCat === cat) {
      return [{ cap: monthlyCap(card.choice.cap, card.choice.per), rate: card.choice.rate }, { cap: INF, rate: card.base }];
    }
    var r = card.rates ? card.rates[cat] : undefined;
    if (r === undefined || r === null) return [{ cap: INF, rate: card.base }];
    if (typeof r === 'number') return [{ cap: INF, rate: r }];
    return [{ cap: monthlyCap(r.cap, r.per), rate: r.rate }, { cap: INF, rate: card.base }];
  }

  // Value of one dollar of spend, in hundredths of a cent, so costs stay integers.
  function units(card, rate, pointValues) {
    var cents = card.currency === 'cash' ? 1 : (pointValues && pointValues[card.currency] != null ? pointValues[card.currency] : 1);
    return Math.round(rate * cents * 100);
  }

  function solveOnce(input, choiceMap) {
    var cards = input.cards;
    var rules = input.rules || {};
    var cats = [], spend = {}, total = 0;
    Object.keys(input.spend).forEach(function (c) {
      var amount = Math.max(0, Math.round(Number(input.spend[c]) || 0));
      if (amount > 0) { cats.push(c); spend[c] = amount; total += amount; }
    });

    var C = cats.length, K = cards.length;
    var S = 0, U = C + K + 1, T = C + K + 2;
    var g = makeGraph(C + K + 3);
    var arcs = [];          // category -> card arcs, for reading the answer back
    var unassignedArcs = [];
    var notes = [];

    cats.forEach(function (c, ci) {
      addEdge(g, S, 1 + ci, spend[c], 0);
      unassignedArcs.push(addEdge(g, 1 + ci, U, INF, PENALTY));
    });
    addEdge(g, U, T, INF, 0);

    var bonus = rules.bonus && rules.bonus.spend > 0 && rules.bonus.months > 0 ? rules.bonus : null;
    var mustArc = -1, mustNeed = 0, mustWanted = 0;

    cards.forEach(function (card, ki) {
      var node = 1 + C + ki;
      cats.forEach(function (c, ci) {
        tiers(card, c, choiceMap[card.id]).forEach(function (tier) {
          var u = units(card, tier.rate, input.pointValues);
          arcs.push({ cat: c, cardId: card.id, rate: tier.rate, units: u, edge: addEdge(g, 1 + ci, node, tier.cap, -u) });
        });
      });

      var ceiling = INF;
      if (rules.sharePct != null) ceiling = Math.min(ceiling, Math.floor(total * rules.sharePct / 100));
      if (rules.util && rules.util.limits && rules.util.limits[card.id] > 0) {
        ceiling = Math.min(ceiling, Math.floor(rules.util.limits[card.id] * rules.util.pct / 100));
      }

      var need = 0;
      if (bonus && bonus.cardId === card.id) {
        mustWanted = Math.ceil(bonus.spend / bonus.months);
        need = Math.min(mustWanted, ceiling);
        if (need < mustWanted) notes.push({ type: 'bonus_blocked', cardId: card.id, wanted: mustWanted, ceiling: ceiling });
        mustNeed = need;
        if (need > 0) mustArc = addEdge(g, node, T, need, -BIGM);
      }
      addEdge(g, node, T, ceiling === INF ? INF : Math.max(0, ceiling - need), 0);
    });

    var cost = minCostFlow(g, S, T);

    var byCategory = {}, cardSpend = {}, cardUnits = {};
    cards.forEach(function (card) { cardSpend[card.id] = 0; cardUnits[card.id] = 0; });
    cats.forEach(function (c) { byCategory[c] = []; });
    var valueUnits = 0;
    arcs.forEach(function (a) {
      var flow = g.cap[a.edge + 1];
      if (flow <= 0) return;
      byCategory[a.cat].push({ cardId: a.cardId, amount: flow, rate: a.rate, units: a.units });
      cardSpend[a.cardId] += flow;
      cardUnits[a.cardId] += flow * a.units;
      valueUnits += flow * a.units;
    });

    var unassigned = 0, unassignedBy = {};
    cats.forEach(function (c, ci) {
      var flow = g.cap[unassignedArcs[ci] + 1];
      if (flow > 0) { unassigned += flow; unassignedBy[c] = flow; }
    });
    if (unassigned > 0) notes.push({ type: 'unassigned', amount: unassigned });

    if (bonus) {
      var onCard = cardSpend[bonus.cardId] || 0;
      var filled = mustArc === -1 ? 0 : g.cap[mustArc + 1];
      if (mustWanted > 0 && mustNeed === mustWanted && filled >= mustNeed) {
        notes.push({ type: 'bonus_on_track', cardId: bonus.cardId, monthly: mustWanted, months: bonus.months });
      } else if (mustNeed === mustWanted) {
        notes.push({ type: 'bonus_short', cardId: bonus.cardId, monthly: onCard, wanted: mustWanted });
      }
    }

    return {
      objective: -cost,
      total: total,
      monthlyValue: valueUnits / 10000,
      annualValue: valueUnits * 12 / 10000,
      byCategory: cats.map(function (c) {
        var parts = byCategory[c].sort(function (a, b) { return b.units - a.units || b.amount - a.amount; });
        return { cat: c, spend: spend[c], parts: parts, unassigned: unassignedBy[c] || 0 };
      }),
      byCard: cards.map(function (card) {
        return {
          cardId: card.id,
          monthlySpend: cardSpend[card.id],
          share: total > 0 ? cardSpend[card.id] / total : 0,
          annualValue: cardUnits[card.id] * 12 / 10000
        };
      }),
      unassigned: unassigned,
      notes: notes,
      choices: choiceMap
    };
  }

  // Cards with a "top category" bonus (one category earns the high rate) are
  // handled by trying each eligible category and keeping the best result.
  function solve(input) {
    var active = {};
    Object.keys(input.spend).forEach(function (c) { if (Number(input.spend[c]) > 0) active[c] = true; });

    var combos = [{}];
    input.cards.forEach(function (card) {
      if (!card.choice) return;
      var options = card.choice.categories.filter(function (c) { return active[c]; });
      if (!options.length) return;
      var next = [];
      combos.forEach(function (combo) {
        options.forEach(function (c) {
          if (next.length >= 400) return;
          var copy = {};
          Object.keys(combo).forEach(function (k) { copy[k] = combo[k]; });
          copy[card.id] = c;
          next.push(copy);
        });
      });
      combos = next;
    });

    var best = null;
    combos.forEach(function (combo) {
      var result = solveOnce(input, combo);
      if (!best || result.objective > best.objective) best = result;
    });
    return best;
  }

  return { solve: solve, monthlyCap: monthlyCap, tiers: tiers };
});
