import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Player, GameState, ChatMessage } from '../types/game';
import { getSuitSymbol } from '../utils/gameUtils';
import GameHeader from '../components/layout/GameHeader';
import GameTable from '../components/game/GameTable';
import GameControls from '../components/game/GameControls';
import ChatPanel from '../components/game/ChatPanel';
import ExchangeModal from '../components/game/ExchangeModal';
import { useDragAndDrop } from '../hooks/useDragAndDrop';

const GameRoom: React.FC<{
  socket: Socket | null;
  gameState: GameState;
  currentPlayer: Player;
  onLeaveGame: () => void;
}> = ({ socket, gameState, currentPlayer, onLeaveGame }) => {
  const [chatMessage, setChatMessage] = useState('');
  const [playableCards, setPlayableCards] = useState<number[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [selectedCardsForExchange, setSelectedCardsForExchange] = useState<number[]>([]);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [isTrumpExchange, setIsTrumpExchange] = useState(false);
  const [botActionMessage, setBotActionMessage] = useState<string>('');
  const [cardOrder, setCardOrder] = useState<number[]>([]);

  const prevPlayersRef = React.useRef(gameState.players);
  
  // Update currentPlayer with latest data from gameState
  const updatedCurrentPlayer = gameState.players.find(player => player.id === currentPlayer.id) || currentPlayer;

  // Use drag and drop hook
  const {
    draggedCardIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDropToPlay,
    handleDragEnd
  } = useDragAndDrop();

  // Initialize card order when hand changes
  useEffect(() => {
    if (Array.isArray(updatedCurrentPlayer.hand)) {
      // Filter out indices that no longer exist in the hand
      setCardOrder(prevOrder => {
        const handArray = updatedCurrentPlayer.hand as any[];
        const newOrder = prevOrder.filter(index => index < handArray.length);
        // Add any new indices that might have been added
        for (let i = 0; i < handArray.length; i++) {
          if (!newOrder.includes(i)) {
            newOrder.push(i);
          }
        }
        return newOrder;
      });
    }
  }, [updatedCurrentPlayer.hand]);

  useEffect(() => {
    if (socket && gameState.gamePhase === 'playing' && isMyTurn) {
      socket.emit('get_playable_cards', { gameId: gameState.id });
    }
  }, [socket, gameState.gamePhase, gameState.currentPlayerIndex, updatedCurrentPlayer.id]);

  useEffect(() => {
    if (!socket) return;

    socket.on('playable_cards', (data: { gameId: string; playableCards: number[] }) => {
      if (data.gameId === gameState.id) {
        setPlayableCards(data.playableCards);
      }
    });

    return () => {
      socket.off('playable_cards');
    };
  }, [socket, gameState.id, currentPlayer.name]);

  // Track bot decisions and show notifications
  useEffect(() => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer?.isBot) {
      // Clear any existing bot action message when a new bot starts thinking
      setBotActionMessage('');
    }
  }, [gameState.currentPlayerIndex, gameState.players]);

  // Track when bots make decisions
  useEffect(() => {
    const prevPlayers = prevPlayersRef.current;
    const currentPlayers = gameState.players;
    
    currentPlayers.forEach((player, index) => {
      const prevPlayer = prevPlayers[index];
      if (player.isBot && 
          prevPlayer && 
          prevPlayer.enteredRound === undefined && 
          player.enteredRound !== undefined) {
        const action = player.enteredRound ? 'entered' : 'declined';
        setBotActionMessage(`${player.name} ${action} the round`);
        
        // Clear the message after 3 seconds
        setTimeout(() => {
          setBotActionMessage('');
        }, 3000);
      }
      
      // Track exchange decisions
      if (player.isBot && 
          prevPlayer && 
          !prevPlayer.hasExchanged && 
          player.hasExchanged) {
        const action = gameState.gamePhase === 'trump_exchanging' ? 'exchanged trump card' : 'exchanged cards';
        setBotActionMessage(`${player.name} ${action}`);
        
        // Clear the message after 3 seconds
        setTimeout(() => {
          setBotActionMessage('');
        }, 3000);
      }
    });
    
    prevPlayersRef.current = currentPlayers;
  }, [gameState.players]);

  const handleReady = () => {
    if (!socket) return;
    socket.emit('ready_check', { gameId: gameState.id, isReady: true });
  };

  const handleUnready = () => {
    if (!socket) return;
    socket.emit('ready_check', { gameId: gameState.id, isReady: false });
  };

  const handleStartGame = () => {
    if (!socket) return;
    socket.emit('start_game', { gameId: gameState.id });
  };

  const handleEnterTurn = () => {
    if (!socket) return;
    socket.emit('enter_turn', { gameId: gameState.id });
  };

  const handleSkipTurn = () => {
    if (!socket) return;
    socket.emit('skip_turn', { gameId: gameState.id });
  };

  const handlePlayCard = (cardIndex: number) => {
    if (!socket) return;
    socket.emit('play_card', { gameId: gameState.id, cardIndex });
  };

  const handleCardSelectForExchange = (cardIndex: number) => {
    setSelectedCardsForExchange(prev => {
      if (prev.includes(cardIndex)) {
        return prev.filter(index => index !== cardIndex);
      } else {
        if (isTrumpExchange) {
          // For trump exchange, only allow one card selection
          return [cardIndex];
        } else {
          // For regular exchange, limit to tree size
          const maxExchangeable = gameState.tree.length;
          if (prev.length >= maxExchangeable) {
            // If already at max, don't add more cards
            return prev;
          } else {
            return [...prev, cardIndex];
          }
        }
      }
    });
  };

  const handleExchangeCards = () => {
    if (!socket || selectedCardsForExchange.length === 0) return;
    
    if (isTrumpExchange) {
      // For trump exchange, only exchange the first selected card
      socket.emit('exchange_trump', { 
        gameId: gameState.id, 
        cardIndex: selectedCardsForExchange[0] 
      });
    } else {
      // For regular exchange, validate against tree size
      const maxExchangeable = gameState.tree.length;
      if (selectedCardsForExchange.length > maxExchangeable) {
        console.warn(`Cannot exchange ${selectedCardsForExchange.length} cards when only ${maxExchangeable} are available in tree`);
        return;
      }
      
      socket.emit('exchange_cards', { 
        gameId: gameState.id, 
        cardIndices: selectedCardsForExchange 
      });
    }
    
    setSelectedCardsForExchange([]);
    setShowExchangeModal(false);
    setIsTrumpExchange(false);
  };

  const handleSkipExchange = () => {
    if (!socket) return;
    
    if (isTrumpExchange) {
      socket.emit('exchange_trump', { gameId: gameState.id, cardIndex: -1 });
    } else {
      socket.emit('exchange_cards', { gameId: gameState.id, cardIndices: [] });
    }
    
    setShowExchangeModal(false);
    setIsTrumpExchange(false);
  };

  const handleOpenExchange = () => {
    setIsTrumpExchange(false);
    setSelectedCardsForExchange([]);
    setShowExchangeModal(true);
  };

  const handleOpenTrumpExchange = () => {
    setIsTrumpExchange(true);
    setSelectedCardsForExchange([]);
    setShowExchangeModal(true);
  };

  const handleSkipTrumpExchange = () => {
    if (!socket) return;
    socket.emit('exchange_trump', { gameId: gameState.id, cardIndex: -1 });
  };

  const handleSendChat = () => {
    if (!socket || !chatMessage.trim()) return;
    socket.emit('send_chat', { gameId: gameState.id, message: chatMessage.trim() });
    setChatMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === updatedCurrentPlayer.id;
  const canMakeDecision = gameState.gamePhase === 'dealing' && updatedCurrentPlayer.enteredRound === undefined && isMyTurn;
  const canExchange = gameState.gamePhase === 'exchanging' && updatedCurrentPlayer.enteredRound === true && !updatedCurrentPlayer.hasExchanged && isMyTurn;
  const canExchangeTrump = gameState.gamePhase === 'trump_exchanging' && updatedCurrentPlayer.enteredRound === true && updatedCurrentPlayer.isDealer && gameState.players[gameState.currentPlayerIndex]?.id === updatedCurrentPlayer.id;
  const canPlayCard = gameState.gamePhase === 'playing' && updatedCurrentPlayer.enteredRound === true && isMyTurn;

  return (
    <div className="game-room-new">
      <GameHeader gameState={gameState} onLeaveGame={onLeaveGame} />
      
      <GameTable
        gameState={gameState}
        currentPlayer={updatedCurrentPlayer}
        canPlayCard={canPlayCard}
        playableCards={playableCards}
        onDragOver={handleDragOver}
        onDropToPlay={(e) => handleDropToPlay(e, cardOrder, playableCards, handlePlayCard)}
        botActionMessage={botActionMessage}
      />

      <GameControls
        gameState={gameState}
        currentPlayer={updatedCurrentPlayer}
        canMakeDecision={canMakeDecision}
        canExchange={canExchange}
        canExchangeTrump={canExchangeTrump}
        onReady={handleReady}
        onUnready={handleUnready}
        onStartGame={handleStartGame}
        onEnterTurn={handleEnterTurn}
        onSkipTurn={handleSkipTurn}
        onOpenExchange={handleOpenExchange}
        onOpenTrumpExchange={handleOpenTrumpExchange}
        onSkipExchange={handleSkipExchange}
        onSkipTrumpExchange={handleSkipTrumpExchange}
      />

      <ExchangeModal
        showExchangeModal={showExchangeModal}
        isTrumpExchange={isTrumpExchange}
        gameState={gameState}
        currentPlayer={updatedCurrentPlayer}
        selectedCardsForExchange={selectedCardsForExchange}
        onCardSelectForExchange={handleCardSelectForExchange}
        onExchangeCards={handleExchangeCards}
        onSkipExchange={handleSkipExchange}
      />

      <ChatPanel
        showChat={showChat}
        chatMessage={chatMessage}
        chatMessages={gameState.chatMessages}
        onToggleChat={() => setShowChat(!showChat)}
        onSendChat={handleSendChat}
        onChatMessageChange={setChatMessage}
        onKeyPress={handleKeyPress}
      />
    </div>
  );
};

export default GameRoom;
