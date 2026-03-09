# Lekcja 009 - Model Danych IEC 61850, Generator SCL i Rejestr Zasobow SCADA

!!! abstract "Nawigacja Lekcji"
    :material-arrow-left: **Poprzednia:** [Lekcja 008 - Zgodnosc Dynamiczna](lesson-008.md) | **Nastepna:** [Lekcja 010 - Symulacja GOOSE i Timeline Zabezpieczen](lesson-010.md) :material-arrow-right:

    **Faza:** P3 | **Jezyk:** Polish | **Postep:** 8 z 17 przetlumaczonych lekcji tureckich | [Wszystkie lekcje](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Data:** 2026-02-25
> **Faza:** P3 (SCADA and Automation)
> **Sekcje roadmapy:** [Phase 3 - IEC 61850 Modelling, SCL and Device Registry]
> **Jezyk:** Polish
> **Poprzednia lekcja:** Lesson 008

---

## Czego Sie Nauczysz

- Dlaczego IEC 61850 jest najpierw modelem danych, a dopiero potem implementacja komunikacji
- Jak logical nodes i data objects wspieraja interoperacyjnosc stacji
- Po co generowac SCL jako artefakt inzynierski
- Jak rejestr zasobow SCADA laczy model z realnymi obiektami farmy

## Sekcja 1: IEC 61850 jako Architektura Informacji

IEC 61850 standaryzuje opis funkcji stacji, ich nazewnictwo i relacje. To warunek tego, aby zabezpieczenia, sterowanie i SCADA rozumialy te same sygnaly w taki sam sposob.

## Sekcja 2: SCL jako Plik Zrodlowy Inzynierii

Substation Configuration Language porzadkuje urzadzenia, logical nodes, datasets i polaczenia komunikacyjne. Traktowanie SCL jako glównego artefaktu poprawia spojność miedzy konfiguracja, symulacja i dokumentacja.

## Sekcja 3: Rejestr Zasobow SCADA

Rejestr urzadzen i identyfikatorow daje platformie operacyjny source of truth. Laczy model informacyjny IEC 61850 z obiektami, ktore pozniej pojawiaja sie w alarmach, API i commissioning workflow.

## Najwazniejsze Wnioski

- IEC 61850 zaczyna sie od modelowania, nie od transportu.
- SCL jest kluczowy dla odtwarzalnej inzynierii stacji.
- Rejestr zasobow scala model z oprogramowaniem operacyjnym.
- P3 zalezy od nazewnictwa i traceability tak samo jak od UI.

## Miejsce na Rozmowe Techniczna

### Wyjasnij Prosto

Stworzylismy uporzadkowany jezyk, dzieki ktoremu cyfrowa stacja opisuje urzadzenia i sygnaly w spójny sposob.

### Wyjasnij Technicznie

Lekcja ustanawia logical modelling IEC 61850, generowanie konfiguracji oparte na SCL oraz traceability przez asset registry jako rdzen architektury informacyjnej P3.
