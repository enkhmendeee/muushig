import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: Date;
  type: 'chat' | 'system' | 'game';
}

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
}

interface GameState {
  id: string;
  players: Player[];
  gamePhase: string;
  chatMessages: ChatMessage[];
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameId, setGameId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

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
      setGameId(data.gameId);
      setCurrentPlayer(data.player);
      console.log('Game created:', data.gameId);
    });

    newSocket.on('game_joined', (data: { gameId: string; player: Player }) => {
      setGameId(data.gameId);
      setCurrentPlayer(data.player);
      console.log('Joined game:', data.gameId);
    });

    newSocket.on('game_state', (state: GameState) => {
      setGameState(state);
      setChatMessages(state.chatMessages || []);
    });

    newSocket.on('chat_message', (message: ChatMessage) => {
      setChatMessages(prev => [...prev, message]);
    });

    newSocket.on('chat_history', (data: { gameId: string; messages: ChatMessage[] }) => {
      setChatMessages(data.messages);
    });

    newSocket.on('player_joined', (data: { player: Player }) => {
      console.log('Player joined:', data.player.name);
    });

    newSocket.on('player_left', (data: { playerId: string }) => {
      console.log('Player left:', data.playerId);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const createGame = () => {
    if (socket && playerName.trim()) {
      socket.emit('create_game', { hostName: playerName.trim() });
    }
  };

  const joinGame = () => {
    if (socket && playerName.trim() && gameId.trim()) {
      socket.emit('join_game', { gameId: gameId.trim(), playerName: playerName.trim() });
    }
  };

  const sendMessage = () => {
    if (socket && newMessage.trim() && gameId) {
      socket.emit('send_chat', { gameId, message: newMessage.trim() });
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎮 Muushig Game</h1>
        <div className="connection-status">
          Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </header>

      <main className="App-main">
        {!gameState ? (
          <div className="setup-section">
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="game-actions">
              <div className="action-section">
                <h3>Create New Game</h3>
                <button onClick={createGame} disabled={!playerName.trim() || !isConnected}>
                  Create Game
                </button>
              </div>

              <div className="action-section">
                <h3>Join Existing Game</h3>
                <input
                  type="text"
                  placeholder="Enter Game ID"
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  className="input-field"
                />
                <button onClick={joinGame} disabled={!playerName.trim() || !gameId.trim() || !isConnected}>
                  Join Game
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="game-section">
            <div className="game-info">
              <h2>Game: {gameId}</h2>
              <p>Phase: {gameState.gamePhase}</p>
              <p>Players: {gameState.players.length}</p>
              {currentPlayer && (
                <p>You: {currentPlayer.name} {currentPlayer.isHost ? '(Host)' : ''}</p>
              )}
            </div>

            <div className="chat-container">
              <div className="chat-messages">
                {chatMessages.map((message) => (
                  <div key={message.id} className={`chat-message ${message.type}`}>
                    <div className="message-header">
                      <span className="player-name">{message.playerName}</span>
                      <span className="message-time">{formatTime(message.timestamp)}</span>
                    </div>
                    <div className="message-content">{message.message}</div>
                  </div>
                ))}
              </div>

              <div className="chat-input">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="message-input"
                />
                <button onClick={sendMessage} disabled={!newMessage.trim()}>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
