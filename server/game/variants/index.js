// Variant registry. To add a new poker game: create a module in this folder
// implementing the variant hooks (see fiveCardStud.js), then add one line here.
const fiveCardStud = require('./fiveCardStud');
const sevenCardStud = require('./sevenCardStud');
const followTheQueen = require('./followTheQueen');
const blackWidow = require('./blackWidow');

const VARIANTS = {
  [fiveCardStud.id]: fiveCardStud,
  [sevenCardStud.id]: sevenCardStud,
  [followTheQueen.id]: followTheQueen,
  [blackWidow.id]: blackWidow,
  // [fiveCardDraw.id]: fiveCardDraw,
  // [texasHoldem.id]: texasHoldem,
  // ...
};

const DEFAULT_VARIANT = fiveCardStud.id;

function getVariant(id) {
  return VARIANTS[id] || VARIANTS[DEFAULT_VARIANT];
}

// Lightweight catalog for the client's game picker (id, name, player limits,
// and whether it's actually implemented yet).
function listVariants() {
  return Object.values(VARIANTS).map(v => ({
    id: v.id,
    name: v.name,
    minPlayers: v.minPlayers,
    maxPlayers: v.maxPlayers,
  }));
}

module.exports = { getVariant, listVariants, DEFAULT_VARIANT };
