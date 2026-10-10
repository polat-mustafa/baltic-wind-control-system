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

  // ── Screening map: traffic and the national grid ──
  "Ship traffic density 2025": "Gemi trafiği yoğunluğu 2025",
  "EMSA route density (AIS), annual, via EMODnet: red = busiest lanes": "EMSA rota yoğunluğu (AIS), yıllık, EMODnet üzerinden: kırmızı = en yoğun hatlar",
  "Polish transmission system (KSE)": "Polonya iletim sistemi (KSE)",
  "PSE 400 / 220 kV lines and substations, interconnectors, SwePol HVDC": "PSE 400 / 220 kV hatları ve trafo merkezleri, enterkonnektörler, SwePol HVDC",
};

export default liveData;
