import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Player, Card, HouseCard, GameState, ChatMessage } from '../types/game';
import { getSuitSymbol } from '../utils/gameUtils';

const GameRoom: React.FC<{
  socket: Socket | null;
  gameState: GameState;
  currentPlayer: Player;
  onLeaveGame: () => void;
}> = ({ socket, gameState, currentPlayer, onLeaveGame }) => {
  const [chatMessage, setChatMessage] = useState('');
  const [playableCards, setPlayableCards] = useState<number[]>([]);

  useEffect(() => {
    if (socket && gameState.gamePhase === 'playing') {
      socket.emit('get_playable_cards', { gameId: gameState.id });
    }
  }, [socket, gameState.gamePhase, gameState.currentPlayerIndex]);

  useEffect(() => {
    if (!socket) return;

    socket.on('playable_cards', (data: { gameId: string; playableCards: number[] }) => {
      if (data.gameId === gameState.id) {
        setPlayableCards(data.playableCards);
      }
    });

    return () => {
      socket.off('playable_cards');
    };
  }, [socket, gameState.id]);

  const handleReady = () => {
    if (!socket) return;
    socket.emit('ready_check', { gameId: gameState.id, isReady: true });
  };

  const handleStartGame = () => {
    if (!socket) return;
    socket.emit('start_game', { gameId: gameState.id });
  };

  const handleEnterTurn = () => {
    if (!socket) return;
    socket.emit('enter_turn', { gameId: gameState.id });
  };

  const handleSkipTurn = () => {
    if (!socket) return;
    socket.emit('skip_turn', { gameId: gameState.id });
  };

  const handlePlayCard = (cardIndex: number) => {
    if (!socket) return;
    socket.emit('play_card', { gameId: gameState.id, cardIndex });
  };

  const handleSendChat = () => {
    if (!socket || !chatMessage.trim()) return;
    socket.emit('send_chat', { gameId: gameState.id, message: chatMessage.trim() });
    setChatMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === currentPlayer.id;
  const canStartGame = currentPlayer.isHost && gameState.gamePhase === 'ready';
  const canMakeDecision = gameState.gamePhase === 'dealing' && currentPlayer.enteredRound === undefined;

  return (
    <div className="game-room">
      {/* Header */}
      <div className="game-header">
        <div className="game-info">
          <h2>Game: {gameState.id.slice(0, 8)}</h2>
          <span className={`phase-badge ${gameState.gamePhase}`}>
            {gameState.gamePhase.replace('_', ' ')}
          </span>
        </div>
        <button onClick={onLeaveGame} className="leave-btn">Leave Game</button>
      </div>

      {/* Game Area */}
      <div className="game-area">
        {/* Players */}
        <div className="players-section">
          {gameState.players.map((player, index) => (
            <div 
              key={player.id} 
              className={`player-card ${player.id === currentPlayer.id ? 'current-player' : ''} ${
                gameState.currentPlayerIndex === index ? 'active-turn' : ''
              } ${player.enteredRound === true ? 'entered' : ''} ${
                player.enteredRound === false ? 'declined' : ''
              }`}
            >
              <div className="player-info">
                <span className="player-name">
                  {player.name}
                  {player.isHost && <span className="host-badge">👑</span>}
                  {player.isDealer && <span className="dealer-badge">🎯</span>}
                  {player.isMouth && <span className="mouth-badge">👄</span>}
                </span>
                <span className="player-score">Score: {player.score}</span>
                <span className="player-houses">Houses: {player.housesBuilt}</span>
              </div>
              
              {player.id === currentPlayer.id ? (
                <div className="player-hand">
                  {Array.isArray(player.hand) ? player.hand.map((card, cardIndex) => (
                    <button 
                      key={`${card.suit}-${card.rank}-${cardIndex}`}
                      className={`card ${playableCards.includes(cardIndex) ? 'playable' : ''} ${
                        isMyTurn ? 'my-turn' : ''
                      }`}
                      onClick={() => isMyTurn && playableCards.includes(cardIndex) && handlePlayCard(cardIndex)}
                      disabled={!isMyTurn || !playableCards.includes(cardIndex)}
                      aria-label={`Play ${card.rank} of ${card.suit}`}
                    >
                      <span className={`card-rank ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'}`}>
                        {card.rank}
                      </span>
                      <span className={`card-suit ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'}`}>
                        {getSuitSymbol(card.suit)}
                      </span>
                    </button>
                  )) : (
                    <div className="card-count">{player.hand} cards</div>
                  )}
                </div>
              ) : (
                <div className="player-hand">
                  <div className="card-count">{Array.isArray(player.hand) ? player.hand.length : player.hand} cards</div>
                </div>
              )}

              <div className="player-status">
                {player.isReady && <span className="ready-badge">Ready</span>}
                {player.enteredRound === true && <span className="entered-badge">Entered</span>}
                {player.enteredRound === false && <span className="declined-badge">Declined</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Game Controls */}
        <div className="game-controls">
          {gameState.gamePhase === 'waiting' && !currentPlayer.isReady && (
            <button onClick={handleReady} className="ready-btn">Ready</button>
          )}
          
          {canStartGame && (
            <button onClick={handleStartGame} className="start-btn">Start Game</button>
          )}
          
          {canMakeDecision && (
            <div className="decision-buttons">
              <button onClick={handleEnterTurn} className="enter-btn">Enter</button>
              <button onClick={handleSkipTurn} className="skip-btn">Skip</button>
            </div>
          )}
        </div>

        {/* Trump Card */}
        {gameState.trumpCard && (
          <div className="trump-card">
            <h3>Trump Card</h3>
            <div className="card trump">
              <span className={`card-rank ${gameState.trumpCard.suit === 'hearts' || gameState.trumpCard.suit === 'diamonds' ? 'red' : 'black'}`}>
                {gameState.trumpCard.rank}
              </span>
              <span className={`card-suit ${gameState.trumpCard.suit === 'hearts' || gameState.trumpCard.suit === 'diamonds' ? 'red' : 'black'}`}>
                {getSuitSymbol(gameState.trumpCard.suit)}
              </span>
            </div>
          </div>
        )}

        {/* Current House */}
        {gameState.currentHouse.length > 0 && (
          <div className="current-house">
            <h3>Current House</h3>
            <div className="house-cards">
              {gameState.currentHouse.map((houseCard, index) => (
                <div key={`${houseCard.playerId}-${houseCard.card.suit}-${houseCard.card.rank}-${index}`} className="house-card">
                  <div className="card">
                    <span className={`card-rank ${houseCard.card.suit === 'hearts' || houseCard.card.suit === 'diamonds' ? 'red' : 'black'}`}>
                      {houseCard.card.rank}
                    </span>
                    <span className={`card-suit ${houseCard.card.suit === 'hearts' || houseCard.card.suit === 'diamonds' ? 'red' : 'black'}`}>
                      {getSuitSymbol(houseCard.card.suit)}
                    </span>
                  </div>
                  <div className="card-player">{houseCard.playerName}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="chat-section">
        <div className="chat-messages">
          {gameState.chatMessages.map((message: ChatMessage) => (
            <div key={message.id} className={`chat-message ${message.type}`}>
              <span className="message-sender">{message.playerName}:</span>
              <span className="message-text">{message.message}</span>
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input
            type="text"
            placeholder="Type a message..."
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            className="message-input"
          />
          <button onClick={handleSendChat} className="send-btn">Send</button>
        </div>
      </div>
    </div>
  );
};

export default GameRoom;
