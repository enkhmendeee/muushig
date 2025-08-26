import { GameState, Player, ChatMessage } from '../types/game';
import { BotManager } from './BotManager';
import { GameStateManager } from './GameStateManager';
import { PlayerManager } from './PlayerManager';
import { ChatService } from '../services/ChatService';

export class GameManager {
  private readonly games: Map<string, GameState> = new Map();
  private readonly botManager: BotManager = new BotManager();
  private readonly gameStateManager: GameStateManager = new GameStateManager();
  private readonly playerManager: PlayerManager = new PlayerManager();
  private readonly chatService: ChatService = new ChatService();
  private broadcastCallback?: (gameId: string) => void;

  setBroadcastCallback(callback: (gameId: string) => void): void {
    this.broadcastCallback = callback;
  }

  createGame(hostName: string, maxPlayers: number = 5): string {
    const game = this.gameStateManager.createGameState(hostName, maxPlayers);
    
    // Fill the game with bots to reach 5 players
    this.botManager.fillGameWithBots(game);
    
    this.games.set(game.id, game);
    return game.id;
  }

  joinGame(gameId: string, playerName: string): Player | null {
    const game = this.games.get(gameId);
    
    if (!game) {
      return null;
    }
    
    const player = this.playerManager.joinGame(game, playerName);
    if (player) {
      // Send system message
      this.sendSystemMessage(gameId, `${playerName} joined the game`);
    }
    
    return player;
  }

  readyCheck(gameId: string, playerId: string, isReady: boolean): boolean {
    const game = this.games.get(gameId);
    if (!game) {
      return false;
    }

    const result = this.playerManager.readyCheck(game, playerId, isReady);
    
    if (result && game.gamePhase === 'ready') {
      // Automatically start the game after a short delay
      setTimeout(() => {
        this.startGame(gameId);
        this.broadcastCallback?.(gameId);
      }, 1000); // 1 second delay
    }
    
    return result;
  }
  leaveGame(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) {
      return false;
    }
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }
    
    const playerName = player.name;
    const result = this.playerManager.leaveGame(game, playerId);
    
    if (result) {
      // Send system message
      this.sendSystemMessage(gameId, `${playerName} left the game`);
    }
    
    return result;
  }



  startGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.players.length !== 5 || game.gamePhase !== 'ready') {
      return false;
    }

    this.gameStateManager.initializeGameState(game);
    
    // Send system message
    this.sendSystemMessage(gameId, `Game started! Trump card is ${game.trumpCard?.rank} of ${game.trumpCard?.suit}`);
    
    return true;
  }





  enterTurn(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) {
      return false;
    }

    const result = this.playerManager.enterTurn(game, playerId);
    
    if (result) {
      // Broadcast state change
      this.broadcastCallback?.(gameId);
    }
    
    return result;
  }

  skipTurn(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) {
      return false;
    }

    if (!this.gameStateManager.canPlayerDecide(game, playerId)) {
      const player = game.players.find(p => p.id === playerId);
      if (player) {
        player.enteredRound = true;
        game.lastActivity = new Date();
        this.nextTurn(game);
      }
      return false; // Player cannot decline due to auto-entry rules
    }

    const result = this.playerManager.skipTurn(game, playerId);
    
    if (result) {
      // Broadcast state change
      this.broadcastCallback?.(gameId);
    }
    
    return result;
  }

  exchangeCards(gameId: string, playerId: string, cardIndices: number[]): boolean {
    const game = this.games.get(gameId);
    if (!game) {
      return false;
    }

    const result = this.playerManager.exchangeCards(game, playerId, cardIndices);
    
    if (result) {
      // Broadcast state change
      this.broadcastCallback?.(gameId);
      // Trigger bot turn if current player is a bot
      this.checkAndTriggerBotTurn(gameId);
    }
    
    return result;
  }

  exchangeTrump(gameId: string, playerId: string, cardIndex: number): boolean {
    const game = this.games.get(gameId);
    if (!game) {
      return false;
    }

    const result = this.playerManager.exchangeTrump(game, playerId, cardIndex);
    
    if (result) {
      // Broadcast state change
      this.broadcastCallback?.(gameId);
      this.checkAndTriggerBotTurn(gameId);
    }
    
    return result;
  }

  playableCards(gameId: string, playerId: string): number[] {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'playing') {
      return [];
    }

    return this.gameStateManager.playableCards(game, playerId);
  }

  playCard(gameId: string, playerId: string, cardIndex: number): boolean {
    const game = this.games.get(gameId);
    if (!game) {
      return false;
    }

    // Check if card can be played
    if (!this.playableCards(gameId, playerId).includes(cardIndex)) {
      return false;
    }

    const result = this.playerManager.playCard(game, playerId, cardIndex);
    
    if (result) {
      // Check if house is complete
      if (game.currentHouse.length === game.players.filter(p => p.enteredRound).length) {
        this.completeHouse(game);
        this.broadcastCallback?.(gameId);
        this.checkAndTriggerBotTurn(gameId);
      } else {
        // Move to next player
        this.nextTurn(game);
        // Broadcast state change
        this.broadcastCallback?.(gameId);
        // Trigger bot turn if next player is a bot
        this.checkAndTriggerBotTurn(gameId);
      }

      // Check if game is finished
      if (game.houses.length === 5) {
        this.endGame(game);
        this.broadcastCallback?.(gameId);
      }
    }

    return result;
  }

  private completeHouse(game: GameState): void {
    this.gameStateManager.completeHouse(game);
    this.broadcastCallback?.(game.id);
  }



  // Start next round (called when all players are ready)
  startNextRound(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'waiting') {
      return false;
    }

    // Check if all players are ready
    const allReady = game.players.every(p => p.isReady);
    if (!allReady) {
      return false;
    }

    // Start the new round
    return this.startGame(gameId);
  }

  private endGame(game: GameState): void {
    let roundWinner = game.players[0];
    let maxHouses = 0;

    game.players.forEach(player => {
      // Find round winner (most houses built)
      if (player.housesBuilt > maxHouses) {
        maxHouses = player.housesBuilt;
        roundWinner = player;
      }
    });

    this.gameStateManager.endGame(game);
    
    if (game.gamePhase === 'finished') {
      const finalScores = game.players.map(p => `${p.name}: ${p.score}`).join(', ');
      this.sendSystemMessage(game.id, `Game finished! Final scores: ${finalScores}`);
    } else {
      this.sendSystemMessage(game.id, `Round ${game.roundNumber - 1} finished! ${roundWinner.name} won with ${maxHouses} houses. Ready up for round ${game.roundNumber}!`);
    }

    this.broadcastCallback?.(game.id);
  }

  private nextTurn(game: GameState): void {
    // Find next player who has entered
    let nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
    while (!game.players[nextIndex].enteredRound) {
      nextIndex = (nextIndex + 1) % game.players.length;
    }
    game.currentPlayerIndex = nextIndex;
  }

  sendChatMessage(gameId: string, playerId: string, message: string): ChatMessage | null {
    const game = this.games.get(gameId);
    if (!game) {
      return null;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return null;
    }

    return this.chatService.sendChatMessage(game, playerId, player.name, message);
  }

  sendSystemMessage(gameId: string, message: string): ChatMessage | null {
    const game = this.games.get(gameId);
    if (!game) {
      return null;
    }

    return this.chatService.sendSystemMessage(game, message);
  }

  getChatHistory(gameId: string): ChatMessage[] {
    const game = this.games.get(gameId);
    return game ? this.chatService.getChatHistory(game) : [];
  }

  getGame(gameId: string): GameState | null {
    return this.games.get(gameId) || null;
  }

  getAllGames(): string[] {
    return Array.from(this.games.keys());
  }

  removePlayer(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) {
      return false;
    }

    const result = this.playerManager.removePlayer(game, playerId);

    // If no players left, remove the game
    if (game.players.length === 0) {
      this.games.delete(gameId);
      return true;
    }

    return result;
  }

  cleanupInactiveGames(maxInactiveMinutes: number = 60): void {
    const now = new Date();
    const inactiveThreshold = new Date(now.getTime() - maxInactiveMinutes * 60 * 1000);

    for (const [gameId, game] of this.games.entries()) {
      if (game.lastActivity < inactiveThreshold) {
        this.games.delete(gameId);
      }
    }
  }

  // Bot decision making methods
  async handleBotTurn(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (!currentPlayer.isBot) return;

    switch (game.gamePhase) {
      case 'dealing':
        await this.handleBotEnterDecision(gameId, currentPlayer);
        break;
      case 'exchanging':
        await this.handleBotExchange(gameId, currentPlayer);
        break;
      case 'trump_exchanging':
        await this.handleBotTrumpExchange(gameId, currentPlayer);
        break;
      case 'playing':
        await this.handleBotPlayCard(gameId, currentPlayer);
        break;
    }
  }

  private async handleBotEnterDecision(gameId: string, botPlayer: Player): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    const decision = await this.botManager.makeBotDecision(game, botPlayer, 'enter');
    if (decision) {
      this.enterTurn(gameId, botPlayer.id);
    } else {
      this.skipTurn(gameId, botPlayer.id);
    }
  }

  private async handleBotExchange(gameId: string, botPlayer: Player): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    const cardIndices = await this.botManager.makeBotDecision(game, botPlayer, 'exchange');
    this.exchangeCards(gameId, botPlayer.id, cardIndices);
  }

  private async handleBotTrumpExchange(gameId: string, botPlayer: Player): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    const cardIndex = await this.botManager.makeBotDecision(game, botPlayer, 'trump_exchange');
    if (cardIndex >= 0) {
      this.exchangeTrump(gameId, botPlayer.id, cardIndex);
    } else {
      // Skip trump exchange
      this.exchangeTrump(gameId, botPlayer.id, -1);
    }
  }

  private async handleBotPlayCard(gameId: string, botPlayer: Player): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    const cardIndex = await this.botManager.makeBotDecision(game, botPlayer, 'play');
    if (cardIndex >= 0) {
      this.playCard(gameId, botPlayer.id, cardIndex);
    }
  }
  // Check if current player is a bot and trigger bot turn
  checkAndTriggerBotTurn(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    if ((game.gamePhase === 'exchanging' || game.gamePhase === 'trump_exchanging') && !currentPlayer.enteredRound) {
      this.nextTurn(game);
    }
    
    if (currentPlayer?.isBot) {
      // Broadcast state change before bot starts thinking
      this.broadcastCallback?.(gameId);
      // Trigger bot turn asynchronously
      this.handleBotTurn(gameId);
    }
  }
}
