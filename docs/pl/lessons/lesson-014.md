# Lekcja 014 - Prognozowanie Szeregów Czasowych LSTM: Estymacja Niepewnosci przez MC Dropout

!!! abstract "Nawigacja Lekcji"
    :material-arrow-left: **Poprzednia:** [Lekcja 013 - XGBoost Quantile Forecasting](lesson-013.md) | **Nastepna:** [Lekcja 015 - TFT](lesson-015.md) :material-arrow-right:

    **Faza:** P4 | **Jezyk:** Polish | **Postep:** 13 z 17 przetlumaczonych lekcji tureckich | [Wszystkie lekcje](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Data:** 2026-02-26
> **Faza:** P4 (AI Forecasting)
> **Sekcje roadmapy:** [Phase 4 - LSTM and Wind Power Forecasting]
> **Jezyk:** Polish
> **Poprzednia lekcja:** Lesson 013

---

## Czego Sie Nauczysz

- Dlaczego modele sekwencyjne sa przydatne, gdy porzadek czasowy ma duze znaczenie
- Jak bramki LSTM steruja pamiecia i przeplywem informacji
- Dlaczego MC Dropout mozna traktowac jako praktyczne przyblizenie niepewnosci bayesowskiej
- Jak projekt laczy tworzenie sekwencji, walidacje i fizyczne post-processing

## Sekcja 1: Dlaczego Modele Sekwencyjne Sa Potrzebne

XGBoost widzi kazdy rekord jako osobny wektor cech, ale szereg czasowy mocy niesie tez porzadek, utrzymywanie sie stanu i zmiany rezimu. LSTM zostaje wprowadzony po to, aby jawnie modelowac te zaleznosci.

## Sekcja 2: Mechanika Komorki LSTM

Komorka LSTM wykorzystuje bramki decydujace, co zapamietac, co zapomniec i co wypuscic na wyjscie. Dzięki temu lepiej radzi sobie ze sredniookresowa struktura czasowa niz prosty RNN.

## Sekcja 3: MC Dropout dla Niepewnosci

Wielokrotne uruchomienie inferencji z aktywnym dropout daje rozklad przewidywan zamiast jednej liczby. W projekcie rozklad ten zamieniany jest na pasma typu P10, P50 i P90.

## Sekcja 4: Pipeline Treningu i Walidacji

Tworzenie okien czasowych, normalizacja, walidacja TimeSeriesSplit i early stopping sa tu jednym spójnym workflow. Najwazniejsze jest zachowanie porzadku czasowego bez data leakage.

## Sekcja 5: Warstwa Bezpieczenstwa Fizycznego

Nawet prognoza sieci neuronowej musi respektowac fizyke turbiny. Wyniki koncowe sa wiec przycinane i porzadkowane tak, aby kwantyle byly monotoniczne, a moc pozostawala fizycznie wykonalna.

## Najwazniejsze Wnioski

- LSTM jest przydatny, gdy kolejnosc czasowa ma wartosc predykcyjna.
- MC Dropout daje praktyczna estymacje niepewnosci bez pelnego modelu bayesowskiego.
- Projekt walidacji jest tak samo wazny jak architektura sieci.
- Ograniczenia fizyczne obowiazuja rowniez po inferencji ML.

## Miejsce na Rozmowe Techniczna

### Wyjasnij Prosto

Nauczylismy model czytac sekwencje dawnych zachowan turbiny i jednoczesnie pokazywac, jak bardzo jest pewny swojej prognozy.

### Wyjasnij Technicznie

Lekcja wprowadza pipeline LSTM z sliding windows, poprawna czasowo walidacja, estymacja niepewnosci przez MC Dropout oraz model-agnostyczny fizyczny post-processing wynikow.
