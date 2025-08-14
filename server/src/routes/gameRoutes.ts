import { Router } from 'express';
import { GameManager } from '../game/GameManager';

export function createGameRoutes(gameManager: GameManager): Router {
  const router = Router();

  // Create a new game
  router.post('/games', (req, res) => {
    const { hostName, maxPlayers = 5 } = req.body;
    
    if (!hostName) {
      return res.status(400).json({ error: 'Host name is required' });
    }

    const gameId = gameManager.createGame(hostName, maxPlayers);
    const game = gameManager.getGame(gameId);
    
    if (game) {
      res.json({
        gameId,
        inviteLink: `${req.protocol}://${req.get('host')}/join/${gameId}`,
        game: {
          id: game.id,
          players: game.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost })),
          gamePhase: game.gamePhase,
          maxPlayers: game.maxPlayers,
          createdAt: game.createdAt
        }
      });
    } else {
      res.status(500).json({ error: 'Failed to create game' });
    }
  });

  // Get game info (public info only)
  router.get('/games/:gameId', (req, res) => {
    const { gameId } = req.params;
    const game = gameManager.getGame(gameId);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({
      id: game.id,
      players: game.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost })),
      gamePhase: game.gamePhase,
      maxPlayers: game.maxPlayers,
      currentPlayers: game.players.length,
      createdAt: game.createdAt,
      lastActivity: game.lastActivity
    });
  });

  // Check if game exists and can be joined
  router.get('/games/:gameId/status', (req, res) => {
    const { gameId } = req.params;
    const game = gameManager.getGame(gameId);
    
    if (!game) {
      return res.json({ exists: false });
    }

    res.json({
      exists: true,
      canJoin: game.gamePhase === 'waiting' && game.players.length < game.maxPlayers,
      gamePhase: game.gamePhase,
      currentPlayers: game.players.length,
      maxPlayers: game.maxPlayers
    });
  });

  // Get server stats
  router.get('/stats', (req, res) => {
    // This would need to be implemented in GameManager
    res.json({
      activeGames: 0, // TODO: implement
      totalPlayers: 0, // TODO: implement
      uptime: process.uptime()
    });
  });

  return router;
}
