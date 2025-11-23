# ScribeAI

AI-powered audio transcription and summarization platform built with Next.js, WebSockets, and Google Gemini.

## Features

- **Real-time Streaming**: Live audio transcription via WebSocket
- **AI Summarization**: Automatic transcript summarization using Google Gemini
- **User Authentication**: Secure auth with email verification and session management
- **Recording Management**: Create, view, and organize transcribed recordings
- **Responsive Dashboard**: Intuitive UI for managing recordings and settings

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Backend**: Node.js with Socket.io for real-time streaming
- **Database**: PostgreSQL with Prisma ORM
- **AI**: Google Generative AI (Gemini)
- **Auth**: Better Auth with custom session management
- **State Management**: Zustand, XState

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Google API credentials

### Installation

```bash
npm install
npm run build
```

### Development

Run frontend and backend concurrently:
```bash
npm run dev:all
```

Or run separately:
```bash
npm run server     # Socket.io server
```

## Architecture Highlights

- **Chunked Processing**: Audio split into 30s chunks to handle long sessions
- **WebSocket Streaming**: Real-time transcription updates without polling
- **Stateless Backend**: Each chunk processed independently for scalability
- **Client-side Buffering**: Graceful handling of network interruptions

## Project Structure

```
src/
├── app/              # Next.js pages and API routes
├── lib/              # Core utilities (auth, socket, gemini)
├── hooks/            # React hooks for features
└── generated/        # Prisma client and types
```