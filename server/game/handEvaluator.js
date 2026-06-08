const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const HAND_RANKS = {
  FIVE_OF_A_KIND: 10, // only possible with wild cards; beats a straight flush
  ROYAL_FLUSH: 9,
  STRAIGHT_FLUSH: 8,
  FOUR_OF_A_KIND: 7,
  FULL_HOUSE: 6,
  FLUSH: 5,
  STRAIGHT: 4,
  THREE_OF_A_KIND: 3,
  TWO_PAIR: 2,
  ONE_PAIR: 1,
  HIGH_CARD: 0
};

const HAND_NAMES = {
  10: 'Five of a Kind',
  9: 'Royal Flush',
  8: 'Straight Flush',
  7: 'Four of a Kind',
  6: 'Full House',
  5: 'Flush',
  4: 'Straight',
  3: 'Three of a Kind',
  2: 'Two Pair',
  1: 'One Pair',
  0: 'High Card'
};

function getValues(hand) {
  return hand.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
}

function isFlush(hand) {
  return hand.every(c => c.suit === hand[0].suit);
}

function isStraight(values) {
  const sorted = [...values].sort((a, b) => a - b);
  // Ace-low straight: A-2-3-4-5
  if (sorted.join() === '2,3,4,5,14') return true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

function getCounts(values) {
  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  return counts;
}

function evaluateHand(cards) {
  const values = getValues(cards);
  const counts = getCounts(values);
  const countValues = Object.values(counts).sort((a, b) => b - a);
  const flush = isFlush(cards);
  const straight = isStraight(values);

  let rank, tiebreakers;

  if (countValues[0] === 5) {
    // Five of a kind (only reachable via wild cards).
    rank = HAND_RANKS.FIVE_OF_A_KIND;
    const five = +Object.keys(counts).find(k => counts[k] === 5);
    tiebreakers = [five];
  } else if (flush && straight) {
    const isRoyal = values.includes(14) && values.includes(13);
    rank = isRoyal ? HAND_RANKS.ROYAL_FLUSH : HAND_RANKS.STRAIGHT_FLUSH;
    tiebreakers = values;
  } else if (countValues[0] === 4) {
    rank = HAND_RANKS.FOUR_OF_A_KIND;
    const quad = +Object.keys(counts).find(k => counts[k] === 4);
    const kicker = +Object.keys(counts).find(k => counts[k] === 1);
    tiebreakers = [quad, kicker];
  } else if (countValues[0] === 3 && countValues[1] === 2) {
    rank = HAND_RANKS.FULL_HOUSE;
    const three = +Object.keys(counts).find(k => counts[k] === 3);
    const two = +Object.keys(counts).find(k => counts[k] === 2);
    tiebreakers = [three, two];
  } else if (flush) {
    rank = HAND_RANKS.FLUSH;
    tiebreakers = values;
  } else if (straight) {
    rank = HAND_RANKS.STRAIGHT;
    tiebreakers = values;
  } else if (countValues[0] === 3) {
    rank = HAND_RANKS.THREE_OF_A_KIND;
    const three = +Object.keys(counts).find(k => counts[k] === 3);
    const kickers = values.filter(v => v !== three);
    tiebreakers = [three, ...kickers];
  } else if (countValues[0] === 2 && countValues[1] === 2) {
    rank = HAND_RANKS.TWO_PAIR;
    const pairs = Object.keys(counts).filter(k => counts[k] === 2).map(Number).sort((a, b) => b - a);
    const kicker = values.find(v => !pairs.includes(v));
    tiebreakers = [...pairs, kicker];
  } else if (countValues[0] === 2) {
    rank = HAND_RANKS.ONE_PAIR;
    const pair = +Object.keys(counts).find(k => counts[k] === 2);
    const kickers = values.filter(v => v !== pair);
    tiebreakers = [pair, ...kickers];
  } else {
    rank = HAND_RANKS.HIGH_CARD;
    tiebreakers = values;
  }

  return { rank, tiebreakers, name: HAND_NAMES[rank] };
}

// Compare two evaluation results (from evaluateHand / bestHand).
function compareEval(a, b) {
  if (a.rank !== b.rank) return a.rank > b.rank ? 1 : -1;
  const n = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < n; i++) {
    const x = a.tiebreakers[i] || 0;
    const y = b.tiebreakers[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

// Rank a set of FACE-UP cards (1–4 of them) for deciding who acts first on
// later streets. Considers pair/trips/quads then high cards (straights/flushes
// showing are ignored for act-order — a fine simplification).
function showingKey(cards) {
  const vals = cards.map(c => RANK_VALUES[c.rank]);
  const counts = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.keys(counts)
    .map(v => ({ v: +v, c: counts[v] }))
    .sort((a, b) => b.c - a.c || b.v - a.v);
  const key = [];
  for (const g of groups) key.push(g.c, g.v);
  return key;
}

function compareShowing(a, b) {
  const ka = showingKey(a);
  const kb = showingKey(b);
  const n = Math.max(ka.length, kb.length);
  for (let i = 0; i < n; i++) {
    const x = ka[i] || 0;
    const y = kb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

// ── Wild-card support ────────────────────────────────────────────────────────
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = Object.keys(RANK_VALUES);
const FULL_DECK = [];
for (const suit of SUITS) for (const rank of RANKS) FULL_DECK.push({ suit, rank });

function isWild(card, wildRanks) {
  return !!(wildRanks && wildRanks.has && wildRanks.has(card.rank));
}

function combos(arr, k) {
  const out = [];
  (function pick(start, acc) {
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let i = start; i < arr.length; i++) { acc.push(arr[i]); pick(i + 1, acc); acc.pop(); }
  })(0, []);
  return out;
}

function combosWithRepl(arr, k) {
  const out = [];
  (function pick(start, acc) {
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let i = start; i < arr.length; i++) { acc.push(arr[i]); pick(i, acc); acc.pop(); }
  })(0, []);
  return out;
}

// Best 5-card evaluation from N cards (handles 5 or more — e.g. 7-card stud).
function bestOfN(cards) {
  if (cards.length <= 5) return evaluateHand(cards);
  let best = null;
  for (const five of combos(cards, 5)) {
    const ev = evaluateHand(five);
    if (!best || compareEval(ev, best) > 0) best = ev;
  }
  return best;
}

const EMPTY = new Set();

// Best possible hand given a set of wild ranks. Each wild card may stand in for
// any card. With 4+ wilds, five aces is always achievable and is the nuts, so we
// short-circuit; otherwise we brute-force the (bounded) wild substitutions.
function bestHand(cards, wildRanks = EMPTY) {
  const wilds = cards.filter(c => isWild(c, wildRanks));
  const naturals = cards.filter(c => !isWild(c, wildRanks));

  if (wilds.length === 0) return bestOfN(cards);
  if (wilds.length >= 4) {
    return { rank: HAND_RANKS.FIVE_OF_A_KIND, tiebreakers: [14], name: HAND_NAMES[10] };
  }

  let best = null;
  for (const repl of combosWithRepl(FULL_DECK, wilds.length)) {
    const ev = bestOfN(naturals.concat(repl));
    if (!best || compareEval(ev, best) > 0) best = ev;
  }
  return best;
}

function findWinners(players, wildRanks = EMPTY) {
  // players: [{ id, name, hand }]
  const evals = players.map(p => ({ p, ev: bestHand(p.hand, wildRanks) }));
  let best = [evals[0]];
  for (let i = 1; i < evals.length; i++) {
    const cmp = compareEval(evals[i].ev, best[0].ev);
    if (cmp > 0) best = [evals[i]];
    else if (cmp === 0) best.push(evals[i]);
  }
  return best.map(e => ({ ...e.p, handName: e.ev.name }));
}

module.exports = { evaluateHand, bestHand, findWinners, compareShowing, RANK_VALUES };
