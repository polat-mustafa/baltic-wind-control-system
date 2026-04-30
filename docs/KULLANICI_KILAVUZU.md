# Kullanıcı Kılavuzu — Baltic Wind HV Control Platform

> **510 MW Baltık Denizi açık deniz rüzgâr çiftliği simülasyon platformu.**
> 34 × Vestas V236-15.0 MW | 66 kV dizi kablosu | 220 kV ihraç kablosu (45 km) | 400 kV PSE şebekesi

Bu kılavuz, projeyi **sıfırdan** kurup çalıştırmak için gereken **her şeyi** kapsar.
Hiçbir ön bilgi varsayılmaz — her araç, her komut, her parametre tek tek açıklanır.
Kılavuzu baştan sona okuduğunuzda projeyi kendi bilgisayarınızda çalıştırabilecek, geliştirme
yapabilecek ve testleri koşabilecek seviyeye geleceksiniz.

---

## İçindekiler

1. [Bu Proje Nedir?](#1-bu-proje-nedir)
2. [Araçlar — Her Birini Neden Kullanıyoruz?](#2-araclar)
3. [Docker ile Kurulum ve Çalıştırma (Önerilen)](#3-docker-ile-kurulum-ve-calistirma)
4. [Manuel Kurulum — PostgreSQL & Redis](#4-manuel-kurulum-postgresql-redis)
5. [Manuel Kurulum — Backend](#5-manuel-kurulum-backend)
6. [Manuel Kurulum — Frontend](#6-manuel-kurulum-frontend)
7. [Veritabanı Yönetimi](#7-veritabani-yonetimi)
8. [Günlük Geliştirme İş Akışı](#8-gunluk-gelistirme-is-akisi)
9. [Makefile Komutları](#9-makefile-komutlari)
10. [Linting ve Pre-commit](#10-linting-ve-pre-commit)
11. [Test Çalıştırma](#11-test-calistirma)
12. [CI/CD — GitHub Actions](#12-cicd-github-actions)
13. [Dokümantasyon Sitesi (MkDocs)](#13-dokumantasyon-sitesi)
14. [Sık Karşılaşılan Sorunlar (Troubleshooting)](#14-sik-karsilasilan-sorunlar)
15. [Proje Mimarisi — Genel Bakış](#15-proje-mimarisi)
16. [Port ve Servis Referans Tablosu](#16-port-ve-servis-referans-tablosu)
17. [Hızlı Referans Kartı](#17-hizli-referans-karti)

---

## 1. Bu Proje Nedir?

### 1.1. Amaç

Bu proje, **510 MW kapasiteli bir açık deniz rüzgâr çiftliğinin** simülasyonunu yapan bir
eğitim platformudur. Gerçek endüstriyel standartlara (IEC, ENTSO-E, PSE IRiESP) dayanan bu
platform, rüzgâr enerjisi mühendisliğinin tüm katmanlarını — fizikten koda — öğretmek için
tasarlanmıştır.

**Rüzgâr Çiftliği Teknik Özellikleri:**

| Parametre | Değer |
|-----------|-------|
| Türbin modeli | Vestas V236-15.0 MW |
| Türbin sayısı | 34 adet |
| Toplam kapasite | 510 MW |
| Dizi kablo gerilimi | 66 kV |
| İhraç kablo gerilimi | 220 kV |
| İhraç kablo uzunluğu | 45 km |
| Şebeke bağlantısı | 400 kV (PSE — Polonya İletim Operatörü) |
| Konum | Polonya Baltık Denizi |
| Rüzgâr hızları | Devreye girme: 3 m/s · Nominal: 11.1 m/s · Devre dışı: 31 m/s |
| STATCOM | ±120 MVAR + 50 MVAR şönt reaktör |

### 1.2. Beş Proje Modülü

Platform beş bağımsız ama birbirine bağlı modülden oluşur:

| # | Modül | Ne Yapar | Ana Teknolojiler |
|---|-------|----------|------------------|
| **P1** | Rüzgâr Kaynağı & AEP | Rüzgâr hızı analizi, enerji üretim tahmini, kapasite faktörü, LCOE hesabı | PyWake, ERA5, Weibull |
| **P2** | HV Şebeke Entegrasyonu | Yüksek gerilim şebeke modeli, kısa devre hesabı, FRT analizi, STATCOM boyutlandırma | Pandapower, ANDES, IEC 60909 |
| **P3** | SCADA & Otomasyon | Uzaktan izleme/kontrol sistemi, alarm yönetimi, çalışma izni durumu makinesi | IEC 61850, GOOSE |
| **P4** | AI Tahminleme | Makine öğrenimi ile rüzgâr gücü tahmini, model karşılaştırma, açıklanabilirlik | XGBoost, LSTM, TFT, SHAP |
| **P5** | Devreye Alma | 30 adımlık anahtarlama programı, LOTO güvenlik prosedürü, SAT testleri | Commissioning workflow |

### 1.3. Bu Kılavuzun Kapsamı

Bu kılavuz **geliştirici odaklıdır** — projeyi bilgisayarınızda nasıl kuracağınızı, çalıştıracağınızı
ve geliştireceğinizi anlatır. Modüllerin teknik içeriği (fizik, standartlar, formüller) için
`docs/` klasöründeki ders notlarına ve `docs/SKILL.md` dosyasına bakın.

---

## 2. Araçlar

Bu bölüm, projede kullanılan her aracı açıklar: **ne olduğu**, **projede neden gerektiği**,
**nereden indirileceği** ve **adım adım nasıl kurulacağı**.

> **Hangi araçları kurmalıyım?**
> - **Sadece Docker ile çalışacaksanız:** Git + Docker Desktop yeterlidir.
> - **Manuel geliştirme yapacaksanız** (IDE'de debug, test çalıştırma, kod yazma): Git + Docker Desktop + Python 3.13 + Node.js 22 kurun.

---

### 2.1. Git — Versiyon Kontrol Sistemi

**Ne olduğu:** Git, dosyalarınızdaki her değişikliği kayıt altına alan bir versiyon kontrol
sistemidir. Bir dosyayı değiştirip "commit" yaptığınızda, o anın fotoğrafı saklanır.
İstediğiniz zaman geçmişteki herhangi bir noktaya dönebilirsiniz.

**Projede neden gerekli:** Projenin kaynak kodu GitHub'da barınır. Kodu bilgisayarınıza
indirmek (`git clone`), değişiklik yapmak (`git commit`), ve ekiple paylaşmak (`git push`)
için Git şarttır.

**Kurulum:**

1. [https://git-scm.com/downloads](https://git-scm.com/downloads) adresine gidin
2. İşletim sisteminize uygun sürümü indirin
3. **Windows kullanıcıları:** Kurulum sihirbazında şu ayarları seçin:
   - "Git Bash Here" → işaretli bırakın (sağ tık menüsünden terminal açar)
   - "Use Git from Git Bash only" veya "Use Git from the Windows Command Prompt" → ikisi de olur
   - "Checkout Windows-style, commit Unix-style line endings" → önerilen varsayılan
   - Diğer ayarları varsayılan bırakabilirsiniz
4. Kurulum tamamlandıktan sonra **yeni bir terminal** açın

**Doğrulama:**

```bash
git --version
# Beklenen çıktı: git version 2.40+ (veya daha yeni)
```

**İlk yapılandırma** (sadece bir kez):

```bash
git config --global user.name "Adınız Soyadınız"
git config --global user.email "email@adresiniz.com"
```

Bu bilgiler commit'lerinizde yazar olarak görünür. GitHub hesabınızdaki e-posta adresini
kullanmanız önerilir.

---

### 2.2. Docker Desktop — Konteyner Platformu

**Ne olduğu:** Docker, uygulamaları "konteyner" adı verilen izole paketler içinde çalıştıran
bir platformdur. Her konteyner kendi işletim sistemi katmanı, kütüphaneleri ve ayarlarıyla
gelir. Bu sayede "benim bilgisayarımda çalışıyor ama seninkinide çalışmıyor" sorunu ortadan
kalkar.

**Projede neden gerekli:** Projemizde 4 farklı servis var — PostgreSQL veritabanı, Redis
önbellek, Python backend ve React frontend. Docker ile tek bir komutla (`docker compose up`)
hepsini aynı anda, doğru sırada, doğru ayarlarla başlatabilirsiniz. Her geliştiricinin
makinesi aynı ortamı çalıştırır.

**Ön koşul — WSL2 (Sadece Windows):**

Docker Desktop, Windows'ta çalışmak için WSL2 (Windows Subsystem for Linux 2) gerektirir.
Bu, Windows üzerinde hafif bir Linux çekirdeği çalıştıran bir Microsoft teknolojisidir.

1. **PowerShell'i yönetici olarak açın** (Başlat menüsü → "PowerShell" yazın → sağ tık → "Yönetici olarak çalıştır")
2. Şu komutu çalıştırın:
   ```powershell
   wsl --install
   ```
3. Bilgisayarı **yeniden başlatın**
4. Yeniden başladıktan sonra doğrulayın:
   ```powershell
   wsl --version
   # WSL sürüm bilgisi görünmelidir
   ```

**Docker Desktop Kurulumu:**

1. [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/) adresine gidin
2. İşletim sisteminize uygun sürümü indirin (Windows / macOS / Linux)
3. **Windows:** İndirilen `.exe` dosyasını çalıştırın
   - "Use WSL 2 instead of Hyper-V" seçeneğini **işaretli bırakın**
   - Kurulum tamamlanınca bilgisayarı yeniden başlatmanız gerekebilir
4. Docker Desktop uygulamasını açın — sistem çubuğunda balina ikonu görünecektir
5. İlk açılışta Docker Engine'in başlaması birkaç dakika sürebilir

**Doğrulama:**

```bash
docker --version
# Beklenen: Docker version 24+ (veya daha yeni)

docker compose version
# Beklenen: Docker Compose version v2+ (veya daha yeni)

# Docker Engine çalışıyor mu?
docker run hello-world
# "Hello from Docker!" mesajı görünmelidir
```

**Kaynak Ayarları (önemli):**

Docker Desktop → Settings (⚙️) → Resources bölümünden şu ayarları yapın:

| Kaynak | Önerilen Minimum | Açıklama |
|--------|-----------------|----------|
| **Memory** | 4 GB | PostgreSQL + Backend + Frontend + Redis için yeterli |
| **CPUs** | 2 | Build sürecini hızlandırır |
| **Disk** | 20 GB | Docker imajları ve volume'lar için |

> **İpucu:** 8 GB RAM'li bir bilgisayarda Docker'a 4 GB vermek sistemi yavaşlatabilir.
> Bu durumda 3 GB verin veya hibrit kurulumu (Bölüm 4a) tercih edin.

---

### 2.3. Python 3.13 — Backend Programlama Dili

**Ne olduğu:** Python, okunması kolay ve geniş kütüphane ekosistemine sahip bir programlama
dilidir. Bilimsel hesaplama, veri analizi ve web geliştirme alanlarında yaygın kullanılır.

**Projede neden gerekli:** Backend sunucumuz Python ile yazılmıştır (FastAPI framework).
Ayrıca mühendislik hesaplamaları (PyWake, Pandapower, XGBoost) Python kütüphaneleridir.
Neden 3.13? Projemiz `requires-python = ">=3.13"` olarak yapılandırılmıştır — en güncel
dil özelliklerini (type hinting, performance iyileştirmeleri) kullanıyoruz.

> **Not:** Sadece Docker ile çalışacaksanız Python kurmanıza **gerek yoktur** — Docker
> konteyneri Python 3.13 imajını otomatik indirir.

**Kurulum:**

1. [https://www.python.org/downloads/](https://www.python.org/downloads/) adresine gidin
2. **Python 3.13.x** sürümünü indirin (3.12 veya altı **çalışmaz**)
3. **Windows kurulumunda kritik adım:**
   - Kurulum ekranının **en altında** "Add python.exe to PATH" seçeneği var → **mutlaka işaretleyin**
   - Bu işareti koymazsanız terminal Python'u bulamaz ve her seferinde tam yolu yazmanız gerekir
   - "Install Now" tıklayın
4. Kurulum bitince **terminali kapatıp yeniden açın** (PATH güncellemesinin etkili olması için)

**Doğrulama:**

```bash
python --version
# Beklenen: Python 3.13.x

pip --version
# Beklenen: pip 24+ (from ... python 3.13)
```

> **Windows sorunu:** `python` komutu Microsoft Store'u açıyorsa, bunun yerine `python3`
> veya `py -3.13` deneyin. Ya da Windows ayarlarından "App execution aliases" bölümünde
> "App Installer — python.exe" ve "python3.exe" öğelerini kapatın.

**pip nedir?** pip, Python'un paket yöneticisidir (Node.js'teki npm gibi). `pip install paket`
komutuyla kütüphane kurarsınız. Projemizde pip yerine doğrudan `pip install -e ".[dev]"`
komutu kullanılır — bu, `pyproject.toml` dosyasındaki tüm bağımlılıkları otomatik kurar.

---

### 2.4. Node.js 22 — Frontend Araç Zinciri

**Ne olduğu:** Node.js, JavaScript'i tarayıcı dışında çalıştıran bir platformdur. Frontend
geliştirme araçları (Vite, TypeScript derleyici, ESLint) Node.js üzerinde çalışır.

**Projede neden gerekli:** Frontend uygulamamız React 19 + TypeScript ile yazılmıştır.
Geliştirme sunucusu (Vite), paket yönetimi (npm), test çerçevesi (Vitest) ve build süreci
hep Node.js'e ihtiyaç duyar.

> **Not:** Sadece Docker ile çalışacaksanız Node.js kurmanıza **gerek yoktur** — Docker
> konteyneri Node.js 22 imajını otomatik indirir.

**Kurulum:**

1. [https://nodejs.org/](https://nodejs.org/) adresine gidin
2. **LTS (Long Term Support)** sürümünü indirin — Node.js 22.x
3. Kurulum sihirbazını varsayılan ayarlarla tamamlayın
4. **Terminali kapatıp yeniden açın**

**Doğrulama:**

```bash
node --version
# Beklenen: v22.x.x

npm --version
# Beklenen: 10+ (Node.js 22 ile birlikte gelir)
```

**npm nedir?** npm (Node Package Manager), JavaScript paket yöneticisidir. Frontend
bağımlılıklarımızı (React, Plotly, Tailwind vb.) `package.json` dosyasından okur ve
`node_modules/` klasörüne indirir. `npm ci` komutu, `package-lock.json` dosyasındaki
kesin sürümleri kurarak her geliştiricide aynı sonucu garanti eder.

---

### 2.5. PostgreSQL + TimescaleDB — Veritabanı

**Ne olduğu:** PostgreSQL, dünyanın en gelişmiş açık kaynak ilişkisel veritabanıdır.
TimescaleDB, PostgreSQL'e zaman serisi verisi desteği ekleyen bir uzantıdır.

**Projede neden gerekli:** Rüzgâr çiftliği verileri (türbin ölçümleri, SCADA kayıtları,
tahmin sonuçları) zaman damgalı verilerdir. TimescaleDB, bu tür verileri standart
PostgreSQL'den çok daha hızlı sorgulamayı sağlar. Tüm modüllerin verileri (P1-P5)
bu veritabanında saklanır.

**Docker kullanıyorsanız:** Ayrıca kurulum gerekmez! `docker compose up` komutu
`timescale/timescaledb:latest-pg16` imajını otomatik indirir ve `balticwind`
veritabanını oluşturur. TimescaleDB uzantısı da imajın içindedir.

**Manuel kurulum** için Bölüm 4'e bakın.

---

### 2.6. Redis — Önbellek (Cache) Sistemi

**Ne olduğu:** Redis, verileri RAM'de (bellekte) saklayan ultra hızlı bir anahtar-değer
deposudur. Disk tabanlı bir veritabanı değildir — veriler bellekte tutulduğu için
mikrosaniye seviyesinde erişim sağlar.

**Projede neden gerekli:** Sık erişilen veriler (dashboard KPI'ları, son hesaplama
sonuçları) PostgreSQL'den her seferinde sorgulanmak yerine Redis'te önbelleğe alınır.
Bu, API yanıt sürelerini önemli ölçüde düşürür.

**Docker kullanıyorsanız:** Ayrıca kurulum gerekmez! `docker compose up` komutu
`redis:7-alpine` imajını otomatik indirir.

**Manuel kurulum** için Bölüm 4'e bakın.

---

### 2.7. pgAdmin (Opsiyonel) — Veritabanı Görselleştirme

**Ne olduğu:** pgAdmin, PostgreSQL veritabanlarını grafiksel arayüzle yönetmenizi sağlayan
bir web uygulamasıdır. Tabloları görmek, SQL sorguları yazmak, verileri incelemek için
kullanılır.

**İndirme:** [https://www.pgadmin.org/download/](https://www.pgadmin.org/download/)

Kurmanız **zorunlu değildir** — terminal üzerinden `psql` komutuyla da aynı işlemleri
yapabilirsiniz. Ancak görsel arayüz, veritabanı yapısını anlamayı kolaylaştırır.

---

### 2.8. VS Code (Opsiyonel) — Önerilen IDE

**Ne olduğu:** Visual Studio Code, Microsoft'un ücretsiz, açık kaynak kod editörüdür.
Uzantı ekosistemi sayesinde Python, TypeScript ve Docker geliştirme için mükemmeldir.

**İndirme:** [https://code.visualstudio.com/](https://code.visualstudio.com/)

**Önerilen uzantılar:**

| Uzantı | Ne İşe Yarar |
|--------|-------------|
| **Python** (ms-python.python) | Python dil desteği, IntelliSense, debug |
| **Pylance** (ms-python.vscode-pylance) | Gelişmiş Python tip kontrolü |
| **Ruff** (charliermarsh.ruff) | Python lint + format (kaydettiğinizde otomatik) |
| **ESLint** (dbaeumer.vscode-eslint) | TypeScript/JavaScript lint |
| **Tailwind CSS IntelliSense** (bradlc.vscode-tailwindcss) | Tailwind sınıf önerileri |
| **Docker** (ms-azuretools.vscode-docker) | Docker dosyaları ve container yönetimi |
| **GitLens** (eamodio.gitlens) | Git geçmişi ve blame bilgileri |

---

### 2.9. Sürüm Doğrulama Özet Tablosu

Tüm araçları kurduktan sonra bu komutları çalıştırarak doğrulayın:

```bash
git --version          # git version 2.40+
docker --version       # Docker version 24+
docker compose version # Docker Compose version v2+
python --version       # Python 3.13+
node --version         # v22+
npm --version          # 10+
```

---

## 3. Docker ile Kurulum ve Çalıştırma

Bu yöntem **önerilen yöntemdir**. Tek komutla 4 servisi birden başlatır,
ortam farklılıklarından kaynaklanan sorunları ortadan kaldırır.

### 3.1. Ön Hazırlık

**1. Docker Desktop'un açık olduğundan emin olun:**

Sistem çubuğunda (Windows: sağ alt köşe, macOS: üst menü çubuğu) Docker balina ikonunun
görünür ve yeşil olduğunu kontrol edin. "Docker Desktop is running" yazmalıdır.
Çalışmıyorsa Docker Desktop uygulamasını açın ve Engine'in başlamasını bekleyin.

**2. Projeyi indirin:**

```bash
git clone https://github.com/polat-mustafa/baltic-wind-control-system.git
cd baltic-wind-control-system
```

> `git clone` ne yapar? GitHub'daki projenin tüm dosyalarını ve tüm geçmişini (commit
> tarihçesi) bilgisayarınıza kopyalar. Bu işlem bir kez yapılır — sonraki güncellemeler
> için `git pull` yeterlidir.

**3. Ortam değişkenlerini (.env) hazırlayın:**

Projede iki `.env.example` şablon dosyası var. Bunları kopyalayarak `.env` dosyaları
oluşturun:

```bash
# Backend ortam değişkenleri
cp backend/.env.example backend/.env

# Frontend ortam değişkenleri
cp frontend/.env.example frontend/.env
```

> **`.env` dosyası nedir?** Ortam değişkenleri (environment variables), uygulama
> ayarlarını kod dışında tutmak için kullanılır. Veritabanı şifresi, API adresi gibi
> bilgiler burada saklanır. `.env` dosyası Git'e **eklenmez** (`.gitignore`'da listelidir)
> — bu sayede hassas bilgiler depoya sızmaz.

**Backend `.env` varsayılan değerleri:**

```env
# Uygulama adı (loglarda ve API yanıtlarında görünür)
APP_NAME=Baltic Wind HV Control Platform

# Debug modu (true: detaylı hata mesajları, false: üretim güvenliği)
DEBUG=false

# PostgreSQL bağlantı adresi
# Format: postgresql+asyncpg://KULLANICI:SIFRE@SUNUCU:PORT/VERITABANI
# localhost → manuel çalıştırma için, postgres → Docker içi için
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/balticwind

# Redis bağlantı adresi
# localhost → manuel çalıştırma için, redis → Docker içi için
REDIS_URL=redis://localhost:6379/0

# CORS izinli kaynaklar (hangi adreslerden gelen isteklere izin verilsin)
# 3000 = Docker/nginx frontend, 5173 = Vite dev server
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

**Frontend `.env` varsayılan değerleri:**

```env
# Backend API'nin adresi (Vite dev sunucusu bu adresi kullanır)
VITE_API_BASE_URL=http://localhost:8000
```

> **Not:** Docker ile çalıştırırken bu `.env` dosyalarını değiştirmenize genellikle gerek
> yoktur. `docker-compose.yml` kendi ortam değişkenlerini tanımlar ve Docker içi servis
> adlarını (postgres, redis, backend) kullanır.

### 3.2. Servisleri Başlatma

```bash
docker compose up -d --build
```

**Bu komutun her parçası ne anlama gelir?**

| Parça | Açıklama |
|-------|----------|
| `docker compose` | Docker Compose aracını çalıştırır (çoklu konteyner yönetimi) |
| `up` | `docker-compose.yml` dosyasındaki servisleri oluştur ve başlat |
| `-d` | **Detached** (arka plan) modu — terminal meşgul edilmez, komut istemcisi geri döner |
| `--build` | Başlatmadan önce imajları yeniden **oluştur** (build et) |

Bu komut 4 servis başlatır:

| Servis | Docker İmajı | Port | Açıklama |
|--------|-------------|------|----------|
| **postgres** | `timescale/timescaledb:latest-pg16` | `5432` | PostgreSQL 16 + TimescaleDB uzantısı |
| **redis** | `redis:7-alpine` | `6379` | Redis 7 — önbellek katmanı |
| **backend** | `./backend` (yerel build) | `8000` | FastAPI uygulama sunucusu |
| **frontend** | `./frontend` (yerel build) | `3000` | nginx üzerinde React uygulaması |

### 3.3. Başlatma Sırası ve Health Check

Servisler **rastgele değil, belirli bir sırada** başlar. `docker-compose.yml` dosyasındaki
`depends_on` ve `condition: service_healthy` ayarları bu sırayı zorunlu kılar:

```
1. postgres başlar → health check: pg_isready -U postgres (5 sn aralıkla)
      ↓ (healthy olunca)
2. redis başlar → health check: redis-cli ping (5 sn aralıkla)
      ↓ (healthy olunca)
3. backend başlar → alembic upgrade head (migration) → uvicorn başlar
   → health check: curl http://localhost:8000/health (10 sn aralıkla, 30 sn bekleme)
      ↓ (healthy olunca)
4. frontend başlar → nginx statik dosyaları sunar
   → health check: wget http://localhost:3000/ (10 sn aralıkla)
```

**Health check (sağlık kontrolü) nedir?** Docker, her servise düzenli aralıklarla "hayatta
mısın?" sorusu sorar. Servis doğru yanıt verene kadar "unhealthy" olarak işaretlenir.
Bir sonraki servis, bağımlı olduğu servisin "healthy" olmasını bekler. Bu sayede
"backend başladı ama veritabanı henüz hazır değil" gibi hatalar önlenir.

### 3.4. Durumu Kontrol Etme

```bash
docker compose ps
```

Örnek çıktı:

```
NAME                  SERVICE     STATUS                  PORTS
bwcs-postgres-1       postgres    running (healthy)       0.0.0.0:5432->5432/tcp
bwcs-redis-1          redis       running (healthy)       0.0.0.0:6379->6379/tcp
bwcs-backend-1        backend     running (healthy)       0.0.0.0:8000->8000/tcp
bwcs-frontend-1       frontend    running (healthy)       0.0.0.0:3000->3000/tcp
```

**STATUS sütununu okuma:**

| Durum | Anlamı |
|-------|--------|
| `running (healthy)` | Servis çalışıyor ve sağlık kontrolünü geçiyor — her şey yolunda |
| `running (starting)` | Servis çalışıyor ama henüz sağlık kontrolü geçmedi — bekleyin |
| `running (unhealthy)` | Servis çalışıyor ama sağlık kontrolü başarısız — logları kontrol edin |
| `restarting` | Servis sürekli çöküyor ve yeniden başlatılıyor — logları kontrol edin |
| `exited (0)` | Servis normal kapandı |
| `exited (1)` | Servis hata ile kapandı — logları kontrol edin |

### 3.5. Log Okuma

```bash
# Tüm servislerin loglarını canlı takip et
docker compose logs -f

# Sadece belirli bir servisin logları
docker compose logs -f backend
docker compose logs -f postgres

# Son 50 satır log
docker compose logs --tail=50 backend
```

**`-f` bayrağı (follow):** Yeni loglar geldikçe ekrana yazdırır. `Ctrl+C` ile çıkabilirsiniz.

**Backend loglarında tipik satırlar:**

```
backend-1  | Running database migrations...        ← Alembic migration'ları çalışıyor
backend-1  | INFO  [alembic.runtime.migration] Running upgrade -> 1acc76f82174  ← Migration uygulanıyor
backend-1  | Starting application server...        ← uvicorn başlıyor
backend-1  | INFO:     Uvicorn running on http://0.0.0.0:8000  ← Sunucu hazır!
backend-1  | INFO:     Application startup complete.
```

### 3.6. Tarayıcıda Erişim

Tüm servisler `healthy` olduktan sonra:

| Sayfa | Adres | Açıklama |
|-------|-------|----------|
| **Frontend (Ana Sayfa)** | [http://localhost:3000](http://localhost:3000) | Rüzgâr çiftliği haritası ve dashboard'lar |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | API kök endpoint'i |
| **Swagger UI** | [http://localhost:8000/docs](http://localhost:8000/docs) | İnteraktif API dokümantasyonu (dene-gör) |
| **ReDoc** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | API referans dokümantasyonu (salt okunur) |
| **Sağlık Kontrolü** | [http://localhost:8000/health](http://localhost:8000/health) | Tüm servislerin durumunu JSON olarak döner |

### 3.7. Servisleri Durdurma

```bash
# Servisleri durdur (veritabanı verileri KORUNUR)
docker compose down
```

Bu komut tüm konteynerleri durdurur ama **volume'ları** (kalıcı veri alanları) silmez.
PostgreSQL veritabanındaki tüm tablolar ve veriler bir sonraki `docker compose up`'ta
yerinde olacaktır.

```bash
# Servisleri durdur VE veritabanı dahil tüm verileri SİL
docker compose down -v
```

> **DİKKAT:** `-v` bayrağı volume'ları siler. Bu, veritabanındaki **tüm verilerin
> kaybolması** demektir. Veritabanını sıfırlamak istiyorsanız kullanın; yoksa dikkatli olun.

```bash
# Servisleri yeniden başlat (durdur + başlat)
docker compose restart

# Sadece bir servisi yeniden başlat
docker compose restart backend
```

### 3.8. Ne Zaman Rebuild Gerekir?

| Değişiklik | Komut | Açıklama |
|-----------|-------|----------|
| Python kodu değişti (`app/` altında) | `docker compose up -d --build backend` | Backend imajı yeniden build edilir |
| `pyproject.toml` güncellendi (yeni Python paketi) | `docker compose up -d --build backend` | Yeni paketler kurulur |
| Frontend kodu değişti (`src/` altında) | `docker compose up -d --build frontend` | Frontend yeniden build edilir |
| `package.json` güncellendi (yeni npm paketi) | `docker compose up -d --build frontend` | Yeni paketler kurulur |
| `docker-compose.yml` değişti | `docker compose up -d --build` | Tüm servisler yeniden yapılandırılır |
| Sadece `.env` değişti | `docker compose up -d` | `--build` gerekmez, mevcut imajlar kullanılır |

### 3.9. Docker Layer Cache — İlk ve Sonraki Çalıştırmalar

**İlk çalıştırmada ne olur?**
- Docker, gerekli imajları internetten indirir (~2-3 GB)
- Python ve Node.js bağımlılıkları imaj içinde kurulur
- Bu süreç internet hızınıza bağlı olarak **5-15 dakika** sürebilir

**Sonraki çalıştırmalar neden hızlı?**
Docker "katman önbelleği" (layer caching) kullanır. Dockerfile'daki her satır bir
katmandır. Bir katman değişmediyse, Docker onu yeniden çalıştırmaz — önbellekten
kullanır. Örneğin:

```dockerfile
# Katman 1: Python imajı (değişmez → önbellekten gelir)
FROM python:3.13-slim

# Katman 2: pyproject.toml kopyala (dosya değişmediyse → önbellekten)
COPY pyproject.toml .

# Katman 3: Paketleri kur (pyproject.toml değişmediyse → önbellekten)
RUN pip install --no-cache-dir .

# Katman 4: Uygulama kodunu kopyala (kod değiştiyse → yeniden çalışır)
COPY app/ app/
```

Bu yüzden sadece Python kodunu değiştirip rebuild ettiğinizde, paket kurulumu atlanır
ve build **birkaç saniyede** tamamlanır.

### 3.10. Docker Desktop GUI'den Yönetim

Docker Desktop uygulamasının **Containers** sekmesinde:

1. **Servis listesi:** Her servisin adı, durumu, port'u ve kaynak kullanımı görünür
2. **Başlat/Durdur:** Her servisin yanındaki ▶️/⏹️ düğmelerini kullanabilirsiniz
3. **Loglar:** Bir servise tıklayarak loglarını görebilirsiniz
4. **Terminal:** "Terminal" sekmesinden konteyner içinde komut çalıştırabilirsiniz
5. **Inspect:** Ortam değişkenleri, portlar, volume bağlantılarını inceleyebilirsiniz

> **İpucu:** GUI'yi kullanmak tamamen opsiyoneldir. Terminal komutları (`docker compose`)
> ile aynı işlemleri yaparsınız. Ancak başlangıçta görsel arayüz durumu anlamayı
> kolaylaştırabilir.

---

## 4. Manuel Kurulum — PostgreSQL & Redis

Docker ile çalışırken PostgreSQL ve Redis otomatik gelir. Ancak bazı durumlarda
(düşük RAM, Docker performans sorunları, öğrenme amaçlı) manuel kurulum tercih
edilebilir. İki yaklaşım vardır:

### 4a. Hibrit Yol (ÖNERİLEN)

**Fikir:** Sadece PostgreSQL ve Redis'i Docker'da çalıştırın; backend ve frontend'i
kendi makinenizde çalıştırın. Bu yöntem:
- Veritabanı kurulum karmaşıklığını ortadan kaldırır
- IDE'de debug yapabilirsiniz
- Docker'a verdiğiniz RAM'i azaltır (backend/frontend konteynerleri yok)

```bash
# Sadece postgres ve redis başlat
docker compose up -d postgres redis

# Durumu kontrol et
docker compose ps
# postgres ve redis "healthy" olmalı
```

Artık backend'i Bölüm 5'te, frontend'i Bölüm 6'da anlatıldığı gibi manuel başlatın.

### 4b. Tamamen Docker'sız Yol

Hiç Docker kullanmak istemiyorsanız PostgreSQL ve Redis'i elle kurmanız gerekir.

#### PostgreSQL 16 Kurulumu (Windows)

1. [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/) adresinden **EDB Installer**'ı indirin
2. Kurulum sihirbazında:
   - PostgreSQL sürümü: **16.x** seçin
   - Kurulum yolu: varsayılan bırakın
   - Veri dizini: varsayılan bırakın
   - Superuser şifresi: `postgres` girin (geliştirme ortamı için)
   - Port: `5432` (varsayılan)
   - Locale: varsayılan bırakın
   - **Stack Builder** ekranında "Cancel" tıklayın (gerekmez)
3. PATH'e ekleme: Kurulum sırasında otomatik eklenmezse, `C:\Program Files\PostgreSQL\16\bin` dizinini sistem PATH'ine ekleyin

**TimescaleDB uzantısı ekleme:**

TimescaleDB, PostgreSQL'e ayrı kurulur:

1. [https://docs.timescale.com/install/latest/self-hosted/](https://docs.timescale.com/install/latest/self-hosted/) adresinden indirin
2. Kurulum sırasında PostgreSQL 16 kurulumunuzu seçin
3. `postgresql.conf` dosyasına otomatik eklenen satırı doğrulayın:
   ```
   shared_preload_libraries = 'timescaledb'
   ```
4. PostgreSQL servisini yeniden başlatın

**Veritabanı oluşturma:**

```bash
# PostgreSQL'e bağlan
psql -U postgres

# Veritabanını oluştur
CREATE DATABASE balticwind;

# TimescaleDB uzantısını etkinleştir
\c balticwind
CREATE EXTENSION IF NOT EXISTS timescaledb;

# Doğrula
SELECT extname, extversion FROM pg_extension WHERE extname = 'timescaledb';
# Satır görünmelidir

\q
```

#### Redis Kurulumu (Windows)

Redis, resmi olarak Windows'u desteklemez. İki alternatif:

**Yöntem 1 — Memurai (Windows native):**
1. [https://www.memurai.com/](https://www.memurai.com/) adresinden indirin (ücretsiz geliştirici sürümü var)
2. Kurulum sonrası otomatik başlar, port `6379`
3. Doğrulama: `memurai-cli ping` → `PONG`

**Yöntem 2 — WSL2 üzerinden Redis:**
```bash
# WSL2 terminalinde (Ubuntu):
sudo apt update
sudo apt install redis-server
sudo service redis-server start
redis-cli ping
# PONG
```

**Bağlantı testi:**

```bash
# PostgreSQL
psql -U postgres -d balticwind -c "SELECT 1;"
# 1 dönmelidir

# Redis
redis-cli ping
# PONG dönmelidir
```

---

## 5. Manuel Kurulum — Backend

Docker yerine backend'i doğrudan makinenizde çalıştırmak istiyorsanız bu bölümü takip edin.

> **Ön koşul:** PostgreSQL ve Redis çalışıyor olmalıdır (Docker ile veya manuel).

### 5.1. Python Sanal Ortamı (venv) — Nedir ve Neden?

Python projelerinde her proje farklı paket sürümlerine ihtiyaç duyabilir. Örneğin Proje A
`numpy 1.26` isterken, Proje B `numpy 2.0` isteyebilir. Paketleri doğrudan sisteme
kurarsanız bu çakışmalar kaçınılmazdır.

**Sanal ortam** (virtual environment), her proje için izole bir Python kopya oluşturur.
Bir projenin paketleri diğerini etkilemez.

```
Sistem Python 3.13
├── Proje A sanal ortamı → numpy 1.26, pandas 2.0
├── Proje B sanal ortamı → numpy 2.0, scipy 1.14
└── Bu proje (.venv)     → fastapi, sqlalchemy, pywake, ...
```

### 5.2. Sanal Ortam Oluşturma ve Etkinleştirme

```bash
cd backend

# Sanal ortam oluştur (.venv adlı klasör oluşur)
python -m venv .venv
```

**Etkinleştirme** (terminal her açıldığında yapılmalıdır):

```bash
# Windows — Git Bash / MSYS2:
source .venv/Scripts/activate

# Windows — PowerShell:
.venv\Scripts\Activate.ps1

# Windows — CMD:
.venv\Scripts\activate.bat

# Linux / macOS:
source .venv/bin/activate
```

Etkinleştirme başarılıysa, komut istemcisinin başında `(.venv)` yazar:

```
(.venv) user@pc:~/baltic-wind-control-system/backend$
```

> **İpucu:** VS Code kullanıyorsanız, Python uzantısı `.venv` klasörünü otomatik algılar
> ve terminali açtığınızda sanal ortamı etkinleştirir.

### 5.3. Bağımlılıkları Kurma

```bash
cd backend
pip install -e ".[dev]"
```

**Bu komutun her parçası ne anlama gelir?**

| Parça | Açıklama |
|-------|----------|
| `pip install` | Python paket yöneticisi ile paket kur |
| `-e` | **Editable** (düzenlenebilir) mod — kodu değiştirdiğinizde tekrar kurmanıza gerek kalmaz |
| `.` | Mevcut dizindeki `pyproject.toml` dosyasını oku |
| `[dev]` | Geliştirme bağımlılıklarını da kur (pytest, ruff, mypy) |

Bu komut `pyproject.toml` dosyasındaki şu bağımlılıkları kurar:

- **Ana bağımlılıklar:** FastAPI, uvicorn, SQLAlchemy, Alembic, Redis, NumPy, SciPy, PyWake, Pandapower, ANDES, XGBoost, PyTorch, SHAP
- **Geliştirme bağımlılıkları** (`[dev]`): pytest, pytest-cov, pytest-asyncio, httpx, ruff, mypy

> **İlk kurulum 5-10 dakika sürebilir** — özellikle PyTorch ve bilimsel kütüphaneler büyük
> dosyalar indirir.

### 5.4. Ortam Değişkenlerini Hazırlama

```bash
cd backend
cp .env.example .env
```

Manuel çalıştırma için `.env` dosyası varsayılan haliyle çalışır. Değişken açıklamaları:

| Değişken | Varsayılan | Açıklama |
|----------|-----------|----------|
| `APP_NAME` | `Baltic Wind HV Control Platform` | Uygulama adı (loglarda görünür) |
| `DEBUG` | `false` | `true` yaparsanız hata detayları HTTP yanıtına eklenir |
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/balticwind` | PostgreSQL bağlantısı |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis bağlantısı |
| `CORS_ORIGINS` | `["http://localhost:3000","http://localhost:5173"]` | İzin verilen frontend adresleri |

> **`DATABASE_URL` formatı:**
> `postgresql+asyncpg://KULLANICI:SIFRE@SUNUCU:PORT/VERITABANI`
> - `postgresql+asyncpg` → SQLAlchemy'nin asenkron PostgreSQL sürücüsü
> - `postgres:postgres` → kullanıcı adı ve şifre
> - `localhost:5432` → sunucu adresi ve port
> - `balticwind` → veritabanı adı

### 5.5. Alembic Migration'ları

**Migration nedir?**
Veritabanı şeması (tablolar, sütunlar, ilişkiler) zamanla değişir. Migration sistemi,
bu değişiklikleri versiyonlanmış Python dosyaları olarak saklar. Her migration dosyası
bir `upgrade()` (uygula) ve `downgrade()` (geri al) fonksiyonu içerir.

**Neden gerekli?**
`CREATE TABLE` SQL komutlarını elle çalıştırmak yerine, Alembic bunu otomatik yapar.
Hangi migration'ların uygulandığını veritabanında izler (`alembic_version` tablosu).
Yeni bir geliştirici projeyi klonlayıp `alembic upgrade head` dediğinde, tüm tablolar
doğru şekilde oluşturulur.

**Mevcut migration dosyaları:**

| # | Migration | Ne Oluşturur |
|---|-----------|-------------|
| 1 | `1acc76f82174` | P1: wind_farm, turbine tabloları |
| 2 | `a2b3c4d5e6f7` | P2: grid_network, bus, line, transformer tabloları |
| 3 | `b3c4d5e6f7a8` | P2b: FRT, frekans kararlılık tabloları |
| 4 | `c4d5e6f7a8b9` | P3: IEC 61850 cihaz kayıt tabloları |
| 5 | `d5e6f7a8b9c0` | P3b: Permit-to-Work tabloları |
| 6 | `e6f7a8b9c0d1` | P4: Forecast result tablosu |
| 7 | `f7a8b9c0d1e2` | P5: Commissioning tabloları |

**Çalıştırma:**

```bash
cd backend

# Tüm migration'ları uygula (veritabanı tablolarını oluşturur)
alembic upgrade head

# Mevcut durumu kontrol et
alembic current
# Beklenen çıktı: f7a8b9c0d1e2 (head) — en son migration uygulanmış

# Son migration'u geri al
alembic downgrade -1

# Yeni migration oluştur (model değişikliklerinden otomatik)
alembic revision --autogenerate -m "değişiklik açıklaması"
```

> **Not:** Docker kullanıyorsanız migration'lar otomatik çalışır — `entrypoint.sh`
> dosyası her başlatmada `alembic upgrade head` komutunu çalıştırır.

### 5.6. Backend Sunucusunu Başlatma

```bash
cd backend

# Geliştirme modu (önerilen — otomatik yeniden yükleme)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Bu komutun her parçası:**

| Parça | Açıklama |
|-------|----------|
| `uvicorn` | ASGI sunucu — FastAPI uygulamalarını çalıştıran sunucu yazılımı |
| `app.main:app` | `app/main.py` dosyasındaki `app` nesnesini yükle |
| `--reload` | Kod değiştiğinde sunucuyu otomatik yeniden başlat (sadece geliştirmede) |
| `--host 0.0.0.0` | Tüm ağ arayüzlerinden erişime izin ver |
| `--port 8000` | 8000 numaralı portta dinle |

Sunucu başarıyla başladığında:

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using WatchFiles
INFO:     Application startup complete.
```

**Test:**

```bash
# Terminal'den test (yeni bir terminal penceresi açın)
curl http://localhost:8000/health
# JSON yanıt dönmelidir

# Veya tarayıcıda açın:
# http://localhost:8000/health
```

### 5.7. API Dokümantasyonuna Erişim

Sunucu çalışırken iki dokümantasyon arayüzü otomatik oluşturulur:

**Swagger UI** — [http://localhost:8000/docs](http://localhost:8000/docs)
- İnteraktif arayüz — endpoint'leri doğrudan tarayıcıdan test edebilirsiniz
- "Try it out" düğmesine tıklayıp parametre girin, "Execute" ile çalıştırın
- Yanıt gövdesini, HTTP kodunu ve başlıkları görebilirsiniz

**ReDoc** — [http://localhost:8000/redoc](http://localhost:8000/redoc)
- Salt okunur referans dokümantasyonu
- Daha temiz, yazdırılabilir format
- Şema detayları ve örnek yanıtlar

---

## 6. Manuel Kurulum — Frontend

### 6.1. Ortam Değişkenleri

```bash
cd frontend
cp .env.example .env
```

`.env` dosyası:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Bu değişken, Vite geliştirme sunucusunun API isteklerini nereye yönlendireceğini belirler.
Backend'iniz 8000 portunda çalışıyorsa varsayılan haliyle kullanın.

### 6.2. Bağımlılıkları Kurma

```bash
cd frontend
npm ci
```

**`npm ci` vs `npm install` — fark nedir?**

| Özellik | `npm ci` | `npm install` |
|---------|----------|---------------|
| Kaynak dosya | `package-lock.json` (kesin sürümler) | `package.json` (sürüm aralıkları) |
| `node_modules` | Siler ve sıfırdan kurar | Mevcut olanı günceller |
| Deterministik mi? | **Evet** — her makinede aynı sonuç | Hayır — sürüm aralıkları farklılığa yol açabilir |
| Hız | Daha hızlı (çözümleme yok) | Daha yavaş (bağımlılık çözümleme yapılır) |
| `package-lock.json` | Değiştirmez | Değiştirebilir |

**Her zaman `npm ci` kullanın** — bu, sizin makinenizde ve CI/CD'de aynı paket
sürümlerinin kurulmasını garanti eder.

### 6.3. Geliştirme Sunucusu (Vite)

```bash
cd frontend
npm run dev
```

Vite geliştirme sunucusu [http://localhost:5173](http://localhost:5173) adresinde başlar.

**Vite nedir?** Vite (Fransızca "hızlı"), modern bir frontend geliştirme aracıdır.
Webpack gibi eski araçların aksine, tarayıcıların doğal ES modül desteğini kullanarak
dosyaları anında sunar — dev sunucusu milisaniyede başlar.

**HMR (Hot Module Replacement) nedir?** Bir dosyayı kaydedip kaydettiğiniz anda,
tarayıcı **sayfayı yeniden yüklemeden** sadece değişen modülü günceller. Bu sayede
sayfa durumunu (form verileri, açık menüler vb.) kaybetmezsiniz.

### 6.4. Port Farkı: 5173 vs 3000

| Port | Ortam | Nasıl Çalışır |
|------|-------|---------------|
| `5173` | Vite dev sunucusu (manuel) | JavaScript dosyalarını anında derler ve sunar; HMR aktif |
| `3000` | nginx (Docker) | Önceden build edilmiş statik dosyaları sunar; `/api/*` isteklerini backend'e proxy eder |

**API proxy nasıl çalışır?**

- **Docker'da (port 3000):** nginx, `/api/*` isteklerini otomatik olarak backend konteynerine yönlendirir. Frontend kodu sadece `/api/health` yazar, nginx bunu `http://backend:8000/api/health` adresine iletir.
- **Vite dev'de (port 5173):** Frontend kodu `VITE_API_BASE_URL` ortam değişkenini kullanarak API adresini bilir (`http://localhost:8000`). İstekler doğrudan backend'e gider.

### 6.5. Üretim Build

```bash
cd frontend

# Üretim build oluştur
npm run build
```

**Bu komut ne yapar?**
1. TypeScript dosyalarını JavaScript'e derler (`tsc -b`)
2. Vite, tüm JavaScript/CSS dosyalarını birleştirir, küçültür (minify) ve `dist/` klasörüne yazar
3. Sonuç: tarayıcıya doğrudan sunulabilen optimize edilmiş statik dosyalar

```bash
# Build sonucunu önizle
npm run preview
```

`npm run preview`, `dist/` klasöründeki build sonucunu yerel bir sunucuda sunar.
Bu, deployment öncesi son kontrol için kullanılır.

---

## 7. Veritabanı Yönetimi

### 7.1. Veritabanı Bağlantı Bilgileri

| Parametre | Değer |
|-----------|-------|
| Sunucu | `localhost` (Docker dışı) veya `postgres` (Docker içi) |
| Port | `5432` |
| Veritabanı Adı | `balticwind` |
| Kullanıcı | `postgres` |
| Şifre | `postgres` |
| Bağlantı URL'si (manuel) | `postgresql+asyncpg://postgres:postgres@localhost:5432/balticwind` |
| Bağlantı URL'si (Docker) | `postgresql+asyncpg://postgres:postgres@postgres:5432/balticwind` |

### 7.2. Migration Sistemi (Detaylı)

Migration dosyaları `backend/alembic/versions/` klasöründedir. Her dosya bir veritabanı
şema değişikliğini temsil eder. Dosyalar zincir halinde birbirine bağlıdır:

```
1acc76f82174 (P1: wind_farm, turbine)
    ↓
a2b3c4d5e6f7 (P2: grid_network, bus, line, transformer)
    ↓
b3c4d5e6f7a8 (P2b: FRT, frequency stability)
    ↓
c4d5e6f7a8b9 (P3: IEC 61850 device registry)
    ↓
d5e6f7a8b9c0 (P3b: Permit-to-Work)
    ↓
e6f7a8b9c0d1 (P4: forecast_result)
    ↓
f7a8b9c0d1e2 (P5: commissioning) ← HEAD (en son)
```

**Temel komutlar:**

```bash
cd backend

# Tüm migration'ları uygula (sıfırdan tablolar oluşturulur)
alembic upgrade head

# Mevcut migration durumunu göster
alembic current

# Son migration'u geri al
alembic downgrade -1

# Tüm migration'ları geri al (DİKKAT: tüm tablolar silinir)
alembic downgrade base

# Migration geçmişini listele
alembic history

# Yeni migration oluştur (model değişikliklerini algılar)
alembic revision --autogenerate -m "değişiklik açıklaması"
```

### 7.3. pgAdmin ile Bağlantı

1. pgAdmin'i açın
2. Sol panelde **Servers** → sağ tık → **Register** → **Server...**
3. **General** sekmesi:
   - Name: `Baltic Wind`
4. **Connection** sekmesi:
   - Host name/address: `localhost`
   - Port: `5432`
   - Maintenance database: `balticwind`
   - Username: `postgres`
   - Password: `postgres`
   - "Save password?" → işaretleyin
5. **Save** tıklayın
6. Sol panelde `Baltic Wind` → `Databases` → `balticwind` → `Schemas` → `public` → `Tables`
   altında projenin tablolarını görebilirsiniz

### 7.4. psql ile Terminal Bağlantısı

```bash
# Docker içindeki PostgreSQL'e bağlan
docker compose exec postgres psql -U postgres -d balticwind

# Veya PostgreSQL yerel kuruluysa:
psql -U postgres -d balticwind
```

**Kullanışlı psql komutları:**

```sql
-- Tüm tabloları listele
\dt

-- Bir tablonun yapısını göster
\d wind_farm

-- Tablo satır sayıları
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- TimescaleDB uzantısını kontrol et
SELECT extname, extversion FROM pg_extension WHERE extname = 'timescaledb';

-- Çıkış
\q
```

### 7.5. Veritabanını Sıfırlama

Veritabanını tamamen temiz bir duruma getirmek için:

```bash
# Docker kullanıyorsanız (en kolay yol):
docker compose down -v        # Volume'ları sil (veriler gider)
docker compose up -d --build  # Yeniden başlat (migration'lar otomatik çalışır)

# Manuel kurulumda:
cd backend
alembic downgrade base   # Tüm tabloları sil
alembic upgrade head     # Yeniden oluştur
```

### 7.6. Veritabanı Yedekleme

```bash
# Docker'dan yedek al
docker compose exec postgres pg_dump -U postgres balticwind > backup.sql

# Yedeği geri yükle
docker compose exec -T postgres psql -U postgres -d balticwind < backup.sql
```

---

## 8. Günlük Geliştirme İş Akışı

### 8.1. Sabah Başlarken

```bash
# Docker servisleri çalışıyor mu kontrol et
docker compose ps

# Çalışmıyorsa başlat
docker compose up -d

# Veya hibrit modda sadece veritabanı + Redis:
docker compose up -d postgres redis
```

### 8.2. Kod Değişikliği Döngüsü

Tipik bir geliştirme döngüsü:

```
Kod yaz → Kaydet → Test et → Lint kontrolü → Commit
```

### 8.3. Backend Değişikliği Yaptım — Ne Yapmalıyım?

| Durum | Docker ile | Manuel ile |
|-------|-----------|------------|
| Python kodu değiştim (`app/` altında) | `docker compose up -d --build backend` | Otomatik — `--reload` bayrağı sunucuyu yeniden başlatır |
| Yeni Python paketi ekledim (`pyproject.toml`) | `docker compose up -d --build backend` | `pip install -e ".[dev]"` |
| Yeni migration oluşturdum | `docker compose restart backend` | `alembic upgrade head` |
| Model (Pydantic/SQLAlchemy) değiştirdim | Build gerekebilir | Otomatik (--reload) + migration gerekebilir |

### 8.4. Frontend Değişikliği Yaptım — Ne Yapmalıyım?

| Durum | Docker ile | Manuel ile |
|-------|-----------|------------|
| React bileşeni değiştirdim (`src/` altında) | `docker compose up -d --build frontend` | Otomatik — Vite HMR anında günceller |
| Yeni npm paketi ekledim (`package.json`) | `docker compose up -d --build frontend` | `cd frontend && npm ci` |
| Tailwind sınıfı ekledim | `docker compose up -d --build frontend` | Otomatik — Vite + Tailwind anında algılar |
| Ortam değişkeni değiştirdim (`.env`) | `docker compose up -d frontend` | Vite dev sunucusunu yeniden başlat (`Ctrl+C` → `npm run dev`) |

### 8.5. Günün Sonunda

Servisleri durdurmak **zorunlu değildir** ama önerilir:

```bash
# Servisleri durdur (veriler korunur)
docker compose down

# Veya çalışır bırakın — bilgisayarı kapattığınızda Docker otomatik durdurur
# Docker Desktop'u "Start Docker Desktop when you sign in" ayarıyla açarsanız,
# sonraki oturum açmanızda servisler otomatik başlayabilir.
```

---

## 9. Makefile Komutları

Proje kök dizininde `make <komut>` ile kısa yol komutlarını kullanabilirsiniz.
Her komut, arka planda ne çalıştırdığıyla birlikte açıklanmıştır:

### 9.1. Kurulum Komutları

| Komut | Arka Planda Ne Çalışır | Açıklama |
|-------|----------------------|----------|
| `make install` | `install-backend` + `install-frontend` | Tüm bağımlılıkları kurar |
| `make install-backend` | `cd backend && pip install -e ".[dev]"` | Python paketlerini kurar |
| `make install-frontend` | `cd frontend && npm ci` | Node paketlerini kurar |
| `make install-docs` | `pip install -r requirements-docs.txt` | MkDocs + eklentileri kurar |
| `make install-hooks` | `pip install pre-commit && pre-commit install` | Git hook'larını kurar |

### 9.2. Lint Komutları

| Komut | Arka Planda Ne Çalışır | Açıklama |
|-------|----------------------|----------|
| `make lint` | `lint-backend` + `lint-frontend` | Tüm linter'ları çalıştırır |
| `make lint-backend` | `ruff check` + `ruff format --check` + `mypy` | Python lint + tip kontrolü |
| `make lint-frontend` | `tsc --noEmit` + `eslint src/` | TypeScript tip kontrolü + lint |

### 9.3. Formatlama Komutları

| Komut | Arka Planda Ne Çalışır | Açıklama |
|-------|----------------------|----------|
| `make format` | `ruff format` + `ruff check --fix` + `prettier` | Tüm kodu otomatik biçimlendirir |

### 9.4. Test Komutları

| Komut | Arka Planda Ne Çalışır | Açıklama |
|-------|----------------------|----------|
| `make test` | `test-backend` + `test-frontend` | Tüm testleri çalıştırır |
| `make test-backend` | `pytest --cov=app --cov-report=term-missing tests/` | Python testleri + kapsam raporu |
| `make test-frontend` | `npx vitest run --coverage` | TypeScript testleri + kapsam raporu |

### 9.5. Docker Komutları

| Komut | Arka Planda Ne Çalışır | Açıklama |
|-------|----------------------|----------|
| `make docker-up` | `docker compose up -d --build` | Tüm servisleri başlat |
| `make docker-down` | `docker compose down` | Tüm servisleri durdur |
| `make docker-logs` | `docker compose logs -f` | Logları canlı takip et |

### 9.6. Dokümantasyon Komutları

| Komut | Arka Planda Ne Çalışır | Açıklama |
|-------|----------------------|----------|
| `make docs-serve` | `mkdocs serve -a localhost:8080` | Dokümantasyon sitesini yerel önizle |
| `make docs-build` | `mkdocs build` | Statik HTML site oluştur |

### 9.7. Temizlik

| Komut | Arka Planda Ne Çalışır | Açıklama |
|-------|----------------------|----------|
| `make clean` | `__pycache__`, `.mypy_cache`, `node_modules`, `dist/` sil | Derleme çıktılarını temizle |

### Hızlı Başlangıç (Makefile ile)

```bash
# 1. Docker ile her şeyi başlat
make docker-up

# 2. Logları takip et
make docker-logs

# 3. İşin bitince durdur
make docker-down
```

---

## 10. Linting ve Pre-commit

### 10.1. Lint Araçları — Detaylı

| Araç | Dil | Ne Yapar | Neden Gerekli |
|------|-----|----------|---------------|
| **ruff** | Python | Lint + format — 700+ kural kontrol eder | flake8, isort, black araçlarının hepsini tek başına yapar, 10-100x daha hızlı (Rust ile yazılmış) |
| **mypy** | Python | Statik tip kontrolü (strict mod) | Fonksiyon parametrelerinin ve dönüş değerlerinin tiplerini derleme zamanında kontrol eder. Çalışma zamanında oluşacak `TypeError` hatalarını önler |
| **ESLint** | TypeScript | Kod kalitesi + React kuralları | Kullanılmayan değişkenleri, yanlış hook kullanımını, güvensiz kalıpları yakalar |
| **tsc** | TypeScript | Tip kontrolü (`--noEmit`) | TypeScript derleyicisi — tip hatalarını bulur ama JavaScript üretmez |
| **Prettier** | TS/CSS | Kod biçimlendirme | Tutarlı girinti, satır uzunluğu, virgül stili — ekip genelinde tek format |

### 10.2. Manuel Çalıştırma

```bash
# Tüm linter'lar (backend + frontend)
make lint

# Sadece backend
make lint-backend

# Sadece frontend
make lint-frontend

# Otomatik düzeltme (format hataları, import sıralaması vb.)
make format
```

### 10.3. Pre-commit Hook Sistemi

**Pre-commit nedir?**
`pre-commit`, her `git commit` komutundan **önce** otomatik olarak kalite kontrolü yapan
bir araçtır. "Hook" (kanca), Git'in belirli olaylarda (commit, push vb.) tetiklediği
betiklere verilen isimdir.

**Nasıl çalışır?**

```
git commit -m "mesaj"
    ↓
Pre-commit tetiklenir
    ↓
Tüm hook'lar sırasıyla çalışır:
  1. trailing-whitespace → satır sonu boşlukları sil
  2. end-of-file-fixer → dosya sonuna newline ekle
  3. check-yaml → YAML söz dizimi kontrol
  4. check-json → JSON söz dizimi kontrol
  5. check-added-large-files → 1 MB'den büyük dosya engelle
  6. check-merge-conflict → merge çakışma işaretleri kontrol
  7. ruff → Python lint (otomatik düzeltme ile)
  8. ruff-format → Python biçimlendirme
  9. mypy → Python tip kontrolü
  10. eslint → TypeScript lint
    ↓
Hepsi başarılı → Commit oluşturulur ✓
Herhangi biri başarısız → Commit REDDEDİLİR ✗
```

**Kurulum:**

```bash
pip install pre-commit
pre-commit install
```

**Commit reddedilirse ne yapmalı?**

1. Terminal çıktısında hangi hook'un başarısız olduğuna bakın
2. Eğer `ruff` veya `ruff-format` başarısız olduysa → otomatik düzeltme uygulanmış olabilir. Dosyaları tekrar `git add` edin ve commit'i tekrarlayın
3. Eğer `mypy` başarısız olduysa → tip hatalarını düzeltin
4. Eğer `eslint` başarısız olduysa → TypeScript uyarılarını giderin
5. Eğer `check-added-large-files` başarısız olduysa → büyük dosyayı staging'den çıkarın (`git reset HEAD dosya`)

```bash
# Tüm dosyalarda hook'ları çalıştır (commit yapmadan test amaçlı)
pre-commit run --all-files
```

---

## 11. Test Çalıştırma

### 11.1. Backend Testleri — pytest

**pytest nedir?** Python'un en popüler test çerçevesidir. Test dosyalarını otomatik
keşfeder (`test_*.py` veya `*_test.py`), testleri çalıştırır ve raporlar.

```bash
cd backend

# Tüm testleri çalıştır
pytest

# Coverage (kapsam) raporu ile
pytest --cov=app --cov-report=term-missing tests/

# Tek bir test dosyasını çalıştır
pytest tests/test_health.py

# Belirli bir test fonksiyonunu çalıştır
pytest tests/test_health.py::test_health_endpoint -v

# Sadece başarısız olan testleri tekrar çalıştır
pytest --lf
```

**Coverage raporu nasıl okunur?**

```
Name                           Stmts   Miss  Cover   Missing
------------------------------------------------------------
app/main.py                       45      2    96%   78-79
app/api/v1/health.py              12      0   100%
app/models/wind_farm.py           34      5    85%   23-27
------------------------------------------------------------
TOTAL                            354     28    92%
```

| Sütun | Açıklama |
|-------|----------|
| `Stmts` | Toplam kod satırı sayısı |
| `Miss` | Testlerin çalıştırmadığı satır sayısı |
| `Cover` | Kapsam yüzdesi (ne kadar kod test ediliyor) |
| `Missing` | Test edilmeyen satır numaraları |

**Yapılandırma:** `backend/pyproject.toml` → `[tool.pytest.ini_options]` bölümü:
- `testpaths = ["tests"]` — testleri `tests/` klasöründe ara
- `asyncio_mode = "auto"` — async test fonksiyonlarını otomatik algıla
- `addopts = "-v --tb=short"` — verbose çıktı + kısa traceback

### 11.2. Frontend Testleri — Vitest

**Vitest nedir?** Vite ekosistemiyle doğal uyumlu bir test çerçevesidir. Jest ile benzer
API sunar ama Vite'ın hızlı dönüşüm motorunu kullanır.

```bash
cd frontend

# Tüm testleri çalıştır
npx vitest run

# Coverage raporu ile
npx vitest run --coverage

# İzleme modunda (dosya değişince otomatik çalışır)
npx vitest

# Tek bir test dosyasını çalıştır
npx vitest run src/components/SomeComponent.test.tsx
```

### 11.3. Tümünü Birden Çalıştırma

```bash
make test
```

Bu komut sırasıyla `test-backend` ve `test-frontend` hedeflerini çalıştırır.

---

## 12. CI/CD — GitHub Actions

### 12.1. Push/PR Yaptığımda Ne Olur?

`main` veya `develop` dalına push yaptığınızda veya pull request açtığınızda,
GitHub Actions **otomatik olarak** 4 iş (job) çalıştırır:

```
Push / PR
    ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Backend Lint │  │ Backend Test │  │ Frontend Lint│  │Frontend Test │
│ ruff + mypy  │  │ pytest + cov │  │ tsc + eslint │  │ vitest + cov │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
    (paralel olarak çalışır — birbirini beklemez)
```

### 12.2. CI Job'ları

| Job | Ne Yapar | Başarısızlık Nedenleri |
|-----|----------|----------------------|
| **Backend Lint** | `ruff check` + `ruff format --check` + `mypy app/` | Format hatası, tip hatası, lint uyarısı |
| **Backend Test** | `pytest --cov=app tests/` | Test başarısız, import hatası |
| **Frontend Lint** | `tsc --noEmit` + `eslint src/` | TypeScript tip hatası, ESLint uyarısı |
| **Frontend Test** | `vitest run --coverage` | Test başarısız, render hatası |

### 12.3. CI Başarısız Olursa Ne Yapılır?

1. GitHub'da PR veya commit sayfasında kırmızı ✗ işaretine tıklayın
2. Başarısız olan job'ın **Details** linkine tıklayın
3. Log çıktısında hata mesajını bulun
4. Hatayı yerel makinenizde düzeltin:
   ```bash
   make lint    # Lint hatalarını bul
   make test    # Test hatalarını bul
   make format  # Otomatik düzeltilebilenleri düzelt
   ```
5. Düzeltmeyi commit'leyin ve push'layın — CI otomatik tekrar çalışır

### 12.4. Dokümantasyon Dağıtımı

`main` dalında `docs/`, `mkdocs.yml` veya `requirements-docs.txt` dosyaları değiştiğinde,
ayrı bir **Docs** workflow çalışır:

1. MkDocs, dokümantasyonu statik HTML'e derler
2. GitHub Pages'e otomatik dağıtılır
3. Dokümantasyon sitesi güncellenir

---

## 13. Dokümantasyon Sitesi

### 13.1. MkDocs Nedir?

MkDocs, Markdown dosyalarından profesyonel bir dokümantasyon web sitesi oluşturan bir
araçtır. Projemiz **Material for MkDocs** temasını kullanır — karanlık/aydınlık mod,
arama, kod vurgulama, navigasyon sekmeleri gibi özellikler sunar.

### 13.2. Yerel Önizleme

```bash
# MkDocs bağımlılıklarını kur (ilk seferinde)
make install-docs

# Yerel sunucuyu başlat
make docs-serve
```

Tarayıcıda [http://localhost:8080](http://localhost:8080) açın. Markdown dosyalarını
düzenledikçe sayfa otomatik güncellenir (canlı yeniden yükleme).

### 13.3. Yapı

Dokümantasyon yapılandırması `mkdocs.yml` dosyasındadır. Navigasyon yapısı:

```
Home
├── Engineering Standards (SKILL.md)
├── Project Roadmap (Project_Roadmap.md)
├── Learning Roadmap (Learning_Roadmap.md)
└── Lessons/
    ├── 000 — Project Planning & Engineering Methodology
    ├── 001 — DevOps Foundation
    ├── 002 — Internationalization (TR)
    ├── ...
    └── 018 — FAT/SAT & Koruma Koordinasyonu (TR)
```

### 13.4. Yeni Ders/Sayfa Ekleme

1. `docs/lessons/` klasörüne yeni Markdown dosyası oluşturun (ör. `lesson-019.md`)
2. `mkdocs.yml` dosyasının `nav:` bölümüne ekleyin:
   ```yaml
   nav:
     - Lessons:
       - "019 — Yeni Ders Başlığı": lessons/lesson-019.md
   ```
3. `make docs-serve` ile önizleyin
4. Commit + push yapın — GitHub Actions otomatik dağıtır

---

## 14. Sık Karşılaşılan Sorunlar

### Port Çakışması

**Sorun:** `Bind for 0.0.0.0:5432 failed: port is already allocated`

**Neden:** Başka bir uygulama (yerel PostgreSQL, başka bir Docker projesi) aynı portu kullanıyor.

**Çözüm:**

```bash
# Windows (PowerShell) — hangi işlem portu kullanıyor?
netstat -ano | findstr :5432

# Linux / macOS
lsof -i :5432

# Alternatif: docker-compose.yml'da portu değiştirin (ör. "5433:5432")
# Bu durumda .env'deki DATABASE_URL'deki portu da 5433 yapın
```

---

### Docker Build Hatası

**Sorun:** `npm ci` veya `pip install` Docker build sırasında başarısız oluyor.

**Çözüm:**

```bash
# Docker önbelleğini temizle ve baştan build et
docker compose build --no-cache

# Veya her şeyi sil ve baştan başla
docker compose down -v
docker system prune -f
docker compose up -d --build
```

---

### Docker Desktop Başlamıyor

**Sorun:** Docker Desktop açılıyor ama Engine başlamıyor, balina ikonu kırmızı kalıyor.

**Olası nedenler ve çözümler:**

1. **WSL2 kurulu değil:**
   ```powershell
   wsl --install
   # Bilgisayarı yeniden başlatın
   ```
2. **Sanallaştırma (Virtualization) kapalı:**
   - BIOS/UEFI ayarlarında "Intel VT-x" veya "AMD-V" seçeneğini etkinleştirin
   - Windows'ta: Görev Yöneticisi → Performans → CPU → "Virtualization: Enabled" yazmalı
3. **Eski Docker artıkları:**
   - Docker Desktop'u kaldırıp yeniden kurun
   - `%APPDATA%\Docker` ve `%LOCALAPPDATA%\Docker` klasörlerini silin

---

### Migration Hatası

**Sorun:** `alembic upgrade head` başarısız oluyor.

**Çözüm:**

```bash
# Mevcut migration durumunu kontrol et
cd backend
alembic current

# Veritabanını sıfırla (TÜM VERİLER SİLİNİR)
docker compose down -v
docker compose up -d
```

---

### Backend Başlamıyor (Container Sürekli Yeniden Başlıyor)

**Sorun:** `docker compose ps` çıktısında backend `restarting` durumunda.

**Çözüm:**

```bash
# Logları kontrol et — hata mesajını oku
docker compose logs backend

# Yaygın nedenler:
# 1. PostgreSQL henüz hazır değil → biraz bekleyin (health check var)
# 2. Migration hatası → logda SQL hatasına bakın
# 3. Eksik ortam değişkeni → .env.example ile karşılaştırın
# 4. Python import hatası → logda ModuleNotFoundError var mı?
```

---

### Frontend Boş Sayfa

**Sorun:** `localhost:3000` açılıyor ama sayfa boş.

**Çözüm:**

```bash
# 1. Backend çalışıyor mu?
curl http://localhost:8000/health

# 2. Tarayıcı konsolunu açın (F12) → Console sekmesi → JavaScript hatalarına bakın

# 3. Frontend'i yeniden build edin
docker compose up -d --build frontend
```

---

### Python PATH Sorunu

**Sorun:** `python` komutu bulunamıyor veya Microsoft Store açılıyor.

**Çözüm (Windows):**

1. Ayarlar → Uygulamalar → Gelişmiş uygulama ayarları → Uygulama yürütme diğer adları
2. "App Installer — python.exe" ve "python3.exe" → **Kapatın**
3. Terminali kapatıp yeniden açın
4. `python --version` tekrar deneyin

Hâlâ çalışmıyorsa:
```bash
# Alternatif komutlar deneyin:
python3 --version
py --version
py -3.13 --version
```

---

### Python Sanal Ortam Sorunu

**Sorun:** `ModuleNotFoundError` — paket bulunamıyor.

**Çözüm:**

```bash
# Sanal ortamın aktif olduğundan emin olun
# Komut istemcisinde (.venv) yazıyor olmalı

# Windows (Git Bash):
source backend/.venv/Scripts/activate

# Bağımlılıkları yeniden kur
cd backend
pip install -e ".[dev]"
```

---

### Node Modülleri Sorunu

**Sorun:** `Module not found` veya bağımlılık hataları.

**Çözüm:**

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

### Permission Denied Hataları

**Sorun:** Docker veya dosya sistemi "permission denied" hatası veriyor.

**Çözümler:**

```bash
# Docker socket izni (Linux):
sudo usermod -aG docker $USER
# Oturumu kapatıp açın

# Windows'ta PowerShell'i yönetici olarak çalıştırın

# Docker volume izni:
docker compose down -v
docker compose up -d --build
```

---

### CORS Hataları

**Sorun:** Tarayıcı konsolunda `Access-Control-Allow-Origin` hatası.

**Neden:** Frontend, izin listesinde olmayan bir adresten backend'e istek yapıyor.

**Çözüm:**

Backend `.env` dosyasındaki `CORS_ORIGINS` değişkenini kontrol edin:

```env
# Frontend adreslerinizi ekleyin
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

Servisi yeniden başlatın:
```bash
docker compose restart backend
# veya (manuel): Ctrl+C → uvicorn'u tekrar başlat
```

---

### TimescaleDB Uzantısı Yüklenmiyor

**Sorun:** Migration'da `CREATE EXTENSION timescaledb` hatası.

**Çözüm:**

```bash
# Docker kullanıyorsanız uzantı imajda dahildir.
# Kontrol edin:
docker compose exec postgres psql -U postgres -d balticwind \
  -c "SELECT extname FROM pg_extension WHERE extname='timescaledb';"

# Manuel kurulumda:
# postgresql.conf dosyasında bu satır olmalı:
# shared_preload_libraries = 'timescaledb'
# PostgreSQL servisini yeniden başlatıp deneyin
```

---

### WSL2 Sorunları

**Sorun:** WSL komutları çalışmıyor veya Docker WSL backend'i bulamıyor.

**Çözüm:**

```powershell
# WSL durumunu kontrol et
wsl --status

# WSL'i güncelle
wsl --update

# WSL'i yeniden başlat
wsl --shutdown
# Docker Desktop'u kapatıp yeniden açın
```

---

### Volume Temizleme

Veritabanı verilerini tamamen sıfırlamak istediğinizde:

```bash
# Servisleri durdur + volume'ları sil
docker compose down -v

# Tüm Docker volume'larını listele
docker volume ls

# Belirli bir volume'u sil
docker volume rm baltic-wind-control-system_pgdata

# Yeniden başlat (temiz veritabanı)
docker compose up -d --build
```

---

### Önbellek Temizleme

```bash
# Python + Node önbelleklerini temizle
make clean

# Docker build önbelleğini temizle
docker builder prune -f

# Docker'da kullanılmayan her şeyi temizle (DİKKAT: diğer projeleri etkileyebilir)
docker system prune -f
```

---

## 15. Proje Mimarisi

### 15.1. Servis Bağlantı Şeması

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Tarayıcı   │────▶│  Frontend   │────▶│    Backend       │────▶│  PostgreSQL  │
│             │     │  (nginx)    │     │    (FastAPI)     │     │  TimescaleDB │
│             │     │  :3000      │     │    :8000         │     │  :5432       │
└─────────────┘     └─────────────┘     └────────┬────────┘     └──────────────┘
                          │                      │
                          │  /api/* proxy         │
                          └──────────────────────┘    ┌──────────────┐
                                                      │    Redis     │
                                             ◀────────│    :6379     │
                                             (cache)  └──────────────┘
```

### 15.2. Veri Akışı

1. **Kullanıcı** tarayıcıda `localhost:3000` adresini açar
2. **nginx** (frontend container) statik dosyaları (HTML/JS/CSS) sunar
3. `/api/*` istekleri nginx tarafından **backend'e proxy** edilir
4. **FastAPI** isteği işler, gerekirse **PostgreSQL**'den veri çeker
5. Sık erişilen veriler **Redis** önbelleğinde saklanır
6. Yanıt aynı yoldan kullanıcıya döner

### 15.3. Klasör Yapısı

```
baltic-wind-control-system/
├── backend/                    # FastAPI + Python backend
│   ├── app/                    # Uygulama kodu
│   │   ├── api/v1/             # API endpoint'leri (P1-P5)
│   │   ├── models/             # SQLAlchemy ORM modelleri
│   │   ├── schemas/            # Pydantic doğrulama şemaları
│   │   ├── services/           # İş mantığı katmanı
│   │   └── main.py             # FastAPI uygulama nesnesi
│   ├── alembic/                # Veritabanı migration dosyaları
│   │   └── versions/           # 7 migration (P1-P5)
│   ├── tests/                  # pytest test dosyaları
│   ├── Dockerfile              # Backend Docker imajı
│   ├── entrypoint.sh           # Migration + uvicorn başlatma
│   ├── pyproject.toml          # Python bağımlılıkları ve araç ayarları
│   ├── alembic.ini             # Alembic yapılandırması
│   └── .env.example            # Ortam değişkenleri şablonu
├── frontend/                   # React 19 + TypeScript frontend
│   ├── src/                    # Kaynak kod
│   │   ├── components/         # React bileşenleri
│   │   ├── pages/              # Sayfa bileşenleri (P1-P5 dashboard'ları)
│   │   ├── stores/             # Zustand state yönetimi
│   │   └── main.tsx            # React kök bileşeni
│   ├── Dockerfile              # Frontend Docker imajı (Node build + nginx)
│   ├── package.json            # Node bağımlılıkları
│   └── .env.example            # Ortam değişkenleri şablonu
├── docs/                       # Dokümantasyon (MkDocs)
│   ├── lessons/                # Ders notları (000-018)
│   ├── SKILL.md                # Mühendislik standartları
│   ├── Project_Roadmap.md      # Proje yol haritası
│   └── KULLANICI_KILAVUZU.md   # Bu kılavuz
├── .github/workflows/          # CI/CD yapılandırması
│   ├── ci.yml                  # Lint + test (4 job)
│   └── docs.yml                # MkDocs → GitHub Pages
├── docker-compose.yml          # 4 servis tanımı
├── Makefile                    # Kısa yol komutları
├── mkdocs.yml                  # Dokümantasyon sitesi ayarları
├── .pre-commit-config.yaml     # Kod kalitesi hook'ları
└── CLAUDE.md                   # AI asistan yapılandırması
```

### 15.4. Beş Proje Modülü

| Proje | Modül | Teknoloji |
|-------|-------|-----------|
| **P1** | Rüzgâr Kaynağı & AEP | PyWake, ERA5, Weibull, LCOE |
| **P2** | HV Şebeke Entegrasyonu | Pandapower, IEC 60909, FRT, STATCOM |
| **P3** | SCADA & Otomasyon | IEC 61850, GOOSE, Çalışma İzni |
| **P4** | AI Tahminleme | XGBoost, LSTM, TFT, SHAP |
| **P5** | Devreye Alma | Anahtarlama programı, LOTO, SAT |

### 15.5. Teknoloji Yığını Özeti

```
Frontend:  React 19 + TypeScript (strict) + Tailwind v4 + Plotly.js + XYFlow + Zustand
Backend:   FastAPI + Python 3.13 + Pydantic v2 + SQLAlchemy async + Alembic
Database:  PostgreSQL 16 + TimescaleDB
Cache:     Redis 7
Container: Docker Compose
Linting:   ruff + mypy + ESLint + Prettier + pre-commit
Test:      pytest + Vitest
CI/CD:     GitHub Actions + MkDocs (GitHub Pages) + Dependabot
```

---

## 16. Port ve Servis Referans Tablosu

| Port | Servis | Docker İmajı / Araç | URL | Açıklama |
|------|--------|---------------------|-----|----------|
| `3000` | Frontend (Docker) | nginx:alpine | [localhost:3000](http://localhost:3000) | Üretim build — nginx statik sunucu + API proxy |
| `5173` | Frontend (Vite dev) | — | [localhost:5173](http://localhost:5173) | Geliştirme sunucusu — HMR aktif |
| `8000` | Backend | FastAPI + uvicorn | [localhost:8000](http://localhost:8000) | REST API sunucusu |
| `8000` | Swagger UI | (backend'in parçası) | [localhost:8000/docs](http://localhost:8000/docs) | İnteraktif API dokümantasyonu |
| `8000` | ReDoc | (backend'in parçası) | [localhost:8000/redoc](http://localhost:8000/redoc) | API referans dokümantasyonu |
| `8000` | Health Check | (backend'in parçası) | [localhost:8000/health](http://localhost:8000/health) | Servis sağlık durumu (JSON) |
| `5432` | PostgreSQL | timescale/timescaledb:latest-pg16 | — | TimescaleDB veritabanı |
| `6379` | Redis | redis:7-alpine | — | Önbellek katmanı |
| `8080` | MkDocs | (yerel dev sunucu) | [localhost:8080](http://localhost:8080) | Dokümantasyon önizleme (`make docs-serve`) |

---

## 17. Hızlı Referans Kartı

```bash
# ─── Docker Komutları ──────────────────────────────────────

docker compose up -d --build     # Tüm servisleri başlat (build ile)
docker compose down              # Servisleri durdur (veriler korunur)
docker compose down -v           # Servisleri durdur + verileri sil
docker compose ps                # Servis durumlarını göster
docker compose logs -f           # Logları canlı takip et
docker compose logs -f backend   # Sadece backend logları
docker compose restart backend   # Backend'i yeniden başlat

# ─── Make Kısa Yolları ────────────────────────────────────

make docker-up                   # = docker compose up -d --build
make docker-down                 # = docker compose down
make docker-logs                 # = docker compose logs -f
make install                     # Backend + frontend bağımlılıkları kur
make lint                        # Tüm linter'ları çalıştır
make format                      # Kodu otomatik biçimlendir
make test                        # Tüm testleri çalıştır
make clean                       # Önbellekleri temizle
make docs-serve                  # Dokümantasyon önizleme (localhost:8080)

# ─── Backend (Manuel) ─────────────────────────────────────

cd backend
source .venv/Scripts/activate    # Sanal ortamı etkinleştir (Windows Git Bash)
pip install -e ".[dev]"          # Bağımlılıkları kur
alembic upgrade head             # Migration'ları uygula
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000  # Sunucuyu başlat

# ─── Frontend (Manuel) ────────────────────────────────────

cd frontend
npm ci                           # Bağımlılıkları kur
npm run dev                      # Vite dev sunucusu (localhost:5173)
npm run build                    # Üretim build oluştur
npm run preview                  # Build sonucunu önizle

# ─── Test ──────────────────────────────────────────────────

cd backend && pytest --cov=app tests/     # Backend testleri
cd frontend && npx vitest run --coverage  # Frontend testleri

# ─── Veritabanı ───────────────────────────────────────────

docker compose exec postgres psql -U postgres -d balticwind  # psql bağlantısı
docker compose down -v && docker compose up -d --build       # DB sıfırlama

# ─── Git ───────────────────────────────────────────────────

git status                       # Değişiklikleri göster
git add .                        # Tüm değişiklikleri staging'e al
git commit -m "açıklama"         # Commit oluştur (pre-commit hook çalışır)
git push                         # GitHub'a gönder (CI tetiklenir)
git pull                         # Güncellemeleri çek
```

---

*Bu kılavuz Baltic Wind HV Control Platform projesi için hazırlanmıştır.*
*Sorularınız için `docs/` klasöründeki diğer dokümanlara başvurabilirsiniz.*
*Kılavuzun güncellenme tarihi: Mart 2026*
