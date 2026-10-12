# Açık işler — mühendislik denetimi sonrası (Ekim 2026)

Bu liste, `docs/engineering-audit-2026-10.md` §8'deki "open" maddelerinin uygulanabilir
yapılacaklar listesidir. Yeni bir oturumda buradan devam et: önce bu dosyayı, sonra denetim
belgesinin §8 bölümünü oku.

Durum (12 Ekim 2026): Faz A, B ve C'nin bir oturumda yapılabilen kısmı bitti ve `main`'e
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
- **Sürüm başına doğrulama raporu (PDF):** her sürümde `scripts/build_evidence.py` çalıştır,
  Evidence sayfasını + denetim belgesini PDF'e çevir, sürüme ekle.
- **JOSS yazılım makalesi** (joss.theoj.org): `paper.md` + `paper.bib`; incelemeyi JOSS
  hakemleri yapar — bu aynı zamanda dış incelemenin bir parçası sayılır.
- **Yöntem makalesi** (ör. *Wind Energy Science*): yaşam döngüsüne bağlı doğrulama yaklaşımı.
- `CITATION.cff` içine ORCID numaranı ekle (`orcid:` alanı).

### 1.3 Veri
- **FINO2 ölçüm direği verisi** (BSH, ücretsiz kayıtla): rüzgâr profili/TI doğrulaması için.
  İndirme Claude'un ağından mümkün olmadı; sen indirip `backend/app/services/p1/validation_data/`
  altına koy, `scripts/data_manifest.py` çalıştır.
- **Baltica 2** ENTSO-E'de üretim verisi yayımlandığında (planlı) ikinci AEP doğrulama sahası.
- **PSE kısıtlama (curtailment) verisi:** saatlik gün öncesi fiyat + PSE redispatch serileri.
  Bunlar gelince AEP zincirindeki "Not assessed (0 %)" adımı hesaplanabilir (bkz. 2.1).
- **Gerçek dönüştürücü modeli:** bir OEM'den (Vestas/SGRE/GE) ya da bir TSO çalışmasından
  dönüştürücü empedans/admitans verisi; şu an `harmonic_stability.py` tipik değerler kullanıyor.

### 1.4 Laptop/CI kontrolü
- Windows'ta `cd frontend && npm run e2e` (Playwright, sistem Chrome) — burada çalıştırılamadı.
  Yeni paneller görsel temel çizgileri değiştirdiyse `npm run e2e:update` ile kabul et.
- `npm run i18n:missing -- tr` (Chrome gerekiyor) — yeni panellerde İngilizce kalan metin var mı.
- LSTM/TFT testleri (PyTorch) — burada kurulamadı; laptopta `python -m pytest tests/test_lstm_model.py tests/test_tft_model.py -q`.
- Tam backend testinden sonra `.test_durations` tazelemesi (komut `ci.yml` içinde) — yeni
  testlerin süreleri ölçeklenerek eklendi, tam tazeleme laptopta daha doğru olur.

---

## 2. Claude ile sonraki oturumlarda yapılabilecek teknik işler

Öncelik sırasıyla. Her madde kendi doğrulama testiyle gelmeli (denetim belgesi §6 kuralı).

### 2.1 AEP — kısıtlama (curtailment) kaybı
- Veri (1.3) gelince: negatif fiyat saatleri + PSE redispatch → yıllık kayıp yüzdesi;
  `aep_calculator.py` `curtailment` adımını "computed" yap. Test: el hesabı.

### 2.2 EMT — eksik çalışmalar (`services/p5/emt_energisation.py`)
- Trafo ani akımı (inrush, doyma eğrisiyle).
- Arıza temizlendikten sonra geçici aşırı gerilim (TOV).
- İzolasyon koordinasyonu (IEC 60071: anahtarlama aşırı gerilimi vs. SIWL, parafudr).
- Doğrulama: yayımlanmış bir kablo enerjilendirme benchmark'ı (ör. CIGRE TB 556 örnekleri).

### 2.3 Kablo — IEC 60853 çevrimsel akım değeri ve CIGRE TB 908 zırh kayıpları
- `services/p2/cable_rating.py`: çevrimsel derating faktörü M; üç damarlı kablo zırh kaybı
  TB 908 yöntemiyle. Doğrulama: TB 880'in diğer durumları (±%1).

### 2.4 Yapı — zemin ve oyulma (`services/turbine_physics/support_structure.py`)
- p-y zemin yayları (API/DNV-RP-C212), oyulma (scour) senaryosu → f1 duyarlılığı.
- Hs50'yi yayımlanmış bir Baltık ekstrem dalga çalışmasıyla karşılaştır (Evidence satırı).

### 2.5 Yükler (`services/turbine_physics/loads.py`)
- Aktarma organı serbestlik derecesi, DLC seti (IEC 61400-1: 1.2, 6.1 …).
- **OpenFAST** ile karşılaştırma (conda ile kurulur; laptopta veya CI'da): aynı rüzgârla
  kule tabanı DEL ve sönüm. Evidence satırı.

### 2.6 O&M — WOMBAT ile çapraz kontrol (`services/lifecycle/om_simulation.py`)
- `pip install wombat` (NREL) → aynı arıza oranları ve gemi parametreleriyle SB-510 senaryosu;
  kullanılabilirlik ve maliyet farkı < birkaç puan. Evidence satırı.

### 2.7 Harmonik/kararlılık
- Gerçek dönüştürücü verisi gelince (1.3) `ConverterModel` varsayılanlarını güncelle;
  PLL ve 50 Hz rezonans kontrolcüsünü (düşük frekans etkileşimi) ekle.

### 2.8 Model kartları (denetim C-4)
- Her modül için tek sayfa: varsayımlar, geçerlilik aralığı, doğrulama, bilinen sınırlar
  (ASME V&V 10/20 terimleri; dijital ikiz için DNV-RP-A204). `docs/references.md` yöntem →
  kaynak eşlemesini zaten veriyor; kartlar bunu "sınırlar" ile tamamlar.

---

## 3. Yeni oturuma başlarken

```bash
git checkout main && git pull
cat docs/ACIK_ISLER.md
sed -n '/## 8. Implementation status/,/## How to reproduce/p' docs/engineering-audit-2026-10.md
cd backend && python -m pytest -m validation -q      # doğrulama kontrolleri
```
