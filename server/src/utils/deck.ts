import { Card } from '../types/game';

export function createDeck(): Card[] {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: Card['rank'][] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  
  const deck: Card[] = [];
  
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        suit,
        rank,
        value: getCardValue(rank)
      });
    }
  }
  
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(deck: Card[], numPlayers: number, cardsPerPlayer: number = 7): {
  hands: Card[][];
  remainingDeck: Card[];
} {
  const hands: Card[][] = [];
  const remainingDeck = [...deck];
  
  // Initialize empty hands
  for (let i = 0; i < numPlayers; i++) {
    hands.push([]);
  }
  
  // Deal cards
  for (let round = 0; round < cardsPerPlayer; round++) {
    for (let player = 0; player < numPlayers; player++) {
      if (remainingDeck.length > 0) {
        const card = remainingDeck.pop()!;
        hands[player].push(card);
      }
    }
  }
  
  return { hands, remainingDeck };
}

function getCardValue(rank: Card['rank']): number {
  switch (rank) {
    case 'A': return 14;
    case 'K': return 13;
    case 'Q': return 12;
    case 'J': return 11;
    case '10': return 10;
    case '9': return 9;
    case '8': return 8;
    case '7': return 7;
    case '6': return 6;
    case '5': return 5;
    case '4': return 4;
    case '3': return 3;
    case '2': return 2;
    default: return 0;
  }
}

export function canPlayCard(card: Card, topCard: Card): boolean {
  // In Muushig, you can play a card if it matches the suit or rank of the top card
  return card.suit === topCard.suit || card.rank === topCard.rank;
}
