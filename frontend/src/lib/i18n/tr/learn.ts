/** Turkish: AI forecasting (results + AI Academy course), Decommissioning and Academy tracks. */
export default {
  // Forecast page
  "AI Forecasting": "Yapay Zekâ ile Tahmin",
  "Day-ahead wind power forecasts trained and scored on measured Baltic offshore output (Energinet DK2, 977 MW, or one farm from ENTSO-E) with the ECMWF / ICON forecasts issued the day before — no synthetic data.":
    "Ölçülmüş Baltık açık deniz üretimi (Energinet DK2, 977 MW veya ENTSO-E'den tek bir santral) ve bir gün önce yayımlanan ECMWF / ICON tahminleriyle eğitilip puanlanan gün öncesi rüzgâr gücü tahminleri — sentetik veri yok.",
  "5-fold TimeSeriesSplit": "5 katlı TimeSeriesSplit",
  "CRPS, reliability, skill vs persistence, climatology and the TSO": "CRPS, güvenilirlik, kalıcılık, klimatoloji ve TSO'ya karşı beceri",
  "DK2 Baltic offshore ({n1} farms) — {n2} MW": "DK2 Baltık açık deniz ({n1} santral) — {n2} MW",
  "Baltic offshore production —": "Baltık açık deniz üretimi —",
  hours: "saat",
  "Inputs: only the {n1} m wind the ECMWF and ICON runs of the previous day predicted (what a bid at {n2}:{n3} D−{n4} can know). Validation: {n5} time-ordered folds, never shuffled; every forecast is scored on the same {n6} test hours. These farms are not SB-{n7}; the same pipeline would run on SB-{n8} metering once it exists.":
    "Girdiler: yalnızca önceki günün ECMWF ve ICON çalıştırmalarının öngördüğü {n1} m rüzgâr ({n2}:{n3} G−{n4}'teki bir teklifin bilebileceği). Doğrulama: zamana göre sıralı {n5} kat, asla karıştırılmaz; her tahmin aynı {n6} test saatinde puanlanır. Bu santraller SB-{n7} değildir; SB-{n8} ölçümü oluştuğunda aynı hat onun üzerinde çalışır.",
  official: "resmî",
  "% of capacity": "kapasitenin %'si",
  "TSO day-ahead {n} % · best: XGBoost (P50)": "TSO gün öncesi %{n} · en iyi: XGBoost (P50)",
  "skill vs climatology {n}": "klimatolojiye karşı beceri {n}",
  "ideal 80 % · conformal band": "ideal %80 · uyumlu (conformal) bant",
  "vs climatology {n1} · bias {n2} %": "klimatolojiye karşı {n1} · yanlılık %{n2}",
  "Persistence 24 h": "Kalıcılık 24 sa",
  Measured: "Ölçülen",
  "TSO day-ahead": "TSO gün öncesi",
  "XGBoost P50": "XGBoost P50",
  "Scores on the same {n} test hours": "Aynı {n} test saatinde puanlar",
  "Bias %": "Yanlılık %",
  "Ensemble ({n}/MSE weights)": "Topluluk ({n}/MSE ağırlıkları)",
  "NWP power curve": "SHT güç eğrisi",
  "Energinet day-ahead (TSO)": "Energinet gün öncesi (TSO)",
  Climatology: "Klimatoloji",
  "Perfect calibration": "Mükemmel kalibrasyon",
  "XGBoost (P10–P90 holds {n} %)": "XGBoost (P10–P90 %{n} kapsıyor)",
  "Climatology (P10–P90 holds {n} %)": "Klimatoloji (P10–P90 %{n} kapsıyor)",
  "TFT (P10–P90 holds {n} %)": "TFT (P10–P90 %{n} kapsıyor)",

  // Decommissioning
  "Recover the array cables": "Dizi kablolarını çıkar",
  "Otherwise cut, seal and leave buried; position published for fishers.": "Aksi hâlde kes, mühürle ve gömülü bırak; konumu balıkçılar için yayımlanır.",
  "Recover the export cable": "İletim kablosunu çıkar",
  "Long route, burial and crossings: often left in situ where buried deep enough.": "Uzun güzergâh, gömme ve geçişler: yeterince derine gömülü yerlerde çoğu zaman yerinde bırakılır.",
  "Remove the scour protection rock": "Oyulma koruma kayasını kaldır",
  "Rock is a habitat after 25 years; removing it disturbs the seabed again.": "25 yıl sonra kaya bir habitattır; kaldırmak deniz tabanını yeniden bozar.",
  "abandoned or disused installations shall be removed to ensure safety of navigation, with due regard to fishing, the marine environment and other States; the depth, position and dimensions of anything not entirely removed are published.":
    "terk edilmiş veya kullanılmayan tesisler, balıkçılık, deniz çevresi ve diğer devletler gözetilerek seyir güvenliği için kaldırılır; tamamen kaldırılmayan her şeyin derinliği, konumu ve boyutları yayımlanır.",
  "structures placed after 1 January 1998 in less than 100 m of water and weighing less than 4,000 t in air (excluding deck and superstructure) should be entirely removed (§3.2); where a structure is partly removed, at least 55 m of clear water column stays above it (§3.6).":
    "1 Ocak 1998'den sonra 100 m'den sığ suya yerleştirilen ve havada 4.000 t'dan hafif (güverte ve üst yapı hariç) yapılar tamamen kaldırılmalıdır (§3.2); kısmen kaldırılan bir yapının üstünde en az 55 m açık su sütunu kalır (§3.6).",
  "turns this into a decommissioning programme and financial security, approved by the authority — e.g. the UK Energy Act 2004, ss. 105–114. In Poland the conditions come with the project's permits; read them, not this summary.":
    "bunu yetkili makamca onaylanan bir söküm programına ve mali teminata dönüştürür — ör. Birleşik Krallık Energy Act 2004, md. 105–114. Polonya'da koşullar projenin izinleriyle gelir; bu özeti değil, onları okuyun.",
  "Simulate the removal": "Sökümü benzet",
  "Blades (glass/carbon fibre composite)": "Kanatlar (cam/karbon elyaf kompozit)",
  processed: "işlenir",
  "Nacelles and hubs": "Naseller ve göbekler",
  recycled: "geri dönüştürülür",
  Towers: "Kuleler",
  "Jackets (recovered part)": "Ceketler (çıkarılan kısım)",
  "Offshore substation (topside and jacket)": "Açık deniz trafo merkezi (üst yapı ve ceket)",
  "Piles below the cut": "Kesimin altındaki kazıklar",
  "left in situ": "yerinde bırakılır",
  "Export cable (offshore part)": "İletim kablosu (açık deniz kısmı)",
  "Scour protection (rock)": "Oyulma koruması (kaya)",
  "{n} Pre-removal survey": "{n} Söküm öncesi etüt",
  "Multibeam and side-scan survey of every position and cable route: the baseline the end state is compared with.":
    "Her konumun ve kablo güzergâhının çok ışınlı ve yan taramalı sonar etüdü: son durumun karşılaştırıldığı referans.",
  "{n} Cut and recover": "{n} Kes ve çıkar",
  "Piles cut below the natural seabed (the depth is set in the approved decommissioning programme) so no stub can be uncovered by scour.":
    "Kazıklar doğal deniz tabanının altından kesilir (derinlik onaylı söküm programında belirlenir), böylece oyulma hiçbir kütüğü açığa çıkaramaz.",
  "{n} Cable ends": "{n} Kablo uçları",
  "Cables left in situ are cut, sealed and the ends buried; their position, depth and burial are published for fishers and mariners.":
    "Yerinde bırakılan kablolar kesilir, mühürlenir ve uçları gömülür; konumları, derinlikleri ve gömme durumları balıkçılar ve denizciler için yayımlanır.",
  "{n} Debris clearance": "{n} Döküntü temizliği",
  "Clear dropped objects and cut ends; an over-trawl or ROV trial shows the area is safe for bottom fishing.":
    "Düşen nesneleri ve kesik uçları temizleyin; bir trol veya ROV denemesi alanın dip balıkçılığı için güvenli olduğunu gösterir.",
  "{n} Post-removal survey and monitoring": "{n} Söküm sonrası etüt ve izleme",
  "Repeat the survey, notify the hydrographic office and monitor the seabed and any structures left in situ for a set period.":
    "Etüdü tekrarlayın, hidrografi dairesini bilgilendirin ve deniz tabanını ve yerinde kalan yapıları belirli bir süre izleyin.",
  "Removing everything is not automatically the greenest option: recovering buried cables and scour rock disturbs the seabed a second time. The choice is made case by case with the authority, and whatever stays is charted.":
    "Her şeyi kaldırmak otomatik olarak en çevreci seçenek değildir: gömülü kabloları ve oyulma kayasını çıkarmak deniz tabanını ikinci kez bozar. Seçim yetkili makamla duruma göre yapılır ve kalan her şey haritaya işlenir.",

  // Academy tracks
  "Pass mark {n} Progress stays in this browser.": "Geçme notu {n} İlerleme bu tarayıcıda kalır.",
  "{n} · Develop": "{n} · Geliştirme",
  "{n} · Design": "{n} · Tasarım",
  "{n} · Build": "{n} · İnşa",
  "{n} · Operate": "{n} · İşletme",
  "{n} · Decommission": "{n} · Söküm",
  "Find a site that can be consented and connected.": "İzin alınabilecek ve bağlanabilecek bir saha bulun.",
  "Weibull Wind Speed Distribution": "Weibull rüzgâr hızı dağılımı",
  "Wind Rose & Vertical Shear": "Rüzgâr gülü ve düşey kesme",
  "Screen the Southern Baltic on open marine data and take a site through the permit procedure.":
    "Güney Baltık'ı açık deniz verisiyle tarayın ve bir sahayı izin prosedüründen geçirin.",
  "Lay out turbines and cables for the lowest cost of energy.": "Türbinleri ve kabloları en düşük enerji maliyeti için yerleştirin.",
  "Turbine Selection — why a 15 MW direct-drive class?": "Türbin seçimi — neden 15 MW doğrudan tahrik sınıfı?",
  "Wake Losses & Wake Models": "İz kayıpları ve iz modelleri",
  "Revenue & LCOE": "Gelir ve LCOE",
  "Array Voltage Selection — Why 66 kV?": "Dizi gerilimi seçimi — neden 66 kV?",
  "Cable Cross-Section & Graded Design": "Kablo kesiti ve kademeli tasarım",
  "HVAC vs HVDC Export Trade-off": "HVAC / HVDC iletim ödünleşimi",
  "Place turbines, watch the wakes, route the array cables and price the farm.": "Türbinleri yerleştirin, izleri izleyin, dizi kablolarını güzergâhlayın ve santrali fiyatlandırın.",
  "Install in the weather windows and energise safely.": "Hava pencerelerinde kurun ve güvenle enerjilendirin.",
  "Weather Windows & Vessel Access": "Hava pencereleri ve gemi erişimi",
  "Install your farm in Baltic weather windows; compare a spring and an autumn start on P50 and P90.":
    "Santralinizi Baltık hava pencerelerinde kurun; bahar ve sonbahar başlangıcını P50 ve P90 üzerinden karşılaştırın.",
  "Protection Zones, Grading and Clearance Time": "Koruma bölgeleri, kademelendirme ve temizleme süresi",
  "Energise export circuit 1 step by step: isolation locks, interlocks, hold points and load-flow readings.":
    "İletim devresi 1'i adım adım enerjilendirin: izolasyon kilitleri, kilitlemeler, bekleme noktaları ve yük akışı okumaları.",
  "Print the as-built register and put your farm on the control-room map.": "Yapıldığı gibi kaydını yazdırın ve santralinizi kontrol odası haritasına koyun.",
  "Keep the plant compliant, available and healthy.": "Tesisi uyumlu, kullanılabilir ve sağlıklı tutun.",
  "Fault Ride-Through (FRT) and Fast Fault Current": "Arızada devrede kalma (FRT) ve hızlı arıza akımı",
  "Reactive Compensation — Reactors, STATCOM and the PSE Q Range": "Reaktif kompanzasyon — reaktörler, STATCOM ve PSE Q aralığı",
  "Power Plant Controller — Dispatch, Frequency and Voltage Control": "Santral kontrolcüsü — dağıtım, frekans ve gerilim kontrolü",
  "Downtime Breakdown": "Duruş dağılımı",
  "Detect, diagnose and predict turbine faults against a physics model.": "Türbin arızalarını bir fizik modeline karşı tespit edin, teşhis edin ve öngörün.",
  "Choose what comes out of the sea at end of life, simulate the removal and restore the seabed.":
    "Ömür sonunda denizden neyin çıkacağını seçin, sökümü benzetin ve deniz tabanını iyileştirin.",
} satisfies Record<string, string>;
