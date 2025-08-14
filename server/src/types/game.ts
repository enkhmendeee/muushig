export interface Player {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  isHost: boolean;
  isReady: boolean;
  hasEntered: boolean;
  hasExchanged: boolean;
  housesBuilt: number;
  isDealer: boolean;
  isMouth: boolean;
  enteredRound: boolean | undefined;
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
  gamePhase: 'waiting' | 'ready' | 'dealing' | 'entering' | 'exchanging' | 'trump_exchanging' | 'playing' | 'finished';
  roundNumber: number;
  maxPlayers: number;
  currentHouse: Card[]; // cards played in current house
  houses: House[]; // completed houses
  leadSuit: Card['suit'] | null; // suit of first card in current house
  createdAt: Date;
  lastActivity: Date;
  events: GameEvent[];
}

export interface GameEvent {
  type: 'game_created' | 'player_joined' | 'game_ready' |'player_unready' |'player_ready' | 'player_left' | 'dealt_cards' | 'card_played' | 'trump_exchanging' | 'turn_changed' | 'game_started' | 'game_ended' | 'house_completed' | 'player_entered' | 'player_declined' | 'cards_exchanged';
  data: any;
  timestamp: Date;
}
