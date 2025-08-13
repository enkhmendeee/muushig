import { Socket } from 'socket.io';
import { GameManager } from '../game/GameManager';
import { GameState, Player } from '../types/game';

export class GameSocketHandler {
  private readonly gameManager: GameManager;
  private readonly playerSockets: Map<string, { socket: Socket; gameId: string; playerId: string }> = new Map();

  constructor(gameManager: GameManager) {
    this.gameManager = gameManager;
  }

  handleConnection(socket: Socket): void {
    console.log(`Player connected: ${socket.id}`);

    // Handle game creation
    socket.on('create_game', (data: { hostName: string; maxPlayers?: number }) => {
      const gameId = this.gameManager.createGame(data.hostName, data.maxPlayers || 4);
      const game = this.gameManager.getGame(gameId);
      
      if (game) {
        const player = game.players[0]; // Host is the first player
        this.playerSockets.set(socket.id, { socket, gameId, playerId: player.id });
        
        socket.join(gameId);
        socket.emit('game_created', { gameId, player });
        socket.emit('game_state', this.sanitizeGameState(game, player.id));
      }
    });

    // Handle joining a game
    socket.on('join_game', (data: { gameId: string; playerName: string }) => {
      const player = this.gameManager.joinGame(data.gameId, data.playerName);
      
      if (player) {
        const game = this.gameManager.getGame(data.gameId);
        if (game) {
          this.playerSockets.set(socket.id, { socket, gameId: data.gameId, playerId: player.id });
          
          socket.join(data.gameId);
          socket.emit('game_joined', { gameId: data.gameId, player });
          socket.emit('game_state', this.sanitizeGameState(game, player.id));
          
          // Notify other players
          socket.to(data.gameId).emit('player_joined', { player });
        }
      } else {
        socket.emit('join_error', { message: 'Could not join game' });
      }
    });

    // Handle starting the game
    socket.on('start_game', (data: { gameId: string }) => {
      const playerSocket = this.playerSockets.get(socket.id);
      if (!playerSocket) return;

      const game = this.gameManager.getGame(data.gameId);
      if (!game) return;

      const player = game.players.find(p => p.id === playerSocket.playerId);
      if (!player || !player.isHost) return;

      const success = this.gameManager.startGame(data.gameId);
      if (success) {
        const updatedGame = this.gameManager.getGame(data.gameId);
        if (updatedGame) {
          // Broadcast game state to all players
          socket.to(data.gameId).emit('game_started');
          socket.emit('game_started');
          
          // Send updated game state to all players
          this.broadcastGameState(data.gameId);
        }
      }
    });

    // Handle playing a card
    socket.on('play_card', (data: { gameId: string; cardIndex: number }) => {
      const playerSocket = this.playerSockets.get(socket.id);
      if (!playerSocket) return;

      const success = this.gameManager.playCard(data.gameId, playerSocket.playerId, data.cardIndex);
      
      if (success) {
        const game = this.gameManager.getGame(data.gameId);
        if (game) {
          // Check if game is finished
          if (game.gamePhase === 'finished') {
            socket.to(data.gameId).emit('game_ended', { winner: game.players.find(p => p.hand.length === 0) });
            socket.emit('game_ended', { winner: game.players.find(p => p.hand.length === 0) });
          } else {
            // Broadcast updated game state
            this.broadcastGameState(data.gameId);
          }
        }
      } else {
        socket.emit('play_error', { message: 'Invalid move' });
      }
    });



    // Handle disconnection
    socket.on('disconnect', () => {
      const playerSocket = this.playerSockets.get(socket.id);
      if (playerSocket) {
        const { gameId, playerId } = playerSocket;
        
        // Remove player from game
        this.gameManager.removePlayer(gameId, playerId);
        
        // Notify other players
        socket.to(gameId).emit('player_left', { playerId });
        
        // Clean up
        this.playerSockets.delete(socket.id);
        
        console.log(`Player disconnected: ${socket.id}`);
      }
    });

    // Handle getting game state
    socket.on('get_game_state', (data: { gameId: string }) => {
      const playerSocket = this.playerSockets.get(socket.id);
      if (!playerSocket) return;

      const game = this.gameManager.getGame(data.gameId);
      if (game) {
        socket.emit('game_state', this.sanitizeGameState(game, playerSocket.playerId));
      }
    });
  }

  private sanitizeGameState(game: GameState, playerId: string): any {
    // Return game state with other players' hands hidden
    return {
      ...game,
      players: game.players.map(player => ({
        ...player,
        hand: player.id === playerId ? player.hand : player.hand.length // Only show hand count for other players
      }))
    };
  }

  private broadcastGameState(gameId: string): void {
    const game = this.gameManager.getGame(gameId);
    if (!game) return;

    // Send personalized game state to each player
    for (const [socketId, playerSocket] of this.playerSockets.entries()) {
      if (playerSocket.gameId === gameId) {
        const sanitizedState = this.sanitizeGameState(game, playerSocket.playerId);
        playerSocket.socket.emit('game_state', sanitizedState);
      }
    }
  }
}
