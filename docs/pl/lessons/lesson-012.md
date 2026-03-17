# Lekcja 012 - Pipeline Danych SCADA: Krzywe Mocy, Produkcja Syntetyczna, Filtry Jakosci i Ograniczenia Fizyczne

!!! abstract "Nawigacja Lekcji"
    :material-arrow-left: **Poprzednia:** [Lekcja 011 - RBAC i Permit-to-Work](lesson-011.md) | **Nastepna:** [Lekcja 013 - Prognozowanie Kwantylowe XGBoost](lesson-013.md) :material-arrow-right:

    **Faza:** P3/P4 | **Jezyk:** Polish | **Postep:** 11 z 17 przetlumaczonych lekcji tureckich | [Wszystkie lekcje](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Data:** 2026-02-26
> **Faza:** przejscie P3 -> P4
> **Sekcje roadmapy:** [Phase 3 - Data Quality, Phase 4 - Forecasting Inputs]
> **Jezyk:** Polish
> **Poprzednia lekcja:** Lesson 011

---

## Czego Sie Nauczysz

- Dlaczego jakosc prognozy zaczyna sie od jakosci danych SCADA
- Jak generowac dane syntetyczne z zachowaniem podstawowej fizyki turbiny
- Dlaczego filtry jakosci musza usuwac wartosci niemozliwe jeszcze przed treningiem
- Jak ograniczenia fizyczne dzialaja jako wspolna warstwa bezpieczenstwa dla wielu modeli

## Sekcja 1: Jakosc Danych przed Zlozonoscia Modelu

Zaawansowany model nauczony na zlych danych wygeneruje tylko bardziej wyrafinowane bledy. Dlatego projekt traktuje walidacje i filtrowanie jako pierwszy etap inzynierii forecastingu.

## Sekcja 2: Produkcja Syntetyczna i Krzywe Mocy

Gdy realna historia jest ograniczona, dane syntetyczne pomagaja w rozwoju i testach. Musza jednak zachowac regiony pracy turbiny, moc nominalna i warunki zerowej produkcji poniżej cut-in i powyzej cut-out.

## Sekcja 3: Filtry Jakosci i Ograniczenia Fizyczne

Ujemna moc, niemozliwe temperatury, niespojne znaczniki czasu czy niezgodne pary wiatr-moc powinny byc naprawiane lub odrzucane przed trafieniem do zbioru treningowego.

## Najwazniejsze Wnioski

- Dobry forecasting zaczyna sie od wiarygodnych danych SCADA.
- Dane syntetyczne maja sens tylko przy zachowaniu ograniczen fizycznych.
- Filtry jakosci sa czescia modelowania inzynierskiego.
- Ograniczenia fizyczne mozna wspoldzielic miedzy roznymi modelami.

## Miejsce na Rozmowe Techniczna

### Wyjasnij Prosto

Uporzadkowalismy dane SCADA tak, aby kolejne modele nie uczyly sie zachowan niemozliwych dla turbiny.

### Wyjasnij Technicznie

Lekcja formalizuje physics-aware preprocessing dla SCADA: generowanie danych syntetycznych, zgodnosc z krzywa mocy, filtrowanie jakosci oraz wspolne ograniczenia fizyczne dla downstream ML.
