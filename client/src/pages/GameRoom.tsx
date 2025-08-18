import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Player, GameState, ChatMessage } from '../types/game';
import { getSuitSymbol } from '../utils/gameUtils';

const GameRoom: React.FC<{
  socket: Socket | null;
  gameState: GameState;
  currentPlayer: Player;
  onLeaveGame: () => void;
}> = ({ socket, gameState, currentPlayer, onLeaveGame }) => {
  const [chatMessage, setChatMessage] = useState('');
  const [playableCards, setPlayableCards] = useState<number[]>([]);
  const [showChat, setShowChat] = useState(false);

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

  // Calculate player positions around the table
  const getPlayerPosition = (index: number, totalPlayers: number) => {
    const angle = (index * 360) / totalPlayers - 90; // Start from top
    const radius = 200; // Distance from center
    const x = Math.cos((angle * Math.PI) / 180) * radius;
    const y = Math.sin((angle * Math.PI) / 180) * radius;
    return { x, y };
  };

  return (
    <div className="game-room-new">
      {/* Header */}
      <div className="game-header-new">
        <div className="room-info">
          <span className="room-badge">Room: {gameState.id.slice(0, 8)}</span>
          <span className="phase-badge-new">{gameState.gamePhase.replace('_', ' ')}</span>
        </div>
        <button onClick={onLeaveGame} className="leave-btn-new">Leave Game</button>
      </div>

      {/* Game Table */}
      <div className="game-table-container">
        <div className="game-table">
          {/* Central Table Area */}
          <div className="table-center">
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

            {/* Game Status Message */}
            {gameState.gamePhase === 'dealing' && (
              <div className="game-status">
                {gameState.players.find(p => p.enteredRound === undefined)?.name || 'Someone'} is deciding to enter...
              </div>
            )}
          </div>

          {/* Players Around the Table */}
          {gameState.players.map((player, index) => {
            const position = getPlayerPosition(index, gameState.players.length);
            const isCurrentPlayer = player.id === currentPlayer.id;
            const isActiveTurn = gameState.currentPlayerIndex === index;
            
            return (
              <div
                key={player.id}
                className={`player-position ${isCurrentPlayer ? 'current-player' : ''} ${isActiveTurn ? 'active-turn' : ''}`}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px)`
                }}
              >
                <div className="player-avatar">
                  {player.isHost && <span className="crown">👑</span>}
                  {player.isDealer && <span className="dealer-icon">🎯</span>}
                  {player.isMouth && <span className="mouth-icon">👄</span>}
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
                <div className="player-hand-new">
                  {isCurrentPlayer ? (
                    // Show actual cards for current player
                    <div className="hand-cards">
                      {Array.isArray(player.hand) ? player.hand.map((card, cardIndex) => (
                        <button 
                          key={`${card.suit}-${card.rank}-${cardIndex}`}
                          className={`card hand-card ${playableCards.includes(cardIndex) ? 'playable' : ''} ${
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
                    // Show card backs for other players
                    <div className="opponent-cards">
                      {Array.isArray(player.hand) ? player.hand.map((_, cardIndex) => (
                        <div key={cardIndex} className="card card-back"></div>
                      )) : (
                        <div className="card-count">{player.hand} cards</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Player Status */}
                <div className="player-status-new">
                  {player.isReady && <span className="ready-badge-new">Ready</span>}
                  {player.enteredRound === true && <span className="entered-badge-new">Entered</span>}
                  {player.enteredRound === false && <span className="declined-badge-new">Declined</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Game Controls */}
      <div className="game-controls-new">
        {gameState.gamePhase === 'waiting' && !currentPlayer.isReady && (
          <button onClick={handleReady} className="ready-btn-new">Ready</button>
        )}
        
        {canStartGame && (
          <button onClick={handleStartGame} className="start-btn-new">Start Game</button>
        )}
        
        {canMakeDecision && (
          <div className="decision-buttons-new">
            <button onClick={handleEnterTurn} className="enter-btn-new">Enter</button>
            <button onClick={handleSkipTurn} className="skip-btn-new">Skip</button>
          </div>
        )}
      </div>

      {/* Chat Toggle */}
      <button 
        onClick={() => setShowChat(!showChat)} 
        className="chat-toggle-btn"
      >
        💬
      </button>

      {/* Chat Panel */}
      {showChat && (
        <div className="chat-panel">
          <div className="chat-header">
            <h3>Chat</h3>
            <button onClick={() => setShowChat(false)} className="close-chat">×</button>
          </div>
          <div className="chat-messages-new">
            {gameState.chatMessages.map((message: ChatMessage) => (
              <div key={message.id} className={`chat-message-new ${message.type}`}>
                <span className="message-sender">{message.playerName}:</span>
                <span className="message-text">{message.message}</span>
              </div>
            ))}
          </div>
          <div className="chat-input-new">
            <input
              type="text"
              placeholder="Type a message..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              className="message-input-new"
            />
            <button onClick={handleSendChat} className="send-btn-new">Send</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameRoom;
