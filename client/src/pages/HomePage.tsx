import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

const HomePage: React.FC<{
  socket: Socket | null;
}> = ({ socket }) => {
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const createGame = async () => {
    if (!socket || !playerName.trim()) return;
    
    setError('');
    setIsCreating(true);
    socket.emit('create_game', { hostName: playerName.trim() });
  };

  const joinGame = async () => {
    if (!socket || !playerName.trim() || !gameId.trim()) return;
    
    console.log('Attempting to join game:', { gameId: gameId.trim(), playerName: playerName.trim() });
    setError('');
    setIsJoining(true);
    socket.emit('join_game', { gameId: gameId.trim(), playerName: playerName.trim() });
  };

  const debugGetAllGames = () => {
    if (!socket) return;
    console.log('Requesting all games...');
    socket.emit('get_all_games');
  };

  useEffect(() => {
    if (!socket) return;

    const handleJoinError = (data: { message: string }) => {
      console.log('Join error received:', data);
      setError(data.message);
      setIsJoining(false);
    };

    const handleGameJoined = () => {
      setIsJoining(false);
      setError('');
    };

    const handleGameCreated = () => {
      setIsCreating(false);
      setError('');
    };

    const handleAllGames = (data: { games: string[] }) => {
      console.log('All available games:', data.games);
    };

    socket.on('join_error', handleJoinError);
    socket.on('game_joined', handleGameJoined);
    socket.on('game_created', handleGameCreated);
    socket.on('all_games', handleAllGames);

    return () => {
      socket.off('join_error', handleJoinError);
      socket.off('game_joined', handleGameJoined);
      socket.off('game_created', handleGameCreated);
      socket.off('all_games', handleAllGames);
    };
  }, [socket]);

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

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
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
            <button 
              onClick={debugGetAllGames} 
              className="debug-btn"
              style={{ marginTop: '10px', fontSize: '12px', padding: '5px 10px' }}
            >
              Debug: Get All Games
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
