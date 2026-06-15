const { bestHand, findWinners, findLowWinners } = require('./handEvaluator');
const { getVariant, DEFAULT_VARIANT } = require('./variants');
const {
  emptyPurse, purseValue, minCoins, coinsToPurse, buyInPurse,
  exactFromPurse, coverFromPurse,
} = require('./bank');

const DEFAULT_BUYIN = 400; // 400 As units = $100.00 (internal unit: As = $0.25)

/**
 * GameRoom is the GENERIC engine: it owns players, chips, the pot, the betting
 * mechanics (fold/check/call/raise + action-order traversal), reconnection and
 * the card-privacy mechanism. Game-specific rules (how cards are dealt, how many
 * streets, who acts first, who wins) live in a pluggable variant module that
 * this engine calls into via hooks. See game/variants/.
 */
class GameRoom {
  constructor(code, dealerId, dealerName, dealerSocketId, variantId = DEFAULT_VARIANT, ante = 1, buyIn = DEFAULT_BUYIN) {
    this.code = code;
    this.dealerId = dealerId; // stable clientId of the dealer
    this.variant = getVariant(variantId);
    this.variantId = this.variant.id;
    this.ante = ante; // in As units (1 As = $0.25); dealer-configurable
    this.hiLo = false; // dealer toggle: split the pot between best high and best low
    this.declarations = {}; // playerId -> 'hi'|'lo'|'both' (hi-lo declare phase)
    this.declareIds = null; // ids that still must declare this hand
    this.phase = 'lobby'; // lobby | betting | declare | showdown | results
    this.deck = [];
    this.pot = 0;
    this.currentBet = 0;
    this.roundNumber = 0;
    this.street = 0;       // generic "stage" counter the variant manages
    this.winners = null;
    this.revealHands = false; // true only at a real showdown — a fold-win never reveals hole cards
    this.redealReason = null; // when phase==='redeal', why (e.g. Black Widow's Q♠); dealer must re-deal
    this.pendingPayouts = null; // deferred pot award, collected at next deal
    this.potCoins = [];    // actual coins in the pot (As-unit denominations)
    this.wildRanks = new Set(); // ranks currently wild (variants set this)
    this.players = new Map(); // clientId -> player
    this.actionOrder = []; // ordered list of clientIds for the current round
    this.currentActorIndex = 0;
    this.addPlayer(dealerId, dealerName, dealerSocketId, true, buyIn);
  }

  // id is the stable clientId; socketId is the current (replaceable) connection.
  // Each player gets a PURSE of real coins (a balanced mix for their buy-in);
  // chips is the cached total value of that purse.
  addPlayer(id, name, socketId, isDealer = false, buyIn = DEFAULT_BUYIN) {
    const purse = buyInPurse(buyIn);
    this.players.set(id, {
      id,
      socketId,
      name,
      isDealer,
      purse,
      chips: purseValue(purse),
      hand: [],
      bet: 0,
      committed: 0, // cumulative value put into the pot THIS hand (never street-reset)
      folded: false,
      allIn: false,
      connected: true,
    });
  }

  // ── Coin helpers (physical money) ───────────────────────────────────────────
  _sync(player) { player.chips = purseValue(player.purse); }
  _removeFromPurse(player, coins) { for (const v of coins) player.purse[v] = (player.purse[v] || 0) - 1; }
  _addToPurse(player, coins) { for (const v of coins) player.purse[v] = (player.purse[v] || 0) + 1; }
  addCoinsToPot(coins) { for (const v of coins) { this.potCoins.push(v); this.pot += v; } }
  removeCoinsFromPot(coins) {
    for (const v of coins) {
      const i = this.potCoins.indexOf(v);
      if (i >= 0) { this.potCoins.splice(i, 1); this.pot -= v; }
    }
  }

  // Move `amount` of value from a player's purse into the pot using real coins.
  //  1) exact coins from the purse, else
  //  2) overpay and take exact change FROM THE POT's coins, else
  //  3) the Bank breaks the coins: mint the exact bet into the pot and return
  //     the change to the purse (minimum coins).
  payIntoPot(player, amount) {
    if (amount <= 0) return;
    // Track cumulative contribution this hand so the client can animate every
    // pot deposit — including a call that closes the round (after which per-street
    // `bet` is reset to 0 before the next broadcast).
    player.committed = (player.committed || 0) + amount;
    const exact = exactFromPurse(player.purse, amount);
    if (exact) {
      this._removeFromPurse(player, exact);
      this.addCoinsToPot(exact);
      this._sync(player);
      return;
    }
    const cover = coverFromPurse(player.purse, amount);
    if (!cover) { // safety net (shouldn't happen: amount <= chips)
      this.addCoinsToPot(minCoins(amount));
      this._sync(player);
      return;
    }
    const over = cover.total - amount;
    const change = exactFromPurse(coinsToPurse(this.potCoins), over);
    if (change) {
      // Overpay onto the table, take change back from the pot's coins.
      this._removeFromPurse(player, cover.coins);
      this.addCoinsToPot(cover.coins);
      this.removeCoinsFromPot(change);
      this._addToPurse(player, change);
      this._sync(player);
      return;
    }
    // Bank: break the overpay coin(s) — exact bet to the pot, change to purse.
    this._removeFromPurse(player, cover.coins);
    this.addCoinsToPot(minCoins(amount));
    this._addToPurse(player, minCoins(over));
    this._sync(player);
  }

  // Re-link an existing player to a new socket after a refresh/reconnect.
  reconnect(id, socketId) {
    const player = this.players.get(id);
    if (!player) return false;
    player.socketId = socketId;
    player.connected = true;
    return true;
  }

  removePlayer(id) {
    this.players.delete(id);
    this.actionOrder = this.actionOrder.filter(pid => pid !== id);
  }

  getPlayer(id) {
    return this.players.get(id);
  }

  getActivePlayers() {
    return [...this.players.values()].filter(p => !p.folded && p.connected);
  }

  // Return the table to the lobby and clear the previous deal so stale
  // cards/bets never linger between rounds.
  resetToLobby() {
    this.collectPot(); // make sure the last hand's winner is paid before leaving
    this.phase = 'lobby';
    this.deck = [];
    this.pot = 0;
    this.currentBet = 0;
    this.street = 0;
    this.winners = null;
    this.revealHands = false;
    this.redealReason = null;
    this.declarations = {};
    this.declareIds = null;
    this.potCoins = [];
    this.wildRanks = new Set();
    this.actionOrder = [];
    this.currentActorIndex = 0;
    for (const player of this.players.values()) {
      player.hand = [];
      player.bet = 0;
      player.folded = false;
      player.allIn = false;
    }
  }

  // Seat order (dealer first, then join order), used to walk clockwise.
  seatOrder() {
    return [...this.players.keys()];
  }

  // Players still in the hand (not folded) and connected.
  livePlayers() {
    return [...this.players.values()].filter(p => !p.folded && p.connected);
  }

  // The order cards are physically DEALT: starting at the dealer's left and
  // proceeding clockwise, with the DEALER receiving last (as in real poker).
  // Variants must deal in this order — it determines which card lands where,
  // which matters for e.g. Follow the Queen's "card after a Queen is wild".
  dealOrder() {
    const live = this.livePlayers();
    const di = live.findIndex(p => p.id === this.dealerId);
    if (di < 0) return live; // dealer is sitting out — leave order as-is
    return [...live.slice(di + 1), ...live.slice(0, di + 1)]; // dealer's left → … → dealer
  }

  // Deal one card from the deck to a player, tagging whether it's face-up
  // (public to everyone) or face-down (private to its owner until showdown).
  // After dealing, the variant's onCardDealt hook (if any) runs — this is how
  // dynamic-wild games like Follow the Queen update the wild rank as cards land.
  dealTo(player, faceUp) {
    const card = this.deck.shift();
    card.faceUp = !!faceUp;
    player.hand.push(card);
    if (this.variant.onCardDealt) this.variant.onCardDealt(this, player, card);
    return card;
  }

  // Is a given card currently wild?
  isWild(card) {
    return this.wildRanks.has(card.rank);
  }

  // ── Start a new hand ───────────────────────────────────────────────────────
  // Delegates the deal/ante/forced-bet/first-round setup to the active variant.
  // Seeds any always-on wild ranks the variant declares (e.g. "Queens wild").
  startRound() {
    this.collectPot(); // award the previous hand's pot (if any) before dealing
    this.wildRanks = new Set(this.variant.staticWildRanks || []);
    this.potCoins = [];
    this.revealHands = false; // hide hole cards until/unless a real showdown happens
    this.redealReason = null;
    this.declarations = {}; // fresh hi-lo declarations (the hiLo toggle itself persists)
    this.declareIds = null;
    for (const p of this.players.values()) p.committed = 0; // fresh per-hand tally
    this.variant.startHand(this);
  }

  // A variant calls this to PAUSE the hand for a dealer-triggered re-deal (e.g.
  // Black Widow's Q♠ / no-queens rules). No betting is accepted while phase is
  // 'redeal'; the dealer then calls redeal() to deal a fresh board.
  enterRedeal(reason) {
    this.phase = 'redeal';
    this.redealReason = reason || 'Re-deal required';
    this.announce = reason || null;
    this.actionOrder = [];
    this.currentActorIndex = 0;
  }

  // Dealer triggers the actual re-deal. The variant re-deals a fresh board while
  // KEEPING the pot (no new ante); it may immediately re-enter 'redeal' if the
  // new board also triggers the rule.
  redeal() {
    if (this.phase !== 'redeal') return { error: 'No re-deal pending' };
    if (typeof this.variant.redeal !== 'function') return { error: 'This game has no re-deal' };
    this.redealReason = null;
    this.variant.redeal(this);
    return { ok: true };
  }

  // Next live clientId clockwise after the given id.
  playerAfter(id) {
    const order = this.seatOrder();
    const start = order.indexOf(id);
    for (let i = 1; i <= order.length; i++) {
      const candidate = order[(start + i) % order.length];
      const p = this.players.get(candidate);
      if (p && !p.folded && p.connected) return candidate;
    }
    return id;
  }

  // Build the queue of players who still need to act this round, clockwise from
  // firstId. `excludeId`, if given, is left out entirely — used after a bet/raise
  // so the aggressor does NOT get to act again unless someone re-raises (which
  // rebuilds the queue). When everyone simply calls a bet, the round ends.
  beginBetting(firstId, excludeId = null) {
    const order = this.seatOrder();
    const start = order.indexOf(firstId);
    const queue = [];
    for (let i = 0; i < order.length; i++) {
      const id = order[(start + i) % order.length];
      if (id === excludeId) continue;
      const p = this.players.get(id);
      if (p && !p.folded && p.connected && !p.allIn) queue.push(id);
    }
    this.actionOrder = queue;
    this.currentActorIndex = 0;
  }

  getCurrentActor() {
    if (this.phase !== 'betting') return null;
    return this.actionOrder[this.currentActorIndex] ?? null;
  }

  advanceActor() {
    // If everyone else has folded, the last player left wins immediately — they
    // shouldn't be asked to call/act against an empty table.
    if (this.livePlayers().length <= 1) {
      this.endBettingRound();
      return;
    }
    this.currentActorIndex++;
    while (
      this.currentActorIndex < this.actionOrder.length &&
      this.players.get(this.actionOrder[this.currentActorIndex])?.folded
    ) {
      this.currentActorIndex++;
    }
    if (this.currentActorIndex >= this.actionOrder.length) {
      this.endBettingRound();
    }
  }

  playerAction(playerId, action, amount = 0) {
    if (this.getCurrentActor() !== playerId) return { error: 'Not your turn' };
    const player = this.getPlayer(playerId);
    if (!player) return { error: 'Player not found' };

    switch (action) {
      case 'fold':
        player.folded = true;
        break;

      case 'check':
        if (player.bet < this.currentBet) return { error: 'Cannot check, must call or raise' };
        break;

      case 'call': {
        const owed = this.currentBet - player.bet;
        const paid = Math.min(owed, player.chips);
        player.bet += paid;
        this.payIntoPot(player, paid); // moves real coins, updates player.chips
        if (player.chips === 0) player.allIn = true;
        break;
      }

      case 'raise': {
        if (amount <= this.currentBet) return { error: 'Raise must exceed current bet' };
        const owed = amount - player.bet;
        const paid = Math.min(owed, player.chips);
        player.bet += paid;
        this.payIntoPot(player, paid); // moves real coins, updates player.chips
        this.currentBet = player.bet;
        if (player.chips === 0) player.allIn = true;
        // Everyone else still in must respond to the raise, starting to the
        // raiser's left. The raiser is excluded — if all just call, the round
        // ends without the raiser acting again; a re-raise rebuilds the queue.
        this.beginBetting(this.playerAfter(playerId), playerId);
        return { ok: true };
      }

      default:
        return { error: 'Unknown action' };
    }

    this.advanceActor();
    return { ok: true };
  }

  // Called when everyone has acted on the current betting round. The engine
  // handles the everyone-folded case generically; otherwise the variant decides
  // what comes next (deal a street, a draw phase, or showdown).
  endBettingRound() {
    const live = this.livePlayers();
    if (live.length <= 1) {
      this.finishHand([{ winnerIds: live.map(p => p.id), handName: '(others folded)' }]);
      return;
    }
    this.variant.onBettingComplete(this);
  }

  // The variant calls this to run the showdown using its winner logic. Only here
  // do hole cards get revealed — a hand won by everyone else folding does NOT.
  goToShowdown() {
    // Hi-Lo: before revealing, every remaining player secretly declares hi / lo /
    // both. Resolution happens once all have declared. (Needs ≥2 players.)
    if (this.hiLo && this.livePlayers().length >= 2) {
      this.enterDeclare();
      return;
    }
    this.revealHands = true;
    const groups = this.variant.determineWinners(this);
    this.finishHand(groups);
  }

  // ── Hi-Lo declaration ────────────────────────────────────────────────────
  enterDeclare() {
    this.phase = 'declare';
    this.declarations = {};
    this.declareIds = this.livePlayers().map(p => p.id);
    this.actionOrder = [];
    this.currentActorIndex = 0;
    // Hands stay hidden until everyone has declared (simultaneous & secret).
  }

  // A player locks in hi / lo / both. When all have declared, resolve.
  declare(playerId, choice) {
    if (this.phase !== 'declare') return { error: 'Not the declaration phase' };
    if (!this.declareIds || !this.declareIds.includes(playerId)) return { error: 'You are not in this hand' };
    if (!['hi', 'lo', 'both'].includes(choice)) return { error: 'Invalid declaration' };
    this.declarations[playerId] = choice;
    if (this.declareIds.every(id => this.declarations[id])) this.resolveHiLo();
    return { ok: true };
  }

  // Split the pot between the best high and best low among the declarers. A
  // "both" declarer must win BOTH halves or they forfeit entirely (their winning
  // half then goes to the next-best eligible). If nobody declared a side, the
  // other side takes the whole pot.
  resolveHiLo() {
    this.revealHands = true;
    const live = this.livePlayers();
    const decl = this.declarations;
    const asEval = (arr) => arr.map(p => ({ id: p.id, name: p.name, hand: p.hand }));

    let hiPool = live.filter(p => decl[p.id] === 'hi' || decl[p.id] === 'both');
    let loPool = live.filter(p => decl[p.id] === 'lo' || decl[p.id] === 'both');
    const bothIds = new Set(live.filter(p => decl[p.id] === 'both').map(p => p.id));

    let hiWin = [], loWin = [];
    for (let iter = 0; iter <= live.length; iter++) {
      hiWin = hiPool.length ? findWinners(asEval(hiPool), this.wildRanks) : [];
      loWin = loPool.length ? findLowWinners(asEval(loPool), this.wildRanks) : [];
      const hiIds = new Set(hiWin.map(w => w.id));
      const loIds = new Set(loWin.map(w => w.id));
      // A "both" declarer who wins exactly ONE half forfeits → recompute.
      let failed = null;
      for (const id of bothIds) {
        const wonHi = hiIds.has(id), wonLo = loIds.has(id);
        if ((wonHi || wonLo) && !(wonHi && wonLo)) { failed = id; break; }
      }
      if (failed == null) break;
      hiPool = hiPool.filter(p => p.id !== failed);
      loPool = loPool.filter(p => p.id !== failed);
      bothIds.delete(failed);
    }

    const groups = [];
    if (hiWin.length) groups.push({ winnerIds: hiWin.map(w => w.id), handName: hiWin[0].handName, side: 'hi' });
    if (loWin.length) groups.push({ winnerIds: loWin.map(w => w.id), handName: loWin[0].lowName, side: 'lo' });
    if (groups.length === 0) {
      // Safety net (e.g. all "both" forfeited): award high among everyone live.
      const hw = findWinners(asEval(live), this.wildRanks);
      groups.push({ winnerIds: hw.map(w => w.id), handName: hw[0].handName, side: 'hi' });
    }
    this.finishHand(groups);
  }

  // Generic pot resolution. `groups` is an array of pot-groups; the pot is split
  // equally across groups (1 group = whole pot; Hi-Lo = 2 groups), then equally
  // among the winners within each group. Integer division leaves remainders, so
  // any odd unit(s) are handed out one-at-a-time to the earliest groups/winners —
  // this guarantees the payouts sum EXACTLY to the pot (no chip is ever lost).
  // The payout is DEFERRED (stored in pendingPayouts and kept in the pot) until
  // collectPot() runs, so coins don't reach a purse until the next deal.
  finishHand(groups) {
    const valid = groups
      .map(g => ({ handName: g.handName, ids: g.winnerIds.filter(id => this.players.has(id)) }))
      .filter(g => g.ids.length > 0);

    const flat = [];
    const payouts = [];
    if (valid.length > 0) {
      const baseGroup = Math.floor(this.pot / valid.length);
      let groupRem = this.pot - baseGroup * valid.length; // odd units across groups
      for (const g of valid) {
        const groupPot = baseGroup + (groupRem > 0 ? 1 : 0);
        if (groupRem > 0) groupRem--;
        const share = Math.floor(groupPot / g.ids.length);
        let withinRem = groupPot - share * g.ids.length; // odd units within this group
        for (const id of g.ids) {
          const amount = share + (withinRem > 0 ? 1 : 0);
          if (withinRem > 0) withinRem--;
          payouts.push({ id, amount });
          flat.push({ id, name: this.players.get(id).name, handName: g.handName, side: g.side || null });
        }
      }
    }
    this.pendingPayouts = payouts;
    this.winners = flat;
    this.phase = 'results';
    return flat;
  }

  // Award the deferred pot to the winner(s) and clear the table. Called when the
  // dealer starts the next hand or returns to the lobby.
  collectPot() {
    if (this.pendingPayouts) {
      if (this.pendingPayouts.length === 1) {
        // Single winner gets the ACTUAL coins from the pot.
        const p = this.players.get(this.pendingPayouts[0].id);
        if (p) { this._addToPurse(p, this.potCoins); this._sync(p); }
      } else {
        // Split pot: the Bank pays each winner their share in minimum coins.
        for (const { id, amount } of this.pendingPayouts) {
          const p = this.players.get(id);
          if (p) { this._addToPurse(p, minCoins(amount)); this._sync(p); }
        }
      }
      this.pendingPayouts = null;
    }
    this.pot = 0;
    this.potCoins = [];
  }

  publicState(requestingPlayerId = null) {
    // Reveal hole cards ONLY at a genuine showdown. A hand won because everyone
    // else folded keeps the winner's hole cards hidden (they're never forced to
    // show). Face-up cards remain visible regardless (they're already public).
    const revealAll = this.revealHands;
    const withWild = (card) => ({ ...card, wild: this.wildRanks.has(card.rank) });

    // The TABLE view of each player's hand is identical for every viewer: a
    // card shows only if it was dealt face-up or once cards are revealed at
    // showdown (folded players keep their hidden cards mucked). A player's own
    // hole card is NOT special-cased here — the table looks the same to all.
    const playersArr = [...this.players.values()].map(p => ({
      id: p.id,
      name: p.name,
      isDealer: p.isDealer,
      // Chip totals are private — only sent to their owner. Current bets are
      // public (they're part of the pot).
      chips: p.id === requestingPlayerId ? p.chips : null,
      bet: p.bet,
      committed: p.committed || 0, // public: cumulative pot contribution this hand
      folded: p.folded,
      allIn: p.allIn,
      connected: p.connected,
      cardCount: p.hand.length,
      hand: p.hand.map(card =>
        (card.faceUp || (revealAll && !p.folded))
          ? withWild(card)
          : { rank: '?', suit: '?', id: 'back' }
      ),
      handName: (revealAll && p.hand.length >= 5 && !p.folded)
        ? bestHand(p.hand, this.wildRanks).name
        : null,
    }));

    // The requesting player's OWN full hand (incl. their hole card), shown only
    // to them in their private hand row — never on the shared table.
    const me = this.players.get(requestingPlayerId);
    const myHand = me ? me.hand.map(withWild) : [];
    const myPurse = me ? { ...me.purse } : null; // the owner's actual coins

    return {
      code: this.code,
      phase: this.phase,
      pot: this.pot,
      potCoins: [...this.potCoins],
      currentBet: this.currentBet,
      roundNumber: this.roundNumber,
      street: this.street,
      variantId: this.variantId,
      variantName: this.variant.name,
      maxPlayers: this.variant.maxPlayers,
      ante: this.ante,
      redealReason: this.redealReason,
      hiLo: this.hiLo,
      // During 'declare', expose only WHO has locked in (not their choice). The
      // requester always sees their own pick. Full declarations reveal at results.
      declareIds: this.declareIds ? [...this.declareIds] : null,
      declaredIds: this.phase === 'declare' ? Object.keys(this.declarations) : null,
      declarations: this.phase === 'results' ? { ...this.declarations } : null,
      myDeclaration: me ? (this.declarations[me.id] || null) : null,
      wildRanks: [...this.wildRanks],
      currentActor: this.getCurrentActor(),
      dealerId: this.dealerId,
      players: playersArr,
      myHand,
      myPurse,
    };
  }
}

module.exports = { GameRoom };
