require('dotenv').config();

const app = require('./app');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 3002;

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Exam Service ${PORT} portunda çalışıyor.`);
  });
}

startServer();