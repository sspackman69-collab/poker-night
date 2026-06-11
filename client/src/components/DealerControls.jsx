import { ANTE_OPTIONS } from './Coins';

export default function DealerControls({ phase, playerCount, ante, onSetAnte, onStart, onNewRound, onRedeal, busy }) {
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

      {(phase === 'lobby' || phase === 'results') && (
        <button
          className="btn-primary"
          onClick={onStart}
          disabled={playerCount < 2 || busy}
          title={playerCount < 2 ? 'Need at least 2 players' : ''}
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
