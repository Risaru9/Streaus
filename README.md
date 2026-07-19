# 🎬 WatchParty — Watch Together

A synchronized video watching platform that lets you and your partner watch the same video together remotely with perfect playback synchronization and real-time chat.

## Features (MVP)

- 🎥 **Local Video Playback** — Both users load the same video file from their own devices
- 🔗 **URL Video Playback** — Load a video from a public URL  
- 🔄 **Synchronized Playback** — Play, Pause, and Seek sync instantly across all viewers
- 💬 **Real-time Chat** — Text chat with emoji reactions
- 👥 **User Presence** — See who's in the room
- 📱 **Mobile Responsive** — Works on desktop and mobile browsers
- 🌙 **Dark Mode** — Comfortable viewing experience

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)

## Getting Started

### 1. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Start the Backend Server

```bash
cd server
npm run dev
```

The server will start on `http://localhost:3001`.

### 3. Start the Frontend

Open a **new terminal**:

```bash
cd client
npm run dev
```

The client will start on `http://localhost:3000`.

### 4. Open in Browser

Open `http://localhost:3000` in your browser.

## How to Test (Two Users on One Machine)

1. Open **two separate browser windows** (or tabs) to `http://localhost:3000`.
2. In **Window 1**: Enter a display name and click **"Create Room"**.
3. Copy the **Room Code** shown at the top of the room page.
4. In **Window 2**: Enter a display name and paste the room code, then click **"Join Room"**.
5. In **both windows**: Click the file picker and load the **same video file** (e.g., an MP4 from your computer).
6. Click **Play** in either window — both videos should start playing in sync!
7. Try **pausing**, **seeking**, or **chatting** — everything syncs in real-time.

## How to Test (Two Users on Different Machines)

Both machines must be on the **same local network** (same Wi-Fi).

1. Find your machine's local IP address:
   - **Windows**: Run `ipconfig` in Command Prompt → look for `IPv4 Address` (e.g., `192.168.1.100`)
   - **macOS/Linux**: Run `ifconfig` or `ip addr`
2. Start the server: `cd server && npm run dev`
3. Start the client: `cd client && npm run dev`
4. On the **second machine**, open the browser and go to: `http://192.168.1.100:3000` (replace with your actual IP)

> **Note:** You may need to update the Socket.io connection URL in `client/src/lib/socket.js` to point to your local IP instead of `localhost`.

## Project Structure

```
Streaming_couple/
├── server/                 # Backend server
│   ├── index.js            # Express + Socket.io server
│   ├── roomManager.js      # In-memory room state management
│   └── package.json
├── client/                 # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.js         # Landing page (Create/Join room)
│   │   │   ├── room/[id]/
│   │   │   │   └── page.js     # Watch room page
│   │   │   ├── globals.css     # Global design system
│   │   │   └── layout.js       # Root layout
│   │   ├── components/
│   │   │   ├── VideoPlayer.jsx # Custom video player
│   │   │   ├── ChatPanel.jsx   # Real-time chat
│   │   │   └── UserList.jsx    # Online users list
│   │   └── lib/
│   │       └── socket.js       # Socket.io client singleton
│   └── package.json
└── README.md
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) |
| Styling | Vanilla CSS (Dark Theme) |
| Real-time Sync | Socket.io |
| Backend | Node.js + Express |
| State Management | In-memory (Map-based) |

## Synchronization Algorithm

1. User A clicks **Play** → frontend emits `player:play` with `currentTime`
2. Server broadcasts `player:play` to all other users in the room
3. User B receives the event → seeks to `currentTime` and plays
4. If User B **buffers**, a `player:buffering` event pauses everyone
5. When User B recovers, playback resumes for all

## License

This project is for personal/educational use. Do not use it to stream copyrighted content without proper authorization.
