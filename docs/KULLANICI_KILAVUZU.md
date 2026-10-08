# Kullanıcı Kılavuzu

**OffshoreForge**: 510 MW'lık bir Baltık Denizi açık deniz rüzgâr çiftliği simülasyonu
(34 × Vestas V236-15.0 MW, 66 kV iç dizi, 76,5 km 220 kV ihraç kablosu, PSE 400 kV şebekesi).

## 1. Gereksinimler

| Yöntem | Gerekli araçlar |
|---|---|
| Docker (önerilen) | Git, Docker Desktop (Compose v2) |
| Manuel geliştirme | Git, Python 3.13, Node.js 22, Docker (yalnızca PostgreSQL + Redis için) |

## 2. Docker ile çalıştırma

```bash
git clone https://github.com/polat-mustafa/baltic-wind-control-system.git
cd baltic-wind-control-system
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up -d --build
```

İlk build 5–15 dakika sürebilir. Durdurmak için `docker compose down` komutunu kullanın
(`-v` eklerseniz veritabanı da silinir).

| Adres | İçerik |
|---|---|
| http://localhost:3000 | Web arayüzü |
| http://localhost:8000/docs | API dokümantasyonu (Swagger) |
| http://localhost:8000/health | Servis durumu |

## 3. Manuel geliştirme

```bash
docker compose up -d postgres redis                       # veritabanı + önbellek
cd backend && pip install -e ".[dev]" && alembic upgrade head
uvicorn app.main:app --reload --port 8000                 # API → :8000
cd ../frontend && npm ci && npm run dev                   # arayüz → :5173
```

## 4. Arayüz

| Sayfa | Ne gösterir |
|---|---|
| Overview | Çiftlik haritası, anlık KPI'lar, türbin detayı ve 3B görünüm |
| P1 · Wind Resource | Weibull, rüzgâr gülü, wake kayıpları, AEP (P50/P90), LCOE |
| P2 · HV Grid | Yük akışı, kısa devre (IEC 60909), FRT, reaktif güç / STATCOM |
| P3 · SCADA | Tek hat şeması, IEC 61850 / GOOSE simülasyonu, alarmlar, çalışma izinleri |
| P4 · Forecasting | XGBoost / LSTM / TFT güç tahmini ve belirsizlik bantları |
| P5 · Commissioning | Anahtarlama programı, LOTO, SAT testleri |
| Digital Twin | Durum izleme, arıza teşhisi ve kalan ömür tahmini |

Grafiklerin yanındaki bilgi düğmesi, kullanılan yöntemi ve ilgili standardı açıklar.

## 5. Sık kullanılan komutlar

| Komut | İşlev |
|---|---|
| `make test` | Backend + frontend testleri |
| `make lint` | Lint ve tip kontrolü |
| `make format` | Kodu biçimlendirir |
| `make docker-logs` | Servis loglarını izler |

## 6. Sorun giderme

- **Port kullanımda:** 3000, 8000, 5432 veya 6379 portunu kullanan uygulamayı kapatın.
- **Backend başlamıyor:** `docker compose logs backend` çıktısına bakın; çoğu zaman sebep veritabanının henüz hazır olmamasıdır, birkaç saniye sonra yeniden deneyin.
- **Arayüz veri göstermiyor:** API'nin `http://localhost:8000/health` adresinde yanıt verdiğini kontrol edin.
