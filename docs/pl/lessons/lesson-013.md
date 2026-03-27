# Lekcja 013 - Prognozowanie Kwantylowe XGBoost: Pipeline NWP, Probabilistyczna Prognoza Mocy i Wyjasnialnosc SHAP

!!! abstract "Nawigacja Lekcji"
    :material-arrow-left: **Poprzednia:** [Lekcja 012 - Pipeline Danych SCADA](lesson-012.md) | **Nastepna:** [Lekcja 014 - LSTM i MC Dropout](lesson-014.md) :material-arrow-right:

    **Faza:** P4 | **Jezyk:** Polski | **Postep:** 14 z 19 | [Wszystkie lekcje](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Data:** 2026-02-26
> **Faza:** P4 (AI Forecasting)
> **Sekcje roadmapy:** [Phase 4 - Quantile Forecasting, NWP Features and Explainability]
> **Jezyk:** Polski
> **Poprzednia lekcja:** Lesson 012

---

## Czego Sie Nauczysz

- Dlaczego XGBoost jest silnym baseline dla krotkich horyzontow prognozy mocy
- Jak cechy NWP uzupelniaja opoznione sygnaly SCADA
- Dlaczego quantile regression jest praktyczniejsza operacyjnie niz sama prognoza punktowa
- Jak SHAP pokazuje, ktore cechy napedzaja wynik modelu

## Sekcja 1: Dlaczego Najpierw XGBoost

Modele drzewiaste sa szybkie, odporne i skuteczne dla dobrze przygotowanych cech. W praktyce forecastingu offshore daja bardzo dobry punkt odniesienia, szczegolnie dla krotkich horyzontow.

## Sekcja 2: NWP i Feature Engineering

Jakosc prognozy rosnie, gdy historia SCADA zostaje polaczona z informacjami z modeli pogodowych. Dlatego feature engineering jest tutaj problemem fuzji danych atmosferycznych i danych z farmy.

## Sekcja 3: Prognozowanie Kwantylowe

Planowanie operacyjne wymaga pasm niepewnosci. Quantile forecasting zwraca bezposrednio P10, P50 i P90, dzieki czemu decyzje moga uwzgledniac ryzyko i rozrzut prognozy.

## Sekcja 4: Wyjasnialnosc SHAP

Model o dobrej trafnosci nadal musi byc zrozumialy dla inzyniera. SHAP rozklada pojedyncza predykcje na wklady cech, co poprawia transparentnosc i zaufanie.

## Najwazniejsze Wnioski

- XGBoost jest mocnym benchmarkiem dla krotkich horyzontow.
- Cechy SCADA i NWP nalezy laczyc, a nie rozdzielac.
- Wyjscia kwantylowe sa bardziej uzyteczne niz sama prognoza punktowa.
- Explainability wzmacnia wiarygodnosc modelu.

## Miejsce na Rozmowe Techniczna

### Wyjasnij Prosto

Zbudowalismy model, ktory przewiduje przyszla moc, pokazuje prawdopodobny zakres wyniku i wyjasnia, ktore dane byly najwazniejsze.

### Wyjasnij Technicznie

Lekcja ustanawia probabilistyczny stack XGBoost, ktory laczy cechy SCADA i NWP, optymalizuje cele kwantylowe i interpretuje predykcje przez atrybucje SHAP.
