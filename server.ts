
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

// CONSTANTS (Copied for standalone server operation)
const PHASE_DURATION = {
  NIGHT: 20,
  ELECTION_NOMINATION: 15,
  ELECTION_SPEECH: 60,
  ELECTION_VOTE: 20,
  ELECTION_RESULT: 10,
  DAY_SPEECH: 60,
  DAY_VOTE: 20,
  DAY_VOTE_RESULT: 10,
  SHOOT_ACTION: 15,
  SHERIFF_HANDOVER: 15,
};

interface Player {
  id: string;
  name: string;
  role: string;
  isAlive: boolean;
  isBot: boolean;
  avatar: string;
  votesReceived: number;
  votedFor: string | null;
  isSheriff: boolean;
  isProtected: boolean;
  isPoisoned: boolean;
  isLinked: boolean;
  loverId: string | null;
  isExposed: boolean;
  hasActed: boolean;
  
  // Connection
  socketId?: string;
  isHost: boolean;
  isOnline: boolean;
  isSpectator?: boolean;
}

interface GameState {
  roomId: string;
  phase: string;
  round: number;
  players: Player[];
  messages: any[];
  timer: number;
  winner: string | null;
  roleCounts: Record<string, number>;
  sheriffCandidateIds: string[];
  speechQueue: string[];
  currentSpeakerId: string | null;
  nightActions: any;
  pendingShootActorId: string | null;
  pendingSheriffDeathId: string | null;
}

interface Room {
  id: string;
  gameState: GameState;
  interval?: ReturnType<typeof setInterval>;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms: Record<string, Room> = {};

const getInitialGameState = (roomId: string): GameState => ({
  roomId,
  phase: 'LOBBY',
  round: 0,
  players: [],
  messages: [],
  timer: 0,
  winner: null,
  roleCounts: {
    WEREWOLF: 3,
    VILLAGER: 3,
    SEER: 1,
    WITCH: 1,
    HUNTER: 1,
    GUARDIAN: 0,
    IDIOT: 0,
    WHITE_WOLF_KING: 0,
    WOLF_BEAUTY: 0,
    CUPID: 0,
  },
  sheriffCandidateIds: [],
  speechQueue: [],
  currentSpeakerId: null,
  nightActions: {
    werewolfTargetId: null,
    seerTargetId: null,
    witchHealUsed: false,
    witchPoisonUsed: false,
    witchTargetId: null,
    witchSaveTargetId: null,
    guardianTargetId: null,
    lastGuardedId: null,
    cupidTargetIds: [],
    beautyLinkedId: null
  },
  pendingShootActorId: null,
  pendingSheriffDeathId: null
});

// --- Game Logic Helper ---
const handleGameLoop = (room: Room) => {
  const state = room.gameState;
  
  // Stop timer if game over or lobby
  if (state.phase === 'LOBBY' || state.phase === 'GAME_OVER') {
      if (room.interval) { clearInterval(room.interval); room.interval = undefined; }
      return;
  }

  if (state.timer > 0) {
    state.timer -= 1;
    io.to(room.id).emit('game_state_update', state);
  } else {
    // Handle Phase Transitions
    
    // Speech Queue
    if (state.phase === 'ELECTION_SPEECH' || state.phase === 'DAY_SPEECH') {
        // Move to next speaker
        const queue = [...state.speechQueue];
        queue.shift();
        if (queue.length === 0) {
             state.phase = state.phase === 'ELECTION_SPEECH' ? 'ELECTION_VOTE' : 'DAY_VOTE';
             state.timer = state.phase === 'ELECTION_VOTE' ? PHASE_DURATION.ELECTION_VOTE : PHASE_DURATION.DAY_VOTE;
             state.currentSpeakerId = null;
             state.messages.push({ id: uuidv4(), senderId: 'sys', senderName: 'Sys', content: 'Please Vote!', timestamp: Date.now(), isSystem: true });
        } else {
             state.speechQueue = queue;
             state.currentSpeakerId = queue[0];
             state.timer = state.phase === 'ELECTION_SPEECH' ? PHASE_DURATION.ELECTION_SPEECH : PHASE_DURATION.DAY_SPEECH;
        }
    } 
    else if (state.phase === 'NIGHT') {
        // Wake up
        state.phase = state.round === 1 ? 'ELECTION_NOMINATION' : 'DAY_SPEECH';
        state.timer = state.round === 1 ? PHASE_DURATION.ELECTION_NOMINATION : PHASE_DURATION.DAY_SPEECH;
        
        // Wake up logic
        if (state.phase === 'DAY_SPEECH') {
             const alive = state.players.filter(p => p.isAlive && !p.isSpectator);
             state.speechQueue = alive.map(p => p.id); // Basic order
             state.currentSpeakerId = state.speechQueue[0];
             // Reset votes
             state.players.forEach(p => { p.votedFor = null; p.votesReceived = 0; });
        }
    }
    else if (state.phase === 'ELECTION_NOMINATION') {
         if (state.sheriffCandidateIds.length > 0) {
            state.phase = 'ELECTION_SPEECH';
            state.speechQueue = [...state.sheriffCandidateIds];
            state.currentSpeakerId = state.speechQueue[0];
            state.timer = PHASE_DURATION.ELECTION_SPEECH;
         } else {
            state.phase = 'DAY_SPEECH';
            state.speechQueue = state.players.filter(p => p.isAlive && !p.isSpectator).map(p => p.id);
            state.currentSpeakerId = state.speechQueue[0];
            state.timer = PHASE_DURATION.DAY_SPEECH;
         }
    }
    else if (state.phase === 'ELECTION_VOTE') {
        // Process Election Votes (Simplified)
        state.phase = 'ELECTION_RESULT';
        state.timer = PHASE_DURATION.ELECTION_RESULT;
    }
    else if (state.phase === 'ELECTION_RESULT') {
        state.phase = 'DAY_SPEECH';
        state.speechQueue = state.players.filter(p => p.isAlive && !p.isSpectator).map(p => p.id);
        state.currentSpeakerId = state.speechQueue[0];
        state.timer = PHASE_DURATION.DAY_SPEECH;
    }
    else if (state.phase === 'DAY_VOTE') {
        // Tally Day Votes
        const voteCounts: Record<string, number> = {};
        state.players.forEach(p => {
             if (p.isAlive && p.votedFor) {
                 // 1.5x weighting for Sheriff
                 const weight = p.isSheriff ? 1.5 : 1.0;
                 voteCounts[p.votedFor] = (voteCounts[p.votedFor] || 0) + weight;
             }
        });
        
        let maxVotes = -1;
        let victimId: string | null = null;
        
        state.players.forEach(p => {
            p.votesReceived = voteCounts[p.id] || 0;
            if (p.votesReceived > maxVotes) {
                maxVotes = p.votesReceived;
                victimId = p.id;
            } else if (p.votesReceived === maxVotes) {
                victimId = null; // Tie
            }
        });

        if (victimId) {
            const victim = state.players.find(p => p.id === victimId);
            if (victim) {
                victim.isAlive = false;
                state.messages.push({ id: uuidv4(), senderId: 'sys', senderName: 'System', content: `${victim.name} was eliminated!`, timestamp: Date.now(), isSystem: true });
                
                if (victim.isSheriff) {
                    state.pendingSheriffDeathId = victim.id;
                }
            }
        }

        state.phase = 'DAY_VOTE_RESULT';
        state.timer = PHASE_DURATION.DAY_VOTE_RESULT;
    }
    else if (state.phase === 'DAY_VOTE_RESULT') {
        if (state.pendingSheriffDeathId) {
             state.phase = 'SHERIFF_HANDOVER';
             state.timer = PHASE_DURATION.SHERIFF_HANDOVER;
        } else {
             state.phase = 'NIGHT';
             state.round++;
             state.timer = PHASE_DURATION.NIGHT;
        }
    }
    else if (state.phase === 'SHERIFF_HANDOVER') {
        // Timeout = Destroy Badge
        const oldSheriff = state.players.find(p => p.id === state.pendingSheriffDeathId);
        if (oldSheriff) oldSheriff.isSheriff = false;
        state.pendingSheriffDeathId = null;
        
        state.phase = 'NIGHT';
        state.round++;
        state.timer = PHASE_DURATION.NIGHT;
    }
    
    io.to(room.id).emit('game_state_update', state);
  }
};


io.on('connection', (socket: Socket) => {
  const { name, roomId: qRoomId, playerId: qPlayerId, create } = socket.handshake.query as any;
  let roomId = qRoomId;
  const playerId = qPlayerId || uuidv4();
  
  // 1. Create Room
  if (create === 'true') {
    roomId = uuidv4().slice(0, 6); // Short ID
    rooms[roomId] = {
        id: roomId,
        gameState: getInitialGameState(roomId)
    };
    console.log(`Room created: ${roomId}`);
  }

  // 2. Join Room
  if (!roomId || !rooms[roomId]) {
      socket.emit('error_message', 'Room not found');
      socket.disconnect();
      return;
  }

  const room = rooms[roomId];
  socket.join(roomId);

  // 3. Player Logic (Reconnect or New)
  let player = room.gameState.players.find(p => p.id === playerId);
  
  if (player) {
      // Reconnect
      player.isOnline = true;
      player.socketId = socket.id;
      if (name) player.name = name; // Update name if provided
      console.log(`Player reconnected: ${player.name}`);
  } else {
      // New Player Validation
      let isSpectator = false;
      const activePlayers = room.gameState.players.filter(p => !p.isSpectator);
      
      if (room.gameState.phase !== 'LOBBY') {
          // Game started: Join as Spectator
          isSpectator = true;
      } else if (activePlayers.length >= 12) {
          // Lobby Full: Reject
          socket.emit('error_message', 'Room is full');
          socket.disconnect();
          return;
      }

      const isFirst = activePlayers.length === 0 && !isSpectator;
      
      player = {
          id: playerId,
          name: name || `Player ${room.gameState.players.length + 1}`,
          socketId: socket.id,
          role: 'VILLAGER', // Temp, assigned on start
          isAlive: !isSpectator, // Spectators are not "alive" in gameplay sense
          isBot: false,
          avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${playerId}`,
          votesReceived: 0,
          votedFor: null,
          isSheriff: false,
          isProtected: false,
          isPoisoned: false,
          isLinked: false,
          loverId: null,
          isExposed: false,
          hasActed: false,
          isHost: isFirst,
          isOnline: true,
          isSpectator: isSpectator
      };
      room.gameState.players.push(player);
      console.log(`New ${isSpectator ? 'spectator' : 'player'} joined: ${player.name}`);
  }

  // Send initial state
  socket.emit('connected_info', { playerId, roomId });
  io.to(roomId).emit('game_state_update', room.gameState);

  // --- Host Actions ---

  socket.on('add_bot', () => {
      if (!player?.isHost) return;
      const activeCount = room.gameState.players.filter(p => !p.isSpectator).length;
      if (activeCount >= 12) return;

      const botCount = room.gameState.players.filter(p => p.isBot).length;
      const botId = `bot-${uuidv4()}`;
      room.gameState.players.push({
          id: botId,
          name: `Bot ${botCount + 1}`,
          role: 'VILLAGER',
          isAlive: true,
          isBot: true,
          avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Bot${Date.now()}`,
          votesReceived: 0,
          votedFor: null,
          isSheriff: false,
          isProtected: false,
          isPoisoned: false,
          isLinked: false,
          loverId: null,
          isExposed: false,
          hasActed: false,
          isHost: false,
          isOnline: true,
          isSpectator: false
      });
      io.to(roomId).emit('game_state_update', room.gameState);
  });

  socket.on('remove_bot', () => {
      if (!player?.isHost) return;
      const bots = room.gameState.players.filter(p => p.isBot);
      if (bots.length > 0) {
          const lastBot = bots[bots.length - 1];
          room.gameState.players = room.gameState.players.filter(p => p.id !== lastBot.id);
          io.to(roomId).emit('game_state_update', room.gameState);
      }
  });

  socket.on('update_role_counts', (newCounts) => {
      if(!player?.isHost) return;
      room.gameState.roleCounts = newCounts;
      io.to(roomId).emit('game_state_update', room.gameState);
  });

  socket.on('toggle_participation', () => {
      if (!player) return;
      if (room.gameState.phase !== 'LOBBY') return; 

      if (player.isSpectator) {
          const activeCount = room.gameState.players.filter(p => !p.isSpectator).length;
          if (activeCount >= 12) {
              socket.emit('error_message', 'Room is full');
              return;
          }
          player.isSpectator = false;
          player.isAlive = true;
      } else {
          player.isSpectator = true;
          player.isAlive = false;
      }
      io.to(roomId).emit('game_state_update', room.gameState);
  });

  socket.on('kick_player', (targetId: string) => {
      if (!player?.isHost) return;
      if (player.id === targetId) return;

      const targetIndex = room.gameState.players.findIndex(p => p.id === targetId);
      if (targetIndex !== -1) {
          room.gameState.players.splice(targetIndex, 1);
      }
      io.to(roomId).emit('game_state_update', room.gameState);
  });

  // --- Interaction & Gameplay ---
  
  socket.on('interaction', (data: { targetId: string }) => {
      if (!player || !player.isAlive) return;
      
      if (room.gameState.phase === 'DAY_VOTE') {
          if (data.targetId !== player.id) {
              player.votedFor = data.targetId;
              io.to(roomId).emit('game_state_update', room.gameState);
          }
      }
  });

  socket.on('sheriff_handover', (data: { targetId: string | null }) => {
      if (!player || player.id !== room.gameState.pendingSheriffDeathId) return;
      if (room.gameState.phase !== 'SHERIFF_HANDOVER') return;

      const oldSheriff = room.gameState.players.find(p => p.id === player.id);
      if (oldSheriff) oldSheriff.isSheriff = false;

      if (data.targetId) {
          const newSheriff = room.gameState.players.find(p => p.id === data.targetId);
          if (newSheriff && newSheriff.isAlive) {
              newSheriff.isSheriff = true;
              room.gameState.messages.push({ id: uuidv4(), senderId: 'sys', senderName: 'System', content: `${newSheriff.name} is the new Sheriff!`, timestamp: Date.now(), isSystem: true });
          }
      } else {
          room.gameState.messages.push({ id: uuidv4(), senderId: 'sys', senderName: 'System', content: 'The Sheriff badge was destroyed.', timestamp: Date.now(), isSystem: true });
      }

      room.gameState.pendingSheriffDeathId = null;
      room.gameState.phase = 'NIGHT';
      room.gameState.round++;
      room.gameState.timer = PHASE_DURATION.NIGHT;
      io.to(roomId).emit('game_state_update', room.gameState);
  });

  // --- Chat Logic ---
  socket.on('send_message', (content: string) => {
      if (!player) return;

      // Validation: Who can chat?
      // 1. Host (Always)
      // 2. Dead Players
      // 3. Spectators (Treated as dead for chat)
      // Alive non-host cannot chat.
      
      const canChat = player.isHost || !player.isAlive || player.isSpectator;
      if (!canChat) return;

      const isHostChat = player.isHost;
      const isDeadChat = !player.isAlive || !!player.isSpectator;

      const msg = {
          id: uuidv4(),
          senderId: player.id,
          senderName: player.name,
          content,
          timestamp: Date.now(),
          isSystem: false,
          isHostChat,
          isDeadChat
      };

      room.gameState.messages.push(msg);
      io.to(roomId).emit('game_state_update', room.gameState);
  });

  socket.on('start_game', () => {
      if (!player?.isHost) return;
      
      const activePlayers = room.gameState.players.filter(p => !p.isSpectator);
      const roleConfig = room.gameState.roleCounts;
      
      const deck: string[] = [];
      Object.entries(roleConfig).forEach(([role, count]) => {
          for(let i=0; i<Number(count); i++) deck.push(role);
      });
      
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      
      activePlayers.forEach((p, i) => {
          p.role = deck[i] || 'VILLAGER';
          p.isAlive = true;
          p.votesReceived = 0;
          p.votedFor = null;
          p.hasActed = false;
      });

      room.gameState.phase = 'NIGHT';
      room.gameState.round = 1;
      room.gameState.timer = PHASE_DURATION.NIGHT;
      room.gameState.messages.push({
          id: uuidv4(), senderId: 'sys', senderName: 'Sys', content: 'Game Started!', timestamp: Date.now(), isSystem: true
      });
      
      if (!room.interval) {
          room.interval = setInterval(() => handleGameLoop(room), 1000);
      }
      
      io.to(roomId).emit('game_state_update', room.gameState);
  });

  socket.on('disconnect', () => {
      if (player) {
          player.isOnline = false;
          io.to(roomId).emit('game_state_update', room.gameState);
      }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
