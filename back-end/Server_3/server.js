require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/mongodb");

const PORT = process.env.PORT2 || 4000;

// Use env variable instead of hardcoding
connectDB(process.env.MONGO_URI2);

app.listen(PORT,"0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
