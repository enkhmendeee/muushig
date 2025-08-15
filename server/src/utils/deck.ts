import { Card } from '../types/game';

export function createDeck(numPlayers: number = 5): Card[] {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  
  // Determine which ranks to include based on player count
  let ranks: Card['rank'][] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  
  // Remove lower cards for fewer players
  if (numPlayers === 2) {
    ranks = ['J', 'Q', 'K', 'A']; // Remove 7, 8, 9, 10
  } else if (numPlayers === 3) {
    ranks = ['9', '10', 'J', 'Q', 'K', 'A']; // Remove 7, 8
  } else if (numPlayers === 4) {
    ranks = ['8', '9', '10', 'J', 'Q', 'K', 'A']; // Remove 7
  }
  // 5 players use all cards: 7, 8, 9, 10, J, Q, K, A
  
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

export function dealCards(deck: Card[], numPlayers: number, cardsPerPlayer: number = 5): {
  hands: Card[][];
  remainingDeck: Card[];
  trumpCard: Card | null;
} {
  const hands: Card[][] = [];
  const remainingDeck = [...deck];
  
  // Initialize empty hands
  for (let i = 0; i < numPlayers; i++) {
    hands.push([]);
  }
  
  // Deal 5 cards to each player
  for (let round = 0; round < cardsPerPlayer; round++) {
    for (let player = 0; player < numPlayers; player++) {
      if (remainingDeck.length > 0) {
        const card = remainingDeck.pop()!;
        hands[player].push(card);
      }
    }
  }
  
  // Set aside one card as trump card (face up)
  const trumpCard = remainingDeck.length > 0 ? remainingDeck.pop()! : null;
  
  return { hands, remainingDeck, trumpCard };
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
    default: return 0;
  }
}

export function canPlayCard(card: Card, leadSuit: Card['suit'] | null, trumpSuit: Card['suit'] | null, playerHand: Card[], currentHouse: Card[]): boolean {
  // If no lead suit, any card can be played
  if (!leadSuit) {
    return true;
  }
  
  // Check if player has cards of the lead suit
  const hasLeadSuit = playerHand.some(c => c.suit === leadSuit);
  
  // If player has lead suit, they must play it
  if (hasLeadSuit) {
    return card.suit === leadSuit;
  }
  
  // If no lead suit in hand, can play any card
  return true;
}

export function findPlayableCards(playerHand: Card[], leadSuit: Card['suit'] | null, trumpSuit: Card['suit'] | null, currentHouse: Card[], enteredPlayers: number): number[] {
  const playableIndex: number[] = [];

  if (currentHouse.length === 0) {
    for (let i = 0; i < playerHand.length; i++) {
      playableIndex.push(i);
    }
    return playableIndex;
  }
  if (currentHouse.length >= 1 && currentHouse.length < enteredPlayers - 1) {
    if (playerHand.some(card => card.suit === leadSuit)) {
      const highestNonTrumpCard = findHighestCardInSuit(currentHouse, leadSuit, trumpSuit);
      if (playerHand.some(card => card.suit === leadSuit && card.rank === 'A')) {
        playableIndex.push(playerHand.findIndex(card => card.suit === leadSuit && card.rank === 'A'));
        return playableIndex;
      }
      if (playerHand.some(card => card.suit === leadSuit && card.value > highestNonTrumpCard.value)) {
        playerHand.forEach((card, index) => {
          if (card.suit === leadSuit && card.value > highestNonTrumpCard.value) {
            playableIndex.push(index);
          }
        });
        return playableIndex;
      }
      else{
        playerHand.forEach((card, index) => {
          if (card.suit === leadSuit) {
            playableIndex.push(index);
          }
        });
        return playableIndex;
      }
    }
    else{
      const highestTrumpCard = findHighestCardInSuit(currentHouse, trumpSuit, null);
      if(!highestTrumpCard){
        if(playerHand.some(card => card.suit === trumpSuit)){
          playerHand.forEach((card, index) => {
            if (card.suit === trumpSuit) {
              playableIndex.push(index);
            }
          });
        }
        else{
          playerHand.forEach((card, index) => {
              playableIndex.push(index);
          });
        }
        return playableIndex;
      }
      else{
        if(playerHand.some(card => card.suit === trumpSuit)){
          if(findHighestCardInSuit(playerHand, trumpSuit, null).value > highestTrumpCard.value){
            playerHand.forEach((card, index) => {
              if (card.suit === trumpSuit && card.value > highestTrumpCard.value) {
                playableIndex.push(index);
              }
            });
            return playableIndex;
          }
          else{
            playerHand.forEach((card, index) => {
              if (card.suit === trumpSuit) {
                playableIndex.push(index);
              }
            });
            return playableIndex;
          }
        }
        else{
          playerHand.forEach((card, index) => {
            playableIndex.push(index);
          });
          return playableIndex;
        }
      }
    }
  }

  return playableIndex;
}

export function checkTrumpAce(playerHand: Card[], trumpSuit: Card['suit'] | null, currentHouse: Card[]): boolean {
  const trumpAce = playerHand.find(card => card.suit === trumpSuit && card.rank === 'A');

  if (currentHouse.length === 0 && trumpAce) {
    return true;
  }
  return false;
}

export function findHighestCardInSuit(cards: Card[], suit: Card['suit'] | null, trumpSuit: Card['suit'] | null): Card {
  const nonTrumpCards = cards.filter(card => card.suit !== trumpSuit);
  let highest = nonTrumpCards[0];

  for (const card of nonTrumpCards) {
    if (card.suit === suit && card.value > highest.value) {
      highest = card;
    }
  }
  return highest;
}

export function findHighestCard(cards: Card[], trumpSuit: Card['suit'] | null): Card {
  if (cards.length === 0) return null!;
  
  let highest = cards[0];
  
  for (const card of cards) {
    // Trump cards always beat non-trump cards
    if (trumpSuit && card.suit === trumpSuit && highest.suit !== trumpSuit) {
      highest = card;
      continue;
    }
    
    // If both are trump or both are non-trump, compare values
    if ((trumpSuit && card.suit === trumpSuit && highest.suit === trumpSuit) ||
        (!trumpSuit || (card.suit !== trumpSuit && highest.suit !== trumpSuit))) {
      if (card.value > highest.value) {
        highest = card;
      }
    }
  }
  
  return highest;
}

export function calculateScore(initialScore: number, housesBuilt: number, hasEntered: boolean): number {
  if (!hasEntered) {
    return initialScore; // No change if didn't enter
  }
  
  if (housesBuilt === 0) {
    return initialScore + 5; // +5 penalty for entering but building no houses
  }
  
  return initialScore - housesBuilt; // Subtract houses built
}
