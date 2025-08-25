import { GameState, Player, House, ChatMessage } from '../types/game';
import { createDeck, shuffleDeck, dealCards, findHighestCard, calculateScore, findPlayableCards } from '../utils/deck';
import { BotManager } from './BotManager';
import { v4 as uuidv4 } from 'uuid';

export class GameManager {
  private readonly games: Map<string, GameState> = new Map();
  private readonly botManager: BotManager = new BotManager();

  createGame(hostName: string, maxPlayers: number = 5): string {
    const gameId = uuidv4();
    console.log(`Creating new game with ID: ${gameId} for host: ${hostName}`);
    
    const game: GameState = {
      id: gameId,
      players: [{
        id: uuidv4(),
        name: hostName,
        hand: [],
        score: 15, // Start with 15 points
        isHost: true,
        isReady: false,
        housesBuilt: 0,
        isDealer: false,
        isMouth: false,
        enteredRound: undefined,
        hasExchanged: false,
        isBot: false,
      }],
      currentPlayerIndex: 0,
      deck: [],
      tree: [],
      trumpCard: null,
      gamePhase: 'waiting',
      roundNumber: 1,
      maxPlayers: 5, // Always 5 players
      currentHouse: [],
      houses: [],
      leadSuit: null,
      createdAt: new Date(),
      lastActivity: new Date(),
      events: [],
      chatMessages: [],
      dealerIndex: 0
    };

    // Fill the game with bots to reach 5 players
    this.botManager.fillGameWithBots(game);
    
    this.games.set(gameId, game);
    console.log(`Game created successfully with ${game.players.length} players (including bots). Total games: ${this.games.size}`);
    console.log(`Available game IDs:`, Array.from(this.games.keys()));
    return gameId;
  }

  joinGame(gameId: string, playerName: string): Player | null {
    console.log(`Attempting to join game: ${gameId} with player: ${playerName}`);
    const game = this.games.get(gameId);
    
    if (!game) {
      console.log(`Game not found: ${gameId}`);
      return null;
    }
    
    if (game.gamePhase !== 'waiting' && game.gamePhase !== 'ready') {
      console.log(`Game phase not suitable for joining: ${game.gamePhase}`);
      return null;
    }
    
    // Check if we have a bot to replace
    const botToReplace = this.botManager.getBotToReplace(game);
    if (!botToReplace) {
      console.log(`No bot available to replace in game: ${gameId}`);
      return null;
    }

    const player: Player = {
      id: uuidv4(),
      name: playerName,
      hand: [],
      score: 15,
      isHost: false,
      isReady: false,
      housesBuilt: 0,
      isDealer: false,
      isMouth: false,
      enteredRound: undefined,
      hasExchanged: false,
      isBot: false,
    };

    // Replace the bot with the real player
    const botIndex = game.players.findIndex(p => p.id === botToReplace.id);
    if (botIndex !== -1) {
      game.players[botIndex] = player;
      
      game.events.push({
        type: 'bot_left',
        data: { botName: botToReplace.name, gameId: game.id },
        timestamp: new Date()
      });

      game.events.push({
        type: 'player_joined',
        data: { playerName, gameId: game.id },
        timestamp: new Date()
      });

      game.lastActivity = new Date();
      
      // Send system message
      this.sendSystemMessage(gameId, `${botToReplace.name} (Bot) left and ${playerName} joined the game`);
      
      return player;
    }
    
    return null;
  }

  readyCheck(gameId: string, playerId: string, isReady: boolean): boolean {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'waiting') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }

    if (isReady) {
      player.isReady = true;
      game.lastActivity = new Date();
      game.events.push({
        type: 'player_ready',
        data: { playerId, gameId: game.id },
        timestamp: new Date()
      });
    } else {
      player.isReady = false;
      game.lastActivity = new Date();
      game.events.push({
        type: 'player_unready',
        data: { playerId, gameId: game.id },
        timestamp: new Date()
      });
    }

    // Check if all players are ready
    const allReady = game.players.every(p => p.isReady === true);
    if (allReady) {
      game.gamePhase = 'ready';
      game.events.push({
        type: 'game_ready',
        data: { gameId: game.id },
        timestamp: new Date()
      });
    }
    return true;
  }
  leaveGame(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || (game.gamePhase !== 'waiting' && game.gamePhase !== 'ready')) {
      return false;
    }
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }
    const playerName = player.name;
    game.players = game.players.filter(p => p.id !== playerId);
    game.lastActivity = new Date();
    game.events.push({
      type: 'player_left',
      data: { playerId, playerName, gameId: game.id },
      timestamp: new Date()
    });
    
    // Send system message
    this.sendSystemMessage(gameId, `${playerName} left the game`);
    
    return true;
  }

  shufflePlayers(game: GameState): void {
    for (let i = game.players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [game.players[i], game.players[j]] = [game.players[j], game.players[i]];
    }
  }

  startGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.players.length !== 5 || game.gamePhase !== 'ready') {
      return false;
    }

    // Create deck based on player count
    const deck = shuffleDeck(createDeck(game.players.length));
    
    // Deal cards to all players
    const { hands, remainingDeck, trumpCard } = dealCards(deck, game.players.length);
    
    // Assign hands to players
    game.players.forEach((player, index) => {
      player.hand = hands[index];
    });

    // Set up game state
    game.deck = remainingDeck;
    game.tree = remainingDeck; // All remaining cards go to tree
    game.trumpCard = trumpCard;
    game.gamePhase = 'dealing';
    game.currentPlayerIndex = (game.dealerIndex + 1) % game.players.length; // Start with mouth player
    game.lastActivity = new Date();
    game.players[(game.dealerIndex + 1) % game.players.length].isMouth = true;
    game.players[game.dealerIndex].isDealer = true;
    
    game.events.push({
      type: 'dealt_cards',
      data: { gameId: game.id, trumpCard },
      timestamp: new Date()
    });
    
    // Send system message
    this.sendSystemMessage(gameId, `Game started! Trump card is ${trumpCard?.rank} of ${trumpCard?.suit}`);
    
    return true;
  }



  private canPlayerDecide(game: GameState, playerId: string): boolean {
    const player = game.players.find(p => p.id === playerId);
    if (!player || player.enteredRound !== undefined) {
      return false; // Player already decided
    }

    const enteredPlayers = game.players.filter(p => p.enteredRound === true);
    const declinedPlayers = game.players.filter(p => p.enteredRound === false);
    const undecidedPlayers = game.players.filter(p => p.enteredRound === undefined);

    // If this is the last player deciding and only 1 player entered, auto-enter
    if (undecidedPlayers.length === 1 && enteredPlayers.length === 1) {
      return false; // Auto-enter, no choice
    }

    // If only 2 players remain undecided and others declined, auto-enter both
    if (undecidedPlayers.length <= 2 && declinedPlayers.length >= game.players.length - 2) {
      return false; // Auto-enter, no choice
    }

    return true; // Player can decide
  }

  enterTurn(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'dealing') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }

    player.enteredRound = true;
    game.lastActivity = new Date();
    game.events.push({
      type: 'player_entered',
      data: { playerId, gameId: game.id },
      timestamp: new Date()
    });

      if (game.players.every(p => p.enteredRound !== undefined)) {
      // All players decided, move to exchanging phase
      game.gamePhase = 'exchanging';
      // Start with mouth player for exchanging
      game.currentPlayerIndex = (game.dealerIndex + 1) % game.players.length;
      // Trigger bot turn if next player is a bot
      this.checkAndTriggerBotTurn(gameId);
    } else {
      // Move to next undecided player
      this.moveToNextUndecidedPlayer(game);
      // Trigger bot turn if next player is a bot
      this.checkAndTriggerBotTurn(gameId);
    }
    return true;
  }

  skipTurn(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'dealing') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }

    if (!this.canPlayerDecide(game, playerId)) {
      player.enteredRound = true;
      game.lastActivity = new Date();
      game.events.push({
        type: 'player_entered',
        data: { playerId, gameId: game.id },
        timestamp: new Date()
      });
      return false; // Player cannot decline due to auto-entry rules
    }

    player.enteredRound = false;
    game.lastActivity = new Date();
    game.events.push({
      type: 'player_declined',
      data: { playerId, gameId: game.id },
      timestamp: new Date()
    });

    if (game.players.every(p => p.enteredRound !== undefined)) {
      // All players decided, move to exchanging phase
      game.gamePhase = 'exchanging';
      // Start with mouth player for exchanging
      game.currentPlayerIndex = (game.dealerIndex + 1) % game.players.length;
      // Trigger bot turn if next player is a bot
      this.checkAndTriggerBotTurn(gameId);
    } else {
      // Move to next undecided player
      this.moveToNextUndecidedPlayer(game);
      // Trigger bot turn if next player is a bot
      this.checkAndTriggerBotTurn(gameId);
    }

    return true;
  }

  exchangeCards(gameId: string, playerId: string, cardIndices: number[]): boolean {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'exchanging') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player || !player.enteredRound || game.tree.length === 0) {
      return false;
    }

    // Exchange cards
    const cardsToExchange = cardIndices.map(i => player.hand[i]).filter(card => card);
    const newCards = game.tree.splice(0, cardsToExchange.length);
    
    // Remove old cards and add new ones
    const reversedIndices = [...cardIndices].reverse();
    reversedIndices.forEach(i => {
      if (i >= 0 && i < player.hand.length) {
        player.hand.splice(i, 1);
      }
    });
    
    player.hand.push(...newCards);
    player.hasExchanged = true;
    game.lastActivity = new Date();
    game.events.push({
      type: 'cards_exchanged',
      data: { playerId, gameId: game.id, cardCount: cardIndices.length },
      timestamp: new Date()
    });

    if (game.players.filter(p => p.enteredRound).every(p => p.hasExchanged) || game.tree.length === 0) {
      // All players who entered have exchanged or tree is empty
      game.gamePhase = 'trump_exchanging';
      game.events.push({
        type: 'trump_exchanging',
        data: { gameId: game.id },
        timestamp: new Date()
      }); 
      // Trigger bot turn if dealer is a bot
      this.checkAndTriggerBotTurn(gameId);
    } else {
      // Move to next player who entered but hasn't exchanged yet
      this.moveToNextPlayerToExchange(game);
      // Trigger bot turn if next player is a bot
      this.checkAndTriggerBotTurn(gameId);
    }
    return true;
  }

  exchangeTrump(gameId: string, playerId: string, cardIndex: number): boolean {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'trump_exchanging') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player || !player.enteredRound || !player.isDealer || !game.trumpCard) {
      return false;
    }

    if (cardIndex < 0 || cardIndex >= player.hand.length) {
      return false;
    }

    // Exchange the card with trump card
    player.hand[cardIndex] = game.trumpCard;
    
    player.hasExchanged = true;
    game.lastActivity = new Date();
    
    game.events.push({
      type: 'trump_exchanged',
      data: { playerId, gameId: game.id, cardIndex },
      timestamp: new Date()
    });

    game.gamePhase = 'playing';
    game.events.push({
      type: 'game_started',
      data: { gameId: game.id },
      timestamp: new Date()
    });

    return true;
  }

  playableCards(gameId: string, playerId: string): number[] {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'playing') {
      return [];
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return [];
    }
    
    const currentHouseCards = game.currentHouse.map(hc => hc.card);
    const playableCards = findPlayableCards(player.hand, game.leadSuit, game.trumpCard?.suit || null, currentHouseCards, game.players.filter(p => p.enteredRound).length);
    return playableCards;
  }

  playCard(gameId: string, playerId: string, cardIndex: number): boolean {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'playing') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player || !player.enteredRound || game.players[game.currentPlayerIndex].id !== playerId) {
      return false;
    }

    if (cardIndex < 0 || cardIndex >= player.hand.length) {
      return false;
    }

    const card = player.hand[cardIndex];

    // Check if card can be played
    if (!this.playableCards(gameId, playerId).includes(cardIndex)) {
      return false;
    }

    // Play the card
    player.hand.splice(cardIndex, 1);
    game.currentHouse.push({
      card,
      playerId: player.id,
      playerName: player.name
    });
    
    // Set lead suit if this is the first card
    if (game.currentHouse.length === 1) {
      game.leadSuit = card.suit;
    }

    game.lastActivity = new Date();

    // Check if house is complete
    if (game.currentHouse.length === game.players.filter(p => p.enteredRound).length) {
      this.completeHouse(game);
    } else {
      // Move to next player
      this.nextTurn(game);
      // Trigger bot turn if next player is a bot
      this.checkAndTriggerBotTurn(gameId);
    }

    // Check if game is finished
    if (game.houses.length === 5) {
      this.endGame(game);
    }

    return true;
  }

  private completeHouse(game: GameState): void {
    const trumpSuit = game.trumpCard?.suit || null;
    const cards = game.currentHouse.map(hc => hc.card);
    const highestCard = findHighestCard(cards, trumpSuit);
    
    // Find the player who played the highest card
    const winningHouseCard = game.currentHouse.find(hc => 
      hc.card.suit === highestCard.suit && hc.card.rank === highestCard.rank
    );
    
    if (winningHouseCard) {
      const winner = game.players.find(p => p.id === winningHouseCard.playerId);
      if (winner) {
        winner.housesBuilt++;
        
        const house: House = {
          cards: cards,
          winner: winner.id,
          suit: game.leadSuit!,
          highestCard
        };
        
        game.houses.push(house);
      }

      // Reset for next house
      game.currentHouse = [];
      game.leadSuit = null;
      const dealerIndex = game.players.findIndex(p => p.isDealer);
      game.players.find(p => p.isMouth)!.isMouth = false;
      game.players.find(p => p.isDealer)!.isDealer = false;
      game.dealerIndex = (dealerIndex + 1) % game.players.length;
    }
  }

  private endGame(game: GameState): void {
    game.gamePhase = 'finished';
    
    // Calculate final scores
    game.players.forEach(player => {
      player.score = calculateScore(player.score, player.housesBuilt, player.enteredRound === true);
    });
    game.players.forEach(player => {
      player.hand = [];
    });
    game.deck = [];
    game.tree = [];
    game.trumpCard = null;
    game.gamePhase = 'waiting';
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

    const chatMessage: ChatMessage = {
      id: uuidv4(),
      playerId: player.id,
      playerName: player.name,
      message: message.trim(),
      timestamp: new Date(),
      type: 'chat'
    };

    // Add to game's chat history (keep last 100 messages)
    game.chatMessages.push(chatMessage);
    if (game.chatMessages.length > 100) {
      game.chatMessages = game.chatMessages.slice(-100);
    }

    game.lastActivity = new Date();
    return chatMessage;
  }

  sendSystemMessage(gameId: string, message: string): ChatMessage | null {
    const game = this.games.get(gameId);
    if (!game) {
      return null;
    }

    const systemMessage: ChatMessage = {
      id: uuidv4(),
      playerId: 'system',
      playerName: 'System',
      message: message,
      timestamp: new Date(),
      type: 'system'
    };

    game.chatMessages.push(systemMessage);
    if (game.chatMessages.length > 100) {
      game.chatMessages = game.chatMessages.slice(-100);
    }

    game.lastActivity = new Date();
    return systemMessage;
  }

  getChatHistory(gameId: string): ChatMessage[] {
    const game = this.games.get(gameId);
    return game ? game.chatMessages : [];
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

    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      return false;
    }

    game.players.splice(playerIndex, 1);
    game.lastActivity = new Date();

    // If no players left, remove the game
    if (game.players.length === 0) {
      this.games.delete(gameId);
      return true;
    }

    // If host left, assign new host
    if (game.players.every(p => !p.isHost)) {
      game.players[0].isHost = true;
    }

    // Adjust current player index if needed
    if (game.currentPlayerIndex >= game.players.length) {
      game.currentPlayerIndex = 0;
    }

    return true;
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

    console.log(`Bot ${currentPlayer.name} is thinking...`);

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

  // Move to next undecided player
  private moveToNextUndecidedPlayer(game: GameState): void {
    let nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
    while (game.players[nextIndex].enteredRound !== undefined) {
      nextIndex = (nextIndex + 1) % game.players.length;
    }
    game.currentPlayerIndex = nextIndex;
  }

  // Move to next player who needs to exchange
  private moveToNextPlayerToExchange(game: GameState): void {
    let nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
    while (!game.players[nextIndex].enteredRound || game.players[nextIndex].hasExchanged) {
      nextIndex = (nextIndex + 1) % game.players.length;
    }
    game.currentPlayerIndex = nextIndex;
  }

  // Check if current player is a bot and trigger bot turn
  checkAndTriggerBotTurn(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer?.isBot) {
      // Trigger bot turn asynchronously
      this.handleBotTurn(gameId);
    }
  }
}
