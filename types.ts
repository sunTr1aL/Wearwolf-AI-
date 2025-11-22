
export type Language = 'en' | 'zh';

export enum RoleType {
  WEREWOLF = 'WEREWOLF',
  VILLAGER = 'VILLAGER',
  SEER = 'SEER',
  WITCH = 'WITCH',
  HUNTER = 'HUNTER',
  GUARDIAN = 'GUARDIAN',     // 守卫
  IDIOT = 'IDIOT',           // 白痴
  WHITE_WOLF_KING = 'WHITE_WOLF_KING', // 白狼王
  WOLF_BEAUTY = 'WOLF_BEAUTY', // 狼美人
  CUPID = 'CUPID',           // 爱神
}

export enum GamePhase {
  LOBBY = 'LOBBY',
  // Night Phases
  NIGHT = 'NIGHT',
  // Election Phases (Day 1 only)
  ELECTION_NOMINATION = 'ELECTION_NOMINATION',
  ELECTION_SPEECH = 'ELECTION_SPEECH',
  ELECTION_VOTE = 'ELECTION_VOTE',
  ELECTION_RESULT = 'ELECTION_RESULT',
  // Day Phases
  DAY_SPEECH = 'DAY_SPEECH',
  DAY_VOTE = 'DAY_VOTE',
  DAY_VOTE_RESULT = 'DAY_VOTE_RESULT',
  // Special
  SHERIFF_HANDOVER = 'SHERIFF_HANDOVER',
  SHOOT_ACTION = 'SHOOT_ACTION',
  GAME_OVER = 'GAME_OVER',
}

export interface Player {
  id: string;
  name: string;
  role: RoleType;
  isAlive: boolean;
  isBot: boolean;
  avatar: string;
  votesReceived: number;
  votedFor: string | null;
  
  // Status Flags
  isSheriff: boolean;
  isProtected: boolean;
  isPoisoned: boolean;
  isLinked: boolean;
  loverId: string | null;
  isExposed: boolean;
  hasActed: boolean;

  // Connection Info
  isHost: boolean;
  isOnline: boolean;
  isSpectator?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  isSystem?: boolean;
  isNightChat?: boolean;
  isHostChat?: boolean;
  isDeadChat?: boolean;
}

export interface GameState {
  roomId?: string; // For display
  phase: GamePhase;
  round: number;
  players: Player[];
  messages: ChatMessage[];
  timer: number;
  winner: 'VILLAGERS' | 'WEREWOLVES' | 'LOVERS' | null;
  language: Language;
  
  // Config
  roleCounts: Record<RoleType, number>;

  // Logic State
  sheriffCandidateIds: string[];
  speechQueue: string[];
  currentSpeakerId: string | null;
  
  // Night Actions Tracking
  nightActions: {
    werewolfTargetId: string | null;
    seerTargetId: string | null;
    witchHealUsed: boolean;
    witchPoisonUsed: boolean;
    witchTargetId: string | null;
    witchSaveTargetId: string | null;
    guardianTargetId: string | null;
    lastGuardedId: string | null;
    cupidTargetIds: string[];
    beautyLinkedId: string | null;
  };

  // Pending Actions
  pendingShootActorId: string | null;
  pendingSheriffDeathId: string | null;
}

export interface RoleConfig {
  type: RoleType;
  team: 'VILLAGERS' | 'WEREWOLVES' | 'NEUTRAL';
  icon: string;
}

export interface Translation {
  [key: string]: {
    en: string;
    zh: string;
  }
}