import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

// Types
interface Player {
  id: string;
  name: string;
  hand: Card[] | number;
  score: number;
  isHost: boolean;
  isReady: boolean;
  hasEntered: boolean;
  housesBuilt: number;
  isDealer: boolean;
  isMouth: boolean;
  enteredRound: boolean | undefined;
  hasExchanged: boolean;
}

interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
  value: number;
}

interface HouseCard {
  card: Card;
  playerId: string;
  playerName: string;
}

interface GameState {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  deck: Card[];
  tree: Card[];
  trumpCard: Card | null;
  gamePhase: 'waiting' | 'ready' | 'dealing' | 'entering' | 'exchanging' | 'trump_exchanging' | 'playing' | 'finished';
  roundNumber: number;
  maxPlayers: number;
  currentHouse: HouseCard[];
  houses: any[];
  leadSuit: string | null;
  dealerIndex: number;
  createdAt: string;
  lastActivity: string;
  events: any[];
  chatMessages: any[];
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: string;
  type: 'chat' | 'system' | 'game';
}

// Pages
const HomePage: React.FC<{
  socket: Socket | null;
  onJoinGame: (gameId: string) => void;
}> = ({ socket, onJoinGame }) => {
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const createGame = async () => {
    if (!socket || !playerName.trim()) return;
    
    setIsCreating(true);
    socket.emit('create_game', { hostName: playerName.trim() });
  };

  const joinGame = async () => {
    if (!socket || !playerName.trim() || !gameId.trim()) return;
    
    setIsJoining(true);
    socket.emit('join_game', { gameId: gameId.trim(), playerName: playerName.trim() });
  };

  return (
    <div className="home-page">
      <div className="home-container">
        <h1 className="game-title">🎮 Muushig</h1>
        <p className="game-subtitle">Traditional Mongolian Card Game</p>
        
        <div className="input-section">
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="name-input"
            maxLength={20}
          />
        </div>

        <div className="action-buttons">
          <button 
            onClick={createGame} 
            disabled={!playerName.trim() || isCreating}
            className="create-btn"
          >
            {isCreating ? 'Creating...' : 'Create New Game'}
          </button>
          
          <div className="divider">or</div>
          
          <div className="join-section">
            <input
              type="text"
              placeholder="Enter Game ID"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="game-id-input"
            />
            <button 
              onClick={joinGame} 
              disabled={!playerName.trim() || !gameId.trim() || isJoining}
              className="join-btn"
            >
              {isJoining ? 'Joining...' : 'Join Game'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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
                    <div 
                      key={cardIndex}
                      className={`card ${playableCards.includes(cardIndex) ? 'playable' : ''} ${
                        isMyTurn ? 'my-turn' : ''
                      }`}
                      onClick={() => isMyTurn && playableCards.includes(cardIndex) && handlePlayCard(cardIndex)}
                    >
                      <span className={`card-rank ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'}`}>
                        {card.rank}
                      </span>
                      <span className={`card-suit ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'}`}>
                        {card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠'}
                      </span>
                    </div>
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
                {gameState.trumpCard.suit === 'hearts' ? '♥' : gameState.trumpCard.suit === 'diamonds' ? '♦' : gameState.trumpCard.suit === 'clubs' ? '♣' : '♠'}
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
                <div key={index} className="house-card">
                  <div className="card">
                    <span className={`card-rank ${houseCard.card.suit === 'hearts' || houseCard.card.suit === 'diamonds' ? 'red' : 'black'}`}>
                      {houseCard.card.rank}
                    </span>
                    <span className={`card-suit ${houseCard.card.suit === 'hearts' || houseCard.card.suit === 'diamonds' ? 'red' : 'black'}`}>
                      {houseCard.card.suit === 'hearts' ? '♥' : houseCard.card.suit === 'diamonds' ? '♦' : houseCard.card.suit === 'clubs' ? '♣' : '♠'}
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

// Main App Component
function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    newSocket.on('game_created', (data: { gameId: string; player: Player }) => {
      setCurrentPlayer(data.player);
      console.log('Game created:', data.gameId);
    });

    newSocket.on('game_joined', (data: { gameId: string; player: Player }) => {
      setCurrentPlayer(data.player);
      console.log('Joined game:', data.gameId);
    });

    newSocket.on('game_state', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('dealt_cards', (data: { gameId: string; trumpCard: Card }) => {
      console.log('Cards dealt, trump card:', data.trumpCard);
    });

    newSocket.on('house_completed', (data: { house: any; winner: Player }) => {
      console.log('House completed by:', data.winner.name);
    });

    newSocket.on('game_ended', (data: { winner: Player }) => {
      console.log('Game ended, winner:', data.winner.name);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleLeaveGame = () => {
    if (socket && gameState) {
      socket.emit('leave_game', { gameId: gameState.id });
    }
    setGameState(null);
    setCurrentPlayer(null);
  };

  if (!isConnected) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Connecting to server...</p>
      </div>
    );
  }

  if (gameState && currentPlayer) {
    return (
      <GameRoom
        socket={socket}
        gameState={gameState}
        currentPlayer={currentPlayer}
        onLeaveGame={handleLeaveGame}
      />
    );
  }

  return (
    <HomePage
      socket={socket}
      onJoinGame={(gameId) => console.log('Joining game:', gameId)}
    />
  );
}

export default App;
