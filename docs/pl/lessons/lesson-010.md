# Lekcja 010 - Symulacja GOOSE, Oś Czasu Zabezpieczen i Endpointy SCADA API

!!! abstract "Nawigacja Lekcji"
    :material-arrow-left: **Poprzednia:** [Lekcja 009 - Model Danych IEC 61850](lesson-009.md) | **Nastepna:** [Lekcja 011 - IEC 62443 RBAC i Permit-to-Work](lesson-011.md) :material-arrow-right:

    **Faza:** P3 | **Jezyk:** Polish | **Postep:** 9 z 17 przetlumaczonych lekcji tureckich | [Wszystkie lekcje](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Data:** 2026-02-25
> **Faza:** P3 (SCADA and Automation)
> **Sekcje roadmapy:** [Phase 3 - GOOSE Behaviour, Protection and API Design]
> **Jezyk:** Polish
> **Poprzednia lekcja:** Lesson 009

---

## Czego Sie Nauczysz

- Dlaczego zdarzenia zabezpieczeniowe trzeba opisywac na osi milisekund, a nie jako zwykle alarmy
- Czym komunikacja GOOSE rozni sie od zwyklego odpytywania SCADA
- Jak uczciwie uproscic symulacje edukacyjna bez przeklamania architektury
- W jaki sposob endpointy API udostepniaja workflow ochronny bez mylenia warstw systemu

## Sekcja 1: GOOSE i Skala Czasowa Zabezpieczen

GOOSE sluzy do bardzo szybkiej wymiany komunikatow peer-to-peer. Nalezy do warstwy zabezpieczen i automatyki, a nie do wolnego nadzoru operatorskiego. Dlatego w lekcji kluczowe sa sekwencja i opoznienia.

## Sekcja 2: Symulacja Zaklocenia i Kolejnosc Zdarzen

Poprawnosc zabezpieczen zalezy od kolejnosci: detekcja zwarcia, publikacja komunikatu, otwarcie wylacznika i potwierdzenie stanu. Oś czasu pozwala sprawdzic selektywnosc i opoznienia.

## Sekcja 3: Integracja z SCADA API

Repozytorium potrzebuje endpointow do obserwacji i sterowania edukacyjnego, ale musi byc jasno zaznaczone, ze HTTP nie jest rzeczywistym transportem ochronnym. Taka granica chroni realizm techniczny.

## Najwazniejsze Wnioski

- Logika zabezpieczen dziala szybciej niz klasyczna interakcja SCADA.
- Kolejnosc zdarzen jest tak samo wazna jak same zdarzenia.
- Uproszczenia edukacyjne sa dopuszczalne tylko wtedy, gdy sa uczciwie opisane.
- Projekt API musi szanowac granice miedzy symulacja a prawdziwa komunikacja stacyjna.

## Miejsce na Rozmowe Techniczna

### Wyjasnij Prosto

Zamodelowalismy, jak awaria przechodzi przez cyfrowy lancuch zabezpieczen i jak oprogramowanie raportuje ten przebieg.

### Wyjasnij Technicznie

Lekcja laczy sekwencje zdarzen w stylu GOOSE, modelowanie timeline zabezpieczen oraz nadzorczy interfejs API z zachowaniem roznicy miedzy komunikacja Layer 2 a interfejsami aplikacyjnymi.
