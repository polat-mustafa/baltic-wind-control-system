# Lekcja 018 - Testy Odbiorowe FAT/SAT, Koordynacja Zabezpieczen i Bramka SAT

!!! abstract "Nawigacja Lekcji"
    :material-arrow-left: **Poprzednia:** [Lekcja 017 - Commissioning Workflow i LOTO](lesson-017.md) | **Nastepna:** Brak :material-arrow-right:

    **Faza:** P5 | **Jezyk:** Polish | **Postep:** 16 z 17 przetlumaczonych lekcji tureckich | [Wszystkie lekcje](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Data:** 2026-02-27
> **Faza:** P5 (Commissioning)
> **Sekcje roadmapy:** [Phase 5 - Testing and Commissioning, Protection Coordination]
> **Jezyk:** Polish
> **Poprzednia lekcja:** Lesson 017

---

## Czego Sie Nauczysz

- Dlaczego testy odbiorowe trzeba rozdzielic na kampanie fabryczne i obiektowe
- Jak reprezentowac tolerancje oraz kryteria testowe w strukturach danych
- Dlaczego koordynacja zabezpieczen jest kluczowa dla selektywnego wylaczania zwarc
- Jak bramka SAT blokuje energizacje, dopoki gotowosc nie zostanie udowodniona

## Sekcja 1: Factory Acceptance Testing

FAT potwierdza zgodnosc sprzetu ze specyfikacja jeszcze przed wysylka. W projektach offshore jest to szczegolnie wazne, bo naprawa wady po instalacji na morzu jest wielokrotnie drozsza niz wykrycie jej w fabryce.

## Sekcja 2: Site Acceptance Testing

SAT weryfikuje to, co wydarzylo sie po transporcie, montazu i integracji. Urzadzenie, ktore przeszlo FAT, nadal moze zawiesc na miejscu z powodu problemow instalacyjnych lub komunikacyjnych.

## Sekcja 3: Koordynacja Zabezpieczen

System zabezpieczen musi wylaczyc wlasciwy aparat we wlasciwym czasie. Koordynacja laczy nastawy, marginesy czasowe i sprawdzenie selektywnosci. Wplywa bezposrednio na bezpieczenstwo i dyspozycyjnosc.

## Sekcja 4: Bramka SAT

Bramka SAT jest ostatnia cyfrowa blokada przed energizacja. Jesli wymagane testy sa niekompletne lub poza tolerancja, program nie powinien ruszyc dalej.

## Najwazniejsze Wnioski

- FAT i SAT odpowiadaja na rozne pytania inzynierskie.
- Ustrukturyzowane limity testowe poprawiaja powtarzalnosc i traceability.
- Koordynacja zabezpieczen jest problemem selektywnego wylaczania, a nie sama lista nastaw.
- Bramka SAT jest cyfrowa bariera bezpieczenstwa przed energizacja.

## Miejsce na Rozmowe Techniczna

### Wyjasnij Prosto

Zbudowalismy zestaw testow odbiorowych i kontroli zabezpieczen, ktore musza przejsc przed bezpiecznym podaniem napiecia na farme.

### Wyjasnij Technicznie

Lekcja laczy kampanie FAT i SAT, rejestrowanie wynikow z tolerancjami, weryfikacje selektywnosci zabezpieczen oraz egzekwowanie bramki SAT jako ostatniej warstwy gotowosci w P5.
