import React from 'react';
import { GameState, Player } from '../../types/game';

interface GameControlsProps {
  gameState: GameState;
  currentPlayer: Player;
  canMakeDecision: boolean;
  canExchange: boolean;
  canExchangeTrump: boolean;
  selectedCardsForExchange: number[];
  onReady: () => void;
  onUnready: () => void;
  onStartGame: () => void;
  onEnterTurn: () => void;
  onSkipTurn: () => void;
  onExchangeCards: () => void;
  onSkipExchange: () => void;
  onSkipTrumpExchange: () => void;
}

const GameControls: React.FC<GameControlsProps> = ({
  gameState,
  currentPlayer,
  canMakeDecision,
  canExchange,
  canExchangeTrump,
  selectedCardsForExchange,
  onReady,
  onUnready,
  onStartGame,
  onEnterTurn,
  onSkipTurn,
  onExchangeCards,
  onSkipExchange,
  onSkipTrumpExchange
}) => {
  return (
    <div className="game-controls-new">
      {gameState.gamePhase === 'waiting' && !currentPlayer.isReady && (
        <button onClick={onReady} className="ready-btn-new">Ready</button>
      )}

      {(gameState.gamePhase === 'waiting') && currentPlayer.isReady && (
        <button onClick={onUnready} className="unready-btn-new">Unready</button>
      )}
      
      {currentPlayer.isHost && gameState.gamePhase === 'ready' && (
        <button onClick={onStartGame} className="start-btn-new">Start Game</button>
      )}
      
      {canMakeDecision && (
        <div className="decision-buttons-new">
          <button onClick={onEnterTurn} className="enter-btn-new">Enter</button>
          <button onClick={onSkipTurn} className="skip-btn-new">Skip</button>
        </div>
      )}

      {canExchange && (
        <div className="exchange-controls">
          <button 
            onClick={onExchangeCards}
            disabled={selectedCardsForExchange.length === 0 || selectedCardsForExchange.length > gameState.tree.length}
            className="exchange-btn"
          >
            Exchange {selectedCardsForExchange.length} Cards (max {gameState.tree.length})
          </button>
          <button onClick={onSkipExchange} className="skip-exchange-btn">
            Skip Exchange
          </button>
        </div>
      )}

      {canExchangeTrump && (
        <div className="exchange-controls">
          <button 
            onClick={onExchangeCards}
            disabled={selectedCardsForExchange.length !== 1}
            className="exchange-btn"
          >
            Exchange {selectedCardsForExchange.length} Card with Trump
          </button>
          <button onClick={onSkipTrumpExchange} className="skip-exchange-btn">
            Skip Trump Exchange
          </button>
        </div>
      )}
    </div>
  );
};

export default GameControls;
