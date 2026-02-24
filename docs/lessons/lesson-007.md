# Ders 007 — HV Şebeke Entegrasyonu: Pandapower Kararlı Durum Modeli

!!! abstract "Ders Navigasyonu"
    :material-arrow-left: **Önceki:** [Ders 006 — Yerleşim Optimizasyonu, Blokaj & AEP Kaskadı](lesson-006.md) | **Sonraki:** Yakında :material-arrow-right:

    **Faz:** P2 | **Dil:** Türkçe | **İlerleme:** 1 / ? | [Tüm Dersler](index.md) | [Öğrenme Yol Haritası](../Learning_Roadmap.md)

> **Date:** 2026-02-24
> **Phase:** P2 (HV Grid Integration)
> **Roadmap sections:** [Phase 2 — Section 2.1 Electrical Network Model, Section 2.2 Load Flow, Section 2.3 Short-Circuit, Section 2.4 Reactive Compensation]
> **Language:** Turkish
> **Previous lesson:** Lesson 006

---

## Ne Öğreneceksiniz

- Denizaltı XLPE kabloların pi-modeli fiziğini ve IEC 60287 parametrelerini
- Newton-Raphson yük akışı (load flow) çözücünün matematiksel temelini
- IEC 60909 kısa devre hesaplama metodolojisini (Ik'', ip, Sk'')
- Ferranti etkisini ve STATCOM reaktif güç kompanzasyonunun neden gerekli olduğunu
- PSE IRiESP gerilim limitleri (0.95–1.05 pu) ile uyumluluk doğrulamasını

---

## Bölüm 1: Kablo Pi-Modeli — Fizikten Koda

### Gerçek Hayat Problemi

Bir bahçe hortumunu düşünün. Hortum ne kadar uzunsa, uçtaki su basıncı o kadar düşer (direnç kayıpları). Ama elektrik kablolarında bir fark daha var: kablonun yalıtım malzemesi (XLPE) küçük bir kapasitör gibi davranır. 45 km uzunluğundaki 220 kV denizaltı kablomuz, yüksüz durumda ~130 MVAR reaktif güç üretir — bu, bir küçük şehrin tükettiği reaktif güce eşdeğerdir.

### Standartlar Ne Diyor

**IEC 60287** kablo akım taşıma kapasitesini ve elektriksel parametreleri (R, X, C) hesaplar. **IEC 60228** iletken kesitlerini (500, 630, 800, 1000 mm²) standartlaştırır. Offshore rüzgar çiftliklerinde kablo derecelendirmesi (cable grading) kullanılır: OSS'ye uzak türbinler küçük kesitli kablo (daha az akım), OSS'ye yakın türbinler büyük kesitli kablo (daha fazla kümülatif akım).

### Matematik

Pi-modeli, dağıtık parametreli iletim hattını üç yığın (lumped) elemanla yaklaşıklar:

```
       R + jX
  ──┤├────┤├────┤├──
  │                │
  ═ jB/2      jB/2 ═
  │                │
  ─────────────────
```

Her kablo segmenti için:
- **R** [Ω/km]: İletken direnci (kesit alanıyla ters orantılı)
- **X** [Ω/km]: Endüktif reaktans (manyetik alan)
- **C** [nF/km]: Faz başına kapasitans (XLPE dielektrik)

Reaktif güç üretimi (Kural 7 — her zaman pozitif):

$$Q_{kablo} = \omega \times C \times V^2 \times L$$

220 kV ihraç kablomuz için:
$$Q = 2\pi \times 50 \times 190 \times 10^{-9} \times (220000)^2 \times 45 \approx 130 \text{ MVAR}$$

### Ne İnşa Ettik

**Dosya:** `backend/app/services/p2/network_model.py`

Kablo parametreleri `CableSpec` dataclass'ı ile tanımlanır:

```python
@dataclass(frozen=True)
class CableSpec:
    cross_section_mm2: float
    r_ohm_per_km: float
    x_ohm_per_km: float
    c_nf_per_km: float
    max_i_ka: float

# 66 kV dizi kabloları — OSS'ye uzaklığa göre derecelendirilmiş
ARRAY_CABLE_500 = CableSpec(500, 0.0366, 0.110, 200, 0.715)  # Uzak
ARRAY_CABLE_630 = CableSpec(630, 0.0283, 0.105, 215, 0.818)  # Orta
ARRAY_CABLE_800 = CableSpec(800, 0.0221, 0.100, 230, 0.900)  # Yakın
```

Kablo derecelendirme fonksiyonu, string içindeki pozisyona göre kesit seçer:

```python
def _get_cable_grade(position_in_string: int, string_length: int) -> CableSpec:
    normalised = position_in_string / max(string_length - 1, 1)
    if normalised < 0.4:
        return ARRAY_CABLE_500   # uzak — en az akım
    elif normalised < 0.7:
        return ARRAY_CABLE_630   # orta
    else:
        return ARRAY_CABLE_800   # OSS'ye yakın — en fazla kümülatif akım
```

### Neden Önemli

> **Neden** tüm dizi kablolarını aynı kesitte yapmıyoruz?
> Aynı kesit kullanmak basit olurdu ama verimsiz. OSS'den uzak türbinler sadece 1 türbin akımı taşır (131 A), ama OSS'ye en yakın kablo 5 türbin akımı taşır (655 A). Her yere 800 mm² koymak gereksiz maliyet — 500 mm² zaten 715 A taşıyabilir. Kablo derecelendirmesi, bir projenin kablo maliyetini %15-25 düşürebilir.

---

## Bölüm 2: Şebeke Topolojisi — 38 Bara, 35 Kablo, 2 Trafo

### Gerçek Hayat Problemi

Bir şehrin elektrik şebekesini düşünün: santralden fabrikaya giden yolda birçok trafo ve kablo var. Her biri gerilim seviyesini değiştirir ve kayıp yaratır. Offshore rüzgar çiftliğimiz de aynı: 66 kV'dan 400 kV'a üç gerilim seviyesi, her birinde farklı ekipman.

### Ne İnşa Ettik

`build_network()` fonksiyonu 38 baralı Pandapower şebekesini oluşturur:

| Eleman | Sayı | Açıklama |
|--------|------|----------|
| **Baralar** | 38 | 1× PSE 400kV + 1× Onshore 220kV + 1× OSS 220kV + 1× OSS 66kV + 34× WTG 66kV |
| **Kablolar** | 35 | 34× dizi (66 kV, derecelendirilmiş) + 1× ihraç (220 kV, 45 km) |
| **Trafolar** | 2 | 66/220 kV Dyn11 (OSS) + 220/400 kV YNyn0 (onshore) |
| **Jeneratörler** | 35 | 34× WTG (15 MW) + 1× STATCOM (Q kontrol) |
| **Şönt reaktör** | 1 | 50 MVAR (OSS 220 kV) |
| **Harici şebeke** | 1 | PSE 400 kV, Ssc = 10 GVA |

**String düzeni:** 6 string × 5 WTG + 1 string × 4 WTG = 34 WTG

---

## Bölüm 3: Yük Akışı — Newton-Raphson ile Gerilim Doğrulama

### Fizik

Newton-Raphson yük akışı, güç dengesi denklemlerini çözer:

$$P_i = V_i \sum_j V_j (G_{ij} \cos\theta_{ij} + B_{ij} \sin\theta_{ij})$$
$$Q_i = V_i \sum_j V_j (G_{ij} \sin\theta_{ij} - B_{ij} \cos\theta_{ij})$$

Jacobian matrisi her iterasyonda güncellenir:

$$\begin{bmatrix} \Delta P \\ \Delta Q \end{bmatrix} = \begin{bmatrix} \frac{\partial P}{\partial \theta} & \frac{\partial P}{\partial V} \\ \frac{\partial Q}{\partial \theta} & \frac{\partial Q}{\partial V} \end{bmatrix} \begin{bmatrix} \Delta \theta \\ \Delta V \end{bmatrix}$$

Yakınsama kriteri: $\|\Delta P, \Delta Q\| < 10^{-8}$ MVA

### Senaryolar

**PSE IRiESP** dört işletme senaryosunda gerilim uyumluluğu gerektirir:

| Senaryo | Üretim | Amaç |
|---------|--------|------|
| **Tam yük** | 510 MW (34 × 15 MW) | Kablo termal limitleri |
| **Kısmi yük** | 255 MW (%50) | Normal çalışma gerilimleri |
| **Boş yük** | 0 MW | Ferranti gerilim yükselişi |
| **N-1** | 450 MW (String 7 devre dışı) | Yedeklilik marjları |

### Sonuçlar

Tüm dört senaryo yakınsar ve 0.95–1.05 pu gerilim limitlerini karşılar (STATCOM auto-dispatch ile):

- **Tam yük:** Kayıplar ~1-3% (5-15 MW), gerilim uyumlu
- **Kısmi yük:** Daha düşük kayıplar, gerilim uyumlu
- **Boş yük:** Minimum kayıp (sadece trafo demir kayıpları), Ferranti etkisi kompanze edilmiş
- **N-1:** 450 MW, yedeklilik doğrulanmış

### Kod İncelemesi

STATCOM auto-dispatch, OSS 220 kV barasında gerilimi 1.0 pu'ya çeker:

```python
def auto_statcom_dispatch(net, target_vm_pu=1.0, tolerance_pu=0.01):
    for _ in range(max_iterations):
        pp.runpp(net, algorithm="nr")
        v_oss = net.res_bus.at[oss_bus_idx, "vm_pu"]
        deviation = target_vm_pu - v_oss
        if abs(deviation) <= tolerance_pu:
            break
        # Oransal ayarlama: ~5000 MVAR/pu kazanç
        current_q += deviation * 5000.0
        # STATCOM ratingi ile sınırla (±120 MVAR)
        current_q = max(-120, min(120, current_q))
```

---

## Bölüm 4: Kısa Devre — IEC 60909

### Fizik

IEC 60909, bara k'daki ilk simetrik kısa devre akımını hesaplar:

$$I_k'' = \frac{c \times V_n}{\sqrt{3} \times Z_k}$$

- **c** = gerilim faktörü (maks: 1.1, min: 1.0 — IEC 60909 Tablo 1)
- **V_n** = nominal gerilim [V]
- **Z_k** = arıza noktasından görülen eşdeğer kısa devre empedansı [Ω]

Tepe akım (DC bileşeni):
$$i_p = \kappa \times \sqrt{2} \times I_k''$$

Kısa devre gücü:
$$S_k'' = \sqrt{3} \times V_n \times I_k'' \quad [\text{MVA}]$$

### Standartlar Ne Diyor

**IEC 62271-100** kesici kapasitelerini tanımlar:

| Gerilim Seviyesi | Kesici Kapasitesi |
|------------------|-------------------|
| 66 kV | 25 kA |
| 220 kV | 40 kA |
| 400 kV | 50 kA |

### Ne İnşa Ettik

**Mühendislik Kuralı 3:** IEC 60909 hesaplamaları Pandapower'ın yerleşik `calc_sc()` fonksiyonuyla yapılır — özel implementasyon YASAK.

```python
sc.calc_sc(net, fault="3ph", case="max", ip=True)
```

Sonuçlar: Tüm bara akımları kesici kapasitelerinin altında → kesiciler yeterli.

---

## Bölüm 5: STATCOM Boyutlandırma — Ferranti Etkisi ve Kompanzasyon

### Fizik — Ferranti Etkisi

Yüksüz veya hafif yüklü bir kablonun alıcı ucundaki gerilim, gönderici ucundan yüksektir:

$$V_{alıcı} \approx \frac{V_{gönderici}}{\cos(\beta L)}$$

45 km, 220 kV kablomuzda Ferranti yükselişi ~2-5% civarındadır. Bu, kompanzasyon olmadan gerilim limitlerini aşabilir.

### Kompanzasyon Stratejisi

1. **Şönt reaktör (50 MVAR):** Sabit endüktif yük, kablo Q'sunun bir kısmını absorbe eder
2. **STATCOM (±120 MVAR):** Dinamik kompanzasyon, gerilime göre Q üretir/absorbe eder

**Neden STATCOM, SVC değil?**
- Düşük gerilimde tam Q kapasitesi (FRT sırasında kritik)
- Daha hızlı yanıt (< 1 çevrim vs 2-3 çevrim)
- Offshore platformda daha küçük alan
- Harmonik filtresi gerekmez (PWM anahtarlama)

### Doğrulama Sonuçları

| Metrik | Değer |
|--------|-------|
| Kablo Q (220 kV, 45 km) | ~130 MVAR |
| Şönt reaktör | 50 MVAR |
| STATCOM rating | ±120 MVAR |
| Ferranti yükselişi (kompanzasyonsuz) | > 1.0 pu |
| Kompanzasyonlu V_max | ≤ 1.05 pu ✓ |

---

## Test Özeti

| Test Dosyası | Test Sayısı | Sonuç |
|-------------|-------------|-------|
| `test_network_model.py` | 21 | ✓ Hepsi geçti |
| `test_load_flow.py` | 20 | ✓ Hepsi geçti |
| `test_short_circuit.py` | 13 | ✓ Hepsi geçti |
| `test_statcom.py` | 14 | ✓ Hepsi geçti |
| **Toplam** | **68** | **✓ 68/68** |

---

## Mülakat Soruları

### Soru 1: Ferranti Etkisi
**"45 km'lik 220 kV denizaltı ihraç kablonuz boş yükte çalışıyor. OSS barasında gerilim neden nominal değerin üzerine çıkar ve bunu nasıl engellersiniz?"**

*İpucu: Kablo kapasitansı, reaktif güç üretimi, şönt reaktör + STATCOM kompanzasyonu*

### Soru 2: Kablo Derecelendirme
**"66 kV dizi kablolarında neden farklı kesitler (500/630/800 mm²) kullanıyorsunuz? Hepsini 800 mm² yapmanın dezavantajı nedir?"**

*İpucu: Akım kümülasyonu, maliyet optimizasyonu, termal sınırlar*

### Soru 3: IEC 60909
**"IEC 60909'daki c_max = 1.1 gerilim faktörü ne anlama gelir ve neden kesici boyutlandırmada max case kullanılır?"**

*İpucu: İşletme gerilim toleransı, en kötü durum arıza akımı, güvenlik marjı*

---

## Basit Açıklama

Bugün rüzgar çiftliğimizin elektrik şebekesini bilgisayarda inşa ettik — 34 türbinden denizaltı kablosuyla karaya, oradan da ulusal şebekeye bağlanan tüm sistemi. Dört farklı durumda (tam güç, yarım güç, boş, bir hat arızalı) elektriğin doğru gerilimde aktığını doğruladık. Kısa devre durumunda ne olacağını hesapladık ve koruma ekipmanlarının yeterli olduğunu gösterdik. Son olarak, uzun denizaltı kablonun yarattığı gerilim yükselişini (Ferranti etkisi) STATCOM ve reaktörle kontrol altına aldık.

## Teknik Açıklama

P2A oturumunda Pandapower ile 66/220/400 kV tam ölçekli şebeke modeli oluşturuldu. 38 baralı, 35 kablolu (pi-model, IEC 60287 parametreleri), 2 trafolulu (Dyn11 + YNyn0) ağda Newton-Raphson yük akışı 4 senaryoda (full, partial, no-load, N-1) yakınsadı ve PSE IRiESP gerilim limitleri (0.95–1.05 pu) STATCOM auto-dispatch ile karşılandı. IEC 60909 kısa devre analizi (3-faz, c_max=1.1, c_min=1.0) tüm baralarda kesici kapasitelerinin altında Ik'' değerleri verdi. STATCOM boyutlandırma, 45 km ihraç kablosunun ~130 MVAR kapasitif Q üretimini, 50 MVAR şönt reaktör + ±120 MVAR STATCOM ile kompanze ederek Ferranti gerilim yükselişini elimine etti. 68 birim testi %100 geçti.
