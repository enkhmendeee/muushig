export interface Player {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  isHost: boolean;
  isReady: boolean;
  hasExchanged: boolean;
  housesBuilt: number;
  isDealer: boolean;
  isMouth: boolean;
  enteredRound: boolean | undefined;
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
  tree: Card[]; // undealt cards for exchange
  trumpCard: Card | null; // face-up card that determines trump suit
  gamePhase: 'waiting' | 'ready' | 'dealing' | 'entering' | 'exchanging' | 'trump_exchanging' | 'playing' | 'finished';
  roundNumber: number;
  maxPlayers: number;
  currentHouse: HouseCard[]; // cards played in current house with player info
  houses: House[]; // completed houses
  leadSuit: Card['suit'] | null; // suit of first card in current house
  createdAt: Date;
  lastActivity: Date;
  chatMessages: ChatMessage[];
  dealerIndex: number;
}



export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: Date;
  type: 'chat' | 'system' | 'game';
}
