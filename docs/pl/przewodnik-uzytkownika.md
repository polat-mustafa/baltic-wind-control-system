# Przewodnik użytkownika

**Baltic Wind HV Control Platform**: symulacja morskiej farmy wiatrowej 510 MW na Morzu Bałtyckim
(34 × Vestas V236-15.0 MW, sieć wewnętrzna 66 kV, kabel eksportowy 220 kV o długości 45 km, sieć PSE 400 kV).

## 1. Wymagania

| Sposób | Narzędzia |
|---|---|
| Docker (zalecany) | Git, Docker Desktop (Compose v2) |
| Praca deweloperska | Git, Python 3.13, Node.js 22, Docker (tylko dla PostgreSQL + Redis) |

## 2. Uruchomienie w Dockerze

```bash
git clone https://github.com/polat-mustafa/baltic-wind-control-system.git
cd baltic-wind-control-system
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up -d --build
```

Pierwsze budowanie może potrwać 5–15 minut. Zatrzymanie: `docker compose down`
(z opcją `-v` usuwana jest także baza danych).

| Adres | Zawartość |
|---|---|
| http://localhost:3000 | Interfejs webowy |
| http://localhost:8000/docs | Dokumentacja API (Swagger) |
| http://localhost:8000/health | Stan usług |

## 3. Praca deweloperska

```bash
docker compose up -d postgres redis                       # baza danych + cache
cd backend && pip install -e ".[dev]" && alembic upgrade head
uvicorn app.main:app --reload --port 8000                 # API → :8000
cd ../frontend && npm ci && npm run dev                   # interfejs → :5173
```

## 4. Interfejs

| Strona | Co pokazuje |
|---|---|
| Overview | Mapa farmy, bieżące KPI, szczegóły turbiny i widok 3D |
| P1 · Wind Resource | Rozkład Weibulla, róża wiatrów, straty aerodynamiczne (wake), AEP (P50/P90), LCOE |
| P2 · HV Grid | Rozpływ mocy, zwarcia (IEC 60909), FRT, moc bierna / STATCOM |
| P3 · SCADA | Schemat jednokreskowy, symulacja IEC 61850 / GOOSE, alarmy, polecenia pracy |
| P4 · Forecasting | Prognozy mocy XGBoost / LSTM / TFT z przedziałami niepewności |
| P5 · Commissioning | Program łączeń, LOTO, testy SAT |
| Digital Twin | Monitorowanie stanu, diagnostyka uszkodzeń i szacowanie pozostałej żywotności |

Przycisk informacji obok wykresu objaśnia zastosowaną metodę i odpowiednią normę.

## 5. Najczęstsze polecenia

| Polecenie | Działanie |
|---|---|
| `make test` | Testy backendu i frontendu |
| `make lint` | Lint i kontrola typów |
| `make format` | Formatowanie kodu |
| `make docker-logs` | Podgląd logów usług |

## 6. Rozwiązywanie problemów

- **Port zajęty:** zamknij aplikację używającą portu 3000, 8000, 5432 lub 6379.
- **Backend nie startuje:** sprawdź `docker compose logs backend`; zwykle baza danych nie jest jeszcze gotowa, spróbuj ponownie po kilku sekundach.
- **Interfejs nie pokazuje danych:** sprawdź, czy API odpowiada pod adresem `http://localhost:8000/health`.
