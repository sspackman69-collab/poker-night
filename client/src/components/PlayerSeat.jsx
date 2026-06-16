import PlayingCard from './PlayingCard';
import { Coin, largestDenom, fmtUSD } from './Coins';

const AVATAR_COLORS = [
  'bg-purple-600', 'bg-blue-600', 'bg-green-600',
  'bg-yellow-600', 'bg-pink-600', 'bg-indigo-600',
  'bg-red-600', 'bg-teal-600',
];

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default function PlayerSeat({
  player,
  isMe,
  isCurrentActor,
  isWinner,
  phase,
  position, // 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | etc.
  dealDelay, // (playerId, cardIndex) => ms; staggers the deal animation
}) {
  if (!player) return <div className="w-32 h-28" />;
  const cardDelay = (i) => (dealDelay ? dealDelay(player.id, i) : i * 80);

  const { name, chips, bet, folded, sittingOut, allIn, hand, handName, isDealer, connected } = player;
  const initials = name.slice(0, 2).toUpperCase();
  const color = avatarColor(name);

  const isActive = isCurrentActor && !folded && phase === 'betting';
  const showCards = hand && hand.length > 0 && phase !== 'lobby';

  // Flip card layout for top-seated players
  const cardsOnTop = position?.startsWith('bottom');

  return (
    <div className={`flex flex-col items-center gap-1 transition-all duration-300 ${folded ? 'opacity-40' : ''}`}>
      {/* Cards above avatar for bottom players */}
      {showCards && cardsOnTop && (
        <div className="flex gap-1">
          {hand.map((card, i) => (
            // Key by position so a slot updates in place across the mask→reveal
            // transition (masked cards all share id 'back', so id-based keys
            // collide and leave orphaned face-down cards in the DOM).
            <PlayingCard key={i} card={card} size="sm" delay={cardDelay(i)} />
          ))}
        </div>
      )}

      {/* Seat container */}
      <div
        className={`
          relative flex flex-col items-center gap-1 p-2 rounded-xl
          transition-all duration-300
          ${isActive ? 'ring-2 ring-gold ring-offset-2 ring-offset-felt bg-white/10' : ''}
          ${isWinner ? 'winner-glow ring-2 ring-gold' : ''}
          ${!connected ? 'opacity-50' : ''}
        `}
      >
        {/* Dealer badge */}
        {isDealer && (
          <span className="absolute -top-2 -right-2 bg-gold text-gray-900 text-xs font-bold px-1.5 py-0.5 rounded-full z-10">
            D
          </span>
        )}

        {/* Disconnected indicator */}
        {!connected && (
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-900/90 text-red-200 text-[9px] font-semibold px-1.5 py-0.5 rounded-full z-10 whitespace-nowrap">
            reconnecting…
          </span>
        )}

        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-sm font-bold border-2 ${isMe ? 'border-gold' : 'border-white/20'}`}>
          {initials}
        </div>

        {/* Name */}
        <div className="text-xs font-semibold text-white text-center max-w-[80px] truncate">
          {name}{isMe ? ' (You)' : ''}
        </div>

        {/* Chip totals are private — not shown for other players. Only the
            all-in status (which is public) is indicated here. */}
        {allIn && (
          <div className="flex justify-center">
            <span className="text-red-400 font-bold text-xs">ALL IN</span>
          </div>
        )}

        {/* Current bet */}
        {bet > 0 && phase !== 'lobby' && (
          <div className="text-xs text-white/60 flex items-center gap-1 justify-center mt-0.5">
            <Coin value={largestDenom(bet)} size={13} /> Bet {fmtUSD(bet)}
          </div>
        )}

        {/* Folded / sitting-out label */}
        {folded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
            <span className={`font-bold text-xs rotate-[-15deg] ${sittingOut ? 'text-white/60' : 'text-red-400'}`}>
              {sittingOut ? 'SITTING OUT' : 'FOLDED'}
            </span>
          </div>
        )}

        {/* Hand name during showdown */}
        {handName && !folded && (
          <div className="text-xs text-gold-light font-semibold">{handName}</div>
        )}
      </div>

      {/* Cards below avatar for top/side players */}
      {showCards && !cardsOnTop && (
        <div className="flex gap-1">
          {hand.map((card, i) => (
            <PlayingCard key={i} card={card} size="sm" delay={cardDelay(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
