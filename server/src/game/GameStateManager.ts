import { GameState} from '../types/game';
import { createDeck, shuffleDeck, dealCards, findHighestCard, calculateScore, findPlayableCards } from '../utils/deck';
import { v4 as uuidv4 } from 'uuid';

export class GameStateManager {
  createGameState(hostName: string, maxPlayers: number = 5): GameState {
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
        housesBuilt: 0,
        isDealer: false,
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
      chatMessages: [],
      dealerIndex: 0
    };

    return game;
  }

  shufflePlayers(game: GameState): void {
    for (let i = game.players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [game.players[i], game.players[j]] = [game.players[j], game.players[i]];
    }
  }

  initializeGameState(game: GameState): void {
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
    game.currentPlayerIndex = (game.dealerIndex + 1) % game.players.length; // Start with player after dealer
    game.lastActivity = new Date();
    game.players[game.dealerIndex].isDealer = true;
  }

  resetGameStateForNextRound(game: GameState): void {
    // Reset player states for next round
    game.players.forEach(player => {
      player.hand = [];
      player.housesBuilt = 0;
      player.enteredRound = undefined;
      player.hasExchanged = false;
      player.isReady = false;
      player.isDealer = false;
    });

    // Increment dealer
    const currentDealerIndex = game.dealerIndex;
    game.dealerIndex = (currentDealerIndex + 1) % game.players.length;
    game.players[game.dealerIndex].isDealer = true;

    // Increment round number
    game.roundNumber++;

    // Clear game state
    game.deck = [];
    game.tree = [];
    game.houses = [];
    game.trumpCard = null;
    game.currentHouse = [];
    game.leadSuit = null;
    game.currentPlayerIndex = 0;
  }

  completeHouse(game: GameState): void {
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
        
        const house = {
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
      game.currentPlayerIndex = game.players.findIndex(p => p.id === winner?.id);
    }
  }

  endGame(game: GameState): void {
    game.players.forEach(player => {
      const newScore = calculateScore(player.score, player.housesBuilt, player.enteredRound === true);
      
      // Update player score
      player.score = newScore;
    });

    // Check if game is completely finished (any player has 0 or negative score)
    const gameFinished = game.players.some(player => player.score <= 0);
    
    if (gameFinished) {
      game.gamePhase = 'finished';
    } else {
      // Go directly to waiting phase for next round
      game.gamePhase = 'waiting';
      this.resetGameStateForNextRound(game);
    }
  }

  playableCards(game: GameState, playerId: string): number[] {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return [];
    }
    
    const currentHouseCards = game.currentHouse.map(hc => hc.card);
    const playableCards = findPlayableCards(player.hand, game.leadSuit, game.trumpCard?.suit || null, currentHouseCards, game.players.filter(p => p.enteredRound).length);
    
    return playableCards;
  }

  canPlayerDecide(game: GameState, playerId: string): boolean {
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
}
