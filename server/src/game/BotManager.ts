import { Player, GameState} from '../types/game';
import { findPlayableCards } from '../utils/deck';
import { v4 as uuidv4 } from 'uuid';

export class BotManager {
  private readonly botNames = [
    'Bot_Altan', 'Bot_Bat', 'Bot_Bold', 'Bot_Delger', 'Bot_Enkh',
    'Bot_Ganbaa', 'Bot_Jargal', 'Bot_Khulan', 'Bot_Munkh', 'Bot_Naran',
    'Bot_Oyun', 'Bot_Purev', 'Bot_Sarnai', 'Bot_Temuulen', 'Bot_Uyanga'
  ];

  createBotPlayer(): Player {
    const randomName = this.botNames[Math.floor(Math.random() * this.botNames.length)];
    return {
      id: uuidv4(),
      name: randomName,
      hand: [],
      score: 15,
      isHost: false,
      isReady: true, // Bots are always ready
      hasExchanged: false,
      housesBuilt: 0,
      isDealer: false,
      isMouth: false,
      enteredRound: undefined,
      isBot: true,
    };
  }

  // Bot decision making with 2-second delay
  async makeBotDecision(game: GameState, botPlayer: Player, decisionType: 'enter' | 'exchange' | 'play' | 'trump_exchange'): Promise<any> {
    // Simulate bot thinking for 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    switch (decisionType) {
      case 'enter':
        return this.decideToEnter(game, botPlayer);
      case 'exchange':
        return this.decideExchange(game, botPlayer);
      case 'play':
        return this.decideCardToPlay(game, botPlayer);
      case 'trump_exchange':
        return this.decideTrumpExchange(game, botPlayer);
      default:
        return null;
    }
  }

  private decideToEnter(game: GameState, botPlayer: Player): boolean {
    // Random decision for now, but could be made smarter based on hand quality
    return Math.random() > 0.3; // 70% chance to enter
  }

  private decideExchange(game: GameState, botPlayer: Player): number[] {
    if (!Array.isArray(botPlayer.hand) || game.tree.length === 0) {
      return [];
    }

    // Randomly decide how many cards to exchange (0 to min(hand size, tree size))
    const maxExchange = Math.min(5, game.tree.length);
    const numToExchange = Math.floor(Math.random() * (maxExchange + 1));

    if (numToExchange === 0) {
      return [];
    }

    // Randomly select cards to exchange
    const indices = Array.from({ length: botPlayer.hand.length }, (_, i) => i);
    const shuffled = [...indices].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, numToExchange);
  }

  private decideCardToPlay(game: GameState, botPlayer: Player): number {
    if (!Array.isArray(botPlayer.hand) || botPlayer.hand.length === 0) {
      return -1;
    }

    // Get playable cards
    const playableCards = findPlayableCards(
      botPlayer.hand,
      game.leadSuit,
      game.trumpCard?.suit || null,
      game.currentHouse.map(hc => hc.card),
      game.players.filter(p => p.enteredRound).length
    );

    if (playableCards.length === 0) {
      return -1;
    }

    // Randomly select from playable cards
    const randomIndex = Math.floor(Math.random() * playableCards.length);
    return playableCards[randomIndex];
  }

  private decideTrumpExchange(game: GameState, botPlayer: Player): number {
    if (!Array.isArray(botPlayer.hand) || botPlayer.hand.length === 0 || !game.trumpCard) {
      return -1;
    }

    // Always exchange - find the lowest power non-trump card
    const trumpSuit = game.trumpCard.suit;
    const nonTrumpCards = botPlayer.hand
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card.suit !== trumpSuit);

    if (nonTrumpCards.length === 0) {
      // If all cards are trump, find the lowest trump card
      const trumpCards = botPlayer.hand
        .map((card, index) => ({ card, index }))
        .filter(({ card }) => card.suit === trumpSuit);
      
      if (trumpCards.length > 0) {
        const lowestTrump = trumpCards.reduce((lowest, current) => 
          current.card.value < lowest.card.value ? current : lowest
        , trumpCards[0]);
        return lowestTrump.index;
      }
      return 0; // Fallback to first card
    }

    // Find the lowest power non-trump card
    const lowestNonTrump = nonTrumpCards.reduce((lowest, current) => 
      current.card.value < lowest.card.value ? current : lowest
    , nonTrumpCards[0]);
    
    return lowestNonTrump.index;
  }

  // Get a bot player to replace when a real player joins
  getBotToReplace(game: GameState): Player | null {
    const botPlayers = game.players.filter(p => p.isBot);
    if (botPlayers.length === 0) {
      return null;
    }
    
    // Return the first bot player (could be made more sophisticated)
    return botPlayers[0];
  }

  // Check if a game needs more bots
  needsMoreBots(game: GameState): boolean {
    const realPlayers = game.players.filter(p => !p.isBot);
    return realPlayers.length < 5;
  }

  // Fill game with bots to reach 5 players
  fillGameWithBots(game: GameState): void {
    const currentPlayers = game.players.length;
    const botsNeeded = 5 - currentPlayers;

    for (let i = 0; i < botsNeeded; i++) {
      const bot = this.createBotPlayer();
      game.players.push(bot);
    }
  }
}
