import { GameState, Player } from '../types/game';
import { v4 as uuidv4 } from 'uuid';

export class PlayerManager {
  createPlayer(playerName: string, isHost: boolean = false): Player {
    return {
      id: uuidv4(),
      name: playerName,
      hand: [],
      score: 15,
      isHost: isHost,
      isReady: false,
      housesBuilt: 0,
      isDealer: false,
      enteredRound: undefined,
      hasExchanged: false,
      isBot: false,
    };
  }

  joinGame(game: GameState, playerName: string): Player | null {
    if (game.gamePhase !== 'waiting' && game.gamePhase !== 'ready') {
      return null;
    }

    // Check if we have a bot to replace
    const botToReplace = this.getBotToReplace(game);
    if (!botToReplace) {
      return null;
    }

    const player = this.createPlayer(playerName, false);

    // Replace the bot with the real player
    const botIndex = game.players.findIndex(p => p.id === botToReplace.id);
    if (botIndex !== -1) {
      game.players[botIndex] = player;
      game.lastActivity = new Date();
      return player;
    }
    
    return null;
  }

  leaveGame(game: GameState, playerId: string): boolean {
    if (game.gamePhase !== 'waiting' && game.gamePhase !== 'ready') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }

    game.players = game.players.filter(p => p.id !== playerId);
    game.lastActivity = new Date();
    
    return true;
  }

  removePlayer(game: GameState, playerId: string): boolean {
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      return false;
    }

    game.players.splice(playerIndex, 1);
    game.lastActivity = new Date();

    // If host left, assign new host
    if (game.players.every(p => !p.isHost)) {
      game.players[0].isHost = true;
    }

    // Adjust current player index if needed
    if (game.currentPlayerIndex >= game.players.length) {
      game.currentPlayerIndex = 0;
    }

    return true;
  }

  readyCheck(game: GameState, playerId: string, isReady: boolean): boolean {
    if (game.gamePhase !== 'waiting') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }

    if (isReady) {
      player.isReady = true;
      game.lastActivity = new Date();
    } else {
      player.isReady = false;
      game.lastActivity = new Date();
    }

    // Check if all players are ready
    const allReady = game.players.every(p => p.isReady === true);
    if (allReady) {
      game.gamePhase = 'ready';
    }
    return true;
  }

  enterTurn(game: GameState, playerId: string): boolean {
    if (game.gamePhase !== 'dealing') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }

    player.enteredRound = true;
    game.lastActivity = new Date();

    if (game.players.every(p => p.enteredRound !== undefined)) {
      // All players decided, move to exchanging phase
      game.gamePhase = 'exchanging';
      // Start with player after dealer for exchanging
      game.currentPlayerIndex = (game.dealerIndex + 1) % game.players.length;
    } else {
      // Move to next undecided player
      this.nextTurnEnter(game);
    }
    return true;
  }

  skipTurn(game: GameState, playerId: string): boolean {
    if (game.gamePhase !== 'dealing') {
      console.log(`[DEBUG] PlayerManager.skipTurn: Wrong game phase: ${game.gamePhase}`);
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      console.log(`[DEBUG] PlayerManager.skipTurn: Player not found: ${playerId}`);
      return false;
    }

    console.log(`[DEBUG] PlayerManager.skipTurn: ${player.name} skipping turn`);
    console.log(`[DEBUG] PlayerManager.skipTurn: Players decided so far:`, game.players.map(p => `${p.name}: ${p.enteredRound}`));

    player.enteredRound = false;
    game.lastActivity = new Date();

    if (game.players.every(p => p.enteredRound !== undefined)) {
      // All players decided, move to exchanging phase
      console.log(`[DEBUG] PlayerManager.skipTurn: All players decided, moving to exchanging phase`);
      game.gamePhase = 'exchanging';
      // Start with player after dealer for exchanging
      game.currentPlayerIndex = (game.dealerIndex + 1) % game.players.length;
      console.log(`[DEBUG] PlayerManager.skipTurn: Set current player to: ${game.players[game.currentPlayerIndex].name} (index: ${game.currentPlayerIndex})`);
    } else {
      // Move to next undecided player
      console.log(`[DEBUG] PlayerManager.skipTurn: Moving to next undecided player`);
      this.nextTurnEnter(game);
      console.log(`[DEBUG] PlayerManager.skipTurn: Next player: ${game.players[game.currentPlayerIndex].name} (index: ${game.currentPlayerIndex})`);
    }

    return true;
  }

  exchangeCards(game: GameState, playerId: string, cardIndices: number[]): boolean {
    if (game.gamePhase !== 'exchanging') {
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player || !player.enteredRound || game.tree.length === 0) {
      return false;
    }

    // Validate that player isn't trying to exchange more cards than available in tree
    if (cardIndices.length > game.tree.length) {
      return false;
    }

    this.swapCards(game, player, cardIndices);

    player.hasExchanged = true;
    game.lastActivity = new Date();

    // Debug exchange completion check
    const enteredPlayers = game.players.filter(p => p.enteredRound);
    const allExchanged = enteredPlayers.every(p => p.hasExchanged);

    if (allExchanged || game.tree.length === 0) {
      // All players who entered have exchanged or tree is empty
      
      // Check if dealer entered the round
      const dealer = game.players[game.dealerIndex];
      if (!dealer.enteredRound) {
        // Dealer skipped the round, skip trump exchange and go directly to playing
        game.gamePhase = 'playing';
        this.setNextPlayerFirstTurn(game);
      } else {
        // Dealer entered, proceed with trump exchange
        game.gamePhase = 'trump_exchanging';
        // Set current player to dealer for trump exchange
        game.currentPlayerIndex = game.dealerIndex;
      }
    } else {
      this.nextTurnExchange(game);
    }
    return true;
  }

  exchangeTrump(game: GameState, playerId: string, cardIndex: number): boolean {
    if (game.gamePhase !== 'trump_exchanging') {
      console.log(`[DEBUG] exchangeTrump: Wrong game phase: ${game.gamePhase}`);
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player || !player.enteredRound || !player.isDealer || !game.trumpCard) {
      console.log(`[DEBUG] exchangeTrump: Invalid player or conditions. Player: ${player?.name}, enteredRound: ${player?.enteredRound}, isDealer: ${player?.isDealer}, trumpCard: ${!!game.trumpCard}`);
      return false;
    }

    console.log(`[DEBUG] exchangeTrump: ${player.name} exchanging trump card. cardIndex: ${cardIndex}`);

    // Handle skip trump exchange (cardIndex = -1)
    if (cardIndex === -1) {
      console.log(`[DEBUG] exchangeTrump: ${player.name} skipping trump exchange`);
      player.hasExchanged = true;
      game.lastActivity = new Date();
      
      game.gamePhase = 'playing';
      console.log(`[DEBUG] exchangeTrump: Moving to playing phase, setting first player`);
      this.setNextPlayerFirstTurn(game);
      console.log(`[DEBUG] exchangeTrump: First player set to: ${game.players[game.currentPlayerIndex].name} (index: ${game.currentPlayerIndex})`);
      return true;
    }

    if (cardIndex < 0 || cardIndex >= player.hand.length) {
      console.log(`[DEBUG] exchangeTrump: Invalid card index: ${cardIndex}, hand length: ${player.hand.length}`);
      return false;
    }

    // Exchange the card with trump card
    console.log(`[DEBUG] exchangeTrump: ${player.name} exchanging card at index ${cardIndex} with trump card`);
    player.hand[cardIndex] = game.trumpCard;
    
    player.hasExchanged = true;
    game.lastActivity = new Date();
    
    game.gamePhase = 'playing';
    console.log(`[DEBUG] exchangeTrump: Moving to playing phase, setting first player`);
    this.setNextPlayerFirstTurn(game);
    console.log(`[DEBUG] exchangeTrump: First player set to: ${game.players[game.currentPlayerIndex].name} (index: ${game.currentPlayerIndex})`);

    return true;
  }

  playCard(game: GameState, playerId: string, cardIndex: number): boolean {
    if (game.gamePhase !== 'playing') {
      console.log(`[DEBUG] playCard: Game phase is ${game.gamePhase}, not 'playing'`);
      return false;
    }

    const player = game.players.find(p => p.id === playerId);
    if (!player || !player.enteredRound || game.players[game.currentPlayerIndex].id !== playerId) {
      console.log(`[DEBUG] playCard: Invalid player or turn. Player: ${player?.name}, enteredRound: ${player?.enteredRound}, currentPlayer: ${game.players[game.currentPlayerIndex]?.name}`);
      return false;
    }

    // Validate and fix hand before playing
    this.validateAndFixHand(game, player);

    console.log(`[DEBUG] playCard: ${player.name} (${player.isBot ? 'BOT' : 'HUMAN'}) attempting to play card at index ${cardIndex}`);
    console.log(`[DEBUG] playCard: ${player.name} hand before playing:`, {
      handLength: player.hand.length,
      hand: player.hand.map((card, i) => `${i}:${card?.rank}${card?.suit}`)
    });

    if (!Array.isArray(player.hand) || cardIndex < 0 || cardIndex >= player.hand.length) {
      console.log(`[DEBUG] playCard: Invalid card index. Hand is array: ${Array.isArray(player.hand)}, cardIndex: ${cardIndex}, hand length: ${player.hand?.length}`);
      return false;
    }

    const card = player.hand[cardIndex];
    if (!card) {
      console.log(`[DEBUG] playCard: No card found at index ${cardIndex}`);
      return false;
    }

    console.log(`[DEBUG] playCard: ${player.name} playing ${card.rank}${card.suit} at index ${cardIndex}`);

    // Play the card by removing it from hand
    player.hand.splice(cardIndex, 1);
    
    console.log(`[DEBUG] playCard: ${player.name} hand after playing:`, {
      handLength: player.hand.length,
      hand: player.hand.map((card, i) => `${i}:${card?.rank}${card?.suit}`)
    });
    
    // Add to current house
    game.currentHouse.push({
      card,
      playerId: player.id,
      playerName: player.name
    });
    
    // Set lead suit if this is the first card
    if (game.currentHouse.length === 1) {
      game.leadSuit = card.suit;
    }

    game.lastActivity = new Date();

    // Check if house is complete
    if (game.currentHouse.length === game.players.filter(p => p.enteredRound).length) {
      console.log(`[DEBUG] playCard: House complete! Current house:`, game.currentHouse.map(hc => `${hc.playerName}:${hc.card.rank}${hc.card.suit}`));
      // House is complete, will be handled by GameStateManager
    } else {
      console.log(`[DEBUG] playCard: House not complete. ${game.currentHouse.length}/${game.players.filter(p => p.enteredRound).length} cards played`);
      // Note: Turn progression is handled by GameManager.playCard(), not here
    }

    return true;
  }
  private swapCards(game: GameState, player: Player, cardIndices: number[]): boolean {
    // Exchange cards
    const cardsToExchange = cardIndices.map(i => player.hand[i]).filter(card => card);
    const newCards = game.tree.splice(0, cardsToExchange.length);
    
    // Remove old cards by creating a new hand without the exchanged cards
    const newHand = player.hand.filter((_, index) => !cardIndices.includes(index));
    
    // Replace the hand with the new hand plus the new cards
    player.hand = [...newHand, ...newCards];
    
    // Ensure hand size is exactly 5 cards
    if (player.hand.length !== 5) {
      // Fix by trimming or padding to exactly 5 cards
      if (player.hand.length > 5) {
        player.hand = player.hand.slice(0, 5);
      } else if (player.hand.length < 5 && game.tree.length > 0) {
        const additionalCards = game.tree.splice(0, 5 - player.hand.length);
        player.hand.push(...additionalCards);
      }
    }
    return true;
  }

  private setNextPlayerFirstTurn(game: GameState): void {
    console.log(`[DEBUG] setNextPlayerFirstTurn: Starting first player selection`);
    console.log(`[DEBUG] setNextPlayerFirstTurn: Dealer index: ${game.dealerIndex}, Dealer: ${game.players[game.dealerIndex].name}`);
    console.log(`[DEBUG] setNextPlayerFirstTurn: Players entered status:`, game.players.map((p, i) => `${i}:${p.name}:${p.enteredRound}`));
    
    // Set current player to first player who entered, starting from player after dealer
    let firstEnteredPlayerIndex = -1;
    for (let i = 1; i <= game.players.length; i++) {
      const playerIndex = (game.dealerIndex + i) % game.players.length;
      const player = game.players[playerIndex];
      console.log(`[DEBUG] setNextPlayerFirstTurn: Checking player ${player.name} (index ${playerIndex}): enteredRound = ${player.enteredRound}`);
      if (player.enteredRound) {
        firstEnteredPlayerIndex = playerIndex;
        console.log(`[DEBUG] setNextPlayerFirstTurn: Found first entered player: ${player.name} (index ${playerIndex})`);
        break;
      }
    }
    if (firstEnteredPlayerIndex !== -1) {
      game.currentPlayerIndex = firstEnteredPlayerIndex;
      console.log(`[DEBUG] setNextPlayerFirstTurn: Set current player to: ${game.players[firstEnteredPlayerIndex].name} (index ${firstEnteredPlayerIndex})`);
    } else {
      console.log(`[DEBUG] setNextPlayerFirstTurn: No entered players found!`);
    }
  }

  private getBotToReplace(game: GameState): Player | null {
    // Find the first bot player
    return game.players.find(p => p.isBot) || null;
  }

  private nextTurn(game: GameState): void {
    const currentPlayer = game.players[game.currentPlayerIndex];
    console.log(`[DEBUG] nextTurn: Moving from ${currentPlayer?.name} (index ${game.currentPlayerIndex})`);
    console.log(`[DEBUG] nextTurn: Players entered status:`, game.players.map((p, i) => `${i}:${p.name}:${p.enteredRound}`));
    
    // Find next player who has entered
    let nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
    while (!game.players[nextIndex].enteredRound) {
      console.log(`[DEBUG] nextTurn: Skipping ${game.players[nextIndex].name} (index ${nextIndex}) - not entered`);
      nextIndex = (nextIndex + 1) % game.players.length;
    }
    game.currentPlayerIndex = nextIndex;
    
    const nextPlayer = game.players[nextIndex];
    console.log(`[DEBUG] nextTurn: Moving to ${nextPlayer?.name} (index ${nextIndex})`);
  }

  private nextTurnExchange(game: GameState): void {
    // Find next player who has entered but hasn't exchanged yet
    let nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
    while (!game.players[nextIndex].enteredRound || game.players[nextIndex].hasExchanged) {
      nextIndex = (nextIndex + 1) % game.players.length;
    }
    game.currentPlayerIndex = nextIndex;
  }

  private nextTurnEnter(game: GameState): void {
    const currentPlayer = game.players[game.currentPlayerIndex];
    console.log(`[DEBUG] nextTurnEnter: Moving from ${currentPlayer?.name} (index ${game.currentPlayerIndex})`);
    
    let nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
    game.currentPlayerIndex = nextIndex;
    
    const nextPlayer = game.players[nextIndex];
    console.log(`[DEBUG] nextTurnEnter: Moving to ${nextPlayer?.name} (index ${nextIndex})`);
  }

  private validateAndFixHand(game: GameState, player: Player): void {
    console.log(`[DEBUG] validateAndFixHand: ${player.name} (${player.isBot ? 'BOT' : 'HUMAN'}) - Starting validation`);
    console.log(`[DEBUG] validateAndFixHand: Initial hand:`, {
      isArray: Array.isArray(player.hand),
      length: player.hand?.length,
      hand: player.hand
    });

    if (!Array.isArray(player.hand)) {
      console.log(`[DEBUG] validateAndFixHand: ${player.name} hand was not an array, initializing to empty array`);
      player.hand = [];
    }
    
    // Remove any null/undefined cards
    const originalLength = player.hand.length;
    player.hand = player.hand.filter(card => card && typeof card === 'object');
    const filteredLength = player.hand.length;
    
    if (originalLength !== filteredLength) {
      console.log(`[DEBUG] validateAndFixHand: ${player.name} removed ${originalLength - filteredLength} null/undefined cards`);
    }
    
    // Ensure hand size is exactly 5 cards during playing phase
    if (game.gamePhase === 'playing') {
      console.log(`[DEBUG] validateAndFixHand: ${player.name} in playing phase, ensuring 5 cards. Current: ${player.hand.length}, Tree: ${game.tree.length}`);
      
      if (player.hand.length > 5) {
        console.log(`[DEBUG] validateAndFixHand: ${player.name} hand too large (${player.hand.length}), trimming to 5`);
        player.hand = player.hand.slice(0, 5);
      } else if (player.hand.length < 5 && game.tree.length > 0) {
        const needed = 5 - player.hand.length;
        const available = Math.min(needed, game.tree.length);
        console.log(`[DEBUG] validateAndFixHand: ${player.name} hand too small (${player.hand.length}), drawing ${available} cards from tree`);
        const additionalCards = game.tree.splice(0, available);
        player.hand.push(...additionalCards);
      }
    }
    
    console.log(`[DEBUG] validateAndFixHand: ${player.name} final hand:`, {
      length: player.hand.length,
      hand: player.hand.map((card, i) => `${i}:${card?.rank}${card?.suit}`)
    });
  }
}
