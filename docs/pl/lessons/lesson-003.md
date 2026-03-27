# Lekcja 003 — Wstępne decyzje projektowe: lokalizacja, turbina, wydajność, powierzchnia i integracja z siecią

!!! abstract "Nawigacja kursu"
:material-arrow-left: **Poprzednia:** [Lekcja 002 — Internacjonalizacja](lesson-002.md) | **Następny:** [Lekcja 004 — Baza danych, ERA5 i Weibull](lesson-004.md):material-arrow-right:

**Faza:** P1 | **Język:** Polski | **Postęp:** 4 z 19 | [Wszystkie lekcje](index.md) | [Plan nauczania](../../Learning_Roadmap.md)

> **Data:** 24.02.2026
> **Faza:** P1 (Zasoby wiatru i AEP) – Wstępne przygotowanie
> **Ekrany planu działania:** [Sekcja 1.3 Referencyjna specyfikacja farmy wiatrowej, Sekcja 1.4 Kontekst branżowy]
> **Język:** Polski

---

## Czego się nauczysz

- Jakie kryteria fizyczne, ekonomiczne i regulacyjne opierają się na wyborze lokalizacji dla projektów morskich farm wiatrowych?
- Dlaczego turbiny klasy 15 MW są standardem branżowym okresu 2024-2026 i ich historyczny proces rozwoju
- Zależność mocy farmy wiatrowej od liczby turbin a koncepcja „skali szkoleniowej”
- W jaki sposób całkowita powierzchnia gospodarstwa jest określana poprzez obliczenie rozstawu turbin
- Fizyczne podstawy decyzji inżynierskich pomiędzy technologiami przesyłu HVAC i HVDC
- Dlaczego integracja z krajową siecią 400 kV wymaga wymagań STATCOM, FRT i kodeksu sieci

---

## Część 1: Dlaczego Morze Bałtyckie?

### Prawdziwy problem życiowy

Pierwsze pytanie, na które należy odpowiedzieć przed rozpoczęciem projektu morskiej farmy wiatrowej brzmi: **gdzie będziemy budować?** To pytanie na pierwszy rzut oka wydaje się proste, jak „gdziekolwiek wieje wiatr”. Jednak w rzeczywistości wybór lokalizacji; Jest to punkt przecięcia kilkudziesięciu parametrów, takich jak zasoby wiatru, głębokość wody, geologia dna morskiego, ruch morski, obszary ochrony środowiska, odległość od brzegu, punkt przyłączenia do sieci i krajowe ramy regulacyjne.

### Fizyka: Porównanie źródeł wiatru

Średnie prędkości wiatru na morzach europejskich znacznie się różnią:

| Deniz | Średnia prędkość wiatru (100 m) | Współczynnik wydajności | Funkcja |
| ------- | ------------------------------- | ------------------- | --------- |
| **Morze Północne** (UK-NL-DE) | 9,5–11,0 m/s | %48–55 | Największe zasoby, ale głęboka woda i wzburzone fale |
| **Morze Bałtyckie** (PL-SE-DK-FI) | 8,5–10,0 m/s | %42–50 | Dobre zasoby, płytka woda, spokojna fala, kwitnący rynek |
| **Śródziemnomorski** (GR-IT-FR) | 7,0–8,5 m/s | %30–38 | Głęboka woda, wymagana technologia pływająca |
| **Morze Irlandzkie** | 9,0–10,5 m/s | %45–52 | Dobre zasoby, ale ograniczona wydajność sieci |

W naszym obszarze referencyjnym (55,0°N–55,5°N, 16,5°E–17,5°E) w Polskiej Wyłącznej Strefie Ekonomicznej (WSE) Morza Bałtyckiego, średnia prędkość wiatru na wysokości 100 m n.p.m. mieści się w przedziale **8,8–9,3 m/s**, zgodnie z danymi z ponownej analizy ERA5. Ekstrapolowana na wysokość piasty 150 m przy użyciu profilu mocy, wartość ta osiąga **9,0–9,5 m/s** – co oznacza współczynnik wydajności 45–50%.

!!! info "Co to są dane z ponownej analizy ERA5?"
ERA5 to globalny zbiór danych do ponownej analizy atmosfery opracowany przez Europejskie Centrum Prognoz Średnioterminowych (ECMWF). Obejmuje wiatr, temperaturę, ciśnienie i wiele innych zmiennych atmosferycznych na siatce przestrzennej 0,25° × 0,25° (~25 km) w rozdzielczości godzinowej od 1940 r. do chwili obecnej. W przypadku projektów związanych z morską energetyką wiatrową dane masztów meteorologicznych (met-masztów) zapewniają weryfikację specyficzną dla miejsca realizacji projektu, natomiast ERA5 stanowi podstawę długoterminowych statystyk trwających ponad 20 lat.

### Głębokość wody i warunki gruntowe

Głębokość wody bezpośrednio determinuje rodzaj fundamentu, a tym samym koszt inwestycyjny (CAPEX) projektu:

| Głębokość wody | Typ fundamentu | Wpływ na koszty |
| ------------- | ------------ | ---------------- |
| 0–30 m | Monopil (pojedynczy stos) | Najniższy koszt, sprawdzona technologia |
| 25–50 m | Monopil lub płaszcz (struktura kratowa) | Średni koszt, graniczący z monopalem dla klasy 15 MW |
| 40–60 m | Kurtka | Preferowane drogie i ciężkie turbiny |
| >60 m | Pływająca platforma | Najwyższy koszt na etapie dojrzałości komercyjnej |

Na naszym obszarze referencyjnym głębokość wody mieści się w przedziale **25–40 m**. Jest to zakres, w którym technologia monopala (monopal XXL o średnicy 10–12 m) ma zastosowanie dla turbin klasy 15 MW. Płytszy charakter Morza Bałtyckiego w porównaniu do Morza Północnego znacznie zmniejsza koszty fundamentowania.

### Warunki fali

Kolejną zaletą Morza Bałtyckiego jest wysokość fal:

| Parametry | Morze Północne | Morze Bałtyckie |
| ----------- | ------------- | --------------- |
| Znacząca wysokość fali (Hs, średnia roczna) | 1,5–2,5 m | 0,8–1,5 m |
| Maksymalnie 50 lat Hs | 12–15 m | 7–9 m |
| Okno montażowe (Hs < 1,5 m) | ~180 dni w roku | ~220 dni w roku |

Spokojniejsze warunki falowe zapewniają większe okno pogodowe dla operacji związanych z instalacją turbin. Skraca to czas instalacji i zmniejsza koszty wynajmu statku typu jack-up (statek instalacyjny).

### Warunki lodowe

W miesiącach zimowych w północnych częściach Morza Bałtyckiego (Finlandia, północna Szwecja) może tworzyć się lód morski. Jednakże, ze względu na położenie w polskiej WSE na południu Bałtyku, ryzyko powstawania lodu jest niskie. Jednakże analiza obciążenia lodem jest standardowym wymogiem zgodnie z normą IEC 61400-1 załącznik E (warunki środowiskowe). Na naszym obszarze referencyjnym nie ma poważnego zagrożenia lodowego.

### Polityka energetyczna Polski: PEP2040

Polityka Energetyczna Polski 2040 (PEP2040 — Polityka Energetyczna Polski do 2040 roku) postawiła przed morską energetyką wiatrową następujące cele:

| Cel | Pojemność |
| ------- | ---------- |
| 2028 (pierwsza fala) | ~3,5 GW |
| 2030 | 5,9 GW |
| 2035 | ~8–9 GW |
| 2040 | 11 GW |

Cele te stanowią centralny filar polskiej strategii przejścia z węgla na odnawialne źródła energii. Do lat 2025-2026 faktycznie ruszyła budowa pierwszej fali projektów – tworzących bezpośrednie zapotrzebowanie na pracę dla inżynierów zajmujących się morską energetyką wiatrową.

### Dlaczego ta lokalizacja?

Powody, dla których wybraliśmy nasz obszar referencyjny (na północ od Ustki, ~40 km od brzegu):

1. **Rzeczywista bliskość projektu:** W tym regionie zlokalizowane są obecnie realizowane polskie projekty wiatrowe typu offshore
2. **Jakość danych ERA5:** Ponad 20 lat wiarygodnych danych dotyczących wiatru dostępnych w rozdzielczości 0,25°
3. **Dopuszczalna głębokość wody:** 25–40 m, kompatybilna z technologią fundamentów jednopalowych
4. **Odległość do brzegu:** ~40–50 km — w zakresie optymalnym dla technologii transmisji HVAC (szerzej omówimy to w Rozdziale 6)
5. **Przyłączenie do sieci:** Zasięg linii przesyłowych 400 kV PSE (Polskie Sieci Elektroenergetyczne) na wybrzeżu Bałtyku jest rozsądny

!!! tip "Zasada inżynieryjna: Wybór lokalizacji to decyzja wielodyscyplinarna"
Wybór lokalizacji nie opiera się na jednym parametrze (np. tylko na prędkości wiatru). Zasoby wiatru, głębokość wody, warunki gruntowe, ruch morski, ograniczenia środowiskowe (trasy migracji ptaków, obszary ochrony ssaków morskich), odległość od brzegu, zdolność przyłączenia do sieci i ramy regulacyjne są oceniane łącznie. Na przecięciu wszystkich tych parametrów wyznaczany jest odpowiedni obszar (sweet spot).

---

## Część 2: Dlaczego turbina klasy 15 MW?

### Historyczny rozwój wielkości turbin

Morskie turbiny wiatrowe odnotowały dramatyczny rozwój w ciągu ostatnich 20 lat:

| Okres | Typowa moc | Średnica wirnika | Przeczesany obszar | Przykłady projektów |
| ------- | ----------- | ------------ | ---------------- | ----------------- |
| 2005–2010 | 2–3 MW | 80–90 m | ~5000 m² | Projekty offshore pierwszej generacji |
| 2010–2015 | 3,6–6 MW | 120–154 m | ~11 000–18 600 m² | Turbiny skrzyni biegów drugiej generacji |
| 2015–2020 | 6–8 MW | 154–167 m | ~18 600–21 900 m² | Bezpośrednie przejście napędu |
| 2020–2023 | 9,5–14 MW | 174–222 m | ~23 800–38 700 m² | Projekty komercyjne na dużą skalę |
| **2024–2026** | **14–15 MW** | **222–236 m** | **~38 700–43 700 m²** | **Aktualny standard — projekty bałtyckie** |
| 2027+ (rozwój) | 16–20+ MW | 252–260 m | ~49 900–53 100 m² | Produkcja prototypowa i przedseryjna |

### Fizyka: pole omiatane i związek mocy

Maksymalna moc, jaką może przechwycić turbina wiatrowa, zależy od powierzchni omiatania i sześcianu prędkości wiatru, ograniczonej limitem Betza:

$$P = \frac{1}{2} \cdot \rho \cdot A \cdot v^3 \cdot C_p$$

Tutaj:

- $P$ = siła mechaniczna (W)
- $\rho$ = gęstość powietrza (kg/m3) — ~1,225 kg/m3 na poziomie morza
- $A$ = powierzchnia zamiatania (m²) = $\pi r^2$ = $\pi (D/2)^2$
- $v$ = prędkość wiatru (m/s)
- $C_p$ = współczynnik mocy — granica Betza $C_{p,max} = 16/27 \approx 0.593$

Praktyczne znaczenie tego równania jest następujące:

1. **Jeśli omiatany obszar podwoi się**, moc do przechwycenia podwoi się (zależność liniowa)
2. **Jeśli prędkość wiatru podwoi się**, moc do przechwycenia wzrasta ośmiokrotnie (zależność sześcienna)
3. **Jeśli średnica wirnika podwoi się**, obszar omiatania zwiększa się czterokrotnie ($A \propto D^2$), a zatem możliwa do przechwycenia moc wzrasta czterokrotnie

Ta rzeczywistość fizyczna jest główną siłą napędową popychającą przemysł do produkcji większych wirników.

### Dlaczego 15 MW — dlaczego nie 12 lub 20?

**Trzy kluczowe powody, dla których turbiny klasy 15 MW będą standardem branżowym w latach 2024-2026:**

**1. Ticari Olgunluk (poziom gotowości technologicznej — TRL)**

Zwykle przejście modelu turbiny od prototypu do produkcji masowej zajmuje 5–8 lat. W okresie 2024-2026:

- **Klasa 12 MW:** W pełni dojrzała, ale nie preferowana już w nowych projektach (poprzednia generacja)
- **Klasa 14–15 MW:** W produkcji seryjnej, zamówieniach, budownictwie — **pełna dojrzałość komercyjna**
- **Klasa 18–20 MW:** Faza produkcji prototypu lub przedseryjnej – jeszcze niemożliwa do uzyskania przez bank

Aby zapewnić finansowanie (project Finance) turbina musi posiadać status „sprawdzonej technologii”. Od 2026 roku taki stan posiada klasa 15 MW.

**2. Optymalizacja LCOE (uśredniony koszt energii)**

LCOE dzieli koszt projektu w całym cyklu życia przez jego produkcję energii w całym cyklu życia:

$$LCOE = \frac{CAPEX + \sum_{t=1}^{n} \frac{OPEX_t}{(1+r)^t}}{\sum_{t=1}^{n} \frac{AEP_t}{(1+r)^t}}$$

Większe turbiny:

- **Wzrost nakładów inwestycyjnych:** Wzrost kosztów pojedynczej turbiny (~10–15 mln EUR/turbinę)
- **Zmniejszenie liczby turbin:** Mniej turbin potrzeba przy tej samej wydajności → mniej fundamentów, mniej kabli
- **Wzrost AEP:** Większy obszar omiatania → więcej energii
- **Redukcja kosztów konserwacji:** Mniej turbin = mniej wizyt konserwacyjnych

Wynik netto: LCOE w klasie 15 MW jest ~8–12% niższe niż w klasie 12 MW. Jednak klasa 20 MW nie udowodniła jeszcze swojej przewagi w zakresie LCOE ze względu na łańcuch dostaw i infrastrukturę logistyczną (przepustowość portu, dostępność statków instalacyjnych).

**3. Zgodność z łańcuchem dostaw i logistyką**

Długość łopat turbin klasy 15 MW wynosi około 115 m. Transport tych ostrzy z zakładu produkcyjnego do portu i z portu do miejsca instalacji wymaga specjalnej logistyki. Do 2026 r.:

- Infrastruktura portowa i statki instalacyjne dla skrzydeł o długości 115 m są dostępne i sprawne
- Nie ma jeszcze wystarczającej liczby odpowiednich statków i portów dla skrzydeł o długości 126–130 m (klasa 20 MW)

### Normy: Klasyfikacja turbin IEC 61400-1

IEC 61400-1 klasyfikuje turbiny ze względu na prędkość wiatru i intensywność turbulencji:

| Klasa IEC | Referencyjna prędkość wiatru (V_ref) | Średnia roczna | Klasa turbulencji |
| ----------- | ------------------------------- | ----------------- | ------------------ |
| **Ja-A** | 50 m/s | 10 m/s | Wysoki |
| **I-B** | 50 m/s | 10 m/s | Średni |
| II-A | 42,5 m/s | 8,5 m/s | Wysoki |
| II-B | 42,5 m/s | 8,5 m/s | Średni |
| III-A | 37,5 m/s | 7,5 m/s | Wysoki |

Nasza turbina referencyjna V236-15.0 MW posiada certyfikat **IEC Class I-B**:

- Integralność konstrukcyjna wytrzymująca referencyjną prędkość wiatru 50 m/s (średnia z 10 minut)
- Średnia intensywność turbulencji (klasa B) – odpowiednia do warunków morskich
- Prędkość wyłączenia 31 m/s – przy tej prędkości system bezpieczeństwa zatrzymuje turbinę

Ponieważ średnia roczna prędkość wiatru w naszym obszarze referencyjnym na Bałtyku wynosi ~9,0–9,5 m/s (na wysokości 150 m), turbina klasy I-B jest więcej niż wystarczająca w tych warunkach.

!!! warning "Częsty błąd: myląca prędkość wyłączania"
Prędkość wyłączenia (31 m/s) i referencyjna prędkość wiatru (50 m/s) to różne pojęcia. Wyłączenie to robocza prędkość przeciągnięcia – przy której turbina zatrzymuje się w sposób kontrolowany. Referencyjna prędkość wiatru jest parametrem projektu konstrukcyjnego – określa stan ekstremalnego obciążenia, jaki musi wytrzymać turbina. Warto poznać tę różnicę podczas rozmowy kwalifikacyjnej.

---

## Część 3: Wybór marki i modelu turbiny

### Dane techniczne V236-15.0 MW

| Parametry | Wartość | Wyjaśnienie |
| ----------- | ------- | ---------- |
| moc znamionowa | 15,0 MW | Moc wyjściowa generatora |
| średnica wirnika | 236 m | Jeden z największych rotorów na świecie |
| zamiatany obszar | 43 742 m² | $\pi \times (236/2)^2$ |
| wysokość piasty | 150 m | Wysokość całkowita nad wieżą + fundament |
| długość skrzydła | ~115,5 m | Porównaj z rozpiętością skrzydeł Airbusa A380 (79,75 m) na skrzydło |
| Klasa IEC | I-B | Silny wiatr, umiarkowane turbulencje |
| Prędkość włączenia | 3 m/s | Prędkość, przy której turbina rozpoczyna produkcję |
| prędkość znamionowa | 12,5 m/s | Prędkość, przy której osiągana jest moc znamionowa |
| Prędkość odcięcia | 31 m/s | Prędkość zatrzymania bezpieczeństwa |
| Typ napędu | Napęd półbezpośredni (skrzynia biegów średnioobrotowa) | Jednostopniowa skrzynia biegów + PMG (generator z magnesami trwałymi) |
| Ct (przy prędkości znamionowej) | 0.28 | Współczynnik ciągu — krytyczny w modelowaniu kilwateru |

### Dlaczego ten konkretny model turbiny?

Należy pamiętać, że ten projekt jest symulacją do celów edukacyjnych. Istnieją cztery podstawowe powody wyboru turbiny:

**1. Rzeczywista możliwość zastosowania projektu**

V236-15,0 MW jest wykorzystywany w projektach faktycznie budowanych na polskim Bałtyku w latach 2025-2026. Dzięki temu nasza symulacja jest odzwierciedleniem rzeczywistej praktyki branżowej, a nie ćwiczeniem akademickim.

**2. Publicznie dostępne dane techniczne**

Aby przeprowadzić symulację inżynierską, należy znać krzywą mocy, współczynnik ciągu (krzywa Ct), cechy wymiarowe i parametry eksploatacyjne. Specyfikacje techniczne V236-15.0 MW są publikowane w dokumentach publicznych.

**3. Reprezentacja standardów branżowych**

Klasa 14–15 MW to standardowa wielkość turbin dla europejskiego sektora morskiej energetyki wiatrowej w latach 2024–2026. W tej klasie jest dwóch głównych konkurentów:

| Parametry | Turbina A (15 MW) | Turbina B (14 MW) |
| ----------- | ------------------- | ------------------- |
| średnica wirnika | 236 m | 236 m |
| Typ napędu | Napęd półbezpośredni | Napęd bezpośredni |
| wysokość piasty | 150 m | ~150 m |
| Klasa IEC | I-B | I-B |

Obie turbiny mają średnicę wirnika 236 m – taką samą powierzchnię omiatania. Różnią się jednak mechanizmami napędowymi. Do tego projektu wybrano V236-15,0 MW, ponieważ jest to turbina zastosowana w pierwszym w Polsce tak dużym projekcie morskiej energetyki wiatrowej, a możliwość powiedzenia w wywiadach „ta sama turbina” jest dużą zaletą.

**4. Wartość portfela**

W wywiadzie stwierdzenie: „W mojej symulacji mocy 510 MW użyłem tej samej turbiny, co w rzeczywistych projektach — moje obliczenia mają bezpośrednie zastosowanie” jest znacznie skuteczniejsze niż stwierdzenie: „Pracowałem z ogólnym modelem turbiny”.

!!! info "Dlaczego nie używamy nazw firm?"
W tej lekcji unikamy konkretnych nazw firm deweloperskich. Powodem jest etyka zawodowa i bezstronność. To profesjonalne podejście do uzasadniania decyzji inżynierskich parametrami technicznymi, a nie nazwą firmy. Nazwa turbiny (V236-15.0) stanowi specyfikację produktu i publicznie dostępną informację techniczną.

---

## Rozdział 4: Obliczanie wydajności – Dlaczego 34 turbiny?

### Podstawy matematyki

$$N_{türbin} = \frac{P_{farm}}{P_{türbin}} = \frac{510 \text{ MW}}{15.0 \text{ MW}} = 34 \text{ türbin}$$

Jest to prosta operacja podziału, ale stojące za nią decyzje inżynieryjne nie są proste.

### Dlaczego łączna moc 510 MW?

Przy określaniu całkowitej wydajności równoważone są trzy ograniczenia:

**1. Ograniczenie skali treningu**

| Liczba turbin | Realizm | Obciążenie obliczeniowe | Wartość edukacyjna |
| -------------- | ------------- | ----------------- | --------------- |
| < 10 | Niski — efekty śladowe są znikome | za nisko | Niski |
| 10–20 | Środek — uproszczony ślad | Niski | Średni |
| **30–40** | **Wysoka — realistyczna interakcja z utworem** | **Przeciętny** | **Wysoki** |
| 50–100 | bardzo wysoki | Wysoki | te same koncepcje |
| > 100 | Rzeczywista skala projektu | bardzo wysoki | marginalny wzrost |

34 turbiny zapewniają wystarczającą złożoność, aby realistycznie modelować efekty wzbudzenia, przy jednoczesnym utrzymaniu czasu obliczeniowego na rozsądnym poziomie.

**2. Skalowalność**

Nasza symulacja została zaprojektowana dla 34 × 15 MW = 510 MW, ale tę samą infrastrukturę kodową można łatwo skalować:

- 76 × 15 MW = 1140 MW (rzeczywista wielkość projektu)
- 100 × 14 MW = 1400 MW (alternatywny rozmiar projektu)
- Ponad 200 farm turbinowych (megaprojekty nowej generacji)

**3. Wymóg integracji z siecią**

510 MW należy do klasy **generatora typu D** (≥75 MW) w zakresie ENTSO-E NC RfG (Wymagania kodeksu sieci dla generatorów). Oznacza to zastosowanie najsurowszych wymagań kodeksu sieci:

- Tryby pełnego pasma przenoszenia (LFSM-O, LFSM-U, FSM)
- Kontynuuj pracę podczas usterki (FRT — przejście przez usterkę)
- Pełny diagram możliwości P-Q (moc bierna)
- Granice harmonicznych i migotania

Wymagania te stanowią podstawę fazy projektu P2 (Integracja z siecią WN).

### Porównanie z rzeczywistymi projektami

| Parametry | Nasza symulacja | Prawdziwe projekty (typowe) |
| ----------- | --------------- | ------------------------ |
| Liczba turbin | 34 | 50–150 |
| Całkowita pojemność | 510 MW | 700 MW – 1,5 GW |
| Liczba transformatorów morskich | 1 | 1–3 |
| Typ transmisji | HVAC 220 kV | HVAC lub HVDC |

Nasze 510 MW znajduje się na dolnym krańcu rzeczywistych projektów. Jednakże wszystkie koncepcje inżynieryjne (modelowanie śladów, analiza sieci, SCADA, koordynacja zabezpieczeń) opierają się na tych samych zasadach fizycznych w przypadku mocy 510 MW i 1,5 GW. Różnica tkwi w skali, a nie w koncepcjach.

---

## Część 5: Obliczanie powierzchni farm wiatrowych

### Fizyka odstępów turbin

Jeżeli turbiny zostaną umieszczone zbyt blisko siebie, turbiny umieszczone z wiatrem pozostaną w obszarze śladu utworzonego przez turbinę znajdującą się przed nimi. Na terenie szlaku:

- **Prędkość wiatru maleje** — w miarę jak turbina znajdująca się przed turbiną pobiera energię kinetyczną
- **Turbulencja wzrasta** — z powodu zakłóconego przepływu
- **Wytwarzanie energii spada** — Ze względu na powiązanie $P \propto v^3$ nawet niewielkie spadki prędkości prowadzą do znacznych strat mocy

Na przykład, jeśli prędkość wiatru w obszarze kilwateru spadnie o 10%, produkcja energii spadnie o 27% ($0.9^3 = 0.729$).

### Standardy i praktyka branżowa

Norma IEC 61400-1 nie określa zakresu minimalnego, ale praktyka branżowa i badania DTU (duńskiego uniwersytetu technicznego) zalecają następujące zakresy:

| Noc | Zakres (D = średnica wirnika) | Skąd |
| ----- | ------------------------- | ------- |
| **Kierunek wiatru (z wiatrem)** | 7D – 10D | Regeneracja po przebudzeniu — większość energii odzyskana po 7D |
| **Boczny wiatr** | 4D – 6D | Efekt toru bocznego jest słabszy |

Zakresy wybrane w naszym projekcie:

- **Z wiatrem:** 8D = 8 × 236 m = **1888 m**
- **Boczny wiatr:** 5D = 5 × 236 m = **1180 m**

### Obliczenia pola

Umieszczanie turbin zwykle odbywa się w rzędach naprzemiennych. Typowy układ dla 34 turbin:

**Krok 1: Ustal kolejność sekwencji**

Ponieważ dominującym kierunkiem wiatru jest WSW (WSW — West-Southwest), rzędy ułożono prostopadle do tego kierunku.

Możliwy układ: 6 rzędów × 5–6 turbin (łącznie 34)

Przykładowy układ: 6 + 6 + 6 + 6 + 5 + 5 = 34 turbiny

**Krok 2: Obliczenia wymiarowe**

```
Çapraz rüzgar yönünde (sıra uzunluğu):
 6 türbin × 1,180 m aralık = 5,900 m (en geniş sıra)

Rüzgar yönünde (sıra derinliği):
 6 sıra × 1,888 m aralık = 9,440 m

Dikdörtgen alan:
 5.9 km × 9.4 km ≈ 55.5 km²
```

**Krok 3: Dodaj strefę buforową**

W rzeczywistych projektach granica farmy wymaga minimalnej strefy buforowej wynoszącej 500 m wokół najbardziej oddalonych turbin (bezpieczeństwo ruchu morskiego, dostęp konserwacyjny):

```
(5.9 + 1.0) km × (9.4 + 1.0) km ≈ 71.8 km²
```

**Krok 4: Nieregularna korekta granicy**

Ze względu na układ schodkowy i ograniczenia dna morskiego rzeczywisty obszar nie będzie prostokątny. Typowy współczynnik korekcyjny ~1,2–1,4:

```
Tahmini toplam alan: ~70–100 km²
```

### Gęstość mocy

Gęstość mocy wskazuje moc zainstalowaną na jednostkę powierzchni:

$$\rho_{güç} = \frac{P_{farm}}{A_{farm}} = \frac{510 \text{ MW}}{~80 \text{ km}^2} \approx 6.4 \text{ MW/km}^2$$

Porównanie branż:

| Klasa turbiny | Typowa gęstość mocy | Wyjaśnienie |
| -------------- | ---------------------- | ---------- |
| 3–4 MW (2010 r.) | 4–6 MW/km² | Mniejszy rotor, ciaśniejsze umiejscowienie |
| 8–10 MW (lata 20. XX w.) | 5–7 MW/km² | Zrównoważony |
| **14–15 MW (2025+)** | **5–8 MW/km²** | **Duży rotor → szerszy zakres → podobna gęstość** |

Ciekawy paradoks: wraz ze wzrostem turbin ich gęstość mocy nie zmienia się zbytnio. Skąd? Ponieważ większy wirnik = większy obszar śladu = wymagana szersza szczelina. Podczas gdy moc wzrasta proporcjonalnie do $D^2$, wymagana powierzchnia wzrasta proporcjonalnie do $D^2$ — gęstość pozostaje w przybliżeniu stała.

!!! tip "Pytanie na rozmowie kwalifikacyjnej: Dlaczego większe turbiny oznaczają mniej turbin, ale nie mniejszą powierzchnię?"
Odpowiedź kryje się w powyższym paradoksie. Turbina o mocy 15 MW jest ~2 razy mocniejsza niż turbina o mocy 8 MW, więc dla tej samej mocy wymagana jest ~ połowa liczby turbin. Ponieważ jednak średnica wirnika jest o 40% większa ($236 \text{ m}$ w porównaniu z $\sim164 \text{ m}$), odległości między szczelinami również zwiększają się o 40%. Zysk powierzchni netto nie jest tak duży, jak oczekiwano. Prawdziwym zyskiem są oszczędności CAPEX i OPEX wynikające ze zmniejszenia liczby turbin i fundamentów.

---

## Część 6: HVAC czy HVDC?

### Problem: Przenoszenie energii na brzeg

Musimy dostarczyć na brzeg 510 MW energii elektrycznej wytwarzanej przez 34 turbiny, a stamtąd do sieci krajowej za pomocą ponad 40-kilometrowego kabla podmorskiego. Wymaga to podjęcia jednej z najważniejszych decyzji inżynieryjnych w przypadku projektów morskich elektrowni wiatrowych: **HVAC (prąd przemienny wysokiego napięcia) lub HVDC (prąd stały wysokiego napięcia)**

### Fizyka: Problem pojemności kabli podmorskich

Kable podmorskie mają dużą pojemność ze względu na swoją strukturę. Kabel to tak naprawdę bardzo długi kondensator o strukturze przewodnik + izolacja + przewodnik:

$$Q_{kablo} = \omega \cdot C \cdot V^2 \cdot L$$

Tutaj:

- $Q_{kablo}$ = moc bierna (VAr) — pojemnościowa moc bierna wytwarzana przez kabel
- $\omega$ = częstotliwość açısal = $2\pi f$ = $2\pi \times 50$ = 314,16 rad/s
- $C$ = pojemność kabla (F/km) — typowo ~0,17–0,20 µF/km dla kabla XLPE 220 kV
- $V$ = napięcie kabla (V)
- $L$ = długość kabla (km)

Pojemność ta powoduje dwa podstawowe problemy:

**1. Prąd ładowania**

Nawet jeśli kabel nie jest zasilany, ze względu na pojemność płynie prąd ładowania. Prąd ten zużywa część mocy kabla:

$$I_{şarj} = \omega \cdot C \cdot V \cdot L$$

W miarę wydłużania się kabla wzrasta prąd ładowania, a obciążalność czynna kabla maleje. W pewnym momencie (zwykle około 80–120 km, w zależności od poziomu napięcia) prąd ładowania zużywa całą obciążalność kabla i moc czynna staje się nie do wytrzymania.

**2. Efekt Ferrantiego**

Gdy kabel działa bez obciążenia lub przy niskim obciążeniu, pojemnościowe wytwarzanie mocy biernej zwiększa napięcie. Nazywa się to **efektem Ferrantiego**:

$$V_{alıcı} = V_{gönderici} + I_{kapasitif} \cdot X_{kablo}$$

W sieci 220 kV wzrost napięcia na skutek efektu Ferrantiego może przekroczyć dopuszczalny w normie zakres ±5% (do 1,08 pu). Dlatego kompensacja mocy biernej jest obowiązkowa.

### Analiza numeryczna dla naszego projektu

Kabel 220 kV XLPE o długości 45 km:

```
Kablo kapasitansı: C ≈ 0.19 µF/km (3 fazlı XLPE 220 kV tipik değer)

Reaktif güç üretimi:
 Q = ω × C × V² × L × 3 (3 faz)
 Q = 314.16 × 0.19×10⁻⁶ × (220,000/√3)² × 45 × 3
 Q ≈ 85.5 MVAR

Bu, kablonun yüksüz iken 85.5 MVAR kapasitif reaktif güç ürettiği anlamına gelir.
```

### Matryca decyzyjna HVAC vs HVDC

| Kryterium | HVAC (220 kV) | HVDC (±320 kV) |
| -------- | --------------- | ---------------- |
| **Straty kablowe (45 km)** | ~%2–3 | ~%0.5–1 |
| **Koszt inwestycji (CAPEX)** | Kabel niskopasywny | Wysoki — wymagane stacje przekształtnikowe |
| **Koszt konwertera** | Nic | ~200–400 mln € (oba końce) |
| **Problem z mocą bierną** | Tak — wymagany STATCOM | Brak — pojemność nie stanowi problemu w przypadku prądu stałego |
| **Złożoność techniczna** | Niski | Elektronika dużej mocy, chłodzenie |
| **Złożoność konserwacji** | Niski | Średnio-wysoki |
| **Niezawodność (sprawdzona)** | bardzo wysoki | Wysokie, ale mniejsze doświadczenie operacyjne |
| **Ograniczenie odległości** | ~80–120 km (w zależności od napięcia) | Nieograniczony (teoretyczny) |
| **Połączenie wielozaciskowe** | Kolay (szyna zbiorcza prądu przemiennego) | Złożone (technologia wyłączników prądu stałego jest ulepszana) |

### Ekonomiczny próg rentowności

Porównanie kosztów HVAC i HVDC rozkłada się w zależności od odległości:

```
HVAC toplam maliyet = Kablo maliyeti × L + Kompanzasyon ekipmanı
HVDC toplam maliyet = Kablo maliyeti × L + Konvertör istasyonları (sabit maliyet)

HVAC kablo maliyeti > HVDC kablo maliyeti (HVAC 3 fazlı, HVDC bipolar)
HVDC konvertör maliyeti >> HVAC kompanzasyon maliyeti
```

Typowy próg rentowności: **~80 km** (wartość ta waha się w granicach 60–120 km w zależności od lat i kosztów technologii)

Ponieważ długość kabla w naszym projekcie wynosi **45 km**, wyraźnie znajduje się on w **strefie optymalnej dla HVAC**.

### Dlaczego wybraliśmy HVAC — podsumowanie

1. **Odległość 45 km < 80 km progu rentowności** → HVAC jest ekonomicznie lepszy
2. **Główny temat nauczania strategii sterowania STATCOM P2** → Idealna platforma do nauczania HVAC, FACTS (elastyczne systemy transmisji prądu przemiennego)
3. **Pojedyncza morska stacja transformatorowa** Wystarczająca dla systemu HVAC o mocy 510 MW → Nie ma potrzeby stosowania platformy przekształtnikowej HVDC
4. **Bezpośrednie podłączenie do sieci prądu przemiennego** → Brak dodatkowych strat związanych z konwersją AC/DC wymaganych przez HVDC
5. **Prawdziwe polskie projekty** wykorzystują HVAC w tym zakresie odległości

!!! info "Perspektywa na przyszłość: kiedy wymagany jest HVDC?"
Kiedy docelowa dla Polski morska energetyka wiatrowa osiągnie 11 GW (2040), wiele farm będzie musiało zostać podłączonych do sieci. PSE rozwijają linię szkieletową HVDC północ-południe. Linia ta umożliwi przyłączenie wielu gospodarstw do sieci jednym korytarzem przesyłowym HVDC. Co więcej, w przypadku inwestycji oddalonych o więcej niż 80 km, jedyną opcją będzie HVDC.

---

## Rozdział 7: Integracja z siecią – Przyłączenie do systemu PSE 400 kV

### Łańcuch transmisyjny

Droga konwersji napięcia energii elektrycznej z turbiny do sieci krajowej:

```
Türbin Jeneratörü (0.69 kV — düşük gerilim)
    ↓ Türbin içi trafo
66 kV Dizi Kabloları (array cables)
    ↓ 34 türbini birbirine bağlar
Offshore Trafo İstasyonu (OSS — 66/220 kV)
    ↓ GIS (Gaz İzoleli Anahtarlama) ile
220 kV Deniz Altı İhraç Kablosu (45 km XLPE)
    ↓
Kıyı Trafo İstasyonu (Onshore — 220/400 kV)
    ↓
400 kV PSE Ulusal Şebekesi
    ↓
Avrupa İnterkonnekte Sistemi (ENTSO-E)
```

Każdy poziom napięcia jest decyzją inżynierską:

- **0,69 kV → 66 kV:** Wewnątrz turbiny każda turbina posiada własny transformator
- **66 kV:** Standard branżowy dla kabli macierzowych — przejście z 33 kV na 66 kV nastąpiło w przypadku turbin klasy 15 MW (większa turbina = wyższy prąd = grubszy kabel lub wyższe napięcie)
- **66 kV → 220 kV:** W podstacji morskiej – zwiększa napięcie w przypadku przesyłu na duże odległości
- **220 kV → 400 kV:** Lądowe – zgodnie z wymaganiami krajowej sieci przesyłowej PSE

### STATCOM: Dlaczego ±120 MVAR?

Jak obliczyliśmy w Rozdziale 6, 45 km kabla 220 kV wytwarza ~85,5 MVAR pojemnościowej mocy biernej. Aby skompensować tę moc bierną i utrzymać napięcie w zakresie ±5%, wymagany jest STATCOM (Static Synchronous Compensator).

**Rozmiar STATCOM:**

| Część | Wartość | Wyjaśnienie |
| --------- | ------- | ---------- |
| Moc bierna kabla | +85,5 MVAR (pojemnościowy) | Wymagane ciągłe wynagrodzenie |
| Margines redundancji N-1 | +34,5 MVAR | Wystarczająca pojemność w przypadku awarii modułu STATCOM |
| **Nominalna wartość STATCOM** | **±120 MVAR** | Zarówno wchłanianie, jak i wstrzykiwanie |
| reaktor bocznikowy | 50 MVAR | Ciągła kompensacja obciążenia podstawowego — zmniejsza obciążenie STATCOM |

**STATCOM vs SVC (statyczny kompensator VAR) Kararı:**

| Kryterium | STATCOM | SVC |
| -------- | --------- | ----- |
| czas reakcji | <5 ms | ~50 ms |
| Pojemność Q przy niskim napięciu | pełna pojemność | Q ∝ V² (Q maleje wraz ze spadkiem napięcia) |
| rozmiar fizyczny | Kompaktowy | Duży |
| Koszt sprzętu | wyższy | niżej |
| Wpływ na koszt platformy morskiej | Mała platforma → oszczędność kosztów | Wymagana duża platforma |

Preferowano STATCOM, ponieważ:

1. **Zgodność z FRT:** STATCOM zapewnia pełny prąd bierny nawet wtedy, gdy napięcie spadnie do 15% podczas zwarcia — pojemność SVC spada wraz z napięciem
2. **Oszczędności na platformie offshore:** Mniejszy sprzęt → mniejsza platforma → szacowane oszczędności na poziomie ~12 M€
3. **Prędkość:** Czas reakcji <5 ms spełnia wymagania PSE IRiESP FRT

### Wymagania ENTSO-E NC RfG typu D

Moc 510 MW jest klasyfikowana jako generator **typu D** zgodnie z ENTSO-E NC RfG (UE 2016/631) (próg: ≥75 MW). Oto najbardziej rygorystyczny zestaw wymagań:

**Pasmo przenoszenia:**

| mod | Wyjaśnienie | Potrzebować |
| ----- | ---------- | ------------ |
| LFSM-O | Ekstremalne pasmo przenoszenia | f > 50,2 Hz → zmniejszyć moc |
| LFSM-U | Niska częstotliwość | f < 49,8 Hz → zwiększyć moc (jeśli to możliwe) |
| FSM | Tryb wrażliwy na częstotliwość | Ustawienie opadania ~3–5% |

**Kontynuuj pracę podczas usterki (FRT – przejście przez usterkę):**

Zgodnie z wymaganiami PSE IRiESP:

- **LVRT (Lowvoltage Ride-Through):** Pozostań w kontakcie i dostarczaj prąd bierny przez 140 ms, nawet jeśli napięcie spadnie do 15%
- **HVRT (przejście pod wysokim napięciem):** Pozostań połączony przez 20 ms, nawet jeśli napięcie wzrośnie do 120%

```
Gerilim (pu)
1.20 |-----.
   |   |
1.05 |   |---------------------------------- Normal bant üst sınır
1.00 |   |
0.95 |   |---------------------------------- Normal bant alt sınır
   |   |
0.85 |   |
   |   |
0.15 |-----|
   |   |
0.00 +-----+--+--+--+--+--+--+--> Zaman (ms)
   0  140 500 1000 3000

   LVRT Profili: 0.15 pu, 140 ms → kademeli toparlanma
```

Te wymagania FRT zostaną zweryfikowane za pomocą symulacji dynamicznej ANDES w projekcie P2. Sam przepływ obciążenia (Pandapower) nie wystarczy — należy symulować zachowanie dynamiczne.

### Zdolność zwarciowa i koordynacja zabezpieczeń

Model sieci zewnętrznej w punkcie przyłączenia PSE 400 kV:

- **Wytrzymałość zwarciowa:** $S_{sc}$ = 10 GVA
- **Prąd zwarciowy:** $I_{sc}$ = $\frac{S_{sc}}{\sqrt{3} \times V}$ = $\frac{10,000}{\sqrt{3} \times 400}$ ≈ **14,4 kA**

Wartość ta stanowi podstawę wszystkich ustawień przekaźnika zabezpieczeniowego (P2) i programów przełączania (P5). Koordynacja zabezpieczeń zostanie przeprowadzona zgodnie z normą IEC 60909-0:2016 ($c_{max}$ = 1.1, $c_{min}$ = 0.95).

!!! tip "Zasada inżynierska: decyzje projektowe są powiązane"
Każda decyzja projektowa pociąga za sobą następną decyzję:

**Wybór turbiny** (15 MW, wirnik 236 m) →
**Liczba turbin** (34 = 510 MW) →
**İletim tipi** (HVAC, 45 km < 80 km) →
**Pojemność kabla** (85,5 MVAR) →
**Rozmiar STATCOM** (±120 MVAR) →
**Dopasowanie FRT** (symulacja dynamiczna ANDES)

Ta relacja łańcuchowa nazywana jest w inżynierii „podstawą projektu”. Kiedy zmieniasz dowolne ogniwo w łańcuchu, musisz ponownie ocenić wszystkie kolejne ogniwa. W rzeczywistych projektach zmiana podstaw projektowych jest procesem formalnym i wymaga zatwierdzenia.

---

## Rozdział 8: Tabela podsumowująca decyzje

Umieśćmy wszystkie nasze wstępne decyzje projektowe w jednej tabeli referencyjnej:

| Decyzja | Wartość | Powód | Norma/odniesienie |
| ------- | ------- | --------- | ------------------- |
| **Kobiety** | Morze Bałtyckie, na północ od Ustki ~40 km | Rzeczywista bliskość projektu, dane ERA5, płytka woda | PEP2040, ERA5 |
| **Głębokość wody** | 25–40 m | Odpowiednia technologia fundamentowania monopilowego | geotechnika |
| **Źródło wiatru** | 9,0–9,5 m/s (150 m) | ERA5 średnia z 20 lat | ECMWF ERA5 |
| **Model turbiny** | V236-15,0 MW | Używany w prawdziwym projekcie bałtyckim, dojrzały komercyjnie | IEC 61400-1 I-B |
| **Średnica wirnika** | 236 m | Specyfikacja turbiny | Karta danych producenta |
| **Liczba turbin** | 34 | 510 MW / 15 MW – skala szkoleniowa | Decyzja projektowa |
| **Wysokość piasty** | 150 m | Specyfikacja turbiny | Karta danych producenta |
| **Załączenie / Nominalne / Wyłączenie** | 3 / 12,5 / 31 m/s | IEC 61400 klasa I-B | IEC 61400-1 |
| **Zasięg przy wietrze** | 8D = 1888 m | Optymalizacja odzyskiwania śladów | PyWake, DTU |
| **Zasięg bocznego wiatru** | 5D = 1180 m | Kompensacja efektu bocznego | praktyka branżowa |
| **Szacowany obszar** | ~70–100 km² | Rozstaw + strefa buforowa | Obliczenie |
| **Gęstość mocy** | ~6–7 MW/km² | W zakresie standardów branżowych | Aby porównać |
| **Napięcie ciągu** | 66 kV | Standard branżowy dla klasy 15 MW | praktyka branżowa |
| **Napięcie eksportu** | Klimatyzacja 220 kV | 45 km < 80 km progu rentowności | CIGRE, IEC 60287 |
| **Kabel eksportowy** | 45 km pod wodą + 5 km na lądzie | Odległość od pola do brzegu | ograniczenie geograficzne |
| **Moc bierna kabla** | ~85,5 MVAR | Q = obliczenie ωCV²L | IEC 60287-1-1 |
| **STATKOM** | ±120 MVAR | Komp. kabla + Redundancja N-1 | Obliczanie rozmiaru |
| **Dławik bocznikowy** | 50 MVAR | Ciągła kompensacja obciążenia podstawowego | Projekt N-1 |
| **Połączenie sieciowe** | PSE 400 kV | Polska sieć przesyłowa | PSE IRiESP |
| **Kod sieciowy** | NC RfG Końcówka D + PSE IRiESP | ≥75 MW → najbardziej rygorystyczne wymagania | UE 2016/631 |
| **Wytrzymałość zwarciowa** | 10 GVA | Model sieci zewnętrznej | IEC 60909 |
| **Życie projektowe** | 25–30 lat | Standard branżowy | praktyka branżowa |

---

## Quiz — sprawdzenie wiedzy

!!! question "Pytanie 1 (Przypomnij sobie)"
Jaka jest średnia prędkość wiatru na wysokości 150 m w naszym obszarze referencyjnym na Morzu Bałtyckim?

  ??? success "Odpowiedź"
**9,0–9,5 m/s.** Wartość tę uzyskuje się poprzez ekstrapolację danych ERA5 100 m na wysokość piasty 150 m z profilem mocy.

!!! question "Pytanie 2 (Przypomnij sobie)"
Ile m² ma powierzchnia zamiatania turbiny V236-15.0 MW?

  ??? success "Odpowiedź"
**43 742 m².** Obliczenia: $A = \pi \times (236/2)^2 = \pi \times 118^2 = 43,742 \text{ m}^2$. Jest to mniej więcej wielkość 6 boisk piłkarskich.

!!! question "Pytanie 3 (Zrozumienie)"
Jeśli prędkość wiatru w rejonie kilwateru spadnie o 15%, w przybliżeniu o ile procent zmniejszy się wytwarzanie energii?

  ??? success "Odpowiedź"
**Około 39%.** Moc jest proporcjonalna do sześcianu prędkości wiatru: $P \propto v^3$, stąd $0.85^3 = 0.614$, czyli redukcja o 38,6%. To pokazuje, dlaczego nawet niewielkie straty prędkości prowadzą do poważnych strat energii.

!!! question "Pytanie 4 (Zrozumienie)"
W przybliżeniu ile km wynosi minimalna długość kabla, której potrzebujemy, aby używać HVDC zamiast HVAC?

  ??? success "Odpowiedź"
**~80 km** (typowy próg rentowności). Ponieważ długość kabla w naszym projekcie wynosi 45 km, HVAC jest ekonomicznie lepszy. Wartość ta waha się od 60 do 120 km w zależności od lat i kosztów technologii.

!!! question "Pytanie 5 (Zrozumienie)"
Dlaczego ustawiliśmy rozmiar STATCOM na ±120 MVAR? Czy kompensacja kabla 85,5 MVAR nie byłaby wystarczająca?

  ??? success "Odpowiedź"
**Ze względu na zasadę redundancji N-1.** 85,5 MVAR dotyczy wyłącznie warunków nominalnych. Dodano ~40% marginesu, aby zapewnić wystarczającą zdolność kompensacji nawet w przypadku awarii modułu STATCOM. Dodatkowo STATCOM musi mieć zdolność zarówno pochłaniania (+), jak i wtryskiwania (-) — zapotrzebowanie na indukcyjną moc bierną turbin przy pełnym obciążeniu jest również zaspokajane przez STATCOM.

!!! question "Pytanie 6 (trudne)"
Jeżeli straty w śladzie cieplnym w farmie składającej się z 34 turbin wynoszą 12,7% i zostaną zmniejszone do 8,7% przy optymalizacji układu schodkowego, w przybliżeniu ile GWh wyniesie roczny zysk energii przy średniej prędkości wiatru 9,5 m/s i współczynniku wydajności wynoszącym 48%?

  ??? success "Odpowiedź"
AEP brutto (przed śledzeniem):
$AEP_{brüt} = 510 \text{ MW} \times 8,760 \text{ h} \times 0.48 = 2,145 \text{ GWh}$

Różnica strat śladowych: 12,7% − 8,7% = 4,0%

Roczny zysk energii: $2,145 \times 0.04 = \sim85.8 \text{ GWh}$

Przy cenie 72 €/MWh CfD: wzrost przychodów $85,800 \times 72 = \sim6.2 \text{ M€/yıl}$. W ciągu 25 lat użytkowania przekłada się to na ~155 M€ dodatkowych przychodów — dlatego optymalizacja układu jest krytycznym działaniem inżynieryjnym.

!!! question "Pytanie 7 (trudne)"
Na czym polega efekt Ferrantiego i dlaczego jest szczególnie niebezpieczny w przypadku długich kabli podmorskich?

  ??? success "Odpowiedź"
Efekt Ferrantiego to sytuacja, w której napięcie na końcu odbiorczym linii przesyłowej lub kabla jest wyższe niż na końcu wysyłającym podczas pracy bez obciążenia lub przy niewielkim obciążeniu. Powodem jest to, że pojemnościowy prąd ładowania wynikający z dużej pojemności kabla powoduje spadek napięcia (właściwie wzrost) na impedancji kabla.

Kable podmorskie są szczególnie wrażliwe, ponieważ:
    1. Ma 20–40 razy większą pojemność niż linie napowietrzne (grubość izolacji i bliskość gruntu)
    2. Na dużych dystansach (45+ km) pojemnościowa produkcja mocy biernej staje się bardzo wysoka (85,5 MVAR)
    3. Farmy wiatrowe przenoszą minimalne obciążenia w nocy lub przy słabym wietrze – dokładnie w warunkach, w których efekt Ferrantiego jest najsilniejszy

Rozwiązanie: Kompensacja mocy biernej za pomocą STATCOM + dławik bocznikowy. W naszym projekcie będzie to jeden z głównych tematów P2.

---

## Kącik wywiadów

### Proste wyjaśnienie (dla osób niebędących inżynierami)

Przed rozpoczęciem projektu farmy wiatrowej należy podjąć wiele kluczowych decyzji – podobnie jak wybór terenu, plan architektoniczny i podłączenie infrastruktury przed budową domu. Określając miejsce budowy, badasz warunki wietrzne, głębokość morza i fale. Decydując o wielkości turbiny wiatrowej, którą chcesz zastosować, wybierasz najbardziej odpowiednią i sprawdzoną opcję dostępnej technologii. Obliczając, ile turbin należy umieścić, równoważysz zarówno odpowiednią produkcję energii, jak i wystarczającą odległość między turbinami. Podejmując decyzję o sposobie transportu wyprodukowanej energii elektrycznej do miast, na podstawie analizy kosztów i korzyści decydujesz, czy używać prądu przemiennego, czy prądu stałego, w zależności od odległości.

### Opis techniczny (dla panelu przesłuchań)

Na etapie wstępnego projektowania podjęto osiem podstawowych decyzji inżynieryjnych. Lokalizacja została wybrana niedaleko Ustki w polskiej WSE — na podstawie danych z ponownej analizy ERA5 przy średniej prędkości wiatru 9,0–9,5 m/s na wysokości piasty 150 m, głębokości wody 25–40 m (odpowiednia dla monopala) i spokojnych warunkach falowych w porównaniu z Morzem Północnym (Hs < 1,5 m średniorocznie). Turbina została wybrana jako posiadająca certyfikat IEC klasy I-B V236-15,0 MW — powierzchnia skokowa 43 742 m², napęd z napędem półbezpośrednim, w pełni akceptowalny standard branżowy na lata 2024–2026. Moc 34 × 15 MW = 510 MW zapewnia wydajność obliczeniową na skalę edukacyjną, jednocześnie spełniając wymagania NC RfG typu D. W układzie naprzemiennym z rozstawem 8D ​​z wiatrem × 5D z wiatrem bocznym (~1888 m × 1180 m) szacowany obszar farmy wynosi ~70–100 km², a gęstość mocy ~6–7 MW/km². System przesyłowy składa się z układu 66 kV → eksportu HVAC 220 kV (45 km) → łańcucha sieci PSE 400 kV — odległość 45 km znajduje się poniżej progu rentowności HVAC/HVDC (~80 km). Wytwarzanie pojemnościowej mocy biernej ~85,5 MVAR w kablu 220 kV jest kompensowane przez dławik bocznikowy ±120 MVAR STATCOM + 50 MVAR — preferowano STATCOM zamiast SVC, ponieważ pełna wydajność Q jest utrzymywana przy niskim napięciu (zgodność z FRT), a jego zwarta konstrukcja zmniejsza koszt platformy morskiej. Model sieci zewnętrznej o mocy zwarciowej 10 GVA stanowi podstawę koordynacji zabezpieczeń w oparciu o normę IEC 60909.

---

## Zalecana lektura

Sugestie z planu nauczania dotyczące pogłębienia tematów tego kursu:

1. **DTU Wind Energy — Wprowadzenie do energii wiatrowej (Coursera)** — Fizyka wiatru, granica Betza, zależność powierzchni omiatanej
2. **Burton i in. — Podręcznik energii wiatrowej, Wiley** — Rozdział 1-3: Zasoby wiatru, aerodynamika turbin, krzywa mocy
3. **Broszura techniczna CIGRE 610 — Połączenia kablowe generacji morskiej** — HVAC vs HVDC karar çerçevesi
4. **ENTSO-EN NC RfG (UE 2016/631)** – Pełny tekst przepisów, wymagania typu D
5. **Dokumentacja ERA5 (ECMWF)** — podręcznik użytkownika magazynu danych klimatycznych programu Copernicus

---

## Linki — dokąd zmierzają te decyzje?

| W tej lekcji | Powiązany przyszły kurs/projekt |
| ----------- | -------------------------- |
| Dane dotyczące wiatru ERA5 → 9,0–9,5 m/s | **Lekcja 004 (P1):** Dopasowanie Weibulla i integracja krzywej mocy |
| Krzywa mocy V236-15,0MW | **P1:** Modelowanie śladów PyWake, obliczenia AEP |
| Układ schodkowy z 34 drzwiami | **P1:** Optymalizacja układu, redukcja utraty śladów |
| Moc bierna kabla 85,5 MVAR | **P2:** Strategia sterowania STATCOM, symulacja Pandapower |
| Wymagania FRT (15%, 140 ms) | **P2:** Dynamiczna symulacja ANDESÓW |
| Łańcuch 66 kV → 220 kV → 400 kV | **P2:** Schemat jednokreskowy, analiza przepływu obciążenia |
| STATCOM ±120 MVAR | **P2:** Tryby kontroli mocy biernej (opad V, wartość zadana Q) |
| IEC 60909, 10 GVA | **P2:** Obliczanie zwarć, koordynacja zabezpieczeń |
| NC RfG Tip D | **P3:** Definicje alarmów SCADA, monitorowanie zgodności z przepisami sieciowymi |
| Rozstaw turbin | **P5:** Sekwencja uruchomienia, program zasilania kabla do turbiny |
