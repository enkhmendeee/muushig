export interface Player {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  isHost: boolean;
  isReady: boolean;
}

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
  value: number;
}

export interface GameState {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  deck: Card[];
  discardPile: Card[];
  gamePhase: 'waiting' | 'playing' | 'finished';
  roundNumber: number;
  maxPlayers: number;
  createdAt: Date;
  lastActivity: Date;
}

export interface GameAction {
  type: 'play_card' | 'draw_card' | 'skip_turn';
  playerId: string;
  cardIndex?: number;
  card?: Card;
}

export interface GameEvent {
  type: 'player_joined' | 'player_left' | 'card_played' | 'turn_changed' | 'game_started' | 'game_ended';
  data: any;
  timestamp: Date;
}
