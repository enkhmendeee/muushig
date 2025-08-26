import { useState } from 'react';

export const useDragAndDrop = () => {
  const [draggedCardIndex, setDraggedCardIndex] = useState<number | null>(null);
  const [isDraggingToPlay, setIsDraggingToPlay] = useState(false);

  const handleDragStart = (e: React.DragEvent, cardIndex: number) => {
    setDraggedCardIndex(cardIndex);
    setIsDraggingToPlay(false);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', cardIndex.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Add visual feedback for play drop zone
    const target = e.currentTarget as HTMLElement;
    if (target.classList.contains('play-drop-zone')) {
      target.classList.add('drag-over');
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number, cardOrder: number[], setCardOrder: React.Dispatch<React.SetStateAction<number[]>>) => {
    e.preventDefault();
    if (draggedCardIndex === null) return;

    setCardOrder((prevOrder: number[]) => {
      const newOrder = [...prevOrder];
      const draggedCardOriginalIndex = newOrder[draggedCardIndex];
      
      // Remove the dragged card from its current position
      newOrder.splice(draggedCardIndex, 1);
      
      // Insert it at the new position
      newOrder.splice(dropIndex, 0, draggedCardOriginalIndex);
      
      return newOrder;
    });
    
    setDraggedCardIndex(null);
  };

  const handleDropToPlay = (e: React.DragEvent, cardOrder: number[], playableCards: number[], onPlayCard: (cardIndex: number) => void) => {
    e.preventDefault();
    if (draggedCardIndex === null) return;

    const originalIndex = cardOrder[draggedCardIndex];
    if (playableCards.includes(originalIndex)) {
      onPlayCard(originalIndex);
    }
    
    setDraggedCardIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedCardIndex(null);
    setIsDraggingToPlay(false);
    
    // Remove drag-over visual feedback
    const dropZone = document.querySelector('.play-drop-zone');
    if (dropZone) {
      dropZone.classList.remove('drag-over');
    }
  };

  return {
    draggedCardIndex,
    isDraggingToPlay,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDropToPlay,
    handleDragEnd
  };
};
