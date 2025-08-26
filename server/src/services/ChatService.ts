import { GameState, ChatMessage } from '../types/game';
import { v4 as uuidv4 } from 'uuid';

export class ChatService {
  sendChatMessage(game: GameState, playerId: string, playerName: string, message: string): ChatMessage | null {
    const chatMessage: ChatMessage = {
      id: uuidv4(),
      playerId: playerId,
      playerName: playerName,
      message: message.trim(),
      timestamp: new Date(),
      type: 'chat'
    };

    // Add to game's chat history (keep last 100 messages)
    game.chatMessages.push(chatMessage);
    if (game.chatMessages.length > 100) {
      game.chatMessages = game.chatMessages.slice(-100);
    }

    game.lastActivity = new Date();
    return chatMessage;
  }

  sendSystemMessage(game: GameState, message: string): ChatMessage | null {
    const systemMessage: ChatMessage = {
      id: uuidv4(),
      playerId: 'system',
      playerName: 'System',
      message: message,
      timestamp: new Date(),
      type: 'system'
    };

    game.chatMessages.push(systemMessage);
    if (game.chatMessages.length > 100) {
      game.chatMessages = game.chatMessages.slice(-100);
    }

    game.lastActivity = new Date();
    return systemMessage;
  }

  getChatHistory(game: GameState): ChatMessage[] {
    return game.chatMessages;
  }
}
