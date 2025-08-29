import { Card } from '../types/game';

/* =========================
 * Deck + dealing
 * =======================*/

export function createDeck(numPlayers: number = 5): Card[] {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];

  // Determine which ranks to include based on player count
  let ranks: Card['rank'][] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

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

export function dealCards(
  deck: Card[],
  numPlayers: number,
  cardsPerPlayer: number = 5
): {
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

  // Deal 5 cards to each player (or cardsPerPlayer)
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

/* =========================
 * Helpers for playable-cards logic
 * =======================*/

const allIndices = (arr: unknown[]) => arr.map((_, i) => i);

const indicesWhere = <T>(arr: T[], pred: (x: T, i: number) => boolean) =>
  arr.reduce<number[]>((acc, x, i) => (pred(x, i) ? (acc.push(i), acc) : acc), []);

const hasSuit = (hand: Card[], suit: Card['suit'] | null) =>
  !!suit && hand.some(c => c.suit === suit);

const suitIndices = (hand: Card[], suit: Card['suit'] | null) =>
  suit ? indicesWhere(hand, c => c.suit === suit) : [];

const higherThanInSuit = (hand: Card[], suit: Card['suit'] | null, minValue: number) =>
  suit ? indicesWhere(hand, c => c.suit === suit && c.value > minValue) : [];

const firstAceIndexInSuit = (hand: Card[], suit: Card['suit'] | null) =>
  suit ? hand.findIndex(c => c.suit === suit && c.rank === 'A') : -1;

const highestValue = (card?: Card | null) => card?.value ?? Number.NEGATIVE_INFINITY;

/**
 * If player cannot follow lead suit.
 * Encodes: trump requirements and overtrump logic.
 */
function playableWhenNoLeadSuit(
  playerHand: Card[],
  currentHouse: Card[],
  trumpSuit: Card['suit'] | null
): number[] {
  if (!trumpSuit) return allIndices(playerHand);

  const highestTrumpOnTable = findHighestCardInSuit(currentHouse, trumpSuit, null);
  const playerHasTrump = hasSuit(playerHand, trumpSuit);

  // No trump on table: must play trump if you have it, else any card
  if (!highestTrumpOnTable) {
    return playerHasTrump ? suitIndices(playerHand, trumpSuit) : allIndices(playerHand);
  }

  // Trump on table
  if (playerHasTrump) {
    const highestTrumpInHand = findHighestCardInSuit(playerHand, trumpSuit, null);
    if (highestValue(highestTrumpInHand) > highestTrumpOnTable.value) {
      // Must overtrump if you can
      return higherThanInSuit(playerHand, trumpSuit, highestTrumpOnTable.value);
    }
    // Otherwise any trump is fine
    return suitIndices(playerHand, trumpSuit);
  }

  // No trump in hand → any card
  return allIndices(playerHand);
}

/**
 * If player can follow lead suit.
 * Enforces: Ace shortcut (mid-turn only), beat-highest-non-trump-if-possible; otherwise any lead suit.
 */
function playableWhenHasLeadSuit(
  playerHand: Card[],
  currentHouse: Card[],
  leadSuit: Card['suit'] | null,
  trumpSuit: Card['suit'] | null,
  allowAceShortcut: boolean
): number[] {
  if (!leadSuit) return allIndices(playerHand); // safety

  // Optional “Ace shortcut” (only in the mid-turn branch per original code)
  if (allowAceShortcut) {
    const aceIdx = firstAceIndexInSuit(playerHand, leadSuit);
    if (aceIdx !== -1) return [aceIdx];
  }

  // Highest non-trump of the lead suit already on table
  const highestNonTrumpLead = findHighestCardInSuit(currentHouse, leadSuit, trumpSuit ?? null);
  const threshold = highestValue(highestNonTrumpLead);

  const canBeat = playerHand.some(c => c.suit === leadSuit && c.value > threshold);
  if (canBeat) {
    return higherThanInSuit(playerHand, leadSuit, threshold);
  }
  // Otherwise, any card in lead suit
  return suitIndices(playerHand, leadSuit);
}

/* =========================
 * Main: findPlayableCards (refactored)
 * =======================*/

export function findPlayableCards(
  playerHand: Card[],
  leadSuit: Card['suit'] | null,
  trumpSuit: Card['suit'] | null,
  currentHouse: Card[],
  enteredPlayers: number
): number[] {
  console.log(`[DEBUG] findPlayableCards: Starting analysis`);
  console.log(`[DEBUG] findPlayableCards: Current house length: ${currentHouse.length}`);
  console.log(`[DEBUG] findPlayableCards: Lead suit: ${leadSuit}`);
  console.log(`[DEBUG] findPlayableCards: Trump suit: ${trumpSuit}`);
  console.log(`[DEBUG] findPlayableCards: Entered players: ${enteredPlayers}`);
  console.log(`[DEBUG] findPlayableCards: Player hand:`, playerHand.map((card, i) => `${i}:${card?.rank}${card?.suit}`));

  // First card of the house - all cards are playable
  if (currentHouse.length === 0) {
    console.log(`[DEBUG] findPlayableCards: First card of house - all cards playable`);
    const allIndices = Array.from({ length: playerHand.length }, (_, i) => i);
    console.log(`[DEBUG] findPlayableCards: Returning all indices:`, allIndices);
    return allIndices;
  }

  const isLastToPlay = currentHouse.length === enteredPlayers - 1;
  const canFollowLead = hasSuit(playerHand, leadSuit);

  console.log(`[DEBUG] findPlayableCards: Is last to play: ${isLastToPlay}`);
  console.log(`[DEBUG] findPlayableCards: Can follow lead: ${canFollowLead}`);

  if (canFollowLead) {
    // In your original, the "Ace shortcut" exists only when NOT the last player:
    // (currentHouse.length >= 1 && currentHouse.length < enteredPlayers - 1)
    const allowAceShortcut =
      currentHouse.length >= 1 && currentHouse.length < enteredPlayers - 1;
    console.log(`[DEBUG] findPlayableCards: Can follow lead suit, allowAceShortcut: ${allowAceShortcut}`);
    return playableWhenHasLeadSuit(
      playerHand,
      currentHouse,
      leadSuit,
      trumpSuit,
      allowAceShortcut && !isLastToPlay
    );
  }

  // Cannot follow lead suit → apply trump/overtrump rules (same for mid-turn and last)
  console.log(`[DEBUG] findPlayableCards: Cannot follow lead suit, applying trump/overtrump rules`);
  return playableWhenNoLeadSuit(playerHand, currentHouse, trumpSuit);
}

/* =========================
 * Misc helpers you already export
 * =======================*/



/**
 * Finds the highest card in a specific suit, excluding trump suit if provided.
 * NOTE: returns a non-null Card via TS non-null assertion if no candidate exists.
 * We prefer callers to defensively handle null by using `highestValue(...)`.
 */
export function findHighestCardInSuit(
  cards: Card[],
  suit: Card['suit'] | null,
  trumpSuit: Card['suit'] | null
): Card {
  const candidates = cards.filter(c => (suit ? c.suit === suit : true) && c.suit !== trumpSuit);
  if (candidates.length === 0) return null!; // caller should guard with highestValue(...)
  let highest = candidates[0];
  for (const card of candidates) {
    if (card.value > highest.value) highest = card;
  }
  return highest;
}

/**
 * Highest card overall, with trump beating non-trump.
 * (Keeps your original return type & null! behavior for empty arrays.)
 */
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
    const bothTrump = trumpSuit && card.suit === trumpSuit && highest.suit === trumpSuit;
    const bothNonTrump = !trumpSuit || (card.suit !== trumpSuit && highest.suit !== trumpSuit);
    if (bothTrump || bothNonTrump) {
      if (card.value > highest.value) highest = card;
    }
  }

  return highest;
}

export function calculateScore(
  initialScore: number,
  housesBuilt: number,
  enteredRound: boolean
): number {
  if (!enteredRound) return initialScore; // No change if didn't enter
  if (housesBuilt === 0) return initialScore + 5; // +5 penalty for entering but building no houses
  return initialScore - housesBuilt; // Subtract houses built
}
