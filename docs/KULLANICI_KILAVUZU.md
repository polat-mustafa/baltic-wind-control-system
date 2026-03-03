# Kullanıcı Kılavuzu — Baltic Wind HV Control Platform

> **510 MW Baltık Denizi açık deniz rüzgâr çiftliği simülasyon platformu.**
> 34 × Vestas V236-15.0 MW | 66 kV dizi kablosu | 220 kV ihraç kablosu (45 km) | 400 kV PSE şebekesi

Bu kılavuz, projeyi sıfırdan kurup çalıştırmak için gereken her şeyi kapsar.
Hiçbir ön bilgi varsayılmaz — tüm adımlar sırasıyla anlatılır.

---

## İçindekiler

1. [Gereksinimler (Prerequisites)](#1-gereksinimler)
2. [Projeyi İndirme (Clone)](#2-projeyi-indirme)
3. [Docker ile Çalıştırma (Önerilen)](#3-docker-ile-calistirma)
4. [Veritabanı (PostgreSQL + TimescaleDB)](#4-veritabani)
5. [Backend — Manuel Çalıştırma](#5-backend-manuel-calistirma)
6. [Frontend — Manuel Çalıştırma](#6-frontend-manuel-calistirma)
7. [Makefile Komutları](#7-makefile-komutlari)
8. [Linting ve Pre-commit](#8-linting-ve-pre-commit)
9. [Test Çalıştırma](#9-test-calistirma)
10. [Sık Karşılaşılan Sorunlar (Troubleshooting)](#10-sik-karsilasilan-sorunlar)
11. [Proje Mimarisi — Genel Bakış](#11-proje-mimarisi)

---

## 1. Gereksinimler

Aşağıdaki araçların sisteminizde kurulu olması gerekir:

| Araç | Minimum Sürüm | Ne İçin Gerekli | İndirme Bağlantısı |
|------|---------------|-----------------|---------------------|
| **Git** | 2.40+ | Kaynak kod yönetimi | [git-scm.com](https://git-scm.com/) |
| **Docker Desktop** | 4.25+ | Tüm servisleri tek komutla çalıştırma | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Python** | 3.13+ | Backend (FastAPI) | [python.org](https://www.python.org/downloads/) |
| **Node.js** | 22+ | Frontend (React + Vite) | [nodejs.org](https://nodejs.org/) |

> **Not:** Sadece Docker ile çalışacaksanız Python ve Node.js kurmanıza gerek yoktur.
> Manuel geliştirme yapacaksanız (IDE'de debug, test çalıştırma vb.) her ikisini de kurun.

### Sürüm Kontrolü

Kurulumlarınızı doğrulamak için terminalde şu komutları çalıştırın:

```bash
git --version          # git version 2.40+ beklenir
docker --version       # Docker version 24+ beklenir
docker compose version # Docker Compose version v2+ beklenir
python --version       # Python 3.13+ beklenir
node --version         # v22+ beklenir
npm --version          # 10+ beklenir
```

---

## 2. Projeyi İndirme

```bash
git clone https://github.com/<kullanici-adi>/baltic-wind-control-system.git
cd baltic-wind-control-system
```

### Klasör Yapısı

```
baltic-wind-control-system/
├── backend/               # FastAPI + Python backend
│   ├── app/               # Uygulama kodu
│   ├── alembic/           # Veritabanı migration dosyaları
│   ├── tests/             # pytest test dosyaları
│   ├── Dockerfile         # Backend Docker imajı
│   ├── entrypoint.sh      # Migration + uvicorn başlatma
│   ├── pyproject.toml     # Python bağımlılıkları ve araç ayarları
│   └── .env.example       # Ortam değişkenleri şablonu
├── frontend/              # React 19 + TypeScript frontend
│   ├── src/               # Kaynak kod
│   ├── Dockerfile         # Frontend Docker imajı (Node build + nginx)
│   ├── package.json       # Node bağımlılıkları
│   └── .env.example       # Ortam değişkenleri şablonu
├── docs/                  # Dokümantasyon
├── docker-compose.yml     # 4 servis tanımı
├── Makefile               # Kısa yol komutları
├── mkdocs.yml             # Dokümantasyon sitesi ayarları
└── .pre-commit-config.yaml # Kod kalitesi hook'ları
```

---

## 3. Docker ile Çalıştırma

Bu yöntem **önerilen** yöntemdir. Tek komutla tüm sistemi ayağa kaldırır.

### 3.1. Servisleri Başlatma

```bash
docker compose up -d --build
```

Bu komut 4 servis başlatır:

| Servis | Port | Açıklama |
|--------|------|----------|
| **postgres** | `5432` | TimescaleDB (PostgreSQL 16 + zaman serisi uzantısı) |
| **redis** | `6379` | Redis 7 — önbellek katmanı |
| **backend** | `8000` | FastAPI uygulama sunucusu |
| **frontend** | `3000` | nginx üzerinde React uygulaması |

Servisler sıralı başlar: `postgres` → `redis` → `backend` → `frontend`.
Her servis bir öncekinin **sağlık kontrolünü** (health check) geçmesini bekler.

### 3.2. Durumu Kontrol Etme

```bash
# Tüm servislerin durumunu gör
docker compose ps

# Logları canlı takip et
docker compose logs -f

# Sadece backend loglarını gör
docker compose logs -f backend
```

### 3.3. Tarayıcıda Açma

- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:8000](http://localhost:8000)
- **API Dokümantasyonu (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Sağlık Kontrolü:** [http://localhost:8000/health](http://localhost:8000/health)

### 3.4. Servisleri Durdurma

```bash
# Servisleri durdur (veritabanı verileri korunur)
docker compose down

# Servisleri durdur VE veritabanı verilerini sil
docker compose down -v
```

### 3.5. Ne Zaman Rebuild Gerekir?

Aşağıdaki durumlarda `--build` bayrağı ile yeniden başlatın:

| Değişiklik | Rebuild Gerekir mi? |
|-----------|---------------------|
| Python kodu değişti (`app/` altında) | **Evet** — `docker compose up -d --build backend` |
| `pyproject.toml` güncellendi (yeni bağımlılık) | **Evet** — `docker compose up -d --build backend` |
| Frontend kodu değişti (`src/` altında) | **Evet** — `docker compose up -d --build frontend` |
| `package.json` güncellendi (yeni bağımlılık) | **Evet** — `docker compose up -d --build frontend` |
| `docker-compose.yml` değişti | **Evet** — `docker compose up -d --build` |
| Sadece `.env` değişti | **Hayır** — `docker compose up -d` yeterli |

> **İpucu:** Docker, katman önbelleği (layer caching) kullanır. Bağımlılıklar değişmediyse
> rebuild çok hızlı tamamlanır.

---

## 4. Veritabanı

### 4.1. Veritabanı Bilgileri

| Parametre | Değer |
|-----------|-------|
| Sunucu | `localhost` (Docker dışı) veya `postgres` (Docker içi) |
| Port | `5432` |
| Veritabanı Adı | `balticwind` |
| Kullanıcı | `postgres` |
| Şifre | `postgres` |
| Bağlantı URL'si (Docker dışı) | `postgresql+asyncpg://postgres:postgres@localhost:5432/balticwind` |
| Bağlantı URL'si (Docker içi) | `postgresql+asyncpg://postgres:postgres@postgres:5432/balticwind` |

### 4.2. Migration'lar (Veritabanı Şema Yönetimi)

Migration'lar **Alembic** ile yönetilir. Docker kullanıyorsanız migration'lar otomatik çalışır
(`entrypoint.sh` dosyası her başlatmada `alembic upgrade head` komutunu çalıştırır).

Manuel çalıştırma için:

```bash
cd backend

# Tüm migration'ları uygula
alembic upgrade head

# Mevcut durumu kontrol et
alembic current

# Son migration'u geri al
alembic downgrade -1

# Yeni migration oluştur
alembic revision --autogenerate -m "açıklama"
```

### 4.3. pgAdmin ile Bağlantı

Veritabanını görsel olarak incelemek için [pgAdmin](https://www.pgadmin.org/) kullanabilirsiniz:

1. pgAdmin'i açın
2. **Add New Server** tıklayın
3. **General** sekmesi → Name: `Baltic Wind`
4. **Connection** sekmesi:
   - Host: `localhost`
   - Port: `5432`
   - Database: `balticwind`
   - Username: `postgres`
   - Password: `postgres`
5. **Save** tıklayın

### 4.4. psql ile Bağlantı (Terminal)

```bash
# Docker içindeki PostgreSQL'e bağlan
docker compose exec postgres psql -U postgres -d balticwind

# Tabloları listele
\dt

# TimescaleDB uzantısını kontrol et
SELECT extname, extversion FROM pg_extension WHERE extname = 'timescaledb';

# Çıkış
\q
```

---

## 5. Backend — Manuel Çalıştırma

Docker yerine backend'i doğrudan makinenizde çalıştırmak istiyorsanız:

### 5.1. Ortam Değişkenleri

```bash
cd backend
cp .env.example .env
```

`.env` dosyasındaki varsayılan değerler:

```env
APP_NAME=Baltic Wind HV Control Platform
DEBUG=false
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/balticwind
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

> **Önemli:** Manuel çalıştırırken PostgreSQL ve Redis'in çalışıyor olması gerekir.
> Bunları Docker ile başlatabilirsiniz:
> ```bash
> docker compose up -d postgres redis
> ```

### 5.2. Python Bağımlılıklarını Kurma

```bash
cd backend

# Sanal ortam oluştur (önerilir)
python -m venv .venv

# Sanal ortamı etkinleştir
# Windows (Git Bash / MSYS2):
source .venv/Scripts/activate
# Linux / macOS:
source .venv/bin/activate

# Bağımlılıkları kur (geliştirme araçları dahil)
pip install -e ".[dev]"
```

### 5.3. Migration'ları Çalıştırma

```bash
cd backend
alembic upgrade head
```

### 5.4. Sunucuyu Başlatma

```bash
cd backend

# Geliştirme modu (otomatik yeniden yükleme)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Üretim modu
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Sunucu başladıktan sonra:
- API: [http://localhost:8000](http://localhost:8000)
- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 6. Frontend — Manuel Çalıştırma

### 6.1. Ortam Değişkenleri

```bash
cd frontend
cp .env.example .env
```

`.env` dosyası:

```env
VITE_API_BASE_URL=http://localhost:8000
```

### 6.2. Bağımlılıkları Kurma

```bash
cd frontend
npm ci
```

> **Not:** `npm install` yerine `npm ci` kullanın. `npm ci`, `package-lock.json` dosyasına
> sadık kalarak deterministik (tekrarlanabilir) kurulum yapar.

### 6.3. Geliştirme Sunucusu

```bash
cd frontend
npm run dev
```

Vite geliştirme sunucusu [http://localhost:5173](http://localhost:5173) adresinde başlar.
Hot Module Replacement (HMR) aktiftir — dosya kaydettiğinizde sayfa otomatik güncellenir.

> **Not:** Docker'daki nginx `3000` portunda çalışır ve API isteklerini otomatik proxy'ler.
> Vite dev sunucusu `5173` portunda çalışır — API istekleri için `VITE_API_BASE_URL`
> ortam değişkenini kullanır.

### 6.4. Üretim Build

```bash
cd frontend
npm run build    # dist/ klasörüne üretim build'i oluşturur
npm run preview  # Üretim build'ini önizle
```

---

## 7. Makefile Komutları

Proje kök dizininde `make <komut>` ile kısa yol komutlarını kullanabilirsiniz:

| Komut | Açıklama |
|-------|----------|
| `make help` | Tüm komutları listeler |
| `make install` | Backend + Frontend bağımlılıklarını kurar |
| `make install-backend` | `cd backend && pip install -e ".[dev]"` |
| `make install-frontend` | `cd frontend && npm ci` |
| `make install-docs` | MkDocs bağımlılıklarını kurar |
| `make install-hooks` | pre-commit hook'larını kurar |
| `make lint` | Tüm linter'ları çalıştırır (backend + frontend) |
| `make lint-backend` | ruff check + ruff format --check + mypy |
| `make lint-frontend` | tsc --noEmit + eslint |
| `make format` | Tüm kodu otomatik biçimlendirir |
| `make test` | Tüm testleri çalıştırır (backend + frontend) |
| `make test-backend` | `pytest --cov=app --cov-report=term-missing tests/` |
| `make test-frontend` | `npx vitest run --coverage` |
| `make docker-up` | `docker compose up -d --build` |
| `make docker-down` | `docker compose down` |
| `make docker-logs` | `docker compose logs -f` |
| `make docs-serve` | MkDocs'u `localhost:8080`'de başlatır |
| `make docs-build` | MkDocs statik site oluşturur |
| `make clean` | Derleme çıktılarını ve önbellekleri temizler |

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

## 8. Linting ve Pre-commit

### 8.1. Lint Araçları

| Araç | Dil | Ne Yapar |
|------|-----|----------|
| **ruff** | Python | Lint + format (flake8/isort/black yerine) |
| **mypy** | Python | Statik tip kontrolü (strict mod) |
| **ESLint** | TypeScript | Kod kalitesi + React hook kuralları |
| **tsc** | TypeScript | Tip kontrolü (`--noEmit`) |
| **Prettier** | TS/CSS | Kod biçimlendirme |

### 8.2. Manuel Çalıştırma

```bash
# Tüm linter'lar
make lint

# Sadece backend
make lint-backend

# Sadece frontend
make lint-frontend

# Otomatik düzeltme
make format
```

### 8.3. Pre-commit Hook'ları

Pre-commit, her `git commit` öncesinde otomatik olarak kalite kontrolü yapar.
Commit'iniz kalite kontrolünden geçemezse, commit reddedilir.

**Kurulum:**

```bash
# pre-commit aracını kur
pip install pre-commit

# Hook'ları aktifleştir
pre-commit install
```

**Manuel çalıştırma:**

```bash
# Tüm dosyalarda çalıştır
pre-commit run --all-files

# Sadece değişen dosyalarda çalıştır (commit sırasında otomatik olur)
pre-commit run
```

**Aktif hook'lar:**

| Hook | Açıklama |
|------|----------|
| `trailing-whitespace` | Satır sonundaki gereksiz boşlukları siler |
| `end-of-file-fixer` | Dosya sonuna yeni satır ekler |
| `check-yaml` | YAML söz dizimi kontrolü |
| `check-json` | JSON söz dizimi kontrolü |
| `check-added-large-files` | 1 MB'den büyük dosya eklenmesini engeller |
| `check-merge-conflict` | Merge çakışma işaretlerini yakalar |
| `ruff` | Python lint (otomatik düzeltme ile) |
| `ruff-format` | Python biçimlendirme |
| `mypy` | Python tip kontrolü |
| `eslint` | TypeScript lint |

---

## 9. Test Çalıştırma

### 9.1. Backend Testleri (pytest)

```bash
cd backend

# Tüm testleri çalıştır
pytest

# Coverage raporu ile
pytest --cov=app --cov-report=term-missing tests/

# Tek bir test dosyasını çalıştır
pytest tests/test_health.py

# Belirli bir test fonksiyonunu çalıştır
pytest tests/test_health.py::test_health_endpoint -v
```

**Yapılandırma:** `backend/pyproject.toml` dosyasında `[tool.pytest.ini_options]` bölümüne bakın.

### 9.2. Frontend Testleri (vitest)

```bash
cd frontend

# Tüm testleri çalıştır
npx vitest run

# Coverage raporu ile
npx vitest run --coverage

# İzleme modunda (dosya değişince otomatik çalışır)
npx vitest

# Tek bir test dosyasını çalıştır
npx vitest run src/components/MyComponent.test.tsx
```

### 9.3. Tümünü Birden Çalıştırma

```bash
make test
```

---

## 10. Sık Karşılaşılan Sorunlar

### Port Çakışması

**Sorun:** `Bind for 0.0.0.0:5432 failed: port is already allocated`

**Çözüm:** İlgili portu kullanan uygulamayı bulun ve kapatın:

```bash
# Windows (PowerShell)
netstat -ano | findstr :5432

# Linux / macOS
lsof -i :5432

# Veya docker-compose.yml'da portu değiştirin (ör. "5433:5432")
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

### Backend Başlamıyor

**Sorun:** Backend container sürekli yeniden başlıyor.

**Çözüm:**

```bash
# Logları kontrol et
docker compose logs backend

# Yaygın nedenler:
# 1. PostgreSQL henüz hazır değil — biraz bekleyin (health check var)
# 2. Migration hatası — logda hata mesajına bakın
# 3. Eksik ortam değişkeni — .env.example ile karşılaştırın
```

---

### Frontend Boş Sayfa

**Sorun:** `localhost:3000` açılıyor ama sayfa boş.

**Çözüm:**

```bash
# 1. Backend çalışıyor mu kontrol edin
curl http://localhost:8000/health

# 2. Tarayıcı konsolunu açın (F12) — JavaScript hatalarına bakın

# 3. Frontend'i yeniden build edin
docker compose up -d --build frontend
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

### Python Sanal Ortam Sorunu

**Sorun:** `ModuleNotFoundError` — paket bulunamıyor.

**Çözüm:**

```bash
# Sanal ortamın aktif olduğundan emin olun
# Komut satırında (.venv) yazıyor olmalı

# Windows (Git Bash):
source backend/.venv/Scripts/activate

# Bağımlılıkları yeniden kur
cd backend
pip install -e ".[dev]"
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
```

---

## 11. Proje Mimarisi

### Servis Bağlantı Şeması

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

### Veri Akışı

1. **Kullanıcı** tarayıcıda `localhost:3000` adresini açar
2. **nginx** (frontend container) statik dosyaları (HTML/JS/CSS) sunar
3. `/api/*` istekleri nginx tarafından **backend'e proxy** edilir
4. **FastAPI** isteği işler, gerekirse **PostgreSQL**'den veri çeker
5. Sık erişilen veriler **Redis** önbelleğinde saklanır
6. Yanıt aynı yoldan kullanıcıya döner

### 5 Proje Modülü

| Proje | Modül | Teknoloji |
|-------|-------|-----------|
| **P1** | Rüzgâr Kaynağı & AEP | PyWake, ERA5, Weibull, LCOE |
| **P2** | HV Şebeke Entegrasyonu | Pandapower, IEC 60909, FRT, STATCOM |
| **P3** | SCADA & Otomasyon | IEC 61850, GOOSE, Çalışma İzni |
| **P4** | AI Tahminleme | XGBoost, LSTM, TFT, SHAP |
| **P5** | Devreye Alma | Anahtarlama programı, LOTO, SAT |

### Teknoloji Yığını Özeti

```
Frontend:  React 19 + TypeScript (strict) + Tailwind v4 + Plotly.js + XYFlow + Zustand
Backend:   FastAPI + Python 3.13 + Pydantic v2 + SQLAlchemy async + Alembic
Database:  PostgreSQL 16 + TimescaleDB
Cache:     Redis 7
Container: Docker Compose
Linting:   ruff + mypy + ESLint + pre-commit
Test:      pytest + Vitest
CI/CD:     GitHub Actions + MkDocs (GitHub Pages) + Dependabot
```

---

## Hızlı Referans Kartı

```bash
# ─── En Sık Kullanılan Komutlar ────────────────────

# Her şeyi başlat
docker compose up -d --build

# Her şeyi durdur
docker compose down

# Logları takip et
docker compose logs -f

# Testleri çalıştır
make test

# Lint kontrolü
make lint

# Kodu biçimlendir
make format

# Temizlik
make clean
```

---

*Bu kılavuz Baltic Wind HV Control Platform projesi için hazırlanmıştır.*
*Sorularınız için `docs/` klasöründeki diğer dokümanlara başvurabilirsiniz.*
