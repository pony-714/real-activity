# Live Activities Backend

This backend service handles the calculation and storage of live betting activities for the frontend application.

## Features

- **Database Storage**: Stores all activities in MySQL database
- **Real-time Generation**: Automatically generates new activities every 2 seconds
- **API Endpoints**: RESTful API for frontend integration
- **Data Filtering**: Server-side filtering by game type and activity type

## Database Configuration

The backend connects to a MySQL database with the following configuration:
- Host: sql3.freesqldatabase.com
- Database: sql3799698
- User: sql3799698
- Port: 3306

## API Endpoints

### GET /api/activities
Fetch recent activities with optional filtering.

**Query Parameters:**
- `limit` (optional): Number of activities to return (default: 20)
- `filter` (optional): Filter by type - "all", "casino", "slots", "sports", "virtual", "wins"

**Example:**
```
GET /api/activities?limit=10&filter=casino
```

### POST /api/activities/generate
Generate a new activity and store it in the database.

**Response:**
```json
{
  "id": 123,
  "username": "John",
  "avatar": "https://ui-avatars.com/api/...",
  "game": "Poker",
  "gameType": "casino",
  "activityType": "win",
  "betAmount": 0,
  "winAmount": 150,
  "location": "US",
  "isLive": true
}
```

### GET /api/health
Health check endpoint.

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

The server will run on port 3001 by default.

## Database Schema

The `activities` table stores the following data:
- `id`: Auto-increment primary key
- `username`: Player name
- `avatar`: Avatar URL
- `game`: Game name
- `gameType`: Type of game (casino, slot, sports, virtual)
- `activityType`: Type of activity (bet, win, jackpot, sportsWin)
- `betAmount`: Bet amount (0 for wins)
- `winAmount`: Win amount (0 for losses)
- `location`: Player location (country code)
- `isLive`: Whether the activity is live
- `timestamp`: When the activity occurred

## Automatic Activity Generation

The backend automatically generates new activities every 2 seconds using a cron job. The generation logic includes:

- **Sports betting**: Only wins, amounts $50-$1000
- **Virtual sports**: Wins/losses in multiples of $10
- **Casino games**: Random bet amounts $1-$30, 45% win rate
- **Slot games**: Random bet amounts $1-$30, 45% win rate

## Data Cleanup

The system automatically cleans old activities, keeping only the most recent 1000 records to maintain performance.
