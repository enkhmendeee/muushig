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
      const gameId = this.gameManager.createGame(data.hostName, data.maxPlayers || 5);
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

    // Handle ready check
    socket.on('ready_check', (data: { gameId: string; isReady: boolean }) => {
      const playerSocket = this.playerSockets.get(socket.id);
      if (!playerSocket) return;

      const success = this.gameManager.readyCheck(data.gameId, playerSocket.playerId, data.isReady);
      
      if (success) {
        const game = this.gameManager.getGame(data.gameId);
        if (game) {
          // Broadcast updated game state
          this.broadcastGameState(data.gameId);
          
          // Notify other players about ready status
          if (data.isReady) {
            socket.to(data.gameId).emit('player_ready', { playerId: playerSocket.playerId });
          } else {
            socket.to(data.gameId).emit('player_unready', { playerId: playerSocket.playerId });
          }
          
          // Check if game is ready to start
          if (game.gamePhase === 'ready') {
            socket.to(data.gameId).emit('game_ready');
            socket.emit('game_ready');
          }
        }
      } else {
        socket.emit('ready_error', { message: 'Cannot change ready status' });
      }
    });

    // Handle entering the round
    socket.on('enter_turn', (data: { gameId: string }) => {
      const playerSocket = this.playerSockets.get(socket.id);
      if (!playerSocket) return;

      const success = this.gameManager.enterTurn(data.gameId, playerSocket.playerId);
      
      if (success) {
        const game = this.gameManager.getGame(data.gameId);
        if (game) {
          // Broadcast updated game state
          this.broadcastGameState(data.gameId);
          
          // Notify other players
          socket.to(data.gameId).emit('player_entered', { playerId: playerSocket.playerId });
          
          // Check if all players have decided
          if (game.gamePhase === 'exchanging') {
            socket.to(data.gameId).emit('phase_exchanging');
            socket.emit('phase_exchanging');
          }
        }
      } else {
        socket.emit('enter_error', { message: 'Cannot enter turn' });
      }
    });

    // Handle skipping the round
    socket.on('skip_turn', (data: { gameId: string }) => {
      const playerSocket = this.playerSockets.get(socket.id);
      if (!playerSocket) return;

      const success = this.gameManager.skipTurn(data.gameId, playerSocket.playerId);
      
      if (success) {
        const game = this.gameManager.getGame(data.gameId);
        if (game) {
          // Broadcast updated game state
          this.broadcastGameState(data.gameId);
          
          // Notify other players
          socket.to(data.gameId).emit('player_declined', { playerId: playerSocket.playerId });
          
          // Check if all players have decided
          if (game.gamePhase === 'exchanging') {
            socket.to(data.gameId).emit('phase_exchanging');
            socket.emit('phase_exchanging');
          }
        }
      } else {
        socket.emit('skip_error', { message: 'Cannot skip turn' });
      }
    });

    // Handle exchanging cards
    socket.on('exchange_cards', (data: { gameId: string; cardIndices: number[] }) => {
      const playerSocket = this.playerSockets.get(socket.id);
      if (!playerSocket) return;

      const success = this.gameManager.exchangeCards(data.gameId, playerSocket.playerId, data.cardIndices);
      
      if (success) {
        const game = this.gameManager.getGame(data.gameId);
        if (game) {
          // Broadcast updated game state
          this.broadcastGameState(data.gameId);
          
          // Notify other players
          socket.to(data.gameId).emit('cards_exchanged', { 
            playerId: playerSocket.playerId, 
            cardCount: data.cardIndices.length 
          });
          
          // Check if exchange phase is complete
          if (game.gamePhase === 'trump_exchanging') {
            socket.to(data.gameId).emit('phase_trump_exchanging');
            socket.emit('phase_trump_exchanging');
          } else if (game.gamePhase === 'playing') {
            socket.to(data.gameId).emit('game_started');
            socket.emit('game_started');
          }
        }
      } else {
        socket.emit('exchange_error', { message: 'Cannot exchange cards' });
      }
    });

    // Handle exchanging trump card (dealer only)
    socket.on('exchange_trump', (data: { gameId: string; cardIndex: number }) => {
      const playerSocket = this.playerSockets.get(socket.id);
      if (!playerSocket) return;

      const success = this.gameManager.exchangeTrump(data.gameId, playerSocket.playerId, data.cardIndex);
      
      if (success) {
        const game = this.gameManager.getGame(data.gameId);
        if (game) {
          // Broadcast updated game state
          this.broadcastGameState(data.gameId);
          
          // Notify other players
          socket.to(data.gameId).emit('trump_exchanged', { 
            playerId: playerSocket.playerId, 
            cardIndex: data.cardIndex 
          });
          
          // Game starts after trump exchange
          socket.to(data.gameId).emit('game_started');
          socket.emit('game_started');
        }
      } else {
        socket.emit('trump_exchange_error', { message: 'Cannot exchange trump card' });
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
          // Broadcast updated game state
          this.broadcastGameState(data.gameId);
          
          // Notify other players about the card played
          socket.to(data.gameId).emit('card_played', { 
            playerId: playerSocket.playerId, 
            cardIndex: data.cardIndex 
          });
          
          // Check if game is finished
          if (game.gamePhase === 'finished') {
            const winner = game.players.find(p => p.hand.length === 0);
            socket.to(data.gameId).emit('game_ended', { winner });
            socket.emit('game_ended', { winner });
          } else {
            // Notify about turn change
            const currentPlayer = game.players[game.currentPlayerIndex];
            socket.to(data.gameId).emit('turn_changed', { playerId: currentPlayer.id });
            socket.emit('turn_changed', { playerId: currentPlayer.id });
          }
        }
      } else {
        socket.emit('play_error', { message: 'Invalid move' });
      }
    });

    // Handle leaving game
    socket.on('leave_game', (data: { gameId: string }) => {
      const playerSocket = this.playerSockets.get(socket.id);
      if (!playerSocket) return;

      const success = this.gameManager.leaveGame(data.gameId, playerSocket.playerId);
      
      if (success) {
        const game = this.gameManager.getGame(data.gameId);
        if (game) {
          // Notify other players
          socket.to(data.gameId).emit('player_left', { playerId: playerSocket.playerId });
          
          // Broadcast updated game state
          this.broadcastGameState(data.gameId);
          
          // Clean up socket mapping
          this.playerSockets.delete(socket.id);
          socket.leave(data.gameId);
        }
      } else {
        socket.emit('leave_error', { message: 'Cannot leave game' });
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
