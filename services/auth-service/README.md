# 🔐 Auth Service (Yetkilendirme Servisi)

Bu mikroservis, AI Destekli Mülakat/Sınav sisteminin temel kullanıcı yönetimi ve yetkilendirme (Auth) işlemlerini üstlenir. Modern güvenlik standartlarına (JWT, bcrypt, Rate Limiting) uygun olarak tasarlanmıştır.

## ✨ Özellikler

* **Kayıt ve Giriş:** E-posta ve şifre ile güvenli kullanıcı yönetimi.
* **JWT (JSON Web Token):** Stateless ve güvenli oturum yönetimi.
* **Refresh Token:** Oturumu sonlandırmadan arka planda token yenileme mekanizması.
* **Rol Tabanlı Erişim Kontrolü (RBAC):** `student`, `instructor`, `admin` yetki seviyeleri.
* **Şifremi Unuttum & Sıfırlama:** E-posta üzerinden güvenli şifre sıfırlama (Nodemailer destekli).
* **E-posta Doğrulama:** Kayıt sonrası maile giden link ile hesap doğrulama.
* **Güvenlik (Security):** Brute-force saldırılarına karşı IP bazlı Rate Limit ve XSS koruması (Helmet).
* **Test Edilebilir:** Hem birim (Unit - JWT) hem de entegrasyon (Integration) testlerine sahiptir.

---

## 🛠️ Kurulum ve Çalıştırma

Projeyi bilgisayarınızda yerel olarak (Local) veya Docker üzerinden kolayca ayağa kaldırabilirsiniz.

### Gereksinimler
* [Node.js](https://nodejs.org/en/) (v18 veya üzeri)
* [MongoDB](https://www.mongodb.com/try/download/community) (Lokal kurulum veya Docker container)

### 1. Yerel (Local) Kurulum

```bash
# 1. Bağımlılıkları yükleyin
npm install

# 2. Örnek ortam değişkenleri dosyasını kopyalayın
cp .env.example .env

# 3. .env dosyasını kendi veritabanı ve mail bilgilerinize göre güncelleyin
```

### 2. Ortam Değişkenleri (`.env`)

`.env` dosyasında şu ayarların olduğundan emin olun:
```env
PORT=3001
MONGO_URI=mongodb://localhost:27017/ai_sinav_db
JWT_SECRET=super_gizli_anahtariniz
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=super_gizli_refresh_anahtariniz
JWT_REFRESH_EXPIRES_IN=30d

# Mail Gönderimi İçin (Geliştirme ortamında ethereal.email kullanabilirsiniz)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=kullanici_adiniz
SMTP_PASS=sifreniz
FROM_NAME="AI Sınav Sistemi"
FROM_EMAIL="noreply@aisinav.com"
```

### 3. Uygulamayı Başlatma

```bash
# Geliştirici modu (Nodemon ile çalışır, kod değiştikçe yenilenir)
npm run dev

# Prodüksiyon (Canlı) modu
npm start
```
Uygulama başarıyla başladığında konsolda `Auth Service çalışıyor: http://localhost:3001` ve `MongoDB bağlantısı başarılı` mesajlarını göreceksiniz.

---

## 🐳 Docker ile Çalıştırma

Bilgisayarınızda Node.js kurulu olmasa bile Docker kullanarak projeyi saniyeler içinde başlatabilirsiniz. Proje kök dizinindeki `docker-compose.yml` dosyasını kullanın:

```bash
# Tüm servisleri ve veritabanını Docker üzerinde başlat
docker-compose up -d --build
```

---

## 🗄️ Veritabanına Test Verisi Ekleme (Seed)

Sistemi test etmek için hazır `admin`, `instructor` ve `student` hesaplarını veritabanına ekleyebilirsiniz:

```bash
npm run seed
```
**Oluşturulan Hesaplar:**
* **Admin:** admin@sinav.com / admin123
* **Eğitmen:** instructor@sinav.com / instructor123
* **Öğrenci:** student@sinav.com / student123

---

## 🧪 Testleri Çalıştırma

Servisin çalışır durumda olduğunu doğrulamak için testleri kullanabilirsiniz:

```bash
# Entegrasyon Testleri (MongoDB çalışıyor olmalıdır)
npm test

# JWT Unit Testleri (Veritabanı gerektirmez)
node tests/unit/jwt.test.js
```

---

## 📡 API Uç Noktaları (Endpoints)

| İstek Türü | Endpoint | Açıklama | Yetki |
|------------|----------|----------|-------|
| `POST` | `/api/auth/register` | Yeni kullanıcı kaydı oluşturur | Herkes |
| `POST` | `/api/auth/login` | Sisteme giriş yapar ve token döner | Herkes |
| `GET` | `/api/auth/me` | Oturum açan kullanıcının profilini getirir | User |
| `POST` | `/api/auth/refresh-token`| Süresi dolan token'ı yeniler | Herkes |
| `PUT` | `/api/auth/change-password`| Şifreyi değiştirir | User |
| `PUT` | `/api/auth/update-profile`| Kullanıcı adını günceller | User |
| `POST` | `/api/auth/forgot-password`| Şifre sıfırlama maili gönderir | Herkes |
| `PUT` | `/api/auth/resetpassword/:token`| Maildeki token ile şifreyi sıfırlar | Herkes |
| `GET` | `/api/auth/verifyemail/:token`| Mail adresini doğrular | Herkes |
| `GET` | `/api/users` | Tüm kullanıcıları listeler | Admin |
| `PUT` | `/api/users/:id/role` | Kullanıcının rolünü değiştirir | Admin |
| `PUT` | `/api/users/:id/active` | Kullanıcı hesabını aktif/pasif yapar | Admin |
