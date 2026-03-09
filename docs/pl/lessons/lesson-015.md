# Lekcja 015 - Temporal Fusion Transformer (TFT): Wielohoryzontowe Prognozowanie Mocy z Mechanizmem Attention

!!! abstract "Nawigacja Lekcji"
    **Poprzednia:** [Lekcja 014 - LSTM i MC Dropout](lesson-014.md) | **Nastepna:** [Lekcja 016 - Prognozowanie Ensemble, Detekcja Ramp i Ewaluacja Modeli](lesson-016.md)

    **Faza:** P4 | **Jezyk:** Polish | **Postep:** 14 z 17 przetlumaczonych lekcji tureckich | [Wszystkie lekcje](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Data:** 2026-02-26
> **Faza:** P4 (AI Forecasting)
> **Sekcje roadmapy:** [Phase 4 - Section 5.6 TFT Model, Section 5.7 Quantile Regression, Section 5.10 Attention]
> **Jezyk:** Polish
> **Poprzednia lekcja:** Lesson 014

---

## Czego Sie Nauczysz

- Dlaczego rozne horyzonty prognozy, takie jak 1 h, 6 h, 24 h i 48 h, wymagaja roznych strategii modelowania
- Jakie sa cztery glowne elementy architektury Temporal Fusion Transformer: GRN, VSN, Multi-Head Attention i Quantile Outputs
- W jaki sposob mechanizm attention odpowiada na pytanie: "ktore historyczne kroki czasowe wplynely na prognoze?"
- Dlaczego native quantile regression z pinball loss potrafi zwracac P10, P50 i P90 bez korzystania z MC Dropout
- Jak Variable Selection Network zapewnia wbudowany ranking istotnosci cech bez dodatkowego workflow SHAP

---

## Sekcja 1: Wielohoryzontowe Prognozowanie - Dlaczego Jeden Model Nie Wystarcza

### Problem z Rzeczywistego Swiata

Front sztormowy zbliza sie nad Morze Baltyckie. Operator systemu przesylowego, PSE, musi podejmowac rozne decyzje w zaleznosci od horyzontu prognozy:

| Horyzont | Typowa decyzja | Dominujace zrodlo informacji |
| --- | --- | --- |
| 1-6 godzin | Dzialania na rynku bilansujacym | Autokorelacja SCADA |
| 6-24 godziny | Oferty na rynku dnia nastepnego | Synoptyczna prognoza NWP |
| 24-48 godzin | Planowanie prac utrzymaniowych | Zmiany rezyimu pogodowego |

XGBoost traktuje kazdy wiersz niezaleznie, dlatego dobrze radzi sobie na krotkich horyzontach przy dobrze przygotowanych lag features. LSTM dobrze odtwarza strukture czasowa, zwlaszcza na srednich horyzontach. Zadna z tych architektur nie zostala jednak zaprojektowana tak, aby jednoczesnie wskazywac, ktore cechy i ktore chwile z przeszlosci sa najwazniejsze dla danego horyzontu prognozy. Wlasnie te luke wypelnia TFT.

### Co Mowia Standardy i Literatura

W repozytorium stosowane sa dwie glowne rodziny metod prognozowania niepewnosci:

1. **MC Dropout** - wykorzystany w LSTM w poprzedniej lekcji do estymacji niepewnosci przez wielokrotne losowe forward pass.
2. **Quantile regression** - wykorzystany w XGBoost i TFT do bezposredniego przewidywania P10, P50 i P90 przez funkcje straty.

Kluczowym odniesieniem akademickim jest praca Lim et al. (2021), *Temporal Fusion Transformers for Interpretable Multi-horizon Time Series Forecasting*. Najwieksza zaleta TFT polega na tym, ze interpretowalnosc i prognozowanie probabilistyczne sa wpisane w sama architekture, zamiast byc dodawane dopiero po treningu.

---

## Sekcja 2: Architektura TFT - Cztery Glowne Bloki

### 2.1 Gated Residual Network (GRN)

Gated Residual Network jest podstawowym blokiem nieliniowego przetwarzania wewnatrz TFT.

```text
eta1 = W1 x + b1
eta2 = W2 · ELU(eta1) + b2
GRN(x) = LayerNorm(x + GLU(eta2))
```

Najwazniejsze sa tutaj dwa elementy:

- **GLU (Gated Linear Unit)** steruje tym, ile informacji moze przejsc dalej.
- **Residual / skip connection** utrzymuje przeplyw gradientu i stabilizuje uczenie glebszej architektury.

Z inzynierskiego punktu widzenia GRN zachowuje sie jak adaptacyjna bramka. Jesli przetworzony sygnal nie wnosi wartosci prognostycznej, siec moze go stlumic zamiast propagowac szum dalej.

### 2.2 Variable Selection Network (VSN)

Variable Selection Network uczy sie wzglednej istotnosci poszczegolnych cech wejsciowych.

```text
v_j = GRN_j(xi_j)
weights = Softmax(GRN_w(xi))
VSN(xi) = Sum_j weights_j × v_j
```

Oznacza to, ze model nie traktuje wszystkich cech rownowaznie. Uczy sie, ktore zmienne sa najwazniejsze w danym kontekscie prognostycznym.

Dla offshore wind forecasting zwykle oznacza to, ze:

- dla **1 h** dominowac beda ostatnie lagi mocy i predkosci wiatru,
- dla **24 h** wieksza wage uzyskaja NWP wind speed i cechy cykliczne, takie jak hour-of-day.

### 2.3 Multi-Head Attention

Mechanizm attention opiera sie na formulacji z transformera wprowadzonej przez Vaswani et al. (2017):

```text
Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) · V
```

Interpretacja:

- **Query** - jakiej informacji aktualnie szukamy,
- **Key** - jak reprezentowany jest kazdy historyczny krok,
- **Value** - jaka informacja jest w tym kroku przechowywana.

Najwieksza praktyczna korzyscia jest interpretowalnosc. Wagi attention mozna wyekstrahowac i zwizualizowac, aby pokazac, ktore fragmenty historii najsilniej wplynely na prognoze.

### 2.4 Quantile Output Heads

Warstwa wyjsciowa zawiera osobne glowice dla kazdego kwantyla.

```python
self.quantile_heads = nn.ModuleList([
    nn.Linear(hidden_size, 1),  # P10
    nn.Linear(hidden_size, 1),  # P50
    nn.Linear(hidden_size, 1),  # P90
])
```

Do treningu stosowana jest **pinball loss**:

```text
L_tau(y, y_hat) = tau × max(y-y_hat, 0) + (1-tau) × max(y_hat-y, 0)
L_total = L_0.10 + L_0.50 + L_0.90
```

Dzieki temu model od razu generuje prognoze probabilistyczna zamiast najpierw przewidywac wartosc srednia, a niepewnosc dodawac pozniej.

---

## Sekcja 3: Co Zostal Zbudowane

### Nowe Pliki

- `backend/app/services/p4/tft_model.py` - pelna implementacja TFT z GRN, VSN, attention, treningiem, inferencja i ekstrakcja wag attention
- `backend/tests/test_tft_model.py` - testy jednostkowe i integracyjne workflow prognozowania TFT

### Zmienione Pliki

- `backend/app/services/p4/__init__.py` - eksport modulow
- `backend/app/schemas/forecast.py` - schematy request/response dla TFT
- `backend/app/routers/p4.py` - endpointy do treningu, inferencji i inspekcji attention

### Podsumowanie Architektury

```text
Input (batch, lookback=72, n_features=19)
  -> Variable Selection Network
  -> LSTM encoder
  -> Multi-Head Attention
  -> Gated Residual Network
  -> Quantile heads (P10, P50, P90)
```

### Endpointy API

| Endpoint | Cel |
| --- | --- |
| `POST /api/v1/forecast/train-tft` | trening TFT z walidacja TimeSeriesSplit |
| `POST /api/v1/forecast/predict-tft` | zwrot probabilistycznej prognozy mocy |
| `POST /api/v1/forecast/tft-attention` | zwrot wag attention i score Variable Selection |

---

## Sekcja 4: Porownanie XGBoost, LSTM i TFT

| Cecha | XGBoost | LSTM | TFT |
| --- | --- | --- | --- |
| Architektura | Gradient-boosted trees | Recurrent neural network | LSTM + transformer-style attention |
| Najlepszy horyzont | < 6 h | 6-24 h | 12-48 h |
| Metoda niepewnosci | Quantile regression | MC Dropout | Native quantile heads |
| Explainability | SHAP | Ograniczona | Attention + VSN |
| Szybkosc treningu | Najwyzsza | Srednia | Najnizsza |
| Wymagania danych | Najmniejsze | Srednie | Najwieksze |

### Strategia Ensemble

W praktycznym systemie trzy modele czesto sa laczone:

```text
< 6 h:   0.50 × XGBoost + 0.30 × LSTM + 0.20 × TFT
6-24 h:  0.20 × XGBoost + 0.40 × LSTM + 0.40 × TFT
24-48 h: 0.10 × XGBoost + 0.30 × LSTM + 0.60 × TFT
```

To odzwierciedla fakt, ze zaden pojedynczy model nie dominuje rownomiernie na wszystkich horyzontach.

---

## Sekcja 5: Ograniczenia Fizyczne

Wyjscia TFT przechodza przez te sama warstwe ograniczen fizycznych co pozostale modele forecastingowe:

1. `P >= 0 MW`
2. `P <= 15.0 MW`
3. `wind speed < 3.0 m/s -> P = 0`
4. `wind speed > 31.0 m/s -> P = 0`
5. `P10 <= P50 <= P90`

Te reguly nie sa opcjonalne. Zapewniaja zgodnosc prognozy z fizyka niezaleznie od architektury modelu.

---

## Sekcja 6: Zakres Testow

Modul TFT jest pokryty testami w osmiu obszarach:

| Grupa testow | Zakres |
| --- | --- |
| `TestGRN` | shape i residual behaviour |
| `TestVariableSelection` | poprawne wagi i shape wyjscia |
| `TestMultiHeadAttention` | zapis attention i normalizacja |
| `TestTFTTraining` | zakonczenie treningu, foldy CV, early stopping |
| `TestTFTPrediction` | monotoniczne kwantyle i poprawne wyjscia |
| `TestTFTPhysicalConstraints` | enforcement cut-in i cut-out |
| `TestTFTAttention` | wymiary attention i etykiety cech |

---

## Pytania Rekrutacyjne

### Pytanie 1: Czym TFT rozni sie od XGBoost i LSTM?

**Prosto:** XGBoost jest mocny w tabular short-horizon forecasting, LSTM dobrze uczy sie sekwencji, a TFT laczy uczenie sekwencyjne, wbudowany feature selection, attention i bezposrednie kwantyle w jednej architekturze.

**Technicznie:** TFT wykorzystuje Variable Selection Networks do feature-wise gating, rekurencyjne kodowanie do modelowania kontekstu czasowego, Multi-Head Attention do dlugozasiegowych zaleznosci oraz native quantile heads do bezposredniego P10/P50/P90. Dzieki temu laczy interpretowalnosc i forecasting probabilistyczny bardziej naturalnie niz XGBoost albo standardowy LSTM.

### Pytanie 2: Dlaczego stosowac pinball loss zamiast MC Dropout?

**Prosto:** Pinball loss uczy model przewidywac konkretny kwantyl bezposrednio, podczas gdy MC Dropout estymuje niepewnosc posrednio przez wiele losowych predykcji.

**Technicznie:** Pinball loss jest asymetryczna i zalezy od wybranego kwantyla. Dla tau = 0.9 niedoszacowanie jest karane znacznie mocniej niz przeszacowanie. To sprawia, ze siec uczy sie docelowego kwantyla bez przyjmowania z gory gaussowskiego ksztaltu niepewnosci.

### Pytanie 3: Jak interpretowac attention weights?

**Prosto:** Pokazuja, na ktorych historycznych krokach czasowych model polegal najmocniej, budujac prognoze.

**Technicznie:** Attention scores tworza mape istotnosci w czasie. W systemie offshore wind wysokie wagi dla konkretnego bloku historii moga wskazywac, ze model sledzi nadejscie frontu pogodowego, cykl dobowy albo inny stabilny rezyim pracy.

---

## Wyjasnij Prosto

Dzisiaj dodalismy model prognostyczny, ktory potrafi spojrzec daleko w przeszlosc i sam zdecydowac, ktore sygnaly historyczne sa najwazniejsze dla przewidywania przyszlej mocy farmy wiatrowej. Zamiast zwracac tylko jedna liczbe, potrafi tez podac bezpieczny zakres pesymistyczny i optymistyczny, co jest kluczowe dla operatorow i traderow.

## Wyjasnij Technicznie

W tej lekcji wprowadzono pipeline Temporal Fusion Transformer dla wielohoryzontowego prognozowania mocy offshore wind. Implementacja laczy variable selection, rekurencyjne kodowanie kontekstu czasowego, attention-based interpretability oraz bezposrednie quantile outputs w jednej rodzinie modeli. W porownaniu z poprzednimi implementacjami XGBoost i LSTM, TFT jest najbardziej ekspresyjny i najbardziej wymagajacy obliczeniowo, ale jednoczesnie najlepiej pasuje do dlugohoryzontowego forecastingu probabilistycznego i inspekcji istotnosci cech.

