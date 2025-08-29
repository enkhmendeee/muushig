import { GameState, Player } from '../types/game';
import { v4 as uuidv4 } from 'uuid';

export class PlayerManager {
  createPlayer(playerName: string, isHost: boolean = false): Player {
    return {
      id: uuidv4(),
      name: playerName,
      hand: [],
      score: 15,
      isHost: isHost,
      isReady: false,
      housesBuilt: 0,
      isDealer: false,
      enteredRound: undefined,
      hasExchanged: false,
      isBot: false,
    };
  }

  joinGame(game: GameState, playerName: string): Player | null {
    if (game.gamePhase !== 'waiting' && game.gamePhase !== 'ready') {
      return null;
    }

    // Check if we have a bot to replace
    const botToReplace = this.getBotToReplace(game);
    if (!botToReplace) {
      return null;
    }

    const player = this.createPlayer(playerName, false);

    // Replace the bot with the real player
    const botIndex = game.players.findIndex(p => p.id === botToReplace.id);
    if (botIndex !== -1) {
      game.players[botIndex] = player;
      game.lastActivity = new Date();
      return player;
    }
    
    return null;
  }

  leaveGame(game: GameState, playerId: string): boolean {
    if (game.gamePhase !== 'waiting' && game.gamePhase !== 'ready') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }

    game.players = game.players.filter(p => p.id !== playerId);
    game.lastActivity = new Date();
    
    return true;
  }

  removePlayer(game: GameState, playerId: string): boolean {
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      return false;
    }

    game.players.splice(playerIndex, 1);
    game.lastActivity = new Date();

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

  readyCheck(game: GameState, playerId: string, isReady: boolean): boolean {
    if (game.gamePhase !== 'waiting') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }

    if (isReady) {
      player.isReady = true;
      game.lastActivity = new Date();
    } else {
      player.isReady = false;
      game.lastActivity = new Date();
    }

    // Check if all players are ready
    const allReady = game.players.every(p => p.isReady === true);
    if (allReady) {
      game.gamePhase = 'ready';
    }
    return true;
  }

  enterTurn(game: GameState, playerId: string): boolean {
    if (game.gamePhase !== 'dealing') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }

    player.enteredRound = true;
    game.lastActivity = new Date();

    if (game.players.every(p => p.enteredRound !== undefined)) {
      // All players decided, move to exchanging phase
      game.gamePhase = 'exchanging';
      // Start with player after dealer for exchanging
      game.currentPlayerIndex = (game.dealerIndex + 1) % game.players.length;
    } else {
      // Move to next undecided player
      this.nextTurnEnter(game);
    }
    return true;
  }

  skipTurn(game: GameState, playerId: string): boolean {
    if (game.gamePhase !== 'dealing') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }

    player.enteredRound = false;
    game.lastActivity = new Date();

    if (game.players.every(p => p.enteredRound !== undefined)) {
      // All players decided, move to exchanging phase
      game.gamePhase = 'exchanging';
      // Start with player after dealer for exchanging
      game.currentPlayerIndex = (game.dealerIndex + 1) % game.players.length;
    } else {
      // Move to next undecided player
      this.nextTurnEnter(game);
    }

    return true;
  }

  exchangeCards(game: GameState, playerId: string, cardIndices: number[]): boolean {
    if (game.gamePhase !== 'exchanging') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player || !player.enteredRound || game.tree.length === 0) {
      return false;
    }

    // Validate that player isn't trying to exchange more cards than available in tree
    if (cardIndices.length > game.tree.length) {
      return false;
    }

    this.swapCards(game, player, cardIndices);

    player.hasExchanged = true;
    game.lastActivity = new Date();

    // Debug exchange completion check
    const enteredPlayers = game.players.filter(p => p.enteredRound);
    const allExchanged = enteredPlayers.every(p => p.hasExchanged);

    if (allExchanged || game.tree.length === 0) {
      // All players who entered have exchanged or tree is empty
      
      // Check if dealer entered the round
      const dealer = game.players[game.dealerIndex];
      if (!dealer.enteredRound) {
        // Dealer skipped the round, skip trump exchange and go directly to playing
        game.gamePhase = 'playing';
        this.setNextPlayerFirstTurn(game);
      } else {
        // Dealer entered, proceed with trump exchange
        game.gamePhase = 'trump_exchanging';
        // Set current player to dealer for trump exchange
        game.currentPlayerIndex = game.dealerIndex;
      }
    } else {
      this.nextTurnExchange(game);
    }
    return true;
  }

  exchangeTrump(game: GameState, playerId: string, cardIndex: number): boolean {
    if (game.gamePhase !== 'trump_exchanging') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player || !player.enteredRound || !player.isDealer || !game.trumpCard) {
      return false;
    }

    // Handle skip trump exchange (cardIndex = -1)
    if (cardIndex === -1) {
      player.hasExchanged = true;
      game.lastActivity = new Date();
      
      game.gamePhase = 'playing';
      this.nextTurn(game);
      return true;
    }

    if (cardIndex < 0 || cardIndex >= player.hand.length) {
      return false;
    }

    // Exchange the card with trump card
    player.hand[cardIndex] = game.trumpCard;
    
    player.hasExchanged = true;
    game.lastActivity = new Date();
    
    game.gamePhase = 'playing';
    this.nextTurn(game);

    return true;
  }

  playCard(game: GameState, playerId: string, cardIndex: number): boolean {
    if (game.gamePhase !== 'playing') {
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
      // House is complete, will be handled by GameStateManager
    } else {
      // Move to next player
      this.nextTurn(game);
    }

    return true;
  }
  private swapCards(game: GameState, player: Player, cardIndices: number[]): boolean {
    // Exchange cards
    const cardsToExchange = cardIndices.map(i => player.hand[i]).filter(card => card);
    const newCards = game.tree.splice(0, cardsToExchange.length);
    
    // Remove old cards by creating a new hand without the exchanged cards
    const newHand = player.hand.filter((_, index) => !cardIndices.includes(index));
    
    // Replace the hand with the new hand plus the new cards
    player.hand = [...newHand, ...newCards];
    
    // Ensure hand size is exactly 5 cards
    if (player.hand.length !== 5) {
      // Fix by trimming or padding to exactly 5 cards
      if (player.hand.length > 5) {
        player.hand = player.hand.slice(0, 5);
      } else if (player.hand.length < 5 && game.tree.length > 0) {
        const additionalCards = game.tree.splice(0, 5 - player.hand.length);
        player.hand.push(...additionalCards);
      }
    }
    return true;
  }

  private setNextPlayerFirstTurn(game: GameState): void {
    // Set current player to first player who entered, starting from player after dealer
    let firstEnteredPlayerIndex = -1;
    for (let i = 1; i <= game.players.length; i++) {
      const playerIndex = (game.dealerIndex + i) % game.players.length;
      const player = game.players[playerIndex];
      if (player.enteredRound) {
        firstEnteredPlayerIndex = playerIndex;
        break;
      }
    }
    if (firstEnteredPlayerIndex !== -1) {
      game.currentPlayerIndex = firstEnteredPlayerIndex;
    }
  }

  private getBotToReplace(game: GameState): Player | null {
    // Find the first bot player
    return game.players.find(p => p.isBot) || null;
  }

  private nextTurn(game: GameState): void {
    // Find next player who has entered
    let nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
    while (!game.players[nextIndex].enteredRound) {
      nextIndex = (nextIndex + 1) % game.players.length;
    }
    game.currentPlayerIndex = nextIndex;
  }

  private nextTurnExchange(game: GameState): void {
    // Find next player who has entered but hasn't exchanged yet
    let nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
    while (!game.players[nextIndex].enteredRound || game.players[nextIndex].hasExchanged) {
      nextIndex = (nextIndex + 1) % game.players.length;
    }
    game.currentPlayerIndex = nextIndex;
  }

  private nextTurnEnter(game: GameState): void {
    let nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
    game.currentPlayerIndex = nextIndex;
  }
}
