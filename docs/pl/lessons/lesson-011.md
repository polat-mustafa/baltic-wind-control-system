# Lekcja 011 - IEC 62443 RBAC i Cykl Zycia Permit-to-Work

!!! abstract "Nawigacja Lekcji"
    :material-arrow-left: **Poprzednia:** [Lekcja 010 - Symulacja GOOSE](lesson-010.md) | **Nastepna:** [Lekcja 012 - Pipeline Danych SCADA](lesson-012.md) :material-arrow-right:

    **Faza:** P3 | **Jezyk:** Polish | **Postep:** 10 z 17 przetlumaczonych lekcji tureckich | [Wszystkie lekcje](index.md) | [Learning Roadmap](../../Learning_Roadmap.md)

> **Data:** 2026-02-25
> **Faza:** P3 (SCADA and Automation)
> **Sekcje roadmapy:** [Phase 3 - OT Security, RBAC and Permit-to-Work]
> **Jezyk:** Polish
> **Poprzednia lekcja:** Lesson 010

---

## Czego Sie Nauczysz

- Dlaczego cyberbezpieczenstwo OT i workflow bezpieczenstwa operacyjnego trzeba projektowac razem
- Jak role i uprawnienia wpisuja sie w logike IEC 62443
- Dlaczego Permit-to-Work najlepiej modelowac jako scisla maszyne stanow
- Jak audytowalnosc wspiera bezpieczenstwo i zgodnosc

## Sekcja 1: RBAC jako Kontrola Bezpieczenstwa Operacyjnego

W srodowisku wysokiego napiecia dostep nie jest tylko problemem IT. Niewlasciwa osoba wykonujaca niewlasciwa akcje moze stworzyc realne zagrozenie. Dlatego RBAC jest jednoczesnie zabezpieczeniem cybernetycznym i mechanizmem dyscypliny operacyjnej.

## Sekcja 2: Permit-to-Work jako Maszyna Stanow

Permit-to-Work nie powinien dowolnie przeskakiwac miedzy statusami. Musi przechodzic przez jasno zdefiniowany ciag: zgloszenie, ocena, zatwierdzenie, izolacja, lockout, wykonanie, przywrocenie i zamkniecie.

## Sekcja 3: Znaczenie Audit Trail

Kazda zmiana stanu powinna miec przypisana osobe, czas i uzasadnienie. Taka traceability wspiera przeglady incydentow, zgodnosc proceduralna i zaufanie do cyfrowego workflow.

## Najwazniejsze Wnioski

- Kontrola dostepu OT jest czescia bezpieczenstwa instalacji.
- Workflow Permit-to-Work wymaga scislych przejsc stanow.
- Audit logging to podstawowa cecha projektu, a nie opcjonalna telemetria.
- P3 laczy cyberbezpieczenstwo, operacje i traceability w jednej warstwie uslug.

## Miejsce na Rozmowe Techniczna

### Wyjasnij Prosto

Dopilnowalismy, aby tylko wlasciwe osoby mogly wykonywac odpowiednie dzialania i aby kazdy krok bezpieczenstwa byl zapisany.

### Wyjasnij Technicznie

Lekcja integruje RBAC inspirowany IEC 62443 z reprezentacja Permit-to-Work jako state machine, wzmocniona explicite zaprojektowanym audit trail dla odpowiedzialnosci OT.
