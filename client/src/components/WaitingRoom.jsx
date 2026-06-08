export default function WaitingRoom({ state, myId, onStart }) {
  const { code, players, dealerId, maxPlayers = 8, variantName, ante } = state;
  const isDealer = myId === dealerId;
  const anteUsd = ante != null ? `$${(ante * 0.25).toFixed(2)}` : null;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8 p-4">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold text-white mb-1">Poker Night</h1>
        {variantName && (
          <p className="text-gold text-sm font-semibold">
            {variantName}{anteUsd ? ` · Ante ${anteUsd}` : ''}
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

      {isDealer && (
        <button
          className="btn-primary px-10 py-3 text-base"
          onClick={onStart}
          disabled={players.length < 2}
          title={players.length < 2 ? 'Need at least 2 players' : ''}
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
