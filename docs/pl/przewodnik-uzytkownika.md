# Przewodnik Uzytkownika - Baltic Wind HV Control Platform

> **Platforma symulacyjna morskiej farmy wiatrowej 510 MW na Morzu Baltyckim**
> 34 x Vestas V236-15.0 MW | system zbiorczy 66 kV | kabel eksportowy 220 kV (45 km) | przylaczenie do sieci PSE 400 kV

Ten przewodnik wyjasnia, jak zainstalowac, uruchomic, utrzymywac i diagnozowac projekt na poziomie odpowiednim dla samodzielnej nauki, onboardingu i publikacji w GitHub Pages. Zostal napisany dla uzytkownikow, ktorzy moga dopiero poznawac stack, ale nadal potrzebuja technicznie poprawnych instrukcji.

---

## Spis Tresci

1. [Czym Jest Ten Projekt](#1-czym-jest-ten-projekt)
2. [Tooling i Jego Rola](#2-tooling-i-jego-rola)
3. [Zalecany Setup z Dockerem](#3-zalecany-setup-z-dockerem)
4. [Reczna Konfiguracja Infrastruktury](#4-reczna-konfiguracja-infrastruktury)
5. [Reczna Konfiguracja Backendu](#5-reczna-konfiguracja-backendu)
6. [Reczna Konfiguracja Frontendu](#6-reczna-konfiguracja-frontendu)
7. [Zarzadzanie Baza Danych](#7-zarzadzanie-baza-danych)
8. [Codzienny Workflow Developerski](#8-codzienny-workflow-developerski)
9. [Makefile Reference](#9-makefile-reference)
10. [Linting i Pre-commit](#10-linting-i-pre-commit)
11. [Testy](#11-testy)
12. [CI/CD i GitHub Actions](#12-cicd-i-github-actions)
13. [MkDocs i GitHub Pages](#13-mkdocs-i-github-pages)
14. [Troubleshooting](#14-troubleshooting)
15. [Przeglad Architektury](#15-przeglad-architektury)
16. [Porty i Serwisy](#16-porty-i-serwisy)
17. [Szybka Sciagawka](#17-szybka-sciagawka)

---

## 1. Czym Jest Ten Projekt

### 1.1 Cel

Platforma jest edukacyjnym, ale inzyniersko wiarygodnym srodowiskiem symulacyjnym dla **morskiej farmy wiatrowej 510 MW** w polskiej czesci Morza Baltyckiego. Laczy analize zasobu wiatru, studia sieci WN, zagadnienia automatyki stacyjnej, workflow prognostyczne oraz logike uruchomieniowa w jednym repozytorium.

### 1.2 Strumienie Projektowe

| Strumien | Zakres | Typowe wyniki |
| --- | --- | --- |
| **P1** | Zasob wiatru i AEP | straty wake, layout, niepewnosc, metryki uzysku |
| **P2** | Analiza systemu WN | rozplyw mocy, zwarcia, FRT, studia mocy biernej |
| **P3** | SCADA i workflow OT | modele IEC 61850, zachowanie GOOSE, cykl Permit-to-Work |
| **P4** | Forecasting i analityka | modele ML, prognozy probabilistyczne, explainability |
| **P5** | Uruchomienie | programy laczeniowe, FAT/SAT, kontrole zabezpieczen |

### 1.3 Dla Kogo Jest Ten Przewodnik

Przewodnik jest przeznaczony dla:

- inzynierow uczacych sie stacku od podstaw,
- contributorow przygotowujacych lokalne srodowisko,
- reviewerow sprawdzajacych organizacje projektu pod GitHub Pages i CI,
- studentow traktujacych repozytorium jako profesjonalne portfolio techniczne.

---

## 2. Tooling i Jego Rola

### 2.1 Glowne Narzedzia

| Narzedzie | Po Co Jest Uzywane |
| --- | --- |
| **Git** | kontrola wersji, branch workflow, sladowa historia zmian inzynierskich |
| **Docker Desktop** | szybki i powtarzalny setup wielu serwisow |
| **Python 3.13** | backend i biblioteki obliczeniowe |
| **Node.js 22** | toolchain frontendu, build, lint i testy |
| **PostgreSQL 16 + TimescaleDB** | storage relacyjny i time-series |
| **Redis 7** | cache i warstwa realtime |
| **VS Code** | rekomendowane IDE do Python, TypeScript, Docker i docs |

### 2.2 Zalecane Sciezki Instalacji

- **Uzytkownicy Docker-first**: zainstaluj Git i Docker Desktop.
- **Pelny local development**: zainstaluj Git, Docker Desktop, Python 3.13 i Node.js 22.
- **Local database bez Dockera**: PostgreSQL i Redis moga dzialac natywnie, ale wymagaja dodatkowej konfiguracji.

---

## 3. Zalecany Setup z Dockerem

### 3.1 Sklonuj Repozytorium

```bash
git clone https://github.com/polat-mustafa/baltic-wind-control-system.git
cd baltic-wind-control-system
```

### 3.2 Przygotuj Pliki Srodowiskowe

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

W Windows PowerShell uzyj:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

### 3.3 Uruchom Caly Stack

```bash
docker compose up -d --build
```

### 3.4 Zweryfikuj Serwisy

```bash
docker compose ps
curl http://localhost:8000/health
```

Oczekiwane wyniki:

- `postgres` ma status healthy,
- `redis` ma status healthy,
- `backend` odpowiada na `/health`,
- `frontend` jest dostepny pod `http://localhost:3000`.

### 3.5 Kiedy Preferowac Docker

Wybierz Docker, gdy zalezy Ci na:

- powtarzalnym onboardingu,
- braku recznej instalacji PostgreSQL i Redis,
- zgodnosci srodowiska z CI,
- prostym workflow dla contributorow dokumentacji i GitHub Pages.

---

## 4. Reczna Konfiguracja Infrastruktury

### 4.1 PostgreSQL i TimescaleDB

Jesli nie korzystasz z Dockera, zainstaluj PostgreSQL 16 i upewnij sie, ze rozszerzenie TimescaleDB jest dostepne.

Typowy lokalny URL bazy:

```text
postgresql+asyncpg://postgres:postgres@localhost:5432/balticwind
```

Po utworzeniu bazy wlacz TimescaleDB, jesli Twoja lokalna instalacja to obsluguje:

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

### 4.2 Redis

Uruchom Redis lokalnie na domyslnym porcie:

```text
redis://localhost:6379/0
```

---

## 5. Reczna Konfiguracja Backendu

### 5.1 Instalacja Zaleznosci

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
```

### 5.2 Migracje

```bash
alembic upgrade head
```

### 5.3 Start API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5.4 Weryfikacja Backendu

Sprawdz:

- `http://localhost:8000/health`
- `http://localhost:8000/docs`
- `http://localhost:8000/redoc`

---

## 6. Reczna Konfiguracja Frontendu

### 6.1 Instalacja Zaleznosci

```bash
cd frontend
npm ci
```

### 6.2 Start Serwera Developerskiego

```bash
npm run dev
```

Domyslny URL Vite to zwykle `http://localhost:5173`.

### 6.3 Kontrola Builda Produkcyjnego

```bash
npm run build
npm run preview
```

---

## 7. Zarzadzanie Baza Danych

### 7.1 Typowe Polecenia

```bash
docker compose exec postgres psql -U postgres -d balticwind
```

```bash
alembic current
alembic history
```

### 7.2 Kiedy Resetowac Dane Lokalne

Reset lokalnego srodowiska ma sens, gdy:

- migracje zmienily sie znacaco,
- seed data albo fixtures sa uszkodzone,
- swiadomie chcesz czyste srodowisko.

Reset Dockerowy:

```bash
docker compose down -v
docker compose up -d --build
```

---

## 8. Codzienny Workflow Developerski

Dobry workflow domyslny:

1. pobierz najnowsze zmiany,
2. uruchom infrastrukture,
3. uruchom backend lub frontend w trybie development,
4. wprowadz zmiany,
5. odpal lokalnie lint i testy,
6. zaktualizuj docs, jesli zmienilo sie zachowanie aplikacji,
7. zrob commit z jasnym scoped message.

Przyklad:

```bash
git pull
make docker-up
make lint
make test
```

---

## 9. Makefile Reference

| Polecenie | Cel |
| --- | --- |
| `make install` | instalacja zaleznosci backendu i frontendu |
| `make docker-up` | start stacku Docker |
| `make docker-down` | zatrzymanie stacku Docker |
| `make docker-logs` | podglad logow kontenerow |
| `make lint` | uruchomienie lint targetow |
| `make format` | formatowanie kodu |
| `make test` | uruchomienie testow |
| `make clean` | czyszczenie cache i artefaktow |
| `make docs-serve` | lokalny preview MkDocs |

---

## 10. Linting i Pre-commit

Repozytorium korzysta z pre-commit jako pierwszej bramki jakosci. Pozwala wykryc problemy, zanim trafia do CI.

Typowe kontrole obejmuja:

- formatowanie i linting Pythona,
- typowanie Pythona,
- linting TypeScript / frontend,
- zasady higieny plikow i whitespace.

Instalacja hookow jednorazowo:

```bash
pre-commit install
```

Uruchomienie reczne:

```bash
pre-commit run --all-files
```

---

## 11. Testy

### 11.1 Backend

```bash
cd backend
pytest
```

### 11.2 Frontend

```bash
cd frontend
npm run test -- --run
```

### 11.3 Co Sprawdzic Przed Commitem

Minimum:

- aplikacja uruchamia sie po zmianie,
- lint przechodzi,
- testy dotknietych obszarow przechodza,
- docs sa zaktualizowane, jesli zmiana jest user-facing.

---

## 12. CI/CD i GitHub Actions

GitHub Actions jest wykorzystywane do:

- lintingu,
- wykonywania testow,
- budowania dokumentacji i deployu Pages,
- weryfikacji aktualizacji zaleznosci.

Workflow dokumentacyjny publikuje strone MkDocs do GitHub Pages, gdy zmieniaja sie pliki dokumentacji lub konfiguracja MkDocs na branchu `main`.

---

## 13. MkDocs i GitHub Pages

### 13.1 Lokalny Preview

```bash
mkdocs serve
```

albo

```bash
make docs-serve
```

### 13.2 Kontrola Builda

```bash
mkdocs build
```

### 13.3 Uwagi Publikacyjne

Dla GitHub Pages warto utrzymywac jawna i stabilna strukture:

- korzystac z commitowanych plikow markdown,
- utrzymywac deterministyczna nawigacje w `mkdocs.yml`,
- nie polegac na runtime translation pluginach, jesli wystarcza statyczne sekcje jezykowe,
- sprawdzac linki przed mergem.

---

## 14. Troubleshooting

### 14.1 Docker Nie Startuje

Sprawdz:

- czy Docker Desktop dziala,
- czy virtualisation jest wlaczona,
- czy WSL2 jest zdrowe w Windows.

### 14.2 Backend Ciagle Sie Restartuje

Podejrzyj logi:

```bash
docker compose logs backend
```

Typowe przyczyny:

- brakujace zmienne srodowiskowe,
- baza danych nie jest gotowa,
- blad migracji,
- blad importu lub zaleznosci.

### 14.3 Frontend Otwiera Sie, Ale Jest Pusty

Sprawdz:

- bledy w konsoli przegladarki,
- endpoint zdrowia backendu,
- wartosci `VITE_` w env,
- czy frontend zostal przebudowany po zmianach konfiguracji.

### 14.4 Bledy Migracji

Przydatne polecenia:

```bash
alembic current
alembic upgrade head
```

### 14.5 Problemy z CORS

Upewnij sie, ze konfiguracja backendu zawiera aktywny origin frontendu, szczegolnie `http://localhost:3000` i `http://localhost:5173`.

---

## 15. Przeglad Architektury

### 15.1 Topologia Wysokiego Poziomu

```text
Przegladarka -> Frontend -> Backend API -> PostgreSQL / TimescaleDB
                                   -> Redis
                                   -> serwisy inzynierskie (P1-P5)
```

### 15.2 Uklad Repozytorium

```text
backend/     aplikacja FastAPI, services, schemas, tests, Alembic
frontend/    aplikacja React, UI components, stores, tests
docs/        tresc MkDocs, roadmaps, lessons, user documentation
.github/     workflowy CI/CD i dokumentacji
```

### 15.3 Zasada Inzynierska

Projekt jest zorganizowany tak, aby fizyka, standardy, obliczenia i kod pozostawaly sladowalne. Z tego powodu dokumentacja jest czescia architektury systemu, a nie opcjonalnym dodatkiem.

---

## 16. Porty i Serwisy

| Port | Serwis | Uwagi |
| --- | --- | --- |
| `3000` | Frontend (Docker / styl produkcyjny) | Glowny punkt wejscia do stacku kontenerowego |
| `5173` | Frontend dev server | Domyslny port Vite |
| `8000` | Backend API | Aplikacja FastAPI |
| `5432` | PostgreSQL / TimescaleDB | Glowna baza danych |
| `6379` | Redis | Cache i warstwa messaging |
| `8080` | Lokalny preview MkDocs | Typowy port dla docs preview |

---

## 17. Szybka Sciagawka

```bash
# Start full stack
docker compose up -d --build

# Stop full stack
docker compose down

# Tail logs
docker compose logs -f

# Backend tests
cd backend && pytest

# Frontend tests
cd frontend && npm run test -- --run

# Docs preview
mkdocs serve

# Docs build
mkdocs build
```

---

## Uwagi dla Contributorow

Ten polski przewodnik jest pierwszym bezposrednio autorskim batchem tlumaczen. Zachowuje strukture oryginalnej dokumentacji tureckiej, ale porzadkuje jezyk pod czytelnika technicznego, akademickiego i GitHub Pages. Tlumaczenia kolejnych lekcji beda dodawane w tym samym ukladzie, aby nawigacja pozostala stabilna.
