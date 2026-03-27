# Lekcja 007 — Integracja Sieci WN: Model Steady-State w Pandapower

!!! abstract "Nawigacja lekcji"
    :material-arrow-left: **Poprzednia:** [Lekcja 006 — Optymalizacja rozmieszczenia, efekt blokowania i kaskada AEP](lesson-006.md) | **Następna:** [Lekcja 008 — Dynamiczna zgodność sieci: ANDES, FRT, odpowiedź częstotliwościowa, SSO i porównanie konwerterów](lesson-008.md) :material-arrow-right:

    **Faza:** P2 | **Język:** Polski | **Postęp:** 8 z 19 | [Wszystkie lekcje](index.md) | [Plan nauki](../../Learning_Roadmap.md)

> **Data:** 2026-02-24
> **Faza:** P2 (HV Grid Integration)
> **Sekcje roadmapy:** [Phase 2 — Section 2.1 Electrical Network Model, Section 2.2 Load Flow, Section 2.3 Short-Circuit, Section 2.4 Reactive Compensation]
> **Język:** Polski
> **Poprzednia lekcja:** Lesson 006
> **last_commit_hash:** 0a571666d8c2a7e2e62689f3b54d6b1e90d830a4

---

## Czego się nauczysz

- Fizyki modelu pi kabli XLPE podmorskich i parametrów IEC 60287
- Matematycznych podstaw metody Newton-Raphson rozwiązywania przepływu mocy (load flow)
- Metodologii obliczania zwarć według IEC 60909 (Ik'', ip, Sk'')
- Efektu Ferrantiego i dlaczego kompensacja mocy biernej STATCOM-em jest niezbędna
- Weryfikacji zgodności z limitami napięciowymi PSE IRiESP (0,95–1,05 pu)

---

## Sekcja 1: Model pi kabla — od fizyki do kodu

### Problem z realnego świata

Wyobraź sobie ogrodowy wąż. Im dłuższy, tym niższe ciśnienie wody na jego końcu (straty oporowe). Ale w kablach elektrycznych jest jeszcze jedna różnica: materiał izolacyjny kabla (XLPE) działa jak mały kondensator. Nasz 45-kilometrowy kabel podmorski 220 kV wytwarza w stanie biegu jałowego ~130 MVAR mocy biernej — co odpowiada mocy biernej zużywanej przez małe miasto.

### Co mówią standardy

**IEC 60287** oblicza obciążalność prądową kabli oraz parametry elektryczne (R, X, C). **IEC 60228** standaryzuje przekroje przewodów (500, 630, 800, 1000 mm²). W morskich farmach wiatrowych stosuje się stopniowanie kabli (cable grading): turbiny oddalone od OSS mają kabel o mniejszym przekroju (mniejszy prąd), turbiny bliższe OSS mają kabel o większym przekroju (większy prąd skumulowany).

### Matematyka

Model pi przybliża linię z parametrami rozproszonymi za pomocą trzech elementów skupionych:

```
       R + jX
  ──┤├────┤├────┤├──
  │                │
  ═ jB/2      jB/2 ═
  │                │
  ─────────────────
```

Dla każdego odcinka kabla:
- **R** [Ω/km]: rezystancja przewodu (odwrotnie proporcjonalna do przekroju)
- **X** [Ω/km]: reaktancja indukcyjna (pole magnetyczne)
- **C** [nF/km]: pojemność na fazę (dielektryk XLPE)

Wytwarzanie mocy biernej (Reguła 7 — zawsze dodatnia):

$$Q_{kabel} = \omega \times C \times V^2 \times L$$

Dla naszego kabla eksportowego 220 kV:
$$Q = 2\pi \times 50 \times 190 \times 10^{-9} \times (220000)^2 \times 45 \approx 130 \text{ MVAR}$$

### Co zbudowaliśmy

**Plik:** `backend/app/services/p2/network_model.py`

Parametry kabla zdefiniowano przez klasę dataclass `CableSpec`:

```python
@dataclass(frozen=True)
class CableSpec:
    cross_section_mm2: float
    r_ohm_per_km: float
    x_ohm_per_km: float
    c_nf_per_km: float
    max_i_ka: float

# 66 kV kable zbiorowe — stopniowane według odległości od OSS
ARRAY_CABLE_500 = CableSpec(500, 0.0366, 0.110, 200, 0.715)  # Dalekie
ARRAY_CABLE_630 = CableSpec(630, 0.0283, 0.105, 215, 0.818)  # Środkowe
ARRAY_CABLE_800 = CableSpec(800, 0.0221, 0.100, 230, 0.900)  # Bliskie
```

Funkcja stopniowania kabli dobiera przekrój na podstawie pozycji w ciągu:

```python
def _get_cable_grade(position_in_string: int, string_length: int) -> CableSpec:
    normalised = position_in_string / max(string_length - 1, 1)
    if normalised < 0.4:
        return ARRAY_CABLE_500   # dalekie — najmniejszy prąd
    elif normalised < 0.7:
        return ARRAY_CABLE_630   # środkowe
    else:
        return ARRAY_CABLE_800   # bliskie OSS — największy prąd skumulowany
```

### Dlaczego to jest ważne

> **Dlaczego** nie stosujemy jednego przekroju dla wszystkich kabli zbiorowych?
> Użycie jednakowego przekroju byłoby proste, ale nieefektywne. Turbiny oddalone od OSS przenoszą prąd tylko jednej turbiny (131 A), ale kabel najbliższy OSS przenosi prąd pięciu turbin (655 A). Stosowanie wszędzie 800 mm² to zbędny koszt — 500 mm² wytrzymuje już 715 A. Stopniowanie kabli może obniżyć koszty kabli w projekcie o 15–25%.

---

## Sekcja 2: Topologia sieci — 38 szyn, 35 kabli, 2 transformatory

### Problem z realnego świata

Wyobraź sobie sieć elektroenergetyczną miasta: od elektrowni do fabryki prowadzi wiele transformatorów i kabli. Każdy zmienia poziom napięcia i powoduje straty. Nasza morska farma wiatrowa działa tak samo: trzy poziomy napięcia od 66 kV do 400 kV, na każdym inne urządzenia.

### Co zbudowaliśmy

Funkcja `build_network()` tworzy sieć Pandapower z 38 szynami:

| Element | Liczba | Opis |
|---------|--------|------|
| **Szyny** | 38 | 1× PSE 400 kV + 1× ląd 220 kV + 1× OSS 220 kV + 1× OSS 66 kV + 34× WTG 66 kV |
| **Kable** | 35 | 34× zbiorowe (66 kV, stopniowane) + 1× eksportowy (220 kV, 45 km) |
| **Transformatory** | 2 | 66/220 kV Dyn11 (OSS) + 220/400 kV YNyn0 (lądowy) |
| **Generatory** | 35 | 34× WTG (15 MW) + 1× STATCOM (sterowanie Q) |
| **Reaktor szuntowy** | 1 | 50 MVAR (OSS 220 kV) |
| **Sieć zewnętrzna** | 1 | PSE 400 kV, Ssc = 10 GVA |

**Układ ciągów:** 6 ciągów × 5 WTG + 1 ciąg × 4 WTG = 34 WTG

---

## Sekcja 3: Przepływ mocy — weryfikacja napięcia metodą Newton-Raphson

### Fizyka

Przepływ mocy metodą Newton-Raphson rozwiązuje równania bilansu mocy:

$$P_i = V_i \sum_j V_j (G_{ij} \cos\theta_{ij} + B_{ij} \sin\theta_{ij})$$
$$Q_i = V_i \sum_j V_j (G_{ij} \sin\theta_{ij} - B_{ij} \cos\theta_{ij})$$

Macierz Jacobiego jest aktualizowana w każdej iteracji:

$$\begin{bmatrix} \Delta P \\ \Delta Q \end{bmatrix} = \begin{bmatrix} \frac{\partial P}{\partial \theta} & \frac{\partial P}{\partial V} \\ \frac{\partial Q}{\partial \theta} & \frac{\partial Q}{\partial V} \end{bmatrix} \begin{bmatrix} \Delta \theta \\ \Delta V \end{bmatrix}$$

Kryterium zbieżności: $\|\Delta P, \Delta Q\| < 10^{-8}$ MVA

### Scenariusze

**PSE IRiESP** wymaga weryfikacji zgodności napięciowej w czterech scenariuszach eksploatacyjnych:

| Scenariusz | Produkcja | Cel |
|------------|-----------|-----|
| **Pełne obciążenie** | 510 MW (34 × 15 MW) | Termiczne limity kabli |
| **Częściowe obciążenie** | 255 MW (50%) | Napięcia przy normalnej pracy |
| **Bieg jałowy** | 0 MW | Wzrost napięcia efektem Ferrantiego |
| **N-1** | 450 MW (ciąg 7 wyłączony) | Marginesy rezerwowe |

### Wyniki

Wszystkie cztery scenariusze osiągają zbieżność i spełniają limity napięciowe 0,95–1,05 pu (przy automatycznym sterowaniu STATCOM-em):

- **Pełne obciążenie:** Straty ~1–3% (5–15 MW), napięcie zgodne
- **Częściowe obciążenie:** Mniejsze straty, napięcie zgodne
- **Bieg jałowy:** Minimalne straty (tylko straty w żelazie transformatorów), efekt Ferrantiego skompensowany
- **N-1:** 450 MW, rezerwa potwierdzona

### Przegląd kodu

Automatyczne sterowanie STATCOM-em utrzymuje napięcie na szynie OSS 220 kV na poziomie 1,0 pu:

```python
def auto_statcom_dispatch(net, target_vm_pu=1.0, tolerance_pu=0.01):
    for _ in range(max_iterations):
        pp.runpp(net, algorithm="nr")
        v_oss = net.res_bus.at[oss_bus_idx, "vm_pu"]
        deviation = target_vm_pu - v_oss
        if abs(deviation) <= tolerance_pu:
            break
        # Korekta proporcjonalna: ~5000 MVAR/pu wzmocnienia
        current_q += deviation * 5000.0
        # Ograniczenie do znamionowej mocy STATCOM-a (±120 MVAR)
        current_q = max(-120, min(120, current_q))
```

---

## Sekcja 4: Zwarcia — IEC 60909

### Fizyka

IEC 60909 oblicza początkowy symetryczny prąd zwarcia na szynie k:

$$I_k'' = \frac{c \times V_n}{\sqrt{3} \times Z_k}$$

- **c** = współczynnik napięciowy (maks.: 1,1, min.: 1,0 — IEC 60909 Tablica 1)
- **V_n** = napięcie znamionowe [V]
- **Z_k** = zastępcza impedancja zwarciowa widziana z miejsca zwarcia [Ω]

Szczytowy prąd udarowy (składowa DC):
$$i_p = \kappa \times \sqrt{2} \times I_k''$$

Moc zwarciowa:
$$S_k'' = \sqrt{3} \times V_n \times I_k'' \quad [\text{MVA}]$$

### Co mówią standardy

**IEC 62271-100** definiuje zdolności łączeniowe wyłączników:

| Poziom napięcia | Zdolność łączeniowa |
|-----------------|---------------------|
| 66 kV | 25 kA |
| 220 kV | 40 kA |
| 400 kV | 50 kA |

### Co zbudowaliśmy

**Reguła inżynierska 3:** Obliczenia według IEC 60909 wykonuje się wbudowaną funkcją Pandapower `calc_sc()` — własna implementacja jest ZABRONIONA.

```python
sc.calc_sc(net, fault="3ph", case="max", ip=True)
```

Wyniki: prądy zwarciowe na wszystkich szynach są poniżej zdolności łączeniowych wyłączników → wyłączniki są wystarczające.

---

## Sekcja 5: Wymiarowanie STATCOM-a — efekt Ferrantiego i kompensacja

### Fizyka — efekt Ferrantiego

Na końcu odbioru nienobciążonego lub lekko obciążonego kabla napięcie jest wyższe niż po stronie nadawczej:

$$V_{odbiór} \approx \frac{V_{nadawanie}}{\cos(\beta L)}$$

Na naszym kablu 45 km, 220 kV wzrost napięcia efektem Ferrantiego wynosi ~2–5%. Bez kompensacji może to przekroczyć limity napięciowe.

### Strategia kompensacji

1. **Reaktor szuntowy (50 MVAR):** Stałe obciążenie indukcyjne absorbuje część mocy Q kabla
2. **STATCOM (±120 MVAR):** Dynamiczna kompensacja — wytwarza lub pochłania Q w zależności od napięcia

**Dlaczego STATCOM, a nie SVC?**
- Pełna zdolność Q przy niskim napięciu (krytyczne podczas FRT)
- Szybsza odpowiedź (< 1 cykl vs. 2–3 cykle)
- Mniejsza zajętość platformy offshore
- Brak wymagania filtru harmonicznych (przełączanie PWM)

### Wyniki weryfikacji

| Metryka | Wartość |
|---------|---------|
| Moc Q kabla (220 kV, 45 km) | ~130 MVAR |
| Reaktor szuntowy | 50 MVAR |
| Moc znamionowa STATCOM-a | ±120 MVAR |
| Wzrost napięcia Ferrantiego (bez kompensacji) | > 1,0 pu |
| V_max z kompensacją | ≤ 1,05 pu ✓ |

---

## Podsumowanie testów

| Plik testowy | Liczba testów | Wynik |
|-------------|---------------|-------|
| `test_network_model.py` | 21 | ✓ Wszystkie zaliczone |
| `test_load_flow.py` | 20 | ✓ Wszystkie zaliczone |
| `test_short_circuit.py` | 13 | ✓ Wszystkie zaliczone |
| `test_statcom.py` | 14 | ✓ Wszystkie zaliczone |
| **Łącznie** | **68** | **✓ 68/68** |

---

## Pytania na rozmowę kwalifikacyjną

### Pytanie 1: Efekt Ferrantiego
**„Wasz 45-kilometrowy kabel eksportowy 220 kV pracuje w biegu jałowym. Dlaczego napięcie na szynie OSS przekracza wartość znamionową i jak temu zapobiec?"**

*Wskazówka: pojemność kabla, wytwarzanie mocy biernej, kompensacja reaktorem szuntowym + STATCOM*

### Pytanie 2: Stopniowanie kabli
**„Dlaczego w kablach zbiorowych 66 kV stosuje się różne przekroje (500/630/800 mm²)? Jaka jest wada zastosowania wszędzie 800 mm²?"**

*Wskazówka: kumulacja prądu, optymalizacja kosztów, limity termiczne*

### Pytanie 3: IEC 60909
**„Co oznacza współczynnik napięciowy c_max = 1,1 w IEC 60909 i dlaczego do wymiarowania wyłączników używa się przypadku maksymalnego?"**

*Wskazówka: tolerancja napięcia eksploatacyjnego, najgorszy przypadek prądu zwarciowego, margines bezpieczeństwa*

---

## Wyjaśnij prosto

Dziś zbudowaliśmy w komputerze sieć elektroenergetyczną naszej farmy wiatrowej — cały system od 34 turbin przez kabel podmorski do lądu i dalej do sieci krajowej. W czterech różnych sytuacjach (pełna moc, połowa mocy, bieg jałowy, jedna linia uszkodzona) sprawdziliśmy, czy prąd płynie przy prawidłowym napięciu. Obliczyliśmy, co się stanie podczas zwarcia, i wykazaliśmy wystarczalność aparatury ochronnej. Na koniec opanowaliśmy wzrost napięcia wywołany efektem Ferrantiego w długim kablu podmorskim za pomocą STATCOM-a i reaktora.

## Wyjaśnij technicznie

W sesji P2A zbudowano w Pandapower pełnoskalowy model sieci 66/220/400 kV. W sieci z 38 szynami, 35 kablami (model pi, parametry IEC 60287) i 2 transformatorami (Dyn11 + YNyn0) przepływ mocy Newton-Raphsona uzyskał zbieżność w 4 scenariuszach (full, partial, no-load, N-1) i spełnił limity napięciowe PSE IRiESP (0,95–1,05 pu) przy automatycznym sterowaniu STATCOM-em. Analiza zwarciowa IEC 60909 (3-fazowa, c_max=1,1, c_min=1,0) wykazała wartości Ik'' poniżej zdolności łączeniowych wyłączników na wszystkich szynach. Wymiarowanie STATCOM-a skompensowało ~130 MVAR pojemnościowej mocy Q kabla eksportowego 45 km za pomocą reaktora szuntowego 50 MVAR + STATCOM ±120 MVAR, eliminując wzrost napięcia Ferrantiego. 68 testów jednostkowych zaliczone w 100%.
