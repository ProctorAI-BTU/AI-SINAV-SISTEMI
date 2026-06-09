const mongoose = require('mongoose');

async function connectDB() {
  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://mongodb:27017/ai_exam_system';

  try {
    await mongoose.connect(mongoUri);
    console.log('Exam Service MongoDB bağlantısı başarılı.');
  } catch (error) {
    console.error('Exam Service MongoDB bağlantısı başarısız:', error.message);
    console.warn('Servis mock/in-memory modda çalışmaya devam edecek.');
  }
}

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = {
  connectDB,
  isMongoConnected,
};