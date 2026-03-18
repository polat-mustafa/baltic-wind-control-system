# Chapter 4: The War of Currents: How Electricity Became the Language of Power

*Elif set her mug down — the one with the lightning bolt and "I* ♥ *REACTIVE POWER" — and leaned back in her chair. The SOV common room was quiet now. Most of the crew had gone to their cabins after dinner, and the only sound was the low thrum of the vessel's engines and the occasional clatter of someone in the galley loading a dishwasher.*

*"Two men," she said. "Thomas Edison and Nikola Tesla. Well — three men, really. George Westinghouse was the one with the money. But the story starts before any of them. It starts with a bookbinder's apprentice who never went to university."*

*Kaan pulled his chair closer to the table. He had expected a quick answer — something about transformers, maybe, or efficiency. Instead, Elif had the look of someone settling in for a long telling. He had seen that look on Anders earlier, on the CTV deck, when he had asked about the Danish schoolteacher. Engineers on offshore platforms, Kaan was learning, did not give short answers. They gave histories.*

*"Michael Faraday," Elif said. "Born in 1791, south London, son of a blacksmith. Left school at thirteen to work for a bookbinder. No formal education in science — none at all. But he read every book that came through the shop, especially the ones on chemistry and electricity. In 1813, when he was twenty-one, he talked his way into a job as a laboratory assistant at the Royal Institution. By 1831, he had made the discovery that every generator on every wind turbine out there" — she pointed toward the porthole, toward the dark sea and the thirty-four rotors turning in the night — "still depends on."*

*"What did he discover?" Kaan asked.*

*"That a changing magnetic field creates an electric current. It sounds simple. It changed the world."*

---

## 4.1 Faraday's Electromagnetic Induction

On August 29, 1831, in the basement laboratory of the Royal Institution on Albemarle Street, London, Michael Faraday wrapped two coils of insulated copper wire around opposite sides of a soft iron ring, approximately six inches in diameter. He connected one coil to a galvanometer — a sensitive current-measuring device — and touched the other coil's wires to a voltaic battery. The instant the circuit closed, the galvanometer needle flicked sideways, then returned to zero. When he broke the circuit, the needle flicked in the opposite direction, then settled again. [1]

No current flowed between the two coils — they were electrically isolated. Yet the galvanometer had detected something. Faraday realised that it was not the magnetic field itself that induced the current, but the *change* in the magnetic field. A steady field did nothing. A changing field — rising when the battery was connected, falling when it was disconnected — pushed electrons through the second coil.

Over the following weeks, Faraday explored the effect with obsessive thoroughness. On October 28, 1831, he achieved the result that would prove most consequential: he mounted a copper disc between the poles of a large permanent magnet and rotated the disc by hand. A steady current flowed from the disc's axle to its rim for as long as it turned. He had built the world's first electromagnetic generator — what he called a "new electrical machine." It was, in principle, a dynamo: mechanical motion in, electrical current out. Every generator in every power station, every wind turbine, and every hydroelectric dam on Earth operates on the same principle today. [2]

Faraday expressed his discovery as a law: the electromotive force (voltage) induced in a circuit is proportional to the rate at which the magnetic flux through the circuit changes. In modern notation:

$$
\mathcal{E} = -N \frac{d\Phi}{dt}
$$

where:
- $\mathcal{E}$ = induced electromotive force (EMF) [V]
- $N$ = number of turns in the coil [dimensionless]
- $\Phi$ = magnetic flux through one turn [Wb] (webers)
- $t$ = time [s]
- The negative sign indicates that the induced EMF opposes the change in flux (Lenz's law)

The physical meaning is direct: spin a coil inside a magnetic field (or spin a magnet inside a coil), and you get voltage. Spin it faster, get more voltage. Use more turns of wire, get more voltage. Use a stronger magnet, get more voltage. The formula is the blueprint for every electrical generator ever built — from Faraday's hand-cranked copper disc to the 15 MW machines sitting in the nacelles two hundred meters above the sea outside Kaan's porthole.

Faraday himself did not write the equation in this form — he was famously uncomfortable with mathematics and preferred to think in terms of "lines of force," the invisible field lines he imagined radiating from magnets and current-carrying wires. It was James Clerk Maxwell, thirty years later, who translated Faraday's physical intuition into the precise mathematical language that became Maxwell's equations — the foundation of all electrical engineering. [3]

But Faraday understood something that took his contemporaries decades to accept: magnetism and electricity were not separate phenomena. They were two aspects of the same force. Change one, and you create the other. This reciprocity — a changing magnetic field creates an electric field, and a changing electric field creates a magnetic field — is the reason that alternating current exists at all. Direct current flows in one direction, steady and unchanging. Alternating current surges back and forth, and in doing so, it creates the changing magnetic fields that make transformers work. That distinction, invisible in Faraday's iron ring experiment, would split the electrical world in two.

<!-- IMAGE: fig-04-01 -->
> **[Figure 4.1]** — Faraday's iron ring experiment and the principle of electromagnetic induction
> **Type:** Annotated diagram with historical illustration
> **Content:** Left: a reproduction of Faraday's original sketch from his laboratory notebook (dated August 29, 1831), showing the iron ring with two coils. Right: a clean modern diagram of the same experiment, with labels showing the battery, iron ring, primary coil (connected to battery), secondary coil (connected to galvanometer), and arrows indicating the direction of magnetic flux through the ring. Below both, a simplified diagram of a modern generator: a rotating magnet inside a stationary coil, with the output waveform (sinusoidal AC voltage) shown as a time-series plot. An annotation connects Faraday's ring to the generator: "Same principle — changing magnetic flux induces voltage."
> **Caption:** Faraday's iron ring experiment (1831) — the discovery that a changing magnetic field induces an electric current. The same principle, applied to a rotating magnet inside a coil, produces the alternating current that powers the modern grid.
> **Alt text:** Side-by-side comparison of Faraday's original iron ring sketch and a modern diagram of the same experiment, with a simplified generator diagram below showing how rotation produces alternating current.
> **Data source:** Faraday, M. (1832). "Experimental Researches in Electricity." *Philosophical Transactions of the Royal Society*; Author illustration for modern diagrams.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Historical sketch in sepia; modern diagrams in clean black with blue arrows for current flow and red arrows for magnetic flux.

## 4.2 Edison and the Empire of Direct Current

Fifty years passed between Faraday's copper disc and the moment his discovery became a business. The person who built that business was not a scientist. He was a self-educated former telegraph operator from Milan, Ohio, with an extraordinary talent for turning laboratory results into commercial products.

Thomas Alva Edison did not invent the electric light — he improved it, systematised it, and wrapped it in a business model. By 1879, after testing thousands of filament materials at his laboratory in Menlo Park, New Jersey, Edison had produced an incandescent lamp that glowed steadily for over 1,200 hours, long enough to be commercially viable. But the lamp was only the beginning. Edison understood that a light bulb without a power supply was a curiosity. What the world needed was a *system*: generators, wires, switches, meters, and a central station to tie them all together. [4]

On September 4, 1882, at three o'clock in the afternoon, Edison's chief electrician threw the switch at **Pearl Street Station** in lower Manhattan. Six **"Jumbo" dynamos** — each weighing twenty-seven tonnes and rated at approximately 100 kW — began feeding direct current through fourteen miles of underground copper conductors to eighty-five customers, illuminating roughly four hundred incandescent lamps in offices and shops within a one-square-mile area around Wall Street. It was the first permanent, commercial central power station in the world. [5]

Within a year, Pearl Street served 513 customers and 10,164 lamps. The system ran at **110 volts DC** — a choice Edison made deliberately, because it was low enough to be relatively safe if a person touched an exposed conductor, yet high enough to produce useful light from his carbon-filament lamps. [6]

But 110 volts created a problem that Edison spent years trying to solve and never could: **voltage drop**.

When current flows through a wire, the wire's resistance converts some of the electrical energy into heat. The power lost in the wire is governed by a formula that every electrical engineer learns on the first day:

$$
P_{loss} = I^2 \cdot R
$$

where:
- $P_{loss}$ = power dissipated as heat in the conductor [W]
- $I$ = current flowing through the conductor [A]
- $R$ = resistance of the conductor [$\Omega$]

The resistance of a copper conductor increases with length and decreases with cross-sectional area:

$$
R = \rho \cdot \frac{L}{A}
$$

where:
- $R$ = resistance [$\Omega$]
- $\rho$ = resistivity of the conductor material [$\Omega \cdot \text{m}$] (for copper at 20°C, $\rho = 1.68 \times 10^{-8}$ $\Omega \cdot \text{m}$)
- $L$ = length of the conductor [m]
- $A$ = cross-sectional area of the conductor [m²]

To deliver 100 kW at 110 V, you need a current of $I = P/V = 100{,}000/110 = 909$ A. At those currents, even short runs of copper wire dissipate enormous amounts of heat. Edison's solution was to use massive copper conductors — his Pearl Street mains weighed hundreds of pounds per hundred feet — and to keep the transmission distance short. The first district covered approximately one square mile, with the station at its centre. Customers more than about a mile away could not be served, because the voltage at the end of the line would have sagged below usable levels. [7]

The economics were punishing. Pearl Street Station did not turn a profit for five years. The cost of copper alone — thick enough to carry hundreds of amperes over even modest distances — consumed the revenue from electricity sales. Edison's response was not to change the system but to replicate it: build more stations, each serving a small district. By 1887, Edison and his licensees had installed 121 DC power stations across the United States. [8]

It was a brute-force approach, and it worked — as long as your customers lived within a mile of a generator. For cities, this was expensive but feasible. For suburbs, towns, and rural areas, it was impossible. The countryside would remain dark unless someone found a way to send electricity farther, with less copper, and with less loss.

The answer existed. It had existed since 1831. It just needed a transformer.

## 4.3 The Transformer: The Device That Made Distance Possible

The transformer is a deceptively simple device: two coils of wire wrapped around a shared iron core. There are no moving parts, no electronics, no software. A transformer built in 1885 and a transformer built in 2025 operate on exactly the same principle.

When an alternating current flows through the **primary coil**, it creates a changing magnetic field in the iron core. That changing field — Faraday's discovery — induces a voltage in the **secondary coil**. The ratio of the two voltages is determined by the ratio of the number of turns in each coil:

$$
\frac{V_1}{V_2} = \frac{N_1}{N_2}
$$

where:
- $V_1$ = voltage across the primary coil [V]
- $V_2$ = voltage across the secondary coil [V]
- $N_1$ = number of turns in the primary coil [dimensionless]
- $N_2$ = number of turns in the secondary coil [dimensionless]

If the secondary coil has ten times as many turns as the primary, the output voltage is ten times the input voltage. A **step-up transformer**. If the secondary has fewer turns, the output voltage is lower: a **step-down transformer**. In an ideal transformer, power is conserved — the product of voltage and current on one side equals the product on the other:

$$
V_1 \cdot I_1 = V_2 \cdot I_2
$$

This equation contains the entire economic argument for high-voltage transmission. If you step up the voltage by a factor of ten, the current drops by a factor of ten. Since transmission losses are proportional to $I^2$, reducing the current by ten reduces the losses by a hundred. The same power can be sent over the same wire with one percent of the heat loss — or, equivalently, over a hundred times the distance with the same loss.

The practical transformer emerged from a rapid sequence of innovations in the 1880s. In 1882, the French engineer **Lucien Gaulard** and the English businessman **John Dixon Gibbs** demonstrated an open-core "secondary generator" in London, and in 1884 they exhibited an improved version at the International Exposition in Turin, Italy, where it powered an electric lighting system. Their device worked, but its open magnetic core made it inefficient and unable to regulate voltage reliably. [9]

The breakthrough came from Budapest. In the autumn of 1884, three Hungarian engineers working at the Ganz factory — **Károly Zipernowsky**, **Ottó Bláthy**, and **Miksa Déri** (collectively known as the **ZBD** team) — designed a transformer with a **closed magnetic core**. The closed core channeled all the magnetic flux through both coils, eliminating the stray flux that plagued open-core designs. The ZBD transformers were 3.4 times more efficient than Gaulard and Gibbs's devices, and they could be connected in **parallel** rather than in series — a crucial advance for practical distribution networks, where each customer needed an independent supply. In their 1885 patent application, ZBD described both the "core form" and "shell form" transformer constructions that remain the two basic designs in use worldwide today. They also coined the word *transformer*. [10]

The transformer solved the distance problem — but only for alternating current. A DC voltage cannot be stepped up or down by a transformer, because direct current creates a *steady* magnetic field, and Faraday's law requires a *changing* field to induce voltage. This was the fundamental asymmetry that made the War of Currents inevitable: AC could use transformers to transmit power efficiently over long distances. DC could not. Edison's system worked brilliantly within a one-mile radius of a power station, but it could never reach beyond it without prohibitive quantities of copper.

## 4.4 Tesla, Westinghouse, and the Polyphase Revolution

If the transformer solved the problem of distance, it created a new one: how to build an AC motor.

In the 1880s, electric motors ran on direct current. They used a mechanical device called a **commutator** — a rotating switch on the motor shaft that reversed the current direction in the rotor coils at precisely the right moment to keep the rotor spinning. Commutators worked, but they were maintenance-intensive: the carbon brushes that made contact with the spinning commutator wore down, sparked, and required regular replacement. In dusty or explosive environments, the sparking was dangerous. Edison's entire system — generators, transmission, motors, lighting — ran on DC, and the commutator was its Achilles' heel. [11]

The person who eliminated it was a Serbian-American inventor named **Nikola Tesla**.

Tesla arrived in New York in 1884 with four cents in his pocket and a letter of introduction to Edison. He worked briefly at Edison's company, where a disagreement over promised compensation led to his departure — one of the most consequential personality clashes in the history of technology. [12]

In his own laboratory on Liberty Street in Manhattan, Tesla developed the concept that would make commutators obsolete: the **rotating magnetic field**. Instead of mechanically switching the current in the rotor, Tesla fed two or more alternating currents — offset in phase — into separate sets of stator coils arranged around the motor's circumference. The overlapping, phase-shifted fields created a magnetic field that *rotated* smoothly around the stator, dragging the rotor with it. No brushes. No commutator. No sparks. The rotor turned because the magnetic field turned, and the magnetic field turned because the alternating currents were out of phase with each other. [13]

In November and December of 1887, Tesla filed seven U.S. patent applications covering a complete **polyphase** AC system: generators, transformers, transmission lines, motors, and lighting. All seven patents issued on **May 1, 1888**. His key patent, No. 381,968, described the polyphase AC induction motor — the brushless, self-starting motor that would become the workhorse of industrial civilisation. [14]

On May 16, 1888, Tesla presented his work to the American Institute of Electrical Engineers (now IEEE) in a lecture titled "A New System of Alternate Current Motors and Transformers." The audience included engineers from every major electrical company in America. The implications were immediately clear: Tesla's system could do everything Edison's system could do, plus transmit power over long distances using transformers, plus run motors without commutators. [15]

One person in the audience understood the commercial potential faster than anyone else: **George Westinghouse**.

Westinghouse was not an electrical engineer — he was an industrialist who had made his fortune inventing the air brake for railway trains. But he had been investing in AC power systems since 1886, when he licensed the Gaulard-Gibbs transformer patents for the American market and began building AC lighting systems. He lacked one critical piece: a practical AC motor. Tesla had it. [16]

In July 1888, Westinghouse licensed Tesla's polyphase patents for **$60,000** in cash and stock, plus a royalty of **$2.50 per AC horsepower** produced by each motor. Tesla spent a year working at the Westinghouse laboratories in Pittsburgh, helping adapt his motor designs for commercial production. [17]

Edison's response was not to improve his own system. It was to prove that the alternative was lethal.

In the summer of 1888, an electrical engineer named **Harold P. Brown** — working with equipment and laboratory space provided by Edison — began a series of public demonstrations in which animals were killed using high-voltage alternating current. Dogs were electrocuted before audiences of journalists and members of the Medico-Legal Society of New York. In later demonstrations, calves and a horse were killed. The purpose was explicit: to associate alternating current with death in the public mind. [18]

The campaign culminated in the **electric chair**. Brown was hired by New York State to design an execution device, and he deliberately chose Westinghouse AC generators to power it. On **August 6, 1890**, William Kemmler became the first person executed by electrocution, at Auburn Prison in New York. The execution was botched — the first jolt failed to kill Kemmler, and a second, longer application was required. Westinghouse reportedly said, "They would have done better using an axe." [19]

Edison's smear campaign was technically sophisticated and morally repugnant. It was also futile. The physics of power transmission did not care about public relations. AC could reach customers fifty miles from a generator. DC could not. No amount of electrocuted dogs could change the transformer equation.

<!-- IMAGE: fig-04-02 -->
> **[Figure 4.2]** — DC vs. AC power transmission: the distance problem
> **Type:** Comparative schematic diagram
> **Content:** Two parallel diagrams showing power delivery from a 100 kW generator to customers at increasing distances (0.5 mile, 1 mile, 2 miles, 5 miles, 10 miles). Top diagram: Edison's DC system at 110 V, showing voltage at the customer dropping progressively (105 V, 95 V, 70 V, unserviceable, unserviceable) with thick copper conductors drawn to relative scale. Bottom diagram: AC system with a step-up transformer at the generator (110 V → 11,000 V), thin transmission wires, and step-down transformers at each customer location, showing voltage remaining stable (~108 V at all distances). The copper conductor cross-sections are drawn to scale to illustrate the dramatic difference in material requirements.
> **Caption:** The fundamental advantage of AC power: transformers. Edison's DC system (top) suffered crippling voltage drop beyond one mile, requiring massive copper conductors. An AC system (bottom) uses transformers to step voltage up for transmission and down for delivery, reducing current and losses by orders of magnitude. The copper savings alone determined the outcome of the War of Currents.
> **Alt text:** Two diagrams comparing DC and AC power transmission over distance, showing voltage drops in the DC system and stable voltage in the AC system using transformers, with copper conductor sizes drawn to scale.
> **Data source:** Author illustration based on Edison's Pearl Street specifications and standard AC distribution principles.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** DC system in amber/gold; AC system in blue. Red text for voltage drop warnings. Copper conductors in realistic copper brown, drawn to relative cross-sectional scale.

## 4.5 Chicago, Niagara, and the End of the War

The War of Currents was decided not by argument but by demonstration — two demonstrations, five hundred miles apart, that proved AC power could do what DC could not.

The first was the **World's Columbian Exposition** of 1893, a vast fair built on the Lake Michigan shoreline in Chicago to celebrate the four-hundredth anniversary of Columbus's arrival in the Americas. The fair's organisers wanted electric lighting on a scale never before attempted — an entire temporary city, illuminated after dark, visible for miles.

Edison's General Electric Company bid **$554,000** to light the fair using DC. George Westinghouse, armed with Tesla's patents and a factory full of AC generators, bid **$399,000**. Westinghouse won. [20]

Six months before the fair opened, Edison won a patent dispute over the one-piece incandescent lamp, and Westinghouse was forbidden from using Edison's bulb design. Westinghouse's engineers scrambled to develop an alternative — a double-stopper lamp based on the earlier Sawyer-Man patent that did not infringe Edison's design. They produced 250,000 of them in time for opening day. [21]

On May 1, 1893, President Grover Cleveland pressed a single button, and **100,000 incandescent lamps** blazed to life across the fairgrounds. Twelve 1,000-horsepower Westinghouse AC polyphase generators powered the installation. Twenty-seven million visitors — roughly a third of the American population at the time — walked through a city lit entirely by alternating current. Tesla himself was present, demonstrating phosphorescent lighting (an ancestor of the fluorescent tube) and wireless energy transmission in the Electricity Building, passing high-frequency AC through his own body to light lamps he held in his hands. [22]

The fair was spectacle. The project that followed was infrastructure.

In 1893, the **International Niagara Commission** — chaired by Lord Kelvin, who had initially favoured DC — awarded the contract for the Niagara Falls hydroelectric power plant to Westinghouse Electric. The plant, located at the base of the falls on the American side, would harness the energy of 100,000 cubic feet of water per second falling 167 feet — the largest concentration of hydraulic energy in the industrialised world. [23]

The plant's specifications were formidable. Westinghouse installed ten generators, each rated at **5,000 horsepower (3.7 MW)**, based on Tesla's polyphase designs and engineered by **Benjamin G. Lamme**, Westinghouse's chief engineer. The generators produced **two-phase AC at 2,200 V and 25 Hz** — a frequency chosen to match existing Westinghouse equipment, and one that would persist in parts of the American railway system for over a century. [24]

The first generator began operating on **August 26, 1895**. Initially, power was delivered locally at 2,200 V to electrochemical plants near the falls. But the true test came on **November 16, 1896**, when power from Niagara was transmitted **twenty-six miles** to the city of Buffalo, New York, using step-up transformers that raised the voltage to **11,000 V** for the transmission line. Buffalo's streetlights came on. The crowd cheered. [25]

Twenty-six miles. Edison's Pearl Street Station could barely manage one.

The War of Currents was over. Within a decade, virtually every new power station in the world was built for alternating current. Edison himself tacitly conceded defeat: in 1892, his Edison General Electric Company merged with the Thomson-Houston Electric Company — an AC pioneer — to form **General Electric**, and Edison's name was removed from the company. He turned his attention to other ventures and never worked seriously in power systems again. [26]

<!-- IMAGE: fig-04-03 -->
> **[Figure 4.3]** — The 1893 World's Columbian Exposition and Niagara Falls power plant
> **Type:** Historical photographs with annotation
> **Content:** Top: a panoramic photograph of the World's Columbian Exposition at night, showing the illuminated Court of Honor and its basin, with the Electricity Building visible. Annotation: "100,000 incandescent lamps, powered by 12 Westinghouse AC generators." Bottom: a photograph of the interior of the Niagara Falls Powerhouse No. 1, showing the massive vertical-shaft generators disappearing into the floor, with workers visible for scale. Annotation: "10 generators × 5,000 HP each, two-phase AC at 2,200 V, transmitted 26 miles to Buffalo at 11,000 V." Between the two photographs, a simple map showing the 26-mile transmission line from Niagara Falls to Buffalo, with voltage annotations (2,200 V at generator → 11,000 V at transmission → stepped down for distribution).
> **Caption:** The two demonstrations that ended the War of Currents. Top: the 1893 World's Columbian Exposition in Chicago, lit by Westinghouse AC power — the largest electrical installation in the world at that time. Bottom: the Niagara Falls hydroelectric plant (1895), whose power was transmitted 26 miles to Buffalo in 1896, proving that AC could deliver electricity over distances Edison's DC system could never reach.
> **Alt text:** Night photograph of the illuminated 1893 Chicago World's Fair above a photograph of massive generators inside the Niagara Falls powerhouse, with a map showing the 26-mile transmission line to Buffalo.
> **Data source:** Smithsonian Institution archives; Adams Power Plant historical records; Author illustration for transmission map.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Historical photographs in sepia/black-and-white. Map in clean blue (transmission line), gold (generator location), and green (Buffalo distribution area).

## 4.6 Ferranti and the Deptford Vision

The American narrative of AC versus DC — Edison against Tesla, Westinghouse against General Electric — dominates most tellings of the War of Currents. But the first person to build a high-voltage AC power station and transmit electricity over a significant distance was not American. He was a twenty-five-year-old engineer in London named **Sebastian Ziani de Ferranti**.

Ferranti, born in Liverpool in 1864 to an Italian father and English mother, was a prodigy who had designed and sold his first dynamo at age sixteen. By 1886, he was the chief electrician of the Grosvenor Gallery power station in London's West End — a small DC station that supplied electric lighting to nearby shops and theatres. When the London Electric Supply Corporation was formed to provide electricity on a larger scale, Ferranti was appointed its chief engineer. He was twenty-three years old. [27]

Ferranti's plan was audacious. Instead of building small generating stations scattered across London — the Edison model — he proposed a single, enormous generating station at **Deptford**, on the south bank of the Thames, approximately **seven miles** from the customers in central London. The station would generate **single-phase alternating current at 2,500 V**, step it up to **10,000 V** using transformers, transmit it through underground cables to substations in central London, and step it down for local distribution. [28]

When the Deptford station began supplying power in **November 1889**, it was unprecedented. No one had transmitted electricity at 10,000 V through underground cables over such a distance. The generators — two Ferranti alternators, each driven by a 1,500-horsepower Hick, Hargreaves reciprocating steam engine — fed current through cables laid alongside the London and Greenwich Railway line. The cables were Ferranti's own design: concentric conductors insulated with waxed paper, a construction that anticipated modern high-voltage cable technology by decades. [29]

By 1891, the station was fully operational and supplying electricity to a substation at Trafalgar Square — a 10 kV to 2.5 kV step-down point that served the West End. It was the first truly modern power station: centralised generation, high-voltage AC transmission, transformer-based distribution. The basic architecture remains the standard for power grids worldwide. [30]

Ferranti also discovered — the hard way — a phenomenon that would become critically important for offshore wind farms more than a century later. When the long underground cables between Deptford and central London carried little or no load, the voltage at the receiving end rose *above* the sending-end voltage. This counterintuitive effect — voltage increasing along an unloaded cable — became known as the **Ferranti effect**. It is caused by the capacitance of the cable: a long cable acts as a capacitor, and when unloaded, the capacitive charging current flowing through the cable's inductance creates a voltage rise. [31]

The Ferranti effect is a manageable nuisance for short cables. For the 45-kilometre submarine export cable of a modern offshore wind farm, it is a serious engineering problem that requires reactive power compensation — the very reason that offshore substations carry STATCOMs and shunt reactors. That story belongs to Chapter 20. But it began in 1891, with Ferranti's cables under the railway tracks of southeast London.

<!-- IMAGE: fig-04-04 -->
> **[Figure 4.4]** — Ferranti's Deptford Power Station and the first high-voltage AC transmission
> **Type:** Map with historical photograph and schematic
> **Content:** A map of London showing the Thames, with Deptford marked on the south bank and the Grosvenor Gallery / West End area marked in central London. A line traces the ~7-mile cable route alongside the London and Greenwich Railway. An inset historical photograph shows Ferranti's alternator. Below the map, a simplified single-line diagram of the Deptford system: generator (2,500 V) → step-up transformer (10,000 V) → underground cable (7 miles) → step-down transformer (2,500 V) → local distribution. An annotation notes "Voltage at receiving end > sending end when unloaded — the Ferranti effect."
> **Caption:** Sebastian de Ferranti's Deptford Power Station (1889–1891) — the first high-voltage AC power station, transmitting at 10,000 V over seven miles of underground cable to central London. Ferranti's discovery that unloaded cables exhibit voltage rise (the Ferranti effect) remains a critical design consideration for modern submarine cables.
> **Alt text:** Map of London showing the cable route from Deptford power station to the West End, with inset photograph of a Ferranti alternator and a single-line diagram of the transmission system.
> **Data source:** Science Museum Group Collection; Graces Guide; De Ferranti Heritage Trust; Author illustration.
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** Map in muted period-appropriate tones; cable route in blue; Deptford station in red; West End distribution area in gold. Single-line diagram in standard electrical engineering colours.

## 4.7 Why AC Won — and Why It Matters for Wind

The War of Currents is often told as a story about personalities — Edison's stubbornness, Tesla's genius, Westinghouse's business acumen. But the outcome was determined by physics, not character.

Alternating current won because of the transformer. The transformer allows voltage to be stepped up for transmission (reducing current and therefore losses) and stepped down for safe delivery to homes and factories. Direct current, in the 1890s, could not be economically transformed to higher voltages. The equation that sealed Edison's fate was the same one that Faraday had implied sixty years earlier:

$$
\frac{V_1}{V_2} = \frac{N_1}{N_2}
$$

Every modern power grid operates on the architecture that Ferranti pioneered at Deptford: centralised generation → step-up to high voltage → long-distance transmission → step-down to medium voltage → local distribution → step-down to consumer voltage. The numbers have grown — transmission voltages today reach 400 kV, 500 kV, even 1,100 kV in China — but the principle is unchanged.

For offshore wind, the stakes are even higher. A wind farm sits in the sea, typically 20 to 100 kilometres from shore. The electricity it generates must travel through expensive submarine cables to reach the onshore grid. Every ampere of current flowing through those cables generates heat, and heat in a submarine cable is costly — it degrades the insulation, limits the cable's capacity, and wastes the energy that the turbines worked to capture.

A modern offshore wind farm generates electricity at the turbine level at relatively low voltage — typically **690 V** at the generator terminals, stepped up to **66 kV** by a transformer inside the turbine tower. The 66 kV array cables carry the power to an **offshore substation (OSS)**, where a large transformer steps the voltage up to **220 kV** (or higher) for the export cable to shore. At the onshore substation, the voltage is stepped up again to **400 kV** for connection to the national transmission grid. [32]

Each step-up reduces the current and the losses. Without transformers — without alternating current — offshore wind farms would be physically impossible. The cables would need to be so thick, and the losses so enormous, that no amount of wind could make the economics work.

There is an irony in this. Edison's direct current, banished from the power grid in the 1890s, is making a quiet comeback. Modern **high-voltage direct current (HVDC)** transmission uses power electronics — thyristors and insulated-gate bipolar transistors (IGBTs) — to convert AC to DC for long-distance transmission, then back to AC at the receiving end. HVDC eliminates the reactive power losses and cable charging effects that plague long AC cables, making it the preferred technology for submarine interconnectors and very long onshore transmission lines. Several offshore wind farms, particularly in the German North Sea, already use HVDC export systems. But HVDC is a child of the semiconductor age — it was not available to Edison, Tesla, or Ferranti. In the 1890s, the transformer was the only tool for the job, and the transformer worked only with AC. [33]

## 4.X Worked Example: Transmission Losses — DC at 110 V vs. AC at 220 kV

A generic 500 MW offshore wind farm is connected to shore by a 45-kilometre submarine cable. Let us compare the transmission losses under two scenarios: Edison's 110 V DC system, and a modern 220 kV AC system.

**Assumptions:**
- Power to transmit: $P = 500$ MW = $500 \times 10^6$ W
- Cable length: $L = 45$ km = $45{,}000$ m (each way, so total conductor length = $90{,}000$ m for a two-conductor circuit)
- Conductor: copper, resistivity $\rho = 1.68 \times 10^{-8}$ $\Omega \cdot \text{m}$
- Conductor cross-sectional area: $A = 1{,}000$ mm² = $1 \times 10^{-3}$ m² (a large but standard submarine cable conductor)

**Step 1: Cable resistance.**

$$
R = \rho \cdot \frac{L_{total}}{A} = 1.68 \times 10^{-8} \times \frac{90{,}000}{1 \times 10^{-3}} = 1.512 \text{ } \Omega
$$

**Step 2: Edison's DC system at 110 V.**

$$
I_{DC} = \frac{P}{V} = \frac{500 \times 10^6}{110} = 4{,}545{,}455 \text{ A}
$$

$$
P_{loss,DC} = I_{DC}^2 \cdot R = (4.545 \times 10^6)^2 \times 1.512 = 3.12 \times 10^{13} \text{ W} = 31{,}200{,}000 \text{ MW}
$$

The losses exceed the transmitted power by a factor of more than sixty thousand. The cable would vaporise. This is obviously absurd — which is exactly the point. Edison's 110 V system cannot transmit 500 MW over 45 kilometres. It cannot transmit 500 MW over 45 *metres*.

**Step 3: Modern AC system at 220 kV (three-phase).**

For a three-phase AC system, the current is:

$$
I_{AC} = \frac{P}{\sqrt{3} \cdot V \cdot \cos\varphi}
$$

where:
- $I_{AC}$ = line current [A]
- $P$ = total three-phase power [W]
- $V$ = line-to-line voltage [V]
- $\cos\varphi$ = power factor [dimensionless] (assume 0.95)

$$
I_{AC} = \frac{500 \times 10^6}{\sqrt{3} \times 220{,}000 \times 0.95} = \frac{500 \times 10^6}{361{,}870} = 1{,}382 \text{ A}
$$

$$
P_{loss,AC} = 3 \times I_{AC}^2 \times R_{per\text{-}phase}
$$

For three-phase, $R_{per\text{-}phase} = \rho \cdot L / A = 1.68 \times 10^{-8} \times 45{,}000 / (1 \times 10^{-3}) = 0.756$ $\Omega$ per phase:

$$
P_{loss,AC} = 3 \times (1{,}382)^2 \times 0.756 = 3 \times 1{,}909{,}924 \times 0.756 = 4.33 \text{ MW}
$$

**Step 4: Compare.**

| Parameter | Edison DC (110 V) | Modern AC (220 kV) |
|-----------|------------------|-------------------|
| Current | 4,545,455 A | 1,382 A |
| Cable losses | 31,200,000 MW | 4.33 MW |
| Loss as % of power | >6,000,000% | 0.87% |
| Feasible? | No | Yes |

The voltage ratio is $220{,}000 / 110 = 2{,}000$. The current ratio is the inverse: $1/2{,}000$. The loss ratio is the square of the current ratio: $1/4{,}000{,}000$. That single number — four million — is why alternating current and transformers are not optional for offshore wind. They are the physics that makes it possible.

## Key Takeaways

- **Faraday's law of electromagnetic induction is the foundation of all electrical generation.** A changing magnetic field induces a voltage: $\mathcal{E} = -N \cdot d\Phi/dt$. Every generator in every wind turbine operates on this principle, discovered in 1831 by a self-taught bookbinder's apprentice.

- **Edison built the first commercial power system, but DC could not scale beyond a mile.** Pearl Street Station (1882) delivered 110 V DC to eighty-five customers within one square mile. Voltage drop and copper costs made longer distances economically impossible.

- **The transformer — made possible only by alternating current — solved the distance problem.** Step up voltage, reduce current, cut losses by the square of the voltage ratio. The ZBD team's 1885 closed-core transformer made practical AC distribution possible.

- **Tesla's polyphase AC motor eliminated the last technical advantage of DC.** His 1888 patents for the rotating magnetic field and induction motor gave AC a complete system: generation, transmission, transformation, and motor drive — all without commutators.

- **AC won because of physics, not personality.** The transformer equation $V_1/V_2 = N_1/N_2$ meant AC could reach customers fifty miles from a generator. Ferranti proved it at Deptford in 1891. Niagara Falls proved it at scale in 1896. Modern offshore wind farms, transmitting 500 MW over 45 km of submarine cable, are the ultimate vindication.

## For Further Reading

- **Jonnes, J. (2003).** *Empires of Light: Edison, Tesla, Westinghouse, and the Race to Electrify the World.* Random House. A meticulously researched narrative history of the War of Currents, covering the technical, financial, and personal dimensions with equal depth. The definitive popular account — essential for understanding why personality and business strategy mattered as much as physics.

- **Hughes, T.P. (1983).** *Networks of Power: Electrification in Western Society, 1880–1930.* Johns Hopkins University Press. The foundational academic study of how electrical systems were built, comparing the American, British, and German experiences. Hughes coined the concept of "technological momentum" — the idea that large technical systems develop their own inertia and resist change — which explains why Edison's DC persisted long after AC had won the argument.

- **Seifer, M.J. (1996).** *Wizard: The Life and Times of Nikola Tesla.* Citadel Press. The most comprehensive biography of Tesla, drawing on primary sources including Tesla's own patents, letters, and lecture transcripts. Avoids the hagiography that mars many Tesla biographies while giving full credit to his contributions to polyphase AC.

*Elif had been talking for nearly an hour. The coffee in Kaan's mug had gone cold. The common room was empty now except for the two of them and the hum of the ship.*

*"So that's why," Elif said. "That's why every cable on this platform, every transformer in the substation, every connection to the grid on shore — all of it is alternating current. Because a bookbinder's apprentice discovered that a changing magnetic field makes electricity, and a hundred years of engineers figured out how to use that fact to move power across oceans."*

*Kaan looked at his tablet. He had been taking notes — a habit from university that he had never broken — and the screen was covered in half-formed diagrams and scribbled equations. Faraday's law. The transformer ratio. Tesla's rotating field. He understood the logic, the chain of discoveries that led from an iron ring in a London basement to the 220 kV cable running under the sea to shore. What he did not yet understand was the machinery itself. The turbines outside the porthole were not abstractions. They were physical objects — steel and copper and composite, bolted together, rotating in salt wind, converting motion to electricity. How?*

*"You're thinking about the turbines," Elif said, reading his expression. She stood up and rinsed her mug at the galley sink. "Good. Tomorrow morning, Anders is taking you up."*

*"Up where?"*

*"Inside one. To the base of the tower. Maybe the nacelle, if the weather holds." She paused at the doorway. "You've spent two days learning history — wind before machines, electricity before cables. Tomorrow you see the machine. A hundred and fifteen metres of carbon fibre, turning at the tip at three hundred kilometres per hour." She smiled. "Try to sleep."*

*Kaan turned off his tablet and walked to his cabin. Through the porthole, the nearest turbine was a dark silhouette against a sky thick with stars. Its blades were still turning — slow, steady, unhurried. He watched them for a long time.*

*In eight hours, he would be standing at the base of one of those towers, looking up.*

---

## Notes

[1] Faraday, M. (1832). "Experimental Researches in Electricity." *Philosophical Transactions of the Royal Society of London*, 122, 125–162. Faraday's iron ring experiment of August 29, 1831, demonstrated mutual induction: a transient current appeared in the secondary coil when the primary circuit was connected or disconnected.

[2] American Physical Society (APS), APS News, August 2001. "September 4, 1821 and August 29, 1831: Faraday and Electromagnetism." Faraday's copper disc experiment (October 28, 1831) produced a continuous current by rotating a disc between magnet poles — the first electromagnetic generator.

[3] Royal Society Publishing (2015). "The birth of the electric machines: a commentary on Faraday (1832) 'Experimental researches in electricity.'" *Philosophical Transactions A*, 373(2039). Maxwell's mathematical formulation of Faraday's physical insights created the unified theory of electromagnetism.

[4] Edison Tech Center. "Edison's Electric Light and Power System." Edison's carbon-filament incandescent lamp (1879) was the centrepiece of a complete electrical system — generation, distribution, switching, and metering — designed as an integrated commercial product.

[5] Engineering and Technology History Wiki (ETHW). "Milestones: Pearl Street Station, 1882." The station began commercial operation at 3:00 PM on September 4, 1882, with six Jumbo dynamos supplying 110 V DC to 85 customers and approximately 400 lamps within a one-square-mile first district.

[6] ETHW. "Pearl Street Station." Within one year, Pearl Street served 513 customers and 10,164 lamps. The station operated continuously from September 4, 1882, to January 2, 1890, with only one three-hour interruption.

[7] Edison Tech Center. "Early New York City Power Plants." Edison's DC system required massive copper conductors and was limited to approximately one mile of transmission distance due to voltage drop at 110 V. Pearl Street did not turn a profit for its first five years.

[8] Engineering and Technology History Wiki. "Edison's Electric Light and Power System." By 1887, Edison and his licensees operated 121 DC central stations across the United States, each serving a small local district.

[9] Gaulard-Gibbs transformer: Graces Guide (gracesguide.co.uk). "Gaulard-Gibbs." Lucien Gaulard and John Dixon Gibbs demonstrated their open-core "secondary generator" in London (1882) and at the International Exposition in Turin, Italy (1884), powering an electric lighting system.

[10] Edison Tech Center. "History of Transformers." Zipernowsky, Bláthy, and Déri (ZBD) at the Ganz factory, Budapest, designed the first closed-core transformers (autumn 1884), which were 3.4 times more efficient than Gaulard-Gibbs devices. Their 1885 patent described both core-form and shell-form constructions. They coined the word "transformer."

[11] U.S. Department of Energy (2020). "The War of Currents: AC vs. DC Power." DC motors relied on mechanical commutators with carbon brushes that wore down, sparked, and required regular maintenance — a significant operational disadvantage.

[12] PBS. "Tesla — Master of Lightning: War of the Currents." Tesla arrived in New York in 1884 and worked briefly for Edison. The exact nature of the dispute over compensation remains debated, but Tesla left Edison's employ and eventually established his own laboratory.

[13] IEEE Spectrum, May 2011. "May 1888: Tesla Files His Patents for the Electric Motor." Tesla's rotating magnetic field concept used phase-shifted alternating currents in multiple stator coils to create a smoothly rotating magnetic field, eliminating the need for commutators.

[14] Sophia Rare Books. "Electro Magnetic Motor. Patent No. 381,968." Tesla filed seven patent applications in November–December 1887; all seven issued on May 1, 1888. Patent 381,968 covered the polyphase AC induction motor.

[15] Tesla, N. (1888). "A New System of Alternate Current Motors and Transformers." Lecture before the American Institute of Electrical Engineers (AIEE), May 16, 1888. Published in *AIEE Transactions*, 5, 308–324.

[16] Turbomachinery Magazine. "Story of Tesla and Westinghouse." Westinghouse had been developing AC power systems since 1886, licensing the Gaulard-Gibbs transformer patents. He lacked a practical AC motor — the gap Tesla's patents filled.

[17] Tesla Universe. "Year 1888: Tesla Sells AC Patents." Westinghouse licensed Tesla's polyphase patents in July 1888 for $60,000 in cash and stock plus $2.50 per AC horsepower. Tesla spent a year at the Westinghouse laboratories in Pittsburgh.

[18] Edison.rutgers.edu. "Myth Buster — Topsy the Elephant." Harold P. Brown conducted public electrocution demonstrations using AC current in 1888, with laboratory space and equipment provided by Edison. Dogs, calves, and a horse were killed to associate AC with danger.

[19] Beardy History (2023). "How Thomas Edison used the Electric Chair for publicity." William Kemmler was executed by electrocution on August 6, 1890, at Auburn Prison, New York, using Westinghouse AC generators. The botched execution required two jolts.

[20] Tesla Science Center at Wardenclyffe. "Columbian Exposition." General Electric bid $554,000; Westinghouse bid $399,000 and won the contract to light the 1893 World's Columbian Exposition in Chicago.

[21] Racingnelliebly.com. "Columbian Exposition: Electricity Transformed America." Edison's patent victory over the one-piece incandescent lamp forced Westinghouse to develop an alternative double-stopper bulb design based on the Sawyer-Man patent. Approximately 250,000 bulbs were produced for the fair.

[22] Tesla Society. "World's Columbian Exposition in Chicago 1893." President Cleveland activated 100,000 incandescent lamps on opening day (May 1, 1893). Twelve 1,000-hp Westinghouse AC generators powered the fair. Tesla demonstrated phosphorescent lighting and wireless energy transmission in the Electricity Building.

[23] PBS. "Tesla — Master of Lightning: Harnessing Niagara." The International Niagara Commission, chaired by Lord Kelvin, awarded the Niagara Falls power plant contract to Westinghouse Electric in 1893.

[24] Edison Tech Center. "Niagara Power Houses." Ten Westinghouse generators rated at 5,000 hp (3.7 MW) each, two-phase AC at 2,200 V, 25 Hz. Engineered by Benjamin G. Lamme.

[25] Tesla Society. "Tesla — Niagara Falls — Power of the Falls." The first Niagara generator began operating August 26, 1895. On November 16, 1896, power was transmitted 26 miles to Buffalo at 11,000 V.

[26] Kronecker Wallis. "The War of Currents: Tesla's AC vs. Edison's DC." Edison General Electric merged with Thomson-Houston Electric Company in 1892 to form General Electric. Edison's name was removed from the company; he ceased active involvement in power systems.

[27] Graces Guide. "Sebastian Ziani de Ferranti." Born in Liverpool, 1864. Designed and sold his first dynamo at age sixteen. Appointed chief electrician of the Grosvenor Gallery station; then chief engineer of the London Electric Supply Corporation at age twenty-three.

[28] De Ferranti Heritage Trust (deferranti.com). "From Grosvenor to Deptford." Ferranti proposed centralised generation at Deptford, ~7 miles from central London customers, transmitting single-phase AC at 10,000 V through underground cables.

[29] Graces Guide. "Deptford Generating Station." Initial generators: Ferranti alternators generating at 2,500 V, stepped up to 10,000 V for transmission. Two 10,000 V alternators driven by 1,500-hp Hick, Hargreaves steam engines installed in 1889. Cables laid alongside the London and Greenwich Railway.

[30] Engineering Timelines. "Deptford Power Station, site of." By 1891, the station supplied power to a 10 kV/2.5 kV substation at Trafalgar Square/Cockspur Street, London. The system established the centralised generation and transformer-based distribution architecture used worldwide today.

[31] Grokipedia. "Ferranti effect." The voltage rise on unloaded or lightly loaded long cables/transmission lines, caused by the cable's distributed capacitance. First observed at the Deptford-to-London cables. The effect is proportional to cable length and is particularly significant for submarine cables.

[32] DNV GL (2019). "Offshore Wind Electrical Connection Systems." Modern offshore wind farms typically use 66 kV array cables, an offshore substation transformer stepping up to 220 kV for the export cable, and an onshore transformer stepping up to 400 kV for grid connection.

[33] ABB (2014). "HVDC Light — It's time to connect." HVDC transmission using voltage source converters (VSCs) with IGBTs eliminates reactive power losses and cable charging current, making it the preferred technology for long submarine cable connections. Several German North Sea wind farms (e.g., BorWin, DolWin, HelWin clusters) use HVDC export systems.
