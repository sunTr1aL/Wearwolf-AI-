
import React from 'react';
import { Player, RoleType, GamePhase } from '../types';
import { ROLES } from '../constants';

interface PlayerCardProps {
  player: Player;
  isLocalPlayer: boolean;
  gamePhase: GamePhase;
  localPlayerRole: RoleType;
  onClick: (playerId: string) => void;
  isSelected?: boolean;
  showRole?: boolean;
  isSpeaking?: boolean;
  voterNames?: string[];
}

const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  isLocalPlayer,
  gamePhase,
  localPlayerRole,
  onClick,
  isSelected,
  showRole,
  isSpeaking,
  voterNames
}) => {
  
  const isWerewolf = ROLES[localPlayerRole].team === 'WEREWOLVES';
  const isTeammate = isWerewolf && ROLES[player.role].team === 'WEREWOLVES';
  
  // Special logic for Wolf Beauty / Cupid links visible to self
  const showLink = isLocalPlayer && player.isLinked; 
  const showLover = (localPlayerRole === RoleType.CUPID || isLocalPlayer) && player.loverId;

  // Reveal role condition
  const revealRole = showRole || isLocalPlayer || isTeammate || player.isExposed;

  // Logic to show vote results (only in Result phases)
  const showVoteResults = (gamePhase === GamePhase.DAY_VOTE_RESULT || gamePhase === GamePhase.ELECTION_RESULT) && player.votesReceived > 0;

  const handleCardClick = () => {
    if (!player.isAlive) return;
    onClick(player.id);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`
        relative flex flex-col items-center p-2 md:p-3 rounded-xl border-2 transition-all duration-300 cursor-pointer
        ${!player.isAlive ? 'opacity-50 grayscale border-slate-700 bg-slate-800' : 'bg-slate-800/80 hover:bg-slate-700'}
        ${isSelected ? 'border-yellow-400 ring-2 ring-yellow-400/50 transform scale-105' : 'border-slate-600'}
        ${isSpeaking ? 'ring-4 ring-green-500 border-green-400' : ''}
        ${isLocalPlayer ? 'ring-1 ring-blue-500/50' : ''}
      `}
    >
      {/* Avatar */}
      <div className="relative">
        <img
          src={player.avatar}
          alt={player.name}
          className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-slate-600 object-cover"
        />
        
        {/* Dead Status */}
        {!player.isAlive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
            <span className="text-2xl">💀</span>
          </div>
        )}

        {/* Sheriff Badge */}
        {player.isSheriff && player.isAlive && (
          <div className="absolute -top-2 -left-2 bg-yellow-500 text-white rounded-full p-1 shadow-lg border border-white">
            <span className="text-xs md:text-sm">⭐</span>
          </div>
        )}

        {/* Lover Heart (Only visible to lovers/cupid) */}
        {player.loverId && (showRole || isLocalPlayer || localPlayerRole === RoleType.CUPID) && (
           <div className="absolute bottom-0 right-0 text-lg">💘</div>
        )}
        
        {/* Votes Count Badge (Result Phase Only) */}
        {showVoteResults && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-slate-900 z-10">
            {player.votesReceived.toFixed(1).replace('.0', '')}
          </div>
        )}
      </div>

      {/* Name & Role */}
      <div className="mt-2 text-center w-full">
        <p className={`text-xs md:text-sm font-semibold truncate w-full ${isLocalPlayer ? 'text-blue-400' : 'text-slate-200'}`}>
          {player.name} {isLocalPlayer && "(You)"}
        </p>
        
        <div className="h-5 mt-1 flex justify-center items-center gap-1">
          {revealRole ? (
            <div className={`text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1
              ${ROLES[player.role].team === 'WEREWOLVES' ? 'bg-red-900/50 text-red-200' : 
                ROLES[player.role].team === 'NEUTRAL' ? 'bg-purple-900/50 text-purple-200' : 'bg-green-900/50 text-green-200'}
            `}>
              <span>{ROLES[player.role].icon}</span>
              <span className="hidden md:inline">{ROLES[player.role].type}</span>
            </div>
          ) : (
            <span className="text-[10px] text-slate-500">???</span>
          )}
        </div>

        {/* Voter Names (Result Phase Only) */}
        {showVoteResults && voterNames && voterNames.length > 0 && (
          <div className="mt-1 w-full flex flex-wrap justify-center gap-1">
            {voterNames.map((name, idx) => (
              <span key={idx} className="text-[9px] bg-slate-700 px-1 rounded text-slate-300">
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerCard;
