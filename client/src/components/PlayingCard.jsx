const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

const SIZES = {
  sm: { outer: 'w-10 h-14 rounded-md text-xs', rank: 'text-xs leading-none', suit: 'text-base' },
  md: { outer: 'w-14 h-20 rounded-lg text-sm', rank: 'text-sm leading-none', suit: 'text-xl' },
  lg: { outer: 'w-20 h-28 rounded-xl text-base', rank: 'text-base leading-none', suit: 'text-3xl' },
};

export default function PlayingCard({ card, size = 'md', delay = 0, faceDown = false }) {
  if (!card || faceDown || card.id === 'back') {
    const s = SIZES[size];
    return (
      <div
        className={`card card-back ${s.outer} border-2`}
        style={{ animationDelay: `${delay}ms` }}
      />
    );
  }

  const { rank, suit } = card;
  const symbol = SUIT_SYMBOLS[suit] || suit;
  const suitClass = `suit-${suit}`;
  const s = SIZES[size];

  return (
    <div
      className={`card card-dealt ${s.outer} px-1 py-0.5 relative ${card.wild ? 'ring-2 ring-amber-400' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {card.wild && (
        <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-gray-900 text-[8px] font-bold px-1 rounded-full z-10 leading-tight">
          WILD
        </span>
      )}
      <div className={`${s.rank} font-bold ${suitClass} self-start`}>{rank}</div>
      <div className={`${s.suit} ${suitClass}`}>{symbol}</div>
      <div className={`${s.rank} font-bold ${suitClass} self-end rotate-180`}>{rank}</div>
    </div>
  );
}
