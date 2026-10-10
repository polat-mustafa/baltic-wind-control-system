/**
 * Site & Permits: screening legend and result, grid node choice, criteria
 * (backend site_assessment), data sources, survey and permit timelines
 * (components/site/journey.ts). Place and station names stay as {name}.
 */

const site: Record<string, string> = {
  // ── Screening map and result ──
  "Redraw site": "Sahayı yeniden çiz",
  "Draw site": "Sahayı çiz",
  Draw: "Çiz",
  Redraw: "Yeniden çiz",
  "— {label}": "— {label}",
  "no exclusion, good score": "dışlama yok, iyi puan",
  "allowed, weaker score": "izinli, daha zayıf puan",
  "no shading: allowed but low score": "gölgelendirme yok: izinli ama düşük puan",
  "no shading: the excluding layer shows": "gölgelendirme yok: dışlayan katman görünür",
  "reference case study layout": "referans vaka çalışması yerleşimi",
  "Outside the EEZ": "MEB dışında",
  Land: "Kara",
  "Outside the plan's energy basins": "Planın enerji havzaları dışında",
  "Territorial sea (12 nm)": "Karasuları (12 deniz mili)",
  "Shipping route": "Gemi trafik yolu",
  "Green means the open data raise no exclusion here, not that a permit is certain: fisheries, radar, aviation and cultural heritage are not in this screening.":
    "Yeşil, açık verilerin burada bir dışlama göstermediği anlamına gelir; iznin kesin olduğu anlamına gelmez: balıkçılık, radar, havacılık ve kültürel miras bu ön elemede yoktur.",
  "Polish law: no offshore wind in internal waters or the territorial sea": "Polonya hukuku: iç sularda ve karasularında açık deniz rüzgârı yasak",
  "Polish law: a location permit needs a basin where the maritime spatial plan allows wind":
    "Polonya hukuku: yer izni, deniz mekânsal planının rüzgâra izin verdiği bir havza gerektirir",
  "Not a legal ban: projects there need an appropriate assessment": "Yasal bir yasak değil: oradaki projeler uygun değerlendirme gerektirir",
  "Defence areas may be negotiable; dumpsites need UXO clearance": "Savunma alanları müzakere edilebilir; döküm sahaları patlamamış mühimmat temizliği gerektirir",
  "{n} km² suitable": "{n} km² uygun",
  "{n} km² marginal · {n2} km² excluded (≈ {n3} km cells).": "{n} km² sınırda · {n2} km² dışlanmış (≈ {n3} km hücreler).",
  "Thresholds marked illustrative in the API model card are teaching defaults.":
    "API model kartında açıklayıcı olarak işaretlenen eşikler öğretim amaçlı varsayılanlardır.",
  "No blocking issue; the points marked “Check” would become permit conditions (seabed and grid findings are design matters, not consent conditions).":
    "Engelleyici sorun yok; “Kontrol” olarak işaretlenen noktalar izin koşulu olur (deniz tabanı ve şebeke bulguları onay koşulu değil, tasarım konusudur).",
  "whole area usable": "alanın tamamı kullanılabilir",
  "Next stage": "Sonraki aşama",
  "Finish this stage first": "Önce bu aşamayı bitirin",

  // ── Seabed finding (backend assess._seabed_check): the class mix, then the hardest class ──
  "Mud to muddy sand": "Çamur – çamurlu kum",
  Sand: "Kum",
  "Coarse-grained sediment": "İri taneli sediman",
  "Mixed sediment": "Karışık sediman",
  "Rock and boulders": "Kaya ve iri bloklar",
  "{label} {n} %": "{label} %{n}",
  "{label} {n} %, {sed}": "{label} %{n}, {sed}",
  "{sed}: piles drive and cables bury.": "{sed}: kazıklar çakılır, kablolar gömülür.",
  "{sed}. Coarse-grained sediment: Dense gravel: high driving resistance, risk of pile refusal. Hard to bury: plough or trench instead of jetting; rock placement where shallow. A geotechnical survey decides.":
    "{sed}. İri taneli sediman: sıkı çakıl: yüksek çakma direnci, kazığın ilerlememe riski. Gömmesi zor: jet yerine pulluk ya da hendek; sığ yerlerde kaya dolgu. Kararı geoteknik etüt verir.",
  "{sed}. Mixed sediment: Gravel, sand and mud — in the Baltic often glacial till with boulders: boulder survey and clearance before piling. Boulders: pre-lay clearance (grab, plough) and more rock placement. A geotechnical survey decides.":
    "{sed}. Karışık sediman: çakıl, kum ve çamur — Baltık'ta çoğu zaman iri bloklu buzul tilli: kazık çakmadan önce blok taraması ve temizliği. Bloklar: döşeme öncesi temizlik (kepçe, pulluk) ve daha fazla kaya dolgu. Kararı geoteknik etüt verir.",
  "{sed}. Rock and boulders: Piles may not drive: drive-drill-drive or drilled and grouted piles. Cannot be buried: protect with rock placement or mattresses. A geotechnical survey decides.":
    "{sed}. Kaya ve iri bloklar: kazıklar çakılamayabilir: çak-del-çak ya da delinip harçlanan kazıklar. Gömülemez: kaya dolgu ya da beton şiltelerle koruyun. Kararı geoteknik etüt verir.",
  "no blocking issue": "engelleyici sorun yok",

  // ── Grid connection point ──
  "Nearest ({name}, {n} km)": "En yakın ({name}, {n} km)",
  "{name} · {n} km · {label}": "{name} · {n} km · {label}",
  existing: "mevcut",
  planned: "planlanan",
  "being commissioned": "devreye alınıyor",
  "{name} (planned), {n} km straight from the site centre; the export route is longer. Not in full service yet — {label}. The farm's connection date follows PSE's schedule.":
    "{name} (planlanan), saha merkezinden düz {n} km; iletim güzergâhı daha uzundur. Henüz tam hizmette değil — {label}. Santralin bağlantı tarihi PSE'nin takvimini izler.",
  "PSE investment: new 400 kV station Krzemienica (KZE), connection of the Bałtyk 1 offshore wind farm; permits obtained (inwestycje.pse.pl/stacjakrzemienica/)":
    "PSE yatırımı: yeni 400 kV Krzemienica (KZE) istasyonu, Bałtyk 1 açık deniz rüzgâr santralinin bağlantısı; izinler alındı (inwestycje.pse.pl/stacjakrzemienica/)",
  "Empty: an illustrative 10 000 MVA.": "Boş: açıklayıcı 10 000 MVA.",
  "{n} GVA in your project's grid studies.": "Projenizin şebeke çalışmalarında {n} GVA.",
  "Enter the value of the TSO's connection conditions (PSE publishes no per-node values); {n}–{n2} MVA, the upper bound being 63 kA at 400 kV.":
    "İletim sistemi operatörünün bağlantı koşullarındaki değeri girin (PSE düğüm başına değer yayımlamaz); {n}–{n2} MVA, üst sınır 400 kV'ta 63 kA.",

  // ── Screening findings: references (backend site_assessment) ──
  "UNCLOS Art. 3; case study rule: Polish OWFs only in the EEZ": "UNCLOS Md. 3; vaka çalışması kuralı: Polonya açık deniz rüzgâr santralleri yalnızca MEB'de",
  "Polish maritime spatial plan, Dz.U. 2021 poz. 935; Act on the maritime areas, Dz.U. 2024 poz. 1125, Art. 23 ust. 1 and Art. 27g ust. 1 pkt 1":
    "Polonya deniz mekânsal planı, Dz.U. 2021 poz. 935; Deniz alanları kanunu, Dz.U. 2024 poz. 1125, Md. 23 ust. 1 ve Md. 27g ust. 1 pkt 1",
  "EMODnet Human Activities 'windfarms'; OpenStreetMap outlines": "EMODnet Human Activities 'windfarms'; OpenStreetMap sınırları",
  "Habitats Directive 92/43/EEC, Art. 6(3)": "Habitatlar Direktifi 92/43/EEC, Md. 6(3)",
  "HELCOM munitions data via EMODnet": "EMODnet üzerinden HELCOM mühimmat verisi",
  "EMODnet Geology seabed substrate 1:250 000; DNV-RP-C212 (piles), DNV-RP-0360 (cable burial)":
    "EMODnet Geology deniz tabanı substratı 1:250 000; DNV-RP-C212 (kazıklar), DNV-RP-0360 (kablo gömme)",
  "EIA Directive 2011/92/EU (amended by 2014/52/EU), Annex II 3(i)": "ÇED Direktifi 2011/92/EU (2014/52/EU ile değişik), Ek II 3(i)",

  // ── Criteria (info panels) ──
  default: "varsayılan",
  kind: "tür",
  exclusion: "dışlama",
  true: "evet",
  false: "hayır",
  "Exclude the territorial sea": "Karasularını dışla",
  "Polish law: offshore wind farms are banned in internal waters and the territorial sea (Act on the maritime areas of the Republic of Poland and maritime administration, consolidated text Dz.U. 2024 poz. 1125, Art. 23 ust. 1a).":
    "Polonya hukuku: açık deniz rüzgâr santralleri iç sularda ve karasularında yasaktır (Polonya Cumhuriyeti deniz alanları ve deniz idaresi kanunu, konsolide metin Dz.U. 2024 poz. 1125, Md. 23 ust. 1a).",
  "Other Member States allow OWFs in the territorial sea; switch off for a generic study.":
    "Diğer üye devletler karasularında açık deniz rüzgâr santraline izin verir; genel bir çalışma için kapatın.",
  "Only inside the plan's energy basins": "Yalnızca planın enerji havzalarında",
  "Polish maritime spatial plan (Dz.U. 2021 poz. 935): offshore wind is a priority use only in the basins with an energy ('E') function. A location permit (PSZW) is granted for a defined sea area and is assessed first on consistency with the plan (Dz.U. 2024 poz. 1125, Art. 23 ust. 1 and Art. 27g ust. 1 pkt 1).":
    "Polonya deniz mekânsal planı (Dz.U. 2021 poz. 935): açık deniz rüzgârı yalnızca enerji ('E') işlevli havzalarda öncelikli kullanımdır. Yer izni (PSZW) tanımlı bir deniz alanı için verilir ve önce planla tutarlılığa göre değerlendirilir (Dz.U. 2024 poz. 1125, Md. 23 ust. 1 ve Md. 27g ust. 1 pkt 1).",
  "Screening simplification: the plan text and its basin rules decide, and every energy basin in Poland already has a permit holder. Switch off for a generic study.":
    "Ön eleme basitleştirmesi: plan metni ve havza kuralları belirleyicidir ve Polonya'daki her enerji havzasının zaten bir izin sahibi vardır. Genel bir çalışma için kapatın.",
  "Natura 2000 is not an automatic ban: projects there need an appropriate assessment (Habitats Directive 92/43/EEC, Art. 6(3)). Screening tools commonly exclude them.":
    "Natura 2000 otomatik bir yasak değildir: oradaki projeler uygun değerlendirme gerektirir (Habitatlar Direktifi 92/43/EEC, Md. 6(3)). Ön eleme araçları bunları genellikle dışlar.",
  "Military use may be negotiable with the defence ministry; dumped munitions call for UXO surveys and clearance before any seabed work.":
    "Askerî kullanım savunma bakanlığıyla müzakere edilebilir; dökülmüş mühimmat, her türlü deniz tabanı çalışmasından önce patlamamış mühimmat araştırması ve temizliği gerektirir.",
  "Buffer around subsea cables": "Denizaltı kabloları çevresinde tampon",
  "Crossing and proximity agreements with the cable owner set the real value.": "Gerçek değeri kablo sahibiyle yapılan geçiş ve yakınlık anlaşmaları belirler.",

  // ── Data & sources ──
  "{n} layers · {label}": "{n} katman · {label}",
  "Southern Baltic — Polish EEZ": "Güney Baltık — Polonya MEB",
  "retrieved {date}": "erişim {date}",
  "Licence: {title}": "Lisans: {title}",
  "Flanders Marine Institute (2026): MarineRegions.org, union of the 'eez', 'eez_12nm' and 'eez_internal_waters' layers in the region":
    "Flanders Deniz Enstitüsü (2026): MarineRegions.org, bölgedeki 'eez', 'eez_12nm' ve 'eez_internal_waters' katmanlarının birleşimi",
  "Flanders Marine Institute (2026): MarineRegions.org, Maritime Boundaries layer 'eez' (MRGID 5687)":
    "Flanders Deniz Enstitüsü (2026): MarineRegions.org, Deniz Sınırları katmanı 'eez' (MRGID 5687)",
  "Flanders Marine Institute (2026): MarineRegions.org, Maritime Boundaries layer 'eez_12nm' (MRGID 49028)":
    "Flanders Deniz Enstitüsü (2026): MarineRegions.org, Deniz Sınırları katmanı 'eez_12nm' (MRGID 49028)",
  "OpenStreetMap natural=coastline via Overpass, Świnoujście → Vistula Spit, simplified ≈ 100 m":
    "Overpass üzerinden OpenStreetMap natural=coastline, Świnoujście → Vistula Kumsalı, ≈ 100 m'ye sadeleştirilmiş",
  "OpenStreetMap submarine power/telecom cables and pipelines (Overpass), plus EMODnet Human Activities 'pipelines'":
    "OpenStreetMap denizaltı enerji/telekom kabloları ve boru hatları (Overpass), ayrıca EMODnet Human Activities 'pipelines'",
  "OpenStreetMap power=substation, voltage 400 kV, operator PSE (Overpass); planned stations as tagged in OSM — check PSE's development plan before relying on them":
    "OpenStreetMap power=substation, gerilim 400 kV, işletmeci PSE (Overpass); planlanan istasyonlar OSM'deki etiketlerine göre — bunlara güvenmeden önce PSE'nin geliştirme planını kontrol edin",
  "EEA Natura 2000 spatial data via EMODnet Human Activities 'natura2000areas' (marine and coastal sites)":
    "EMODnet Human Activities 'natura2000areas' üzerinden EEA Natura 2000 mekânsal verisi (deniz ve kıyı alanları)",
  "OpenStreetMap power=plant / construction:power=plant + plant:source=wind at sea (Overpass): the outlines mappers have drawn so far":
    "Denizde OpenStreetMap power=plant / construction:power=plant + plant:source=wind (Overpass): haritacıların şimdiye kadar çizdiği sınırlar",
  "EMODnet Human Activities 'windfarms' (status, capacity, year as reported)": "EMODnet Human Activities 'windfarms' (durum, kapasite, yıl bildirildiği gibi)",
  "Polish maritime spatial plan (Dz.U. 2021 poz. 935): basins with renewable energy as priority use ('E' function), via EMODnet Human Activities 'mspzoningpoly'":
    "Polonya deniz mekânsal planı (Dz.U. 2021 poz. 935): yenilenebilir enerjinin öncelikli kullanım olduğu havzalar ('E' işlevi), EMODnet Human Activities 'mspzoningpoly' üzerinden",
  "Maritime spatial plans (Poland: Dz.U. 2021 poz. 935): basins with 'maritime traffic flows' as priority use, via EMODnet Human Activities 'mspzoningpoly'":
    "Deniz mekânsal planları (Polonya: Dz.U. 2021 poz. 935): 'deniz trafik akışları'nın öncelikli kullanım olduğu havzalar, EMODnet Human Activities 'mspzoningpoly' üzerinden",
  "EMODnet Human Activities 'militaryareaspoly' and 'munitionspoly' (HELCOM dumpsites)":
    "EMODnet Human Activities 'militaryareaspoly' ve 'munitionspoly' (HELCOM döküm sahaları)",
  "EMODnet Digital Bathymetry, latest DTM (DTM 2024, doi:10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1), mean of the 1/16′ cells in 0.01° blocks":
    "EMODnet Sayısal Batimetri, en güncel DTM (DTM 2024, doi:10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1), 0,01° bloklardaki 1/16′ hücrelerin ortalaması",
  "NEWA Mesoscale Atlas wind_speed_mean 150 m (doi:10.11583/DTU.14414096.v1) and Microscale Atlas weib_k_combined 100/200 m, ln(z)-interpolated to 150 m; A = mean / Γ(1 + 1/k)":
    "NEWA Mezoölçek Atlası wind_speed_mean 150 m (doi:10.11583/DTU.14414096.v1) ve Mikroölçek Atlası weib_k_combined 100/200 m, 150 m'ye ln(z) ile enterpole; A = ortalama / Γ(1 + 1/k)",
  "ERA5 hourly 100 m wind direction 2020–2024 (Copernicus C3S) via the Open-Meteo archive API":
    "Open-Meteo arşiv API'si üzerinden ERA5 saatlik 100 m rüzgâr yönü 2020–2024 (Copernicus C3S)",
  "EMODnet Geology seabed substrate 1:250 000 (gtk:seabed_substrate_250k), Folk 5-class scheme; Polish waters from PGI-NRI, Geological Map of the Baltic Sea bottom 1:200 000 (Mojski ed., 1988–1995); data holders GEUS, GPDN, LGT, PGI-NRI, SGU, VSEGEI. Class at the centre of each 0.01° cell":
    "EMODnet Geology deniz tabanı substratı 1:250 000 (gtk:seabed_substrate_250k), Folk 5 sınıflı şema; Polonya suları PGI-NRI'dan, Baltık Denizi Tabanı Jeoloji Haritası 1:200 000 (Mojski ed., 1988–1995); veri sahipleri GEUS, GPDN, LGT, PGI-NRI, SGU, VSEGEI. Her 0,01° hücrenin merkezindeki sınıf",
  "Role: operators' and developers' announcements (see each port's basis); location: OpenStreetMap harbour / port areas (Overpass)":
    "Rol: işletmecilerin ve geliştiricilerin duyuruları (her limanın dayanağına bakın); konum: OpenStreetMap liman alanları (Overpass)",
  "OpenStreetMap power lines, prebuilt for PyPSA-Eur (Xiong et al. 2025, Zenodo 10.5281/zenodo.18619025, 2026-02-12) — ratings are typical values by conductor type, not the TSO's":
    "PyPSA-Eur için önceden hazırlanmış OpenStreetMap enerji hatları (Xiong vd. 2025, Zenodo 10.5281/zenodo.18619025, 2026-02-12) — anma değerleri iletken türüne göre tipik değerlerdir, iletim sistemi operatörünün değil",
  "CC BY 4.0 — Flanders Marine Institute (VLIZ), MarineRegions.org; no legal value": "CC BY 4.0 — Flanders Deniz Enstitüsü (VLIZ), MarineRegions.org; hukuki değeri yoktur",
  "ODbL 1.0 © OpenStreetMap contributors": "ODbL 1.0 © OpenStreetMap katkıda bulunanları",

  // ── Surveys and EIA baseline (journey.ts) ──
  "Before a design or a permit application, the site has to be measured: wind, seabed, soil and sea state. Surveys run in parallel; the longest is the wind campaign.":
    "Tasarımdan ya da izin başvurusundan önce saha ölçülmelidir: rüzgâr, deniz tabanı, zemin ve deniz durumu. Ölçümler paralel yürür; en uzunu rüzgâr kampanyasıdır.",
  "Month {n}": "Ay {n}",
  "month {n}": "ay {n}",
  "of {n} · {label}": "/ {n} · {label}",
  "surveys run in parallel": "ölçümler paralel yürür",
  "baseline surveys, all seasons": "temel araştırmalar, tüm mevsimler",
  "months after the application": "başvurudan sonraki aylar",
  "{n} months typical": "tipik {n} ay",
  "{name} · {label}": "{name} · {label}",
  "Survey technician": "Ölçüm teknisyeni",
  "Project engineer (developer)": "Proje mühendisi (geliştirici)",
  "Permitting authority (single contact point)": "İzin makamı (tek irtibat noktası)",
  "Environmental consultant": "Çevre danışmanı",
  "Fisheries representative": "Balıkçılık temsilcisi",
  "DNV-RP-C212 (offshore soil mechanics and geotechnical engineering)": "DNV-RP-C212 (açık deniz zemin mekaniği ve geoteknik mühendisliği)",
  "IEC 61400-3-1 (design requirements for fixed offshore wind turbines)": "IEC 61400-3-1 (sabit açık deniz rüzgâr türbinleri için tasarım gereksinimleri)",
  "A Natura 2000 site is {n} km away: screen for an appropriate assessment of effects on its conservation objectives. Under Article 6(3) of the Habitats Directive the authority may consent only once it is certain the site's integrity is not adversely affected.":
    "Bir Natura 2000 alanı {n} km uzakta: koruma hedeflerine etkileri için uygun değerlendirme ön elemesi yapın. Habitatlar Direktifi Madde 6(3) uyarınca yetkili makam ancak alanın bütünlüğünün olumsuz etkilenmediğinden emin olduğunda onay verebilir.",
  "The environmental impact assessment (EIA) needs baseline data from every season. Marine life is checked here: birds, porpoises and seals, fish and the seabed.":
    "Çevresel etki değerlendirmesi (ÇED) her mevsimden temel veri gerektirir. Deniz yaşamı burada incelenir: kuşlar, domuz balıkları ve foklar, balıklar ve deniz tabanı.",
  "Aerial digital surveys and ship-based counts across all seasons; radar for night-time migration.":
    "Tüm mevsimlerde havadan sayısal araştırmalar ve gemiden sayımlar; gece göçü için radar.",
  "Collision risk and displacement of seabirds are central EIA questions in the Baltic.":
    "Deniz kuşlarının çarpma riski ve yer değiştirmesi Baltık'ta ÇED'in temel sorularıdır.",
  "Southern Baltic offshore banks hold internationally important numbers of wintering sea ducks: survey the winter well.":
    "Güney Baltık'taki açık deniz sığlıkları uluslararası öneme sahip sayıda kışlayan deniz ördeğini barındırır: kışı iyi araştırın.",
  "Passive acoustic monitoring (click detectors) for harbour porpoise; seal tracking where relevant.":
    "Mutur için pasif akustik izleme (klik dedektörleri); gerektiğinde fok izleme.",
  "The Baltic Proper harbour porpoise population is critically endangered; pile-driving noise can injure or displace it.":
    "Merkezî Baltık mutur popülasyonu kritik tehlike altındadır; kazık çakma gürültüsü onları yaralayabilir ya da yerinden edebilir.",
  "Plan noise mitigation from the start: some countries set hard limits, e.g. Germany 160 dB SEL at 750 m.":
    "Gürültü azaltımını baştan planlayın: bazı ülkeler katı sınırlar koyar, ör. Almanya 750 m'de 160 dB SEL.",
  "Grab samples, video transects and habitat mapping over the site and the cable route.":
    "Saha ve kablo güzergâhı boyunca kepçe numuneleri, video hatları ve habitat haritalama.",
  "Sandbanks (habitat 1110) and reefs (1170) are protected habitat types under the Habitats Directive; the screening's Natura 2000 check shows whether a designated site lies near yours.":
    "Kum sığlıkları (habitat 1110) ve resifler (1170) Habitatlar Direktifi kapsamında korunan habitat türleridir; ön elemedeki Natura 2000 kontrolü, belirlenmiş bir alanın sizinkine yakın olup olmadığını gösterir.",
  "Survey trawls and fishing-effort data; talk to the fishers who use the area.":
    "Araştırma trolleri ve balıkçılık çabası verileri; alanı kullanan balıkçılarla konuşun.",
  "Safety zones close fishing grounds; early agreement avoids objections in the consultation.":
    "Güvenlik bölgeleri balıkçılık sahalarını kapatır; erken anlaşma, istişarede itirazları önler.",

  // ── Permit procedure (journey.ts) ──
  "“{label}”": "“{label}”",
  waiting: "bekliyor",
  "in progress": "sürüyor",
  "Ms Nowicka": "Bayan Nowicka",
  "Dr Karin Lind": "Dr. Karin Lind",
  Marek: "Marek",
  "One application to the single contact point covers all permits, including the grid connection.":
    "Tek irtibat noktasına yapılan tek başvuru, şebeke bağlantısı dahil tüm izinleri kapsar.",
  "RED III Art. 16(1), 16(3)": "RED III Md. 16(1), 16(3)",
  "The authority must confirm completeness within 45 days (30 days in a renewables acceleration area).":
    "Yetkili makam eksiksizliği 45 gün içinde onaylamalıdır (yenilenebilir hızlandırma alanında 30 gün).",
  "RED III Art. 16(2)": "RED III Md. 16(2)",
  "All environmental assessments run as one combined procedure.": "Tüm çevresel değerlendirmeler tek bir birleşik prosedür olarak yürür.",
  "EIA Directive Art. 5(2); RED III Art. 16b(2)": "ÇED Direktifi Md. 5(2); RED III Md. 16b(2)",
  "Built on at least a full year of baseline surveys, so every season is covered.":
    "En az bir tam yıllık temel araştırmaya dayanır; böylece her mevsim kapsanır.",
  "EIA Directive Art. 5(1), Annex IV": "ÇED Direktifi Md. 5(1), Ek IV",
  "The public concerned gets at least 30 days to comment on the EIA report.": "İlgili halk, ÇED raporu hakkında görüş bildirmek için en az 30 gün alır.",
  "EIA Directive Art. 6(7)": "ÇED Direktifi Md. 6(7)",
  "Consent is only possible once the authority is certain the site's integrity is not adversely affected.":
    "Onay ancak yetkili makam alanın bütünlüğünün olumsuz etkilenmediğinden emin olduğunda mümkündür.",
  "Habitats Directive Art. 6(3)": "Habitatlar Direktifi Md. 6(3)",
  "Offshore projects: at most 3 years from completeness (2 years in acceleration areas), +6 months in extraordinary circumstances.":
    "Açık deniz projeleri: eksiksizlikten itibaren en çok 3 yıl (hızlandırma alanlarında 2 yıl), olağanüstü durumlarda +6 ay.",
  "RED III Art. 16a(1), 16b(1)": "RED III Md. 16a(1), 16b(1)",
  "Here is our application: site outline, project description and the screening report.":
    "İşte başvurumuz: saha sınırı, proje tanımı ve ön eleme raporu.",
  "Your application is complete. From today the permit-granting clock is running.":
    "Başvurunuz eksiksiz. Bugünden itibaren izin verme süresi işliyor.",
  "The authority's scoping opinion fixes what the EIA report must cover. It will not be widened later.":
    "Yetkili makamın kapsam belirleme görüşü ÇED raporunun neyi kapsaması gerektiğini sabitler. Sonradan genişletilmez.",
  "The EIA report covers birds, marine mammals, fish, seabed habitats, noise, shipping and landscape.":
    "ÇED raporu kuşları, deniz memelilerini, balıkları, deniz tabanı habitatlarını, gürültüyü, gemiciliği ve peyzajı kapsar.",
  "Our trawlers fish this bank. We want a say on safety zones and compensation.":
    "Trol teknelerimiz bu sığlıkta avlanıyor. Güvenlik bölgeleri ve tazminat konusunda söz hakkı istiyoruz.",
  "With noise mitigation during piling, the project does not harm the integrity of the nearby Natura 2000 site.":
    "Kazık çakma sırasında gürültü azaltımıyla proje, yakındaki Natura 2000 alanının bütünlüğüne zarar vermez.",
  "Consent is granted, subject to the conditions in the decision.":
    "Karardaki koşullara bağlı olarak onay verildi.",
};

export default site;
