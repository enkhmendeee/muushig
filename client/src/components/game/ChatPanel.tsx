import React from 'react';
import { ChatMessage } from '../../types/game';

interface ChatPanelProps {
  showChat: boolean;
  chatMessage: string;
  chatMessages: ChatMessage[];
  onToggleChat: () => void;
  onSendChat: () => void;
  onChatMessageChange: (message: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  showChat,
  chatMessage,
  chatMessages,
  onToggleChat,
  onSendChat,
  onChatMessageChange,
  onKeyPress
}) => {
  return (
    <>
      {/* Chat Toggle */}
      <button 
        onClick={onToggleChat} 
        className="chat-toggle-btn"
      >
        💬
      </button>

      {/* Chat Panel */}
      {showChat && (
        <div className="chat-panel">
          <div className="chat-header">
            <h3>Chat</h3>
            <button onClick={onToggleChat} className="close-chat">×</button>
          </div>
          <div className="chat-messages-new">
            {chatMessages.map((message: ChatMessage) => (
              <div key={message.id} className={`chat-message-new ${message.type}`}>
                <span className="message-sender">{message.playerName}:</span>
                <span className="message-text">{message.message}</span>
              </div>
            ))}
          </div>
          <div className="chat-input-new">
            <input
              type="text"
              placeholder="Type a message..."
              value={chatMessage}
              onChange={(e) => onChatMessageChange(e.target.value)}
              onKeyDown={onKeyPress}
              className="message-input-new"
            />
            <button onClick={onSendChat} className="send-btn-new">Send</button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatPanel;
