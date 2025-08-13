# Muushig Game Server

A real-time multiplayer server for the Mongolian card game Muushig, built with Node.js, Express, and Socket.IO.

## Features

- **Real-time gameplay** using Socket.IO
- **No authentication required** - games are ephemeral
- **Simple game creation** with invite links
- **Automatic cleanup** of inactive games
- **REST API** for game management

## Game Rules (Muushig)

Muushig is a simple card matching game where players:
- Start with 7 cards each
- Play cards that match the suit or rank of the top card on the discard pile
- Draw a card if they can't play
- Win by getting rid of all their cards first

## API Endpoints

### Create a Game
```http
POST /api/games
Content-Type: application/json

{
  "hostName": "Player Name",
  "maxPlayers": 4
}
```

Response:
```json
{
  "gameId": "uuid",
  "inviteLink": "http://localhost:3000/join/gameId",
  "game": {
    "id": "uuid",
    "players": [...],
    "gamePhase": "waiting",
    "maxPlayers": 4,
    "createdAt": "2025-08-13T03:22:05.451Z"
  }
}
```

### Get Game Status
```http
GET /api/games/{gameId}/status
```

Response:
```json
{
  "exists": true,
  "canJoin": true,
  "gamePhase": "waiting",
  "currentPlayers": 1,
  "maxPlayers": 4
}
```

### Get Game Info
```http
GET /api/games/{gameId}
```

## Socket.IO Events

### Client to Server
- `create_game` - Create a new game
- `join_game` - Join an existing game
- `start_game` - Start the game (host only)
- `play_card` - Play a card from hand
- `draw_card` - Draw a card from deck
- `get_game_state` - Get current game state

### Server to Client
- `game_created` - Game created successfully
- `game_joined` - Successfully joined a game
- `game_started` - Game has started
- `game_state` - Current game state update
- `game_ended` - Game finished with winner
- `player_joined` - New player joined
- `player_left` - Player disconnected
- `play_error` - Invalid move attempted
- `draw_error` - Cannot draw card

## Running the Server

```bash
# Install dependencies
npm install

# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The server runs on port 3000 by default. Set the `PORT` environment variable to change this.

## Health Check

```http
GET /health
```

Returns "ok" if the server is running.

## Game Lifecycle

1. **Creation**: Host creates a game and gets an invite link
2. **Joining**: Players join using the invite link
3. **Waiting**: Players wait for the host to start the game
4. **Playing**: Real-time card game with turns
5. **Finished**: Game ends when a player wins
6. **Cleanup**: Inactive games are automatically removed after 30 minutes

## Next Steps

- Build the frontend client
- Add more game features (chat, spectators)
- Implement game history
- Add sound effects and animations
