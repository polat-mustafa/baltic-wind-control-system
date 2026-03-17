# Ders 001 — 510 MW Açık Deniz Rüzgar Simülasyon Platformu için DevOps Altyapısını İnşa Etmek

!!! abstract "Ders Navigasyonu"
    :material-arrow-left: **Önceki:** [Ders 000 — Proje Planlaması](lesson-000.md) | **Sonraki:** [Ders 002 — Uluslararasılaştırma (TR)](lesson-002.md) :material-arrow-right:

    **Faz:** P0 | **Dil:** Türkçe | **İlerleme:** 2 / 19 | [Tüm Dersler](index.md) | [Öğrenme Yol Haritası](../../Learning_Roadmap.md)

> **Tarih:** 2026-02-20
> **Commit'ler:** 14 commit (`f250002` → `9fc5c88`)
> **Commit aralığı:** `f2500024193bb88db74d1269612cd7c14fbe0614..9fc5c88d5b74a1070aae0c1c0a89b4cac8704cb0`
> **Faz:** P0 (DevOps Altyapısı)
> **Önceki ders:** Yok
> **last_commit_hash:** 9fc5c88d5b74a1070aae0c1c0a89b4cac8704cb0

---

## Ne Öğreneceksiniz

- Tam yığın (full-stack) endüstriyel bir simülasyon platformu (FastAPI + React + PostgreSQL + Redis) için monorepo nasıl yapılandırılır
- Bir CI/CD (sürekli entegrasyon/sürekli dağıtım) hattının neden herhangi bir alan mantığından önce profesyonel bir mühendislik ekibinin inşa ettiği ilk şey olduğu
- Docker Compose'un sağlık denetimleri ve bağımlılık sıralama ile çok servisli mimarileri nasıl yönettiği
- Açık kaynak projelerinde neden otomatik güvenlik taramasının önemli olduğu ve gizli bilgi tarayıcısının nasıl inşa edileceği
- Dependabot ve ön-commit (pre-commit) kancalarının kod kalitesi için nasıl "derinlemesine savunma" stratejisi oluşturduğu

---

## Bölüm 1: Dokümantasyon Mimarisi — Projenin Tek Doğru Kaynağı

### Gerçek Hayattan Bir Problem

Görevinize bir deniz üstü rüzgar çiftliğinde devreye alma (commissioning) mühendisi olarak başladığınızı hayal edin. Tek bir anahtara dokunmadan önce *İstasyon El Kitabı*'na ihtiyacınız vardır — gerilim seviyelerini, koruma rölesi ayarlarını, kablo kapasitelerini ve acil durum prosedürlerini anlatan tek belge. Onsuz, tahmin yürütürsünüz. Yazılım projeleri de aynıdır: net ve yetkili belgeler olmadan, her geliştirici sistemin nasıl çalışması gerektiği konusunda farklı tahminler yürütür.

### Standartlar Ne Diyor

Dokümantasyonumuz, **IEC 61355** hiyerarşik belge yapısını izlemektedir — ayrıntılar için [belge felsefesine](index.md#document-philosophy-iec-61355) bakın. Temel ilke: hepsini yöneten tek bir yol haritası ve izlenebilirlik için arşivlenmiş sürümler.

### Ne İnşa Ettik

**Değiştirilen dosyalar:**
- `CLAUDE.md` — Yapay zeka asistanı için projenin "istasyon el kitabı": her oturumda referansları otomatik olarak yükler
- `docs/Project_Roadmap.md` — v1 ve v2'yi tek bir yetkili kaynakta birleştiren konsolide şartname (1.646 satır)
- `docs/SKILL.md` — Mühendislik standartları ve kodlama kuralları (722 satır)
- `docs/Learning_Roadmap.md` — 32 haftalık öz çalışma müfredatı
- `docs/archive/Project_Roadmap_v1.md` ve `docs/archive/Project_Roadmap_v2.md` — İzlenebilirlik için saklanan tarihsel sürümler
- `.gitignore` — Oluşturulan dosyaları, gizli bilgileri ve büyük veriyi sürüm kontrolünün dışında tutar

Kısmen birbiriyle çelişen iki yol haritası belgemiz vardı (v1 ve v2). v2 belgesi, türbin sayılarını düzelten, dinamik simülasyon gereksinimlerini ekleyen ve standart referanslarını güncelleyen bir "boşluk analizi"ydi. Her okuyucuyu ikisini zihinsel olarak birleştirmeye zorlamak yerine, tek bir `Project_Roadmap.md` içinde konsolide ettik ve orijinalleri arşivledik.

### Neden Önemli

> **Neden** ayrı v1 ve v2 belgeleri yerine tek bir konsolide yol haritasına ihtiyacımız var?
> Çünkü belirsizlik projeleri öldürür. Bir belgede 30 türbin, diğerinde 34 yazıyorsa, yerleşim optimizörünü uygulayan bir geliştirici rastgele birini seçer — ve aşağı akıştaki hesaplamaların yarısı yanlış olur. Tek bir doğru kaynak bu tür hataları tamamen ortadan kaldırır.
>
> **Neden** eski sürümleri silmek yerine arşivledik?
> İzlenebilirlik. Gerçek rüzgar çiftliği projelerinde, her tasarım değişikliği izlenir (IEC 61400-1, bir "tasarım temeli" denetim izi gerektirir). Arşivleme, kararların *neden* değiştiğini görmemizi sağlar — örneğin, 30 × 17 MW'dan 34 × 15 MW türbinlere geçiş, eğitimsel netlik tarafından yönlendirilen bir karardı (uyandırma analizi için daha gerçekçi bir dizi düzeni).

### Kod İncelemesi

`CLAUDE.md` oturum protokolü ve otomatik yüklenen referanslar, [Ders 000 — Bölüm 2](lesson-000.md#section-2-the-planning-documents-engineering-before-code)'de ayrıntılı olarak ele alınmaktadır. Temel içgörü: bir kontrol odası operatörünün vardiya tesliminde istasyon günlük defterini okuması gibi, her oturum aynı mühendislik bağlamıyla başlar.

`.gitignore` de aynı derecede önemlidir — gizli bilgilerin, hava verilerinin (ERA5 NetCDF dosyaları gigabayt boyutlarına ulaşabilir) ve derleme çıktılarının yanlışlıkla commit edilmesini önler:

```gitignore
# ERA5 weather data (too large for git)
*.nc
*.grib
*.grib2

# Secrets — NEVER commit
.env
.env.*
!.env.example
```

Bu kalıplar bizi açık kaynak projelerde en yaygın hatalardan korur: API anahtarları sızdırılması ve depoyu ikili verilerle şişirmek.

!!! tip "Temel Kavram: Tek Doğru Kaynak (SSOT — Single Source of Truth)"
    **Sade bir dille:** Birbiriyle çelişebilecek beş farklı belgeye dağılmış bilgi yerine, hepsini tek bir yerde toplamak. Biri "kaç türbin var?" diye sorduğunda bakılacak tam olarak bir yer var ve her zaman doğru cevabı veriyor.

    **Benzetme:** Telefonunuzun kişiler uygulamasını düşünün. Üç farklı adres defteriniz olduğunu ve arkadaşınızın numarasının her birinde farklı göründüğünü hayal edin. Hangisinin doğru olduğunu bulmakla zaman harcarsınız. SSOT demek, tek bir kişiler uygulaması, tek bir numara — her zaman doğru demektir.

    **Bu projede:** [`docs/Project_Roadmap.md`](../../Project_Roadmap.md), 510 MW'lık rüzgar çiftliğinin tüm şartnamesi için SSOT'tur. Her türbin sayısı, kablo gerilimi ve şebeke kodu referansı orada yaşar. P1'in yerleşim optimizörünü kodlarken türbin özelliklerini bu tek belgeden okuyacağız — asla arşivlenmiş v1 veya v2'den değil.

---

## Bölüm 2: FastAPI Backend İskeleti — İlk Mikro Servisiniz

### Gerçek Hayattan Bir Problem

Bir ev inşa ettiğinizi hayal edin. Tesisat veya elektrik kurmadan önce temeli döküp çerçeveyi yükseltirsiniz. Çerçeve henüz bir şey *yapmaz* — sadece duvarların nerede olacağını tanımlar. Bir backend iskeleti de aynıdır: tüm gelecekteki alan mantığının (uyandırma modelleri, güç akışı simülasyonları, tahmin API'leri) bağlanacağı yapısal çerçevedir.

### Standartlar Ne Diyor

**IEC 62443 (Endüstriyel iletişim ağları — Ağ ve sistem güvenliği)**, SCADA ve kontrol sistemlerinin ilk günden itibaren açıkça tanımlanmış bir güvenlik mimarisine sahip olmasını gerektirir — sonradan eklenemez. `/health` uç noktamız basit olsa da, şu an kurduğumuz CORS ara yazılımı (middleware), ortam tabanlı yapılandırma ve konteyner izolasyonu, P3'te gerçek SCADA arayüzünü inşa ettiğimizde güvenli API erişiminin temeli olacak.

### Ne İnşa Ettik

**Değiştirilen dosyalar:**
- `backend/app/main.py` — Sağlık uç noktası ve CORS ara yazılımı ile FastAPI uygulaması
- `backend/app/config.py` — Ortam tabanlı yapılandırma için Pydantic Settings
- `backend/pyproject.toml` — Tüm bağımlılıklar ve araç yapılandırmaları ile Python paket tanımı
- `backend/tests/test_health.py` — İlk test: sağlık uç noktasının çalıştığını kanıtlar
- `backend/Dockerfile` — Backend servisi için konteyner görüntüsü tanımı

Backend kasıtlı olarak minimalisttir. Tam olarak bir uç noktası (`/health`) ve bir yapılandırma sınıfı vardır. Ama neyi *zaten* içerdiğine dikkat edin: CORS ara yazılımı (React, FastAPI ile konuştuğunda gerekli), asenkron veritabanı sürücüsü (asyncpg) ve katı tür denetimi (sıkı modda mypy). Bunlar erken değil — her şeyin üzerine bağlandığı yapısal çeliktir.

### Neden Önemli

> **Neden** rüzgar simülasyonu API'lerine doğrudan atlamak yerine bir `/health` uç noktasıyla başlıyoruz?
> Çünkü Docker, Kubernetes ve CI hatları, trafiği yönlendirmeden önce "bu servis çalışıyor mu?" diye sormanın bir yoluna ihtiyaç duyar. `/health` uç noktası, servisin kalp atışıdır. Onsuz, konteyner orkestratörünüz çökmüş bir servisi yavaş olandan ayırt edemez — ve gerçek bir SCADA sisteminde bu ayrım, kontrollü kapanma ile karartma arasındaki farka eşittir.
>
> **Neden** ortam değişkenlerini doğrudan `os.getenv()` ile okumak yerine Pydantic Settings kullanıyoruz?
> Tip güvenliği ve doğrulama. `os.getenv("DATABASE_URL")`, `Optional[str]` döndürür — `None`'ı kendiniz kontrol etmeniz, tamsayıları manuel olarak dönüştürmeniz ve listeleri elle ayrıştırmanız gerekir. Pydantic Settings tüm bunları otomatik olarak yapar; gerekli bir değişken eksikse net hata mesajları verir. Açık deniz rüzgar kontrol sisteminde, yanlış yapılandırılmış bir veritabanı URL'si başlangıçta gürültülü biçimde başarısız olmalı, gece 3'te fırtına sırasında sessizce değil.

### Kod İncelemesi

Yapılandırma modülü "12 Faktörlü Uygulama" ilkesini gösterir — yapılandırma kodda değil, ortamda yaşar:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",           # Load from .env file in development
        env_file_encoding="utf-8",
        case_sensitive=False,       # DATABASE_URL and database_url both work
    )

    # Application
    app_name: str = "Baltic Wind HV Control Platform"
    debug: bool = False

    # Database (PostgreSQL + TimescaleDB)
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/balticwind"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

settings = Settings()
```

Her alanın yerel geliştirme için bir varsayılanı vardır; ancak üretimde (Docker Compose, Kubernetes) ortam değişkenleri bunları geçersiz kılar. `cors_origins` alanı bir `list[str]`'dir ve Pydantic, `'["http://localhost:3000"]'` JSON dizesini otomatik olarak ayrıştırır — manuel ayrıştırma gerekmez.

Sağlık denetimi testi, ilk "duman testi"mizdir — uygulamanın başlayıp yanıt verebildiğini kanıtlar:

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_returns_ok():
    """GET /health should return 200 with status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

Bu test, her push'ta CI'da çalışır. Uygulama başlamazsa (içe aktarma hatası, eksik bağımlılık, yapılandırma çökmesi), bu test üretimde değil saniyeler içinde yakalar.

!!! tip "Temel Kavram: 12 Faktörlü Uygulama — Yapılandırma Ortamda"
    **Sade bir dille:** Parolaları, veritabanı adreslerini veya API anahtarlarını asla doğrudan kodunuza yazmayın. Bunun yerine, kodunuz bunları bilgisayarın ortamından okur (ortam değişkenleri gibi) ve bu değerleri dizüstü bilgisayarınızda ile üretimde farklı biçimde ayarlarsınız.

    **Benzetme:** Bir binadaki ana anahtar sistemini düşünün. Kilit mekanizması (kod) her yerde aynıdır, ancak anahtar (yapılandırma) kimin eriştiğine göre değişir. Temizlik görevlisinin CEO'dan farklı bir anahtarı var, ama kapılar aynı şekilde çalışıyor.

    **Bu projede:** `config.py`'miz geliştirme için `postgresql+asyncpg://postgres:postgres@localhost:5432/balticwind` kullanır, ancak Docker Compose bunu `postgres:postgres@postgres:5432/balticwind` ile geçersiz kılar (not: `postgres`, `localhost` değil Docker servis adıdır). Gerçek bir dağıtımda, bir gizli bilgi yöneticisi uygun bir parola enjekte eder.

---

## Bölüm 3: Docker Compose — Kontrol Odasını Yönetmek

### Gerçek Hayattan Bir Problem

Bir rüzgar çiftliği kontrol sistemi tek bir bilgisayarda çalışmaz. SCADA sunucusu tarih veritabanıyla konuşur, o zaman serisi deposuyla konuşur, o da HMI ekranlarıyla konuşur. HMI'ı veritabanı hazır olmadan başlatırsanız çöker. Veritabanı ağ yapılandırılmadan başlarsa bağlantı kabul edemez. Bir *orkestratöre* ihtiyacınız var — servisleri doğru sırayla başlatan ve bir sonrakini başlatmadan önce her birinin sağlıklı olduğunu denetleyen bir şey.

### Standartlar Ne Diyor

**IEC 62351 (Güç sistemleri yönetimi ve ilgili bilgi alışverişi — Veri ve iletişim güvenliği)**, SCADA sistemleri için ağ bölümlendirmesini ve servis izolasyonunu vurgular. Docker konteynerleri süreç düzeyinde izolasyon sağlar — her servis kendi ad alanında kendi dosya sistemiyle çalışır ve iletişim yalnızca açıkça bildirilen portlar üzerinden gerçekleşir. Bu, IEC 62443'te tanımlanan ağ bölgelerinin (DMZ, Kontrol Bölgesi, Saha Bölgesi) hafif bir versiyonudur.

### Ne İnşa Ettik

**Değiştirilen dosyalar:**
- `docker-compose.yml` — Dört servisli yığın: PostgreSQL+TimescaleDB, Redis, FastAPI backend, React frontend

Docker Compose dosyası, tüm geliştirme ortamımızı kod olarak tanımlar. `healthcheck` bloklarına ve `depends_on` koşullarına dikkat edin:

```yaml
services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    environment:
      POSTGRES_DB: balticwind
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

### Neden Önemli

> **Neden** düz PostgreSQL yerine TimescaleDB kullanıyoruz?
> Çünkü rüzgar çiftliği verisi temelde *zaman serisi* verisidir. Her 10 saniyede bir, 34 türbinin her biri güç çıkışını, rüzgar hızını, kanat adımını, kule başlığı sapmasını ve jeneratör sıcaklığını raporlar. Bu dakikada binlerce veri noktasıdır. TimescaleDB, PostgreSQL'i hiper tablolarla genişletir — zaman serisi eklemeleri ve aralık sorguları için optimize edilmiş, otomatik olarak bölümlenmiş tablolar. P1'de ERA5 hava verilerini ve simüle güç çıkışını depoladığımızda, "son 24 saatte türbin başına ortalama güç çıkışı" gibi sorgular standart PostgreSQL'den 10-100 kat daha hızlı çalışacak.
>
> **Neden** backend `depends_on`'u yalnızca `depends_on: [postgres]` yerine `condition: service_healthy` kullanıyor?
> Çünkü "konteyner başladı" ile "servis hazır" aynı şey değildir. PostgreSQL'in veri dizinini başlatması, WAL kurtarmasını çalıştırması ve bağlantı kabul etmeye başlaması birkaç saniye alır. `service_healthy` olmadan backend, bu başlatma penceresinde PostgreSQL'e bağlanmayı dener, "bağlantı reddedildi" hatası alır ve çökebilir. `pg_isready` sağlık denetimi, backend'in yalnızca PostgreSQL gerçekten sorgu kabul ettikten sonra başlamasını sağlar.

### Kod İncelemesi

Sağlık denetimi kalıbı incelemeye değer çünkü P3'te (SCADA izleme) bunu kapsamlı biçimde kullanacağız:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]  # Run this command inside the container
  interval: 5s    # Check every 5 seconds
  timeout: 5s     # If the check takes >5s, consider it failed
  retries: 5      # After 5 consecutive failures, mark container as unhealthy
```

Bu, gerçek endüstriyel sistemlerde kullanılan kalıbın aynısıdır. Koruma röleleri devre kesici durumunu her birkaç yüz milisaniyede bir denetler. Bir kesici zaman aşımı içinde yanıt vermezse, röle tırmanır — önce alarm, sonra gezinti komutu. Docker sağlık denetimlerimiz aynı kalıbın basitleştirilmiş bir versiyonudur: anket → zaman aşımı → yeniden deneme → tırmanma.

Sağlık denetimi başlangıç dizisi görselleştirilmiş:

```mermaid
sequenceDiagram
    participant DC as Docker Compose
    participant PG as PostgreSQL
    participant RD as Redis
    participant BE as Backend (FastAPI)
    participant FE as Frontend (React)

    DC->>PG: Start container
    DC->>RD: Start container
    loop Every 5s
        DC->>PG: pg_isready -U postgres
        PG-->>DC: not ready
    end
    PG-->>DC: ready (healthy)
    loop Every 5s
        DC->>RD: redis-cli ping
    end
    RD-->>DC: PONG (healthy)
    DC->>BE: Start (depends_on: healthy)
    BE->>PG: Connect asyncpg
    BE->>RD: Connect redis
    BE-->>DC: /health → 200 OK
    DC->>FE: Start (depends_on: backend)
    FE->>BE: API requests
```

!!! tip "Temel Kavram: Servis Orkestrasyonu ve Sağlık Denetimleri"
    **Sade bir dille:** Birbirine bağımlı birden fazla programınız olduğunda, onları doğru sırayla başlatan ve bir sonrakini başlatmadan önce her birinin gerçekten çalıştığından emin olan bir sisteme ihtiyacınız var.

    **Benzetme:** Bir restoran mutfağını düşünün. Hazırlık aşçısı önce sebzeleri doğrar, sonra ızgara aşçısı pişirmeye başlar. Izgara aşçısı, hazırlık tamamlanana kadar kızartmaya başlamaz — ve başaşçı hazırlığın gerçekten hazır olduğunu denetler, sadece hazırlık aşçısının geldiğini değil. Docker Compose başaşçıdır.

    **Bu projede:** FastAPI backend'imiz PostgreSQL ve Redis olmadan çalışamaz. Docker Compose, backend başlamadan önce PostgreSQL'in bağlantı kabul ettiğini (`pg_isready`) ve Redis'in `ping`'e yanıt verdiğini sağlar. P2'nin Pandapower şebeke çözücüsünü eklediğimizde, simülasyonları çalıştırmadan önce backend'in sağlıklı olmasına bağımlı olarak aynı kalıbı izleyecek.

---

## Bölüm 4: CI/CD Hattı ve Kalite Kapıları — Otomatik Denetçi

### Gerçek Hayattan Bir Problem

Açık deniz rüzgar çiftliğinde, her ekipman kurulumdan önce kalite denetiminden geçer. Bir transformatör fabrikayı rutin test yapılmadan çıkmaz. Bir kablo megger testi yapılmadan çekilmez. İlke basittir: *hataları alana ulaşmadan önce yakalayın, çünkü onları açık denizde düzeltmek 10 kat daha maliyetlidir.* CI/CD (sürekli entegrasyon/dağıtım) aynı ilkeyi koda uygular: hataları üretime ulaşmadan önce yakalayın.

### Standartlar Ne Diyor

**IEC 61400-1 (Rüzgar enerjisi üretim sistemleri — Tasarım gereksinimleri)**, rüzgar türbini kontrol yazılımı için resmi bir doğrulama ve geçerleme süreci zorunlu kılar. Simülasyonumuz güvenlik açısından kritik olmasa da aynı disiplini benimsiyoruz: her kod değişikliği birleştirilmeden önce otomatik lint denetimlerini, tip denetimlerini ve testleri geçmelidir. Bu derinlemesine savunmadır — her biri farklı hata sınıflarını yakalayan birden fazla bağımsız kalite kapısı.

### Ne İnşa Ettik

**Değiştirilen dosyalar:**
- `.github/workflows/ci.yml` — Dört paralel CI işi: backend lint, backend test, frontend lint, frontend test
- `.github/workflows/docs.yml` — GitHub Pages'e otomatik MkDocs dağıtımı
- `.pre-commit-config.yaml` — Her commit'ten önce çalışan yerel kalite kapıları
- `.editorconfig` — Editörler arası tutarlı biçimlendirme (sekme genişliği, satır sonları, sondaki boşluklar)
- `Makefile` — Kurulum, lint, test, docker ve docs için 15'ten fazla hedefle evrensel görev çalıştırıcı
- `.github/dependabot.yml` — pip, npm ve GitHub Actions için otomatik haftalık bağımlılık güncellemeleri

CI hattı, her push ve PR'da dört işi paralel olarak çalıştırır:

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Backend Lint │   │ Backend Test │   │ Frontend Lint│   │Frontend Test │
│  ruff check  │   │   pytest     │   │  tsc --noEmit│   │  vitest run  │
│  ruff format │   │   coverage   │   │  eslint      │   │  coverage    │
│  mypy        │   │              │   │              │   │              │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

### Neden Önemli

> **Neden** lint ve test'i sıralı çalıştırmak yerine farklı işlere ayırıyoruz?
> Paralellik ve izolasyon. Lint başarısız olursa, hemen bilmek istersiniz — önce 5 dakikalık bir test paketinin bitmesini beklemeyin. Ve bir test başarısız olursa, bunun bir mantık hatası mı (test işi) yoksa bir stil ihlali mi (lint işi) olduğunu bilmek istersiniz, ikisini aynı anda hata ayıklamayın. Güç sistemlerinde bu, aşırı akım ve toprak arızası için ayrı koruma röleleri bulundurmanın aynı ilkesidir — her biri belirli bir sorun sınıfını izler.
>
> **Neden** hem ön-commit kancaları hem de CI kullanıyoruz?
> Derinlemesine savunma. Ön-commit kancaları, commit oluşturulmadan *önce* sorunları yakalar — dizüstü bilgisayarınızda anında geri bildirim alırsınız. CI sorunları push'tan *sonra* yakalar — kodun temiz bir ortamda çalıştığını doğrular (yalnızca belirli Python sürümü ve kurulu paketleriyle sizin makinenizde değil). Birlikte, iki bağımsız kalite kapısı oluştururlar; tıpkı bir rüzgar türbininin artıklık için hem mekanik hem de aerodinamik freni olduğu gibi.

### Kod İncelemesi

Makefile dikkat çekmeye değer çünkü geliştiricinin günlük sürücüsüdür — tüm yaygın görevler için tek giriş noktası:

```makefile
lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Lint Python code (ruff + mypy)
	cd backend && ruff check app/ tests/
	cd backend && ruff format --check app/ tests/
	cd backend && mypy app/

test: test-backend test-frontend ## Run all tests

test-backend: ## Run Python tests with coverage
	cd backend && pytest --cov=app --cov-report=term-missing tests/
```

Her hedefin ardından `## ` yorumlarına dikkat edin — bunlar öz-dokümantasyon sağlar. `make help` çalıştırmak, tüm mevcut hedeflerin biçimlendirilmiş bir listesini yazdırır. Bu, geliştirici deneyimini büyük ölçüde iyileştiren küçük bir ayrıntıdır: kimsenin hangi komutların mevcut olduğunu öğrenmek için Makefile'ı okuması gerekmez.

Ön-commit yapılandırması birden fazla aracı zincirler — her biri farklı bir hata sınıfını yakalar. `check-yaml`, CI iş akışınızdaki bir sözdizimi hatası bulursa, GitHub'a bozuk YAML göndermeden *önce* commit'i engeller.

??? example "Tam ön-commit yapılandırması"

    ```yaml
    repos:
      - repo: https://github.com/pre-commit/pre-commit-hooks
        hooks:
          - id: trailing-whitespace        # Catches: invisible formatting errors
          - id: end-of-file-fixer          # Catches: POSIX compliance issues
          - id: check-yaml                 # Catches: broken YAML syntax (CI configs!)
          - id: check-added-large-files    # Catches: accidentally committed binaries
            args: ['--maxkb=1000']         # Block files > 1 MB
          - id: check-merge-conflict       # Catches: forgotten merge conflict markers

      - repo: https://github.com/astral-sh/ruff-pre-commit
        hooks:
          - id: ruff                       # Catches: Python code quality issues
            args: [--fix]                  # Auto-fix what it can
          - id: ruff-format               # Catches: inconsistent formatting
    ```

Derinlemesine savunma hattı:

```mermaid
graph LR
    Dev["Developer<br/>writes code"] --> PC["Pre-commit<br/>Hooks"]
    PC -->|"ruff, mypy,<br/>eslint"| Push["git push"]
    Push --> CI["GitHub Actions<br/>CI Pipeline"]
    CI -->|"4 parallel<br/>jobs"| Sec["Security<br/>Audit Skill"]
    Sec -->|"13 secret<br/>patterns"| Merge["Merge to<br/>main"]

    style PC fill:#4a9eff,color:#fff
    style CI fill:#4a9eff,color:#fff
    style Sec fill:#4a9eff,color:#fff
```

!!! tip "Temel Kavram: Derinlemesine Savunma — Birden Fazla Bağımsız Kalite Kapısı"
    **Sade bir dille:** Yalnızca tek bir güvenlik denetimine güvenmeyin. Farklı aşamalarda, her biri farklı sorunları arayan birden fazla denetim bulundurun. Biri bir şeyi kaçırırsa, bir sonraki yakalar.

    **Benzetme:** Havalimanı güvenliğini düşünün. Bir metal dedektöründen geçersiniz (ön-commit kancası), sonra çantanız X-ray tarayıcısından geçer (CI hattı) ve bir kişi pasaportunuzu görsel olarak denetler (kod incelemesi). Her katman diğerlerinin kaçırabileceği şeyleri yakalar. Tek bir katman mükemmel değildir, ama birlikte çok etkilidirler.

    **Bu projede:** Bir geliştirici kod yazar → ön-commit kancaları yerel olarak biçimlendirme ve tipleri denetler → CI temiz bir ortamda tam test paketini çalıştırır → github-push becerisi push'tan önce gizli bilgileri tarar. Her biri farklı bir hata sınıfını yakalayan üç bağımsız kapı. P3'ün SCADA otomasyonunu inşa ettiğimizde, koruma rölesi koordinasyonunda aynı kalıbı göreceğiz: birincil koruma, yedek koruma ve kesici arıza koruması.

---

## Bölüm 5: Güvenlik Sertleştirme — Push Kapı Bekçisi

### Gerçek Hayattan Bir Problem

Bir kontrol odası operatörü olduğunuzu ve birinin sizden bir devre kesiciyi kapatmanızı istediğini hayal edin. Bunu yapmadan önce kontrol edersiniz: Hat enerjisiz mi? Topraklama anahtarı çıkarıldı mı? Geçerli bir anahtarlama programı var mı? Sadece biri istedi diye kesiciyi kapatmazsınız — önce koşulları doğrularsınız. github-push becerisi de aynıdır: sızdırılan gizli bilgileri, tehlikeli dosyaları ve kod kalite sorunlarını kodun genel depoya ulaşmasına izin vermeden önce denetler.

### Standartlar Ne Diyor

**OWASP Top 10** ve **CWE-798 (Sabit Kodlanmış Kimlik Bilgilerinin Kullanımı)**, sabit kodlanmış gizli bilgileri yazılımdaki en yaygın ve tehlikeli güvenlik açıklarından biri olarak tanımlar. Açık kaynak bir proje için, genel bir GitHub deposuna veritabanı parolası veya API anahtarı göndermek, bunların tüm internete anında erişilebilir olması anlamına gelir. Güvenlik denetimimiz, bunları geliştirici makinesinden çıkmadan önce yakalamak için tasarlanmıştır.

### Ne İnşa Ettik

**Değiştirilen dosyalar:**
- `.claude/skills/github-push/SKILL.md` — Gizli bilgi tarayıcısı ve tehlikeli dosya tespiti ile 7 aşamalı güvenli push iş akışı
- Güvenlik sertleştirme: YAML parola kalıpları eklendi, izin verilen istisnalar listesi oluşturuldu, WARN öğeleri için zorunlu kullanıcı onayı getirildi

github-push becerisi, güvenlik kapısı olarak görev yapan 250 satırlık bir iş akışı tanımıdır. Yedi aşama çalıştırır: keşif (git durumu, fark, günlük, dal), güvenlik denetimi (gizli bilgi tarayıcısı, tehlikeli dosya tarayıcısı, kod kalitesi denetimleri), karar (BLOCK veya WARN), hazırlık (dosya bazında, asla `git add .` değil), commit mesajı biçimlendirme, push ve özet rapor.

### Neden Önemli

> **Neden** `.gitignore` zaten `.env` dosyalarının commit edilmesini engelliyorken otomatik bir gizli bilgi tarayıcısına ihtiyacımız var?
> Çünkü `.gitignore` yalnızca *listede bulunan* dosyaları kapsar. Bir geliştirici doğrudan Python koduna parola sabit kodlayabilir (`API_KEY = "sk-abc123..."`), ve `.gitignore` bunu yakalamaz — bu bir nokta dosyası değil, `.py` dosyasıdır. Gizli bilgi tarayıcısı, hangi dosyada olurlarsa olsunlar sabit kodlanmış gizli bilgileri yakalamak için farkın *içeriğini* aramak üzere regex kalıpları kullanır.
>
> **Neden** tüm WARN'ları görmezden gelmek yerine `docker-compose.yml` varsayılanları için "izin verilen istisnalar" ekledik?
> Nüans. `docker-compose.yml`'deki bir `POSTGRES_PASSWORD: postgres`, üretimde ortam değişkenleri tarafından geçersiz kılınan bir geliştirme varsayılanıdır — bu normaldir. Ama `POSTGRES_PASSWORD: my_real_production_password` gerçek bir sızıntıdır. Açık bir istisna listesi oluşturarak, belirli kalıpların neden kabul edilebilir olduğunu belgeliyoruz ve geliştiricinin bunları onaylamasını zorunlu kılıyoruz. Sessiz atlama yok — operatör beklenen bir uyarı olsa bile her zaman görür.

### Kod İncelemesi

Güvenlik denetimi, farklı risk kategorilerini tespit etmek için kalıp eşleştirme kullanır:

```markdown
| Pattern | Description | Action |
|---------|-------------|--------|
| `password\s*=\s*['"]` | Hardcoded password (code) | BLOCK |
| `PASSWORD[:=]\s*.+` (not in docker-compose) | Hardcoded password (config) | WARN |
| `sk-[a-zA-Z0-9]{20,}` | OpenAI/Anthropic API key | BLOCK |
| `ghp_[a-zA-Z0-9]{36}` | GitHub personal access token | BLOCK |
| `-----BEGIN.*PRIVATE KEY-----` | PEM private key | BLOCK |
```

BLOCK ve WARN arasındaki temel ayrım geri dönüşebilirliktir. BLOCK öğesi (sızdırılan API anahtarı) geri alınamaz — bir kez push edildiğinde, anahtar tehlikeye girer ve döndürülmelidir. WARN öğesi (geliştirme varsayılan parolası) kabul edilebilir ancak onaylanmalıdır. Bu, koruma rölesi felsefesini yansıtır: arızalar için anlık gezinti (BLOCK) ile anormal koşullar için zamanlı alarm (WARN).

Sertleştirme commit'i, Faz 0 sırasında karşılaşılan gerçek bir sorunu ele aldı: güvenlik tarayıcısı `POSTGRES_PASSWORD: postgres` içerdiği için `docker-compose.yml`'yi engelliyordu. Bu meşru bir geliştirme varsayılanıdır, gizli bilgi sızıntısı değil. Düzeltme, bağlama duyarlı istisnalar ekledi:

```markdown
**Allowed exceptions (WARN only, not BLOCK):**
- `docker-compose.yml` with `POSTGRES_PASSWORD: postgres` — local dev default
- `config.py` with `localhost` defaults — overridden in production
```

Bu önemli bir ders öğretir: güvenlik araçları kalibre edilmelidir, sadece açılmamalıdır. Çok katı olursa, geliştiriciler onları atlar. Çok gevşek olursa, gerçek sorunları kaçırırlar. Doğru nokta, belgelenmiş istisnalarla varsayılan olarak katıdır.

!!! tip "Temel Kavram: Sola Kaydırma Güvenliği — Sorunları Erken Yakalayın"
    **Sade bir dille:** Kod internette yayınlandıktan sonra güvenlik sorunlarını kontrol etmek yerine, mümkün olan en erken aşamada — ideal olarak kod bilgisayarınızdan çıkmadan önce — denetleyin.

    **Benzetme:** Yazarken yazım denetimi yapmak gibidir, mektubu gönderdikten sonra değil. Göndermeden önce bir hata fark ederseniz, sadece düzeltirsiniz. Sonra fark ederseniz, bir düzeltme göndermeniz gerekir ve alıcı hatayı zaten gördü.

    **Bu projede:** github-push becerisi, commit oluşturulmadan *önce* her farkı sabit kodlanmış gizli bilgiler için tarar. Kodda bir API anahtarı bulursa, push'u tamamen engeller. Bu kritiktir çünkü depomuz herkese açıktır — bir gizli bilgi bir kez GitHub'a push edildiğinde, sonraki commit'te dosyayı silseniz bile git geçmişinde sonsuza kadar kalır. Önleme, düzeltmeden sonsuz derecede daha iyidir.

---

## Bölüm 6: Otomatik Bağımlılık Yönetimi — Tedarik Zinciri Koruyucusu

### Gerçek Hayattan Bir Problem

Bir rüzgar türbininin yüzlerce tedarikçiden binlerce bileşeni vardır. Bir cıvata üreticisi bir partide hata keşfederse, bu cıvataları kullanan her türbinin denetlenmesi gerekir. Üretici bir geri çağırma bildirimi gönderir ve rüzgar çiftliği operatörü bakım programını günceller. Yazılım bağımlılıkları aynı şekilde çalışır: bir kütüphane güvenlik yaması yayınladığında, o kütüphaneyi kullanan her projenin güncellenmesi gerekir.

### Standartlar Ne Diyor

**NIST SP 800-53 (Güvenlik ve Gizlilik Kontrolleri)** SA-12 kontrolü, kuruluşların yazılım tedarik zincirlerini güvenlik açıkları için izlemesini ve zamanında yama uygulamasını gerektirir. Dependabot bunu, `pyproject.toml`, `package.json` ve GitHub Actions iş akışlarını haftalık tarayarak ve güncellemeler için pull request'ler açarak otomatikleştirir.

### Ne İnşa Ettik

**Değiştirilen dosyalar:**
- `.github/dependabot.yml` — pip, npm ve GitHub Actions güncellemeleri için haftalık otomatik denetimler
- Altı Dependabot PR'ı birleştirildi: GitHub Actions güncellemeleri (checkout v4→v6, setup-python v5→v6, setup-node v4→v6, cache v4→v5, upload-artifact v4→v6, upload-pages-artifact v3→v4)
- İki bağımlılık PR'ı: eslint-plugin-react-hooks 5.2.0→7.0.1, frontend paket güncellemeleri

Dependabot yapılandırması zarif biçimde basittir — tüm tedarik zincirini koruyan 32 satır:

??? example "Tam Dependabot yapılandırması"

    ```yaml
    version: 2
    updates:
      - package-ecosystem: "pip"
        directory: "/backend"
        schedule:
          interval: "weekly"
          day: "monday"
        labels: ["dependencies", "python"]
        commit-message:
          prefix: "[DEPS]"

      - package-ecosystem: "github-actions"
        directory: "/"
        schedule:
          interval: "weekly"
          day: "monday"
        labels: ["dependencies", "ci"]
        commit-message:
          prefix: "[CI]"
    ```

### Neden Önemli

> **Neden** eski sürümler hâlâ çalışıyorken GitHub Actions sürümlerini güncelliyoruz (checkout v4→v6)?
> Çünkü GitHub Actions yükseltilmiş izinlerle çalışır — depo gizli bilgilerinize erişebilir, kod gönderebilir ve üretime dağıtabilir. Bir action sürümündeki güvenlik açığı, tüm CI hattınızı tehlikeye atabilir. En son sürümde kalmak, en son güvenlik yamalarına sahip olmanızı sağlar. Güç sistemleri dünyasında bu, koruma rölelerindeki aygıt yazılımı güncellemelerine eşdeğerdir — röle eski aygıt yazılımıyla hâlâ çalışır, ancak bilinen güvenlik açıkları daha yeni sürümlerde düzeltilmiştir.
>
> **Neden** Dependabot farklı commit önekleri kullanıyor (actions için `[CI]`, paketler için `[DEPS]`)?
> İzlenebilirlik. Git günlüğünü taradığınızda, hangi commit'lerin altyapı güncellemeleri, bağımlılık güncellemeleri veya özellik kodu olduğunu anında görebilirsiniz. Bu kural, commit mesajı standardımızla doğrudan eşleşir ve değişiklik günlükleri oluşturmayı, bağımlılık değişikliklerini denetlemeyi ve geçmişi bir bakışta anlamayı kolaylaştırır.

### Kod İncelemesi

Birleştirilen gerçek Dependabot commit'lerine bakın:

```
f85f6c5 [CI]: Bump actions/upload-pages-artifact from 3 to 4 (#1)
2b5f3a0 [CI]: Bump actions/upload-artifact from 4 to 6 (#2)
c372942 [CI]: Bump actions/setup-node from 4 to 6 (#3)
59d9ebe [CI]: Bump actions/cache from 4 to 5 (#4)
0933057 [CI]: Bump actions/setup-python from 5 to 6 (#5)
376e572 [CI]: Bump actions/checkout from 4 to 6 (#6)
e9966d8 [DEPS]: Bump eslint-plugin-react-hooks from 5.2.0 to 7.0.1 (#7)
d32d82f [DEPS] Update frontend dependencies to latest compatible versions (#12)
```

Her PR, Dependabot tarafından otomatik olarak oluşturuldu, incelendi ve birleştirildi. `#1` ile `#7` arasındaki sayılar pull request numaralarıdır — Dependabot bunları açtı, CI bunlara karşı çalıştı ve testler geçince birleştirildi. Bu, tam otomatik bir tedarik zinciri güncelleme iş akışıdır: tespit et → öner → test et → birleştir.

!!! tip "Temel Kavram: Yazılım Tedarik Zinciri Güvenliği"
    **Sade bir dille:** Projeniz başkalarının yazdığı koda (kütüphaneler, çerçeveler, araçlar) bağımlıdır. Bu kodlardan herhangi birinde güvenlik hatası varsa, projeniz o hatayı miras alır. Tedarik zinciri güvenliği, tüm bağımlılıklarınızı takip etmek ve düzeltmeler mevcut olduğunda güncellemek anlamına gelir.

    **Benzetme:** Araç geri çağırmasını düşünün. Arabanız iyidir, ancak hava yastığı üreticisi bir hata buldu. Hava yastığı kodunu siz yazmadınız, ama yine de bayiye gidip düzeltme yaptırmanız gerekiyor. Dependabot, otomatik bir geri çağırma bildirim sistemi gibidir — sorunu size bildirir ve hatta randevuyu bile ayarlar (PR açar).

    **Bu projede:** FastAPI, React, PostgreSQL sürücülerine ve düzinelerce başka pakete bağımlıyız. Dependabot her Pazartesi yeni sürümleri denetler, güncellemelerle PR'lar açar ve CI hattımız bunları otomatik olarak test eder. İlk haftamızdaki altı GitHub Actions güncellemesi bunun çalıştığını gösterir: Dependabot actions/checkout için v6'nın mevcut olduğunu tespit etti, PR #6'yı açtı, CI geçti ve birleştirdik — tüm bunlar manuel müdahale olmadan.

---

## Bağlantılar

**Bu kavramların bir sonraki görüneceği yer:**

- **Sağlık denetimleri** (Bölüm 3) → P3 SCADA izlemesi, Docker sağlık kalıplarını tam türbin/trafo merkezi durum izlemesine genişletecek
- **Ortam tabanlı yapılandırma** (Bölüm 2) → P1'in aynı Pydantic Settings mekanizması aracılığıyla enjekte edilen ERA5 API kimlik bilgilerine ihtiyacı olacak
- **CI kalite kapıları** (Bölüm 4) → P1 uyandırma modeli testleri ve P2 güç akışı doğrulamaları tam olarak bu CI işlerinde çalışacak
- **Güvenlik tarama** (Bölüm 5) → P1+'da ERA5 API anahtarları ve veritabanı kimlik bilgileri aynı gizli bilgi tarayıcısı tarafından korunacak
- **Dependabot** (Bölüm 6) → PyWake, Pandapower ve ML kütüphanelerini eklediğimizde, Dependabot güvenlik güncellemelerini izleyecek

---

## Büyük Resim

*Bu dersin odağı: uygulama yığınını saran **DevOps katmanı**.*

```mermaid
graph TB
    subgraph APP["Application Stack"]
        FE["React 19 + TypeScript<br/>Port 3000"]
        BE["FastAPI + Python 3.13<br/>Port 8000 · /health ✓"]
        PG["PostgreSQL 16 + TimescaleDB<br/>Port 5432"]
        RD["Redis 7<br/>Port 6379"]
    end

    subgraph DEVOPS["DevOps Foundation (Built in This Lesson)"]
        Docker["Docker Compose<br/><i>4-service orchestration</i>"]
        CI["GitHub Actions CI<br/><i>4 parallel jobs</i>"]
        PC["Pre-commit Hooks<br/><i>ruff, mypy, eslint</i>"]
        Deps["Dependabot<br/><i>pip + npm + Actions</i>"]
        Sec["Security Audit Skill<br/><i>13 secret patterns</i>"]
        Make["Makefile<br/><i>15+ targets</i>"]
    end

    subgraph FUTURE["Future Modules (P1 → P5)"]
        P15["P1: PyWake · P2: Pandapower · P3: SCADA · P4: ML · P5: Commissioning"]
    end

    FE -->|REST API| BE
    BE --> PG
    BE --> RD
    Docker --> APP
    CI --> PC
    CI --> Deps
    CI --> Sec
    Make --> Docker
    FUTURE -.->|"built ON TOP of<br/>this foundation"| DEVOPS
```

---

## Temel Çıkarımlar

1. **Tek bir doğru kaynak belirsizliği ortadan kaldırır** — türbin sayıları ve gerilim seviyeleri için bakılacak tek bir yer: tek yol haritası, tek şartname.
2. **İlk kod satırı bir sağlık denetimi olmalıdır** — herhangi bir alan mantığından önce, servisin başlayıp yanıt verebildiğini kanıtlayın. Docker, Kubernetes ve CI buna bağlıdır.
3. **Yapılandırma ortama ait, koda değil** — Pydantic Settings, sıfır standart kod (boilerplate) ile tip güvenli, doğrulanmış yapılandırma sağlar.
4. **Docker Compose sağlık denetimleri yarış koşullarını önler** — `depends_on: condition: service_healthy`, servislerin yalnızca doğru sırayla değil, doğru koşullarda başlamasını sağlar.
5. **Derinlemesine savunma birden fazla bağımsız kalite kapısı anlamına gelir** — ön-commit kancaları sorunları yerel olarak yakalar, CI bunları temiz bir ortamda yakalar ve güvenlik tarama gizli bilgileri genel depoya ulaşmadan önce yakalar.
6. **Güvenlik araçları sadece açılmamalı, kalibre edilmelidir** — çok katı meşru kodu engeller (yanlış pozitifler), çok gevşek gerçek sorunları kaçırır. "İzin verilen istisnalar" kalıbı, belirli kalıpların neden kabul edilebilir olduğunu belgeler.
7. **Otomatik bağımlılık yönetimi tedarik zinciri güvenliğidir** — Dependabot, her hafta manuel olarak kontrol etmek zorunda kalmamanız için güncellemeleri izler, önerir ve test eder.

---

## Quiz — Anlayışınızı Test Edin

### Hatırlama Soruları

**S1:** Docker Compose yığınımızın tanımladığı dört servis nelerdir ve hangi portları kullanırlar?

<details>
<summary>Cevap</summary>

Yığın dört servis tanımlar: port 5432'de TimescaleDB ile PostgreSQL, port 6379'da Redis 7, port 8000'de FastAPI backend ve port 3000'de React frontend. PostgreSQL, `timescale/timescaledb:latest-pg16` görüntüsünü kullanır ve Redis, minimal ayak izi için `redis:7-alpine` kullanır.

</details>

**S2:** `pyproject.toml`'umuzda hangi ruff lint kuralı kategorileri etkinleştirilmiştir ve her kategori neyi denetler?

<details>
<summary>Cevap</summary>

Dokuz kategori etkinleştirilmiştir: E (pycodestyle hataları), W (pycodestyle uyarıları), F (pyflakes — kullanılmayan içe aktarmalar, tanımsız adlar), I (isort — içe aktarma sıralaması), N (pep8-naming — fonksiyon/sınıf adlandırma kuralları), UP (pyupgrade — Python sözdizimini modernleştir), B (flake8-bugbear — yaygın hatalar ve tasarım sorunları), SIM (flake8-simplify — gereksiz yere karmaşık kod) ve RUF (ruff'a özgü kurallar). Birlikte, stil sorunlarını, olası hataları ve modern Python özelliklerini kullanma fırsatlarını yakalarlar.

</details>

**S3:** github-push güvenlik denetiminde BLOCK ve WARN arasındaki fark nedir?

<details>
<summary>Cevap</summary>

BLOCK öğeleri, push'u tamamen engelleyen tıkanıklıklardır — genel bir depoya push edildikten sonra kalıcı olarak tehlikeye giren sızdırılan API anahtarları veya özel anahtarlar gibi geri dönüşü olmayan güvenlik riskleri gösterirler. WARN öğeleri, kullanıcı onayı gerektiren ancak kabul edilebilir olabilecek potansiyel endişelerdir — örneğin üretimde ortam değişkenleri tarafından geçersiz kılınan docker-compose.yml'deki geliştirme varsayılan parolaları gibi. WARN öğeleri her zaman kullanıcıya rapor edilir; asla sessizce atlanmaz.

</details>

### Anlama Soruları

**S4:** Backend'imiz neden `depends_on`'da yalnızca `depends_on: [postgres]` listelemek yerine `condition: service_healthy` kullanıyor? Bu hangi başarısızlık modunu önler?

<details>
<summary>Cevap</summary>

Yalnızca `depends_on: [postgres]` listelemek, yalnızca PostgreSQL konteynerinin *başladığını* sağlar, *bağlantı kabul etmeye hazır olduğunu* değil. PostgreSQL'in veri dizinini başlatması, WAL kurtarmasını çalıştırması ve TCP dinleyicisini açması birkaç saniye alır. Sağlık denetimi koşulu olmadan, FastAPI backend bu başlatma penceresi sırasında bağlanmayı dener, "bağlantı reddedildi" hatası alır ve PostgreSQL hazır olmadan önce potansiyel olarak çöker. `service_healthy` koşulu, backend'in yalnızca PostgreSQL gerçekten sorgu kabul ettikten sonra başlamasını sağlamak için `pg_isready` kullanır ve bu yarış koşulunu ortadan kaldırır.

</details>

**S5:** Neden hem ön-commit kancaları hem de CI hattı denetimleri kullanıyoruz? Biri yeterli olmaz mıydı?

<details>
<summary>Cevap</summary>

Derinlemesine savunma stratejisinde tamamlayıcı roller üstlenirler. Ön-commit kancaları geliştirici makinesinde anında çalışır, commit oluşturulmadan önce anında geri bildirim sağlar — bu, biçimlendirme sorunlarını ve tip hatalarını saniyeler içinde yakalar. Ancak kancalar atlanabilir (`--no-verify`) ve geliştirici yerel ortamında çalışırlar; bu da CI ortamından farklı olabilir. CI, temiz ve tekrarlanabilir bir ortamda (belirli Python/Node sürümleriyle Ubuntu) çalışır ve atlanamaz — yetkili kalite kapısıdır. Birlikte, rüzgar türbininin artıklık için hem mekanik hem de aerodinamik freni olduğu gibi, hızlı yerel geri bildirim VE güvenilir uzak doğrulama sağlarlar.

</details>

**S6:** Neden doğrudan `os.getenv()` kullanmak veya YAML yapılandırma dosyası yerine yapılandırma için Pydantic Settings'i tercih ettik?

<details>
<summary>Cevap</summary>

Pydantic Settings üç temel avantaj sağlar: tip güvenliği (`"5432"`'yi otomatik olarak tam sayıya, `'["http://localhost"]'`'yi listeye dönüştürür), doğrulama (gerekli bir değişken eksik veya hatalı biçimlendirilmişse, çalışma zamanında çökmek yerine başlangıçta gürültülü biçimde başarısız olur) ve dokümantasyon (Settings sınıfının kendisi, tüm mevcut yapılandırma seçeneklerini tipleri ve varsayılanları ile gösteren bir şema olarak hizmet eder). `os.getenv()`, her şey için `Optional[str]` döndürür; kod geneline yayılmış manuel tip dönüşümü ve boş denetimleri gerektirir. YAML yapılandırma dosyaları, ortama göre geçersiz kılınması daha zordur ve gizli bilgilerle birlikte commit edilme riski taşır. Pydantic Settings, 12 Faktörlü Uygulama ilkesini izler: ortamda yapılandırma, sınırda doğrulanmış.

</details>

### Meydan Okuma Sorusu

**S7:** Mevcut Docker Compose'umuz sabit kodlanmış bir geliştirme varsayılanı olarak `POSTGRES_PASSWORD: postgres` kullanıyor. Üç ortam için çalışan bir yapılandırma stratejisi tasarlayın: yerel geliştirme (basit, ek kurulum yok), CI/CD (otomatik, insan etkileşimi yok) ve üretim (güvenli, denetlenebilir). Her ortam veritabanı parolasını nasıl ayarlar ve hangi araçları veya mekanizmaları kullanırsınız?

<details>
<summary>Cevap</summary>

**Yerel geliştirme:** docker-compose.yml'de sabit kodlanmış `postgres:postgres` varsayılanını koruyun. Bu, geliştiriciler için bir kolaylıktır — ek kurulum yapmadan `docker compose up` çalıştırabilirler. Güvenlik denetimi, diğer ortamlarda geçersiz kılındığı için bunu açıkça bir WARN istisnası olarak kabul eder.

**CI/CD:** CI iş akışına ortam değişkenleri olarak enjekte edilen GitHub Actions gizli bilgilerini (`${{ secrets.DB_PASSWORD }}`) kullanın. Parola GitHub'ın ayarlarında şifreli olarak saklanır, günlüklerde asla görünmez (GitHub otomatik olarak maskeler) ve yalnızca depoda çalışan iş akışlarına açıktır. docker-compose.yml, değişken interpolasyonu kullanır: `POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}` — değişken ayarlanmamışsa (yerel geliştirme) `postgres`'e varsayılan olarak döner ama ayarlandığında gizli bilgiyi kullanır (CI).

**Üretim:** Konteyner başlangıcında kimlik bilgilerini enjekte eden bir gizli bilgi yöneticisi (AWS Secrets Manager, HashiCorp Vault veya Azure Key Vault) kullanın. Kubernetes dağıtımı, gizli bilgiyi SecretProviderClass (CSI sürücüsü) veya Kubernetes Secret aracılığıyla bir ortam değişkeni olarak bağlar. Parola, bir programa göre gizli bilgi yöneticisi tarafından otomatik olarak döndürülür ve tüm erişim denetlenebilirlik için kaydedilir. Uygulama, `DATABASE_URL`'yi ortamdan okur (Pydantic Settings bunu halleder), dolayısıyla kod değişikliği gerekmez — yalnızca dağıtım yapılandırması ortamlar arasında farklılık gösterir.

Bu katmanlı yaklaşım, en az ayrıcalık ilkesini izler: geliştiriciler kolaylık, CI otomasyon ve üretim güvenlik alır — hepsi farklı yapılandırma mekanizmaları ile aynı uygulama kodunu kullanarak.

</details>

---

## Mülakat Köşesi

### Sade Bir Dille Açıklayın
*"Rüzgar çiftliği simülasyonu için DevOps altyapısını bir mühendis olmayan birine nasıl açıklarsınız?"*

Baltık Denizi'nde büyük bir rüzgar çiftliğinin bilgisayar simülasyonunu oluşturuyoruz — küçük bir şehir için yeterli elektrik üreten 34 kocaman türbin. İlginç şeyleri yazabilmeden önce (türbinler arasında rüzgar nasıl akar, elektrik kablolar boyunca nasıl hareket eder, yarınki güç çıkışı nasıl tahmin edilir), atölyemizi kurmamız gerekiyor.

Bir ev inşa etmek gibi düşünün. Mutfak aletlerini kurmadan veya perdeleri asmadan önce temele, çerçeveye, tesisata ve elektrik tesisatına ihtiyacınız var. Biz bu aşamada tam olarak bunu yaptık. Dijital atölyemizde dört "oda" kurduk: veri depolamak için bir veritabanı (dosya dolabı gibi), sık kullanılan verilere hızlı erişim için bir önbellek (beyaz tahta gibi), hesaplamaları yapan bir backend sunucu (mühendis masası gibi) ve sonuçları görüntüleyen bir frontend (kontrol odası ekranları gibi). Ayrıca, bir değişiklik yaptığımızda her seferinde çalışmamızı denetleyen ve hata eklemediğimizden veya yanlışlıkla parolaları yayınlamadığımızdan emin olan bir otomatik denetçi de kurduk. Son olarak, bağımlı olduğumuz araçlardan herhangi birinin güncellenip güncellenmediğini denetleyen ve araç parçaları için geri çağırma bildirimleri almak gibi otomatik bir sistem ekledik.

### Teknik Olarak Açıklayın
*"Faz 0 DevOps altyapısını bir işe alım paneline nasıl açıklarsınız?"*

Üretim kalitesinde bir monorepo altyapısı oluşturduk: FastAPI backend (Python 3.13, Pydantic v2, SQLAlchemy async), React 19 frontend (TypeScript strict, Tailwind v4) ve Docker Compose aracılığıyla yönetilen servisler (PostgreSQL 16 + TimescaleDB, Redis 7).

CI/CD (sürekli entegrasyon/dağıtım) hattı derinlemesine savunmayı uygular: yerel geri bildirim için ön-commit kancaları (ruff, mypy, ESLint), temiz ortam doğrulaması için GitHub Actions (bağımlılık önbellekli dört paralel iş) ve gizli bilgi tarama için BLOCK/WARN sınıflandırması ile özel güvenlik denetim becerisi. Dependabot, pip, npm ve GitHub Actions ekosistemlerinde haftalık olarak tedarik zinciri yönetimini otomatikleştirir.

Tüm yapılandırma, Pydantic Settings aracılığıyla 12 Faktörlü Uygulama ilkelerini izler — yalnızca yapılandırma değişiklikleriyle ortamlar arası özdeş uygulama kodu. Bu temel, P1-P5'i doğrudan destekler: ERA5 hava verileri için TimescaleDB, simülasyon önbellekleme için Redis ve uyandırma modelleri ile güç akışı hesaplamalarının IEC standartlarına karşı otomatik doğrulanması için CI.
