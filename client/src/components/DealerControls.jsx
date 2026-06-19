import { ANTE_OPTIONS } from './Coins';

export default function DealerControls({ phase, playerCount, ante, games = [], variantId, hiLo, dealableCount = 99, gameOver, gameWinner, onSetAnte, onSetVariant, onSetHiLo, onStart, onNewRound, onRedeal, busy }) {
  const canDeal = playerCount >= 2 && dealableCount >= 2;
  return (
    <div className="flex flex-wrap items-center gap-3 justify-center">
      <span className="text-gold text-xs font-semibold uppercase tracking-wider mr-1">Dealer Controls</span>

      {/* Ante — changeable any time; applies to the next hand dealt. */}
      <label className="flex items-center gap-1 text-white/50 text-xs">
        Ante
        <select
          value={ante ?? 1}
          onChange={e => onSetAnte(Number(e.target.value))}
          className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-xs"
          title="Applies to the next hand"
        >
          {ANTE_OPTIONS.map(o => (
            <option key={o.units} value={o.units} className="bg-gray-900">{o.label}</option>
          ))}
        </select>
        {phase === 'betting' && <span className="text-white/30">(next hand)</span>}
      </label>

      {phase === 'redeal' && (
        <button
          className="btn-primary bg-rose-600 hover:bg-rose-500"
          onClick={onRedeal}
          disabled={busy}
        >
          🕷️ Re-deal
        </button>
      )}

      {/* At end of hand, let the dealer change the game / Hi-Lo for the next hand
          without returning to the lobby. */}
      {phase === 'results' && games.length > 0 && (
        <>
          <select
            value={variantId || ''}
            onChange={e => onSetVariant?.(e.target.value)}
            className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-xs"
            title="Next hand's game"
          >
            {games.map(g => (
              <option key={g.id} value={g.id} disabled={g.maxPlayers != null && playerCount > g.maxPlayers} className="bg-gray-900">
                {g.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-white/70 text-xs cursor-pointer select-none">
            <input type="checkbox" checked={!!hiLo} onChange={e => onSetHiLo?.(e.target.checked)} className="w-4 h-4 accent-gold" />
            Hi-Lo
          </label>
        </>
      )}

      {phase === 'results' && gameOver && (
        <span className="text-gold text-xs font-semibold">🏆 {gameWinner} wins the game!</span>
      )}
      {phase === 'results' && !gameOver && dealableCount < 2 && (
        <span className="text-white/50 text-xs">Need 2 players with chips</span>
      )}

      {(phase === 'lobby' || phase === 'results') && (
        <button
          className="btn-primary"
          onClick={onStart}
          disabled={!canDeal || busy}
          title={!canDeal ? 'Need at least 2 players with chips' : ''}
        >
          {phase === 'results' ? 'Deal Next Hand' : 'Deal Cards'}
        </button>
      )}

      {phase === 'results' && (
        <button className="btn-ghost" onClick={onNewRound}>
          Return to Lobby
        </button>
      )}
    </div>
  );
}
