# Lekcja 001 — Budowanie fundamentu DevOps dla platformy symulacji morskiej farmy wiatrowej 510 MW

!!! abstract "Nawigacja lekcji"
    :material-arrow-left: **Poprzednia:** [Lekcja 000 — Planowanie projektu](lesson-000.md) | **Następna:** [Lekcja 002 — Infrastruktura internacjonalizacji](lesson-002.md) :material-arrow-right:

    **Faza:** P0 | **Język:** Polski | **Postęp:** 2 z 19 | [Wszystkie lekcje](index.md) | [Plan nauki](../../Learning_Roadmap.md)

> **Data:** 2026-02-20
> **Commity:** 14 commitów (`f250002` → `9fc5c88`)
> **Zakres commitów:** `f2500024193bb88db74d1269612cd7c14fbe0614..9fc5c88d5b74a1070aae0c1c0a89b4cac8704cb0`
> **Faza:** P0 (Fundament DevOps)
> **Poprzednia lekcja:** Brak
> **last_commit_hash:** 9fc5c88d5b74a1070aae0c1c0a89b4cac8704cb0

---

## Czego się nauczysz

- Jak zorganizować monorepo dla pełnostosowej przemysłowej platformy symulacyjnej (FastAPI + React + PostgreSQL + Redis)
- Dlaczego potok CI/CD jest pierwszą rzeczą, którą buduje profesjonalny zespół inżynierski — zanim pojawi się jakakolwiek logika domenowa
- Jak Docker Compose orkiestruje architektury wielousługowe z kontrolami stanu zdrowia (health checks) i porządkowaniem zależności
- Dlaczego automatyczne skanowanie bezpieczeństwa ma znaczenie w projektach open-source i jak zbudować skaner sekretów
- Jak Dependabot i hooki pre-commit tworzą strategię „defense in depth" na rzecz jakości kodu

---

## Sekcja 1: Architektura dokumentacji — jedyne źródło prawdy w projekcie

### Problem z realnego świata

Wyobraź sobie, że jako inżynier rozruchowy przyjeżdżasz do nowej morskiej farmy wiatrowej. Zanim dotkniesz choćby jednego wyłącznika, potrzebujesz *instrukcji stanowiskowej* — jednego dokumentu, który podaje napięcia, nastawy przekaźników zabezpieczeniowych, przekroje kabli i procedury awaryjne. Bez niej działasz na ślepo. Projekty software'owe są takie same: bez jasnego, autorytatywnego zestawu dokumentów każdy programista inaczej zgaduje, jak system powinien działać.

### Co mówią standardy

Nasza dokumentacja jest zgodna z hierarchiczną strukturą dokumentów **IEC 61355** — szczegóły znajdziesz w [filozofii dokumentacyjnej](index.md#document-philosophy-iec-61355). Kluczowa zasada: jedna mapa drogowa rządzi wszystkim, a zarchiwizowane wersje zapewniają identyfikowalność.

### Co zbudowaliśmy

**Zmienione pliki:**
- `CLAUDE.md` — „instrukcja stanowiskowa" projektu dla asystenta AI: automatycznie ładuje referencje przy każdej sesji
- `docs/Project_Roadmap.md` — Skonsolidowana specyfikacja (1 646 wierszy) łącząca v1 i v2 w jedno autorytatywne źródło
- `docs/SKILL.md` — Standardy inżynierskie i konwencje kodowania (722 wiersze)
- `docs/Learning_Roadmap.md` — 32-tygodniowy plan samokształcenia
- `docs/archive/Project_Roadmap_v1.md` i `docs/archive/Project_Roadmap_v2.md` — Wersje historyczne zachowane dla identyfikowalności
- `.gitignore` — Wyklucza pliki generowane, sekrety i duże dane z kontroli wersji

Mieliśmy dwa dokumenty roadmap (v1 i v2), które częściowo się wzajemnie wykluczały. Dokument v2 był „analizą luk", która korygowała liczbę turbin, dodawała wymagania dotyczące symulacji dynamicznych i aktualizowała odniesienia do norm. Zamiast utrzymywać dwa pliki i zmuszać każdego czytelnika do mentalnego ich łączenia, skonsolidowaliśmy je w jeden `Project_Roadmap.md` i zarchiwizowaliśmy oryginały.

### Dlaczego to jest ważne

> **Dlaczego** potrzebujemy jednego skonsolidowanego roadmapu zamiast oddzielnych dokumentów v1 i v2?
> Bo niejednoznaczność niszczy projekty. Jeśli jeden dokument mówi 30 turbin, a drugi 34, programista implementujący optymalizator układu losowo wybierze jedną wartość — i połowa dalszych obliczeń będzie błędna. Jedno źródło prawdy całkowicie eliminuje tę klasę błędów.
>
> **Dlaczego** archiwizujemy stare wersje zamiast je usuwać?
> Identyfikowalność. W prawdziwych projektach farm wiatrowych każda zmiana projektowa jest śledzona (IEC 61400-1 wymaga ścieżki audytu „podstawy projektowej"). Archiwizacja pozwala zobaczyć, *dlaczego* decyzje się zmieniły — na przykład aktualizacja z 30 × 17 MW do 34 × 15 MW turbin wynikała z jasności edukacyjnej (bardziej realistyczny układ tablicy do analizy efektu cienia aerodynamicznego).

### Przegląd kodu

Protokół sesji `CLAUDE.md` i automatycznie ładowane referencje zostały szczegółowo omówione w [Lekcji 000 — Sekcja 2](lesson-000.md#section-2-the-planning-documents-engineering-before-code). Kluczowa myśl: każda sesja zaczyna się od tego samego kontekstu inżynierskiego, tak jak operator sterowni czyta dziennik stacji przy zmianie zmiany.

`.gitignore` jest równie ważny — zapobiega przypadkowemu commitowaniu sekretów, danych pogodowych (pliki ERA5 NetCDF mogą mieć gigabajty) oraz artefaktów kompilacji:

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

Te wzorce chronią nas przed najczęstszymi błędami w projektach open-source: wyciekiem kluczy API i zaśmiecaniem repozytorium danymi binarnymi.

!!! tip "Kluczowa koncepcja: Jedyne źródło prawdy (SSOT)"
    **Po ludzku:** Zamiast przechowywać informacje rozrzucone po pięciu różnych dokumentach, które mogą się ze sobą nie zgadzać, umieszczasz je wszystkie w jednym miejscu. Jeśli ktoś pyta „ile turbin?" — jest dokładnie jedno miejsce do sprawdzenia i zawsze zawiera właściwą odpowiedź.

    **Analogia:** Wyobraź sobie aplikację kontaktów w telefonie. Gdybyś miał trzy różne książki adresowe, a numer przyjaciela był inny w każdej z nich, traciłbyś czas na ustalenie, która jest poprawna. SSOT oznacza jedną książkę adresową, jeden numer — zawsze prawidłowy.

    **W tym projekcie:** [`docs/Project_Roadmap.md`](../../Project_Roadmap.md) jest źródłem prawdy dla całej specyfikacji farmy wiatrowej 510 MW. Każda liczba turbin, napięcie kabla i odniesienie do kodeksu sieciowego znajduje się tam. Gdy będziemy kodować optymalizator układu P1, odczytamy specyfikacje turbin właśnie z tego jednego dokumentu — nigdy z zarchiwizowanych v1 ani v2.

---

## Sekcja 2: Szkielet backendu FastAPI — twój pierwszy mikroserwis

### Problem z realnego świata

Wyobraź sobie, że budujesz dom. Zanim zainstalуjesz hydraulikę czy elektrykę, wylewasz fundamenty i stawiasz szkielet. Szkielet jeszcze nic *nie robi* — po prostu definiuje, gdzie będą ściany. Szkielet backendu jest taki sam: to strukturalna rama, do której cała przyszła logika dziedzinowa (modele efektu cienia, symulacje przepływu mocy, API prognozowania) będzie się podczepiać.

### Co mówią standardy

**IEC 62443 (Sieci komunikacyjne dla systemów przemysłowych — bezpieczeństwo sieci i systemów)** wymaga, aby systemy SCADA i sterowania miały jasno zdefiniowaną architekturę bezpieczeństwa od pierwszego dnia — nie przykręcaną później. Choć nasz endpoint `/health` jest prosty, middleware CORS, konfiguracja oparta na środowisku i izolacja kontenerów, które teraz konfigurujemy, będą fundamentem bezpiecznego dostępu do API, gdy w P3 będziemy budować prawdziwy interfejs SCADA.

### Co zbudowaliśmy

**Zmienione pliki:**
- `backend/app/main.py` — Aplikacja FastAPI z endpointem health i middleware CORS
- `backend/app/config.py` — Pydantic Settings do konfiguracji opartej na środowisku
- `backend/pyproject.toml` — Definicja pakietu Python ze wszystkimi zależnościami i konfiguracjami narzędzi
- `backend/tests/test_health.py` — Pierwszy test: dowodzi, że endpoint health działa
- `backend/Dockerfile` — Definicja obrazu kontenera dla usługi backendowej

Backend jest celowo minimalny. Ma dokładnie jeden endpoint (`/health`) i jedną klasę konfiguracyjną. Ale zauważ, co *już* zawiera: middleware CORS (potrzebny, gdy React rozmawia z FastAPI), asynchroniczny sterownik bazy danych (asyncpg) i ścisłe sprawdzanie typów (mypy w trybie strict). To nie jest przedwczesne — to strukturalna stal, do której wszystko inne się przykręca.

### Dlaczego to jest ważne

> **Dlaczego** zaczynamy od endpointu `/health` zamiast od razu przechodzić do API symulacji wiatrowej?
> Bo Docker, Kubernetes i potoki CI wszystkie potrzebują sposobu na pytanie „czy ta usługa działa?" przed skierowaniem do niej ruchu. Endpoint `/health` to tętno serwisu. Bez niego orkiestrator kontenerów nie może odróżnić usługi, która uległa awarii, od usługi, która jest powolna — a w prawdziwym systemie SCADA ta różnica to różnica między kontrolowanym wyłączeniem a awarią zasilania.
>
> **Dlaczego** używamy Pydantic Settings zamiast bezpośredniego odczytu zmiennych środowiskowych przez `os.getenv()`?
> Bezpieczeństwo typów i walidacja. `os.getenv("DATABASE_URL")` zwraca `Optional[str]` — musisz samodzielnie sprawdzać `None`, ręcznie rzutować liczby całkowite i parsować listy. Pydantic Settings robi to wszystko automatycznie, z czytelnymi komunikatami o błędach, jeśli brakuje wymaganej zmiennej. W morskim systemie sterowania farmą wiatrową nieprawidłowo skonfigurowany URL bazy danych powinien głośno zawieść przy starcie — nie po cichu o 3 w nocy podczas burzy.

### Przegląd kodu

Moduł konfiguracyjny demonstruje zasadę „12-Factor App" — konfiguracja żyje w środowisku, nie w kodzie:

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

Każde pole ma wartość domyślną dla lokalnego środowiska developerskiego, ale w środowisku produkcyjnym (Docker Compose, Kubernetes) zmienne środowiskowe je nadpisują. Pole `cors_origins` jest typu `list[str]`, a Pydantic automatycznie parsuje ciąg JSON `'["http://localhost:3000"]'` — bez ręcznego parsowania.

Test health check to nasz pierwszy „smoke test" — dowodzi, że aplikacja może się uruchomić i odpowiadać:

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

Ten test uruchamia się w CI przy każdym pushu. Jeśli aplikacja nie może się nawet uruchomić (błąd importu, brakująca zależność, awaria konfiguracji), test to wykryje w sekundach — zanim dotrze do produkcji.

!!! tip "Kluczowa koncepcja: Aplikacja 12-Factor — konfiguracja w środowisku"
    **Po ludzku:** Nigdy nie wpisuj haseł, adresów baz danych ani kluczy API bezpośrednio w kodzie. Zamiast tego Twój kod odczytuje je ze środowiska komputera (np. zmiennych środowiskowych), a Ty ustawiasz te wartości inaczej na laptopie, a inaczej w środowisku produkcyjnym.

    **Analogia:** Pomyśl o systemie kluczy głównych w budynku. Mechanizm zamka (kod) jest wszędzie taki sam, ale klucz (konfiguracja) zmienia się w zależności od tego, kto uzyskuje dostęp. Woźny ma inny klucz niż dyrektor, ale drzwi działają tak samo.

    **W tym projekcie:** Nasze `config.py` używa `postgresql+asyncpg://postgres:postgres@localhost:5432/balticwind` do celów developerskich, ale Docker Compose nadpisuje to adresem `postgres:postgres@postgres:5432/balticwind` (uwaga: `postgres` to nazwa usługi Docker, nie `localhost`). W prawdziwym wdrożeniu menedżer sekretów wstrzykiwałby właściwe hasło.

---

## Sekcja 3: Docker Compose — orkiestracja sterowni

### Problem z realnego świata

System sterowania farmą wiatrową nie działa na jednym komputerze. Serwer SCADA rozmawia z bazą historyczną, która rozmawia z magazynem szeregów czasowych, który rozmawia z wyświetlaczami HMI. Jeśli uruchomisz HMI zanim baza danych będzie gotowa, system się posypie. Jeśli baza danych startuje przed skonfigurowaniem sieci, nie może przyjmować połączeń. Potrzebujesz *orkiestratora* — czegoś, co uruchamia usługi w odpowiedniej kolejności i sprawdza, czy każda z nich jest sprawna, zanim uruchomi następną.

### Co mówią standardy

**IEC 62351 (Zarządzanie systemami elektroenergetycznymi i związana z tym wymiana informacji — bezpieczeństwo danych i komunikacji)** kładzie nacisk na segmentację sieci i izolację usług dla systemów SCADA. Kontenery Docker zapewniają izolację na poziomie procesu — każda usługa działa we własnej przestrzeni nazw z własnym systemem plików, a komunikacja odbywa się tylko przez jawnie zadeklarowane porty. Jest to uproszczona wersja stref sieciowych (DMZ, strefa sterowania, strefa polowa) zdefiniowanych w IEC 62443.

### Co zbudowaliśmy

**Zmienione pliki:**
- `docker-compose.yml` — Stos czterech usług: PostgreSQL+TimescaleDB, Redis, backend FastAPI, frontend React

Plik Docker Compose definiuje całe środowisko developerskie jako kod. Zwróć uwagę na bloki `healthcheck` i warunki `depends_on`:

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

### Dlaczego to jest ważne

> **Dlaczego** używamy TimescaleDB zamiast zwykłego PostgreSQL?
> Ponieważ dane farmy wiatrowej to zasadniczo dane *szeregów czasowych*. Co 10 sekund każda z 34 turbin raportuje moc czynną, prędkość wiatru, skok łopat, orientację gondoli i temperaturę generatora. To tysiące punktów danych na minutę. TimescaleDB rozszerza PostgreSQL o hipertabele — automatycznie partycjonowane tabele zoptymalizowane pod kątem wstawiania szeregów czasowych i zapytań zakresowych. W P1, gdy będziemy przechowywać dane pogodowe ERA5 i symulowaną moc wyjściową, TimescaleDB sprawi, że zapytania typu „średnia moc dla każdej turbiny za ostatnie 24 godziny" będą działać 10–100 razy szybciej niż w standardowym PostgreSQL.
>
> **Dlaczego** w `depends_on` backendu używamy `condition: service_healthy` zamiast po prostu `depends_on: [postgres]`?
> Bo „kontener uruchomiony" to nie to samo co „usługa gotowa". PostgreSQL potrzebuje kilku sekund na zainicjowanie katalogu danych, wykonanie odtwarzania WAL i rozpoczęcie akceptowania połączeń. Bez `service_healthy` backend próbowałby połączyć się z PostgreSQL natychmiast, otrzymałby błąd „connection refused" i mógłby ulec awarii. Health check `pg_isready` zapewnia, że backend startuje dopiero po tym, jak PostgreSQL faktycznie akceptuje zapytania.

### Przegląd kodu

Wzorzec health check jest wart przestudiowania, bo będziemy go intensywnie używać w P3 (monitorowanie SCADA):

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]  # Run this command inside the container
  interval: 5s    # Check every 5 seconds
  timeout: 5s     # If the check takes >5s, consider it failed
  retries: 5      # After 5 consecutive failures, mark container as unhealthy
```

Jest to ten sam wzorzec stosowany w prawdziwych systemach przemysłowych. Przekaźniki zabezpieczeniowe sprawdzają stan wyłącznika co kilkaset milisekund. Jeśli wyłącznik nie odpowie w ciągu limitu czasu, przekaźnik eskaluje — najpierw alarm, potem polecenie wyzwolenia. Nasze health checks Docker są uproszczoną wersją tego samego wzorca: odpytywanie → limit czasu → ponowna próba → eskalacja.

Sekwencja startowa health check w formie graficznej:

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

!!! tip "Kluczowa koncepcja: Orkiestracja usług i health checks"
    **Po ludzku:** Gdy masz wiele programów, które zależą od siebie, potrzebujesz systemu, który uruchamia je w odpowiedniej kolejności i upewnia się, że każdy faktycznie działa, zanim uruchomi kolejny.

    **Analogia:** Pomyśl o kuchni restauracyjnej. Kucharz przygotowujący surowce najpierw kroi warzywa, potem kucharz liniowy zaczyna gotować. Kucharz liniowy nie zaczyna smażyć, dopóki przygotowanie nie jest ukończone — a szef kuchni sprawdza, czy przygotowanie jest *naprawdę* gotowe, a nie tylko że kucharz przygotowujący już przyszedł. Docker Compose jest szefem kuchni.

    **W tym projekcie:** Nasz backend FastAPI nie może działać bez PostgreSQL i Redis. Docker Compose zapewnia, że PostgreSQL akceptuje połączenia (`pg_isready`), a Redis odpowiada na `ping`, zanim backend wystartuje. Gdy dodamy solver siatki Pandapower w P2, będzie on stosował ten sam wzorzec — zależny od zdrowego backendu przed uruchomieniem symulacji.

---

## Sekcja 4: Potok CI/CD i bramki jakości — automatyczny inspektor

### Problem z realnego świata

W morskiej farmie wiatrowej każdy element wyposażenia przechodzi inspekcję jakości przed instalacją. Transformator nie opuszcza fabryki bez testu rutynowego. Kabel nie jest ciągnięty bez testu megomierzem. Zasada jest prosta: *wykrywaj wady zanim dotrą na pole, bo naprawianie ich na morzu kosztuje 10 razy więcej.* CI/CD stosuje tę samą zasadę do kodu: wykrywaj błędy zanim dotrą do produkcji.

### Co mówią standardy

**IEC 61400-1 (Systemy wytwarzania energii wiatrowej — wymagania projektowe)** nakazuje formalny proces weryfikacji i walidacji oprogramowania sterującego turbin wiatrowych. Choć nasza symulacja nie jest krytyczna dla bezpieczeństwa, przyjmujemy taką samą dyscyplinę: każda zmiana kodu musi przejść automatyczne sprawdzenia lintingu, typów i testy, zanim będzie mogła zostać scalona. Jest to defense in depth — wiele niezależnych bramek jakości, każda wychwytująca inne klasy błędów.

### Co zbudowaliśmy

**Zmienione pliki:**
- `.github/workflows/ci.yml` — Cztery równoległe zadania CI: lint backendu, testy backendu, lint frontendu, testy frontendu
- `.github/workflows/docs.yml` — Automatyczne wdrażanie MkDocs na GitHub Pages
- `.pre-commit-config.yaml` — Lokalne bramki jakości uruchamiane przed każdym commitem
- `.editorconfig` — Spójne formatowanie w różnych edytorach (szerokość tabulacji, końce wierszy, końcowe spacje)
- `Makefile` — Uniwersalny uruchamiacz zadań z ponad 15 celami do instalacji, lintowania, testowania, Dockera i dokumentacji
- `.github/dependabot.yml` — Automatyczne cotygodniowe aktualizacje zależności dla pip, npm i GitHub Actions

Potok CI uruchamia cztery zadania równolegle przy każdym pushu i PR:

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Backend Lint │   │ Backend Test │   │ Frontend Lint│   │Frontend Test │
│  ruff check  │   │   pytest     │   │  tsc --noEmit│   │  vitest run  │
│  ruff format │   │   coverage   │   │  eslint      │   │  coverage    │
│  mypy        │   │              │   │              │   │              │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

### Dlaczego to jest ważne

> **Dlaczego** rozdzielamy lint i testy na różne zadania zamiast uruchamiać je sekwencyjnie?
> Równoległość i izolacja. Jeśli linting zakończy się niepowodzeniem, chcesz wiedzieć o tym natychmiast — nie czekaj na zakończenie 5-minutowego zestawu testów. A jeśli test się nie powiedzie, chcesz wiedzieć, czy to błąd logiczny (zadanie testowe) czy naruszenie stylu (zadanie lint), a nie debugować obu naraz. W systemach elektroenergetycznych jest to ta sama zasada co posiadanie oddzielnych przekaźników zabezpieczeniowych dla nadprądu i zwarcia doziemnego — każdy pilnuje innej klasy problemu.
>
> **Dlaczego** używamy zarówno hooków pre-commit, jak i CI?
> Defense in depth. Hooki pre-commit wychwytują problemy *zanim* commit zostanie utworzony — dostajesz natychmiastową informację zwrotną na laptopie. CI wychwytuje problemy *po* pushu — weryfikuje, że kod działa w czystym środowisku (nie tylko na Twoim komputerze z konkretną wersją Pythona i zainstalowanymi pakietami). Razem tworzą dwie niezależne bramki jakości, tak jak turbina wiatrowa ma zarówno hamulec mechaniczny, jak i aerodynamiczny.

### Przegląd kodu

Makefile zasługuje na uwagę, bo jest codziennym narzędziem programisty — jedynym punktem wejścia dla wszystkich typowych zadań:

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

Zwróć uwagę na komentarze `## ` po każdym celu — są one samodokumentujące. Uruchomienie `make help` drukuje sformatowaną listę wszystkich dostępnych celów. To mały detal, który ogromnie poprawia doświadczenie programisty: nikt nie musi czytać Makefile, żeby wiedzieć, jakie polecenia są dostępne.

Konfiguracja pre-commit łączy ze sobą wiele narzędzi — każde wychwytuje inną klasę błędów. Jeśli `check-yaml` znajdzie błąd składni w Twoim workflow CI, blokuje commit *zanim* wyślesz uszkodzony YAML do GitHub.

??? example "Pełna konfiguracja pre-commit"

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

Potok defense-in-depth:

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

!!! tip "Kluczowa koncepcja: Defense in depth — wiele niezależnych bramek jakości"
    **Po ludzku:** Nie polegaj na jednej kontroli bezpieczeństwa. Miej wiele kontroli na różnych etapach, każda szukająca innych problemów. Jeśli jedna coś przeoczy, następna to wyłapie.

    **Analogia:** Pomyśl o kontroli bezpieczeństwa na lotnisku. Przechodzisz przez bramkę do wykrywania metalu (hook pre-commit), potem Twoja torba prześwietlana jest rentgenem (potok CI), a osoba wizualnie sprawdza Twój paszport (przegląd kodu). Każda warstwa wychwytuje to, co inne mogą pominąć. Żadna warstwa nie jest doskonała, ale razem są bardzo skuteczne.

    **W tym projekcie:** Programista pisze kod → hooki pre-commit sprawdzają formatowanie i typy lokalnie → CI uruchamia pełny zestaw testów w czystym środowisku → umiejętność github-push skanuje sekrety przed wysłaniem. Trzy niezależne bramki, każda wychwytująca inną klasę błędów. Gdy budujemy automatykę SCADA w P3, zobaczymy ten sam wzorzec w koordynacji przekaźników zabezpieczeniowych: zabezpieczenie podstawowe, zabezpieczenie rezerwowe i zabezpieczenie od niesprawności wyłącznika.

---

## Sekcja 5: Wzmocnienie bezpieczeństwa — strażnik pushowania

### Problem z realnego świata

Wyobraź sobie, że jesteś operatorem sterowni i ktoś prosi Cię o zamknięcie wyłącznika. Zanim to zrobisz, sprawdzasz: Czy linia jest pozbawiona napięcia? Czy uziemnik jest odłączony? Czy jest ważny program łączeń? Nie zamykasz wyłącznika tylko dlatego, że ktoś o to poprosił — najpierw weryfikujesz warunki. Umiejętność github-push jest taka sama: sprawdza wyciekłe sekrety, niebezpieczne pliki i problemy z jakością kodu, zanim pozwoli, żeby kod dotarł do publicznego repozytorium.

### Co mówią standardy

**OWASP Top 10** i **CWE-798 (Użycie zakodowanych na stałe poświadczeń)** identyfikują zakodowane na stałe sekrety jako jedną z najczęstszych i najniebezpieczniejszych luk w oprogramowaniu. W przypadku projektu open-source wypchnięcie hasła do bazy danych lub klucza API do publicznego repozytorium GitHub oznacza, że jest ono natychmiast dostępne dla całego internetu. Nasz audyt bezpieczeństwa ma na celu wychwycenie tego, zanim opuści komputer programisty.

### Co zbudowaliśmy

**Zmienione pliki:**
- `.claude/skills/github-push/SKILL.md` — 7-fazowy bezpieczny workflow push ze skanerem sekretów i wykrywaniem niebezpiecznych plików
- Wzmocnienie bezpieczeństwa: dodano wzorce haseł YAML, listę dozwolonych wyjątków, obowiązkowe potwierdzenie użytkownika dla pozycji WARN

Umiejętność github-push to 250-wierszowa definicja workflow działająca jako bramka bezpieczeństwa. Uruchamia siedem faz: rozpoznanie (git status, diff, log, branch), audyt bezpieczeństwa (skaner sekretów, skaner niebezpiecznych plików, kontrole jakości kodu), werdykt (BLOCK lub WARN), staging (plik po pliku, nigdy `git add .`), formatowanie komunikatu commita, push i raport podsumowujący.

### Dlaczego to jest ważne

> **Dlaczego** potrzebujemy automatycznego skanera sekretów, skoro `.gitignore` już zapobiega commitowaniu plików `.env`?
> Ponieważ `.gitignore` obejmuje tylko pliki *wymienione* w nim. Programista może zakodować hasło bezpośrednio w kodzie Python (`API_KEY = "sk-abc123..."`), a `.gitignore` tego nie wyłapie — to nie jest plik z kropką, to plik `.py`. Skaner sekretów używa wzorców regex do przeszukiwania *zawartości* diffa, wychwytując zakodowane na stałe sekrety niezależnie od tego, w którym pliku się znajdują.
>
> **Dlaczego** dodaliśmy „dozwolone wyjątki" dla domyślnych ustawień `docker-compose.yml` zamiast po prostu ignorować wszystkie WARNy?
> Niuans. `POSTGRES_PASSWORD: postgres` w docker-compose.yml to domyślna wartość developerska nadpisywana przez zmienne środowiskowe w produkcji — to jest akceptowalne. Ale `POSTGRES_PASSWORD: moje_prawdziwe_haslo_produkcyjne` to prawdziwy wyciek. Tworząc jawną listę wyjątków, dokumentujemy *dlaczego* pewne wzorce są akceptowalne i nadal zmuszamy programistę do ich potwierdzenia. Żadnego cichego pomijania — operator zawsze widzi ostrzeżenie, nawet jeśli jest spodziewane.

### Przegląd kodu

Audyt bezpieczeństwa używa dopasowywania wzorców do wykrywania różnych kategorii ryzyka:

```markdown
| Pattern | Description | Action |
|---------|-------------|--------|
| `password\s*=\s*['"]` | Hardcoded password (code) | BLOCK |
| `PASSWORD[:=]\s*.+` (not in docker-compose) | Hardcoded password (config) | WARN |
| `sk-[a-zA-Z0-9]{20,}` | OpenAI/Anthropic API key | BLOCK |
| `ghp_[a-zA-Z0-9]{36}` | GitHub personal access token | BLOCK |
| `-----BEGIN.*PRIVATE KEY-----` | PEM private key | BLOCK |
```

Kluczowym rozróżnieniem między BLOCK a WARN jest odwracalność. Pozycja BLOCK (wyciekły klucz API) nie może zostać cofnięta — raz wypchnięta, klucz jest skompromitowany i musi zostać zmieniony. Pozycja WARN (domyślne hasło developerskie) jest akceptowalna, ale powinna zostać potwierdzona. Odzwierciedla to filozofię przekaźników zabezpieczeniowych: natychmiastowe wyzwolenie dla zwarć (BLOCK) vs. opóźniony alarm dla stanów nieprawidłowych (WARN).

Commit wzmacniający rozwiązał konkretny problem napotkany podczas Fazy 0: skaner bezpieczeństwa blokował `docker-compose.yml`, bo zawierał `POSTGRES_PASSWORD: postgres`. Jest to prawidłowa domyślna wartość developerska, a nie wyciek sekretu. Naprawa dodała wyjątki uwzględniające kontekst:

```markdown
**Allowed exceptions (WARN only, not BLOCK):**
- `docker-compose.yml` with `POSTGRES_PASSWORD: postgres` — local dev default
- `config.py` with `localhost` defaults — overridden in production
```

Uczy to ważnej lekcji: narzędzia bezpieczeństwa muszą być skalibrowane. Zbyt restrykcyjne — programiści je omijają. Zbyt łagodne — przegapiają prawdziwe problemy. Złoty środek to domyślna surowość z udokumentowanymi wyjątkami.

!!! tip "Kluczowa koncepcja: Shift-left security — wykrywaj problemy wcześnie"
    **Po ludzku:** Zamiast sprawdzać problemy bezpieczeństwa po tym, jak kod jest już w internecie, sprawdzaj je jak najwcześniej — najlepiej zanim kod w ogóle opuści Twój komputer.

    **Analogia:** To jak sprawdzanie pisowni podczas pisania, a nie po wysłaniu listu. Jeśli zauważysz błąd przed wysłaniem, po prostu go poprawiasz. Jeśli zauważysz po — musisz wysłać korektę, a odbiorca już widział błąd.

    **W tym projekcie:** Umiejętność github-push skanuje każdy diff pod kątem zakodowanych na stałe sekretów *przed* utworzeniem commita. Jeśli znajdzie klucz API w kodzie, całkowicie blokuje push. Jest to krytyczne, bo nasze repozytorium jest publiczne — gdy sekret zostanie wypchnięty do GitHub, jest w historii git na zawsze (nawet jeśli usuniesz plik w następnym commicie). Prewencja jest nieskończenie lepsza niż naprawianie.

---

## Sekcja 6: Automatyczne zarządzanie zależnościami — strażnik łańcucha dostaw

### Problem z realnego świata

Turbina wiatrowa składa się z tysięcy komponentów od setek dostawców. Jeśli producent śrub odkryje wadę w partii, każda turbina używająca tych śrub musi zostać skontrolowana. Producent wysyła powiadomienie o wycofaniu, a operator farmy wiatrowej aktualizuje harmonogram konserwacji. Zależności oprogramowania działają tak samo: gdy biblioteka publikuje łatkę bezpieczeństwa, każdy projekt używający tej biblioteki musi zostać zaktualizowany.

### Co mówią standardy

**NIST SP 800-53 (Kontrole bezpieczeństwa i prywatności)** — kontrola SA-12 wymaga od organizacji monitorowania łańcucha dostaw oprogramowania pod kątem luk i stosowania łatek w odpowiednim czasie. Dependabot automatyzuje to, skanując `pyproject.toml`, `package.json` i workflow GitHub Actions co tydzień oraz otwierając pull requesty dla aktualizacji.

### Co zbudowaliśmy

**Zmienione pliki:**
- `.github/dependabot.yml` — Cotygodniowe automatyczne sprawdzanie aktualizacji pip, npm i GitHub Actions
- Sześć PR-ów Dependabota scalone: bumpy GitHub Actions (checkout v4→v6, setup-python v5→v6, setup-node v4→v6, cache v4→v5, upload-artifact v4→v6, upload-pages-artifact v3→v4)
- Dwa PR-y zależności: eslint-plugin-react-hooks 5.2.0→7.0.1, aktualizacje pakietów frontendu

Konfiguracja Dependabota jest elegancko prosta — 32 wiersze chroniące cały łańcuch dostaw:

??? example "Pełna konfiguracja Dependabota"

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

### Dlaczego to jest ważne

> **Dlaczego** aktualizujemy wersje GitHub Actions (checkout v4→v6), skoro stare wersje nadal działają?
> Ponieważ GitHub Actions działają z podwyższonymi uprawnieniami — mają dostęp do sekretów repozytorium, mogą wypychać kod i wdrażać na produkcję. Luka w wersji akcji mogłaby skompromitować cały potok CI. Pozostawanie na najnowszej wersji zapewnia najnowsze łatki bezpieczeństwa. W świecie systemów elektroenergetycznych jest to odpowiednik aktualizacji firmware w przekaźnikach zabezpieczeniowych — przekaźnik nadal działa ze starym firmware, ale znane luki są naprawione w nowszych wersjach.
>
> **Dlaczego** Dependabot używa różnych prefiksów commitów (`[CI]` dla akcji, `[DEPS]` dla pakietów)?
> Identyfikowalność. Gdy przeglądasz log git, możesz natychmiast zobaczyć, które commity to aktualizacje infrastruktury, a które to aktualizacje zależności lub kod funkcji. Ta konwencja bezpośrednio odpowiada naszemu standardowi komunikatów commitów i ułatwia generowanie changelogów, audytowanie zmian zależności i zrozumienie historii na pierwszy rzut oka.

### Przegląd kodu

Przyjrzyj się faktycznym commitom Dependabota, które zostały scalone:

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

Każdy PR został automatycznie utworzony przez Dependabota, przejrzany i scalony. `#1` do `#7` to numery pull requestów — Dependabot je otworzył, CI zostało uruchomione i zostały scalone po przejściu testów. Jest to w pełni zautomatyzowany workflow aktualizacji łańcucha dostaw: wykryj → zaproponuj → przetestuj → scal.

!!! tip "Kluczowa koncepcja: Bezpieczeństwo łańcucha dostaw oprogramowania"
    **Po ludzku:** Twój projekt zależy od kodu napisanego przez innych ludzi (biblioteki, frameworki, narzędzia). Jeśli któryś z tych kodów ma błąd bezpieczeństwa, Twój projekt dziedziczy ten błąd. Bezpieczeństwo łańcucha dostaw oznacza śledzenie wszystkich zależności i aktualizowanie ich, gdy dostępne są poprawki.

    **Analogia:** Pomyśl o akcji serwisowej samochodu. Twój samochód jest sprawny, ale producent poduszek powietrznych odkrył wadę. Nie pisałeś kodu poduszki powietrznej, ale nadal musisz pojechać do dealera na naprawę. Dependabot jest jak automatyczny system powiadomień o akcjach serwisowych — informuje Cię o problemie i nawet zapisuje wizytę (otwiera PR) za Ciebie.

    **W tym projekcie:** Zależymy od FastAPI, React, sterowników PostgreSQL i dziesiątek innych pakietów. Dependabot sprawdza co poniedziałek nowe wersje, otwiera PR-y z aktualizacjami, a nasz potok CI testuje je automatycznie. Sześć bumpów GitHub Actions w pierwszym tygodniu demonstruje to w działaniu: Dependabot wykrył, że dostępna jest v6 dla actions/checkout, otworzył PR #6, CI przeszło i scaliliśmy — wszystko bez ręcznej interwencji.

---

## Połączenia

**Gdzie te koncepcje pojawiają się w następnych modułach:**

- **Health checks** (Sekcja 3) → Monitorowanie SCADA w P3 rozszerzy wzorce health checks Docker do pełnego monitorowania statusu turbin i podstacji
- **Konfiguracja oparta na środowisku** (Sekcja 2) → P1 będzie potrzebować poświadczeń ERA5 API wstrzykiwanych przez ten sam mechanizm Pydantic Settings
- **Bramki jakości CI** (Sekcja 4) → Testy modelu efektu cienia P1 i walidacje przepływu mocy P2 będą uruchamiane w dokładnie tych samych zadaniach CI
- **Skanowanie bezpieczeństwa** (Sekcja 5) → Klucze API ERA5 i poświadczenia bazy danych w P1+ będą chronione przez ten sam skaner sekretów
- **Dependabot** (Sekcja 6) → Gdy dodamy PyWake, Pandapower i biblioteki ML, Dependabot będzie monitorować ich aktualizacje bezpieczeństwa

---

## Szerszy obraz

*Fokus tej lekcji: warstwa **DevOps** owijająca stos aplikacji.*

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

## Najważniejsze wnioski

1. **Jedno źródło prawdy eliminuje niejednoznaczność** — jeden roadmap, jedna specyfikacja, jedno miejsce do sprawdzenia liczb turbin i poziomów napięcia.
2. **Pierwsza linia kodu powinna być health checkiem** — przed jakąkolwiek logiką domenową udowodnij, że serwis może się uruchomić i odpowiadać. Docker, Kubernetes i CI wszystkie od tego zależą.
3. **Konfiguracja należy do środowiska, nie do kodu** — Pydantic Settings daje bezpieczną typowo, zwalidowaną konfigurację bez boilerplate.
4. **Health checks Docker Compose zapobiegają warunkom wyścigu** — `depends_on: condition: service_healthy` zapewnia, że usługi startują we właściwej kolejności, a nie tylko we właściwej sekwencji.
5. **Defense in depth oznacza wiele niezależnych bramek jakości** — hooki pre-commit wychwytują problemy lokalnie, CI wychwytuje je w czystym środowisku, a skanowanie bezpieczeństwa wychwytuje sekrety, zanim dotrą do publicznego repozytorium.
6. **Narzędzia bezpieczeństwa muszą być skalibrowane, a nie tylko włączone** — zbyt restrykcyjne blokują legalny kod (fałszywe alarmy), zbyt łagodne przegapiają prawdziwe problemy. Wzorzec „dozwolonych wyjątków" dokumentuje, dlaczego pewne wzorce są akceptowalne.
7. **Automatyczne zarządzanie zależnościami to bezpieczeństwo łańcucha dostaw** — Dependabot monitoruje, proponuje i testuje aktualizacje, żebyś nie musiał pamiętać o ręcznym sprawdzaniu co tydzień.

---

## Quiz — sprawdź swoją wiedzę

### Pytania pamięciowe

**P1:** Jakie cztery usługi definiuje nasz stos Docker Compose i jakich portów używają?

<details>
<summary>Odpowiedź</summary>

Stos definiuje cztery usługi: PostgreSQL z TimescaleDB na porcie 5432, Redis 7 na porcie 6379, backend FastAPI na porcie 8000 i frontend React na porcie 3000. PostgreSQL używa obrazu `timescale/timescaledb:latest-pg16`, a Redis używa `redis:7-alpine` dla minimalnego rozmiaru.

</details>

**P2:** Jakie kategorie reguł lintowania ruff są włączone w naszym `pyproject.toml` i co każda kategoria sprawdza?

<details>
<summary>Odpowiedź</summary>

Włączonych jest dziewięć kategorii: E (błędy pycodestyle), W (ostrzeżenia pycodestyle), F (pyflakes — nieużywane importy, niezdefiniowane nazwy), I (isort — kolejność importów), N (pep8-naming — konwencje nazewnictwa funkcji/klas), UP (pyupgrade — modernizacja składni Pythona), B (flake8-bugbear — typowe błędy i problemy projektowe), SIM (flake8-simplify — niepotrzebnie złożony kod) i RUF (reguły specyficzne dla Ruff). Razem wychwytują problemy stylu, potencjalne błędy i możliwości użycia nowoczesnych funkcji Pythona.

</details>

**P3:** Jaka jest różnica między BLOCK a WARN w audycie bezpieczeństwa github-push?

<details>
<summary>Odpowiedź</summary>

Pozycje BLOCK są blokadami uniemożliwiającymi push w całości — wskazują na nieodwracalne zagrożenia bezpieczeństwa, takie jak wyciekłe klucze API lub klucze prywatne, które raz wypchnięte do publicznego repozytorium są trwale skompromitowane. Pozycje WARN to potencjalne problemy wymagające potwierdzenia użytkownika, które mogą być akceptowalne — jak domyślne hasła developerskie w docker-compose.yml nadpisywane przez zmienne środowiskowe w produkcji. Pozycje WARN są zawsze raportowane użytkownikowi; nigdy nie są cicho pomijane.

</details>

### Pytania rozumiejące

**P4:** Dlaczego nasz backend używa `condition: service_healthy` w `depends_on` zamiast zwykłego `depends_on: [postgres]`? Jakiemu trybowi awarii to zapobiega?

<details>
<summary>Odpowiedź</summary>

Samo wylistowanie `depends_on: [postgres]` zapewnia tylko, że kontener PostgreSQL *wystartował*, a nie że *jest gotowy do przyjmowania połączeń*. PostgreSQL potrzebuje kilku sekund na zainicjowanie katalogu danych, wykonanie odtwarzania WAL i otwarcie nasłuchiwacza TCP. Bez warunku health check backend próbowałby połączyć się w tym oknie inicjalizacji, otrzymałby błąd „connection refused" i potencjalnie ulegał awarii, zanim PostgreSQL byłby gotowy. Warunek `service_healthy` używa `pg_isready`, żeby sprawdzić, że PostgreSQL faktycznie akceptuje zapytania przed uruchomieniem backendu, eliminując ten warunek wyścigu.

</details>

**P5:** Dlaczego używamy zarówno hooków pre-commit, jak i sprawdzeń potoku CI? Czy jedno nie wystarczyłoby?

<details>
<summary>Odpowiedź</summary>

Pełnią komplementarne role w strategii defense-in-depth. Hooki pre-commit uruchamiają się natychmiast na maszynie programisty, dając natychmiastową informację zwrotną przed utworzeniem commita — wychwytują problemy z formatowaniem i błędy typów w sekundy. Jednak hooki można ominąć (`--no-verify`) i działają w lokalnym środowisku programisty, które może różnić się od środowiska CI. CI działa w czystym, odtwarzalnym środowisku (Ubuntu z konkretnymi wersjami Pythona/Node) i nie można go ominąć — jest autorytatywną bramką jakości. Razem zapewniają szybką lokalną informację zwrotną ORAZ niezawodną zdalną weryfikację, tak jak turbina wiatrowa ma zarówno hamulec mechaniczny, jak i aerodynamiczny dla redundancji.

</details>

**P6:** Dlaczego wybraliśmy Pydantic Settings do konfiguracji zamiast bezpośrednio używać `os.getenv()` lub pliku konfiguracyjnego YAML?

<details>
<summary>Odpowiedź</summary>

Pydantic Settings zapewnia trzy kluczowe zalety: bezpieczeństwo typów (automatycznie konwertuje `"5432"` na liczbę całkowitą, `'["http://localhost"]'` na listę), walidację (zawodzi głośno przy starcie, jeśli brakuje wymaganej zmiennej lub jest ona nieprawidłowo sformatowana, zamiast awaryjnie kończyć działanie w czasie wykonania) i dokumentację (sama klasa Settings służy jako schemat pokazujący wszystkie dostępne opcje konfiguracyjne z ich typami i wartościami domyślnymi). `os.getenv()` zwraca `Optional[str]` dla wszystkiego, wymagając ręcznej konwersji typów i sprawdzeń null rozproszonych po całym kodzie. Pliki konfiguracyjne YAML są trudniejsze do nadpisania per środowisko i ryzykują commitowanie z sekretami. Pydantic Settings podąża za zasadą 12-Factor App: konfiguracja w środowisku, walidowana na granicy.

</details>

### Pytanie wyzwanie

**P7:** Nasz bieżący Docker Compose używa `POSTGRES_PASSWORD: postgres` jako zakodowanej na stałe domyślnej wartości developerskiej. Zaprojektuj strategię konfiguracyjną, która działa dla trzech środowisk: lokalny development (prosty, bez dodatkowej konfiguracji), CI/CD (zautomatyzowany, bez interakcji człowieka) i produkcja (bezpieczna, audytowalna). Jak każde środowisko ustawiałoby hasło do bazy danych i jakich narzędzi lub mechanizmów byś użył?

<details>
<summary>Odpowiedź</summary>

**Lokalny development:** Zachowaj zakodowaną na stałe wartość domyślną `postgres:postgres` w docker-compose.yml. To udogodnienie dla programistów — mogą uruchomić `docker compose up` bez żadnej dodatkowej konfiguracji. Audyt bezpieczeństwa jawnie zezwala na to jako wyjątek WARN, bo jest nadpisywany w innych środowiskach.

**CI/CD:** Użyj sekretów GitHub Actions (`${{ secrets.DB_PASSWORD }}`) wstrzykiwanych jako zmienne środowiskowe do workflow CI. Hasło jest przechowywane zaszyfrowane w ustawieniach GitHub, nigdy nie pojawia się w logach (GitHub automatycznie je maskuje) i jest dostępne tylko dla workflow działających w repozytorium. `docker-compose.yml` używałby interpolacji zmiennych: `POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}` — domyślnie `postgres`, jeśli zmienna nie jest ustawiona (lokalny development), ale używając sekretu, gdy jest (CI).

**Produkcja:** Użyj menedżera sekretów (AWS Secrets Manager, HashiCorp Vault lub Azure Key Vault), który wstrzykuje poświadczenia przy starcie kontenera. Wdrożenie Kubernetes montowałoby sekret jako zmienną środowiskową przez SecretProviderClass (sterownik CSI) lub Kubernetes Secret. Hasło byłoby automatycznie rotowane przez menedżera sekretów zgodnie z harmonogramem, a cały dostęp byłby logowany dla audytowalności. Aplikacja odczytuje `DATABASE_URL` ze środowiska (Pydantic Settings obsługuje to), więc żadne zmiany kodu nie są potrzebne — różnią się tylko konfiguracje wdrożenia między środowiskami.

To wielowarstwowe podejście podąża za zasadą minimalnych uprawnień: programiści dostają wygodę, CI dostaje automatyzację, a produkcja dostaje bezpieczeństwo — wszystkie używając tego samego kodu aplikacji z różnymi mechanizmami konfiguracji.

</details>

---

## Rozmowa techniczna

### Wyjaśnij prosto
*„Jak wyjaśniłbyś infrastrukturę DevOps dla symulacji farmy wiatrowej osobie niebędącej inżynierem?"*

Budujemy symulację komputerową dużej farmy wiatrowej na Bałtyku — 34 wielkie turbiny wytwarzające wystarczająco dużo energii elektrycznej dla małego miasta. Zanim napiszemy ciekawsze rzeczy (jak wiatr przepływa między turbinami, jak elektryczność podróżuje przez kable, jak prognozować jutrzejszą produkcję energii), musimy zorganizować nasz warsztat.

Pomyśl o tym jak o budowie domu. Zanim zainstalujesz urządzenia kuchenne czy powiesisz zasłony, potrzebujesz fundamentów, szkieletu, hydrauliki i instalacji elektrycznej. To właśnie zrobiliśmy w tej fazie. Skonfigurowaliśmy cztery „pokoje" w naszym cyfrowym warsztacie: bazę danych do przechowywania danych (jak szafka na dokumenty), pamięć podręczną do szybkiego dostępu do częstych danych (jak tablica), serwer backendowy wykonujący obliczenia (jak biurko inżyniera) i frontend wyświetlający wyniki (jak ekrany w sterowni). Skonfigurowaliśmy też automatycznego inspektora, który sprawdza naszą pracę za każdym razem, gdy wprowadzamy zmianę — upewniając się, że nie wprowadziliśmy błędów ani przypadkowo nie opublikowaliśmy haseł. Wreszcie dodaliśmy automatyczny system sprawdzający, czy któreś z narzędzi, od których zależymy, zostały zaktualizowane — jak otrzymywanie powiadomień o akcjach serwisowych samochodów.

### Wyjaśnij technicznie
*„Jak wyjaśniłbyś fundament DevOps Fazy 0 komisji rekrutacyjnej?"*

Ustanowiliśmy infrastrukturę monorepo klasy produkcyjnej: backend FastAPI (Python 3.13, Pydantic v2, SQLAlchemy async), frontend React 19 (TypeScript strict, Tailwind v4) i usługi orkiestrowane przez Docker Compose (PostgreSQL 16 + TimescaleDB, Redis 7).

Potok CI/CD implementuje defense in depth: hooki pre-commit (Ruff, Mypy, ESLint) dla lokalnej informacji zwrotnej, GitHub Actions (cztery równoległe zadania z buforowaniem zależności) dla weryfikacji w czystym środowisku i niestandardowa umiejętność audytu bezpieczeństwa z klasyfikacją BLOCK/WARN do skanowania sekretów. Dependabot automatyzuje zarządzanie łańcuchem dostaw w ekosystemach pip, npm i GitHub Actions co tydzień.

Cała konfiguracja podąża za zasadami 12-Factor App przez Pydantic Settings — identyczny kod aplikacji we wszystkich środowiskach z jedynie różnicami konfiguracyjnymi. Ten fundament bezpośrednio wspiera P1-P5: TimescaleDB dla danych pogodowych ERA5, Redis do buforowania symulacji i CI do automatycznej walidacji modeli efektu cienia i obliczeń przepływu mocy względem norm IEC.
