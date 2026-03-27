# Lekcja 015 — Temporal Fusion Transformer (TFT): Wielohoryzontowe Prognozowanie Mocy z Mechanizmem Attention

!!! abstract "Nawigacja lekcji"
    :material-arrow-left: **Poprzednia:** [Lekcja 014 — LSTM szeregi czasowe: pomiar niepewności z MC Dropout](lesson-014.md) | **Następna:** [Lekcja 016 — Prognozowanie ensemble, wykrywanie ramp i ocena modeli](lesson-016.md) :material-arrow-right:

    **Faza:** P4 | **Język:** Polski | **Postęp:** 16 z 19 | [Wszystkie lekcje](index.md) | [Plan nauki](../../Learning_Roadmap.md)

> **Data:** 2026-02-26
> **Faza:** P4 (AI Forecasting)
> **Sekcje roadmapy:** [Phase 4 — Section 5.6 TFT Model, Section 5.7 Quantile Regression, Section 5.10 Attention]
> **Język:** Polski
> **Poprzednia lekcja:** Lesson 014

---

## Czego się nauczysz

- Dlaczego różne horyzonty prognozy (1h, 6h, 24h, 48h) wymagają różnych strategii modelowania
- Cztery kluczowe komponenty architektury Temporal Fusion Transformer (TFT): GRN, VSN, Multi-Head Attention, Quantile Outputs
- W jaki sposób mechanizm attention (uwagi) odpowiada na pytanie: „które historyczne kroki czasowe wpłynęły na prognozę?"
- Jak natywna quantile regression (pinball loss) generuje P10/P50/P90 jako alternatywa dla MC Dropout
- Jak Variable Selection Network (VSN) zapewnia wbudowany ranking istotności cech bez osobnego workflow SHAP

---

## Sekcja 1: Wielohoryzontowe prognozowanie — dlaczego jeden model nie wystarcza?

### Problem z realnego świata

Front sztormowy zbliża się nad Morze Bałtyckie. Operator systemu przesyłowego (PSE) musi podejmować różne decyzje w zależności od horyzontu czasowego:

| Horyzont | Decyzja | Dominujące źródło informacji |
|----------|---------|------------------------------|
| 1–6 godzin | Rynek bilansujący | Autokorelacja SCADA |
| 6–24 godziny | Oferta na rynek dnia następnego | Synoptyczna prognoza NWP |
| 24–48 godzin | Planowanie prac utrzymaniowych | Zmiany reżimów pogodowych |

XGBoost ocenia każdy wiersz niezależnie — sprawdza się na krótkich horyzontach. LSTM uczy się sekwencji 24-godzinnych — sprawdza się na średnich horyzontach. Żadna z tych architektur nie została jednak zaprojektowana tak, aby automatycznie decydować, które cechy i które historyczne chwile są krytyczne dla danego horyzontu prognozy. Właśnie tę lukę wypełnia TFT.

### Co mówią standardy

**IEC 61400-26-1** definiuje dwa główne podejścia do pomiaru niepewności:

1. **MC Dropout** (LSTM — Lekcja 014): jeden model jest trenowany, a niepewność jest generowana przez stochastyczne forward pass
2. **Quantile Regression** (XGBoost — Lekcja 013, TFT — ta lekcja): parametr τ jest dodawany do funkcji straty, generując bezpośrednio P10/P50/P90

TFT wbudowuje quantile regression w samą architekturę — istnieje osobna głowica wyjściowa (output head) dla każdego kwantyla. Daje to lepiej skalibrowane (calibrated) prognozy niż podejścia post-hoc.

**Lim et al. (2021):** „Temporal Fusion Transformers for Interpretable Multi-horizon Time Series Forecasting" — jedna z najpotężniejszych współczesnych architektur prognozowania szeregów czasowych.

---

## Sekcja 2: Architektura TFT — 4 kluczowe komponenty

### 2.1 Gated Residual Network (GRN)

GRN jest podstawowym blokiem budulcowym TFT. Jest używany wewnątrz każdego komponentu:

```
η₁ = W₁x + b₁
η₂ = W₂ · ELU(η₁) + b₂
GRN(x) = LayerNorm(x + GLU(η₂))
```

**GLU (Gated Linear Unit)**: dzieli wyjście na dwie połowy — jedna to wartość (value), druga to brama (gate). Brama przechodzi przez sigmoid i kontroluje przepływ informacji w zakresie 0–1. Gdy brama → 0, dane wejście jest całkowicie tłumione.

**Skip connection**: zachowuje przepływ gradientu i gwarantuje dostosowywalność (trainability) głębokich sieci.

### 2.2 Variable Selection Network (VSN)

VSN uczy się, jak ważna jest każda cecha wejściowa:

```
v_j = GRN_j(ξ_j)             dla każdej cechy j
weights = Softmax(GRN_w(ξ))   wagi selekcji
VSN(ξ) = Σ_j weights_j × v_j  suma ważona
```

Zapewnia to **wbudowaną istotność cech** bez konieczności stosowania SHAP. Przy prognozowaniu mocy wiatru VSN może nauczyć się:
- dla horyzontu 1h: `power_lag_1` i `wind_speed_mean` mają wysoką wagę
- dla horyzontu 24h: `nwp_wind_speed_100m` i `hour_cos` mają wysoką wagę

### 2.3 Multi-Head Attention

Z pracy Vaswani et al. (2017) „Attention Is All You Need":

```
Attention(Q,K,V) = softmax(QK^T / √d_k) · V
```

**Co to oznacza?**
- **Q (Query)**: „Jakiej informacji szukam?"
- **K (Key)**: „Tożsamość każdego historycznego kroku"
- **V (Value)**: „Informacja przechowywana w każdym historycznym kroku"

Wagi attention (attention weights) są **ekstrahowalnym** — pokazują, jak bardzo każdy historyczny krok czasowy przyczynił się do prognozy. Jeśli front pogodowy rozpoczął się 6 godzin temu, ten krok czasowy otrzymuje wysoką wagę attention.

### 2.4 Quantile Output Heads

W ostatniej warstwie osobna warstwa liniowa dla każdego kwantyla:

```python
self.quantile_heads = nn.ModuleList([
    nn.Linear(hidden_size, 1)  # P10
    nn.Linear(hidden_size, 1)  # P50
    nn.Linear(hidden_size, 1)  # P90
])
```

Podczas treningu stosowana jest **pinball loss**:

```
L_τ(y, ŷ) = τ × max(y-ŷ, 0) + (1-τ) × max(ŷ-y, 0)
L_total = L₀.₁₀ + L₀.₅₀ + L₀.₉₀
```

---

## Sekcja 3: Co zbudowaliśmy

### Nowe pliki

- `backend/app/services/p4/tft_model.py` — Kompletny model TFT: GRN, VSN, MultiHeadAttn, WindPowerTFT, trening, prognozowanie, wagi attention
- `backend/tests/test_tft_model.py` — 23 testy (GRN, VSN, Attention, Trening, Quantile, Prognoza, Ograniczenia, Attention)

### Zmienione pliki

- `backend/app/services/p4/__init__.py` — eksporty modułu TFT
- `backend/app/schemas/forecast.py` — schematy Pydantic dla TFT (TFTTrainRequest/Response, TFTPredictRequest/Response, TFTAttentionRequest/Response)
- `backend/app/routers/p4.py` — 3 nowe endpointy (train-tft, predict-tft, tft-attention)

### Podsumowanie architektury

```
Input (batch, lookback=72, n_features=19)
  ↓
Variable Selection Network (wagi softmax na cechę)
  ↓
LSTM Encoder (hidden=32, 1 warstwa) — kontekst czasowy
  ↓
Multi-Head Attention (2 głowice, d_model=32) — zależności długozasięgowe
  ↓
Gated Residual Network — nieliniowe wzbogacenie
  ↓
Quantile Output (3 głowice: P10, P50, P90) — natywna prognoza probabilistyczna
```

### Endpointy API

| Endpoint | Opis |
|----------|------|
| `POST /api/v1/forecast/train-tft` | Trening TFT + TimeSeriesSplit CV |
| `POST /api/v1/forecast/predict-tft` | Prognoza mocy P10/P50/P90 |
| `POST /api/v1/forecast/tft-attention` | Wagi attention + istotność cech VSN |

---

## Sekcja 4: Porównanie trzech modeli

| Cecha | XGBoost | LSTM | TFT |
|-------|---------|------|-----|
| Architektura | Drzewa decyzyjne | Rekurencyjna sieć neuronowa | Transformer + LSTM |
| Najlepszy horyzont | < 6 godzin | 6–24 godziny | 12–48 godzin |
| Metoda niepewności | Quantile regression | MC Dropout | Natywny quantile |
| Interpretowalność | SHAP | Ograniczona | Wagi attention + VSN |
| Szybkość treningu | Najszybszy | Średnia | Najwolniejszy |
| Wymagania danych | Najmniejsze | Średnie | Największe |

### Strategia ensemble (Roadmap §5.6)

```
< 6h:   0.50 × XGBoost + 0.30 × LSTM + 0.20 × TFT
6-24h:  0.20 × XGBoost + 0.40 × LSTM + 0.40 × TFT
24-48h: 0.10 × XGBoost + 0.30 × LSTM + 0.60 × TFT
```

---

## Sekcja 5: Ograniczenia fizyczne

Wyjścia TFT przechodzą przez ten sam moduł `physical_constraints.py` co XGBoost i LSTM:

1. **C1**: P ≥ 0 MW (brak ujemnej produkcji)
2. **C2**: P ≤ 15.0 MW (moc nominalna V236)
3. **C3**: v < 3.0 m/s → P = 0 (poniżej cut-in)
4. **C4**: v > 31.0 m/s → P = 0 (powyżej cut-out)
5. **Monotoniczność**: P10 ≤ P50 ≤ P90

---

## Sekcja 6: Zakres testów

23 testy w 8 klasach testowych:

| Klasa testowa | Liczba testów | Zakres |
|---------------|---------------|--------|
| TestGRN | 3 | Wymiar wyjścia, skip connection |
| TestVariableSelection | 3 | Wymiar wyjścia, suma wag, nieujemność |
| TestMultiHeadAttention | 3 | Wymiar wyjścia, zapis wag, suma=1 |
| TestTFTTraining | 5 | Ukończenie treningu, fold CV, early stopping, RMSE, architektura |
| TestTFTPrediction | 4 | Monotoniczność, kontrola ujemnych, moc nominalna, spójność długości |
| TestTFTPhysicalConstraints | 1 | Zerowa moc poniżej cut-in |
| TestTFTAttention | 4 | Wymiar attention, suma VSN, nazwy cech, liczba głowic |

---

## Rozmowa kwalifikacyjna

### Pytanie 1: Czym TFT różni się od XGBoost i LSTM?

**Wyjaśnij prosto:** XGBoost patrzy na każdy wiersz niezależnie, LSTM uczy się wzorców sekwencyjnych, ale prognozuje na jeden horyzont. TFT natomiast uczy się zarówno wzorców sekwencyjnych, jak i tego, które cechy i kroki czasowe są ważne — i robi to jednocześnie dla wielu horyzontów.

**Wyjaśnij technicznie:** TFT stosuje Variable Selection Network do per-feature gating (bez konieczności SHAP), LSTM encoder do przechwytywania krótkoterminowego kontekstu czasowego, Multi-Head Attention do wykrywania zależności długozasięgowych (nie wymaga O(n) kroków jak LSTM), oraz natywną quantile regression do bezpośredniego generowania P10/P50/P90. Łączy to tabelaryczną siłę XGBoost z temporalną siłą LSTM w jednej architekturze.

### Pytanie 2: Jak działa pinball loss i dlaczego jest preferowana zamiast MC Dropout?

**Wyjaśnij prosto:** Pinball loss karze model różnie w zależności od tego, czy rzeczywista wartość jest powyżej czy poniżej prognozy. Dla P90 bycie poniżej rzeczywistej wartości jest karane 9 razy bardziej. Pozwala to modelowi bezpośrednio nauczyć się żądanego kwantyla.

**Wyjaśnij technicznie:** L_τ(y,ŷ) = τ·max(y-ŷ,0) + (1-τ)·max(ŷ-y,0). Dla τ=0.9 niedoszacowanie (y>ŷ) jest karane wagą 0.9, a przeszacowanie wagą 0.1. MC Dropout zakłada rozkład Gaussowski (wyprowadza P10/P90 z z-score), podczas gdy pinball loss jest agnostyczna względem rozkładu. Przy asymetrycznych rozkładach (takich jak moc wiatru z granicą zera) pinball loss generuje lepiej skalibrowane prognozy.

### Pytanie 3: Jak interpretować wagi attention?

**Wyjaśnij prosto:** Wagi attention pokazują, na które momenty z przeszłości model „patrzył" bardziej podczas tworzenia prognozy. Jeśli dany krok czasowy sprzed 6 godzin otrzymuje wysoką wagę, oznacza to, że zdarzenie z tamtej chwili (np. początek frontu pogodowego) wpływa na dzisiejszą prognozę.

**Wyjaśnij technicznie:** W self-attention softmax Q·K^T/√d_k oblicza podobieństwo każdego kroku czasowego do wszystkich pozostałych kroków. W architekturze wielogłowicowej (multi-head) każda głowica uczy się osobnej podprzestrzeni zależności — jedna głowica może koncentrować się na wzorcu dobowym, inna na skali synoptycznej. Po uśrednieniu po głowicach uzyskuje się ogólną mapę istotności czasowej. W odróżnieniu od „czarnej skrzynki" jaką jest LSTM, jest to interpretowalny mechanizm wyjaśnialności, który można badać.
