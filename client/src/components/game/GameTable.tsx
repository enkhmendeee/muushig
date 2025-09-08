import React from 'react';
import { GameState, Player } from '../../types/game';
import { getSuitSymbol } from '../../utils/gameUtils';
import PlayerHand from './PlayerHand';

interface GameTableProps {
  gameState: GameState;
  currentPlayer: Player;
  canPlayCard: boolean;
  playableCards: number[];
  selectedCardsForExchange: number[];
  cardOrder: number[];
  draggedCardIndex: number | null;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, dropIndex: number) => void;
  onDropToPlay: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, cardIndex: number) => void;
  onDragEnd: () => void;
  onCardSelectForExchange: (cardIndex: number) => void;
  onPlayCard: (cardIndex: number) => void;
  botActionMessage: string;
}

const GameTable: React.FC<GameTableProps> = ({
  gameState,
  currentPlayer,
  canPlayCard,
  playableCards,
  selectedCardsForExchange,
  cardOrder,
  draggedCardIndex,
  onDragOver,
  onDrop,
  onDropToPlay,
  onDragStart,
  onDragEnd,
  onCardSelectForExchange,
  onPlayCard,
  botActionMessage
}) => {
  const actualPlayerIndex = gameState.players.findIndex(player => player.id === currentPlayer.id);

  // Calculate player positions around the table
  const getPlayerPosition = (index: number, totalPlayers: number, actualPlayerIndex: number) => {
    // Calculate relative position (how many positions away from current player)
    let relativeIndex = index - actualPlayerIndex;
    if (relativeIndex < 0) {
      relativeIndex += totalPlayers;
    }
    
    // Position current player at bottom (270 degrees), others relative to that
    const angle = (relativeIndex * 360) / totalPlayers + 90; // Start from bottom
    
    // Adjust radius based on number of players to prevent overlapping
    const baseRadius = 250;
    const radius = totalPlayers <= 3 ? baseRadius : baseRadius + (totalPlayers - 3) * 30;
    
    const x = Math.cos((angle * Math.PI) / 180) * radius;
    const y = Math.sin((angle * Math.PI) / 180) * radius;
    
    return { x, y };
  };

  return (
    <div className="game-table-container">
      <div className="game-table">
        {/* Central Table Area */}
        <section 
          className={`table-center ${canPlayCard ? 'play-drop-zone' : ''}`}
          aria-label={canPlayCard ? "Card drop zone" : undefined}
          onDragOver={canPlayCard ? onDragOver : undefined}
          onDragLeave={(e) => {
            if (canPlayCard && !e.currentTarget.contains(e.relatedTarget as Node)) {
              e.currentTarget.classList.remove('drag-over');
            }
          }}
          onDrop={canPlayCard ? onDropToPlay : undefined}
        >
          {/* Trump Card */}
          {gameState.trumpCard && (
            <div className="trump-card-new">
              <div className="card trump-new">
                <span className={`card-rank ${gameState.trumpCard.suit === 'hearts' || gameState.trumpCard.suit === 'diamonds' ? 'red' : 'black'}`}>
                  {gameState.trumpCard.rank}
                </span>
                <span className={`card-suit ${gameState.trumpCard.suit === 'hearts' || gameState.trumpCard.suit === 'diamonds' ? 'red' : 'black'}`}>
                  {getSuitSymbol(gameState.trumpCard.suit)}
                </span>
              </div>
              <div className="trump-label">Trump</div>
            </div>
          )}

          {/* Tree Cards */}
          <div className="tree-cards">
            <div className="tree-card-back"></div>
            <div className="tree-count">{gameState.tree.length}</div>
          </div>

          {/* Current House */}
          {gameState.currentHouse.length > 0 && (
            <div className="current-house-new">
              <div className="house-label">Current House</div>
              <div className="house-cards-new">
                {gameState.currentHouse.map((houseCard, index) => (
                  <div key={`${houseCard.playerId}-${houseCard.card.suit}-${houseCard.card.rank}-${index}`} className="house-card-new">
                    <div className="card house-card">
                      <span className={`card-rank ${houseCard.card.suit === 'hearts' || houseCard.card.suit === 'diamonds' ? 'red' : 'black'}`}>
                        {houseCard.card.rank}
                      </span>
                      <span className={`card-suit ${houseCard.card.suit === 'hearts' || houseCard.card.suit === 'diamonds' ? 'red' : 'black'}`}>
                        {getSuitSymbol(houseCard.card.suit)}
                      </span>
                    </div>
                    <div className="card-player-name">{houseCard.playerName}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* House Completed Overlay */}
          {gameState.currentHouse.length === gameState.players.filter(p => p.enteredRound).length && gameState.currentHouse.length > 0 && (
            <div className="house-completed-overlay">
              <div className="house-completed-message">
                <div className="house-completed-title">House Complete!</div>
                {(() => {
                  // Find the winner of this house
                  const trumpSuit = gameState.trumpCard?.suit || null;
                  const cards = gameState.currentHouse.map(hc => hc.card);
                  const highestCard = cards.reduce((highest, card) => {
                    if (card.suit === trumpSuit && highest.suit !== trumpSuit) return card;
                    if (card.suit === highest.suit && highest.suit !== trumpSuit) {
                      return ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'].indexOf(card.rank) > 
                             ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'].indexOf(highest.rank) ? card : highest;
                    }
                    if (card.suit === trumpSuit && highest.suit === trumpSuit) {
                      return ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'].indexOf(card.rank) > 
                             ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'].indexOf(highest.rank) ? card : highest;
                    }
                    return highest;
                  });
                  
                  const winningHouseCard = gameState.currentHouse.find(hc => 
                    hc.card.suit === highestCard.suit && hc.card.rank === highestCard.rank
                  );
                  
                  return winningHouseCard ? (
                    <div className="house-winner">
                      {winningHouseCard.playerName} wins with {highestCard.rank}{highestCard.suit === 'hearts' ? '♥' : highestCard.suit === 'diamonds' ? '♦' : highestCard.suit === 'clubs' ? '♣' : '♠'}
                    </div>
                  ) : null;
                })()}
                <div className="house-completed-subtitle">Moving to next house...</div>
              </div>
            </div>
          )}

          {/* Completed Houses */}
          {gameState.houses.length > 0 && (
            <div className="completed-houses">
              <div className="houses-label">Completed Houses: {gameState.houses.length}/5</div>
            </div>
          )}

          {/* Game Status Message */}
          {gameState.gamePhase === 'dealing' && (
            <div className="game-status">
              {gameState.players[gameState.currentPlayerIndex]?.isBot ? '🤖 ' : ''}
              {gameState.players[gameState.currentPlayerIndex]?.name} is deciding to enter...
              {gameState.players[gameState.currentPlayerIndex]?.isBot && ' (thinking...)'}
            </div>
          )}
          {gameState.gamePhase === 'exchanging' && (
            <div className="game-status">
              {gameState.players[gameState.currentPlayerIndex]?.isBot ? '🤖 ' : ''}
              {gameState.players[gameState.currentPlayerIndex]?.name} is exchanging cards...
              {gameState.players[gameState.currentPlayerIndex]?.isBot && ' (thinking...)'}
            </div>
          )}
          {gameState.gamePhase === 'trump_exchanging' && (
            <div className="game-status">
              {gameState.players[gameState.currentPlayerIndex]?.isBot ? '🤖 ' : ''}
              {gameState.players[gameState.currentPlayerIndex]?.name} is exchanging trump card...
              {gameState.players[gameState.currentPlayerIndex]?.isBot && ' (thinking...)'}
            </div>
          )}
          {gameState.gamePhase === 'playing' && (
            <div className="game-status">
              {gameState.players[gameState.currentPlayerIndex]?.isBot ? '🤖 ' : ''}
              {gameState.players[gameState.currentPlayerIndex]?.name} is playing a card...
              {gameState.players[gameState.currentPlayerIndex]?.isBot && ' (thinking...)'}
            </div>
          )}
          
          {/* Bot Action Notification */}
          {botActionMessage && (
            <div className="bot-action-notification">
              {botActionMessage}
            </div>
          )}
        </section>

        {/* Players Around the Table */}
        {gameState.players.map((player, index) => {
          const position = getPlayerPosition(index, gameState.players.length, actualPlayerIndex);
          const isCurrentPlayer = player.id === currentPlayer.id;
          const isActiveTurn = gameState.currentPlayerIndex === index;
          
          return (
            <div
              key={player.id}
              className={`player-position ${isCurrentPlayer ? 'current-player' : ''} ${isActiveTurn ? 'active-turn' : ''}`}
              style={{
                '--x': `${position.x}px`,
                '--y': `${position.y}px`
              } as React.CSSProperties}
            >
              <div className="player-avatar">
                {player.isHost && <span className="crown">👑</span>}
                {player.isDealer && <span className="dealer-icon">🎯</span>}
                {(gameState.dealerIndex + 1) % gameState.players.length === index && <span className="mouth-icon">👄</span>}
                {player.isBot && <span className="bot-icon">🤖</span>}
                <div className="avatar-icon">
                  {player.name.charAt(0).toUpperCase()}
                </div>
              </div>
              
              <div className="player-info-new">
                <div className="player-name-new">{player.name}</div>
                <div className="player-score-new">{player.score}/-</div>
                <div className="player-houses-new">Houses: {player.housesBuilt}</div>
              </div>

              {/* Player Hand */}
              <PlayerHand
                player={player}
                isCurrentPlayer={isCurrentPlayer}
                canPlayCard={canPlayCard}
                playableCards={playableCards}
                selectedCardsForExchange={selectedCardsForExchange}
                cardOrder={cardOrder}
                draggedCardIndex={draggedCardIndex}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                onCardSelectForExchange={onCardSelectForExchange}
                onPlayCard={onPlayCard}
              />

              {/* Player Status */}
              <div className="player-status-new">
                {player.isReady && <span className="ready-badge-new">Ready</span>}
                {player.enteredRound === true && <span className="entered-badge-new">Entered</span>}
                {player.enteredRound === false && <span className="declined-badge-new">Declined</span>}
                {player.hasExchanged && <span className="exchanged-badge-new">Exchanged</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GameTable;
