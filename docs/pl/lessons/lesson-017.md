# Lekcja 017 - P5 Commissioning: Program Przelaczen, Maszyna Stanow Urzadzen i Zarzadzanie Izolacja LOTO

!!! abstract "Nawigacja Lekcji"
    :material-arrow-left: **Poprzednia:** [Lekcja 016 - Ensemble Forecasting](lesson-016.md) | **Nastepna:** [Lekcja 018 - FAT/SAT i Koordynacja Zabezpieczen](lesson-018.md) :material-arrow-right:

    **Faza:** P5 | **Jezyk:** Polish | **Postep:** 15 z 17 przetlumaczonych lekcji tureckich | [Wszystkie lekcje](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Data:** 2026-02-27
> **Faza:** P5 (Commissioning)
> **Sekcje roadmapy:** [Phase 5 - HV Switching and Safety, Testing and Commissioning]
> **Jezyk:** Polish
> **Poprzednia lekcja:** Lesson 016

---

## Czego Sie Nauczysz

- Dlaczego logika commissioningu musi byc opisana jako jawne przejscia stanow
- Jak program przelaczen wymusza kolejnosc, preconditions i kroki weryfikacyjne
- Dlaczego zarzadzanie izolacja LOTO powinno byc czescia modelu operacyjnego
- Jak API bezpiecznie udostepnia wykonanie programu

## Sekcja 1: Maszyny Stanow Urzadzen

Aparatura WN nie przechodzi dowolnie miedzy stanami. Stany open, closed, earthed, isolated i intermediate maja fizyczne znaczenie. Jawne mapy przejsc zapobiegaja dopuszczeniu niemozliwych lub niebezpiecznych akcji.

## Sekcja 2: Zarzadzanie Izolacja LOTO

LOTO nie jest formalnoscia administracyjna, lecz kontrola izolacji energii. Traktowanie punktow izolacji jako obiektow workflow pozwala sledzic, co jest zablokowane, przez kogo i dla jakiego programu.

## Sekcja 3: Wykonanie Programu Przelaczen

Profesjonalny program przelaczen jest sekwencyjny z definicji. Preconditions, akcja, weryfikacja i zatwierdzenie musza byc spelnione przed przejsciem dalej.

## Sekcja 4: API i Dyscyplina Workflow

REST API nie zastepuje autorytetu HV. Udostepnia stan programu, zadania wykonawcze, decyzje PiC i emergency stop w formie kontrolowanej i przydatnej dla symulacji.

## Najwazniejsze Wnioski

- Logike commissioningu trzeba modelowac, a nie improwizowac.
- State machine ujawnia i blokuje niebezpieczne przejscia.
- Sledzenie LOTO jest czescia cyfrowego zarzadzania bezpieczenstwem.
- API musi odzwierciedlac granice odpowiedzialnosci operacyjnej.

## Miejsce na Rozmowe Techniczna

### Wyjasnij Prosto

Zamienilismy przelaczenia wysokiego napiecia i izolacje w cyfrowy workflow krok po kroku, ktory pozwala poruszac sie tylko po bezpiecznych stanach.

### Wyjasnij Technicznie

Lekcja ustanawia model commissioningu sterowany przez state machine, z sekwencjonowaniem programu, obiektami LOTO, wykonaniem pod nadzorem PiC i kontrolowanymi powierzchniami API dla symulacji P5.
