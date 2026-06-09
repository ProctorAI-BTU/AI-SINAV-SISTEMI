
//MongoDB bağlantı testi
//Hem auth-source=admin ile hem doğrudan bağlantı ile dener.

const mongoose = require('mongoose');

const uris = [
  'mongodb://localhost:27017/ai_sinav_db',
  'mongodb://admin:admin123@localhost:27017/ai_sinav_db?authSource=admin',
  'mongodb://127.0.0.1:27017/ai_sinav_db',
];

async function testConnection() {
  console.log('=== MongoDB Bağlantı Testi ===\n');

  for (const uri of uris) {
    const display = uri.replace(/:([^:@]+)@/, ':***@');
    try {
      console.log(`Deneniyor: ${display}`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      
      // ping
      const admin = mongoose.connection.db.admin();
      const result = await admin.ping();
      console.log('Bağlantı BAŞARILI! Ping:', JSON.stringify(result));
      
      // var olan veritabanlarını listele
      const dbs = await admin.listDatabases();
      console.log('Mevcut veritabanları:');
      dbs.databases.forEach(db => {
        console.log(`     - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
      });

      // ai_sinav_db collection'larını listele
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log(`\nai_sinav_db collection'ları:`);
      if (collections.length === 0) {
        console.log('     (henüz collection yok - seed çalıştırılmalı)');
      } else {
        collections.forEach(col => {
          console.log(`     - ${col.name}`);
        });
      }

      await mongoose.disconnect();
      console.log('\n SONUÇ: MongoDB erişilebilir durumda!');
      console.log(`Çalışan URI: ${display}\n`);
      process.exit(0);
    } catch (err) {
      console.log(`Bağlantı BAŞARISIZ: ${err.message}\n`);
      try { await mongoose.disconnect(); } catch(_) {}
    }
  }

  console.log('SONUÇ: Hiçbir URI ile bağlantı kurulamadı!');
  console.log('Kontrol edin:');
  console.log('  1. MongoDB servisi çalışıyor mu? (services.msc veya Task Manager)');
  console.log('  2. Port 27017 açık mı?');
  console.log('  3. Studio 3T ile bağlantı ayarlarını kontrol edin\n');
  process.exit(1);
}

testConnection();
