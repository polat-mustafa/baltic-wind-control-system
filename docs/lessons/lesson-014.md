# Ders 014 — LSTM Zaman Serisi Tahminleme: MC Dropout ile Belirsizlik Ölçümü

!!! abstract "Ders Navigasyonu"
    :material-arrow-left: **Önceki:** [Ders 013 — XGBoost Kantil Tahminleme: NWP Pipeline, Olasılıksal Güç Tahmini & SHAP Açıklanabilirlik](lesson-013.md) | **Sonraki:** [Ders 015 — TFT: Dikkat Mekanizması ile Çok Ufuklu Güç Tahmini](lesson-015.md) :material-arrow-right:

    **Faz:** P4 | **Dil:** Türkçe | **İlerleme:** 15 / 19 | [Tüm Dersler](index.md) | [Öğrenme Yol Haritası](../Learning_Roadmap.md)

> **Date:** 2026-02-26
> **Phase:** P4 (AI Forecasting)
> **Roadmap sections:** [Phase 4 — Section 4.3 LSTM, Section 4.4 Wind Power Forecasting]
> **Language:** Turkish
> **Previous lesson:** Lesson 013

---

## Ne Öğreneceksiniz

- Rüzgar gücü tahmininde zamansal bağımlılıkların neden kritik olduğunu ve LSTM'in kapı (gate) mekanizmasının bunları nasıl yakaladığını
- Monte Carlo Dropout'un (Gal & Ghahramani, 2016) Bayesian belirsizlik tahmini için nasıl kullanıldığını
- LSTM hücre denklemlerini (forget/input/output gates) ve MC Dropout kantil türetimini
- PyTorch ile 2 katmanlı LSTM modelinin eğitimi, erken durdurma (early stopping) ve TimeSeriesSplit çapraz doğrulama
- XGBoost ile aynı veri pipeline'ı üzerinde adil model karşılaştırması yapılmasını

---

## Bölüm 1: Zamansal Bağımlılıklar — Neden Dizi Önemli?

### Gerçek Dünya Problemi

Bir hava cephesi Kuzey Denizi üzerinden Baltic'e doğru ilerliyor. Sabah 06:00'da rüzgar 6 m/s, 09:00'da 9 m/s, 12:00'da 14 m/s — bu bir rampa olayı (ramp event). Türbin gücü kubik yasaya (P ∝ v³) bağlı olduğundan, bu 2.3 katlık rüzgar artışı ~12 katlık güç artışına dönüşür.

XGBoost gibi tablo tabanlı (tabular) modeller her zaman adımını bağımsız olarak değerlendirir. Evet, lag özellikleri (t-1, t-2, t-6) ile geçmiş bilgiyi kodlayabiliriz, ama bu el ile tasarlanmış "pencere"lerdir. LSTM ise 24 saatlik (144 adım) ham diziyi alır ve hangi geçmiş bilginin önemli olduğuna kendisi karar verir.

### Standartların Söylediği

**IEC 61400-26-1** güç tahminleri için belirsizlik ölçümü (uncertainty quantification) gerektirir. Geleneksel yöntemler (ensemble, quantile regression) deterministik model çıktılarını farklı kayıp fonksiyonlarıyla eğitir. MC Dropout ise tek bir model eğitip, çıkarım (inference) sırasında dropout'u aktif bırakarak stokastik bir ensemble oluşturur:

> **MC Dropout** (Gal & Ghahramani, 2016): Dropout'lu bir sinir ağının T kez çalıştırılması, yaklaşık bir Bayesian posterior örneklemesidir. Her ileri geçiş (forward pass) farklı bir dropout maskesi kullanır ve farklı bir alt-ağ (sub-network) seçer.

Bu, tek model eğitimi maliyetiyle ensemble düzeyinde belirsizlik tahmini sağlar.

### Ne İnşa Ettik

**Yeni dosyalar:**

- `backend/app/services/p4/lstm_model.py` — PyTorch LSTM modeli, MC Dropout tahmin, normalizasyon
- `backend/tests/test_lstm_model.py` — 18 test (dizi oluşturma, eğitim, MC dropout, tahmin, fiziksel kısıtlar)

**Değişen dosyalar:**

- `backend/app/services/p4/__init__.py` — LSTM modül dışa aktarımları (re-exports)
- `backend/app/schemas/forecast.py` — LSTM Pydantic şemaları (request/response)
- `backend/app/routers/p4.py` — 3 yeni endpoint (train-lstm, predict-lstm, lstm-mc-dropout)
- `backend/pyproject.toml` — PyTorch bağımlılığı eklendi

### Neden Önemli

> **Neden** XGBoost zaten iyi çalışıyorsa LSTM'e ihtiyacımız var?

XGBoost her satırı bağımsız görür ve öznitelik etkileşimlerini öğrenir. LSTM ise ham zaman dizisindeki uzun mesafeli bağımlılıkları (long-range dependencies) öğrenir. 6 saatlik bir hava cephesi paterni, 30 dakikalık bir rampa olayı — bunlar sıralı (sequential) yapılardır. Gerçek dünya rüzgar tahmini sistemleri her iki yaklaşımı da kullanır ve ensemble'lar oluşturur. Hangisinin daha iyi olduğu veri setine, tahmin ufkuna ve türbin konumuna bağlıdır.

---

## Bölüm 2: LSTM Hücre Mekaniği — Kapılar (Gates)

### Basit Analoji

Bir LSTM hücresini kapılı bir depo olarak düşünün:

1. **Unutma Kapısı (Forget Gate)** — f_t: "Depodaki eski bilginin ne kadarını tutayım?" Hava cephesi geçtiyse, eski rüzgar paternini unut.
2. **Giriş Kapısı (Input Gate)** — i_t: "Yeni gelen bilginin ne kadarını depoya ekleyeyim?" Yeni bir rampa olayı başladıysa, bu bilgiyi kaydet.
3. **Çıkış Kapısı (Output Gate)** — o_t: "Depodan ne kadar bilgiyi dışarı vereyim?" Tahmin yaparken hangi bilgi en önemli?

### Matematiksel Formülasyon

Her zaman adımı t'de LSTM hücresi şunu hesaplar:

```
Unutma kapısı:  f_t = σ(W_f · [h_{t-1}, x_t] + b_f)
Giriş kapısı:   i_t = σ(W_i · [h_{t-1}, x_t] + b_i)
Hücre güncelleme: c̃_t = tanh(W_c · [h_{t-1}, x_t] + b_c)
Hücre durumu:   c_t = f_t ⊙ c_{t-1} + i_t ⊙ c̃_t
Çıkış kapısı:   o_t = σ(W_o · [h_{t-1}, x_t] + b_o)
Gizli durum:    h_t = o_t ⊙ tanh(c_t)
```

Burada σ sigmoid fonksiyonu (çıktı [0,1]), ⊙ element-wise çarpım (Hadamard), ve tanh çıktıyı [-1,1]'e sıkıştırır.

### Mimari

```
Girdi (batch, 144, 19) → LSTM(64) → Dropout(0.2) → LSTM(32) → Dropout(0.2) → Dense(1)
```

- **144 zaman adımı**: 24 saat × 6 adım/saat (10 dakikalık çözünürlük)
- **19 öznitelik**: 14 mühendislenmiş SCADA + 5 NWP özniteliği
- **2 katman**: İlk katman (64 birim) düşük seviye zamansal paternleri, ikinci katman (32 birim) yüksek seviye soyutlamaları öğrenir

### Kod İncelemesi — Model Sınıfı

```python
class WindPowerLSTM(nn.Module):
    """2-layer LSTM for wind power forecasting with MC Dropout."""

    def __init__(self, n_features, hidden_units=(64, 32), dropout=0.2):
        super().__init__()
        h1, h2 = hidden_units
        self.lstm1 = nn.LSTM(input_size=n_features, hidden_size=h1, batch_first=True)
        self.dropout1 = nn.Dropout(p=dropout)
        self.lstm2 = nn.LSTM(input_size=h1, hidden_size=h2, batch_first=True)
        self.dropout2 = nn.Dropout(p=dropout)
        self.fc = nn.Linear(h2, 1)

    def forward(self, x):
        out, _ = self.lstm1(x)      # (batch, 144, 64)
        out = self.dropout1(out)     # MC Dropout: train() modunda aktif kalır
        out, _ = self.lstm2(out)     # (batch, 144, 32)
        out = self.dropout2(out)
        out = out[:, -1, :]          # Son zaman adımının çıktısı (batch, 32)
        return self.fc(out)          # (batch, 1)
```

**Kritik tasarım kararı:** `nn.Dropout` kullanıyoruz çünkü PyTorch'ta `model.train()` modunda dropout otomatik olarak aktif, `model.eval()` modunda devre dışı. MC Dropout için çıkarım sırasında `model.train()` çağırıyoruz — bu, her ileri geçişte farklı nöronları "susturarak" bir stokastik ensemble oluşturur.

---

## Bölüm 3: MC Dropout — Bayesian Belirsizlik

### Teori

Gal & Ghahramani (2016) gösterdi ki: dropout'lu bir sinir ağını T kez çalıştırmak, yaklaşık bir variational Bayesian inference'tır. Her ileri geçiş, model ağırlıklarının posterior dağılımından bir örneklemdir.

T stokastik ileri geçişten sonra:

```
Ortalama:    μ = (1/T) Σ ŷ_t           — merkezi tahmin (P50)
Varyans:     σ² = (1/T) Σ (ŷ_t - μ)²  — epistemik belirsizlik
P10:         μ - 1.2816 × σ            — Gaussian %10 kantili
P90:         μ + 1.2816 × σ            — Gaussian %90 kantili
```

Burada 1.2816, standart normal dağılımın %90 z-skorudur.

### Neden Gaussian z-skoru?

Merkezi limit teoremine göre, yeterince çok (T ≥ 30) bağımsız MC geçişinin ortalaması normal dağılıma yakınsar. T=100 kullanarak bu koşulu sağlıyoruz. Bu, karmaşık kantil regresyon yerine basit z-skoru çarpımıyla P10/P90 hesaplamamızı mümkün kılar — eğitim amaçlı olarak şeffaf ve anlaşılır.

### Kod İncelemesi — MC Dropout

```python
def compute_mc_dropout_detail(model, features, norm_params, config):
    # Normalize ve sequence oluştur
    norm_features = _normalize_features_with_params(features, norm_params)
    x_seq, _ = create_sequences(norm_features, dummy_target, config.lookback)
    x_tensor = torch.tensor(x_seq, dtype=torch.float32)

    # KRITIK: model.train() — dropout AKTIF kalır
    model.train()
    all_passes = []
    for _ in range(config.mc_samples):  # 100 geçiş
        with torch.no_grad():           # Gradient hesaplamıyor (hızlı)
            pred_norm = model(x_tensor).squeeze(-1).numpy()
        pred_mw = _denormalize_power(pred_norm, norm_params)
        all_passes.append(pred_mw)

    all_passes_array = np.array(all_passes)  # (100, n_steps)
    mc_mean = np.mean(all_passes_array, axis=0)
    mc_std = np.std(all_passes_array, axis=0)
```

Her geçişte farklı nöronlar "susturulur" → farklı tahmin → istatistiksel belirsizlik.

---

## Bölüm 4: Veri Pipeline — Normalizasyon → Dizileme → Eğitim

### Veri Akışı

```
Mevcut pipeline (XGBoost ile paylaşılan):
  SCADA → Kalite Filtreleri → Öznitelik Mühendisliği → NWP Birleştirme → 2D (n, 19)

LSTM'e özel adımlar:
  → Min-Max Normalizasyon [0,1] → Kayar Pencere 3D (n_seq, 144, 19) → Eğitim/Tahmin
  → MC Dropout (100 geçiş) → μ ± 1.2816σ → P10/P50/P90
  → Fiziksel Kısıtlar → Monotoniklik Zorlaması
```

### Neden Normalizasyon?

LSTM hücreleri sigmoid ve tanh aktivasyonları kullanır — her ikisi de [-1, 1] veya [0, 1] aralığında doyuma ulaşır (saturate). Normalize edilmemiş rüzgar hızı (0-30 m/s) ve basınç (95.000-105.000 Pa) birlikte beslenirse, basınç gradyanları dominant olur ve rüzgar hızı bilgisi kaybolur. Min-max normalizasyon tüm öznitelikleri [0,1] aralığına eşitleyerek bu sorunu çözer.

### Neden Normalizasyondan Sonra Dizileme?

Normalizasyon parametreleri (min, max) eğitim setinden hesaplanır. Dizileme sonra yapılsaydı, her pencerenin kendi min/max'ı olurdu — pencereler arası tutarsızlık. Önce tüm veriyi normalize edip sonra pencerelere bölmek, tüm zaman adımlarının aynı ölçekte olmasını garanti eder.

### Kod İncelemesi — Kayar Pencere

```python
def create_sequences(features, target, lookback=144):
    n_samples = features.shape[0]
    if n_samples < lookback:
        return empty arrays

    n_sequences = n_samples - lookback + 1
    x = np.zeros((n_sequences, lookback, n_features))
    y = np.zeros(n_sequences)

    for i in range(n_sequences):
        x[i] = features[i : i + lookback]  # 24 saatlik pencere
        y[i] = target[i + lookback - 1]    # Pencerenin SON adımı → hedef

    return x, y
```

**Gelecek sızıntısı koruması:** `y[i]` her zaman `x[i]` penceresinin son adımına karşılık gelir. Model asla "gelecekteki" güç değerlerini girdi olarak göremez.

---

## Bölüm 5: Eğitim — TimeSeriesSplit + Erken Durdurma

### Cross-Validation

XGBoost ile aynı TimeSeriesSplit stratejisini kullanıyoruz (adil karşılaştırma):

```
Fold 1: Eğitim [0 .. N/4]     → Test [N/4 .. 2N/4]
Fold 2: Eğitim [0 .. 2N/4]    → Test [2N/4 .. 3N/4]
Fold 3: Eğitim [0 .. 3N/4]    → Test [3N/4 .. N]
```

Her fold'da eğitim penceresi genişler (expanding window), test penceresi ileri kayar. Bu, gerçek dünyada modelin zaman geçtikçe daha fazla veriyle yeniden eğitilmesini simüle eder.

### Erken Durdurma (Early Stopping)

```python
for epoch in range(config.epochs):  # max 100
    # Eğitim fazı
    model.train()
    for batch_x, batch_y in train_loader:
        optimizer.zero_grad()
        pred = model(batch_x).squeeze(-1)
        loss = loss_fn(pred, batch_y)  # MSE
        loss.backward()
        optimizer.step()

    # Doğrulama fazı (dropout kapalı)
    model.eval()
    with torch.no_grad():
        val_loss = loss_fn(model(x_val).squeeze(-1), y_val).item()

    # Erken durdurma kontrolü
    if val_loss < best_val_loss:
        best_val_loss = val_loss
        patience_counter = 0
    else:
        patience_counter += 1
        if patience_counter >= config.patience:  # 10 epoch sabır
            break
```

**Neden erken durdurma?** LSTM'ler aşırı öğrenmeye (overfitting) yatkındır — parametreli modeller eğitim verisini "ezberleyebilir." Doğrulama kaybı iyileşmeyi durdurduğunda eğitimi kesiyoruz.

---

## Bölüm 6: Fiziksel Kısıtlar — Model-Agnostik Güvenlik

Fiziksel kısıt katmanı XGBoost ile aynıdır (model-agnostik tasarım):

```python
# P10/P50/P90'a ayrı ayrı fiziksel kısıt uygula
p10 = enforce_physical_constraints(p10_raw, wind_speed)
p50 = enforce_physical_constraints(p50_raw, wind_speed)
p90 = enforce_physical_constraints(p90_raw, wind_speed)

# Monotoniklik: P10 ≤ P50 ≤ P90
p50 = np.maximum(p50, p10)
p90 = np.maximum(p90, p50)
```

IEC 61400-12-1 kuralları:
- 0 ≤ P ≤ 15 MW (V236 nominal güç)
- v < 3.0 m/s → P = 0 (cut-in altı)
- v > 31.0 m/s → P = 0 (cut-out üstü, güvenlik durdurması)

---

## Bölüm 7: API Endpoints

Üç yeni endpoint eklendi:

| Metod | Yol | Amaç |
|-------|-----|-------|
| POST | `/api/v1/forecast/train-lstm` | TimeSeriesSplit CV ile eğitim, CV metrikleri döndür |
| POST | `/api/v1/forecast/predict-lstm` | MC Dropout → P10/P50/P90 tahmin |
| POST | `/api/v1/forecast/lstm-mc-dropout` | Tüm MC geçişleri — belirsizlik görselleştirme verisi |

Tüm endpoint'ler mevcut `_build_xgboost_pipeline` yardımcı fonksiyonunu kullanır — XGBoost ve LSTM tam olarak aynı veri üzerinde eğitilir, bu da adil model karşılaştırması sağlar.

---

## Bölüm 8: Tasarım Kararları

| Karar | Neden |
|-------|-------|
| **PyTorch (Keras değil)** | `model.train()` ile doğal dropout kontrolü — MC Dropout için gerekli |
| **Mevcut veri pipeline'ı yeniden kullanımı** | XGBoost vs LSTM adil karşılaştırma (aynı veriler, aynı öznitelikler) |
| **Gaussian z-skoru kantilleri** | Basit, eğitim amaçlı şeffaf (P10 = μ - 1.2816σ) |
| **Normalizasyon → dizileme sırası** | Tüm pencere değerleri aynı ölçekte |
| **Fiziksel kısıtlar son-işleme** | Model-agnostik — aynı katman XGBoost ve LSTM'e uygulanır |

---

## Test Kapsamı

18 test, 5 test sınıfında:

| Test Sınıfı | Test Sayısı | Ne Doğrular |
|-------------|-------------|-------------|
| `TestSequenceCreation` | 4 | 3D şekil, gelecek sızıntısı yok, pencere süreklilik, kısa veri |
| `TestLSTMTraining` | 6 | Tamamlanma, fold sayısı, erken durdurma, sonlu RMSE, norm parametreleri, mimari |
| `TestMCDropout` | 3 | Geçişler arası varyans, negatif olmayan std, doğru geçiş sayısı |
| `TestLSTMPrediction` | 4 | Kantil monotonikliği, negatif yok, nominal altı, tutarlı uzunluklar |
| `TestLSTMPhysicalConstraints` | 1 | Cut-in altında sıfır güç |

---

## Soru Bankası

**S1:** LSTM'in forget gate'i rüzgar enerjisi tahmininde hangi senaryoda en kritiktir?

<details>
<summary>Cevap</summary>

Hava cephesi geçişlerinde. Bir Kuzey cephesi 6 saat boyunca güçlü kuzey rüzgarı getirdi, ardından rüzgar yön değiştirdi ve hız düştü. Forget gate, eski kuzey rüzgarı paterninin artık geçerli olmadığını tanır ve hücre durumundaki (cell state) bu bilgiyi "siler." Eğer forget gate düzgün çalışmazsa, model eski paterne bağlı kalır ve geçiş sırasındaki güç düşüşünü yakalayamaz. Bu, deniz koşullarında özellikle önemlidir çünkü hava cepheleri hızlı ve dramatik rüzgar değişikliklerine neden olur.

</details>

**S2:** MC Dropout neden 100 ileri geçiş kullanır? 10 veya 1000 olsa ne olur?

<details>
<summary>Cevap</summary>

Merkezi Limit Teoremine göre, T ≥ 30 bağımsız örneklem ortalaması normal dağılıma yakınsar. T=10 ile standart sapma tahmini yüksek varyanslıdır — bazı zaman adımlarında gerçek belirsizliği eksik veya aşırı tahmin eder. T=1000 istatistiksel olarak daha doğru ama çıkarım süresini 10x artırır; gerçek zamanlı SCADA sistemi 10 dakikada bir tahmin üretmeli, bu yüzden hesaplama bütçesi kısıtlıdır. T=100, istatistiksel kararlılık ve hesaplama maliyeti arasında iyi bir denge noktasıdır. Production'da bu parametre, donanım kapasitesi ve gecikme gereksinimlerine göre ayarlanır.

</details>

**S3:** Neden normalizasyonu dizileme öncesinde yapıyoruz, sonrasında değil?

<details>
<summary>Cevap</summary>

Dizileme sonrası normalizasyon yapılsaydı, iki olası sorun çıkardı: (1) Her diziye kendi min/max'ı uygulanırsa, pencereler arası ölçek tutarsızlığı oluşur — aynı 10 m/s rüzgar hızı farklı pencerelerde farklı normalize değerler alır. (2) Tüm dizilere global min/max uygulanırsa sorun çözülür, ama bu normalizasyonu gereksiz yere karmaşıklaştırır. Dizileme öncesi normalizasyon en temiz çözümdür: 2D matris üzerinde tek bir min/max hesaplanır, ardından 3D'ye dönüştürülür. Tüm pencereler otomatik olarak aynı ölçektedir.

</details>

**S4:** XGBoost ve LSTM arasındaki temel mimari fark nedir? Hangisi ne zaman tercih edilir?

<details>
<summary>Cevap</summary>

XGBoost tablo tabanlıdır — her satır bağımsız bir örneklemdir ve öznitelik etkileşimlerini öğrenir (ağaç bölünmeleri). LSTM dizi tabanlıdır — 144 ardışık zaman adımını tek bir girdi olarak alır ve kapı mekanizmasıyla hangi geçmiş bilginin önemli olduğuna öğrenilmiş şekilde karar verir. XGBoost, iyi mühendislenmiş özniteliklerle (lag, rolling average, TI) kısa vadeli tahminlerde genellikle güçlüdür ve eğitimi hızlıdır. LSTM, uzun vadeli zamansal paternlerin (6-12 saatlik cepheler, günlük döngüler) kritik olduğu senaryolarda avantajlıdır ama daha fazla veri ve GPU hesaplama gücü gerektirir. Production'da ikisi genellikle ensemble olarak birleştirilir.

</details>

**S5:** Fiziksel kısıt katmanını neden model içine (loss function'a) gömmek yerine son-işleme (post-processing) olarak uyguluyoruz?

<details>
<summary>Cevap</summary>

Üç neden: (1) **Model-agnostik**: Aynı kısıt kodu XGBoost, LSTM ve gelecekteki TFT modeline değişiklik yapmadan uygulanır. (2) **Ayrıştırılabilirlik**: Model eğitimi sırasında kısıtlar loss landscape'i bozabilir — gradient'ler kısıt sınırlarında kesintiye uğrar ve eğitim kararsızlaşabilir. Son-işleme olarak fizik kuralları deterministik ve hızlıdır. (3) **Hata ayıklama**: Model çıktısını kısıt öncesi ve sonrası görebilmek, modelin nerede fiziksel olarak tutarsız tahmin ürettiğini izlememizi sağlar — bu, model iyileştirme için değerli bir sinyal.

</details>

**S6:** `model.train()` ve `model.eval()` arasındaki fark nedir? MC Dropout'ta neden `train()` kullanıyoruz?

<details>
<summary>Cevap</summary>

PyTorch'ta `model.train()` dropout ve batch normalization gibi katmanları eğitim modunda çalıştırır — dropout nöronları rastgele devre dışı bırakır, batch norm running statistics yerine batch statistics kullanır. `model.eval()` ise bunları devre dışı bırakır — deterministic inference için standart yaklaşım. MC Dropout'ta bilerek `model.train()` kullanıyoruz çünkü dropout'un aktif kalmasını istiyoruz: her ileri geçiş farklı nöronları "susturarak" farklı bir alt-ağ oluşturur, bu da stokastik bir ensemble üretir. `torch.no_grad()` ile gradient hesabını kapatarak bellek ve hesaplama tasarrufu sağlıyoruz — gradientlere ihtiyacımız yok, sadece çıktı varyansına.

</details>

### Zorluk Sorusu

**S7:** Mevcut MC Dropout implementasyonu epistemik belirsizliği (model bilinmezliği) ölçer. Aleatoric belirsizliği (veri gürültüsü) de yakalamak isterseniz, modeli nasıl değiştirirdiniz?

<details>
<summary>Cevap</summary>

Heteroscedastic regression yaklaşımı kullanılır: modelin çıktı katmanını `Dense(1)` yerine `Dense(2)` yapar — bir çıktı μ (ortalama), diğeri log(σ²) (log varyans). Loss function'ı Gaussian negative log-likelihood'a değiştirir: L = (1/2)log(σ²) + (y - μ)²/(2σ²). Bu şekilde model her zaman adımı için hem tahmin hem de veri belirsizliği üretir. MC Dropout ile birleştirildiğinde toplam belirsizlik = aleatoric (model çıktısı σ²) + epistemik (MC varyansı) olur. Bu, Kendall & Gal (2017) "What Uncertainties Do We Need in Bayesian Deep Learning for Computer Vision?" makalesinde formalize edilmiştir. Rüzgar enerjisinde aleatoric belirsizlik, türbülans ve ölçüm gürültüsünden gelir; epistemik belirsizlik, modelin eğitim verisinde hiç görmediği koşullardan (aşırı fırtına, nadir atmosferik olaylar) gelir.

</details>

---

## Mülakat Köşesi

### Basitçe Açıkla
*"LSTM ile rüzgar gücü tahminini teknik bilgisi olmayan birine nasıl açıklarsınız?"*

Bir rüzgar çiftliğinde 34 dev türbin elektrik üretiyor. Yarın ne kadar elektrik üreteceğimizi bugünden bilmemiz lazım — çünkü elektrik şebekesine söz verdik. Bunun için bilgisayara son 24 saatin tüm verilerini gösteriyoruz: rüzgar hızı, sıcaklık, hava basıncı — 10 dakikada bir, 144 ölçüm. Bilgisayar bu diziye bakarak "rüzgar artıyor mu, azalıyor mu, bir fırtına mı yaklaşıyor?" sorularına cevap buluyor.

Ama tek bir tahmin vermek riskli — ya yanılırsak? Bu yüzden bilgisayara aynı soruyu 100 kez soruyoruz, ama her seferinde hafızasının rastgele bir kısmını kapatıyoruz (gözlerinin bir kısmını bantlıyoruz). Eğer 100 cevabın hepsi birbirine yakınsa, "model emin" diyoruz. Eğer cevaplar çok dağınıksa, "model emin değil — dikkatli ol" diyoruz. Sonuçta üç sayı veriyoruz: en kötü durum, beklenen durum, en iyi durum. Enerji tüccarı bu üç sayıya bakarak güvenli bir söz verebilir.

### Teknik Olarak Açıkla
*"LSTM MC Dropout pipeline'ını bir mülakat paneline nasıl açıklarsınız?"*

P4 modülüne eklediğimiz LSTM pipeline'ı, 510 MW offshore rüzgar çiftliği için dizi tabanlı (sequence-based) olasılıksal güç tahmini üretir. Mimari PyTorch ile implementedir: 2 katmanlı LSTM (64→32 birim), katmanlar arası 0.2 dropout, son katman Dense(1). Girdi, 144 zaman adımlık (24 saat, 10-dakika çözünürlük) kayar pencere ile 19 öznitelikten (14 mühendislenmiş SCADA + 5 NWP) oluşan 3D tensördür.

Belirsizlik ölçümü MC Dropout (Gal & Ghahramani, 2016) ile sağlanır: çıkarım sırasında model `train()` modunda tutularak 100 stokastik ileri geçiş yapılır. Her geçiş farklı dropout maskesiyle farklı bir alt-ağ örnekler — bu, yaklaşık bir variational posterior örneklemesidir. Sonuç dağılımından Gaussian z-skorları ile P10 (μ-1.2816σ), P50 (μ), P90 (μ+1.2816σ) kantilleri türetilir.

Veri pipeline'ı XGBoost ile tam olarak paylaşılır (`_build_xgboost_pipeline`): SCADA üretimi → 5 kalite filtresi → öznitelik mühendisliği → NWP birleştirme. Bu, iki modelin adil karşılaştırmasını garanti eder. Min-max normalizasyon dizileme öncesinde uygulanır (tüm pencereler eşit ölçek). TimeSeriesSplit CV (expanding window) ile eğitim sırasında gelecek sızıntısı önlenir. Adam optimizer + MSE loss + early stopping (patience=10) ile aşırı öğrenme kontrol edilir.

Tahmin sonrası aynı model-agnostik fiziksel kısıt katmanı uygulanır: 0 ≤ P ≤ 15 MW, cut-in/cut-out kuralları (IEC 61400-12-1), ve kantil monotonikliği (P10 ≤ P50 ≤ P90). Pipeline 3 FastAPI endpoint'i ile sunulur ve 18 pytest ile kapsanır — dizi şeklinden MC varyansına kadar fiziksel ve istatistiksel tutarlılık doğrulanır.
