require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database configuration
// Support both individual environment variables and DATABASE_URL (Render.com format)
let dbConfig;

if (process.env.DATABASE_URL || process.env.DB_EXTERNAL_URL) {
  // Render.com provides DATABASE_URL or DB_EXTERNAL_URL in format: postgresql://user:password@host:port/database
  const connectionString = process.env.DATABASE_URL || process.env.DB_EXTERNAL_URL;
  dbConfig = {
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false // Required for Render.com PostgreSQL
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
} else {
  // Fallback to individual environment variables
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'real_activity',
    port: parseInt(process.env.DB_PORT) || 5432,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

// Create connection pool
const pool = new Pool(dbConfig);

// Initialize database
async function initializeDatabase() {
  try {
    const client = await pool.connect();
    
    // Create activities table
    await client.query(`CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      avatar TEXT,
      game VARCHAR(255) NOT NULL,
      gameType VARCHAR(50) NOT NULL,
      activityType VARCHAR(50) NOT NULL,
      betAmount INTEGER DEFAULT 0,
      winAmount INTEGER DEFAULT 0,
      location VARCHAR(10),
      isLive BOOLEAN DEFAULT FALSE,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create indexes for better performance (PostgreSQL syntax)
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_timestamp ON activities(timestamp DESC)`);
    } catch (indexError) {
      // Index might already exist, ignore error
      console.log('Index idx_timestamp already exists or creation failed');
    }
    
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_gameType ON activities(gameType)`);
    } catch (indexError) {
      // Index might already exist, ignore error
      console.log('Index idx_gameType already exists or creation failed');
    }
    
    client.release();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Game data arrays (moved from frontend)
const names = [
  "John", "Sarah", "Mike", "Emma", "David", "Lisa", "Tom", "Anna", "Chris", "Maria",
  "James", "Sophie", "Ryan", "Olivia", "Kevin", "Jenny", "Rob", "Mandy", "Dan", "Michi",
  "Alex", "Jess", "Matt", "Ash", "Jake", "Meg", "Nick", "Kayla", "Zach", "Britt",
  "Austin", "Sierra", "Cam", "Destiny", "Logan", "Jas", "Noah", "Taylor", "Morgan", "Hunter",
  "Lexi", "Connor", "Jordan", "Paige", "Blake", "Brooke", "Dylan", "Madi", "Caleb", "Haley"
];

const casinoGames = [
  "Barracat", "Poker", "Blackjack", "Roulette", "Baccarat", "Dragon Tiger", "Sic Bo",
  "Fan Tan", "Teen Patti", "Andar Bahar", "Rummy", "Texas Hold'em", "Omaha",
  "Seven Card Stud", "Caribbean Stud", "Three Card Poker", "Pai Gow Poker", "Let It Ride",
  "Casino War", "Red Dog"
];

const slotGames = [
  "Mega Moolah", "Starburst", "Gonzo's Quest", "Book of Dead", "Dead or Alive", "Bonanza",
  "Reactoonz", "Jammin' Jars", "Sweet Bonanza", "Gates of Olympus", "Big Bass Bonanza",
  "Money Train", "Razor Shark", "Piggy Riches", "Divine Fortune", "Twin Spin", "Jack Hammer",
  "Thunderstruck", "Immortal Romance", "Game of Thrones", "Jurassic Park", "Terminator 2"
];

const virtualSports = [
  "Virtual Football", "Virtual Basketball", "Virtual Tennis", "Virtual Horse Racing",
  "Virtual Dog Racing", "Virtual Speedway", "Virtual Greyhounds", "Virtual Soccer",
  "Virtual Basketball", "Virtual Volleyball"
];

const sportsGames = [
  "Football", "Basketball", "Tennis", "Baseball", "Soccer", "Hockey", "Cricket", "Rugby",
  "Golf", "Boxing", "MMA", "Formula 1", "MotoGP", "Cycling", "Swimming", "Athletics",
  "Volleyball", "Handball", "Badminton", "Table Tennis", "Snooker"
];

const locations = [
  "US", "CA", "UK", "AU", "DE", "FR", "JP", "KR", "BR", "IT", "ES", "NL", "SE", "NO",
  "DK", "FI", "CH", "AT", "BE", "PL", "CZ", "HU", "PT", "GR", "IE", "NZ", "SG", "HK",
  "MY", "TH", "PH", "ID", "VN", "IN", "PK", "BD", "LK", "MM", "KH", "LA", "TW", "CN",
  "RU", "UA", "TR"
];

// Generate single activity (calculation logic moved from frontend)
function generateActivity() {
  const name = names[Math.floor(Math.random() * names.length)];
  const gameTypeRandom = Math.random();
  let gameType, game;

  if (gameTypeRandom > 0.99) {
    // 5% real sports betting
    gameType = "sports";
    game = sportsGames[Math.floor(Math.random() * sportsGames.length)];
  } else if (gameTypeRandom > 0.7) {
    // 25% virtual sports
    gameType = "virtual";
    game = virtualSports[Math.floor(Math.random() * virtualSports.length)];
  } else if (gameTypeRandom > 0.4) {
    // 30% slots
    gameType = "slot";
    game = slotGames[Math.floor(Math.random() * slotGames.length)];
  } else {
    // 40% casino
    gameType = "casino";
    game = casinoGames[Math.floor(Math.random() * casinoGames.length)];
  }

  let betAmount, winAmount;

  if (gameType === "sports") {
    // Real sports betting: only wins, amounts more than $50
    const isSmallAmount = Math.random() > 0.5; // 50% chance for amounts < $100
    
    let winAmountValue;
    if (isSmallAmount) {
      // Multiples of 10: $50, $60, $70, $80, $90
      const multiplier = Math.floor(Math.random() * 5) + 5; // 5-9
      winAmountValue = multiplier * 10; // 50-90
    } else {
      // Multiples of 100: $100, $200, $300, $400, $500, $600, $700, $800, $900, $1000
      const multiplier = Math.floor(Math.random() * 10) + 1; // 1-10
      winAmountValue = multiplier * 100; // 100-1000
    }
    
    betAmount = 0;
    winAmount = winAmountValue;
  } else if (gameType === "virtual") {
    // Virtual sports: betting amount less than -$10 or more than +$10, multiples of 10
    const isLoss = Math.random() > 0.5; // 50% chance of loss
    if (isLoss) {
      // Loss: less than -$10 (e.g., -$20, -$30, -$50), multiples of 10
      const lossMultiplier = Math.floor(Math.random() * 9) + 1; // 1-9
      const lossAmount = lossMultiplier * 10; // 10-90 (multiples of 10)
      betAmount = lossAmount;
      winAmount = 0;
    } else {
      // Win: more than +$10 (e.g., +$20, +$30, +$50), multiples of 10
      const winAmountValue = Math.floor(Math.random() * 90) + 10; // 10-90
      betAmount = 0;
      winAmount = winAmountValue;
    }
  } else {
    // Casino and slots: original logic
    betAmount = Math.floor(Math.random() * 30) + 1; // $1-$30 bet amount
    const isWin = Math.random() > 0.55; // 45% win rate
    winAmount = isWin ? Math.floor(Math.random() * 150) + 1 : 0; // Win amount 0-150
  }

  const isWin = winAmount > 0;
  const activityType = isWin
    ? gameType === "sports"
      ? "sportsWin"
      : winAmount > 50
      ? "jackpot"
      : "win"
    : "bet";

  return {
    username: name,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${Math.floor(Math.random() * 16777215).toString(16)}&color=fff&size=32&bold=true`,
    game: game,
    gameType: gameType,
    activityType: activityType,
    betAmount: betAmount,
    winAmount: winAmount,
    location: locations[Math.floor(Math.random() * locations.length)],
    isLive: Math.random() > 0.7 // 30% are live
  };
}

// Function to insert activity into database
async function insertActivity(activity) {
  try {
    const client = await pool.connect();
    const result = await client.query(
      `INSERT INTO activities 
       (username, avatar, game, gameType, activityType, betAmount, winAmount, location, isLive) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        activity.username,
        activity.avatar,
        activity.game,
        activity.gameType,
        activity.activityType,
        activity.betAmount,
        activity.winAmount,
        activity.location,
        activity.isLive
      ]
    );
    
    // Check if we need to clean up old records
    const countResult = await client.query('SELECT COUNT(*) as count FROM activities');
    const currentCount = parseInt(countResult.rows[0].count);
    
    client.release();
    
    if (currentCount > 100) {
      await cleanOldActivities();
    }
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Error inserting activity:', error);
    throw error;
  }
}

// Function to get recent activities
async function getRecentActivities(limit = 20) {
  try {
    const client = await pool.connect();
    const result = await client.query(
      `SELECT * FROM activities 
       ORDER BY timestamp DESC 
       LIMIT $1`,
      [limit]
    );
    client.release();
    return result.rows;
  } catch (error) {
    console.error('Error fetching activities:', error);
    throw error;
  }
}

// Function to clean old activities (keep only last 100)
async function cleanOldActivities() {
  try {
    const client = await pool.connect();
    
    // First, check the current count
    const countResult = await client.query('SELECT COUNT(*) as count FROM activities');
    const currentCount = parseInt(countResult.rows[0].count);
    
    if (currentCount > 100) {
      // Delete old records, keeping only the most recent 100
      await client.query(
        `DELETE FROM activities 
         WHERE id NOT IN (
           SELECT id FROM (
             SELECT id FROM activities 
             ORDER BY timestamp DESC 
             LIMIT 100
           ) AS temp
         )`
      );
      console.log(`Cleaned old activities. Kept 100 most recent records.`);
    }
    
    client.release();
  } catch (error) {
    console.error('Error cleaning old activities:', error);
    throw error;
  }
}

// API Routes

// Get recent activities (index 86-100, which is the 15 most recent)
app.get('/api/activities', async (req, res) => {
  try {
    const { limit = 15 } = req.query;
    const activities = await getRecentActivities(parseInt(limit));
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize with some activities
async function initializeActivities() {
  try {
    // Check if we have any activities
    const existingActivities = await getRecentActivities(1);
    
    if (existingActivities.length === 0) {
      console.log('Initializing database with sample activities...');
      
      // Generate 20 initial activities
      for (let i = 0; i < 20; i++) {
        const activity = generateActivity();
        await insertActivity(activity);
      }
      
      console.log('Database initialized with 20 activities');
    }
  } catch (error) {
    console.error('Error initializing activities:', error);
  }
}

// Schedule to generate new activities every 1-10 seconds (random interval)
let lastGenerationTime = 0;
const minInterval = 2000; // 2 seconds
const maxInterval = 10000; // 10 seconds

setInterval(async () => {
  const now = Date.now();
  const timeSinceLastGeneration = now - lastGenerationTime;
  const randomInterval = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
  
  if (timeSinceLastGeneration >= randomInterval) {
    try {
      const activity = generateActivity();
      await insertActivity(activity);
      lastGenerationTime = now;
      
      // Clean old activities more frequently (every 10 activities)
      if (Math.random() < 0.1) { // 10% chance
        await cleanOldActivities();
      }
    } catch (error) {
      console.error('Error in scheduled activity generation:', error);
    }
  }
}, 1000); // Check every second

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeDatabase();
  await initializeActivities();
  console.log('Live activities backend is ready!');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  try {
    await pool.end();
    console.log('Database connection pool closed.');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
  process.exit(0);
});