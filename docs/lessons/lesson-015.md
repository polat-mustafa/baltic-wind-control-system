# Ders 015 — Temporal Fusion Transformer (TFT): Dikkat Mekanizması ile Çok Ufuklu Güç Tahmini

!!! abstract "Ders Navigasyonu"
    :material-arrow-left: **Önceki:** [Ders 014 — LSTM Zaman Serisi Tahminleme: MC Dropout ile Belirsizlik Ölçümü](lesson-014.md) | **Sonraki:** Yakında :material-arrow-right:

    **Faz:** P4 | **Dil:** Türkçe | **İlerleme:** 4 / ? | [Tüm Dersler](index.md) | [Öğrenme Yol Haritası](../Learning_Roadmap.md)

> **Date:** 2026-02-26
> **Phase:** P4 (AI Forecasting)
> **Roadmap sections:** [Phase 4 — Section 5.6 TFT Model, Section 5.7 Quantile Regression, Section 5.10 Attention]
> **Language:** Turkish
> **Previous lesson:** Lesson 014

---

## Ne Öğreneceksiniz

- Farklı tahmin ufuklarının (1h, 6h, 24h, 48h) neden farklı model stratejileri gerektirdiğini
- Temporal Fusion Transformer (TFT) mimarisinin 4 temel bileşenini: GRN, VSN, Multi-Head Attention, Quantile Outputs
- Dikkat (attention) mekanizmasının "hangi geçmiş zaman adımları tahmine etki etti?" sorusuna nasıl cevap verdiğini
- Native quantile regression'ın (pinball loss) MC Dropout'a alternatif olarak P10/P50/P90 üretmesini
- Variable Selection Network (VSN) ile özellik önem sıralamasının SHAP olmadan nasıl elde edildiğini

---

## Bölüm 1: Çok Ufuklu Tahmin — Neden Tek Model Yetmez?

### Gerçek Dünya Problemi

Baltic Denizi'nde bir fırtına cephesi yaklaşıyor. Şebeke operatörü (PSE) farklı zaman ufuklarında farklı kararlar almalı:

| Ufuk | Karar | Dominant Bilgi |
|------|-------|----------------|
| 1-6 saat | Dengeleme piyasası | SCADA otokorelasyonu |
| 6-24 saat | Gün öncesi piyasa teklifi | NWP sinoptik tahmin |
| 24-48 saat | Bakım planlama | Rejim değişiklikleri |

XGBoost her satırı bağımsız değerlendirir — kısa ufukta iyidir. LSTM 24 saatlik dizi öğrenir — orta ufukta iyidir. Ama hangi geçmiş bilginin hangi ufuk için kritik olduğuna otomatik karar veren bir model yok... TFT tam bunu yapar.

### Standartların Söylediği

**IEC 61400-26-1** belirsizlik ölçümü için iki temel yaklaşım tanımlar:

1. **MC Dropout** (LSTM — Ders 014): Tek model eğitip, stokastik forward pass'larla belirsizlik üretir
2. **Quantile Regression** (XGBoost — Ders 013, TFT — bu ders): Kayıp fonksiyonuna τ parametresi ekleyerek doğrudan P10/P50/P90 üretir

TFT, quantile regression'ı mimarinin içine gömer — her quantile için ayrı çıkış kafası (output head) vardır. Bu, post-hoc yaklaşımlardan daha kalibre (calibrated) tahminler üretir.

**Lim et al. (2021):** "Temporal Fusion Transformers for Interpretable Multi-horizon Time Series Forecasting" — günümüzün en güçlü zaman serisi tahmin mimarilerinden biri.

---

## Bölüm 2: TFT Mimarisi — 4 Temel Bileşen

### 2.1 Gated Residual Network (GRN)

GRN, TFT'nin temel yapı taşıdır. Her bileşenin içinde GRN kullanılır:

```
η₁ = W₁x + b₁
η₂ = W₂ · ELU(η₁) + b₂
GRN(x) = LayerNorm(x + GLU(η₂))
```

**GLU (Gated Linear Unit)**: Çıktıyı ikiye böler — bir yarı değer (value), diğer yarı kapı (gate). Kapı sigmoid'den geçer ve 0-1 arasında bilgi akışını kontrol eder. Kapı → 0 olduğunda, o giriş tamamen bastırılır.

**Skip connection**: Gradyan akışını korur, derin ağların eğitilebilirliğini garanti eder.

### 2.2 Variable Selection Network (VSN)

VSN, her giriş özelliğinin ne kadar önemli olduğunu öğrenir:

```
v_j = GRN_j(ξ_j)             her özellik j için
weights = Softmax(GRN_w(ξ))   seçim ağırlıkları
VSN(ξ) = Σ_j weights_j × v_j  ağırlıklı toplam
```

Bu, SHAP'a ihtiyaç duymadan **yerleşik özellik önemi** sağlar. Rüzgar gücü tahmininde VSN şunları öğrenebilir:
- 1h ufkunda: `power_lag_1` ve `wind_speed_mean` yüksek ağırlık
- 24h ufkunda: `nwp_wind_speed_100m` ve `hour_cos` yüksek ağırlık

### 2.3 Multi-Head Attention

Vaswani et al. (2017) "Attention Is All You Need" makalesinden:

```
Attention(Q,K,V) = softmax(QK^T / √d_k) · V
```

**Ne anlama gelir?**
- **Q (Query)**: "Hangi bilgiyi arıyorum?"
- **K (Key)**: "Her geçmiş adımın kimliği"
- **V (Value)**: "Her geçmiş adımın taşıdığı bilgi"

Dikkat ağırlıkları (attention weights) **çıkarılabilir** — hangi geçmiş zaman adımının tahmine ne kadar katkıda bulunduğunu gösterir. Bir hava cephesi 6 saat önce başladıysa, o zaman adımı yüksek dikkat ağırlığı alır.

### 2.4 Quantile Output Heads

Son katmanda her quantile için ayrı bir lineer katman:

```python
self.quantile_heads = nn.ModuleList([
    nn.Linear(hidden_size, 1)  # P10
    nn.Linear(hidden_size, 1)  # P50
    nn.Linear(hidden_size, 1)  # P90
])
```

Eğitimde **pinball loss** kullanılır:

```
L_τ(y, ŷ) = τ × max(y-ŷ, 0) + (1-τ) × max(ŷ-y, 0)
L_total = L₀.₁₀ + L₀.₅₀ + L₀.₉₀
```

---

## Bölüm 3: Ne İnşa Ettik

### Yeni Dosyalar

- `backend/app/services/p4/tft_model.py` — Tam TFT modeli: GRN, VSN, MultiHeadAttn, WindPowerTFT, eğitim, tahmin, dikkat ağırlıkları
- `backend/tests/test_tft_model.py` — 23 test (GRN, VSN, Attention, Eğitim, Quantile, Tahmin, Kısıtlar, Dikkat)

### Değişen Dosyalar

- `backend/app/services/p4/__init__.py` — TFT modül dışa aktarımları
- `backend/app/schemas/forecast.py` — TFT Pydantic şemaları (TFTTrainRequest/Response, TFTPredictRequest/Response, TFTAttentionRequest/Response)
- `backend/app/routers/p4.py` — 3 yeni endpoint (train-tft, predict-tft, tft-attention)

### Mimari Özet

```
Giriş (batch, lookback=72, n_features=19)
  ↓
Variable Selection Network (özellik başına softmax ağırlıkları)
  ↓
LSTM Encoder (hidden=32, 1 katman) — zamansal bağlam
  ↓
Multi-Head Attention (2 head, d_model=32) — uzun menzilli bağımlılıklar
  ↓
Gated Residual Network — doğrusal olmayan zenginleştirme
  ↓
Quantile Çıkış (3 head: P10, P50, P90) — native olasılıksal tahmin
```

### API Endpoints

| Endpoint | Açıklama |
|----------|----------|
| `POST /api/v1/forecast/train-tft` | TFT eğitimi + TimeSeriesSplit CV |
| `POST /api/v1/forecast/predict-tft` | P10/P50/P90 güç tahmini |
| `POST /api/v1/forecast/tft-attention` | Dikkat ağırlıkları + VSN özellik önemi |

---

## Bölüm 4: Üç Model Karşılaştırması

| Özellik | XGBoost | LSTM | TFT |
|---------|---------|------|-----|
| Mimari | Karar ağaçları | Tekrarlayan sinir ağı | Transformer + LSTM |
| En iyi ufuk | < 6 saat | 6-24 saat | 12-48 saat |
| Belirsizlik yöntemi | Quantile regression | MC Dropout | Native quantile |
| Açıklanabilirlik | SHAP | Sınırlı | Dikkat ağırlıkları + VSN |
| Eğitim hızı | En hızlı | Orta | En yavaş |
| Veri ihtiyacı | En az | Orta | En fazla |

### Ensemble Stratejisi (Roadmap §5.6)

```
< 6h:   0.50 × XGBoost + 0.30 × LSTM + 0.20 × TFT
6-24h:  0.20 × XGBoost + 0.40 × LSTM + 0.40 × TFT
24-48h: 0.10 × XGBoost + 0.30 × LSTM + 0.60 × TFT
```

---

## Bölüm 5: Fiziksel Kısıtlar

TFT çıktıları, XGBoost ve LSTM ile aynı `physical_constraints.py` modülünden geçer:

1. **C1**: P ≥ 0 MW (negatif üretim yok)
2. **C2**: P ≤ 15.0 MW (V236 nominal güç)
3. **C3**: v < 3.0 m/s → P = 0 (cut-in altı)
4. **C4**: v > 31.0 m/s → P = 0 (cut-out üstü)
5. **Monotoniklik**: P10 ≤ P50 ≤ P90

---

## Bölüm 6: Test Kapsamı

23 test, 8 test sınıfı:

| Test Sınıfı | Test Sayısı | Kapsam |
|-------------|-------------|--------|
| TestGRN | 3 | Çıkış boyutu, skip connection |
| TestVariableSelection | 3 | Çıkış boyutu, ağırlık toplamı, pozitiflik |
| TestMultiHeadAttention | 3 | Çıkış boyutu, ağırlık depolama, toplam=1 |
| TestTFTTraining | 5 | Eğitim tamamlanma, CV fold, early stopping, RMSE, mimari |
| TestTFTPrediction | 4 | Monotoniklik, negatif kontrol, nominal güç, uzunluk tutarlılığı |
| TestTFTPhysicalConstraints | 1 | Cut-in altında sıfır güç |
| TestTFTAttention | 4 | Dikkat boyutu, VSN toplamı, özellik isimleri, head sayısı |

---

## Mülakat Soruları

### Soru 1: TFT'nin XGBoost ve LSTM'den farkı nedir?

**Basit:** XGBoost her satıra bağımsız bakar, LSTM sıralı desenleri öğrenir ama tek ufuk tahmin eder. TFT ise hem sıralı desenleri hem de hangi özelliklerin ve zaman adımlarının önemli olduğunu öğrenir — ve bunu aynı anda birden fazla ufuk için yapar.

**Teknik:** TFT, Variable Selection Network ile per-feature gating uygular (SHAP'a gerek kalmaz), LSTM encoder ile kısa vadeli zamansal bağlamı yakalar, Multi-Head Attention ile uzun menzilli bağımlılıkları tespit eder (O(1) yerine O(n) adım gerektirmez), ve native quantile regression ile doğrudan P10/P50/P90 üretir. Bu, XGBoost'un tabular gücü ile LSTM'in temporal gücünü tek bir mimaride birleştirir.

### Soru 2: Pinball loss nasıl çalışır ve neden MC Dropout yerine tercih edilir?

**Basit:** Pinball loss, modele "gerçek değer tahmininin üstünde mi altında mı?" sorusuna göre farklı cezalar verir. P90 için tahmin altında kalmak 9 kat daha çok cezalandırılır. Bu, modelin doğrudan istenen quantile'i öğrenmesini sağlar.

**Teknik:** L_τ(y,ŷ) = τ·max(y-ŷ,0) + (1-τ)·max(ŷ-y,0). τ=0.9 için, under-prediction (y>ŷ) 0.9 ağırlıkla, over-prediction 0.1 ağırlıkla cezalandırılır. MC Dropout Gaussian varsayımı yapar (z-score ile P10/P90 türetir), pinball loss ise dağılım-agnostiktir. Asimetrik dağılımlarda (rüzgar gücünün sıfır sınırı gibi) pinball loss daha kalibre tahminler üretir.

### Soru 3: Attention weights'ler nasıl yorumlanır?

**Basit:** Attention weights, modelin tahmini yaparken geçmişteki hangi anlara daha çok "baktığını" gösterir. Eğer 6 saat önceki bir zaman adımı yüksek ağırlık alıyorsa, o andaki bir olay (örn. hava cephesi başlangıcı) bugünkü tahmini etkiliyor demektir.

**Teknik:** Self-attention'da Q·K^T/√d_k softmax'ı her zaman adımının diğer tüm adımlara olan benzerliğini hesaplar. Çok başlı (multi-head) yapıda her head farklı bir ilişki alt-uzayını öğrenir — bir head diurnal pattern'e, diğeri sinoptik ölçeğe odaklanabilir. Head'ler üzerinden ortalama alındığında, genel temporal importance haritası elde edilir. Bu, LSTM'in "kara kutu" yapısının aksine, müdahale edilebilir (interpretable) bir açıklanabilirlik mekanizmasıdır.
