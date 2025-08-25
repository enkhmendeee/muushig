import { Socket } from 'socket.io';
import { GameManager } from '../game/GameManager';
import { GameState} from '../types/game';

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
      console.log('Creating game with data:', data);
      const gameId = this.gameManager.createGame(data.hostName, 5); // Always 5 players
      console.log('Created game with ID:', gameId);
      const game = this.gameManager.getGame(gameId);
      
      if (game) {
        console.log('Game found after creation, setting up player socket');
        const player = game.players.find(p => !p.isBot); // Find the real player (host)
        if (player) {
          this.playerSockets.set(socket.id, { socket, gameId, playerId: player.id });
          
          socket.join(gameId);
          socket.emit('game_created', { gameId, player });
          socket.emit('game_state', this.sanitizeGameState(game, player.id));
          console.log('Game creation completed successfully');
        }
      } else {
        console.log('ERROR: Game not found after creation!');
      }
    });

    // Handle joining a game
    socket.on('join_game', (data: { gameId: string; playerName: string }) => {
      console.log(`Socket join_game request:`, data);
      const player = this.gameManager.joinGame(data.gameId, data.playerName);
      
      if (player) {
        console.log(`Player joined successfully:`, player.name);
        const game = this.gameManager.getGame(data.gameId);

        if (game) {
          socket.join(data.gameId);
          socket.emit('game_joined', { gameId: data.gameId, player });          
          // Add socket to playerSockets Map AFTER joining the room
          this.playerSockets.set(socket.id, { socket, gameId: data.gameId, playerId: player.id });
          
          // Broadcast updated game state to all players (including the new player)
          this.broadcastGameState(data.gameId);
          
          // Trigger bot turn if current player is a bot
          this.gameManager.checkAndTriggerBotTurn(data.gameId);
        }
        else {
          console.log('Game not found');
        }
      } else {
        console.log(`Failed to join game: ${data.gameId}`);
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
      if (!player?.isHost) return;

      const success = this.gameManager.startGame(data.gameId);
      if (success) {
        const updatedGame = this.gameManager.getGame(data.gameId);
        if (updatedGame) {
          // Broadcast game state to all players
          socket.to(data.gameId).emit('dealt_cards', { 
            gameId: data.gameId, 
            trumpCard: updatedGame.trumpCard 
          });
          socket.emit('dealt_cards', { 
            gameId: data.gameId, 
            trumpCard: updatedGame.trumpCard 
          });
          
          // Send updated game state to all players
          this.broadcastGameState(data.gameId);
          
          // Trigger bot turn if current player is a bot
          this.gameManager.checkAndTriggerBotTurn(data.gameId);
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
            // Trigger bot turn if next player is a bot
            this.gameManager.checkAndTriggerBotTurn(data.gameId);
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
            game.currentPlayerIndex = game.dealerIndex + 1;
            // Trigger bot turn if next player is a bot
            this.gameManager.checkAndTriggerBotTurn(data.gameId);
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
            game.currentPlayerIndex = game.dealerIndex;
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
          
          // Check if house was completed
          if (game.currentHouse.length === 0 && game.houses.length > 0) {
            const lastHouse = game.houses[game.houses.length - 1];
            const winner = game.players.find(p => p.id === lastHouse.winner);
            socket.to(data.gameId).emit('house_completed', { 
              house: lastHouse, 
              winner: winner 
            });
            socket.emit('house_completed', { 
              house: lastHouse, 
              winner: winner 
            });
          }
          
          // Check if game is finished
          if (game.gamePhase === 'finished') {
            // Find player with most houses built (winner)
            const winner = game.players.reduce((prev, current) => 
              (prev.housesBuilt > current.housesBuilt) ? prev : current, game.players[0]
            );
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
        
        // Broadcast updated game state to remaining players
        this.broadcastGameState(gameId);
        
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

    // Handle sending chat message
    socket.on('send_chat', (data: { gameId: string; message: string }) => {
      const playerSocket = this.playerSockets.get(socket.id);
      if (!playerSocket) return;

      // Validate message
      if (!data.message || data.message.trim().length === 0) {
        socket.emit('chat_error', { message: 'Message cannot be empty' });
        return;
      }

      if (data.message.length > 200) {
        socket.emit('chat_error', { message: 'Message too long (max 200 characters)' });
        return;
      }

      const chatMessage = this.gameManager.sendChatMessage(data.gameId, playerSocket.playerId, data.message);
      
      if (chatMessage) {
        // Broadcast to all players in the game
        socket.to(data.gameId).emit('chat_message', chatMessage);
        socket.emit('chat_message', chatMessage);
      } else {
        socket.emit('chat_error', { message: 'Failed to send message' });
      }
    });

    // Handle getting chat history
    socket.on('get_chat_history', (data: { gameId: string }) => {
      const playerSocket = this.playerSockets.get(socket.id);
      if (!playerSocket) return;

      const chatHistory = this.gameManager.getChatHistory(data.gameId);
      socket.emit('chat_history', { gameId: data.gameId, messages: chatHistory });
    });

    // Handle getting playable cards
    socket.on('get_playable_cards', (data: { gameId: string }) => {
      const playerSocket = this.playerSockets.get(socket.id);
      if (!playerSocket) return;

      const playableCards = this.gameManager.playableCards(data.gameId, playerSocket.playerId);
      socket.emit('playable_cards', { gameId: data.gameId, playableCards });
    });

    // Handle getting game info (for debugging)
    socket.on('get_game_info', (data: { gameId: string }) => {
      const playerSocket = this.playerSockets.get(socket.id);
      if (!playerSocket) return;

      const game = this.gameManager.getGame(data.gameId);
      if (game) {
        socket.emit('game_info', {
          gameId: data.gameId,
          phase: game.gamePhase,
          players: game.players.map(p => ({
            id: p.id,
            name: p.name,
            isDealer: p.isDealer,
            isMouth: p.isMouth,
            enteredRound: p.enteredRound,
            hasExchanged: p.hasExchanged,
            housesBuilt: p.housesBuilt
          })),
          currentHouse: game.currentHouse,
          houses: game.houses,
          trumpCard: game.trumpCard,
          dealerIndex: game.dealerIndex
        });
      }
    });

    // Handle getting all games (for debugging)
    socket.on('get_all_games', () => {
      const allGames = this.gameManager.getAllGames();
      console.log('All available games:', allGames);
      socket.emit('all_games', { games: allGames });
    });
  }

  private sanitizeGameState(game: GameState, playerId: string): any {
    // Return game state with other players' hands hidden and dates converted to strings
    return {
      id: game.id,
      players: game.players.map(player => ({
        id: player.id,
        name: player.name,
        hand: player.id === playerId ? player.hand : player.hand.length, // Only show hand count for other players
        score: player.score,
        isHost: player.isHost,
        isReady: player.isReady,
        housesBuilt: player.housesBuilt,
        isDealer: player.isDealer,
        isMouth: player.isMouth,
        enteredRound: player.enteredRound,
        hasExchanged: player.hasExchanged,
        isBot: player.isBot
      })),
      currentPlayerIndex: game.currentPlayerIndex,
      deck: game.deck,
      tree: game.tree,
      trumpCard: game.trumpCard,
      gamePhase: game.gamePhase,
      roundNumber: game.roundNumber,
      maxPlayers: game.maxPlayers,
      currentHouse: game.currentHouse,
      houses: game.houses,
      leadSuit: game.leadSuit,
      dealerIndex: game.dealerIndex,
      createdAt: game.createdAt.toISOString(),
      lastActivity: game.lastActivity.toISOString(),
      chatMessages: game.chatMessages.map(message => ({
        id: message.id,
        playerId: message.playerId,
        playerName: message.playerName,
        message: message.message,
        timestamp: message.timestamp.toISOString(),
        type: message.type
      }))
    };
  }

  private broadcastGameState(gameId: string): void {
    const game = this.gameManager.getGame(gameId);
    if (!game) return;

    // Send personalized game state to each player
    for (const [, playerSocket] of this.playerSockets.entries()) {
      if (playerSocket.gameId === gameId) {
        const sanitizedState = this.sanitizeGameState(game, playerSocket.playerId);
        playerSocket.socket.emit('game_state', sanitizedState);
      }
    }
  }
}
