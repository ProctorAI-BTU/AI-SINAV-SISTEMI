# 🎓 AI Proctoring Platform — Test Kılavuzu

Bu platform, hem **Bağımsız Web Uygulaması (Standalone)** olarak hem de şirketlerin kendi sistemlerine entegre edebileceği **Taşınabilir B2B SaaS Entegrasyonu (Embeddable Widget / Iframe / API Gateway)** olarak çalışacak şekilde tasarlanmıştır.

Aşağıda bu iki kullanım senaryosunu adım adım nasıl test edeceğiniz açıklanmıştır.

---

## ⚡ 1. TEST ÖNCESİ HAZIRLIK

Öncelikle dağınık dizin yapısını temizlemek ve silinen kontrol paneli (B2B Panel) dosyalarını kurtarmak için hazırladığımız entegrasyon betiğini çalıştırın:

```bash
node scripts/fix_project.js
```
*(Bu işlem `panel/` klasörünü .zip dosyasından çıkaracak, `.bat` dosyalarını `scripts/` altına taşıyacak ve ana dizine temiz kısayollar yerleştirecektir.)*

---

## 🚀 SENARYO A: BAĞIMSIZ WEB UYGULAMASI (STANDALONE WEB APP)

Bu modda, platform kendi başına çalışan bir web uygulamasıdır. Öğrenciler ve eğitmenler/adminler tek bir React arayüzü (`http://localhost:5173`) üzerinden işlem yaparlar.

### Adım 1: Standart Backend Servislerini Başlatın
Tüm backend mikroservislerini ve AI analiz modüllerini standart modda Docker üzerinde çalıştırın. Bu modda mikroservis portları localhost dışına açılır (3001-3004).
```bash
docker compose up -d --build
```

### Adım 2: Frontend Uygulamasını Başlatın
Yerel terminalde `frontend` klasörüne giderek bağımlılıkları yükleyin ve Vite sunucusunu ayağa kaldırın:
```bash
cd frontend
npm install
npm run dev
```

### Adım 3: Tarayıcıda Test Edin
1. Tarayıcınızda **`http://localhost:5173`** adresine gidin.
2. **Eğitmen Girişi:** `egitmen1@gmail.com` / `123456` şifresiyle giriş yapın. Yeni sınav oluşturun ve size verilen 6 haneli **Sınav Kodunu** kopyalayın.
3. **Öğrenci Girişi:** Çıkış yapıp `ogrenci1@gmail.com` / `123456` şifresiyle giriş yapın. Sınav kodunu girerek sınava başlayın. Kamera/Mikrofon izinlerini verip sınav odasına girin.
4. **Gözetleme Analizi:** Sınav sırasında sekmeyi değiştirmeyi, kameradan uzaklaşmayı deneyin. Risk skorunuzun anlık olarak güncellendiğini göreceksiniz.

---

## 🔌 SENARYO B: TAŞINABİLİR B2B SAAS ENTEGRASYONU (PORTABLE INTEGRATION)

Bu mod, projenin asıl **B2B SaaS Mimarisi** gücünü test eder. Müşteriler kendi sistemlerine platformu gömmek için **API Gateway**, **Webhook** ve **Embeddable Widget (ProctorSDK)** kullanırlar.

### Adım 1: B2B Backend Servislerini Başlatın
B2B mimarisinde API Gateway (Port 3000) öne geçer ve tüm trafiği yönetir. Sistemi başlatmak için ana dizindeki **`DEMO_BASLAT.bat`** dosyasını çift tıklayarak çalıştırın veya terminalden çalıştırın:
```bash
DEMO_BASLAT.bat
```
*(Bu bat dosyası, `docker-compose.b2b.yml` dosyasını çalıştıracak ve API Gateway'i aktif edecektir. Ayrıca yerel testler için port yönlendirmelerini yapacaktır.)*

### Adım 2: B2B Yönetim Panelini Açın
B2B müşterilerin (örneğin bir üniversitenin veya LMS şirketinin) API key aldığı, webhook adresini tanımladığı ve raporları izlediği paneli açmak için ana dizindeki **`PANEL_AC.bat`** dosyasını çalıştırın.
- Bu panel **`panel/index.html`** dosyasını açar.
- Buradan bir API Key oluşturabilir (`pk_live_demo12345678901` varsayılan olarak seed edilmiştir) ve Webhook URL'inizi girebilirsiniz.

### Adım 3: B2B Embeddable Widget (SDK) Test Edin
Platformun bir iframe veya `<script>` olarak gömülmesini test etmek için hazır olan B2B demo sayfasını açın:
1. Tarayıcıda **`sdk/index.html`** dosyasını açın.
2. Formda şu varsayılan B2B test verilerini kullanın:
   - **Gateway URL:** `http://localhost:3000` *(API Gateway adresimiz)*
   - **API Key:** `pk_live_demo12345678901` *(Demo kurumunun API Anahtarı)*
   - **Exam ID:** `B2B-TEST-EXAM`
   - **Student ID:** `STUDENT-999`
3. **🚀 Widget'ı Başlat** butonuna basın.
4. Sayfanın içinde dinamik olarak **Proctoring Widget**'ı yüklenecektir. Widget:
   - API Gateway'e API Key ile istek atıp oturum doğrulaması yapar.
   - API Gateway üzerinden **WebSocket (Socket.io)** bağlantısı (`/socket.io`) kurar.
   - Kameradan aldığı kareleri gerçek zamanlı olarak analiz için Gateway'e gönderir.
   - Risk skoru ve ihlalleri anlık gösterir.
5. **Sınavı Bitir** butonuna bastığınızda sınav tamamlanır. API Gateway, bu tamamlanma olayını yakalayarak B2B Panelinde tanımladığınız **Webhook URL**'ine imzalı (HMAC-SHA256) bir veri gönderir!

---


