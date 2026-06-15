import { useState } from 'react';

export default function Lobby({ onCreateRoom, onJoinRoom, connecting, games = [] }) {
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [variantId, setVariantId] = useState('');
  const [ante, setAnte] = useState(1); // As units; 1 As = $0.25 (default)
  const [buyIn, setBuyIn] = useState(100); // starting purse, in dollars (default $100)
  const [hiLo, setHiLo] = useState(false); // split the pot between best high & best low
  const [error, setError] = useState('');

  // Default the game picker to the first available game.
  const selectedVariant = variantId || games[0]?.id || 'five-card-stud';

  // Ante options (As units → label).
  const ANTE_OPTIONS = [
    { units: 1, label: '$0.25 — 1 As (default)' },
    { units: 2, label: '$0.50' },
    { units: 4, label: '$1.00' },
    { units: 8, label: '$2.00' },
    { units: 20, label: '$5.00' },
  ];

  // Clamp the buy-in to the server's accepted range ($1–$10,000).
  const cleanBuyIn = () => Math.min(10000, Math.max(1, Math.round(Number(buyIn) || 100)));

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Please enter your name');
    setError('');
    const result = await onCreateRoom(name.trim(), selectedVariant, ante, cleanBuyIn(), hiLo);
    if (result?.error) setError(result.error);
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Please enter your name');
    if (!code.trim()) return setError('Please enter a room code');
    setError('');
    const result = await onJoinRoom(code.trim().toUpperCase(), name.trim(), cleanBuyIn());
    if (result?.error) setError(result.error);
  }

  // Shared buy-in input (used on both the create and join forms).
  const buyInField = (
    <div>
      <label className="text-xs text-white/50 uppercase tracking-wider mb-1 block">Buy-In</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">$</span>
        <input
          type="number"
          min={1}
          max={10000}
          step={1}
          value={buyIn}
          onChange={e => setBuyIn(e.target.value)}
          className="w-full pl-8 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-gold"
        />
      </div>
      <p className="text-white/30 text-xs mt-1">Coins you start with (a balanced mix). $1–$10,000.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {/* Background felt texture */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #35654d 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">🃏</div>
          <h1 className="font-display text-5xl font-bold text-white mb-2">Poker Night</h1>
          <p className="text-white/50 text-sm">5-Card Stud · Friends Only</p>
        </div>

        {!mode && (
          <div className="flex flex-col gap-4">
            <button
              className="w-full py-4 rounded-2xl bg-gold text-gray-900 font-bold text-lg hover:bg-gold-light transition-all active:scale-95"
              onClick={() => setMode('create')}
            >
              🎩 Host a Game
            </button>
            <button
              className="w-full py-4 rounded-2xl bg-white/10 text-white font-bold text-lg hover:bg-white/20 transition-all active:scale-95"
              onClick={() => setMode('join')}
            >
              🪑 Join a Game
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="bg-white/5 rounded-2xl p-6 flex flex-col gap-4 border border-white/10">
            <h2 className="font-display text-xl text-white font-bold">Host a Game</h2>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-1 block">Your Name</label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={20}
                placeholder="e.g. Big Eddie"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-1 block">Game</label>
              <select
                value={selectedVariant}
                onChange={e => setVariantId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-gold"
              >
                {(games.length ? games : [{ id: 'five-card-stud', name: '5-Card Stud' }]).map(g => (
                  <option key={g.id} value={g.id} className="bg-gray-900">
                    {g.name}{g.minPlayers ? ` · ${g.minPlayers}-${g.maxPlayers} players` : ''}
                  </option>
                ))}
              </select>
              <p className="text-white/30 text-xs mt-1">More games coming soon.</p>
            </div>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-1 block">Ante</label>
              <select
                value={ante}
                onChange={e => setAnte(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-gold"
              >
                {ANTE_OPTIONS.map(o => (
                  <option key={o.units} value={o.units} className="bg-gray-900">{o.label}</option>
                ))}
              </select>
              <p className="text-white/30 text-xs mt-1">Each player antes this at the start of every hand.</p>
            </div>
            {buyInField}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hiLo}
                onChange={e => setHiLo(e.target.checked)}
                className="w-4 h-4 accent-gold"
              />
              <span className="text-white/80 text-sm">Hi-Lo split <span className="text-white/40">— split the pot between best & worst hand</span></span>
            </label>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="btn-primary w-full py-3 text-base" disabled={connecting}>
              {connecting ? 'Connecting…' : 'Create Room'}
            </button>
            <button type="button" className="text-white/40 text-sm hover:text-white/70" onClick={() => { setMode(null); setError(''); }}>
              ← Back
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="bg-white/5 rounded-2xl p-6 flex flex-col gap-4 border border-white/10">
            <h2 className="font-display text-xl text-white font-bold">Join a Game</h2>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-1 block">Your Name</label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={20}
                placeholder="e.g. Lucky Louie"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-1 block">Room Code</label>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={10}
                placeholder="e.g. SHARK-42"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-gold font-mono tracking-widest text-center text-lg"
              />
            </div>
            {buyInField}
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="btn-primary w-full py-3 text-base" disabled={connecting}>
              {connecting ? 'Connecting…' : 'Join Room'}
            </button>
            <button type="button" className="text-white/40 text-sm hover:text-white/70" onClick={() => { setMode(null); setError(''); }}>
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
