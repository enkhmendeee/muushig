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

    const player = game.players.find(p => p.id === playerId);
    console.log(`[DEBUG] enterTurn: ${player?.name} (${player?.isBot ? 'BOT' : 'HUMAN'}) attempting to enter`);
    console.log(`[DEBUG] enterTurn: Game phase: ${game.gamePhase}, Current player index: ${game.currentPlayerIndex}`);

    const result = this.playerManager.enterTurn(game, playerId);
    
    if (result) {
      console.log(`[DEBUG] enterTurn: ${player?.name} successfully entered`);
      // Broadcast state change
      this.broadcastCallback?.(gameId);
      
      // Note: checkAndTriggerBotTurn is called from bot handler methods with delay
    } else {
      console.log(`[DEBUG] enterTurn: ${player?.name} enter failed`);
    }
    
    return result;
  }

  skipTurn(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    console.log(`[DEBUG] skipTurn: ${player?.name} (${player?.isBot ? 'BOT' : 'HUMAN'}) attempting to skip`);
    console.log(`[DEBUG] skipTurn: Game phase: ${game.gamePhase}, Current player index: ${game.currentPlayerIndex}`);

    if (!this.gameStateManager.canPlayerDecide(game, playerId)) {
      if (player) {
        console.log(`[DEBUG] skipTurn: ${player.name} cannot decline due to auto-entry rules, auto-entering`);
        player.enteredRound = true;
        game.lastActivity = new Date();
        this.nextTurn(game);
      }
      return false; // Player cannot decline due to auto-entry rules
    }

    const result = this.playerManager.skipTurn(game, playerId);
    
    if (result) {
      console.log(`[DEBUG] skipTurn: ${player?.name} successfully skipped`);
      // Broadcast state change
      this.broadcastCallback?.(gameId);
      
      // Note: checkAndTriggerBotTurn is called from bot handler methods with delay
    } else {
      console.log(`[DEBUG] skipTurn: ${player?.name} skip failed`);
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
      // Note: checkAndTriggerBotTurn is called from bot handler methods with delay
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
      // Note: checkAndTriggerBotTurn is called from bot handler methods with delay
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
        console.log(`[DEBUG] GameManager.playCard: House complete, completing house`);
        this.completeHouse(game);
        this.broadcastCallback?.(gameId);
        // Only trigger bot turn if current player is not a bot (bot calls are handled by bot handler)
        const currentPlayer = game.players[game.currentPlayerIndex];
        if (!currentPlayer?.isBot) {
          this.checkAndTriggerBotTurn(gameId);
        }
      } else {
        // Move to next player
        console.log(`[DEBUG] GameManager.playCard: House not complete, moving to next player`);
        this.nextTurn(game);
        // Broadcast state change
        this.broadcastCallback?.(gameId);
        // Only trigger bot turn if next player is not a bot (bot calls are handled by bot handler)
        const nextPlayer = game.players[game.currentPlayerIndex];
        if (!nextPlayer?.isBot) {
          this.checkAndTriggerBotTurn(gameId);
        }
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
    const currentPlayer = game.players[game.currentPlayerIndex];
    console.log(`[DEBUG] nextTurn: Moving from ${currentPlayer?.name} (index ${game.currentPlayerIndex})`);
    
    // Find next player who has entered
    let nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
    while (!game.players[nextIndex].enteredRound) {
      nextIndex = (nextIndex + 1) % game.players.length;
    }
    
    const nextPlayer = game.players[nextIndex];
    console.log(`[DEBUG] nextTurn: Moving to ${nextPlayer?.name} (index ${nextIndex})`);
    
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
    
    // Check for next bot turn after bot decision
    setTimeout(() => this.checkAndTriggerBotTurn(gameId), 100);
  }

  private async handleBotExchange(gameId: string, botPlayer: Player): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    const cardIndices = await this.botManager.makeBotDecision(game, botPlayer, 'exchange');
    
    // Validate all card indices are valid
    const validIndices = cardIndices.filter((index: number) => 
      index >= 0 && Array.isArray(botPlayer.hand) && index < botPlayer.hand.length
    );
    
    this.exchangeCards(gameId, botPlayer.id, validIndices);
    
    // Check for next bot turn after bot exchange
    setTimeout(() => this.checkAndTriggerBotTurn(gameId), 100);
  }

  private async handleBotTrumpExchange(gameId: string, botPlayer: Player): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    const cardIndex = await this.botManager.makeBotDecision(game, botPlayer, 'trump_exchange');
    if (cardIndex >= 0 && Array.isArray(botPlayer.hand) && cardIndex < botPlayer.hand.length) {
      this.exchangeTrump(gameId, botPlayer.id, cardIndex);
    } else {
      // Skip trump exchange
      this.exchangeTrump(gameId, botPlayer.id, -1);
    }
    
    // Check for next bot turn after bot trump exchange
    setTimeout(() => this.checkAndTriggerBotTurn(gameId), 100);
  }

  private async handleBotPlayCard(gameId: string, botPlayer: Player): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    console.log(`[DEBUG] handleBotPlayCard: ${botPlayer.name} bot turn started`);
    console.log(`[DEBUG] handleBotPlayCard: ${botPlayer.name} current hand:`, {
      length: botPlayer.hand.length,
      hand: botPlayer.hand.map((card, i) => `${i}:${card?.rank}${card?.suit}`)
    });

    const cardIndex = await this.botManager.makeBotDecision(game, botPlayer, 'play');
    console.log(`[DEBUG] handleBotPlayCard: ${botPlayer.name} bot decision returned card index: ${cardIndex}`);
    
    if (cardIndex >= 0 && Array.isArray(botPlayer.hand) && cardIndex < botPlayer.hand.length) {
      console.log(`[DEBUG] handleBotPlayCard: ${botPlayer.name} playing card at index ${cardIndex}`);
      this.playCard(gameId, botPlayer.id, cardIndex);
    } else {
      // If bot can't play a valid card, skip turn (shouldn't happen in normal gameplay)
      console.warn(`[DEBUG] handleBotPlayCard: ${botPlayer.name} couldn't play a valid card, skipping turn. cardIndex: ${cardIndex}, handLength: ${botPlayer.hand?.length}`);
    }
    
    // Check for next bot turn after bot plays card
    setTimeout(() => this.checkAndTriggerBotTurn(gameId), 100);
  }
  // Check if current player is a bot and trigger bot turn
  checkAndTriggerBotTurn(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    console.log(`[DEBUG] checkAndTriggerBotTurn: Current player: ${currentPlayer?.name} (${currentPlayer?.isBot ? 'BOT' : 'HUMAN'})`);
    console.log(`[DEBUG] checkAndTriggerBotTurn: Game phase: ${game.gamePhase}, Current player index: ${game.currentPlayerIndex}`);
    
    if ((game.gamePhase === 'exchanging' || game.gamePhase === 'trump_exchanging') && !currentPlayer.enteredRound) {
      console.log(`[DEBUG] checkAndTriggerBotTurn: Skipping ${currentPlayer?.name} - not entered round in exchange phase`);
      this.nextTurn(game);
    }
    
    if (currentPlayer?.isBot) {
      console.log(`[DEBUG] checkAndTriggerBotTurn: Triggering bot turn for ${currentPlayer.name}`);
      // Broadcast state change before bot starts thinking
      this.broadcastCallback?.(gameId);
      // Trigger bot turn asynchronously
      this.handleBotTurn(gameId);
    } else {
      console.log(`[DEBUG] checkAndTriggerBotTurn: ${currentPlayer?.name} is not a bot, no action needed`);
    }
  }
}
