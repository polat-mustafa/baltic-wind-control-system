/**
 * AI Academy — the P4 forecasting course, from zero to the models running in
 * this platform. English and Turkish; every chapter can be read aloud.
 *
 * Numbers quoted here are the platform's own (V236, 10-min SCADA, 5-fold
 * TimeSeriesSplit, measured skill before/after the leakage fix), so the
 * lesson and the dashboard tell the same story.
 */

export type Lang = "en" | "tr";
type T = Record<Lang, string>;

export type Widget =
  | "why"
  | "descent3d"
  | "boosting"
  | "timesplit"
  | "lstm"
  | "attention"
  | "quantile"
  | "leakage"
  | "ensemble"
  | "pipeline"
  | "none";

export interface Chapter {
  id: string;
  n: number;
  title: T;
  lead: T;
  body: T[];
  takeaways: T[];
  widget: Widget;
  /** Concept-map node ids this chapter explains. */
  concepts: string[];
}

export const CHAPTERS: Chapter[] = [
  {
    id: "why",
    n: 1,
    title: { en: "Why forecast wind power at all?", tr: "Rüzgâr gücünü neden tahmin ederiz?" },
    lead: {
      en: "Electricity must be produced at the very moment it is used. Wind does not ask permission — a forecast is how a wind farm becomes a reliable power plant.",
      tr: "Elektrik tüketildiği anda üretilmek zorundadır. Rüzgâr kimseye sormaz — tahmin, bir rüzgâr santralini güvenilir bir santrale dönüştüren şeydir.",
    },
    body: [
      {
        en: "The grid operator (PSE in Poland) balances supply and demand every second. A wind farm sells its energy a day ahead on the market (TGE) and again intraday. Whatever it delivers differently from what it promised is an imbalance — and imbalance energy is paid for at a penalty price.",
        tr: "Şebeke işletmecisi (Polonya'da PSE) arz ve talebi her saniye dengeler. Rüzgâr santrali enerjisini bir gün önceden piyasada (TGE) ve gün içinde satar. Söz verdiğinden farklı teslim ettiği her MWh bir dengesizliktir ve dengesizlik enerjisi ceza fiyatıyla ödenir.",
      },
      {
        en: "A better forecast therefore means: smaller imbalance costs, fewer expensive reserves held back by the grid, safer operation during ramps (a storm front can take 500 MW away in an hour) and better maintenance planning — boats and technicians go out when the wind is low.",
        tr: "Daha iyi tahmin şu demektir: daha düşük dengesizlik maliyeti, şebekenin elinde tuttuğu pahalı rezervlerin azalması, rampalarda (bir fırtına cephesi bir saatte 500 MW'ı götürebilir) daha güvenli işletme ve daha iyi bakım planlaması — tekneler ve teknisyenler rüzgâr düşükken çıkar.",
      },
      {
        en: "The chart below compares a naive 'it stays as it was an hour ago' guess (persistence) with a forecast over one day. The shaded area between promise and delivery is the imbalance you pay for.",
        tr: "Aşağıdaki grafik, 'bir saat önce neyse o kalır' şeklindeki saf tahmini (persistence) bir günlük gerçek bir tahminle karşılaştırıyor. Söz ile teslim arasındaki taralı alan, ödediğiniz dengesizliktir.",
      },
    ],
    takeaways: [
      { en: "Forecast error = money (imbalance price × |error|).", tr: "Tahmin hatası = para (dengesizlik fiyatı × |hata|)." },
      { en: "Persistence is the baseline every forecast must beat.", tr: "Persistence, her tahminin yenmesi gereken taban çizgisidir." },
    ],
    widget: "why",
    concepts: ["grid", "market", "imbalance", "persistence"],
  },
  {
    id: "ml",
    n: 2,
    title: { en: "Machine learning from zero", tr: "Sıfırdan makine öğrenmesi" },
    lead: {
      en: "Machine learning is fitting a function to examples: inputs (features) → output (target). Nothing more mysterious than that — but the details decide everything.",
      tr: "Makine öğrenmesi, örneklere bir fonksiyon uydurmaktır: girdiler (özellikler) → çıktı (hedef). Bundan daha gizemli değildir — ama her şeyi ayrıntılar belirler.",
    },
    body: [
      {
        en: "Our target is the turbine's active power P [MW] ten minutes from now. The features are what we know before that moment: the last measured wind speed, its 1-hour mean and standard deviation (turbulence), the wind direction, air density, the time of day and season, the power of the last six intervals, and the weather model's (NWP) forecast for that moment.",
        tr: "Hedefimiz, türbinin on dakika sonraki aktif gücü P [MW]. Özellikler o andan önce bildiğimiz her şey: son ölçülen rüzgâr hızı, 1 saatlik ortalaması ve standart sapması (türbülans), rüzgâr yönü, hava yoğunluğu, günün saati ve mevsim, son altı aralığın gücü ve hava tahmin modelinin (NWP) o an için tahmini.",
      },
      {
        en: "Training means: show the model many (features, target) pairs from the past and adjust its internal parameters until its predictions are close to the targets. 'Close' is measured by a loss function — for example the mean squared error (MSE).",
        tr: "Eğitim şudur: modele geçmişten birçok (özellik, hedef) çifti gösterip iç parametrelerini, tahminleri hedeflere yakın olana kadar ayarlamak. 'Yakın' bir kayıp fonksiyonu ile ölçülür — örneğin ortalama karesel hata (MSE).",
      },
      {
        en: "The real test is data the model has never seen. A model that memorises its training data (over-fitting) looks perfect in training and fails in operation. That is why we always keep unseen data apart for validation.",
        tr: "Gerçek sınav, modelin hiç görmediği veridir. Eğitim verisini ezberleyen bir model (aşırı öğrenme) eğitimde mükemmel görünür, işletmede çuvallar. Bu yüzden doğrulama için görülmemiş veriyi her zaman ayrı tutarız.",
      },
    ],
    takeaways: [
      { en: "Features in, target out, loss measures the error.", tr: "Özellik girer, hedef çıkar, kayıp hatayı ölçer." },
      { en: "Only unseen data tells you how good a model is.", tr: "Bir modelin ne kadar iyi olduğunu yalnızca görülmemiş veri söyler." },
    ],
    widget: "none",
    concepts: ["features", "target", "loss", "overfitting", "scada", "nwp"],
  },
  {
    id: "descent",
    n: 3,
    title: { en: "How a model learns: gradient descent", tr: "Model nasıl öğrenir: gradyan inişi" },
    lead: {
      en: "Imagine the loss as a landscape over the model's parameters. Learning is walking downhill — one small step at a time, in the steepest direction.",
      tr: "Kaybı, modelin parametreleri üzerinde bir arazi gibi düşünün. Öğrenmek yokuş aşağı yürümektir — her seferinde küçük bir adım, en dik yönde.",
    },
    body: [
      {
        en: "The gradient is the slope of the loss in every parameter direction. Gradient descent updates every weight w ← w − η·∂L/∂w. The learning rate η sets the step size: too small and training takes forever, too large and the ball jumps over the valley and diverges.",
        tr: "Gradyan, kaybın her parametre yönündeki eğimidir. Gradyan inişi her ağırlığı w ← w − η·∂L/∂w ile günceller. Öğrenme oranı η adım boyunu belirler: çok küçükse eğitim bitmez, çok büyükse top vadinin üzerinden atlar ve ıraksar.",
      },
      {
        en: "Our LSTM and TFT have tens of thousands of weights; the landscape has as many dimensions. We use the Adam optimiser (an adaptive version of gradient descent) on mini-batches of 64 samples. One pass over all training data is an epoch.",
        tr: "LSTM ve TFT modellerimizde on binlerce ağırlık var; arazinin de o kadar boyutu var. 64 örneklik mini-batch'ler üzerinde Adam optimizasyonunu (gradyan inişinin uyarlanabilir hali) kullanıyoruz. Tüm eğitim verisinin bir kez geçilmesine epoch denir.",
      },
      {
        en: "Drag the 3D landscape, change the learning rate and watch the path. In the training monitor you see the same thing as a curve: the loss falling epoch after epoch, until early stopping ends it when validation loss stops improving for 10 epochs.",
        tr: "3B araziyi döndürün, öğrenme oranını değiştirin ve yolu izleyin. Eğitim monitöründe aynı şeyi bir eğri olarak görürsünüz: kayıp epoch epoch düşer; doğrulama kaybı 10 epoch boyunca iyileşmezse erken durdurma eğitimi bitirir.",
      },
    ],
    takeaways: [
      { en: "w ← w − η∇L, repeated millions of times.", tr: "w ← w − η∇L, milyonlarca kez tekrarlanır." },
      { en: "Learning rate too high = divergence; too low = slow.", tr: "Öğrenme oranı çok yüksek = ıraksama; çok düşük = yavaşlık." },
    ],
    widget: "descent3d",
    concepts: ["loss", "gradient", "epoch", "earlystop"],
  },
  {
    id: "xgboost",
    n: 4,
    title: { en: "Decision trees and XGBoost", tr: "Karar ağaçları ve XGBoost" },
    lead: {
      en: "A decision tree asks yes/no questions ('is the wind below 8.4 m/s?') and gives a number at each leaf. One tree is crude. Hundreds of small trees, each fixing what the previous ones got wrong, are one of the strongest tools for tabular data: gradient boosting.",
      tr: "Karar ağacı evet/hayır soruları sorar ('rüzgâr 8,4 m/s'nin altında mı?') ve her yaprakta bir sayı verir. Tek ağaç kabadır. Her biri öncekilerin hatasını düzelten yüzlerce küçük ağaç ise tablo verisi için en güçlü araçlardan biridir: gradient boosting.",
    },
    body: [
      {
        en: "Start with a constant guess (the average power). Compute the residuals — what is still wrong. Fit a small tree to the residuals. Add a fraction η of it to the model. Repeat. Each new tree learns the mistakes that remain; this is gradient descent in function space.",
        tr: "Sabit bir tahminle başlayın (ortalama güç). Artıkları (residual), yani hâlâ yanlış olanı hesaplayın. Artıklara küçük bir ağaç uydurun. Onun η kadarını modele ekleyin. Tekrarlayın. Her yeni ağaç kalan hataları öğrenir; bu, fonksiyon uzayında gradyan inişidir.",
      },
      {
        en: "XGBoost ('eXtreme Gradient Boosting') adds second-order gradient information, regularisation that keeps trees small and leaf values modest, and very fast split finding. Here it trains three models — for the 10th, 50th and 90th percentile of power — each with up to 500 trees of depth 8 and η = 0.05, on 5 time-ordered folds.",
        tr: "XGBoost ('eXtreme Gradient Boosting') buna ikinci dereceden gradyan bilgisi, ağaçları küçük ve yaprak değerlerini ölçülü tutan düzenlileştirme ve çok hızlı bölünme araması ekler. Burada gücün 10., 50. ve 90. yüzdelikleri için üç model eğitilir; her biri en fazla 500 ağaç, derinlik 8 ve η = 0,05 ile, zamana göre sıralı 5 katmanda.",
      },
      {
        en: "Play with the boosting below: watch the orange model bend towards the true power curve tree by tree. Then set the learning rate to 1 and depth to 5 — the training error keeps falling but the unseen test error rises: over-fitting, live.",
        tr: "Aşağıdaki boosting ile oynayın: turuncu modelin ağaç ağaç gerçek güç eğrisine yaklaştığını izleyin. Sonra öğrenme oranını 1'e, derinliği 5'e alın — eğitim hatası düşmeye devam eder ama görülmemiş test hatası yükselir: canlı aşırı öğrenme.",
      },
    ],
    takeaways: [
      { en: "Boosting = many weak trees added in sequence on the residuals.", tr: "Boosting = artıklar üzerinde sırayla eklenen çok sayıda zayıf ağaç." },
      { en: "η and depth trade accuracy against over-fitting.", tr: "η ve derinlik, doğruluk ile aşırı öğrenme arasında denge kurar." },
    ],
    widget: "boosting",
    concepts: ["tree", "boosting", "xgboost", "residual", "overfitting"],
  },
  {
    id: "time",
    n: 5,
    title: { en: "Time is special: TimeSeriesSplit", tr: "Zaman özeldir: TimeSeriesSplit" },
    lead: {
      en: "In a forecast you never know the future. Your validation must not either — so we never shuffle time series.",
      tr: "Tahminde geleceği asla bilmezsiniz. Doğrulamanız da bilmemeli — bu yüzden zaman serilerini asla karıştırmayız.",
    },
    body: [
      {
        en: "Ordinary K-fold cross-validation shuffles the data: the model trains on Wednesday and is tested on Tuesday. With wind, neighbouring 10-minute samples are almost identical, so a shuffled test is secretly a memory test and looks far too good.",
        tr: "Sıradan K-katlı çapraz doğrulama veriyi karıştırır: model çarşamba ile eğitilir, salı ile test edilir. Rüzgârda komşu 10 dakikalık örnekler neredeyse aynıdır; karıştırılmış bir test gizlice bir ezber testidir ve olduğundan çok daha iyi görünür.",
      },
      {
        en: "TimeSeriesSplit grows the training window forward in time and always tests on the block that comes after it. Our models use 5 such folds; the RMSE bars in the training monitor are these out-of-sample results.",
        tr: "TimeSeriesSplit eğitim penceresini zamanda ileri doğru büyütür ve her zaman ondan sonra gelen blokta test eder. Modellerimiz 5 böyle katman kullanır; eğitim monitöründeki RMSE çubukları bu örneklem dışı sonuçlardır.",
      },
    ],
    takeaways: [
      { en: "Train on the past, test on the future — never shuffle.", tr: "Geçmişte eğit, gelecekte test et — asla karıştırma." },
    ],
    widget: "timesplit",
    concepts: ["tscv", "validation", "overfitting"],
  },
  {
    id: "leakage",
    n: 6,
    title: { en: "Data leakage — a real bug from this project", tr: "Veri sızıntısı — bu projeden gerçek bir hata" },
    lead: {
      en: "A model that looks perfect is the first thing to distrust. Ours did — skill 0.996 — and the reason is a classic mistake worth remembering.",
      tr: "Mükemmel görünen bir model, ilk şüphelenilecek şeydir. Bizimki öyleydi — skill 0,996 — ve nedeni hatırlanmaya değer klasik bir hata.",
    },
    body: [
      {
        en: "To predict power at time t, the feature table contained the wind speed measured at time t. But power follows almost directly from wind through the power curve. So the 'forecast' was really a power-curve lookup using information you cannot have in advance.",
        tr: "t anındaki gücü tahmin etmek için özellik tablosu t anında ölçülen rüzgâr hızını içeriyordu. Ama güç, güç eğrisi üzerinden neredeyse doğrudan rüzgârdan gelir. Yani 'tahmin' aslında önceden bilinemeyecek bir bilgiyle güç eğrisine bakmaktı.",
      },
      {
        en: "The fix: every measured channel enters with its last value before t (t−1); for the moment t itself only the weather model's forecast (NWP) is used. The skill against persistence dropped from 0.996 to about 0.15 for XGBoost — lower, but honest. A test now fails if the skill ever creeps above 0.9 again.",
        tr: "Düzeltme: ölçülen her kanal t'den önceki son değeriyle (t−1) girer; t anının kendisi için yalnızca hava tahmin modelinin tahmini (NWP) kullanılır. XGBoost'un persistence'a karşı skill değeri 0,996'dan yaklaşık 0,15'e düştü — daha düşük ama dürüst. Skill tekrar 0,9'un üzerine çıkarsa artık bir test başarısız oluyor.",
      },
    ],
    takeaways: [
      { en: "Ask for every feature: would I know this at forecast time?", tr: "Her özellik için sorun: tahmin anında bunu bilir miydim?" },
      { en: "Too good to be true usually is.", tr: "Gerçek olamayacak kadar iyi olan, genelde gerçek değildir." },
    ],
    widget: "leakage",
    concepts: ["leakage", "features", "nwp", "skill"],
  },
  {
    id: "lstm",
    n: 7,
    title: { en: "LSTM — a neural network with memory", tr: "LSTM — hafızası olan bir sinir ağı" },
    lead: {
      en: "Trees look at one row at a time. An LSTM reads a sequence — here the last 144 ten-minute steps (24 hours) — and keeps a memory of what mattered.",
      tr: "Ağaçlar her seferinde tek bir satıra bakar. LSTM bir diziyi okur — burada son 144 on dakikalık adım (24 saat) — ve önemli olanın hafızasını tutar.",
    },
    body: [
      {
        en: "Inside each LSTM cell runs a 'cell state', a conveyor belt of memory. Three gates, each a small learned function between 0 and 1, control it: the forget gate decides what to drop, the input gate what new information to store, the output gate what to reveal to the next layer.",
        tr: "Her LSTM hücresinin içinde bir 'hücre durumu' akar, bir hafıza bandı. Her biri 0 ile 1 arasında öğrenilmiş küçük bir fonksiyon olan üç kapı onu yönetir: unutma kapısı neyin atılacağına, giriş kapısı hangi yeni bilginin saklanacağına, çıkış kapısı bir sonraki katmana neyin gösterileceğine karar verir.",
      },
      {
        en: "This is how it can learn that a slowly rising wind over three hours is different from a gust, or that power at dusk follows a daily pattern. Our network: LSTM(64) → LSTM(32) → output, with dropout. Running it 100 times with dropout switched on (Monte-Carlo dropout) gives an uncertainty band.",
        tr: "Üç saat boyunca yavaşça artan rüzgârın bir hamleden farklı olduğunu ya da alacakaranlıktaki gücün günlük bir deseni izlediğini böyle öğrenebilir. Ağımız: LSTM(64) → LSTM(32) → çıkış, dropout ile. Dropout açıkken 100 kez çalıştırmak (Monte-Carlo dropout) bir belirsizlik bandı verir.",
      },
    ],
    takeaways: [
      { en: "Gates decide what to remember, forget and output.", tr: "Kapılar neyin hatırlanacağına, unutulacağına ve verileceğine karar verir." },
    ],
    widget: "lstm",
    concepts: ["lstm", "sequence", "dropout", "uncertainty"],
  },
  {
    id: "tft",
    n: 8,
    title: { en: "Temporal Fusion Transformer — attention", tr: "Temporal Fusion Transformer — dikkat" },
    lead: {
      en: "Attention lets a model look back over the whole window and decide which moments matter most for the next step — and it can show you where it looked.",
      tr: "Dikkat (attention), modelin tüm pencereye geri bakıp bir sonraki adım için hangi anların en önemli olduğuna karar vermesini sağlar — ve nereye baktığını size gösterebilir.",
    },
    body: [
      {
        en: "For each past step the model computes a score: how relevant is this moment to the one we are predicting? The scores are turned into weights that sum to 1 (softmax), and the past is combined with those weights. Typical patterns: the most recent steps, and the same hour yesterday.",
        tr: "Model her geçmiş adım için bir skor hesaplar: bu an, tahmin ettiğimiz anla ne kadar ilgili? Skorlar toplamı 1 olan ağırlıklara (softmax) dönüştürülür ve geçmiş bu ağırlıklarla birleştirilir. Tipik desenler: en son adımlar ve dünkü aynı saat.",
      },
      {
        en: "The TFT (Lim et al., 2021) adds variable selection networks — learned importance for each input — and predicts several quantiles at once. Ours: variable selection → LSTM(32) → 2-head attention → gated residual network → P10/P50/P90.",
        tr: "TFT (Lim ve ark., 2021) buna değişken seçim ağları — her girdi için öğrenilen önem — ekler ve aynı anda birden çok kantil tahmin eder. Bizimki: değişken seçimi → LSTM(32) → 2 başlı dikkat → kapılı artık ağ → P10/P50/P90.",
      },
    ],
    takeaways: [
      { en: "Attention = learned, explainable weighting of the past.", tr: "Dikkat = geçmişin öğrenilmiş ve açıklanabilir ağırlıklandırması." },
    ],
    widget: "attention",
    concepts: ["tft", "attention", "quantile"],
  },
  {
    id: "uncertainty",
    n: 9,
    title: { en: "P10 / P50 / P90 — forecasting uncertainty", tr: "P10 / P50 / P90 — belirsizliği tahmin etmek" },
    lead: {
      en: "A single number is a promise you cannot keep. A forecast band tells the operator how sure the model is.",
      tr: "Tek bir sayı, tutamayacağınız bir sözdür. Bir tahmin bandı, işletmeciye modelin ne kadar emin olduğunu söyler.",
    },
    body: [
      {
        en: "P50 is the median: half the time the real power is above, half below. P90 is the level the real power stays below 90 % of the time; P10 below 10 %. Between P10 and P90 lies 80 % of the outcomes — if the model is well calibrated.",
        tr: "P50 medyandır: zamanın yarısında gerçek güç üstünde, yarısında altında kalır. P90, gerçek gücün zamanın %90'ında altında kaldığı seviyedir; P10 ise %10'unda. P10 ile P90 arasında sonuçların %80'i bulunur — model iyi kalibre edilmişse.",
      },
      {
        en: "Quantiles are learned with the pinball loss: for the 90th percentile, under-predicting costs 9 times more than over-predicting, which pushes the line up until only 10 % of points lie above it. Move τ below and watch the line settle.",
        tr: "Kantiller pinball kaybı ile öğrenilir: 90. yüzdelik için düşük tahmin, yüksek tahminden 9 kat pahalıdır; bu, çizgiyi noktaların yalnızca %10'u üstünde kalana kadar yukarı iter. Aşağıda τ'yu değiştirin ve çizginin yerleşmesini izleyin.",
      },
    ],
    takeaways: [
      { en: "Pinball loss with τ = 0.9 learns the P90.", tr: "τ = 0,9 ile pinball kaybı P90'ı öğrenir." },
      { en: "Wide band = uncertain; plan reserves accordingly.", tr: "Geniş bant = belirsiz; rezervi buna göre planlayın." },
    ],
    widget: "quantile",
    concepts: ["quantile", "uncertainty", "pinball"],
  },
  {
    id: "ensemble",
    n: 10,
    title: { en: "Ensemble, skill score and physics", tr: "Topluluk, skill skoru ve fizik" },
    lead: {
      en: "Three different models make different mistakes. Combined wisely, the errors partly cancel — and physics has the last word.",
      tr: "Üç farklı model farklı hatalar yapar. Akıllıca birleştirildiğinde hatalar kısmen birbirini götürür — ve son söz fiziğindir.",
    },
    body: [
      {
        en: "The skill score compares a model with persistence: SS = 1 − MSE_model / MSE_persistence. 0 means no better than 'it stays as it is', 1 would be perfect. A model with negative skill is dropped from the ensemble; the others are weighted by 1/RMSE² and by horizon (XGBoost for the next hours, TFT for longer leads).",
        tr: "Skill skoru bir modeli persistence ile karşılaştırır: SS = 1 − MSE_model / MSE_persistence. 0, 'olduğu gibi kalır'dan iyi değil demektir; 1 mükemmel olurdu. Skill'i negatif olan model topluluktan çıkarılır; diğerleri 1/RMSE² ile ve ufka göre ağırlıklandırılır (yakın saatler için XGBoost, uzun ufuklar için TFT).",
      },
      {
        en: "Finally the physical guard (enforce_physical_constraints): no power below cut-in 3 m/s or above cut-out 25 m/s, never below 0 or above the 15 MW rating, P10 ≤ P50 ≤ P90. Machine learning never overrides physics.",
        tr: "Son olarak fiziksel koruma (enforce_physical_constraints): 3 m/s devreye girme hızının altında ve 25 m/s devreden çıkma hızının üstünde güç yok, 0'ın altına ya da 15 MW nominalin üstüne asla çıkmaz, P10 ≤ P50 ≤ P90. Makine öğrenmesi fiziği asla geçersiz kılamaz.",
      },
      {
        en: "SHAP values then explain each forecast: how much every feature pushed the prediction up or down from the average — so an engineer can check the model's reasoning, not just its output.",
        tr: "Ardından SHAP değerleri her tahmini açıklar: her özelliğin tahmini ortalamadan ne kadar yukarı ya da aşağı ittiğini — böylece bir mühendis yalnızca çıktıyı değil, modelin muhakemesini de kontrol edebilir.",
      },
    ],
    takeaways: [
      { en: "SS > 0 beats persistence; weights follow skill.", tr: "SS > 0 persistence'ı yener; ağırlıklar skill'i izler." },
      { en: "Physics constraints are applied after the ML.", tr: "Fizik kısıtları ML'den sonra uygulanır." },
    ],
    widget: "ensemble",
    concepts: ["ensemble", "skill", "persistence", "physics", "shap"],
  },
  {
    id: "pipeline",
    n: 11,
    title: { en: "The whole pipeline in this platform", tr: "Bu platformdaki uçtan uca hat" },
    lead: {
      en: "From raw SCADA to a forecast band in seven stages — the same ones you can watch light up in the training monitor.",
      tr: "Ham SCADA'dan tahmin bandına yedi aşamada — eğitim monitöründe yanışını izleyebileceğiniz aşamaların aynısı.",
    },
    body: [
      {
        en: "1 Data: two months (8 760 ten-minute steps) of synthetic SCADA for 34 turbines, quality-filtered (sensor faults, curtailment, maintenance, icing, power-curve outliers). 2 Features: causal, lagged, plus NWP. 3–5 XGBoost, LSTM and TFT train in parallel, each with 5-fold TimeSeriesSplit and early stopping. 6 Forecast with uncertainty. 7 Ensemble and physics.",
        tr: "1 Veri: 34 türbin için iki aylık (8 760 on dakikalık adım) sentetik SCADA, kalite filtreli (sensör arızaları, kısıtlama, bakım, buzlanma, güç eğrisi aykırı değerleri). 2 Özellikler: nedensel, gecikmeli, artı NWP. 3–5 XGBoost, LSTM ve TFT paralel eğitilir; her biri 5 katlı TimeSeriesSplit ve erken durdurma ile. 6 Belirsizlikli tahmin. 7 Topluluk ve fizik.",
      },
      {
        en: "On a CPU server the first build takes about half an hour; the results are then cached for a week, so every later run takes seconds. Press 'Run forecast' and switch to the training monitor to see it happen.",
        tr: "Bir CPU sunucusunda ilk derleme yaklaşık yarım saat sürer; sonuçlar bir hafta önbellekte kalır, böylece sonraki her çalıştırma saniyeler sürer. 'Run forecast'a basın ve olanı görmek için eğitim monitörüne geçin.",
      },
    ],
    takeaways: [
      { en: "Seven stages, three models, one honest forecast.", tr: "Yedi aşama, üç model, tek bir dürüst tahmin." },
    ],
    widget: "pipeline",
    concepts: ["scada", "features", "xgboost", "lstm", "tft", "ensemble", "physics"],
  },
];

/** Concept map: nodes (with the chapter that explains them) and links. */
export const CONCEPTS: { id: string; label: T; chapter: string; group: "data" | "ml" | "model" | "eval" | "ops" }[] = [
  { id: "grid", label: { en: "Grid balancing", tr: "Şebeke dengesi" }, chapter: "why", group: "ops" },
  { id: "market", label: { en: "Energy market", tr: "Enerji piyasası" }, chapter: "why", group: "ops" },
  { id: "imbalance", label: { en: "Imbalance cost", tr: "Dengesizlik maliyeti" }, chapter: "why", group: "ops" },
  { id: "scada", label: { en: "SCADA data", tr: "SCADA verisi" }, chapter: "pipeline", group: "data" },
  { id: "nwp", label: { en: "Weather model (NWP)", tr: "Hava modeli (NWP)" }, chapter: "ml", group: "data" },
  { id: "features", label: { en: "Features", tr: "Özellikler" }, chapter: "ml", group: "data" },
  { id: "target", label: { en: "Target P(t)", tr: "Hedef P(t)" }, chapter: "ml", group: "data" },
  { id: "loss", label: { en: "Loss function", tr: "Kayıp fonksiyonu" }, chapter: "descent", group: "ml" },
  { id: "gradient", label: { en: "Gradient descent", tr: "Gradyan inişi" }, chapter: "descent", group: "ml" },
  { id: "epoch", label: { en: "Epochs", tr: "Epoch" }, chapter: "descent", group: "ml" },
  { id: "earlystop", label: { en: "Early stopping", tr: "Erken durdurma" }, chapter: "descent", group: "ml" },
  { id: "overfitting", label: { en: "Over-fitting", tr: "Aşırı öğrenme" }, chapter: "xgboost", group: "ml" },
  { id: "tree", label: { en: "Decision tree", tr: "Karar ağacı" }, chapter: "xgboost", group: "model" },
  { id: "residual", label: { en: "Residuals", tr: "Artıklar" }, chapter: "xgboost", group: "ml" },
  { id: "boosting", label: { en: "Gradient boosting", tr: "Gradient boosting" }, chapter: "xgboost", group: "model" },
  { id: "xgboost", label: { en: "XGBoost", tr: "XGBoost" }, chapter: "xgboost", group: "model" },
  { id: "tscv", label: { en: "TimeSeriesSplit", tr: "TimeSeriesSplit" }, chapter: "time", group: "eval" },
  { id: "validation", label: { en: "Validation", tr: "Doğrulama" }, chapter: "time", group: "eval" },
  { id: "leakage", label: { en: "Data leakage", tr: "Veri sızıntısı" }, chapter: "leakage", group: "eval" },
  { id: "lstm", label: { en: "LSTM", tr: "LSTM" }, chapter: "lstm", group: "model" },
  { id: "sequence", label: { en: "Sequence (24 h)", tr: "Dizi (24 sa)" }, chapter: "lstm", group: "data" },
  { id: "dropout", label: { en: "MC dropout", tr: "MC dropout" }, chapter: "lstm", group: "ml" },
  { id: "tft", label: { en: "TFT", tr: "TFT" }, chapter: "tft", group: "model" },
  { id: "attention", label: { en: "Attention", tr: "Dikkat" }, chapter: "tft", group: "ml" },
  { id: "quantile", label: { en: "P10/P50/P90", tr: "P10/P50/P90" }, chapter: "uncertainty", group: "eval" },
  { id: "pinball", label: { en: "Pinball loss", tr: "Pinball kaybı" }, chapter: "uncertainty", group: "ml" },
  { id: "uncertainty", label: { en: "Uncertainty", tr: "Belirsizlik" }, chapter: "uncertainty", group: "eval" },
  { id: "ensemble", label: { en: "Ensemble", tr: "Topluluk" }, chapter: "ensemble", group: "model" },
  { id: "persistence", label: { en: "Persistence", tr: "Persistence" }, chapter: "why", group: "eval" },
  { id: "skill", label: { en: "Skill score", tr: "Skill skoru" }, chapter: "ensemble", group: "eval" },
  { id: "physics", label: { en: "Physics limits", tr: "Fizik sınırları" }, chapter: "ensemble", group: "ops" },
  { id: "shap", label: { en: "SHAP", tr: "SHAP" }, chapter: "ensemble", group: "eval" },
];

export const LINKS: [string, string][] = [
  ["grid", "market"], ["market", "imbalance"], ["imbalance", "persistence"], ["grid", "physics"],
  ["scada", "features"], ["nwp", "features"], ["features", "target"], ["features", "leakage"], ["nwp", "leakage"],
  ["target", "loss"], ["loss", "gradient"], ["gradient", "epoch"], ["epoch", "earlystop"], ["earlystop", "overfitting"],
  ["tree", "boosting"], ["residual", "boosting"], ["boosting", "xgboost"], ["gradient", "boosting"], ["xgboost", "overfitting"],
  ["features", "xgboost"], ["features", "lstm"], ["features", "tft"], ["sequence", "lstm"], ["lstm", "dropout"],
  ["dropout", "uncertainty"], ["lstm", "tft"], ["attention", "tft"], ["tft", "quantile"], ["xgboost", "quantile"],
  ["pinball", "quantile"], ["quantile", "uncertainty"], ["tscv", "validation"], ["validation", "overfitting"],
  ["tscv", "leakage"], ["xgboost", "ensemble"], ["lstm", "ensemble"], ["tft", "ensemble"], ["persistence", "skill"],
  ["skill", "ensemble"], ["ensemble", "physics"], ["xgboost", "shap"], ["uncertainty", "imbalance"], ["loss", "pinball"],
];
