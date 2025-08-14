# Muushig Game Client

A React TypeScript frontend for the Muushig Mongolian card game with real-time chat functionality.

## Features

- 🎮 **Game Management**: Create and join games
- 💬 **Real-time Chat**: Chat with players in the same game room
- 🔄 **Live Updates**: Real-time game state and chat updates
- 📱 **Responsive Design**: Works on desktop and mobile

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

The app will run on `http://localhost:3001` (since port 3000 is used by the backend server).

### Usage

1. **Enter your name** in the input field
2. **Create a new game** or **join an existing game** using a Game ID
3. **Chat with other players** in real-time
4. **View game information** including current phase and player count

## Chat Features

- **Player Messages**: Regular chat messages from players
- **System Messages**: Automatic notifications (player joins/leaves, game events)
- **Message History**: View previous messages in the chat
- **Real-time Updates**: Messages appear instantly for all players
- **Message Validation**: Empty messages and messages over 200 characters are rejected

## Socket Events

### Client to Server
- `create_game` - Create a new game
- `join_game` - Join an existing game
- `send_chat` - Send a chat message
- `get_chat_history` - Get chat history

### Server to Client
- `game_created` - Game created successfully
- `game_joined` - Successfully joined a game
- `chat_message` - New chat message received
- `chat_history` - Chat history for the game
- `player_joined` - New player joined
- `player_left` - Player disconnected

## Development

The app is built with:
- **React 18** with TypeScript
- **Socket.IO Client** for real-time communication
- **CSS Grid/Flexbox** for responsive layout

## Project Structure

```
src/
├── App.tsx          # Main application component
├── App.css          # Application styles
├── index.tsx        # Application entry point
└── index.css        # Global styles
```

## Testing the Chat

1. Open the app in multiple browser tabs/windows
2. Create a game in one tab
3. Join the same game in other tabs using the Game ID
4. Start chatting! Messages will appear in real-time across all tabs

## Backend Connection

The client connects to the backend server running on `http://localhost:3000`. Make sure the backend server is running before using the client.
