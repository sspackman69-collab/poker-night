import { useState } from 'react';

export default function WaitingRoom({ state, myId, games = [], onStart, onSetVariant, onSetHiLo, onRebuy }) {
  const { code, players, dealerId, maxPlayers = 8, variantId, variantName, ante, hiLo, dealableCount = 0, gameOver, gameWinner } = state;
  const isDealer = myId === dealerId;
  const canDeal = players.length >= 2 && dealableCount >= 2;
  const me = players.find(p => p.id === myId);
  const [rebuyDollars, setRebuyDollars] = useState(100);
  const anteUsd = ante != null ? `$${(ante * 0.25).toFixed(2)}` : null;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8 p-4">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold text-white mb-1">Poker Night</h1>
        {variantName && (
          <p className="text-gold text-sm font-semibold">
            {variantName}{anteUsd ? ` · Ante ${anteUsd}` : ''}{hiLo ? ' · Hi-Lo' : ''}
          </p>
        )}
        <p className="text-white/40 text-sm">Waiting for players to join…</p>
      </div>

      {/* Room code */}
      <div className="bg-white/5 border border-white/10 rounded-2xl px-8 py-5 text-center">
        <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Room Code</p>
        <p className="font-mono text-4xl font-bold text-gold tracking-widest">{code}</p>
        <p className="text-white/30 text-xs mt-2">Share this with your friends</p>
      </div>

      {/* Player list */}
      <div className="w-full max-w-sm">
        <p className="text-white/40 text-xs uppercase tracking-wider mb-3 text-center">
          {players.length} / {maxPlayers} Players
        </p>
        <div className="flex flex-col gap-2">
          {players.map(p => (
            <div
              key={p.id}
              className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10"
            >
              <div className="w-8 h-8 rounded-full bg-felt flex items-center justify-center text-xs font-bold text-white">
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-white font-medium flex-1">{p.name}</span>
              {p.isDealer && (
                <span className="bg-gold text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">DEALER</span>
              )}
              {p.id === myId && (
                <span className="text-white/40 text-xs">You</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {isDealer && games.length > 0 && (
        <div className="w-full max-w-sm">
          <label className="text-white/40 text-xs uppercase tracking-wider mb-1 block text-center">Game</label>
          <select
            value={variantId || ''}
            onChange={e => onSetVariant?.(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-gold text-center"
          >
            {games.map(g => (
              <option
                key={g.id}
                value={g.id}
                disabled={g.maxPlayers != null && players.length > g.maxPlayers}
                className="bg-gray-900"
              >
                {g.name}{g.minPlayers ? ` · ${g.minPlayers}-${g.maxPlayers} players` : ''}
                {g.maxPlayers != null && players.length > g.maxPlayers ? ' (too many players)' : ''}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 cursor-pointer select-none mt-3 justify-center">
            <input
              type="checkbox"
              checked={!!hiLo}
              onChange={e => onSetHiLo?.(e.target.checked)}
              className="w-4 h-4 accent-gold"
            />
            <span className="text-white/80 text-sm">Hi-Lo split <span className="text-white/40">(declare hi/lo/both at showdown)</span></span>
          </label>
        </div>
      )}

      {me && me.chips === 0 && (
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
          <span className="text-white/60 text-sm">You're out of chips —</span>
          <span className="text-white/40">$</span>
          <input
            type="number" min={1} max={10000}
            value={rebuyDollars}
            onChange={e => setRebuyDollars(e.target.value)}
            className="w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm"
          />
          <button
            onClick={() => onRebuy?.(rebuyDollars)}
            className="px-3 py-1 rounded-md bg-gold text-gray-900 hover:bg-gold-light text-sm font-bold"
          >
            Rebuy
          </button>
        </div>
      )}

      {gameOver && (
        <p className="text-gold font-semibold text-center">🏆 {gameWinner} wins the game — everyone else is out of chips.</p>
      )}
      {!gameOver && players.length >= 2 && dealableCount < 2 && (
        <p className="text-white/50 text-sm text-center">Need at least 2 players with chips to deal.</p>
      )}

      {isDealer && (
        <button
          className="btn-primary px-10 py-3 text-base"
          onClick={onStart}
          disabled={!canDeal}
          title={!canDeal ? 'Need at least 2 players with chips' : ''}
        >
          Deal Cards
        </button>
      )}
      {!isDealer && (
        <p className="text-white/30 text-sm">Waiting for the dealer to start the game…</p>
      )}
    </div>
  );
}
