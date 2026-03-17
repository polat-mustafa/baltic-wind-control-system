# Dersler — Baltic Wind HV Kontrol Platformu

510 MW Baltık Denizi rüzgar çiftliği simülasyonundaki her mühendislik kararını belgeleyen adım adım öğrenme günlüğü. Her ders **4 katmanlı öğretim modeli**ni (fizik → standart → matematik → kod) takip eder ve [Öğrenme Yol Haritası](../../Learning_Roadmap.md)'nın bir bölümüyle eşleşir.

---

## Bir Bakışta Proje

| Parametre | Değer |
|-----------|-------|
| **Toplam kapasite** | 510 MW |
| **Türbinler** | 34 × Vestas V236-15.0 MW |
| **Toplama kabloları** | 66 kV XLPE |
| **Açık deniz alt istasyonu** | 66/220 kV |
| **İhracat kablosu** | 220 kV HVAC, 45 km denizaltı |
| **Şebeke bağlantısı** | 400 kV PSE (Polonya TSO) |
| **STATCOM** | ±120 MVAR + 50 MVAR şönt reaktör |
| **Konum** | Polonya Baltık Denizi |
| **Uyumluluk** | PSE IRiESP, ENTSO-E NC RfG Tip D |
| **Devreye alma / nominal / kapanma** | 3 / 12,5 / 31 m/s |

---

## Beş Proje

| # | Proje | Alan | Temel Teknoloji | Anahtar Standart |
|---|-------|------|-----------------|-----------------|
| **P1** | Rüzgar Kaynağı ve AEP | Enerji verimi | PyWake, ERA5, Weibull | IEC 61400-12 |
| **P2** | YG Şebeke Entegrasyonu | Güç sistemleri | Pandapower, ANDES | IEC 60909, ENTSO-E NC RfG |
| **P3** | SCADA ve Otomasyon | Kontrol sistemleri | IEC 61850 veri modelleri | IEC 61850, IEC 62443 |
| **P4** | AI Tahminleme | Makine öğrenmesi | XGBoost, LSTM, TFT | IEA Wind Task 36 |
| **P5** | Devreye Alma | Operasyonlar | Anahtarlama programları | IEC 62271, LOTO |

---

## Ders İlerleme Tablosu

| # | Ders | Faz | Dil | Durum |
|---|------|-----|-----|-------|
| 000 | [Proje Planlaması ve Mühendislik Metodolojisi](lesson-000.md) | P0 | Türkçe | Tamamlandı |
| 001 | [DevOps Temeli](lesson-001.md) | P0 | Türkçe | Tamamlandı |
| 002 | [Çok Dilli Destek ve Uluslararasılaştırma Altyapısı](lesson-002.md) | P0 | Türkçe | Tamamlandı |
| 003 | [Ön Tasarım Kararları: Konum, Türbin, Alan & Şebeke](lesson-003.md) | P1 | Türkçe | Tamamlandı |
| 004 | [Veritabanı, ERA5 & Weibull](lesson-004.md) | P1 | Türkçe | Tamamlandı |
| 005 | [Rüzgar Gülü Analizi & PyWake İz Modellemesi](lesson-005.md) | P1 | Türkçe | Tamamlandı |
| 006 | [Yerleşim Optimizasyonu, Blokaj & AEP Kaskadı](lesson-006.md) | P1 | Türkçe | Tamamlandı |
| 007 | [YG Şebeke Entegrasyonu: Pandapower Kararlı Durum Modeli](lesson-007.md) | P2 | Türkçe | Tamamlandı |
| 008 | [Dinamik Uyum, ANDES, FRT, Frekans & SSO](lesson-008.md) | P2 | Türkçe | Tamamlandı |
| 009 | [IEC 61850 Veri Modeli, SCL & SCADA](lesson-009.md) | P3 | Türkçe | Tamamlandı |
| 010 | [GOOSE Simülasyonu & Koruma Zaman Çizelgesi](lesson-010.md) | P3 | Türkçe | Tamamlandı |
| 011 | [IEC 62443 RBAC & Çalışma İzni](lesson-011.md) | P3 | Türkçe | Tamamlandı |
| 012 | [SCADA Veri Hattı & Kalite Filtreleri](lesson-012.md) | P3 | Türkçe | Tamamlandı |
| 013 | [XGBoost Kantil Tahminleme & SHAP](lesson-013.md) | P4 | Türkçe | Tamamlandı |
| 014 | [LSTM Tahminleme & MC Dropout](lesson-014.md) | P4 | Türkçe | Tamamlandı |
| 015 | [TFT Çok Ufuklu Tahmin](lesson-015.md) | P4 | Türkçe | Tamamlandı |
| 016 | [Topluluk Tahmini, Rampa Tespiti & Değerlendirme](lesson-016.md) | P4 | Türkçe | Tamamlandı |
| 017 | [Devreye Alma, Durum Makinesi & LOTO](lesson-017.md) | P5 | Türkçe | Tamamlandı |
| 018 | [FAT/SAT & Koruma Koordinasyonu](lesson-018.md) | P5 | Türkçe | Tamamlandı |

---

## Oturum Protokolü

`CLAUDE.md` dosyasında tanımlanan zorunlu yapı:

!!! info "Oturum Protokolü"
    - **Her oturumu açarken:** "510 MW Baltık Denizi rüzgar çiftliği simülasyonu inşa ediyoruz. 34 × V236-15.0 MW, 66 kV toplama, 220 kV ihracat (45 km), PSE şebekesi."
    - **Her oturumu kapatırken:** 3 mülakat sorusu + "basitçe anlat" + "teknik olarak anlat"
    - **Kod sırası:** P1 → P2 → P3 → P4 → P5. Önce fizik. Sonra kod.

---

## Belge Felsefesi — IEC 61355

**IEC 61355**, endüstriyel projeler için hiyerarşik bir belge yapısı oluşturur. Standart, sürüm kontrolü ve izlenebilirlik ile bir ana belge dizini gerektirir. Dokümantasyonumuz bu ilkeleri yazılım bağlamında takip eder:

- **`Project_Roadmap.md`** — tasarım esası (neyi inşa edeceğimiz)
- **`Learning_Roadmap.md`** — öz-çalışma müfredatı (neyi öğreneceğimiz)
- **`SKILL.md`** — mühendislik standartları ve kodlama kuralları (nasıl inşa edeceğimiz)
- **`CLAUDE.md`** — oturum protokolü (bağlamı nasıl koruyacağımız)
