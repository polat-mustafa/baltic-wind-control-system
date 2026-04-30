# Ders 003 — Ön Tasarım Kararları: Konum, Türbin, Kapasite, Alan ve Şebeke Entegrasyonu

!!! abstract "Ders Navigasyonu"
    :material-arrow-left: **Önceki:** [Ders 002 — Uluslararasılaştırma](lesson-002.md) | **Sonraki:** [Ders 004 — Veritabanı, ERA5 & Weibull](lesson-004.md) :material-arrow-right:

    **Faz:** P1 | **Dil:** Türkçe | **İlerleme:** 4 / 5 | [Tüm Dersler](index.md) | [Öğrenme Yol Haritası](../Learning_Roadmap.md)

> **Date:** 2026-02-24
> **Phase:** P1 (Wind Resource & AEP) — Ön Hazırlık
> **Roadmap sections:** [Section 1.3 Reference Wind Farm Specification, Section 1.4 Industry Context]
> **Language:** Turkish

---

## Ne Öğreneceksiniz

- Açık deniz rüzgar çiftliği projelerinde konum seçiminin hangi fiziksel, ekonomik ve düzenleyici kriterlere dayandığını
- 15 MW sınıfı türbinlerin neden 2024-2026 döneminin endüstri standardı olduğunu ve tarihsel gelişim sürecini
- Rüzgar çiftliği kapasitesi ile türbin sayısı arasındaki ilişkiyi ve "eğitim ölçeği" kavramını
- Türbin aralığı (spacing) hesaplamasıyla toplam çiftlik alanının nasıl belirlendiğini
- HVAC ve HVDC iletim teknolojileri arasındaki mühendislik kararının fiziksel temellerini
- 400 kV ulusal şebekeye entegrasyonun STATCOM, FRT ve şebeke kodu gereksinimlerini neden zorunlu kıldığını

---

## Bölüm 1: Neden Baltık Denizi?

### Gerçek Hayattan Bir Problem

Bir açık deniz rüzgar çiftliği projesine başlamadan önce yanıtlanması gereken ilk soru şudur: **nereye inşa edeceğiz?** Bu soru, ilk bakışta "rüzgar nerede esiyorsa oraya" gibi basit görünür. Ancak gerçekte konum seçimi; rüzgar kaynağı, su derinliği, deniz tabanı jeolojisi, deniz trafiği, çevresel koruma alanları, kıyıya mesafe, şebeke bağlantı noktası ve ülke düzenleyici çerçevesi gibi onlarca parametrenin kesişim kümesidir.

### Fizik: Rüzgar Kaynağı Karşılaştırması

Avrupa denizlerinde ortalama rüzgar hızları önemli farklılıklar gösterir:

| Deniz | Ortalama Rüzgar Hızı (100 m) | Kapasite Faktörü | Özellik |
|-------|-------------------------------|-------------------|---------|
| **Kuzey Denizi** (UK-NL-DE) | 9.5–11.0 m/s | %48–55 | En yüksek kaynak, ancak derin su ve sert dalga koşulları |
| **Baltık Denizi** (PL-SE-DK-FI) | 8.5–10.0 m/s | %42–50 | İyi kaynak, sığ su, sakin dalga, gelişen pazar |
| **Akdeniz** (GR-IT-FR) | 7.0–8.5 m/s | %30–38 | Derin su, yüzer (floating) teknoloji gerekli |
| **İrlanda Denizi** | 9.0–10.5 m/s | %45–52 | İyi kaynak, ancak sınırlı şebeke kapasitesi |

Baltık Denizi'nin Polonya Münhasır Ekonomik Bölgesi (MEB/EEZ) içindeki referans alanımızda (55.0°N–55.5°N, 16.5°E–17.5°E), ERA5 reanaliz verisine göre **100 m yükseklikte ortalama rüzgar hızı 8.8–9.3 m/s** aralığındadır. Güç yasası profilini kullanarak 150 m hub yüksekliğine ekstrapolasyon yapıldığında bu değer **9.0–9.5 m/s**'ye ulaşır — bu, %45–50 kapasite faktörü anlamına gelir.

!!! info "ERA5 Reanaliz Verisi Nedir?"
    ERA5, Avrupa Orta Vadeli Hava Tahmin Merkezi'nin (ECMWF — European Centre for Medium-Range Weather Forecasts) ürettiği küresel atmosferik reanaliz veri setidir. 1940'tan günümüze kadar saatlik çözünürlükte, 0.25° × 0.25° (~25 km) uzaysal ızgarada rüzgar, sıcaklık, basınç ve daha birçok atmosferik değişkeni içerir. Açık deniz rüzgar projelerinde, meteorolojik mast (met-mast) verileri proje sahası özelinde doğrulama sağlarken, ERA5 20+ yıllık uzun dönem istatistiklerin temelini oluşturur.

### Su Derinliği ve Zemin Koşulları

Su derinliği, temel (foundation) tipini ve dolayısıyla projenin sermaye maliyetini (CAPEX) doğrudan belirler:

| Su Derinliği | Temel Tipi | Maliyet Etkisi |
|-------------|------------|----------------|
| 0–30 m | Monopile (tek kazık) | En düşük maliyet, kanıtlanmış teknoloji |
| 25–50 m | Monopile veya Jacket (kafes yapı) | Orta maliyet, 15 MW sınıfı için monopile sınırda |
| 40–60 m | Jacket | Yüksek maliyet, ağır türbinler için tercih |
| >60 m | Yüzer (floating) platform | En yüksek maliyet, ticari olgunlaşma aşamasında |

Referans alanımızda su derinliği **25–40 m** aralığındadır. Bu, 15 MW sınıfı türbinler için monopile (XXL monopile, çapı 10–12 m) teknolojisinin uygulanabilir olduğu bir aralıktır. Baltık Denizi'nin Kuzey Denizi'ne kıyasla daha sığ olması, temel maliyetlerini önemli ölçüde düşürür.

### Dalga Koşulları

Baltık Denizi'nin bir diğer avantajı dalga yüksekliğidir:

| Parametre | Kuzey Denizi | Baltık Denizi |
|-----------|-------------|---------------|
| Anlamlı dalga yüksekliği (Hs, yıllık ort.) | 1.5–2.5 m | 0.8–1.5 m |
| 50 yıllık maksimum Hs | 12–15 m | 7–9 m |
| Kurulum penceresi (Hs < 1.5 m) | Yılda ~180 gün | Yılda ~220 gün |

Daha sakin dalga koşulları, türbin kurulum operasyonları için daha geniş bir hava penceresi (weather window) sağlar. Bu da kurulum süresini kısaltır ve jack-up gemi (kurulum gemisi) kiralama maliyetlerini düşürür.

### Buz Koşulları

Baltık Denizi'nin kuzey kesimlerinde (Finlandiya, İsveç kuzeyi) kış aylarında deniz buzu oluşabilir. Ancak Polonya MEB'inin güney Baltık konumu nedeniyle buz oluşma riski düşüktür. Yine de IEC 61400-1 Ek E (çevre koşulları) kapsamında buz yükü analizi yapılması standart bir gereksinimdir. Referans alanımızda ciddi buz riski bulunmamaktadır.

### Polonya'nın Enerji Politikası: PEP2040

Polonya Enerji Politikası 2040 (PEP2040 — Polityka Energetyczna Polski do 2040 roku), açık deniz rüzgar enerjisi için aşağıdaki hedefleri belirlemiştir:

| Hedef | Kapasite |
|-------|----------|
| 2028 (ilk dalga) | ~3.5 GW |
| 2030 | 5.9 GW |
| 2035 | ~8–9 GW |
| 2040 | 11 GW |

Bu hedefler, Polonya'nın kömürden yenilenebilir enerjiye geçiş stratejisinin temel direğidir. 2025-2026 itibarıyla ilk dalga projelerinin inşaatı fiilen başlamıştır — bu, açık deniz rüzgar mühendisleri için doğrudan istihdam talebi yaratmaktadır.

### Neden Bu Konum?

Referans alanımızı (Ustka kuzeyinde, ~40 km açıkta) seçmemizin nedenleri:

1. **Gerçek proje yakınlığı:** Hâlihazırda inşa edilmekte olan Polonya açık deniz rüzgar projeleri bu bölgede konumlanmaktadır
2. **ERA5 veri kalitesi:** 0.25° çözünürlükte 20+ yıllık güvenilir rüzgar verisi mevcuttur
3. **Su derinliği uygunluğu:** 25–40 m, monopile temel teknolojisi ile uyumludur
4. **Kıyıya mesafe:** ~40–50 km — HVAC iletim teknolojisi için optimal aralıktadır (bu konuyu Bölüm 6'da detaylı inceleyeceğiz)
5. **Şebeke bağlantısı:** PSE'nin (Polskie Sieci Elektroenergetyczne) Baltık kıyısındaki 400 kV iletim hatlarına erişim mesafesi makuldür

!!! tip "Mühendislik Prensibi: Konum Seçimi Multidisipliner Bir Karardır"
    Konum seçimi tek bir parametreye (örneğin yalnızca rüzgar hızı) dayanmaz. Rüzgar kaynağı, su derinliği, zemin koşulları, deniz trafiği, çevresel kısıtlar (kuş göç yolları, deniz memelileri koruma alanları), kıyıya mesafe, şebeke bağlantı kapasitesi ve düzenleyici çerçeve birlikte değerlendirilir. Tüm bu parametrelerin kesişiminde uygun alan (sweet spot) belirlenir.

---

## Bölüm 2: Neden 15 MW Sınıfı Türbin?

### Türbin Büyüklüğünün Tarihsel Gelişimi

Açık deniz rüzgar türbinleri son 20 yılda dramatik bir büyüme süreci yaşamıştır:

| Dönem | Tipik Güç | Rotor Çapı | Süpürülen Alan | Proje Örnekleri |
|-------|-----------|------------|----------------|-----------------|
| 2005–2010 | 2–3 MW | 80–90 m | ~5,000 m² | İlk nesil açık deniz projeleri |
| 2010–2015 | 3.6–6 MW | 120–154 m | ~11,000–18,600 m² | İkinci nesil, dişli kutulu (gearbox) türbinler |
| 2015–2020 | 6–8 MW | 154–167 m | ~18,600–21,900 m² | Doğrudan sürüş (direct drive) geçişi |
| 2020–2023 | 9.5–14 MW | 174–222 m | ~23,800–38,700 m² | Büyük ölçekli ticari projeler |
| **2024–2026** | **14–15 MW** | **222–236 m** | **~38,700–43,700 m²** | **Güncel standart — Baltık projeleri** |
| 2027+ (geliştirme) | 16–20+ MW | 252–260 m | ~49,900–53,100 m² | Prototip ve ön seri üretim |

### Fizik: Süpürülen Alan ve Güç İlişkisi

Bir rüzgar türbininin yakalayabileceği maksimum güç, Betz limiti tarafından sınırlandırılmış olarak, süpürülen alana (swept area) ve rüzgar hızının küpüne bağlıdır:

$$P = \frac{1}{2} \cdot \rho \cdot A \cdot v^3 \cdot C_p$$

Burada:

- $P$ = mekanik güç (W)
- $\rho$ = hava yoğunluğu (kg/m³) — deniz seviyesinde ~1.225 kg/m³
- $A$ = süpürülen alan (m²) = $\pi r^2$ = $\pi (D/2)^2$
- $v$ = rüzgar hızı (m/s)
- $C_p$ = güç katsayısı — Betz limiti $C_{p,max} = 16/27 \approx 0.593$

Bu denklemin pratik anlamı şudur:

1. **Süpürülen alan iki katına çıkarsa**, yakalanabilir güç iki katına çıkar (lineer ilişki)
2. **Rüzgar hızı iki katına çıkarsa**, yakalanabilir güç sekiz katına çıkar (kübik ilişki)
3. **Rotor çapı iki katına çıkarsa**, süpürülen alan dört katına çıkar ($A \propto D^2$), dolayısıyla yakalanabilir güç dört katına çıkar

Bu fiziksel gerçeklik, endüstriyi daha büyük rotorlar yapmaya iten temel itici güçtür.

### Neden 15 MW — Neden 12 veya 20 Değil?

**2024-2026 döneminde 15 MW sınıfı türbinlerin endüstri standardı olmasının üç temel nedeni:**

**1. Ticari Olgunluk (Technology Readiness Level — TRL)**

Bir türbin modeli prototipten seri üretime geçene kadar tipik olarak 5–8 yıl sürer. 2024-2026 döneminde:

- **12 MW sınıfı:** Tam olgun, ancak yeni projelerde artık tercih edilmiyor (önceki nesil)
- **14–15 MW sınıfı:** Seri üretimde, sipariş defterlerinde, inşaatta — **tam ticari olgunluk**
- **18–20 MW sınıfı:** Prototip veya ön seri üretim aşamasında — henüz bankalar tarafından finanse edilebilir (bankable) düzeyde değil

Finansman sağlayabilmek (project finance) için türbinin "kanıtlanmış teknoloji" (proven technology) statüsünde olması gerekir. 15 MW sınıfı, 2026 itibarıyla bu statüdedir.

**2. LCOE Optimizasyonu (Levelized Cost of Energy)**

LCOE, bir projenin ömür boyu maliyetini ömür boyu enerji üretimine böler:

$$LCOE = \frac{CAPEX + \sum_{t=1}^{n} \frac{OPEX_t}{(1+r)^t}}{\sum_{t=1}^{n} \frac{AEP_t}{(1+r)^t}}$$

Daha büyük türbinler:

- **CAPEX artışı:** Tek türbin maliyeti artar (~10–15 M€/türbin)
- **Türbin sayısı azalışı:** Aynı kapasite için daha az türbin gerekir → daha az temel, daha az kablo
- **AEP artışı:** Daha büyük süpürülen alan → daha fazla enerji
- **Bakım maliyeti azalışı:** Daha az türbin = daha az bakım ziyareti

Net sonuç: 15 MW sınıfında LCOE, 12 MW sınıfına göre ~%8–12 daha düşüktür. Ancak 20 MW sınıfı henüz tedarik zinciri ve lojistik altyapı (liman kapasitesi, kurulum gemisi kullanılabilirliği) nedeniyle LCOE avantajını kanıtlayamamıştır.

**3. Tedarik Zinciri ve Lojistik Uygunluk**

15 MW sınıfı türbinlerin kanat uzunluğu yaklaşık 115 m'dir. Bu kanatların üretim tesisinden limana, limandan kurulum sahasına taşınması özel lojistik gerektirir. 2026 itibarıyla:

- 115 m kanatlar için liman altyapısı ve kurulum gemileri mevcut ve operasyoneldir
- 126–130 m kanatlar (20 MW sınıfı) için henüz yeterli sayıda uygun gemi ve liman bulunmamaktadır

### Standartlar: IEC 61400-1 Türbin Sınıflandırması

IEC 61400-1, türbinleri rüzgar hızı ve türbülans yoğunluğuna göre sınıflandırır:

| IEC Sınıfı | Referans Rüzgar Hızı (V_ref) | Yıllık Ortalama | Türbülans Sınıfı |
|-----------|-------------------------------|-----------------|------------------|
| **I-A** | 50 m/s | 10 m/s | Yüksek |
| **I-B** | 50 m/s | 10 m/s | Orta |
| II-A | 42.5 m/s | 8.5 m/s | Yüksek |
| II-B | 42.5 m/s | 8.5 m/s | Orta |
| III-A | 37.5 m/s | 7.5 m/s | Yüksek |

Referans türbinimiz V236-15.0 MW, **IEC Sınıf I-B** olarak sertifikalandırılmıştır:

- 50 m/s referans rüzgar hızına (10 dakikalık ortalama) dayanacak yapısal bütünlük
- Orta türbülans yoğunluğu (B sınıfı) — açık deniz koşulları için uygun
- 31 m/s cut-out hızı — güvenlik sistemi bu hızda türbini durdurur

Baltık Denizi'ndeki referans alanımızda yıllık ortalama rüzgar hızı ~9.0–9.5 m/s (150 m yükseklikte) olduğundan, Sınıf I-B türbin bu koşullar için fazlasıyla yeterlidir.

!!! warning "Yaygın Hata: Cut-out Hızını Karıştırmak"
    Cut-out hızı (31 m/s) ile referans rüzgar hızı (50 m/s) farklı kavramlardır. Cut-out, operasyonel durdurma hızıdır — türbin bu hızda kontrollü olarak durur. Referans rüzgar hızı ise yapısal tasarım parametresidir — türbinin dayanması gereken ekstrem yük koşulunu tanımlar. Bir mülakatta bu farkı bilmek önemlidir.

---

## Bölüm 3: Türbin Markası ve Model Seçimi

### V236-15.0 MW Teknik Özellikleri

| Parametre | Değer | Açıklama |
|-----------|-------|----------|
| Nominal güç | 15.0 MW | Generatör çıkış gücü |
| Rotor çapı | 236 m | Dünyanın en büyük rotorlarından biri |
| Süpürülen alan | 43,742 m² | $\pi \times (236/2)^2$ |
| Hub yüksekliği | 150 m | Kule + temel üzerinden toplam yükseklik |
| Kanat uzunluğu | ~115.5 m | Her bir kanat, Airbus A380 kanat açıklığı (79.75 m) ile karşılaştırın |
| IEC sınıfı | I-B | Yüksek rüzgar, orta türbülans |
| Cut-in hızı | 3 m/s | Türbinin üretime başladığı hız |
| Nominal hız | 11.1 m/s | Nominal güce ulaşılan hız |
| Cut-out hızı | 31 m/s | Güvenlik durdurması hızı |
| Tahrik tipi | Yarı-doğrudan sürüş (medium-speed gearbox) | Tek kademeli dişli kutusu + PMG (kalıcı mıknatıslı jeneratör) |
| Ct (nominal hızda) | 0.28 | İtme katsayısı — iz (wake) modellemede kritik |

### Neden Bu Belirli Türbin Modeli?

Bu projenin eğitim amaçlı bir simülasyon olduğunu unutmayın. Türbin seçiminin dört temel gerekçesi vardır:

**1. Gerçek Proje Uygulanabilirliği**

Polonya Baltık Denizi'nde 2025-2026 döneminde fiilen inşa edilen projelerde V236-15.0 MW kullanılmaktadır. Bu, simülasyonumuzun akademik bir alıştırma değil, gerçek endüstri pratiğinin aynası olmasını sağlar.

**2. Kamuya Açık Teknik Veri**

Mühendislik simülasyonu yapabilmek için güç eğrisi (power curve), itme katsayısı (Ct curve), boyutsal özellikler ve operasyonel parametrelerin bilinmesi gerekir. V236-15.0 MW'ın teknik özellikleri kamuya açık dokümanlarda yayınlanmıştır.

**3. Endüstri Standardı Temsili**

14–15 MW sınıfı, 2024-2026 döneminde Avrupa açık deniz rüzgar sektörünün standart türbin büyüklüğüdür. Bu sınıfta iki ana rakip bulunur:

| Parametre | Türbin A (15 MW) | Türbin B (14 MW) |
|-----------|-------------------|-------------------|
| Rotor çapı | 236 m | 236 m |
| Tahrik tipi | Yarı-doğrudan sürüş | Doğrudan sürüş (direct drive) |
| Hub yüksekliği | 150 m | ~150 m |
| IEC sınıfı | I-B | I-B |

Her iki türbin de 236 m rotor çapına sahiptir — aynı süpürülen alan. Ancak tahrik mekanizmaları farklıdır. Bu proje kapsamında V236-15.0 MW tercih edilmiştir çünkü Polonya'daki ilk büyük ölçekli açık deniz rüzgar projesinde kullanılan türbin budur ve mülakatlarda "aynı türbin" diyebilmek güçlü bir avantajdır.

**4. Portföy Değeri**

Bir mülakatta "Ben 510 MW'lık simülasyonumda gerçek projelerde kullanılan aynı türbini kullandım — hesaplarım doğrudan uygulanabilir" demek, "genel bir türbin modeliyle çalıştım" demekten çok daha etkilidir.

!!! info "Neden Firma Adları Kullanmıyoruz?"
    Bu ders boyunca spesifik geliştirici firma adlarından kaçınıyoruz. Nedeni profesyonel etik ve tarafsızlıktır. Mühendislik kararlarını firma adıyla değil, teknik parametrelerle gerekçelendirmek profesyonel bir yaklaşımdır. Türbin adı (V236-15.0) ise bir ürün spesifikasyonudur ve kamuya açık teknik bir referanstır.

---

## Bölüm 4: Kapasite Hesabı — Neden 34 Türbin?

### Temel Matematik

$$N_{türbin} = \frac{P_{farm}}{P_{türbin}} = \frac{510 \text{ MW}}{15.0 \text{ MW}} = 34 \text{ türbin}$$

Bu basit bir bölme işlemidir, ancak ardındaki mühendislik kararları basit değildir.

### Neden 510 MW Toplam Kapasite?

Toplam kapasitenin belirlenmesinde üç kısıt dengelenmiştir:

**1. Eğitim Ölçeği Kısıtı**

| Türbin Sayısı | Gerçekçilik | Hesaplama Yükü | Eğitim Değeri |
|--------------|-------------|-----------------|---------------|
| < 10 | Düşük — iz etkileri önemsiz | Çok düşük | Düşük |
| 10–20 | Orta — basitleştirilmiş iz | Düşük | Orta |
| **30–40** | **Yüksek — gerçekçi iz etkileşimi** | **Orta** | **Yüksek** |
| 50–100 | Çok yüksek | Yüksek | Aynı kavramlar |
| > 100 | Gerçek proje ölçeği | Çok yüksek | Marjinal artış |

34 türbin, iz etkilerinin (wake effects) gerçekçi bir şekilde modellenmesi için yeterli karmaşıklığı sağlarken, hesaplama süresini makul seviyelerde tutar.

**2. Ölçeklenebilirlik**

Simülasyonumuz 34 × 15 MW = 510 MW olarak tasarlanmıştır, ancak aynı kod altyapısı kolaylıkla ölçeklenebilir:

- 76 × 15 MW = 1,140 MW (gerçek proje boyutu)
- 100 × 14 MW = 1,400 MW (alternatif proje boyutu)
- 200+ türbin çiftlikleri (gelecek nesil mega projeler)

**3. Şebeke Entegrasyonu Gereksinimi**

510 MW, ENTSO-E NC RfG (Network Code Requirements for Generators) kapsamında **Tip D jeneratör** sınıfına girer (≥75 MW). Bu, en katı şebeke kodu gereksinimlerinin uygulanması anlamına gelir:

- Tam Frekans Yanıt Modları (LFSM-O, LFSM-U, FSM)
- Arıza Sırasında Çalışmaya Devam (FRT — Fault Ride-Through)
- Tam P-Q yetkinlik diyagramı (reactive power capability)
- Harmonik ve fliker (titreşim) limitleri

Bu gereksinimler projenin P2 (HV Grid Integration) aşamasının temelini oluşturur.

### Gerçek Projelerle Karşılaştırma

| Parametre | Simülasyonumuz | Gerçek Projeler (tipik) |
|-----------|---------------|------------------------|
| Türbin sayısı | 34 | 50–150 |
| Toplam kapasite | 510 MW | 700 MW – 1.5 GW |
| Offshore trafo sayısı | 1 | 1–3 |
| İletim tipi | HVAC 220 kV | HVAC veya HVDC |

510 MW'ımız, gerçek projelerin alt sınırında konumlanır. Ancak tüm mühendislik kavramları (iz modelleme, şebeke analizi, SCADA, koruma koordinasyonu) 510 MW'da da 1.5 GW'da da aynı fiziksel prensiplere dayanır. Fark ölçektir, kavramlarda değil.

---

## Bölüm 5: Rüzgar Çiftliği Alan Hesabı

### Türbin Aralığı (Spacing) Fiziği

Türbinler birbirine çok yakın yerleştirilirse, rüzgar yönünde (downwind) bulunan türbinler, önlerindeki türbinin oluşturduğu iz bölgesinde (wake region) kalır. İz bölgesinde:

- **Rüzgar hızı düşer** — üst akış türbini kinetik enerji çektiği için
- **Türbülans artar** — bozulmuş akış nedeniyle
- **Güç üretimi azalır** — $P \propto v^3$ ilişkisi nedeniyle küçük hız düşüşleri bile ciddi güç kaybına yol açar

Örneğin, iz bölgesinde rüzgar hızı %10 düşerse, güç üretimi %27 azalır ($0.9^3 = 0.729$).

### Standartlar ve Endüstri Pratiği

IEC 61400-1 minimum aralık belirlemez, ancak endüstri pratiği ve DTU (Danimarka Teknik Üniversitesi) araştırmaları şu aralıkları önerir:

| Yön | Aralık (D = rotor çapı) | Neden |
|-----|-------------------------|-------|
| **Rüzgar yönü (downwind)** | 7D–10D | İz toparlanması (wake recovery) — çoğu enerji 7D sonra geri kazanılır |
| **Çapraz rüzgar (crosswind)** | 4D–6D | Yan iz etkisi daha zayıf |

Projemizde seçilen aralıklar:

- **Downwind:** 8D = 8 × 236 m = **1,888 m**
- **Crosswind:** 5D = 5 × 236 m = **1,180 m**

### Alan Hesabı

Türbin yerleşimi genellikle kademeli sıralar (staggered rows) şeklinde yapılır. 34 türbin için tipik bir düzen:

**Adım 1: Sıra düzeni belirleme**

Baskın rüzgar yönü BGB (WSW — West-Southwest) olduğundan, sıralar bu yöne dik yerleştirilir.

Olası düzen: 6 sıra × 5–6 türbin (toplam 34)

Örnek düzen: 6 + 6 + 6 + 6 + 5 + 5 = 34 türbin

**Adım 2: Boyutsal hesap**

```
Çapraz rüzgar yönünde (sıra uzunluğu):
  6 türbin × 1,180 m aralık = 5,900 m (en geniş sıra)

Rüzgar yönünde (sıra derinliği):
  6 sıra × 1,888 m aralık = 9,440 m

Dikdörtgen alan:
  5.9 km × 9.4 km ≈ 55.5 km²
```

**Adım 3: Tampon bölge ekleme**

Gerçek projelerde çiftlik sınırı, en dıştaki türbinlerin etrafında minimum 500 m tampon bölge gerektirir (deniz trafiği güvenliği, bakım erişimi):

```
(5.9 + 1.0) km × (9.4 + 1.0) km ≈ 71.8 km²
```

**Adım 4: Düzensiz sınır düzeltmesi**

Staggered layout ve deniz tabanı kısıtları nedeniyle gerçek alan dikdörtgensel olmayacaktır. Tipik düzeltme faktörü ~1.2–1.4:

```
Tahmini toplam alan: ~70–100 km²
```

### Güç Yoğunluğu (Power Density)

Güç yoğunluğu, birim alan başına kurulu kapasiteyi gösterir:

$$\rho_{güç} = \frac{P_{farm}}{A_{farm}} = \frac{510 \text{ MW}}{~80 \text{ km}^2} \approx 6.4 \text{ MW/km}^2$$

Endüstri karşılaştırması:

| Türbin Sınıfı | Tipik Güç Yoğunluğu | Açıklama |
|--------------|----------------------|----------|
| 3–4 MW (2010'lar) | 4–6 MW/km² | Daha küçük rotor, daha sık yerleşim |
| 8–10 MW (2020'ler) | 5–7 MW/km² | Dengeli |
| **14–15 MW (2025+)** | **5–8 MW/km²** | **Büyük rotor → daha geniş aralık → benzer yoğunluk** |

İlginç bir paradoks: Türbinler büyüdükçe güç yoğunluğu çok fazla değişmez. Neden? Çünkü büyük rotor = büyük iz bölgesi = daha geniş aralık gereksinimi. Güç $D^2$'ye orantılı artarken, gereken alan da $D^2$'ye orantılı artar — yoğunluk yaklaşık sabit kalır.

!!! tip "Mülakat Sorusu: Neden Daha Büyük Türbinler Daha Az Türbin Demektir Ama Daha Küçük Alan Demek Değildir?"
    Cevap yukarıdaki paradokstadır. 15 MW türbin 8 MW'a göre ~2 kat daha güçlüdür, dolayısıyla aynı kapasite için ~yarı sayıda türbin gerekir. Ancak rotor çapı %40 daha büyük olduğundan ($236 \text{ m}$ vs $\sim164 \text{ m}$), aralık mesafeleri de %40 artar. Net alan kazancı beklenen kadar büyük değildir. Asıl kazanç türbin ve temel sayısının azalmasından gelen CAPEX ve OPEX tasarrufudur.

---

## Bölüm 6: HVAC mi, HVDC mi?

### Problem: Enerjiyi Kıyıya Taşımak

34 türbin tarafından üretilen 510 MW elektriği, 40+ km deniz altı kablosuyla kıyıya ve oradan ulusal şebekeye ulaştırmamız gerekir. Bu, açık deniz rüzgar projelerinin en kritik mühendislik kararlarından birini gerektirir: **HVAC (Yüksek Gerilim Alternatif Akım) mı yoksa HVDC (Yüksek Gerilim Doğru Akım) mı?**

### Fizik: Deniz Altı Kablolarının Kapasitans Sorunu

Deniz altı kabloları, yapıları gereği büyük kapasitansa sahiptir. Bir kablo, iletken + yalıtım + iletken yapısıyla aslında çok uzun bir kapasitördür:

$$Q_{kablo} = \omega \cdot C \cdot V^2 \cdot L$$

Burada:

- $Q_{kablo}$ = reaktif güç (VAr) — kablonun ürettiği kapasitif reaktif güç
- $\omega$ = açısal frekans = $2\pi f$ = $2\pi \times 50$ = 314.16 rad/s
- $C$ = kablo kapasitansı (F/km) — XLPE 220 kV kablo için tipik olarak ~0.17–0.20 µF/km
- $V$ = kablo gerilimi (V)
- $L$ = kablo uzunluğu (km)

Bu kapasitans, iki temel soruna yol açar:

**1. Şarj Akımı (Charging Current)**

Kablo hiç güç taşımasa bile, kapasitans nedeniyle bir şarj akımı akar. Bu akım, kablonun güç taşıma kapasitesinin bir kısmını tüketir:

$$I_{şarj} = \omega \cdot C \cdot V \cdot L$$

Kablo uzadıkça şarj akımı artar ve kablonun aktif güç taşıma kapasitesi azalır. Bir noktada (tipik olarak 80–120 km civarında, gerilim seviyesine bağlı olarak) şarj akımı kablonun tüm taşıma kapasitesini tüketir ve aktif güç taşınamaz hale gelir.

**2. Ferranti Etkisi**

Kablo yüksüz veya düşük yükte çalışırken, kapasitif reaktif güç üretimi gerilimi yükseltir. Bu, **Ferranti etkisi** olarak bilinir:

$$V_{alıcı} = V_{gönderici} + I_{kapasitif} \cdot X_{kablo}$$

220 kV sistemde Ferranti etkisi nedeniyle gerilim yükselmesi, şebeke kodunun izin verdiği ±%5 bandını aşabilir (1.08 pu'ya kadar çıkabilir). Bu nedenle reaktif güç kompanzasyonu zorunludur.

### Projemiz İçin Sayısal Analiz

220 kV XLPE kablosu, 45 km uzunluk:

```
Kablo kapasitansı: C ≈ 0.19 µF/km (3 fazlı XLPE 220 kV tipik değer)

Reaktif güç üretimi:
  Q = ω × C × V² × L × 3 (3 faz)
  Q = 314.16 × 0.19×10⁻⁶ × (220,000/√3)² × 45 × 3
  Q ≈ 85.5 MVAR

Bu, kablonun yüksüz iken 85.5 MVAR kapasitif reaktif güç ürettiği anlamına gelir.
```

### HVAC vs HVDC Karar Matrisi

| Kriter | HVAC (220 kV) | HVDC (±320 kV) |
|--------|---------------|----------------|
| **Kablo kayıpları (45 km)** | ~%2–3 | ~%0.5–1 |
| **Yatırım maliyeti (CAPEX)** | Düşük — pasif kablo | Yüksek — konvertör istasyonları gerekli |
| **Konvertör maliyeti** | Yok | ~200–400 M€ (her iki uçta) |
| **Reaktif güç sorunu** | Evet — STATCOM gerekir | Yok — DC'de kapasitans sorun yaratmaz |
| **Teknik karmaşıklık** | Düşük | Yüksek — güç elektroniği, soğutma |
| **Bakım karmaşıklığı** | Düşük | Orta-Yüksek |
| **Güvenilirlik (kanıtlanmışlık)** | Çok yüksek | Yüksek, ancak daha az operasyonel deneyim |
| **Mesafe limiti** | ~80–120 km (gerilime bağlı) | Sınırsız (teorik) |
| **Çok terminalli bağlantı** | Kolay (AC busbar) | Karmaşık (DC breaker teknolojisi gelişiyor) |

### Ekonomik Başa Baş Noktası

HVAC ve HVDC arasındaki maliyet karşılaştırması, mesafeye bağlı olarak kesişir:

```
HVAC toplam maliyet = Kablo maliyeti × L + Kompanzasyon ekipmanı
HVDC toplam maliyet = Kablo maliyeti × L + Konvertör istasyonları (sabit maliyet)

HVAC kablo maliyeti > HVDC kablo maliyeti (HVAC 3 fazlı, HVDC bipolar)
HVDC konvertör maliyeti >> HVAC kompanzasyon maliyeti
```

Tipik başa baş noktası: **~80 km** (bu değer yıllara ve teknoloji maliyetlerine göre 60–120 km arasında değişir)

Projemizde kablo uzunluğu **45 km** olduğundan, açık bir şekilde **HVAC optimal bölgesindedir**.

### Neden HVAC Seçtik — Özet

1. **45 km mesafe < 80 km başa baş noktası** → HVAC ekonomik olarak üstün
2. **STATCOM kontrol stratejisi P2'nin temel öğretim konusu** → HVAC, FACTS (Flexible AC Transmission Systems) öğretimi için ideal platform
3. **Tek offshore trafo istasyonu** 510 MW HVAC sistemi için yeterli → HVDC konvertör platformuna gerek yok
4. **AC şebeke bağlantısı doğrudan** → HVDC'nin gerektirdiği ek AC/DC dönüşüm kayıpları yok
5. **Gerçek Polonya projeleri** bu mesafe aralığında HVAC kullanmaktadır

!!! info "Gelecek Perspektif: HVDC Ne Zaman Gerekir?"
    Polonya'nın açık deniz rüzgar hedefi 11 GW'a (2040) ulaştığında, çok sayıda çiftliğin şebekeye bağlanması gerekecektir. PSE, kuzey-güney yönünde bir HVDC omurga hattı geliştirmektedir. Bu hat, birden fazla çiftliğin tek bir HVDC iletim koridoru üzerinden şebekeye bağlanmasını sağlayacaktır. Ayrıca 80 km'den uzak sahaların geliştirilmesi durumunda HVDC tek seçenek olacaktır.

---

## Bölüm 7: Şebeke Entegrasyonu — 400 kV PSE Sistemine Bağlantı

### İletim Zinciri

Türbinden ulusal şebekeye giden elektriğin gerilim dönüşüm yolculuğu:

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

Her gerilim seviyesi bir mühendislik kararıdır:

- **0.69 kV → 66 kV:** Türbin içinde, her türbin kendi trafosuna sahip
- **66 kV:** Dizi (array) kabloları için endüstri standardı — 33 kV'dan 66 kV'a geçiş, 15 MW sınıfı türbinlerle birlikte olmuştur (daha büyük türbin = daha yüksek akım = daha kalın kablo veya daha yüksek gerilim)
- **66 kV → 220 kV:** Offshore trafo istasyonunda — uzun mesafe iletim için gerilimi yükseltir
- **220 kV → 400 kV:** Kıyıda — PSE ulusal iletim şebekesine uyum için

### STATCOM: Neden ±120 MVAR?

Bölüm 6'da hesapladığımız gibi, 45 km'lik 220 kV kablo ~85.5 MVAR kapasitif reaktif güç üretir. Bu reaktif gücü kompanse etmek ve gerilimi ±%5 bandında tutmak için STATCOM (Static Synchronous Compensator) gereklidir.

**STATCOM boyutlandırması:**

| Bileşen | Değer | Açıklama |
|---------|-------|----------|
| Kablo reaktif gücü | +85.5 MVAR (kapasitif) | Sürekli kompanzasyon gerekli |
| N-1 yedeklilik marjı | +34.5 MVAR | Bir STATCOM modülü arızasında yeterli kapasite |
| **STATCOM nominal** | **±120 MVAR** | Hem absorbsiyon hem enjeksiyon |
| Şönt reaktör | 50 MVAR | Sürekli taban yük kompanzasyonu — STATCOM iş yükünü azaltır |

**STATCOM vs SVC (Static VAR Compensator) Kararı:**

| Kriter | STATCOM | SVC |
|--------|---------|-----|
| Yanıt süresi | <5 ms | ~50 ms |
| Düşük gerilimde Q kapasitesi | Tam kapasite | Q ∝ V² (gerilim düştükçe Q düşer) |
| Fiziksel boyut | Kompakt | Büyük |
| Ekipman maliyeti | Daha yüksek | Daha düşük |
| Offshore platform maliyetine etkisi | Küçük platform → maliyet tasarrufu | Büyük platform gerekli |

STATCOM tercih edilmiştir çünkü:

1. **FRT uyumu:** Arıza sırasında gerilim %15'e düştüğünde bile STATCOM tam reaktif akım sağlar — SVC'nin kapasitesi gerilimle birlikte çöker
2. **Offshore platform tasarrufu:** Daha küçük ekipman → daha küçük platform → tahmini ~12 M€ tasarruf
3. **Hız:** <5 ms yanıt süresi, PSE IRiESP FRT gereksinimlerini karşılar

### ENTSO-E NC RfG Tip D Gereksinimleri

510 MW kapasite, ENTSO-E NC RfG (EU 2016/631) kapsamında **Tip D** jeneratör sınıfına girer (eşik: ≥75 MW). Bu en katı gereksinim setidir:

**Frekans Yanıtı:**

| Mod | Açıklama | Gereksinim |
|-----|----------|------------|
| LFSM-O | Aşırı frekans yanıtı | f > 50.2 Hz → güç azalt |
| LFSM-U | Düşük frekans yanıtı | f < 49.8 Hz → güç artır (mümkünse) |
| FSM | Frekans duyarlı mod | Droop ayarı ~%3–5 |

**Arıza Sırasında Çalışmaya Devam (FRT — Fault Ride-Through):**

PSE IRiESP gereksinimleri kapsamında:

- **LVRT (Low Voltage Ride-Through):** Gerilim %15'e düşse bile 140 ms boyunca bağlı kal ve reaktif akım enjekte et
- **HVRT (High Voltage Ride-Through):** Gerilim %120'ye çıksa bile 20 ms boyunca bağlı kal

```
Gerilim (pu)
1.20 |-----.
     |     |
1.05 |     |----------------------------------  Normal bant üst sınır
1.00 |     |
0.95 |     |----------------------------------  Normal bant alt sınır
     |     |
0.85 |     |
     |     |
0.15 |-----|
     |     |
0.00 +-----+--+--+--+--+--+--+--> Zaman (ms)
     0   140  500  1000  3000

     LVRT Profili: 0.15 pu, 140 ms → kademeli toparlanma
```

Bu FRT gereksinimleri, P2 projesinde ANDES dinamik simülasyonu ile doğrulanacaktır. Sadece yük akışı (load flow — Pandapower) yeterli değildir — dinamik davranışın simüle edilmesi gerekir.

### Kısa Devre Kapasitesi ve Koruma Koordinasyonu

400 kV PSE bağlantı noktasında dış şebeke modeli:

- **Kısa devre kapasitesi:** $S_{sc}$ = 10 GVA
- **Kısa devre akımı:** $I_{sc}$ = $\frac{S_{sc}}{\sqrt{3} \times V}$ = $\frac{10,000}{\sqrt{3} \times 400}$ ≈ **14.4 kA**

Bu değer, tüm koruma röle ayarlarının (P2) ve anahtarlama programlarının (P5) temelini oluşturur. Koruma koordinasyonu IEC 60909-0:2016 standardına göre yapılacaktır ($c_{max}$ = 1.1, $c_{min}$ = 0.95).

!!! tip "Mühendislik Prensibi: Tasarım Kararları Zincir Halinde Bağlantılıdır"
    Her tasarım kararı bir sonraki kararı tetikler:

    **Türbin seçimi** (15 MW, 236 m rotor) →
    **Türbin sayısı** (34 = 510 MW) →
    **İletim tipi** (HVAC, 45 km < 80 km) →
    **Kablo kapasitansı** (85.5 MVAR) →
    **STATCOM boyutu** (±120 MVAR) →
    **FRT uyumu** (ANDES dinamik simülasyonu)

    Bu zincirleme ilişki, mühendislikte "tasarım tabanı" (design basis) olarak adlandırılır. Zincirin herhangi bir halkasını değiştirdiğinizde, sonraki tüm halkaları yeniden değerlendirmeniz gerekir. Gerçek projelerde tasarım tabanı değişikliği (design basis change) resmi bir süreçtir ve onay gerektirir.

---

## Bölüm 8: Karar Özeti Tablosu

Tüm ön tasarım kararlarımızı tek bir referans tablosunda toparlayalım:

| Karar | Değer | Gerekçe | Standart/Referans |
|-------|-------|---------|-------------------|
| **Konum** | Baltık Denizi, Ustka kuzeyi ~40 km | Gerçek proje yakınlığı, ERA5 veri, sığ su | PEP2040, ERA5 |
| **Su derinliği** | 25–40 m | Monopile temel teknolojisi uygun | Jeoteknik |
| **Rüzgar kaynağı** | 9.0–9.5 m/s (150 m) | ERA5 20 yıllık ortalama | ECMWF ERA5 |
| **Türbin modeli** | V236-15.0 MW | Gerçek Baltık projesinde kullanılıyor, ticari olgun | IEC 61400-1 I-B |
| **Rotor çapı** | 236 m | Türbin spesifikasyonu | Üretici veri sayfası |
| **Türbin sayısı** | 34 | 510 MW / 15 MW — eğitim ölçeği | Tasarım kararı |
| **Hub yüksekliği** | 150 m | Türbin spesifikasyonu | Üretici veri sayfası |
| **Cut-in / Nominal / Cut-out** | 3 / 12.5 / 31 m/s | IEC 61400 Sınıf I-B | IEC 61400-1 |
| **Downwind aralık** | 8D = 1,888 m | İz toparlanma optimizasyonu | PyWake, DTU |
| **Crosswind aralık** | 5D = 1,180 m | Yan iz etkisi dengeleme | Endüstri pratiği |
| **Tahmini alan** | ~70–100 km² | Spacing + tampon bölge | Hesaplama |
| **Güç yoğunluğu** | ~6–7 MW/km² | Endüstri standardı aralığında | Karşılaştırma |
| **Dizi gerilimi** | 66 kV | 15 MW sınıfı için endüstri standardı | Endüstri pratiği |
| **İhraç gerilimi** | 220 kV HVAC | 45 km < 80 km başa baş noktası | CIGRE, IEC 60287 |
| **İhraç kablosu** | 45 km deniz altı + 5 km kara | Sahadan kıyıya mesafe | Coğrafi kısıt |
| **Kablo reaktif gücü** | ~85.5 MVAR | Q = ωCV²L hesaplaması | IEC 60287-1-1 |
| **STATCOM** | ±120 MVAR | Kablo komp. + N-1 yedeklilik | Boyutlandırma hesabı |
| **Şönt reaktör** | 50 MVAR | Sürekli taban yük kompanzasyonu | N-1 tasarımı |
| **Şebeke bağlantısı** | 400 kV PSE | Polonya iletim şebekesi | PSE IRiESP |
| **Şebeke kodu** | NC RfG Tip D + PSE IRiESP | ≥75 MW → en katı gereksinimler | EU 2016/631 |
| **Kısa devre kapasitesi** | 10 GVA | Dış şebeke modeli | IEC 60909 |
| **Tasarım ömrü** | 25–30 yıl | Endüstri standardı | Endüstri pratiği |

---

## Quiz — Bilgi Kontrolü

!!! question "Soru 1 (Hatırlama)"
    Baltık Denizi'ndeki referans alanımızda 150 m yükseklikte ortalama rüzgar hızı kaçtır?

    ??? success "Cevap"
        **9.0–9.5 m/s.** Bu değer ERA5 100 m verisinden güç yasası profili ile 150 m hub yüksekliğine ekstrapolasyon yapılarak elde edilir.

!!! question "Soru 2 (Hatırlama)"
    V236-15.0 MW türbininin süpürülen alanı kaç m²'dir?

    ??? success "Cevap"
        **43,742 m².** Hesaplama: $A = \pi \times (236/2)^2 = \pi \times 118^2 = 43,742 \text{ m}^2$. Bu, yaklaşık 6 futbol sahası büyüklüğündedir.

!!! question "Soru 3 (Anlama)"
    İz bölgesinde rüzgar hızı %15 düşerse, güç üretimi yaklaşık yüzde kaç azalır?

    ??? success "Cevap"
        **Yaklaşık %39.** Güç rüzgar hızının küpüyle orantılıdır: $P \propto v^3$, dolayısıyla $0.85^3 = 0.614$, yani %38.6 azalma. Bu, küçük hız kayıplarının bile neden ciddi enerji kaybına yol açtığını gösterir.

!!! question "Soru 4 (Anlama)"
    HVAC yerine HVDC kullanmamız gereken minimum kablo uzunluğu yaklaşık kaç km'dir?

    ??? success "Cevap"
        **~80 km** (tipik başa baş noktası). Bizim projemizde kablo uzunluğu 45 km olduğundan, HVAC ekonomik olarak üstündür. Bu değer yıllara ve teknoloji maliyetlerine göre 60–120 km arasında değişir.

!!! question "Soru 5 (Anlama)"
    STATCOM boyutunu neden ±120 MVAR olarak belirledik? 85.5 MVAR kablo kompanzasyonu yetmez miydi?

    ??? success "Cevap"
        **N-1 yedeklilik prensibi nedeniyle.** 85.5 MVAR yalnızca nominal koşullar içindir. Bir STATCOM modülünün arızalanması durumunda bile yeterli kompanzasyon kapasitesine sahip olmak için ~%40 marj eklenmiştir. Ayrıca STATCOM'un hem absorbe (+) hem de enjekte (−) etme kapasitesi olması gerekir — tam yükte türbinlerin indüktif reaktif güç talebi de STATCOM tarafından karşılanır.

!!! question "Soru 6 (Zorlayıcı)"
    34 türbinlik bir çiftlikte iz kayıpları %12.7 ise ve staggered layout optimizasyonu ile %8.7'ye düşürülürse, 9.5 m/s ortalama rüzgar hızında ve %48 kapasite faktöründe yıllık enerji kazancı yaklaşık kaç GWh olur?

    ??? success "Cevap"
        Brüt AEP (iz öncesi):
        $AEP_{brüt} = 510 \text{ MW} \times 8,760 \text{ h} \times 0.48 = 2,145 \text{ GWh}$

        İz kaybı farkı: %12.7 − %8.7 = %4.0

        Yıllık enerji kazancı: $2,145 \times 0.04 = \sim85.8 \text{ GWh}$

        €72/MWh CfD fiyatıyla: $85,800 \times 72 = \sim6.2 \text{ M€/yıl}$ gelir artışı. 25 yıllık ömürde bu, ~155 M€ ek gelir demektir — bu yüzden yerleşim optimizasyonu kritik bir mühendislik faaliyetidir.

!!! question "Soru 7 (Zorlayıcı)"
    Ferranti etkisi nedir ve neden özellikle uzun deniz altı kabloları için tehlikelidir?

    ??? success "Cevap"
        Ferranti etkisi, bir iletim hattının veya kablonun yüksüz veya hafif yükte çalışırken alıcı ucundaki gerilimin gönderici ucundan daha yüksek olması durumudur. Nedeni, kablonun yüksek kapasitansından kaynaklanan kapasitif şarj akımının, kablo empedansı üzerinde gerilim düşümü (aslında yükselişi) oluşturmasıdır.

        Deniz altı kabloları özellikle hassastır çünkü:
        1. Havai hatlardan 20–40 kat daha yüksek kapasitansa sahiptir (yalıtım kalınlığı ve toprak yakınlığı)
        2. Uzun mesafelerde (45+ km) kapasitif reaktif güç üretimi çok yüksek olur (85.5 MVAR)
        3. Rüzgar çiftlikleri gece veya düşük rüzgarda minimal yük taşır — tam da Ferranti etkisinin en şiddetli olduğu koşullar

        Çözüm: STATCOM + şönt reaktör ile reaktif güç kompanzasyonu. Projemizde bu, P2'nin temel konularından biri olacaktır.

---

## Mülakat Köşesi

### Basit Açıklama (Mühendis Olmayanlara)

Bir rüzgar çiftliği projesine başlamadan önce birçok kritik karar almanız gerekir — tıpkı bir ev inşa etmeden önce arsa seçimi, mimari plan ve altyapı bağlantısı gibi. Nereye inşa edeceğinizi belirlerken rüzgar koşullarını, deniz derinliğini ve dalgaları inceliyorsunuz. Hangi boyutta rüzgar türbini kullanacağınıza karar verirken mevcut teknolojinin en uygun ve kanıtlanmış seçeneğini tercih ediyorsunuz. Kaç tane türbin yerleştireceğinizi hesaplarken hem yeterli enerji üretimini hem de türbinler arasında yeterli mesafeyi dengeliyorsunuz. Ve ürettiğiniz elektriği şehirlere nasıl taşıyacağınıza karar verirken mesafeye göre alternatif akım mı yoksa doğru akım mı kullanacağınızı, maliyet-fayda analiziyle belirliyorsunuz.

### Teknik Açıklama (Mülakat Paneli İçin)

Ön tasarım aşamasında sekiz temel mühendislik kararı alınmıştır. Konum olarak Polonya MEB'inde Ustka açıkları seçilmiştir — ERA5 reanaliz verisine göre 150 m hub yüksekliğinde 9.0–9.5 m/s ortalama rüzgar hızı, 25–40 m su derinliği (monopile uygun), ve Kuzey Denizi'ne kıyasla sakin dalga koşulları (Hs < 1.5 m yıllık ortalama). Türbin olarak IEC Sınıf I-B sertifikalı V236-15.0 MW seçilmiştir — 43,742 m² süpürülen alan, yarı-doğrudan sürüş tahrik, 2024-2026 döneminin tam ticari olgunluktaki (bankable) endüstri standardıdır. 34 × 15 MW = 510 MW kapasite, NC RfG Tip D gereksinimlerini tetiklerken eğitim ölçeğinde hesaplama verimliliği sağlar. Staggered layout'ta 8D downwind × 5D crosswind aralıkla (~1,888 m × 1,180 m) tahmini çiftlik alanı ~70–100 km² ve güç yoğunluğu ~6–7 MW/km²'dir. İletim sistemi 66 kV array → 220 kV HVAC export (45 km) → 400 kV PSE şebekesi zincirinden oluşur — 45 km mesafe HVAC/HVDC başa baş noktasının (~80 km) altındadır. 220 kV kablonun ~85.5 MVAR kapasitif reaktif güç üretimi, ±120 MVAR STATCOM + 50 MVAR şönt reaktör ile kompanse edilir — STATCOM, SVC'ye tercih edilmiştir çünkü düşük gerilimde tam Q kapasitesi korunur (FRT uyumu) ve kompakt yapısı offshore platform maliyetini azaltır. Kısa devre kapasitesi 10 GVA dış şebeke modeli, IEC 60909 bazlı koruma koordinasyonunun temelini oluşturur.

---

## Önerilen Okumalar

Bu dersin konularını derinleştirmek için Learning Roadmap'ten öneriler:

1. **DTU Wind Energy — Introduction to Wind Energy (Coursera)** — Rüzgar fiziği, Betz limiti, süpürülen alan ilişkisi
2. **Burton et al. — Wind Energy Handbook, Wiley** — Bölüm 1-3: Rüzgar kaynağı, türbin aerodinamiği, güç eğrisi
3. **CIGRE Technical Brochure 610 — Offshore Generation Cable Connections** — HVAC vs HVDC karar çerçevesi
4. **ENTSO-E NC RfG (EU 2016/631)** — Tam düzenleme metni, Tip D gereksinimleri
5. **ERA5 Documentation (ECMWF)** — Copernicus Climate Data Store kullanım kılavuzu

---

## Bağlantılar — Bu Kararlar Nereye Gidiyor?

| Bu Derste | İlgili Gelecek Ders/Proje |
|-----------|--------------------------|
| ERA5 rüzgar verisi → 9.0–9.5 m/s | **Ders 004 (P1):** Weibull fit ve güç eğrisi entegrasyonu |
| V236-15.0 MW güç eğrisi | **P1:** PyWake iz modelleme, AEP hesaplama |
| 34 türbin staggered layout | **P1:** Yerleşim optimizasyonu, iz kaybı azaltma |
| 85.5 MVAR kablo reaktif gücü | **P2:** STATCOM kontrol stratejisi, Pandapower simülasyonu |
| FRT gereksinimleri (%15, 140 ms) | **P2:** ANDES dinamik simülasyonu |
| 66 kV → 220 kV → 400 kV zinciri | **P2:** Tek hat diyagramı, yük akışı analizi |
| STATCOM ±120 MVAR | **P2:** Reaktif güç kontrol modları (V-droop, Q-setpoint) |
| IEC 60909, 10 GVA | **P2:** Kısa devre hesaplama, koruma koordinasyonu |
| NC RfG Tip D | **P3:** SCADA alarm tanımları, şebeke kodu uyum izleme |
| Türbin aralıkları | **P5:** Komisyonlama sırası, kablodan türbine enerji verme programı |
