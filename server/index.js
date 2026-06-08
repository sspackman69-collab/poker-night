const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GameRoom } = require('./game/gameState');
const { listVariants } = require('./game/variants');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// roomCode -> GameRoom
const rooms = new Map();
// socketId -> { code, clientId }  (resolves a live socket to its player)
const socketInfo = new Map();

// Buy-in arrives in DOLLARS from the client; convert to As units and clamp to a
// sane range ($1–$10,000). Default $100 (400 As units).
function clampBuyIn(dollars) {
  const units = Math.round((Number(dollars) || 100) / 0.25);
  return Math.min(40000, Math.max(4, units));
}

function generateCode() {
  const words = ['ACE', 'KING', 'JACK', 'FLUSH', 'ROYAL', 'SHARK', 'BLUFF', 'ANTE', 'RIVER', 'RIVER'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${word}-${num}`;
}

function broadcastRoom(room, event = 'gameState') {
  // players is keyed by stable clientId; each player tracks its CURRENT socketId.
  for (const player of room.players.values()) {
    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) {
      // Tailor each emit to its owner so cards stay private (publicState masks
      // every other player's hand).
      socket.emit(event, room.publicState(player.id));
    }
  }
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // List the available game variants (for the dealer's game picker).
  socket.on('listGames', (_, cb) => cb?.({ ok: true, games: listVariants() }));

  // Dealer creates a room
  socket.on('createRoom', ({ name, clientId, variantId, ante, buyIn }, cb) => {
    if (!clientId) return cb({ error: 'Missing client id' });
    let code = generateCode();
    while (rooms.has(code)) code = generateCode();

    // Ante in As units; clamp to a sane range, default 1 As ($0.25).
    const anteUnits = Math.min(80, Math.max(0, Math.round(Number(ante) || 1)));
    const buyInUnits = clampBuyIn(buyIn);
    const room = new GameRoom(code, clientId, name, socket.id, variantId, anteUnits, buyInUnits);
    rooms.set(code, room);
    socketInfo.set(socket.id, { code, clientId });
    socket.join(code);

    console.log(`Room created: ${code} by ${name}`);
    cb({ ok: true, code, clientId, state: room.publicState(clientId) });
  });

  // Player joins a room
  socket.on('joinRoom', ({ code, name, clientId, buyIn }, cb) => {
    if (!clientId) return cb({ error: 'Missing client id' });
    const upper = code.toUpperCase();
    const room = rooms.get(upper);
    if (!room) return cb({ error: 'Room not found' });

    const existing = room.getPlayer(clientId);
    if (existing) {
      // Same person rejoining (e.g. after a refresh) — re-link, don't duplicate.
      room.reconnect(clientId, socket.id);
    } else {
      if (room.phase !== 'lobby') return cb({ error: 'Game already in progress' });
      const cap = room.variant.maxPlayers || 8;
      if (room.players.size >= cap) return cb({ error: `Table is full (max ${cap} players)` });
      room.addPlayer(clientId, name, socket.id, false, clampBuyIn(buyIn));
    }

    socketInfo.set(socket.id, { code: upper, clientId });
    socket.join(upper);

    console.log(`${name} ${existing ? 'rejoined' : 'joined'} room ${upper} (${room.players.size} players)`);
    broadcastRoom(room, 'gameState');
    cb({ ok: true, code: upper, clientId, state: room.publicState(clientId) });
  });

  // Reconnect after a page refresh: re-link an existing player to this socket.
  socket.on('rejoin', ({ code, clientId }, cb) => {
    if (!code || !clientId) return cb?.({ error: 'Missing session info' });
    const upper = code.toUpperCase();
    const room = rooms.get(upper);
    if (!room) return cb?.({ error: 'Room no longer exists' });
    if (!room.getPlayer(clientId)) return cb?.({ error: 'Seat no longer exists' });

    room.reconnect(clientId, socket.id);
    socketInfo.set(socket.id, { code: upper, clientId });
    socket.join(upper);

    console.log(`${clientId} reconnected to ${upper}`);
    broadcastRoom(room, 'gameState');
    cb?.({ ok: true, code: upper, clientId, state: room.publicState(clientId) });
  });

  // Dealer changes the ante (applies to the NEXT hand dealt).
  socket.on('setAnte', ({ ante }, cb) => {
    const info = socketInfo.get(socket.id);
    const room = info && rooms.get(info.code);
    if (!room) return cb?.({ error: 'Room not found' });
    if (room.dealerId !== info.clientId) return cb?.({ error: 'Only the dealer can set the ante' });
    room.ante = Math.min(80, Math.max(0, Math.round(Number(ante) || 1)));
    broadcastRoom(room);
    cb?.({ ok: true });
  });

  // Dealer starts the round
  socket.on('startRound', (_, cb) => {
    const info = socketInfo.get(socket.id);
    const room = info && rooms.get(info.code);
    if (!room) return cb?.({ error: 'Room not found' });
    if (room.dealerId !== info.clientId) return cb?.({ error: 'Only the dealer can start' });
    if (room.players.size < 2) return cb?.({ error: 'Need at least 2 players' });

    room.startRound();
    broadcastRoom(room);
    if (room.announce) {
      io.to(info.code).emit('announce', { message: room.announce });
      room.announce = null;
    }
    cb?.({ ok: true });
  });

  // Player action: fold, check, call, raise
  socket.on('playerAction', ({ action, amount }, cb) => {
    const info = socketInfo.get(socket.id);
    const room = info && rooms.get(info.code);
    if (!room) return cb?.({ error: 'Room not found' });

    const result = room.playerAction(info.clientId, action, amount);
    if (result.error) return cb?.({ error: result.error });

    broadcastRoom(room);
    // The engine deals streets and resolves the showdown automatically; when a
    // hand ends it sets phase 'results' and room.winners.
    if (room.phase === 'results' && room.winners) {
      io.to(info.code).emit('roundResult', { winners: room.winners });
    }
    cb?.({ ok: true });
  });

  // Dealer resets to lobby for next round
  socket.on('newRound', (_, cb) => {
    const info = socketInfo.get(socket.id);
    const room = info && rooms.get(info.code);
    if (!room) return cb?.({ error: 'Room not found' });
    if (room.dealerId !== info.clientId) return cb?.({ error: 'Only the dealer can reset' });

    room.resetToLobby();
    broadcastRoom(room);
    cb?.({ ok: true });
  });

  socket.on('disconnect', () => {
    const info = socketInfo.get(socket.id);
    socketInfo.delete(socket.id);
    if (!info) return;
    const room = rooms.get(info.code);
    if (!room) return;

    const player = room.getPlayer(info.clientId);
    // Only mark disconnected if this socket is still the player's current one
    // (guards against a stale old socket disconnecting after a reconnect).
    if (player && player.socketId === socket.id) {
      player.connected = false;
      console.log(`${player.name} disconnected from ${info.code}`);
      broadcastRoom(room);

      // Clean up empty rooms after a delay
      setTimeout(() => {
        const allGone = [...room.players.values()].every(p => !p.connected);
        if (allGone) rooms.delete(info.code);
      }, 30000);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Poker Night server running on port ${PORT}`));
