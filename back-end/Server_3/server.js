require("dotenv").config();
//console.log("ENV CHECK:", process.env.MYSQL_HOST);
const app = require("./app");
const connectDB = require("./config/mongodb");

const PORT = process.env.PORT || 4000;

// Use env variable instead of hardcoding
connectDB(process.env.MONGO_URI);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
