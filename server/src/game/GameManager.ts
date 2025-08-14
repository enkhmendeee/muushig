import { GameState, Player, Card, House } from '../types/game';
import { createDeck, shuffleDeck, dealCards, canPlayCard, findHighestCard, calculateScore } from '../utils/deck';
import { v4 as uuidv4 } from 'uuid';

export class GameManager {
  private readonly games: Map<string, GameState> = new Map();

  createGame(hostName: string, maxPlayers: number = 5): string {
    const gameId = uuidv4();
    
    const game: GameState = {
      id: gameId,
      players: [{
        id: uuidv4(),
        name: hostName,
        hand: [],
        score: 15, // Start with 15 points
        isHost: true,
        isReady: false,
        hasEntered: true,
        housesBuilt: 0,
        isDealer: false,
        isMouth: false,
        enteredRound: undefined,
        hasExchanged: false,
      }],
      currentPlayerIndex: 0,
      deck: [],
      tree: [],
      trumpCard: null,
      gamePhase: 'waiting',
      roundNumber: 1,
      maxPlayers,
      currentHouse: [],
      houses: [],
      leadSuit: null,
      createdAt: new Date(),
      lastActivity: new Date(),
      events: []
    };
    game.events.push({
      type: 'game_created',
      data: {...game},
      timestamp: new Date()
    });
    this.games.set(gameId, game);
    return gameId;
  }

  joinGame(gameId: string, playerName: string): Player | null {
    const game = this.games.get(gameId);
    if (!game || (game.gamePhase !== 'waiting' && game.gamePhase !== 'ready') || game.players.length >= game.maxPlayers) {
      return null;
    }

    const player: Player = {
      id: uuidv4(),
      name: playerName,
      hand: [],
      score: 15,
      isHost: false,
      isReady: false,
      hasEntered: true,
      housesBuilt: 0,
      isDealer: false,
      isMouth: false,
      enteredRound: undefined,
      hasExchanged: false,
    };

    game.events.push({
      type: 'player_joined',
      data: {...game},
      timestamp: new Date()
    });

    game.players.push(player);
    game.lastActivity = new Date();
    return player;
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
        data: {...game},
        timestamp: new Date()
      });
    } else {
      player.isReady = false;
      game.lastActivity = new Date();
      game.events.push({
        type: 'player_unready',
        data: {...game},
        timestamp: new Date()
      });
    }

    // Check if all players are ready
    const allReady = game.players.every(p => p.isReady === true);
    if (allReady) {
      game.gamePhase = 'ready';
      game.events.push({
        type: 'game_ready',
        data: {...game},
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
    game.players = game.players.filter(p => p.id !== playerId);
    game.lastActivity = new Date();
    game.events.push({
      type: 'player_left',
      data: {...game},
      timestamp: new Date()
    });
    return true;
  }

  startGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.players.length < 2 || game.gamePhase !== 'ready') {
      return false;
    }

    // Shuffle players array
    for (let i = game.players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [game.players[i], game.players[j]] = [game.players[j], game.players[i]];
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
    game.currentPlayerIndex = 0;
    game.lastActivity = new Date();

    game.players[0].isMouth = true;
    game.players[game.players.length - 1].isDealer = true;
    
    game.events.push({
      type: 'dealt_cards',
      data: {...game},
      timestamp: new Date()
    });
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
      data: {...game},
      timestamp: new Date()
    });

      if (game.players.every(p => p.enteredRound !== undefined)) {
      game.gamePhase = 'exchanging';
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
        data: {...game},
        timestamp: new Date()
      });
      return false; // Player cannot decline due to auto-entry rules
    }

    player.enteredRound = false;
    game.lastActivity = new Date();
    game.events.push({
      type: 'player_declined',
      data: {...game},
      timestamp: new Date()
    });

    if (game.players.every(p => p.enteredRound !== undefined)) {
      game.gamePhase = 'exchanging';
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
      data: {...game},
      timestamp: new Date()
    });

    if (game.players.filter(p => p.enteredRound).every(p => p.hasExchanged) || game.tree.length === 0) {
      game.gamePhase = 'trump_exchanging';
      game.events.push({
        type: 'trump_exchanging',
        data: {...game},
        timestamp: new Date()
      }); 
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
      data: {...game},
      timestamp: new Date()
    });

    game.gamePhase = 'playing';
    game.events.push({
      type: 'game_started',
      data: {...game},
      timestamp: new Date()
    });

    return true;
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
    const trumpSuit = game.trumpCard?.suit || null;

    // Check if card can be played
    if (!canPlayCard(card, game.leadSuit, trumpSuit, player.hand)) {
      return false;
    }

    // Play the card
    player.hand.splice(cardIndex, 1);
    game.currentHouse.push(card);
    
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
    }

    // Check if game is finished
    if (game.players.every(p => !p.enteredRound || p.hand.length === 0)) {
      this.endGame(game);
    }

    return true;
  }

  private completeHouse(game: GameState): void {
    const trumpSuit = game.trumpCard?.suit || null;
    const highestCard = findHighestCard(game.currentHouse, trumpSuit);
    const winner = game.players.find(p => 
      p.enteredRound && p.hand.some(card => 
        card.suit === highestCard.suit && card.rank === highestCard.rank
      )
    );

    if (winner) {
      winner.housesBuilt++;
      
      const house: House = {
        cards: [...game.currentHouse],
        winner: winner.id,
        suit: game.leadSuit!,
        highestCard
      };
      
      game.houses.push(house);
    }

    // Reset for next house
    game.currentHouse = [];
    game.leadSuit = null;
    game.currentPlayerIndex = game.players.findIndex(p => p.id === winner?.id) || 0;
  }

  private endGame(game: GameState): void {
    game.gamePhase = 'finished';
    
    // Calculate final scores
    game.players.forEach(player => {
      player.score = calculateScore(player.score, player.housesBuilt, player.enteredRound === true);
    });
  }

  private nextTurn(game: GameState): void {
    // Find next player who has entered
    let nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
      while (!game.players[nextIndex].enteredRound) {
      nextIndex = (nextIndex + 1) % game.players.length;
    }
    game.currentPlayerIndex = nextIndex;
  }

  getGame(gameId: string): GameState | null {
    return this.games.get(gameId) || null;
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
}
