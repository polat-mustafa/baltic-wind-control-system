# Açık işler — mühendislik denetimi sonrası (Ekim 2026)

> Geliştirici notu — yayımlanan dokümantasyonun (`docs/`, mkdocs) parçası değildir.

Bu liste, `docs/engineering-audit-2026-10.md` §8'deki "open" maddelerinin uygulanabilir
yapılacaklar listesidir. Yeni bir oturumda buradan devam et: önce bu dosyayı, sonra denetim
belgesinin §8 bölümünü oku.

Durum (13 Ekim 2026): 1.4, 2.2, 2.3 (IEC 60853), 2.4 ve 2.6 yapıldı — ayrıntılar maddelerde.
Önceki durum (12 Ekim 2026): Faz A, B ve C'nin bir oturumda yapılabilen kısmı bitti ve `main`'e
birleştirildi. Backend 1 496 test, frontend 699 test geçiyor; yeni çalışmaların hepsi arayüzde.

---

## 1. Senin yapman gerekenler (kod dışı; Claude yapamaz)

Bunlar "10/10" için şart; kendi kendine sertifikalanamaz.

### 1.1 Dış uzman incelemesi (en önemlisi)
- Her disiplinden bir bağımsız uzman: **rüzgâr kaynağı/AEP**, **güç sistemleri** (yük akışı,
  kısa devre, harmonik/kararlılık, EMT), **yapı** (kafes temel, yorulma), **SCADA/IEC 61850**.
- Onlara ver: `docs/engineering-audit-2026-10.md`, Evidence sayfası, `backend/scripts/audit/`.
- Her uzmandan yazılı görüş al; bulguları yeni bir "F10…" bulgu listesi olarak denetim
  belgesine ekle, kapat, sonra Evidence'a "external review" satırı ekle.
- Öneri: üniversitede (ör. Gdańsk Teknik Üniversitesi, DTU Wind, Strathclyde) bir öğretim
  üyesi veya bir TSO/OEM mühendisi.

### 1.2 Yayın ve atıf
- **Zenodo DOI:** GitHub ↔ Zenodo entegrasyonunu aç (zenodo.org → GitHub → repo'yu aç), bir
  sürüm etiketi (`v0.2.0`) yayınla; DOI'yi `CITATION.cff` içine `doi:` alanı olarak ekle.
- **Sürüm başına doğrulama raporu (PDF):** otomatik — `Release validation report` iş akışı
  her yayımlanan GitHub sürümüne PDF'i ekler (`backend/scripts/validation_report.py`; yerelde
  de çalışır). Senden: sürümden önce `scripts/build_evidence.py` güncel olsun.
- **JOSS yazılım makalesi** (joss.theoj.org): taslak hazır — `paper/paper.md` + `paper/paper.bib`;
  PDF'i `JOSS paper draft` iş akışı üretir (Actions → artifact "paper"). Senden: ORCID ve
  kurum bilgisini ön bilgiye yaz, metni oku, joss.theoj.org/papers/new'den gönder.
- **Yöntem makalesi** (ör. *Wind Energy Science*): yaşam döngüsüne bağlı doğrulama yaklaşımı.
- `CITATION.cff` içine ORCID numaranı ekle (`orcid:` alanı).

### 1.3 Veri
- **FINO2 ölçüm direği verisi** (BSH, ücretsiz kayıtla): rüzgâr profili/TI doğrulaması için.
  İndirme Claude'un ağından mümkün olmadı; sen indirip `backend/app/services/p1/validation_data/`
  altına koy, `scripts/data_manifest.py` çalıştır.
- **Baltica 2** ENTSO-E'de üretim verisi yayımlandığında (planlı) ikinci AEP doğrulama sahası.
- ~~PSE kısıtlama verisi~~ — PSE açık API'sinden alındı (bkz. 2.1).
- **Gerçek dönüştürücü modeli:** bir OEM'den (Vestas/SGRE/GE) ya da bir TSO çalışmasından
  dönüştürücü empedans/admitans verisi; şu an `harmonic_stability.py` tipik değerler kullanıyor.

### 1.4 Laptop/CI kontrolü — YAPILDI (13 Ekim 2026)
- `npm run e2e` Docker yığını açıkken çalıştırıldı: çalışma zamanı hatası yok; Commissioning ve
  Evidence görsel temelleri yenilendi. e2e gerçek bir hata yakaladı: EMT uç noktası kutup başına
  liste döndürüyordu, sayfa sonuç gelince çöküyordu — düzeltildi (test eklendi).
- `npm run i18n:missing -- tr`: yalnız "Running…" kalmıştı, eklendi.
- LSTM/TFT testleri laptopta geçti (41 test).
- `.test_durations` tam koşudan tazelendi; `data_manifest.py` Windows'ta büyük/küçük harf
  sıralaması yüzünden kırılıyordu — POSIX dizesine göre sıralanacak şekilde düzeltildi.
- Smart App Control kapatıldı (13 Ekim): pyarrow/h5py DLL'leri artık yerelde de yükleniyor.

---

## 2. Claude ile sonraki oturumlarda yapılabilecek teknik işler

Öncelik sırasıyla. Her madde kendi doğrulama testiyle gelmeli (denetim belgesi §6 kuralı).

### 2.1 AEP — kısıtlama kaybı — YAPILDI (13 Ekim)
- PSE açık API'sinde veri varmış: `poze-redoze` (rüzgâr yeniden dağıtımı, denge/şebeke),
  `his-wlk-cal`, `rce-pln`. `scripts/fetch_pse_curtailment.py` → aylık toplamlar (Eki 2024 –
  Eyl 2026). Son 12 ay: %6.4 = yeniden dağıtım %3.1 + negatif RCE saatleri %3.4 (340 sa).
  Kalan: SB-510 düğümüne özgü şebeke kısıtı (ulusal rüzgâr vekil olarak kullanılıyor);
  veriyi yıllık tazelemek için betiği yeniden çalıştır.

### 2.2 EMT — YAPILDI (13 Ekim, `services/p5/emt_studies.py`)
- Trafo ani akımı (iki eğimli doyma; Specht kapalı formu ile 1.0001), arıza sonrası TOV
  (akım sıfırında açma, 1.99 pu), IEC 60071-2 yalıtım koordinasyonu (30 kapama, faz-tepe).
- Kalan: parafudr modeli (K_cd < 1 durumu), yayımlanmış bir kablo enerjilendirme benchmark'ı
  (CIGRE TB 556 örnek verisi ücretli), gerçek trafo doyma eğrisi (üretici verisi).

### 2.3 Kablo — IEC 60853-2 YAPILDI (13 Ekim); TB 908 veri bekliyor
- Çevrimsel faktör M (iki ilmekli ağ + toprak β(t)); tam süperpozisyonla %3 içinde.
- TB 908 zırh kaybı: zırh çeliğinin ölçülmüş karmaşık geçirgenliği (μ′, μ″, çelik sınıfına
  göre) gerekiyor — üretici verisi (bkz. 1.3). TB 880'in diğer durumları: broşür ücretli.

### 2.4 Yapı — YAPILDI (13 Ekim)
- Kazık + API p-y / t-z yayları, sıkı/gevşek kum, 1.3 D oyulma; Matlock–Reese ile 1.014.
  Bulgu: kazıkların eksenel rijitliği f1'i %6 artırıyor, 3P payı ≈ %5'e düşüyor → saha
  geotekniği şart (bkz. 1.3: CPT/zemin verisi).
- Hs50 Björkqvist ve ark. 2018 ile karşılaştırıldı: ERA5 7.96 m muhtemelen %10–25 düşük;
  f1 kararı değişmiyor. Kalan: ERA5 yerine yüksek çözünürlüklü dalga verisi (ör. CMEMS
  Baltık dalga yeniden analizi, saatlik) ile EVA.

### 2.5 Yükler (`services/turbine_physics/loads.py`)
- Aktarma organı serbestlik derecesi, DLC seti (IEC 61400-1: 1.2, 6.1 …).
- **OpenFAST** ile karşılaştırma (conda ile kurulur; laptopta veya CI'da): aynı rüzgârla
  kule tabanı DEL ve sönüm. Evidence satırı.

### 2.6 O&M — WOMBAT YAPILDI (13 Ekim, `scripts/audit/c2_wombat_om.py`)
- WOMBAT 0.13.4: enerji bazlı 92.1 % vs uygulama 89.8 % (+2.2 puan; WOMBAT'ta müdahale
  gecikmesi yok). Evidence `lc-om-wombat`. Maliyet karşılaştırması henüz yok.

### 2.7 Harmonik/kararlılık
- Gerçek dönüştürücü verisi gelince (1.3) `ConverterModel` varsayılanlarını güncelle;
  PLL ve 50 Hz rezonans kontrolcüsünü (düşük frekans etkileşimi) ekle.

### 2.8 Model kartları (denetim C-4) — YAPILDI (13 Ekim, `docs/model-cards.md`)
- Her modül için tek sayfa: varsayımlar, geçerlilik aralığı, doğrulama, bilinen sınırlar
  (ASME V&V 10/20 terimleri; dijital ikiz için DNV-RP-A204). `docs/references.md` yöntem →
  kaynak eşlemesini zaten veriyor; kartlar bunu "sınırlar" ile tamamlar.

---

## 3. Yeni oturuma başlarken

```bash
git checkout main && git pull
cat dev/ACIK_ISLER.md
sed -n '/## 8. Implementation status/,/## How to reproduce/p' docs/engineering-audit-2026-10.md
cd backend && python -m pytest -m validation -q      # doğrulama kontrolleri
```
