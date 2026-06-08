import { fmtUSD, toAsUnits, AS_USD } from './Coins';

// Amounts in props are in internal As units ($0.25 each). The bet amount
// (betDollars) is owned by the parent so the purse coins can drive it.
export default function BettingControls({
  onAction, currentBet, myBet, myChips, disabled, betDollars, onBetChange,
}) {
  const canCheck = myBet >= currentBet;
  const callAmount = currentBet - myBet;   // As units owed to call
  const maxRaise = myChips + myBet;        // As units (your all-in total)
  const canRaise = maxRaise > currentBet;

  const minDollars = (currentBet + 1) * AS_USD;
  const maxDollars = maxRaise * AS_USD;
  const raiseAs = toAsUnits(betDollars);
  const raiseValid = canRaise && raiseAs > currentBet && raiseAs <= maxRaise;

  return (
    <div className="flex flex-wrap items-center gap-3 justify-center">
      <button className="btn-danger" onClick={() => onAction('fold')} disabled={disabled}>
        Fold
      </button>

      {canCheck ? (
        <button className="btn-ghost" onClick={() => onAction('check')} disabled={disabled}>
          Check
        </button>
      ) : (
        <button
          className="btn-ghost"
          onClick={() => onAction('call')}
          disabled={disabled || myChips === 0}
        >
          {callAmount >= myChips ? `Call ${fmtUSD(myChips)} (all in)` : `Call ${fmtUSD(callAmount)}`}
        </button>
      )}

      <div className="flex items-center gap-1">
        <span className="text-white/50 text-sm">$</span>
        <input
          type="number"
          min={minDollars}
          max={maxDollars}
          step={AS_USD}
          value={betDollars}
          onChange={e => onBetChange(Number(e.target.value))}
          className="w-20 px-2 py-1.5 rounded bg-white/10 border border-white/20 text-white text-sm text-center disabled:opacity-40"
          disabled={disabled || !canRaise}
        />
        <button
          className="btn-primary"
          onClick={() => onAction('raise', raiseAs)}
          disabled={disabled || !raiseValid}
        >
          {currentBet > 0 ? 'Raise' : 'Bet'}
        </button>
      </div>
    </div>
  );
}
