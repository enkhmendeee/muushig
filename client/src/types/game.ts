export interface Player {
  id: string;
  name: string;
  hand: Card[] | number;
  score: number;
  isHost: boolean;
  isReady: boolean;
  housesBuilt: number;
  isDealer: boolean;
  enteredRound: boolean | undefined;
  hasExchanged: boolean;
  isBot: boolean; // New field to identify bot players
}

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
  value: number;
}

export interface HouseCard {
  card: Card;
  playerId: string;
  playerName: string;
}

export interface House {
  cards: Card[];
  winner: string; // player ID
  suit: Card['suit'];
  highestCard: Card;
}

export interface GameState {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  deck: Card[];
  tree: Card[];
  trumpCard: Card | null;
  gamePhase: 'waiting' | 'ready' | 'dealing' | 'entering' | 'exchanging' | 'trump_exchanging' | 'playing' | 'finished';
  roundNumber: number;
  maxPlayers: number;
  currentHouse: HouseCard[];
  houses: House[];
  leadSuit: Card['suit'] | null;
  dealerIndex: number;
  createdAt: string;
  lastActivity: string;
  events: unknown[];
  chatMessages: ChatMessage[];
}



export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: string;
  type: 'chat' | 'system' | 'game';
}
