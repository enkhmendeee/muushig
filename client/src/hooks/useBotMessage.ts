import { useState, useCallback } from 'react';

export const useBotMessage = () => {
  const [botActionMessage, setBotActionMessage] = useState<string>('');

  const showBotMessage = useCallback((message: string, duration: number = 3000) => {
    setBotActionMessage(message);
    setTimeout(() => {
      setBotActionMessage('');
    }, duration);
  }, []);

  const clearBotMessage = useCallback(() => {
    setBotActionMessage('');
  }, []);

  return {
    botActionMessage,
    showBotMessage,
    clearBotMessage
  };
};
