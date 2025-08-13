import { GameState, Player, Card, GameAction, GameEvent } from '../types/game';
import { createDeck, shuffleDeck, dealCards, canPlayCard } from '../utils/deck';
import { v4 as uuidv4 } from 'uuid';

export class GameManager {
  private games: Map<string, GameState> = new Map();

  createGame(hostName: string, maxPlayers: number = 4): string {
    const gameId = uuidv4();
    const deck = shuffleDeck(createDeck());
    
    const game: GameState = {
      id: gameId,
      players: [{
        id: uuidv4(),
        name: hostName,
        hand: [],
        score: 0,
        isHost: true,
        isReady: true
      }],
      currentPlayerIndex: 0,
      deck: deck,
      discardPile: [],
      gamePhase: 'waiting',
      roundNumber: 1,
      maxPlayers,
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
      score: 0,
      isHost: false,
      isReady: false
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

    // Deal cards to all players
    const { hands, remainingDeck } = dealCards(game.deck, game.players.length);
    
    // Assign hands to players
    game.players.forEach((player, index) => {
      player.hand = hands[index];
    });

    // Set up discard pile with one card
    if (remainingDeck.length > 0) {
      game.discardPile = [remainingDeck.pop()!];
    }
    
    game.deck = remainingDeck;
    game.gamePhase = 'playing';
    game.currentPlayerIndex = 0;
    game.lastActivity = new Date();

    return true;
  }

  playCard(gameId: string, playerId: string, cardIndex: number): boolean {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'playing') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player || game.players[game.currentPlayerIndex].id !== playerId) {
      return false;
    }

    if (cardIndex < 0 || cardIndex >= player.hand.length) {
      return false;
    }

    const card = player.hand[cardIndex];
    const topCard = game.discardPile[game.discardPile.length - 1];

    if (!canPlayCard(card, topCard)) {
      return false;
    }

    // Play the card
    player.hand.splice(cardIndex, 1);
    game.discardPile.push(card);
    game.lastActivity = new Date();

    // Check if player won
    if (player.hand.length === 0) {
      game.gamePhase = 'finished';
      return true;
    }

    // Move to next player
    this.nextTurn(game);
    return true;
  }

  drawCard(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'playing') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player || game.players[game.currentPlayerIndex].id !== playerId) {
      return false;
    }

    if (game.deck.length === 0) {
      // Reshuffle discard pile (except top card)
      const topCard = game.discardPile.pop()!;
      game.deck = shuffleDeck(game.discardPile);
      game.discardPile = [topCard];
    }

    if (game.deck.length > 0) {
      const card = game.deck.pop()!;
      player.hand.push(card);
      game.lastActivity = new Date();
    }

    // Move to next player
    this.nextTurn(game);
    return true;
  }

  private nextTurn(game: GameState): void {
    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
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
