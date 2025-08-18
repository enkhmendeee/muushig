import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';
import HomePage from './pages/HomePage';
import GameRoom from './pages/GameRoom';
import { Player, Card, GameState, ChatMessage } from './types/game';

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

    newSocket.on('chat_message', (message: ChatMessage) => {
      console.log('Chat message received:', message);
      // Update game state with new chat message
      setGameState(prevState => {
        if (!prevState) return prevState;
        return {
          ...prevState,
          chatMessages: [...prevState.chatMessages, message]
        };
      });
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
    />
  );
}

export default App;
