export interface Player {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  isHost: boolean;
  isReady: boolean;
  hasEntered: boolean;
  housesBuilt: number;
  isDealer: boolean;
  isMouth: boolean;
}

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
  value: number;
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
  gamePhase: 'waiting' | 'dealing' | 'entering' | 'exchanging' | 'playing' | 'finished';
  roundNumber: number;
  maxPlayers: number;
  currentHouse: Card[]; // cards played in current house
  houses: House[]; // completed houses
  leadSuit: Card['suit'] | null; // suit of first card in current house
  createdAt: Date;
  lastActivity: Date;
}

export interface GameAction {
  type: 'enter_game' | 'decline_game' | 'exchange_cards' | 'play_card' | 'draw_card' | 'skip_turn';
  playerId: string;
  cardIndex?: number;
  card?: Card;
  exchangeCards?: number[]; // indices of cards to exchange
}

export interface GameEvent {
  type: 'player_joined' | 'player_left' | 'card_played' | 'turn_changed' | 'game_started' | 'game_ended' | 'house_completed' | 'player_entered' | 'player_declined';
  data: any;
  timestamp: Date;
}
