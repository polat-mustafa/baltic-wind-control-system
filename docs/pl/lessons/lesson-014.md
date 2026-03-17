# Lekcja 014 — LSTM prognozowanie szeregów czasowych: kwantyfikacja niepewności z MC Dropout

!!! abstract "Nawigacja lekcji"
    :material-arrow-left: **Poprzednia:** [Lekcja 013 — Kwantylowe prognozowanie XGBoost: potok NWP, probabilistyczne prognozowanie mocy i SHAP](lesson-013.md) | **Następna:** [Lekcja 015 — TFT: wielohoryzontowe prognozowanie mocy z mechanizmem uwagi](lesson-015.md) :material-arrow-right:

    **Faza:** P4 | **Język:** Polski | **Postęp:** 15 z 19 | [Wszystkie lekcje](index.md) | [Mapa nauki](../../Learning_Roadmap.md)

> **Data:** 2026-02-26
> **Faza:** P4 (AI Forecasting)
> **Sekcje roadmapy:** [Phase 4 — Section 4.3 LSTM, Section 4.4 Wind Power Forecasting]
> **Język:** Polski
> **Poprzednia lekcja:** Lesson 013

---

## Czego się nauczysz

- Dlaczego zależności czasowe są krytyczne w prognozowaniu mocy wiatru i jak mechanizm bramek (gates) LSTM je wychwytuje
- Jak Monte Carlo Dropout (Gal & Ghahramani, 2016) jest używany do bayesowskiej estymacji niepewności
- Równania komórki LSTM (forget/input/output gates) oraz wyprowadzanie kwantyli MC Dropout
- Trenowanie 2-warstwowego modelu LSTM w PyTorch, wczesne zatrzymanie (early stopping) i walidacja krzyżowa TimeSeriesSplit
- Przeprowadzanie rzetelnego porównania modeli LSTM i XGBoost na tym samym potoku danych

---

## Rozdział 1: Zależności czasowe — dlaczego kolejność ma znaczenie?

### Rzeczywisty problem

Front atmosferyczny przemieszcza się znad Morza Północnego w kierunku Bałtyku. O godzinie 06:00 wiatr wynosi 6 m/s, o 09:00 — 9 m/s, o 12:00 — 14 m/s. To jest zdarzenie rampowe (ramp event). Ponieważ moc turbiny zależy od prawa sześciennego (P ∝ v³), ten 2,3-krotny wzrost prędkości wiatru przekłada się na około 12-krotny wzrost mocy.

Modele tabelaryczne, takie jak XGBoost, traktują każdy krok czasowy niezależnie. Tak, możemy zakodować historię za pomocą cech opóźnionych (t-1, t-2, t-6), ale są to ręcznie zaprojektowane „okna". LSTM natomiast przyjmuje surową sekwencję 24-godzinną (144 kroków) i sam decyduje, które informacje z przeszłości są istotne.

### Co mówią standardy

**IEC 61400-26-1** wymaga kwantyfikacji niepewności (uncertainty quantification) dla prognoz mocy. Tradycyjne metody (ensemble, regresja kwantylowa) trenują deterministyczne modele z różnymi funkcjami strat. MC Dropout trenuje jeden model, a podczas wnioskowania (inference) pozostawia dropout aktywny, tworząc stochastyczny ensemble:

> **MC Dropout** (Gal & Ghahramani, 2016): Wielokrotne uruchamianie sieci neuronowej z dropout stanowi przybliżone próbkowanie bayesowskiego rozkładu posterior. Każde przejście w przód (forward pass) używa innej maski dropout i wybiera inną podsieć (sub-network).

Zapewnia to estymację niepewności na poziomie ensemble przy koszcie trenowania jednego modelu.

### Co zbudowaliśmy

**Nowe pliki:**

- `backend/app/services/p4/lstm_model.py` — model LSTM w PyTorch, prognozowanie MC Dropout, normalizacja
- `backend/tests/test_lstm_model.py` — 18 testów (tworzenie sekwencji, trenowanie, MC dropout, prognozowanie, ograniczenia fizyczne)

**Zmienione pliki:**

- `backend/app/services/p4/__init__.py` — eksporty modułu LSTM (re-exports)
- `backend/app/schemas/forecast.py` — schematy Pydantic dla LSTM (request/response)
- `backend/app/routers/p4.py` — 3 nowe endpointy (train-lstm, predict-lstm, lstm-mc-dropout)
- `backend/pyproject.toml` — dodano zależność PyTorch

### Dlaczego to ważne

> **Dlaczego** potrzebujemy LSTM, skoro XGBoost już dobrze działa?

XGBoost traktuje każdy wiersz niezależnie i uczy się interakcji cech. LSTM natomiast uczy się długodystansowych zależności (long-range dependencies) w surowym szeregu czasowym. 6-godzinny wzorzec frontu atmosferycznego, 30-minutowe zdarzenie rampowe — to struktury sekwencyjne. Rzeczywiste systemy prognozowania wiatru używają obu podejść i tworzą ensembles. To, które jest lepsze, zależy od zbioru danych, horyzontu prognozy i lokalizacji turbiny.

---

## Rozdział 2: Mechanika komórki LSTM — bramki (Gates)

### Prosta analogia

Wyobraź sobie komórkę LSTM jako magazyn z bramkami:

1. **Bramka zapominania (Forget Gate)** — f_t: „Ile ze starych informacji w magazynie zachowuję?" Jeśli front atmosferyczny minął, zapomnij stare wzorce wiatru.
2. **Bramka wejścia (Input Gate)** — i_t: „Ile z nowych informacji dodaję do magazynu?" Jeśli zaczęło się nowe zdarzenie rampowe, zapisz tę informację.
3. **Bramka wyjścia (Output Gate)** — o_t: „Ile informacji z magazynu przekazuję na zewnątrz?" Które informacje są najważniejsze przy tworzeniu prognozy?

### Formalizm matematyczny

Dla każdego kroku czasowego t komórka LSTM oblicza:

```
Bramka zapominania:   f_t = σ(W_f · [h_{t-1}, x_t] + b_f)
Bramka wejścia:       i_t = σ(W_i · [h_{t-1}, x_t] + b_i)
Aktualizacja komórki: c̃_t = tanh(W_c · [h_{t-1}, x_t] + b_c)
Stan komórki:         c_t = f_t ⊙ c_{t-1} + i_t ⊙ c̃_t
Bramka wyjścia:       o_t = σ(W_o · [h_{t-1}, x_t] + b_o)
Stan ukryty:          h_t = o_t ⊙ tanh(c_t)
```

Gdzie σ to funkcja sigmoid (wyjście [0,1]), ⊙ to iloczyn element-wise (Hadamard), a tanh ściska wyjście do zakresu [-1,1].

### Architektura

```
Wejście (batch, 144, 19) → LSTM(64) → Dropout(0.2) → LSTM(32) → Dropout(0.2) → Dense(1)
```

- **144 kroki czasowe**: 24 godziny × 6 kroków/godzinę (rozdzielczość 10 minut)
- **19 cech**: 14 inżynierowanych cech SCADA + 5 cech NWP
- **2 warstwy**: Pierwsza warstwa (64 jednostki) uczy się wzorców czasowych niskiego poziomu, druga warstwa (32 jednostki) uczy się abstrakcji wysokiego poziomu

### Analiza kodu — Klasa modelu

```python
class WindPowerLSTM(nn.Module):
    """2-layer LSTM for wind power forecasting with MC Dropout."""

    def __init__(self, n_features, hidden_units=(64, 32), dropout=0.2):
        super().__init__()
        h1, h2 = hidden_units
        self.lstm1 = nn.LSTM(input_size=n_features, hidden_size=h1, batch_first=True)
        self.dropout1 = nn.Dropout(p=dropout)
        self.lstm2 = nn.LSTM(input_size=h1, hidden_size=h2, batch_first=True)
        self.dropout2 = nn.Dropout(p=dropout)
        self.fc = nn.Linear(h2, 1)

    def forward(self, x):
        out, _ = self.lstm1(x)      # (batch, 144, 64)
        out = self.dropout1(out)     # MC Dropout: pozostaje aktywny w trybie train()
        out, _ = self.lstm2(out)     # (batch, 144, 32)
        out = self.dropout2(out)
        out = out[:, -1, :]          # Wyjście ostatniego kroku czasowego (batch, 32)
        return self.fc(out)          # (batch, 1)
```

**Kluczowa decyzja projektowa:** Używamy `nn.Dropout`, ponieważ w PyTorch dropout jest automatycznie aktywny w trybie `model.train()` i wyłączony w trybie `model.eval()`. Na potrzeby MC Dropout podczas wnioskowania wywołujemy `model.train()` — to „wycisza" różne neurony przy każdym przejściu w przód, tworząc stochastyczny ensemble.

---

## Rozdział 3: MC Dropout — bayesowska niepewność

### Teoria

Gal & Ghahramani (2016) pokazali, że: wielokrotne uruchamianie sieci neuronowej z dropout stanowi przybliżone wariacyjne wnioskowanie bayesowskie (variational Bayesian inference). Każde przejście w przód jest próbką z rozkładu posterior wag modelu.

Po T stochastycznych przejściach w przód:

```
Średnia:    μ = (1/T) Σ ŷ_t           — centralna prognoza (P50)
Wariancja:  σ² = (1/T) Σ (ŷ_t - μ)²  — niepewność epistemiczna
P10:        μ - 1.2816 × σ            — Gaussowski kwantyl 10%
P90:        μ + 1.2816 × σ            — Gaussowski kwantyl 90%
```

Gdzie 1.2816 to wynik z (z-score) dla 90% standardowego rozkładu normalnego.

### Dlaczego wynik z Gaussa?

Zgodnie z centralnym twierdzeniem granicznym, średnia wystarczająco wielu (T ≥ 30) niezależnych przejść MC zbiega do rozkładu normalnego. Używając T=100, spełniamy ten warunek. Pozwala to obliczać P10/P90 prostym mnożeniem przez wynik z, zamiast stosować złożoną regresję kwantylową — podejście przejrzyste i zrozumiałe dla celów edukacyjnych.

### Analiza kodu — MC Dropout

```python
def compute_mc_dropout_detail(model, features, norm_params, config):
    # Normalizuj i twórz sekwencje
    norm_features = _normalize_features_with_params(features, norm_params)
    x_seq, _ = create_sequences(norm_features, dummy_target, config.lookback)
    x_tensor = torch.tensor(x_seq, dtype=torch.float32)

    # KRYTYCZNE: model.train() — dropout pozostaje AKTYWNY
    model.train()
    all_passes = []
    for _ in range(config.mc_samples):  # 100 przejść
        with torch.no_grad():           # Bez obliczania gradientu (szybko)
            pred_norm = model(x_tensor).squeeze(-1).numpy()
        pred_mw = _denormalize_power(pred_norm, norm_params)
        all_passes.append(pred_mw)

    all_passes_array = np.array(all_passes)  # (100, n_steps)
    mc_mean = np.mean(all_passes_array, axis=0)
    mc_std = np.std(all_passes_array, axis=0)
```

Przy każdym przejściu różne neurony są „wyciszane" → różna prognoza → statystyczna niepewność.

---

## Rozdział 4: Potok danych — normalizacja → sekwencjonowanie → trenowanie

### Przepływ danych

```
Istniejący potok (współdzielony z XGBoost):
  SCADA → Filtry jakości → Inżynieria cech → Łączenie NWP → 2D (n, 19)

Kroki specyficzne dla LSTM:
  → Normalizacja Min-Max [0,1] → Okno przesuwne 3D (n_seq, 144, 19) → Trenowanie/Prognozowanie
  → MC Dropout (100 przejść) → μ ± 1.2816σ → P10/P50/P90
  → Ograniczenia fizyczne → Wymuszanie monotoniczności
```

### Dlaczego normalizacja?

Komórki LSTM używają aktywacji sigmoid i tanh — obie nasycają się (saturate) w zakresach [-1, 1] lub [0, 1]. Jeśli prędkość wiatru (0–30 m/s) i ciśnienie (95 000–105 000 Pa) zostaną podane razem bez normalizacji, gradienty ciśnienia zdominują i informacja o prędkości wiatru zostanie utracona. Normalizacja min-max sprowadza wszystkie cechy do zakresu [0, 1], rozwiązując ten problem.

### Dlaczego sekwencjonowanie po normalizacji?

Parametry normalizacji (min, max) są obliczane na zbiorze treningowym. Gdyby sekwencjonowanie było wykonywane najpierw, każde okno miałoby własne min/max — prowadząc do niespójności skali między oknami. Normalizacja całych danych przed podziałem na okna gwarantuje, że wszystkie kroki czasowe są na tej samej skali.

### Analiza kodu — Okno przesuwne

```python
def create_sequences(features, target, lookback=144):
    n_samples = features.shape[0]
    if n_samples < lookback:
        return empty arrays

    n_sequences = n_samples - lookback + 1
    x = np.zeros((n_sequences, lookback, n_features))
    y = np.zeros(n_sequences)

    for i in range(n_sequences):
        x[i] = features[i : i + lookback]  # Okno 24-godzinne
        y[i] = target[i + lookback - 1]    # OSTATNI krok okna → cel

    return x, y
```

**Ochrona przed wyciekiem z przyszłości:** `y[i]` zawsze odpowiada ostatniemu krokowi okna `x[i]`. Model nigdy nie może zobaczyć „przyszłych" wartości mocy jako danych wejściowych.

---

## Rozdział 5: Trenowanie — TimeSeriesSplit + wczesne zatrzymanie

### Walidacja krzyżowa

Używamy tej samej strategii TimeSeriesSplit co XGBoost (dla rzetelnego porównania):

```
Fold 1: Trening [0 .. N/4]     → Test [N/4 .. 2N/4]
Fold 2: Trening [0 .. 2N/4]    → Test [2N/4 .. 3N/4]
Fold 3: Trening [0 .. 3N/4]    → Test [3N/4 .. N]
```

W każdym foldzie okno treningowe rozszerza się (expanding window), okno testowe przesuwa się do przodu. Symuluje to ponowne trenowanie modelu na coraz większej ilości danych w czasie — tak jak dzieje się to w rzeczywistości.

### Wczesne zatrzymanie (Early Stopping)

```python
for epoch in range(config.epochs):  # max 100
    # Faza treningowa
    model.train()
    for batch_x, batch_y in train_loader:
        optimizer.zero_grad()
        pred = model(batch_x).squeeze(-1)
        loss = loss_fn(pred, batch_y)  # MSE
        loss.backward()
        optimizer.step()

    # Faza walidacyjna (dropout wyłączony)
    model.eval()
    with torch.no_grad():
        val_loss = loss_fn(model(x_val).squeeze(-1), y_val).item()

    # Sprawdzenie wczesnego zatrzymania
    if val_loss < best_val_loss:
        best_val_loss = val_loss
        patience_counter = 0
    else:
        patience_counter += 1
        if patience_counter >= config.patience:  # 10 epok cierpliwości
            break
```

**Dlaczego wczesne zatrzymanie?** Sieci LSTM są podatne na przeuczenie (overfitting) — modele parametryczne mogą „zapamiętać" dane treningowe. Przerywamy trening, gdy strata walidacyjna przestaje się poprawiać.

---

## Rozdział 6: Ograniczenia fizyczne — bezpieczeństwo niezależne od modelu

Warstwa ograniczeń fizycznych jest taka sama jak w XGBoost (projektowanie niezależne od modelu):

```python
# Zastosuj ograniczenia fizyczne osobno dla P10/P50/P90
p10 = enforce_physical_constraints(p10_raw, wind_speed)
p50 = enforce_physical_constraints(p50_raw, wind_speed)
p90 = enforce_physical_constraints(p90_raw, wind_speed)

# Monotoniczność: P10 ≤ P50 ≤ P90
p50 = np.maximum(p50, p10)
p90 = np.maximum(p90, p50)
```

Zasady IEC 61400-12-1:
- 0 ≤ P ≤ 15 MW (moc nominalna V236)
- v < 3,0 m/s → P = 0 (poniżej prędkości startowej)
- v > 31,0 m/s → P = 0 (powyżej prędkości wyłączenia, zatrzymanie bezpieczeństwa)

---

## Rozdział 7: Endpointy API

Dodano trzy nowe endpointy:

| Metoda | Ścieżka | Cel |
|--------|---------|-----|
| POST | `/api/v1/forecast/train-lstm` | Trenowanie z TimeSeriesSplit CV, zwraca metryki CV |
| POST | `/api/v1/forecast/predict-lstm` | MC Dropout → prognoza P10/P50/P90 |
| POST | `/api/v1/forecast/lstm-mc-dropout` | Wszystkie przejścia MC — dane do wizualizacji niepewności |

Wszystkie endpointy używają istniejącej funkcji pomocniczej `_build_xgboost_pipeline` — XGBoost i LSTM są trenowane na dokładnie tych samych danych, co gwarantuje rzetelne porównanie modeli.

---

## Rozdział 8: Decyzje projektowe

| Decyzja | Uzasadnienie |
|---------|-------------|
| **PyTorch (nie Keras)** | Naturalna kontrola dropout przez `model.train()` — niezbędna dla MC Dropout |
| **Ponowne użycie istniejącego potoku danych** | Rzetelne porównanie XGBoost vs LSTM (te same dane, te same cechy) |
| **Kwantyle z wynikiem z Gaussa** | Proste, przejrzyste dla celów edukacyjnych (P10 = μ - 1.2816σ) |
| **Kolejność normalizacja → sekwencjonowanie** | Wszystkie wartości w oknach mają tę samą skalę |
| **Ograniczenia fizyczne jako przetwarzanie końcowe** | Niezależne od modelu — ta sama warstwa stosowana do XGBoost i LSTM |

---

## Pokrycie testami

18 testów w 5 klasach testowych:

| Klasa testowa | Liczba testów | Co weryfikuje |
|---------------|--------------|---------------|
| `TestSequenceCreation` | 4 | Kształt 3D, brak wycieku z przyszłości, ciągłość okien, krótkie dane |
| `TestLSTMTraining` | 6 | Ukończenie, liczba foldów, wczesne zatrzymanie, skończone RMSE, parametry normalizacji, architektura |
| `TestMCDropout` | 3 | Wariancja między przejściami, nieujemne std, poprawna liczba przejść |
| `TestLSTMPrediction` | 4 | Monotoniczność kwantyli, brak ujemnych, poniżej wartości nominalnej, spójne długości |
| `TestLSTMPhysicalConstraints` | 1 | Zerowa moc poniżej prędkości startowej |

---

## Bank pytań

**P1:** W jakim scenariuszu bramka zapominania LSTM jest najbardziej krytyczna w prognozowaniu energii wiatru?

<details>
<summary>Odpowiedź</summary>

Podczas przejść frontów atmosferycznych. Front północny przez 6 godzin przynosił silny północny wiatr, po czym wiatr zmienił kierunek i prędkość spadła. Bramka zapominania rozpoznaje, że stary wzorzec północnego wiatru nie jest już aktualny i „usuwa" te informacje ze stanu komórki (cell state). Jeśli bramka zapominania nie działa prawidłowo, model pozostaje przywiązany do starego wzorca i nie wychwytuje spadku mocy podczas przejścia. Jest to szczególnie ważne w warunkach morskich, ponieważ fronty atmosferyczne powodują szybkie i dramatyczne zmiany wiatru.

</details>

**P2:** Dlaczego MC Dropout używa 100 przejść w przód? Co by się stało przy 10 lub 1000?

<details>
<summary>Odpowiedź</summary>

Zgodnie z Centralnym Twierdzeniem Granicznym, średnia T ≥ 30 niezależnych próbek zbiega do rozkładu normalnego. Przy T=10 estymacja odchylenia standardowego ma wysoką wariancję — w niektórych krokach czasowych prawdziwa niepewność jest niedoszacowana lub przeszacowana. T=1000 jest statystycznie dokładniejsze, ale zwiększa czas wnioskowania 10-krotnie; rzeczywisty system SCADA musi generować prognozy co 10 minut, więc budżet obliczeniowy jest ograniczony. T=100 to dobry punkt równowagi między stabilnością statystyczną a kosztem obliczeniowym. W środowisku produkcyjnym parametr ten jest dostosowywany do możliwości sprzętowych i wymagań dotyczących opóźnień.

</details>

**P3:** Dlaczego normalizację wykonujemy przed sekwencjonowaniem, a nie po?

<details>
<summary>Odpowiedź</summary>

Normalizacja po sekwencjonowaniu prowadziłaby do dwóch możliwych problemów: (1) Jeśli do każdej sekwencji zastosuje się własne min/max, powstaje niespójność skali między oknami — ta sama prędkość wiatru 10 m/s dałaby różne znormalizowane wartości w różnych oknach. (2) Jeśli zastosuje się globalne min/max do wszystkich sekwencji, problem zostaje rozwiązany, ale normalizacja jest niepotrzebnie skomplikowana. Normalizacja przed sekwencjonowaniem jest najczystszym rozwiązaniem: jedno min/max obliczone na macierzy 2D, następnie przekształcenie do 3D. Wszystkie okna są automatycznie na tej samej skali.

</details>

**P4:** Jaka jest fundamentalna różnica architektoniczna między XGBoost a LSTM? Kiedy preferować każdy z nich?

<details>
<summary>Odpowiedź</summary>

XGBoost jest modelem tabelarycznym — każdy wiersz to niezależna próbka, a model uczy się interakcji cech (podziałów drzew). LSTM jest modelem sekwencyjnym — przyjmuje 144 kolejnych kroków czasowych jako jedno wejście i za pomocą mechanizmu bramek samodzielnie uczy się, które informacje historyczne są ważne. XGBoost z dobrze zaprojektowanymi cechami (lag, rolling average, TI) jest zazwyczaj silny w krótkoterminowych prognozach i trenuje się szybko. LSTM ma przewagę w scenariuszach, gdzie długodystansowe wzorce czasowe (fronty 6–12-godzinne, cykle dobowe) są krytyczne, ale wymaga więcej danych i mocy obliczeniowej GPU. W środowisku produkcyjnym oba podejścia są zazwyczaj łączone w ensemble.

</details>

**P5:** Dlaczego warstwę ograniczeń fizycznych stosujemy jako przetwarzanie końcowe (post-processing), a nie osadzamy w modelu (w funkcji straty)?

<details>
<summary>Odpowiedź</summary>

Trzy powody: (1) **Niezależność od modelu**: Ten sam kod ograniczeń stosowany jest do XGBoost, LSTM i przyszłego modelu TFT bez żadnych modyfikacji. (2) **Rozdzielność**: Ograniczenia podczas trenowania mogą zniekształcać przestrzeń strat — gradienty są przerywane na granicach ograniczeń, co destabilizuje trening. Ograniczenia fizyczne jako przetwarzanie końcowe są deterministyczne i szybkie. (3) **Możliwość debugowania**: Możliwość obserwacji wyjścia modelu przed i po nałożeniu ograniczeń pozwala śledzić, gdzie model generuje fizycznie niespójne prognozy — co jest cennym sygnałem do poprawy modelu.

</details>

**P6:** Jaka jest różnica między `model.train()` a `model.eval()`? Dlaczego używamy `train()` w MC Dropout?

<details>
<summary>Odpowiedź</summary>

W PyTorch `model.train()` uruchamia warstwy takie jak dropout i batch normalization w trybie treningowym — dropout losowo wyłącza neurony, batch norm używa statystyk batcha zamiast statystyk bieżących. `model.eval()` wyłącza te zachowania — standardowe podejście dla deterministycznego wnioskowania. W MC Dropout celowo używamy `model.train()`, ponieważ chcemy, żeby dropout pozostał aktywny: każde przejście w przód „wycisza" inne neurony, tworząc inną podsieć, co daje stochastyczny ensemble. Wyłączamy obliczanie gradientu przez `torch.no_grad()`, oszczędzając pamięć i czas obliczeniowy — potrzebujemy tylko wariancji wyjścia, nie gradientów.

</details>

### Pytanie wyzwanie

**P7:** Obecna implementacja MC Dropout mierzy niepewność epistemiczną (niewiedzę modelu). Jak zmodyfikowalibyście model, żeby uchwycić również niepewność aleatoryczną (szum danych)?

<details>
<summary>Odpowiedź</summary>

Stosuje się podejście heteroscedastic regression: warstwę wyjściową modelu zmienia się z `Dense(1)` na `Dense(2)` — jedno wyjście to μ (średnia), drugie to log(σ²) (log wariancji). Funkcję straty zmienia się na Gaussowski ujemny log-likelihood: L = (1/2)log(σ²) + (y - μ)²/(2σ²). W ten sposób model generuje dla każdego kroku czasowego zarówno prognozę, jak i niepewność danych. W połączeniu z MC Dropout całkowita niepewność = aleatoryczna (σ² z wyjścia modelu) + epistemiczna (wariancja MC). Zostało to sformalizowane w Kendall & Gal (2017) „What Uncertainties Do We Need in Bayesian Deep Learning for Computer Vision?". W energii wiatru niepewność aleatoryczna pochodzi z turbulencji i szumu pomiarowego; niepewność epistemiczna wynika z warunków, których model nigdy nie widział w danych treningowych (ekstremalne burze, rzadkie zjawiska atmosferyczne).

</details>

---

## Kącik rozmowy kwalifikacyjnej

### Wyjaśnij prosto
*„Jak wytłumaczyłbyś prognozowanie mocy wiatru za pomocą LSTM osobie bez wiedzy technicznej?"*

W farmie wiatrowej 34 ogromne turbiny produkują prąd. Musimy wiedzieć z wyprzedzeniem, ile prądu wyprodukujemy jutro — bo złożyliśmy obietnicę sieci energetycznej. W tym celu pokazujemy komputerowi wszystkie dane z ostatnich 24 godzin: prędkość wiatru, temperaturę, ciśnienie atmosferyczne — co 10 minut, 144 pomiary. Komputer patrzy na tę sekwencję i odpowiada na pytania: „czy wiatr się wzmaga, czy słabnie, czy nadchodzi burza?"

Ale podanie jednej prognozy jest ryzykowne — co jeśli się mylimy? Dlatego zadajemy komputerowi to samo pytanie 100 razy, za każdym razem losowo zasłaniając część jego pamięci (jak zasłanianie oczu). Jeśli wszystkie 100 odpowiedzi jest do siebie zbliżonych, mówimy „model jest pewny". Jeśli odpowiedzi są bardzo rozbieżne, mówimy „model nie jest pewny — zachowaj ostrożność". Na końcu podajemy trzy liczby: najgorszy przypadek, oczekiwany przypadek, najlepszy przypadek. Trader energetyczny patrzy na te trzy liczby i może złożyć bezpieczną ofertę.

### Wyjaśnij technicznie
*„Jak przedstawiłbyś potok LSTM MC Dropout przed komisją rekrutacyjną?"*

Potok LSTM dodany do modułu P4 generuje probabilistyczne prognozy mocy oparte na sekwencjach (sequence-based) dla 510 MW farmy wiatrowej offshore. Architektura jest zaimplementowana w PyTorch: 2-warstwowy LSTM (64→32 jednostki), dropout 0,2 między warstwami, warstwa wyjściowa Dense(1). Wejście to 3D tensor z oknem przesuwnym 144 kroków czasowych (24 godziny, rozdzielczość 10 minut) i 19 cechami (14 inżynierowanych SCADA + 5 NWP).

Kwantyfikacja niepewności jest realizowana przez MC Dropout (Gal & Ghahramani, 2016): podczas wnioskowania model jest utrzymywany w trybie `train()` i wykonywanych jest 100 stochastycznych przejść w przód. Każde przejście próbkuje inną podsieć z inną maską dropout — stanowi to przybliżone wariacyjne próbkowanie rozkładu posterior. Z rozkładu wynikowego kwantyle P10 (μ-1,2816σ), P50 (μ) i P90 (μ+1,2816σ) są wyprowadzane za pomocą wyników z Gaussa.

Potok danych jest w pełni współdzielony z XGBoost (`_build_xgboost_pipeline`): produkcja SCADA → 5 filtrów jakości → inżynieria cech → łączenie NWP. Gwarantuje to rzetelne porównanie obu modeli. Normalizacja min-max jest stosowana przed sekwencjonowaniem (jednolita skala we wszystkich oknach). Walidacja krzyżowa TimeSeriesSplit (expanding window) zapobiega wyciekowi z przyszłości podczas trenowania. Optymalizator Adam + strata MSE + early stopping (patience=10) kontrolują przeuczenie.

Po wygenerowaniu prognozy stosowana jest ta sama niezależna od modelu warstwa ograniczeń fizycznych: 0 ≤ P ≤ 15 MW, zasady cut-in/cut-out (IEC 61400-12-1) i monotoniczność kwantyli (P10 ≤ P50 ≤ P90). Potok jest udostępniany przez 3 endpointy FastAPI i pokryty 18 testami pytest — weryfikującymi spójność fizyczną i statystyczną od kształtu sekwencji po wariancję MC.
