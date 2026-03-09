# Lekcja 007 - Integracja Sieci WN: Model Steady-State w Pandapower

!!! abstract "Nawigacja Lekcji"
    :material-arrow-left: **Poprzednia:** [Lekcja 006 - Layout i AEP](lesson-006.md) | **Nastepna:** [Lekcja 008 - Zgodnosc Dynamiczna](lesson-008.md) :material-arrow-right:

    **Faza:** P2 | **Jezyk:** Polish | **Postep:** 6 z 17 przetlumaczonych lekcji tureckich | [Wszystkie lekcje](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Data:** 2026-02-25
> **Faza:** P2 (HV Grid Integration)
> **Sekcje roadmapy:** [Phase 2 - Section 2.1 Load Flow, Section 2.2 Reactive Power, Section 2.3 Short-Circuit Basis]
> **Jezyk:** Polish
> **Poprzednia lekcja:** Lesson 006

---

## Czego Sie Nauczysz

- Dlaczego farma 510 MW wymaga jawnego modelu steady-state zanim przejdziemy do dynamiki
- Jak model Pandapower odwzorowuje system 66 kV, eksport 220 kV, transformator offshore i polaczenie z 400 kV PSE
- Dlaczego pojemnosciowe ladowanie kabla wymusza kompensacje mocy biernej
- Jak load flow i zalozenia zwarciowe lacza sie z pozniejsza ochrona i commissioningiem

## Sekcja 1: Dlaczego Model Sieci Jest Pierwszy

Power flow jest pierwszym elektrycznym testem prawdy. Zanim zaczniemy badac zwarcia, FRT lub alarmy SCADA, trzeba potwierdzic, ze napiecia, prady i moce bierne sa fizycznie sensowne w normalnej pracy.

## Sekcja 2: Budowa Topologii w Pandapower

Model obejmuje cala droge energii: system zbiorczy, stacje offshore, kabel eksportowy, transformacje na lądzie i zewnetrzna siec. To cyfrowy single-line diagram dla dalszych obliczen.

## Sekcja 3: Moc Bierna i Ladowanie Kabla

Dlugie kable HVAC zachowuja sie pojemnosciowo. Generuja moc bierna, ktora moze podnosic napiecie i wypychac system poza bezpieczny obszar pracy. Stad potrzeba kompensacji i sterowania napieciem.

## Sekcja 4: Scenariusze Operacyjne

Dobry model steady-state musi sprawdzac nie tylko stan pelnej mocy. Potrzebne sa tez przypadki partial load, no-load charging i wybrane sytuacje graniczne, aby zobaczyc wrazliwosc ukladu.

## Najwazniejsze Wnioski

- Steady-state jest elektrycznym fundamentem calej platformy.
- Model musi odwzorowywac realne poziomy napiec i transformatory.
- Przy dlugim eksporcie HVAC kompensacja mocy biernej jest konieczna.
- Wyniki load flow przechodza dalej do ochrony, SCADA i commissioningu.

## Miejsce na Rozmowe Techniczna

### Wyjasnij Prosto

Zbudowalismy elektryczna mape farmy i sprawdzilismy, czy energia moze plywac do sieci bez nienaturalnych problemow napieciowych.

### Wyjasnij Technicznie

Lekcja formalizuje model steady-state lancucha 66/220/400 kV w Pandapower, wraz ze scenariuszami pracy i analiza skutkow mocy biernej, ktore staja sie podstawa dalszych badan zwarciowych, sterowania i ochrony.
