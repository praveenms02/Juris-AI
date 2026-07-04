/**
 * MongoDB connection helper.
 * Keeps connection logic in one place for easier maintenance.
 */
const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set in environment variables");
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
  } catch (err) {
    if (err.name === "MongooseServerSelectionError" || err.message?.includes("ECONNREFUSED")) {
      console.error("\nMongoDB is not running or not reachable at the URI in MONGODB_URI.");
      console.error("Start it locally (macOS Homebrew): brew services start mongodb-community");
      console.error(`Current URI: ${uri}\n`);
    }
    throw err;
  }
}

module.exports = { connectDB };
