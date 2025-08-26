import React from 'react';
import { GameState } from '../../types/game';

interface GameHeaderProps {
  gameState: GameState;
  onLeaveGame: () => void;
}

const GameHeader: React.FC<GameHeaderProps> = ({ gameState, onLeaveGame }) => {
  return (
    <div className="game-header-new">
      <div className="room-info">
        <span className="phase-badge-new">{gameState.gamePhase.replace('_', ' ')}</span>
        <span className="bot-info">🤖 {gameState.players.filter(p => p.isBot).length} Bots</span>
      </div>
      <div className="room-id-center">
        <button 
          className="room-badge-clickable"
          onClick={() => {
            navigator.clipboard.writeText(gameState.id);
            // Optional: Show a brief notification
            const button = document.querySelector('.room-badge-clickable');
            if (button) {
              const originalText = button.textContent;
              button.textContent = 'Copied!';
              button.classList.add('copied');
              setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copied');
              }, 2000);
            }
          }}
          title="Click to copy game ID"
        >
          Room: {gameState.id}
        </button>
      </div>
      <button onClick={onLeaveGame} className="leave-btn-new">Leave Game</button>
    </div>
  );
};

export default GameHeader;
