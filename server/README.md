# Muushig Game Server

A real-time multiplayer server for the authentic Mongolian card game Muushig, built with Node.js, Express, and Socket.IO.

## About Muushig

Muushig is one of the most popular card games in Mongolia, played by 2-5 people. The word "Muushig" comes from "mushig" - when a player who is about to go out without a response is caught by others and their score is increased by 5 without building a single house.

## Game Rules

### Players & Cards
- **2-5 players** (best with 5)
- **Variable deck size** based on player count:
  - 2 players: J, Q, K, A (16 cards)
  - 3 players: 9, 10, J, Q, K, A (24 cards)
  - 4 players: 8, 9, 10, J, Q, K, A (28 cards)
  - 5 players: 7, 8, 9, 10, J, Q, K, A (32 cards)

### Scoring System
- **Starting score**: 15 points for each player
- **Goal**: Reduce score to 0 or below
- **Houses built**: Subtract from score
- **Penalty**: +5 points if you enter but build no houses
- **No penalty**: If you don't enter the game

### Game Flow

1. **Dealing**: 5 cards dealt to each player, 1 trump card face up
2. **Entering**: Players decide whether to enter the game
3. **Exchange**: Players who entered can exchange cards with the "tree"
4. **Playing**: Build houses by playing cards in sequence
5. **Scoring**: Calculate final scores based on houses built

### House Building
- Players play cards in sequence to form "houses"
- Must follow suit if possible
- Trump cards beat non-trump cards
- Highest card in the suit wins the house
- Winner leads the next house

### Special Rules
- **Dealer**: Shuffles cards and holds the bank
- **Mouth**: First player to act in each phase
- **Auto-entry**: Last two players must enter if others decline
- **Trump suit**: Determined by face-up card
- **Following suit**: Must play same suit if you have it

## Features

- **Real-time gameplay** using Socket.IO
- **No authentication required** - games are ephemeral
- **Simple game creation** with invite links
- **Automatic cleanup** of inactive games
- **REST API** for game management
- **Authentic Mongolian rules** implementation

## API Endpoints

### Create a Game
```http
POST /api/games
Content-Type: application/json

{
  "hostName": "Player Name",
  "maxPlayers": 5
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
    "maxPlayers": 5,
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
  "maxPlayers": 5
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
- `enter_game` - Enter the current round
- `decline_game` - Decline to enter the current round
- `exchange_cards` - Exchange cards with the tree
- `play_card` - Play a card from hand
- `get_game_state` - Get current game state

### Server to Client
- `game_created` - Game created successfully
- `game_joined` - Successfully joined a game
- `game_started` - Game has started
- `game_state` - Current game state update
- `game_ended` - Game finished with final scores
- `player_joined` - New player joined
- `player_left` - Player disconnected
- `player_entered` - Player decided to enter
- `player_declined` - Player decided not to enter
- `house_completed` - A house was completed
- `play_error` - Invalid move attempted

## Game Phases

1. **waiting** - Players joining the game
2. **dealing** - Cards dealt, players deciding to enter
3. **entering** - Players making enter/decline decisions
4. **exchanging** - Players exchanging cards with tree
5. **playing** - Active gameplay building houses
6. **finished** - Game complete with final scores

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
3. **Dealing**: Cards are dealt and trump card is revealed
4. **Entering**: Players decide whether to participate
5. **Exchange**: Players improve their hands
6. **Playing**: Real-time house building gameplay
7. **Scoring**: Final scores calculated and game ends
8. **Cleanup**: Inactive games are automatically removed after 30 minutes

## Next Steps

- Build the frontend client
- Add more game features (chat, spectators)
- Implement game history
- Add sound effects and animations
- Support for multiple rounds/games
