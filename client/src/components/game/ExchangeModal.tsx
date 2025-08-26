import React from 'react';
import { GameState, Player } from '../../types/game';
import { getSuitSymbol } from '../../utils/gameUtils';

interface ExchangeModalProps {
  showExchangeModal: boolean;
  isTrumpExchange: boolean;
  gameState: GameState;
  currentPlayer: Player;
  selectedCardsForExchange: number[];
  onCardSelectForExchange: (cardIndex: number) => void;
  onExchangeCards: () => void;
  onSkipExchange: () => void;
}

const ExchangeModal: React.FC<ExchangeModalProps> = ({
  showExchangeModal,
  isTrumpExchange,
  gameState,
  currentPlayer,
  selectedCardsForExchange,
  onCardSelectForExchange,
  onExchangeCards,
  onSkipExchange
}) => {
  if (!showExchangeModal) {
    return null;
  }

  return (
    <div className="exchange-modal-overlay">
      <div className="exchange-modal">
        <h3>{isTrumpExchange ? 'Exchange Trump Card' : 'Exchange Cards'}</h3>
        {isTrumpExchange && gameState.trumpCard && (
          <div className="trump-card-display">
            <div className="card trump-new">
              <span className={`card-rank ${gameState.trumpCard.suit === 'hearts' || gameState.trumpCard.suit === 'diamonds' ? 'red' : 'black'}`}>
                {gameState.trumpCard.rank}
              </span>
              <span className={`card-suit ${gameState.trumpCard.suit === 'hearts' || gameState.trumpCard.suit === 'diamonds' ? 'red' : 'black'}`}>
                {getSuitSymbol(gameState.trumpCard.suit)}
              </span>
            </div>
            <div className="trump-label">Trump Card</div>
          </div>
        )}
        <p>
          {isTrumpExchange 
            ? `Select one card to exchange with the trump card (${gameState.trumpCard?.rank} of ${gameState.trumpCard?.suit})`
            : `Select cards to exchange with the tree. You can exchange up to ${gameState.tree.length} cards.`
          }
        </p>
        <div className="exchange-cards-preview">
          {Array.isArray(currentPlayer.hand) && currentPlayer.hand.map((card, index) => {
            const isSelected = selectedCardsForExchange.includes(index);
            const maxReached = !isTrumpExchange && selectedCardsForExchange.length >= gameState.tree.length && !isSelected;
            
            return (
              <button
                key={`${card.suit}-${card.rank}-${index}`}
                className={`card exchange-card ${isSelected ? 'selected' : ''} ${maxReached ? 'disabled' : ''}`}
                onClick={() => onCardSelectForExchange(index)}
                disabled={maxReached}
                title={maxReached ? `Cannot select more than ${gameState.tree.length} cards` : ''}
              >
                <span className={`card-rank ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'}`}>
                  {card.rank}
                </span>
                <span className={`card-suit ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'}`}>
                  {getSuitSymbol(card.suit)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="exchange-modal-buttons">
          <button 
            onClick={onExchangeCards}
            disabled={selectedCardsForExchange.length === 0 || (!isTrumpExchange && selectedCardsForExchange.length > gameState.tree.length)}
            className="confirm-exchange-btn"
          >
            {isTrumpExchange 
              ? `Exchange ${selectedCardsForExchange.length} Card`
              : `Exchange ${selectedCardsForExchange.length} Cards (max ${gameState.tree.length})`
            }
          </button>
          <button onClick={onSkipExchange} className="skip-exchange-btn">
            {isTrumpExchange ? 'Skip Trump Exchange' : 'Skip Exchange'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExchangeModal;
