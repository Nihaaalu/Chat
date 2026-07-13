# Private Chat

A modern, mobile-first, secure one-to-one temporary conversation vault. Private Chat operates on ephemeral rooms and automatically destroys messages, participants, and room contexts once users disconnect or timeout.

## Key Features

- **One-to-One Isolation**: Maximum of 2 participants per room. Any subsequent participant will receive a `Room Full` notification.
- **Auto-Cleanup**: When rooms become empty, the database is pruned, ensuring zero historical logs remain.
- **Privacy Core**:
  - **Tab-Hidden Countdown**: If a browser tab goes to the background/hidden state for more than **20 seconds**, the user is automatically logged out, destroying the session.
  - **Inactivity Logouts**: Session automatically expires after **30 minutes** of absolute silence (no keys, clicks, or scrolls).
  - **No Persistent Storage**: Session details are kept strictly inside `sessionStorage` (which self-destructs when the tab is closed) and never written to `localStorage`.
- **Three Modern Premium Themes**: Dark, Light, and Pink customizable presets with immediate visual feedback.
- **Subtle Micro-Animations**: Fast page transitions, message animations, and theme-switching layouts powered by `Framer Motion`.

---

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Framer Motion, Lucide Icons, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO
- **Database**: SQLite, Prisma ORM

---

## Installation & Setup

Follow these simple steps to run Private Chat in your local environment:

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate SQLite Schema & Client
Run the Prisma migration to bootstrap the SQLite local database file (`dev.db`):
```bash
npx prisma migrate dev --name init
```

### 3. Start Development Server
Boot up the dual Express + Socket.IO + Vite pipeline:
```bash
npm run dev
```

The application is fully accessible at: **`http://localhost:3000`**

---

## Project Structure

```text
/
├── prisma/
│   └── schema.prisma        # SQLite database definition & relations
├── server/
│   └── db.ts                # Lazily-instantiated Prisma client singleton
├── src/
│   ├── components/
│   │   ├── ChatView.tsx     # Handles websockets, chat cards, and real-time alerts
│   │   ├── CreateRoomView.tsx  # Presents the 4-digit code and copy actions
│   │   ├── HomeView.tsx     # Elegant minimal landing page
│   │   ├── JoinRoomView.tsx # Safe nickname & code submission form
│   │   └── ThemeSelector.tsx # Micro-animated emoji theme-picker
│   ├── App.tsx              # Central state machine & security heartbeat controller
│   ├── theme.ts             # Visual parameters for the three theme modes
│   └── types.ts             # Strong type definitions
├── server.ts                # Express backend & Socket.IO server configurations
└── README.md                # Project documentation
```
