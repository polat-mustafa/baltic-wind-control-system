/**
 * Live and real open data: PSE system day and the market's real day, IMGW
 * coastal stations, the 7-day access forecast, ship traffic density and the
 * national grid on the screening map.
 */

const liveData: Record<string, string> = {
  // ── Market: real day, PSE system panel ──
  "Real day (PSE)": "Gerçek gün (PSE)",
  "Real day": "Gerçek gün",
  "Real day {date}: RCE price (PSE) and the model wind at the site (Open-Meteo). Day average {n} PLN/MWh. Real RCE price (PSE), hourly means of its 15-minute periods; CEN here is still the model's (DA − λ·deviation).":
    "Gerçek gün {date}: RCE fiyatı (PSE) ve sahadaki model rüzgârı (Open-Meteo). Gün ortalaması {n} PLN/MWh. Gerçek RCE fiyatı (PSE), 15 dakikalık dönemlerinin saatlik ortalamaları; buradaki CEN hâlâ modelinki (DA − λ·sapma).",
  "Wind share of demand": "Rüzgârın talepteki payı",
  "Wind capture price": "Rüzgâr yakalama fiyatı",
  "Wind peak": "Rüzgâr tepe değeri",
  "Negative-price quarters": "Negatif fiyatlı çeyrekler",
  "{n} GWh wind · {n2} GWh demand": "{n} GWh rüzgâr · {n2} GWh talep",
  "{n} % of the {n2} PLN/MWh average": "{n2} PLN/MWh ortalamanın %{n}'i",
  "solar {n} % of demand": "güneş talebin %{n}'i",
  "data to {date} (Polish time)": "veri {date}'e kadar (Polonya saati)",
  "no data yet": "henüz veri yok",
  "× 15 min": "× 15 dk",
  "The Polish system on {date} — wind, solar, demand and RCE": "{date} günü Polonya sistemi — rüzgâr, güneş, talep ve RCE",
  "{title}. Generation and demand per 15 min (MW, filled in about an hour behind real time); RCE is the market price per 15 min, published the day before. Wind sold at its capture price: windy hours tend to be the cheap ones.":
    "{title}. 15 dakikada bir üretim ve talep (MW, gerçek zamanın yaklaşık bir saat gerisinden doldurulur); RCE, bir gün önce yayımlanan 15 dakikalık piyasa fiyatıdır. Rüzgâr yakalama fiyatından satıldı: rüzgârlı saatler genellikle ucuz olanlardır.",
  "PSE open data unavailable: {title}": "PSE açık verisine ulaşılamadı: {title}",
  "The real Polish system on this day": "Bu gün gerçek Polonya sistemi",
  Solar: "Güneş",
  Demand: "Talep",
  "RCE price": "RCE fiyatı",

  // ── IMGW coastal stations ──
  "Coastal weather stations (IMGW, live)": "Kıyı meteoroloji istasyonları (IMGW, canlı)",
  "Measured on the shore (IMGW, 10 m):": "Kıyıda ölçülen (IMGW, 10 m):",

  // ── 7-day access forecast ──
  "Next 7 days at the site: who can go out": "Sahada önümüzdeki 7 gün: kim denize çıkabilir",
  "Forecast wave height and 10 m wind against the vessel limits (CTV Hs ≤ {n} m, U10 ≤ {n2} m/s; SOV {n3} m, {n4} m/s).":
    "Tahmini dalga yüksekliği ve 10 m rüzgârı, gemi sınırlarına göre (CTV Hs ≤ {n} m, U10 ≤ {n2} m/s; SOV {n3} m, {n4} m/s).",
  "Accessible hours": "Erişilebilir saatler",
  "{n} / {n2} h": "{n} / {n2} sa",
  "Access forecast unavailable: {title}": "Erişim tahmini alınamadı: {title}",

  // ── Copernicus Marine sea conditions (p1/MetoceanPanel) ──
  "Sea conditions at the site: Copernicus Marine reanalyses": "Sahada deniz koşulları: Copernicus Marine yeniden analizleri",
  "Baltic wave model hourly {n}–{n2}, ocean model daily since 1993. The wave record also drives the weather windows and campaign runs.":
    "Baltık dalga modeli saatlik {n}–{n2}, okyanus modeli 1993'ten beri günlük. Dalga kaydı hava pencerelerini ve kampanya koşularını da besler.",
  "Hs median / P99": "Hs medyan / P99",
  "significant wave height, all hours": "belirgin dalga yüksekliği, tüm saatler",
  "Highest Hs on record": "Kayıtlı en yüksek Hs",
  "50-year Hs (Gumbel)": "50 yıllık Hs (Gumbel)",
  "annual maxima {n}–{n2}": "yıllık maksimumlar {n}–{n2}",
  "Surface current P99": "Yüzey akıntısı P99",
  "daily means, scour and vessel ops": "günlük ortalamalar, oyulma ve gemi operasyonları",
  "Ice days per winter": "Kış başına buzlu gün",
  "ice model; NOAA OISST {n} (used, conservative)": "buz modeli; NOAA OISST {n} (kullanılan, ihtiyatlı)",
  "Waves by month and who can work": "Aylara göre dalgalar ve kim çalışabilir",
  "Mean Hs per month (bars) and the share of hours under the vessel limits: CTV Hs ≤ 1.5 m, SOV Hs ≤ 2.5 m (wave limit only; wind limits apply too).":
    "Aylık ortalama Hs (çubuklar) ve gemi sınırlarının altındaki saatlerin payı: CTV Hs ≤ 1,5 m, SOV Hs ≤ 2,5 m (yalnızca dalga sınırı; rüzgâr sınırları da geçerlidir).",
  "Seabed temperature along the export cable and its rating": "İletim kablosu boyunca deniz tabanı sıcaklığı ve kablonun anma akımı",
  "Monthly 99th percentile of the bottom-water temperature (the cable's ambient; the datasheet rating of {n} A assumes {n2} °C) and the rating it gives each buried section — against {n3} A per circuit at 510 MW. Bottom water over the burial depth is conservative: the sediment damps the summer peak.":
    "Dip suyu sıcaklığının aylık %99 yüzdeliği (kablonun ortam sıcaklığı; {n} A katalog anma değeri {n2} °C varsayar) ve gömülü her bölüme verdiği anma akımı — 510 MW'ta devre başına {n3} A'e karşı. Gömme derinliği yerine dip suyu ihtiyatlıdır: sediman yaz tepesini sönümler.",
  "Sea conditions unavailable: {title}": "Deniz koşulları alınamadı: {title}",
  "Mean Hs": "Ortalama Hs",
  "CTV access": "CTV erişimi",
  "SOV access": "SOV erişimi",

  // ── Screening map: traffic and the national grid ──
  "Ship traffic density 2025": "Gemi trafiği yoğunluğu 2025",
  "EMSA route density (AIS), annual, via EMODnet: red = busiest lanes": "EMSA rota yoğunluğu (AIS), yıllık, EMODnet üzerinden: kırmızı = en yoğun hatlar",
  "Polish transmission system (KSE)": "Polonya iletim sistemi (KSE)",
  "PSE 400 / 220 kV lines and substations, interconnectors, SwePol HVDC": "PSE 400 / 220 kV hatları ve trafo merkezleri, enterkonnektörler, SwePol HVDC",
};

export default liveData;
