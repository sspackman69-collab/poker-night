import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './hooks/useSocket';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import PokerTable from './components/PokerTable';
import BettingControls from './components/BettingControls';
import DealerControls from './components/DealerControls';
import PlayingCard from './components/PlayingCard';
import Credits from './components/Credits';
import { MyCoins, AS_USD } from './components/Coins';

// Persist just enough to rejoin after a refresh. Per-tab (sessionStorage) so
// each tab is its own player and a refresh restores that tab's seat.
// (Reading/clearing on reconnect is handled inside useSocket.)
function saveSession(code) {
  sessionStorage.setItem('pokerSession', JSON.stringify({ code }));
}

export default function App() {
  const { emit, on, off, connected, clientId } = useSocket();
  const myId = clientId; // our stable per-tab identity — always who "we" are
  const [gameState, setGameState] = useState(null);
  const [winners, setWinners] = useState(null);
  const [toast, setToast] = useState(null);
  const [games, setGames] = useState([]);
  const [betDollars, setBetDollars] = useState(0); // current bet amount being built (dollars)
  const betBuilding = useRef(false);               // coin-click session flag
  const [collecting, setCollecting] = useState(false); // pot is flying to winner
  const [collectSignal, setCollectSignal] = useState(0); // bump to trigger fly-out

  // Fetch the available game variants once connected (for the dealer's picker).
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    emit('listGames', {}).then(res => {
      if (!cancelled && res?.ok) setGames(res.games);
    });
    return () => { cancelled = true; };
  }, [connected, emit]);

  // Register socket listeners. (Auto-rejoin on (re)connect is handled inside
  // useSocket; the server's rejoin broadcast arrives here as a gameState event.)
  useEffect(() => {
    const cleanup1 = on('gameState', (state) => {
      setGameState(state);
      if (state.phase === 'lobby' && winners) setWinners(null);
    });

    const cleanup2 = on('roundResult', ({ winners: w }) => {
      setWinners(w);
      const names = w.map(p => p.name).join(' & ');
      showToast(`🏆 ${names} wins with ${w[0]?.handName}!`);
    });

    const cleanup3 = on('announce', ({ message }) => showToast(message));

    return () => {
      cleanup1?.();
      cleanup2?.();
      cleanup3?.();
    };
  }, [on, winners]);

  // If a rejoin fails (room/seat gone, e.g. after a server restart), return to
  // the opening screen rather than showing a frozen, stale room.
  useEffect(() => {
    const onInvalid = () => {
      setGameState(null);
      setWinners(null);
    };
    window.addEventListener('poker:session-invalid', onInvalid);
    return () => window.removeEventListener('poker:session-invalid', onInvalid);
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleCreateRoom(name, variantId, ante, buyIn) {
    const res = await emit('createRoom', { name, clientId, variantId, ante, buyIn });
    if (res?.ok) {
      setGameState(res.state);
      saveSession(res.code);
    }
    return res;
  }

  async function handleJoinRoom(code, name, buyIn) {
    const res = await emit('joinRoom', { code, name, clientId, buyIn });
    if (res?.ok) {
      setGameState(res.state);
      saveSession(res.code);
    }
    return res;
  }

  async function handleStartRound() {
    const res = await emit('startRound', {});
    if (res?.error) showToast(res.error);
  }

  async function handlePlayerAction(action, amount) {
    const res = await emit('playerAction', { action, amount });
    if (res?.error) showToast(res.error);
  }

  async function handleSetAnte(ante) {
    const res = await emit('setAnte', { ante });
    if (res?.error) showToast(res.error);
  }

  async function handleNewRound() {
    await emit('newRound', {});
    setWinners(null);
  }

  async function handleRedeal() {
    const res = await emit('redeal', {});
    if (res?.error) showToast(res.error);
  }

  // Reset the bet box to a sensible default whenever the turn or bet changes.
  useEffect(() => {
    if (!gameState || gameState.phase !== 'betting') return;
    const meP = gameState.players.find(p => p.id === myId);
    const cb = gameState.currentBet || 0;
    const maxD = ((meP?.chips ?? 0) + (meP?.bet ?? 0)) * AS_USD;
    const minD = (cb + 1) * AS_USD;
    const sugg = Math.max(minD, Math.min(maxD, (cb > 0 ? cb * 2 : 20) * AS_USD));
    setBetDollars(Number.isFinite(sugg) && sugg > 0 ? +sugg.toFixed(2) : 0);
    betBuilding.current = false;
  }, [gameState?.currentActor, gameState?.currentBet, gameState?.phase, gameState?.street, gameState?.roundNumber, myId]);

  // Clicking a coin in your purse builds the bet (first click overwrites, rest add).
  const addCoinToBet = useCallback((value) => {
    const usd = value * AS_USD;
    setBetDollars(prev => {
      const meP = gameState?.players.find(p => p.id === myId);
      const maxD = ((meP?.chips ?? 0) + (meP?.bet ?? 0)) * AS_USD;
      const base = betBuilding.current ? prev : 0;
      return Math.max(0, Math.min(maxD, +(base + usd).toFixed(2)));
    });
    betBuilding.current = true;
  }, [gameState, myId]);

  const onBetChange = useCallback((v) => { setBetDollars(v); betBuilding.current = false; }, []);

  // Load the whole stack into the bet box (All-In).
  const setAllIn = useCallback(() => {
    const meP = gameState?.players.find(p => p.id === myId);
    const maxAs = (meP?.chips ?? 0) + (meP?.bet ?? 0);
    setBetDollars(+(maxAs * AS_USD).toFixed(2));
    betBuilding.current = false;
  }, [gameState, myId]);

  // "Deal Next Hand": at results, first fly the pot to the winner, then deal
  // after it lands (+0.5s). Otherwise just deal.
  function handleDealNext() {
    if (collecting) return;
    if (gameState?.phase === 'results' && gameState.potCoins?.length) {
      setCollecting(true);
      setCollectSignal(s => s + 1);
      const n = Math.min(gameState.potCoins.length, 60);
      const animMs = Math.min((n - 1) * 45 + 700, 2600);
      setTimeout(() => { handleStartRound(); }, animMs + 500);
    } else {
      handleStartRound();
    }
  }

  // Clear the "collecting" overlay once the next hand has actually started.
  useEffect(() => {
    if (gameState?.phase === 'betting') setCollecting(false);
  }, [gameState?.roundNumber, gameState?.phase]);

  // ── Render states ─────────────────────────────────────────
  if (!gameState) {
    return <Lobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} connecting={!connected} games={games} />;
  }

  const { phase, players, pot, currentBet, roundNumber, street, dealerId, currentActor } = gameState;
  const me = players.find(p => p.id === myId);
  const isDealer = myId === dealerId;
  const isMyTurn = currentActor === myId && phase === 'betting';

  if (phase === 'lobby') {
    return (
      <WaitingRoom
        state={gameState}
        myId={myId}
        onStart={handleStartRound}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-950/80 border-b border-white/5">
        <span className="font-display text-white font-bold text-lg">Poker Night</span>
        <div className="flex items-center gap-4 text-sm">
          {gameState.variantName && (
            <span className="text-white/40 hidden sm:inline">{gameState.variantName}</span>
          )}
          <span className="text-white/40">Room: <span className="text-gold font-mono">{gameState.code}</span></span>
          <span className="text-white/40">Hand <span className="text-white">{roundNumber}</span></span>
          {phase === 'betting' && (
            <span className="text-white/40">Card <span className="text-white">{street}</span>/5</span>
          )}
          {gameState.ante != null && (
            <span className="text-white/40">Ante <span className="text-gold">${(gameState.ante * 0.25).toFixed(2)}</span></span>
          )}
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
      </div>

      {/* Table area */}
      <div className="flex-1 relative">
        <div className="absolute bottom-1 left-2 z-30">
          <Credits />
        </div>
        <PokerTable
          players={players}
          myId={myId}
          currentActor={currentActor}
          winners={winners}
          phase={phase}
          pot={pot}
          potCoins={gameState.potCoins || []}
          roundNumber={roundNumber}
          collecting={collecting}
          collectSignal={collectSignal}
        />
      </div>

      {/* Bottom bar: your coins (left) · your hand + controls (center) */}
      <div className="bg-gray-950/80 border-t border-white/5 px-4 py-2">
        <div className="flex items-center gap-4">
          {/* Your chips, as per-denomination stacks */}
          <div className="shrink-0 max-w-[38%] overflow-x-auto">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
              Your Chips{isMyTurn && !me?.folded ? ' — click a coin to bet' : ''}
            </div>
            <MyCoins
              purse={gameState.myPurse}
              amount={me?.chips ?? 0}
              size={26}
              onCoinClick={isMyTurn && !me?.folded ? addCoinToBet : undefined}
            />
            {isMyTurn && !me?.folded && (
              <button
                onClick={setAllIn}
                className="mt-1 px-3 py-1 rounded-md bg-green-600 hover:bg-green-500 text-white text-xs font-bold shadow"
              >
                All-In
              </button>
            )}
          </div>

          {/* Your hand + phase + action controls */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            {gameState.myHand?.length > 0 && (
              <div className="flex justify-center gap-1.5">
                {gameState.myHand.map((card, i) => (
                  <PlayingCard key={i} card={card} size="md" delay={i * 100} />
                ))}
              </div>
            )}

            <div className="text-[11px] text-white/30 uppercase tracking-widest">
              {phase === 'betting' && (isMyTurn ? '⬇ Your Turn' : `Waiting for ${players.find(p => p.id === currentActor)?.name ?? '…'}…`)}
              {phase === 'showdown' && 'Showdown — all cards revealed'}
              {phase === 'results' && '🏆 Round over'}
              {phase === 'redeal' && (isDealer ? '🕷️ Re-deal required — click Re-deal' : '🕷️ Waiting for dealer to re-deal…')}
            </div>

            {phase === 'redeal' && gameState.redealReason && (
              <div className="text-rose-300 text-xs text-center max-w-md">{gameState.redealReason}</div>
            )}

            {phase === 'betting' && !isDealer && (
              <BettingControls
                onAction={handlePlayerAction}
                currentBet={currentBet}
                myBet={me?.bet ?? 0}
                myChips={me?.chips ?? 0}
                disabled={!isMyTurn || me?.folded}
                betDollars={betDollars}
                onBetChange={onBetChange}
              />
            )}

            {isDealer && (
              <DealerControls
                phase={phase}
                playerCount={players.length}
                ante={gameState.ante}
                onSetAnte={handleSetAnte}
                onStart={handleDealNext}
                onNewRound={handleNewRound}
                onRedeal={handleRedeal}
                busy={collecting}
              />
            )}

            {phase === 'betting' && isDealer && (
              <BettingControls
                onAction={handlePlayerAction}
                currentBet={currentBet}
                myBet={me?.bet ?? 0}
                myChips={me?.chips ?? 0}
                disabled={!isMyTurn || me?.folded}
                betDollars={betDollars}
                onBetChange={onBetChange}
              />
            )}
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 border border-gold/40 rounded-2xl px-6 py-3 text-white font-semibold shadow-2xl text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
