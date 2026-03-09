# Lekcja 016 - Prognozowanie Ensemble, Detekcja Ramp i Ewaluacja Modeli

!!! abstract "Nawigacja Lekcji"
    :material-arrow-left: **Poprzednia:** [Lekcja 015 - TFT](lesson-015.md) | **Nastepna:** [Lekcja 017 - Commissioning Workflow i LOTO](lesson-017.md) :material-arrow-right:

    **Faza:** P4 | **Jezyk:** Polish | **Postep:** 15 z 17 przetlumaczonych lekcji tureckich | [Wszystkie lekcje](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Data:** 2026-02-27
> **Faza:** P4 (AI Forecasting)
> **Sekcje roadmapy:** [Phase 4 - Evaluation Metrics, Ensemble Methods and Ramp Detection]
> **Jezyk:** Polish
> **Poprzednia lekcja:** Lesson 015

---

## Czego Sie Nauczysz

- Dlaczego zaden pojedynczy model nie dominuje na kazdym horyzoncie
- Jak horyzontowo zalezne wagi ensemble poprawiaja uzytecznosc operacyjna prognozy
- Dlaczego detekcja ramp jest wazna dla pracy sieci niezaleznie od sredniego bledu
- Jak oceniac modele metrykami odzwierciedlajacymi nie tylko blad, ale tez skill

## Sekcja 1: Ensemble Zalezne od Horyzontu

Rozne modele sa najmocniejsze na roznych horyzontach prognozy. Krotkie horyzonty moga faworyzowac XGBoost, srednie LSTM, a dluzsze i bardziej interpretowalne TFT. Dlatego ensemble powinien zmieniac wagi zależnie od horyzontu.

## Sekcja 2: Detekcja Ramp

Operatorzy sieci potrzebuja wiedziec nie tylko, jaki bedzie sredni blad prognozy, ale tez kiedy moc zmieni sie gwałtownie. Detekcja ramp zamienia forecast w system wczesnego ostrzegania dla rezerw, bilansowania i kompensacji.

## Sekcja 3: Polaczenie Forecastingu z Praca Sieci

Lekcja laczy P4 z P2 i P3. Silne zdarzenia ramp-down moga uruchamiac alarmy operacyjne, uwage operatora i działania kompensacyjne. Forecasting staje sie wiec czescia eksploatacji systemu.

## Sekcja 4: Metryki Ewaluacji

Sam RMSE nie wystarcza. Potrzebne sa miary zalezne od horyzontu, ocena kwantyli, porownanie z baseline oraz skill score, aby stwierdzic, czy model rzeczywiscie cos wnosi.

## Najwazniejsze Wnioski

- Ensemble powinien odzwierciedlac mocne strony modeli na roznych horyzontach.
- Rampy sa operacyjnie krytyczne nawet przy dobrych srednich metrykach.
- Wyniki forecastingu moga bezposrednio zasilać workflow sieci i SCADA.
- Ewaluacja musi wyjsc poza jedna liczbe bledu.

## Miejsce na Rozmowe Techniczna

### Wyjasnij Prosto

Polaczylismy kilka modeli prognozy i dodalismy mechanizm ostrzegania, kiedy moc wiatrowa ma sie zmienic bardzo szybko.

### Wyjasnij Technicznie

Lekcja buduje ensemble zależne od horyzontu, dodaje klasyfikacje zdarzen ramp oraz stosuje bogatszy zestaw metryk do oceny probabilistycznych prognoz pod katem ich wartosci operacyjnej.

