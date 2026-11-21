const mongoose = require("mongoose");

const watchlistSchema = new mongoose.Schema(
  {
    // ✅ FIX: Change Number to String. 
    // This allows it to accept UUIDs (e.g. "550e8400...") or String IDs from the JWT.
    userId: { type: String, required: true }, 
    
    symbol: { type: String, required: true }
  },
  { timestamps: true }
);

// This ensures a user cannot add the same coin twice
watchlistSchema.index(
  { userId: 1, symbol: 1 },
  { unique: true }
);

module.exports = mongoose.model("Watchlist", watchlistSchema);