import { GameState, Player, Card, GameAction, GameEvent, House } from '../types/game';
import { createDeck, shuffleDeck, dealCards, canPlayCard, findHighestCard, calculateScore } from '../utils/deck';
import { v4 as uuidv4 } from 'uuid';

export class GameManager {
  private games: Map<string, GameState> = new Map();

  createGame(hostName: string, maxPlayers: number = 5): string {
    const gameId = uuidv4();
    const deck = shuffleDeck(createDeck(maxPlayers));
    
    const game: GameState = {
      id: gameId,
      players: [{
        id: uuidv4(),
        name: hostName,
        hand: [],
        score: 15, // Start with 15 points
        isHost: true,
        isReady: true,
        hasEntered: false,
        housesBuilt: 0,
        isDealer: true,
        isMouth: true
      }],
      currentPlayerIndex: 0,
      deck: deck,
      tree: [],
      trumpCard: null,
      gamePhase: 'waiting',
      roundNumber: 1,
      maxPlayers,
      currentHouse: [],
      houses: [],
      leadSuit: null,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.games.set(gameId, game);
    return gameId;
  }

  joinGame(gameId: string, playerName: string): Player | null {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'waiting' || game.players.length >= game.maxPlayers) {
      return null;
    }

    const player: Player = {
      id: uuidv4(),
      name: playerName,
      hand: [],
      score: 15,
      isHost: false,
      isReady: false,
      hasEntered: false,
      housesBuilt: 0,
      isDealer: false,
      isMouth: false
    };

    game.players.push(player);
    game.lastActivity = new Date();
    
    return player;
  }

  startGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.players.length < 2 || game.gamePhase !== 'waiting') {
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
    game.currentPlayerIndex = 0;
    game.lastActivity = new Date();

    return true;
  }

  enterGame(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'dealing') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }

    player.hasEntered = true;
    game.lastActivity = new Date();

    // Check if all players have decided
    const allDecided = game.players.every(p => p.hasEntered !== undefined);
    if (allDecided) {
      // Auto-enter last two players if others declined
      const enteredPlayers = game.players.filter(p => p.hasEntered);
      if (enteredPlayers.length <= 1) {
        // Last two players must enter
        const remainingPlayers = game.players.filter(p => !p.hasEntered);
        remainingPlayers.slice(-2).forEach(p => p.hasEntered = true);
      }
      
      game.gamePhase = 'exchanging';
    }

    return true;
  }

  declineGame(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'dealing') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }

    player.hasEntered = false;
    game.lastActivity = new Date();

    // Check if all players have decided
    const allDecided = game.players.every(p => p.hasEntered !== undefined);
    if (allDecided) {
      // Auto-enter last two players if others declined
      const enteredPlayers = game.players.filter(p => p.hasEntered);
      if (enteredPlayers.length <= 1) {
        const remainingPlayers = game.players.filter(p => !p.hasEntered);
        remainingPlayers.slice(-2).forEach(p => p.hasEntered = true);
      }
      
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
    if (!player || !player.hasEntered || game.tree.length === 0) {
      return false;
    }

    // Exchange cards
    const cardsToExchange = cardIndices.map(i => player.hand[i]).filter(card => card);
    const newCards = game.tree.splice(0, cardsToExchange.length);
    
    // Remove old cards and add new ones
    cardIndices.reverse().forEach(i => {
      if (i >= 0 && i < player.hand.length) {
        player.hand.splice(i, 1);
      }
    });
    
    player.hand.push(...newCards);
    game.lastActivity = new Date();

    return true;
  }

  playCard(gameId: string, playerId: string, cardIndex: number): boolean {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'playing') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player || !player.hasEntered || game.players[game.currentPlayerIndex].id !== playerId) {
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
    if (game.currentHouse.length === game.players.filter(p => p.hasEntered).length) {
      this.completeHouse(game);
    } else {
      // Move to next player
      this.nextTurn(game);
    }

    // Check if game is finished
    if (game.players.every(p => !p.hasEntered || p.hand.length === 0)) {
      this.endGame(game);
    }

    return true;
  }

  private completeHouse(game: GameState): void {
    const trumpSuit = game.trumpCard?.suit || null;
    const highestCard = findHighestCard(game.currentHouse, trumpSuit);
    const winner = game.players.find(p => 
      p.hasEntered && p.hand.some(card => 
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
      player.score = calculateScore(player.score, player.housesBuilt, player.hasEntered);
    });
  }

  private nextTurn(game: GameState): void {
    // Find next player who has entered
    let nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
    while (!game.players[nextIndex].hasEntered) {
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
