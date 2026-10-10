/** Turkish: Turbine physics, Construction, Commissioning, Hand-over, SCADA and Control Room — on-screen text. */
export default {
  // Turbine physics
  "IEA {n1} MW reference turbine (IEA-{n2}-{n3}-RWT)": "IEA {n1} MW referans türbini (IEA-{n2}-{n3}-RWT)",
  "cut-in {n1} / rated {n2} / cut-out {n3} m/s": "devreye girme {n1} / anma {n2} / devreden çıkma {n3} m/s",
  "Low speed, Direct drive": "Düşük hız, doğrudan tahrik",
  rpm: "dev/dk",
  deg: "derece",
  "Electrical Power": "Elektriksel güç",
  "Aero Power": "Aerodinamik güç",
  "Rated (15 MW)": "Anma (15 MW)",
  "Wind Speed [m/s]": "Rüzgâr hızı [m/s]",
  "Rotor Speed": "Rotor hızı",
  "Pitch Angle": "Kanat açısı",
  "Overspeed trip ({n})": "Aşırı hız açması ({n})",
  "Rated ({n})": "Anma ({n})",
  "Pitch Angle [deg]": "Kanat açısı [derece]",
  "Cp_max = {n1} at λ = {n2} | Betz limit = {n3} ({n4}/{n5})": "λ = {n2}'de Cp_maks = {n1} | Betz sınırı = {n3} ({n4}/{n5})",
  "Yaw Deadband (±8°)": "Yönelme ölü bandı (±8°)",
  "Yaw Error": "Yönelme hatası",
  "Yaw Error [deg]": "Yönelme hatası [derece]",

  // Construction
  "Install the offshore substation, foundations, cables and turbines in Baltic weather windows. Every operation waits for sea states below its limit; the campaign is run over {n} weather years to give P10 / P50 / P90 dates and the vessel bill.":
    "Açık deniz trafo merkezini, temelleri, kabloları ve türbinleri Baltık hava pencerelerinde kurun. Her operasyon deniz durumunun sınırının altına inmesini bekler; P10 / P50 / P90 tarihlerini ve gemi faturasını vermek için kampanya {n} hava yılı üzerinden çalıştırılır.",
  "SB-510 reference farm": "SB-510 referans santrali",
  "Array strings": "Dizi hatları",
  "jackets (> 40 m)": "ceketler (> 40 m)",
  "Installation port": "Kurulum limanı",
  "Rønne (DK), {n} km by sea": "Rønne (DK), deniz yoluyla {n} km",
  "O&M port": "İ&B limanı",
  "Ustka, {n} km by sea": "Ustka, deniz yoluyla {n} km",
  "{verb} vessel operational limits (illustrative)": "{verb}: gemi işletme sınırları (örnek amaçlı)",
  Edit: "Düzenle",
  Hide: "Gizle",
  "Simulate the campaign": "Kampanyayı benzet",
  "Start dates matter more than vessel speed: a campaign that runs into the Baltic winter waits weeks for every window. Plan on P90, not on the median, when you fix a grid connection date.":
    "Başlangıç tarihleri gemi hızından daha önemlidir: Baltık kışına giren bir kampanya her pencere için haftalarca bekler. Şebeke bağlantı tarihini sabitlerken medyana değil P90'a göre planlayın.",

  // Commissioning
  "HV Commissioning": "YG Devreye Alma",
  "Isolation EN 50110-1": "Yalıtım EN 50110-1",
  "First energisation of export circuit {n1} of SB-{n2}: cable {n3} from shore, the OSS {n4} kV busbar with reactor {n5} and the STATCOM, TX-OSS-{n6} {n7} kV section A and strings {n8}–{n9} ({n10} × {n11} MW = {n12} MW). Section B (circuit {n13}) stays isolated and earthed.":
    "SB-{n2} iletim devresi {n1}'in ilk enerjilendirmesi: karadan kablo {n3}, reaktör {n5} ve STATCOM ile OSS {n4} kV barası, TX-OSS-{n6} {n7} kV A bölümü ve {n8}–{n9} dizileri ({n10} × {n11} MW = {n12} MW). B bölümü (devre {n13}) yalıtılmış ve topraklı kalır.",
  "Turbines producing (≥)": "Üreten türbinler (≥)",
  "Turbines at 15 MW (of 76)": "15 MW'taki türbinler (76'dan)",
  ". First power": ". İlk güç",
  "at least": "en az",
  "of 76 turbines have produced at once (daily peak ÷ 15 MW). Each step up is a string energised and its turbines commissioned — the real-world version of a switching programme.":
    "/ 76 türbin aynı anda üretti (günlük tepe ÷ 15 MW). Her basamak, enerjilendirilen bir dizi ve devreye alınan türbinleridir — bir manevra programının gerçek dünyadaki karşılığı.",

  // Hand-over
  "The SB-510 farm it already shows.": "Zaten gösterdiği SB-510 santrali.",
  "The live simulation runs the farm the project modules model.": "Canlı benzetim, proje modüllerinin modellediği santrali çalıştırır.",
  "Commissioning (P5)": "Devreye Alma (P5)",
  "Energisation order: export cable → OSS → {n1} kV busbar → {n2} feeder bays, one string at a time (list below).":
    "Enerjilendirme sırası: iletim kablosu → OSS → {n1} kV bara → {n2} fider hücresi, her seferinde bir dizi (aşağıdaki liste).",
  "The switching programme is written for circuit 1 of the SB-510 export system; the export-system steps are the same for your farm.":
    "Manevra programı SB-510 iletim sisteminin devre 1'i için yazılmıştır; iletim sistemi adımları sizin santraliniz için de aynıdır.",
  "Bay list BAY-OSS-{n1}-{n2} … BAY-OSS-{n3}-{n4} for the substation single-line diagram.":
    "Trafo merkezi tek hat şeması için hücre listesi BAY-OSS-{n1}-{n2} … BAY-OSS-{n3}-{n4}.",
  "The control room runs your switchboard: single-line diagram, bay controllers and interlocks, mimic and alarms.":
    "Kontrol odası dağıtım panonuzu yönetir: tek hat şeması, hücre kontrolcüleri ve kilitlemeler, mimik ve alarmlar.",
  "The turbine register (ids, positions, strings) as the asset list, exported as JSON or CSV.":
    "Varlık listesi olarak türbin kaydı (kimlikler, konumlar, diziler), JSON veya CSV olarak dışa aktarılır.",
  "The twin's reference model is calibrated on the 34 SB-510 turbines; a new farm would need its own commissioning baseline.":
    "İkizin referans modeli 34 SB-510 türbini üzerinde kalibre edilmiştir; yeni bir santral kendi devreye alma referansına ihtiyaç duyar.",
  "BAY-OSS-{n1}-{n2}: remove the string earth, close the feeder, connect {n3} turbines ({n4} MW).":
    "BAY-OSS-{n1}-{n2}: dizi topraklamasını kaldır, fideri kapat, {n3} türbini bağla ({n4} MW).",
  "Condensed from the P5 switching programme (S-001 … S-030); practise it in the Academy energisation mission.":
    "P5 manevra programından özetlenmiştir (S-001 … S-030); Akademi enerjilendirme görevinde pratik yapın.",
  "As-built register — SB-{n} reference farm": "Yapıldığı gibi kaydı — SB-{n} referans santrali",
  "{n1} × {n2} MW (IEA-{n3}-{n4}-RWT) = {n5} MW · {n6} array strings at {n7} kV · export {n8} km at {n9} kV · jacket foundations · printed {n10}-{n11}-{n12}":
    "{n1} × {n2} MW (IEA-{n3}-{n4}-RWT) = {n5} MW · {n7} kV'ta {n6} dizi · {n9} kV'ta {n8} km iletim · ceket temeller · basım {n10}-{n11}-{n12}",
  "Array cable {n1} km: {n2} mm² {n3} km, {n4} mm² {n5} km, {n6} mm² {n7} km.": "Dizi kablosu {n1} km: {n2} mm² {n3} km, {n4} mm² {n5} km, {n6} mm² {n7} km.",
  "A hand-over is a list of open items as much as a register: punch-list items, missing test certificates and unresolved cable crossings move to the operator with the keys.":
    "Devir, bir kayıt olduğu kadar açık işler listesidir: eksik iş kalemleri, eksik test sertifikaları ve çözülmemiş kablo geçişleri anahtarlarla birlikte işletmeciye geçer.",

  // SCADA
  "Delivered at the PSE {n1} kV connection point. Generation {n2} MW − losses {n3} MW": "PSE {n1} kV bağlantı noktasında teslim. Üretim {n2} MW − kayıplar {n3} MW",
  "load flow · pandapower": "yük akışı · pandapower",
  "Network values from the backend Newton-Raphson load flow (refreshed every 10 s)": "Backend Newton-Raphson yük akışından şebeke değerleri (her 10 sn'de yenilenir)",
  "Hide simulation controls": "Benzetim kontrollerini gizle",
  "Inject a protection fault": "Koruma arızası enjekte et",
  "Auto-sim": "Otomatik benzetim",
  "Auto-simulation": "Otomatik benzetim",
  "Control room mode": "Kontrol odası modu",
  "SCADA backend unreachable": "SCADA backend'ine ulaşılamıyor",

  // Control room
  'SB-{n1} reference · {n2} × {n3} MW "V236 class" (IEA-{n4}-{n5}-RWT model) = {n6} MW · Polish Baltic Sea · live simulation':
    'SB-{n1} referansı · {n2} × {n3} MW "V236 sınıfı" (IEA-{n4}-{n5}-RWT modeli) = {n6} MW · Polonya Baltık Denizi · canlı benzetim',
  "Wind Farm Overview — Real-Time Status Map": "Santral genel bakışı — gerçek zamanlı durum haritası",
  "Wind Farm Overview": "Santral genel bakışı",
  "from {n1}° · gust {n2}": "{n1}°'den · hamle {n2}",
  "STATCOM set-point from the pandapower load flow (backend)": "pandapower yük akışından STATCOM ayar noktası (backend)",
  "STATCOM · load flow": "STATCOM · yük akışı",
  "time-based, IEC 61400-26": "zamana dayalı, IEC 61400-26",
  "pandapower Newton-Raphson: {n1} MW / {n2} MVAr at PSE {n3} kV · V_OSS {n4} pu": "pandapower Newton-Raphson: PSE {n3} kV'ta {n1} MW / {n2} MVAr · V_OSS {n4} pu",
  "export cable {n} %": "iletim kablosu %{n}",
  alarms: "alarm",
  "all clear": "her şey normal",
  "from {n}°": "{n}°'den",
  sim: "benzetim",
  "Time-compressed simulation": "Zaman sıkıştırmalı benzetim",
  live: "canlı",
  "Live site weather from Open-Meteo (ICON/IFS + marine)": "Open-Meteo'dan canlı saha havası (ICON/IFS + deniz)",
  "Bft {n} — {desc}": "Bft {n} — {desc}",
  Calm: "Durgun",
  "Light air": "Esinti",
  "Light breeze": "Hafif rüzgâr",
  "Gentle breeze": "Tatlı rüzgâr",
  "Moderate breeze": "Orta rüzgâr",
  "Fresh breeze": "Sert rüzgâr",
  "Strong breeze": "Kuvvetli rüzgâr",
  "Near gale": "Fırtınamsı",
  Gale: "Fırtına",
  "Strong gale": "Kuvvetli fırtına",
  Storm: "Tam fırtına",
  "Violent storm": "Şiddetli fırtına",
  Hurricane: "Kasırga",
  Scenarios: "Senaryolar",
  "{id} · operating · {n} MW": "{id} · çalışıyor · {n} MW",
  "{id} · {state} · {n} MW": "{id} · {state} · {n} MW",
  operating: "çalışıyor",
  curtailed: "kısıtlı",
  fault: "arıza",
  offline: "devre dışı",
  maintenance: "bakımda",
} satisfies Record<string, string>;
