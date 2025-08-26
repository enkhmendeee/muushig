import React from 'react';
import { Player } from '../../types/game';
import { getSuitSymbol } from '../../utils/gameUtils';

interface PlayerHandProps {
  player: Player;
  isCurrentPlayer: boolean;
  canPlayCard: boolean;
  playableCards: number[];
  selectedCardsForExchange: number[];
  cardOrder: number[];
  draggedCardIndex: number | null;
  onDragStart: (e: React.DragEvent, cardIndex: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, dropIndex: number) => void;
  onDragEnd: () => void;
  onCardSelectForExchange: (cardIndex: number) => void;
  onPlayCard: (cardIndex: number) => void;
}

const PlayerHand: React.FC<PlayerHandProps> = ({
  player,
  isCurrentPlayer,
  canPlayCard,
  playableCards,
  selectedCardsForExchange,
  cardOrder,
  draggedCardIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onCardSelectForExchange,
  onPlayCard
}) => {
  if (!isCurrentPlayer) {
    // Show card backs for other players
    return (
      <div className="player-hand-new">
        <div className="opponent-cards">
          {Array.isArray(player.hand) ? player.hand.map((_, cardIndex) => (
            <div key={`${player.id}-card-back-${cardIndex}`} className="card card-back"></div>
          )) : (
            <div className="card-count">{player.hand} cards</div>
          )}
        </div>
      </div>
    );
  }

  // Show actual cards for current player
  return (
    <div className="player-hand-new">
      <div className="hand-cards">
        {Array.isArray(player.hand) ? cardOrder.map((originalIndex, displayIndex) => {
          const card = (player.hand as any[])[originalIndex];
          // Skip rendering if card doesn't exist (was played)
          if (!card) return null;
          return (
            <button 
              key={`${card.suit}-${card.rank}-${originalIndex}-${displayIndex}`}
              className={`card hand-card ${playableCards.includes(originalIndex) ? 'playable' : ''} ${
                canPlayCard ? 'my-turn' : ''
              } ${selectedCardsForExchange.includes(originalIndex) ? 'selected-for-exchange' : ''} ${
                draggedCardIndex === displayIndex ? 'dragging' : ''
              }`}
              draggable={canPlayCard ? playableCards.includes(originalIndex) : true}
              onDragStart={(e) => onDragStart(e, displayIndex)}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, displayIndex)}
              onDragEnd={onDragEnd}
              onClick={() => {
                if (canPlayCard && playableCards.includes(originalIndex)) {
                  onPlayCard(originalIndex);
                } else {
                  onCardSelectForExchange(originalIndex);
                }
              }}
              disabled={canPlayCard && !playableCards.includes(originalIndex)}
              aria-label={`Play ${card.rank} of ${card.suit}`}
            >
              <span className={`card-rank ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'}`}>
                {card.rank}
              </span>
              <span className={`card-suit ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'}`}>
                {getSuitSymbol(card.suit)}
              </span>
            </button>
          );
        }) : (
          <div className="card-count">{player.hand} cards</div>
        )}
      </div>
    </div>
  );
};

export default PlayerHand;
