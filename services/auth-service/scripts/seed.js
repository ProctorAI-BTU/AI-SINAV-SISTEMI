require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai_sinav_db';

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['student', 'instructor', 'admin'], default: 'student' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const seedUsers = [
  { name: 'Admin', email: 'admin@sinav.com', password: 'admin123', role: 'admin' },
  { name: 'Eğitmen Test', email: 'instructor@sinav.com', password: 'instructor123', role: 'instructor' },
  { name: 'Öğrenci Test', email: 'student@sinav.com', password: 'student123', role: 'student' },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(' MongoDB bağlantısı başarılı');

    for (const userData of seedUsers) {
      const exists = await User.findOne({ email: userData.email });
      if (exists) {
        console.log(` ${userData.email} zaten var, atlanıyor`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(userData.password, 12);
      await User.create({ ...userData, password: hashedPassword });
      console.log(` ${userData.role}: ${userData.email} oluşturuldu`);
    }

    console.log('\n Seed tamamlandı!\n');
    console.log('Test Hesapları:');
    console.log('─'.repeat(50));
    console.log('Admin      → admin@sinav.com / admin123');
    console.log('Eğitmen    → instructor@sinav.com / instructor123');
    console.log('Öğrenci    → student@sinav.com / student123');
    console.log('─'.repeat(50));
  } catch (err) {
    console.error(' Seed hatası:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
