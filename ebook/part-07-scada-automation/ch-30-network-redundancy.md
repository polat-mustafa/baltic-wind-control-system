# Chapter 30: Network Redundancy: PRP, HSR, and Zero-Failover

*The comms room was one rack's width narrower than it needed to be.*

*Kaan noticed this the moment he stepped through the door: someone had clearly installed the second rack after the room was built, reducing the walkway from comfortable to precise. The racks stood floor-to-ceiling against the far wall, their faces covered in managed switches, fibre patch panels, and power distribution units. Every port was labelled in blue tape at three-centimetre intervals — port number, cable destination, installation date. The room hummed at a slightly different frequency from the rest of the OSS: not the deep vibration of the transformers or the faint whine of the STATCOM inverters, but the softer, more insistent sound of hundreds of cooling fans running at a fixed speed.*

*Hanna was standing beside one of the racks, talking to a woman who had a protocol analyser plugged into one of the patch panel's monitor ports. A laptop sat open on the cable-management shelf, running a capture window.*

*"Kaan," Hanna said. "This is Katrijn. She designed the network." She gestured briefly at the racks. "The switch question from yesterday — she answers it better than I do." She looked at her phone. "I have the FAT review at eight-thirty. The chapter is hers."*

*Katrijn van Loon — the name on her hi-vis vest — turned from the rack long enough to nod. She was Dutch, early forties, with the particular calm of someone who had spent two decades making industrial networks work in conditions designed to defeat them: oil platforms, smelters, offshore substations. On the cable-management shelf beside her laptop, a tablet showed a colour-coded topology diagram of the OSS's Ethernet infrastructure — blue nodes on one side, red nodes on the other, the two halves connected only at the devices themselves.*

*"I was going to run the failure test this morning anyway," she said. "You can watch."*

*She unplugged a single fibre from a switch labelled SW-PROT-A-02 — the second managed switch in the protection network's A-side path. She pointed at the protocol analyser screen.*

*The GOOSE frames continued without interruption. The timestamp counter advanced. The frame rate did not change. The sequence numbers continued incrementing.*

*Kaan waited for something to happen. Nothing did.*

*"That switch," Katrijn said, "is gone. The protection network does not know it is gone." She reinserted the fibre. "That is what zero-failover means. Not fifty milliseconds. Not five milliseconds. Zero." She tapped the capture screen. "Now ask me how."*

---

## 30.1 Why Zero-Millisecond Recovery Matters

The protection relay in Bay 3 depends on sampled value streams from its merging units arriving without interruption. If the stream stops — even for 20 milliseconds — the differential protection function transitions to its fail-safe condition: alarm, reduced sensitivity, or in some implementations a brief blocking of the trip function to prevent spurious operation based on stale data. The relay cannot distinguish whether the stream stopped because the CT secondary circuit failed, because the merging unit lost power, or because the Ethernet switch carrying the sampled value frames lost a fibre. What the relay knows is that the data has not arrived.

This is the fundamental tension of process-bus protection. The relay is engineered to respond within 3 milliseconds of detecting a fault. But the relay's protective functions cannot operate if they cannot see the current. Hanna's phrase from the previous session — "the communication network is an active component of the protection scheme" — was not rhetorical. It was a load-bearing engineering fact. And active components can fail.

**The Radia Perlman problem**

In September 1985, a software engineer at Digital Equipment Corporation named Radia Perlman presented an unusual paper at the ACM SIGCOMM symposium. The paper solved a specific problem: Ethernet was a broadcast medium, and connecting two Ethernet segments with more than one path caused frames to loop endlessly, consuming all available bandwidth. Perlman's spanning tree algorithm resolved the loops automatically by having bridges elect a root and prune redundant links.[^1]

The algorithm was elegant enough that Perlman introduced it with a poem:

> *I think that I shall never see*
> *A graph more lovely than a tree.*
> *A tree whose crucial property*
> *Is loop-free connectivity.*
> *A tree which must be sure to span*
> *So packets can reach every LAN.*
> *First the root must be selected*
> *By ID it is elected.*
> *Least cost paths from root are traced*
> *In the tree these paths are placed.*
> *A mesh is made by folks like me*
> *Then bridges find a spanning tree.*

The IEEE standardised the algorithm as 802.1D in 1990. For the next decade, spanning tree was the industry's answer to the question of what to do when an Ethernet switch failed: elect a new root, recalculate the tree, bring the formerly-blocked redundant port into service.

The problem was time. Classic STP required 30 to 50 seconds to reconverge, because Max Age and Forward Delay timers prevented premature topology changes. This was acceptable for office networks where a 50-second outage was inconvenient. It was unacceptable for substations where the grid did not wait.

The IEEE responded with 802.1w-2001, the Rapid Spanning Tree Protocol (RSTP). Where classic STP waited for timers, RSTP used a proposal-agreement handshake between adjacent bridges, allowing each port to transition through its states by explicit negotiation. In a well-designed topology with a small number of hops, RSTP could converge in under one second.[^2]

Measured against a 3-millisecond GOOSE delivery requirement, this was still completely unacceptable. The minimum reconvergence time — assuming the optimistic case of a single failed link and a straight-line topology — is bounded by the number of hops the proposal-agreement mechanism must traverse:

$$
T_{\text{RSTP}} \geq n_{\text{hops}} \times t_{\text{prop-agree}}
$$

where:
- $T_{\text{RSTP}}$ = RSTP reconvergence time after a single link failure [ms]
- $n_{\text{hops}}$ = number of bridge hops between the root bridge and the recovering port [-]
- $t_{\text{prop-agree}}$ = single proposal-agreement exchange time ≈ 15 ms for 100 Mbps links [ms]

For a protection network with six hops — not unusual in a fully-equipped OSS — the lower bound is $6 \times 15 = 90$ ms. This is thirty times slower than the GOOSE requirement.

"I spent three months trying to tune RSTP parameters," Katrijn said. "Reduced the Forward Delay timer, tightened bridge priority, tested in the lab with four switches and controlled traffic. I got it to 45 milliseconds." She looked at the Bay 3 GOOSE stream, steady and uninterrupted on the analyser screen. "Forty-five milliseconds is still fifteen times too slow for a trip signal."

The industry reached the same conclusion in the early 2000s. RSTP was acceptable for the station bus — where MMS responses arrive in 50–500 ms and a 45 ms recovery is invisible to the SCADA operator — but not for the process bus, where GOOSE and sampled value streams carry protection-grade timing requirements. A different approach was needed: not faster recovery, but no recovery at all.

---

## 30.2 PRP: Parallel Redundancy Protocol

The insight that drove PRP is simple enough to state in one sentence: send every frame twice, over two independent paths, and let the receiver take whichever arrives first.

This observation was developed into an engineered protocol in the early 2000s by Dr. Hubert Kirrmann and colleagues at ABB Corporate Research in Baden, Switzerland. Kirrmann had been involved in industrial communication standardisation for two decades and understood both the engineering requirements and the politics of IEC standards work. He called the approach "bumpless redundancy" — a name that captured the key property precisely. When one path fails, there is no bump, no recovery event, no detectable gap in service.[^3]

The approach was standardised as Part 3 of the IEC 62439 family, first published in February 2010.[^4] The standard is titled *Industrial communication networks — High availability automation networks — Part 3: Parallel Redundancy Protocol (PRP) and High-availability Seamless Redundancy (HSR)*, reflecting that two related protocols share a single document.

> **Standard reference:** IEC 62439-3:2021 (Edition 4), "Industrial communication networks — High availability automation networks — Part 3: Parallel Redundancy Protocol (PRP) and High-availability Seamless Redundancy (HSR)" — Clause 6 (PRP), Clause 7 (HSR). The duplicate discard algorithm is defined in Clause 6.4; the Redundancy Control Trailer format in Annex A. Edition 4 (2021) is the current normative version; earlier editions (2010, 2012, 2016) remain in the IEC archive for legacy systems.

**Architecture**

PRP requires two completely independent local area networks, designated LAN A and LAN B. The two networks are entirely separate: separate managed switches, separate cabling, independent power supplies, and — critically — independent physical cable routes through the building. LAN A and LAN B are not connected to each other at any point.

Each device that must tolerate network failures has two Ethernet ports, one connecting to LAN A and one to LAN B. Such a device is called a DANP: a Doubly Attached Node implementing PRP.

When a DANP sends a frame, it sends the identical frame on both ports simultaneously. The frame transmitted on LAN A reaches the destination via one set of switches and cables; the identical frame transmitted on LAN B reaches the same destination via a completely different set of switches and cables. Both frames carry the same payload, the same source and destination addresses, and the same sequence number embedded in a small trailer — the Redundancy Control Trailer (RCT) — appended to the standard Ethernet frame.

The destination DANP receives two copies. The first copy to arrive is passed to the application. When the second copy arrives, the DANP recognises the matching sequence number and silently discards it. From the application's perspective: one frame, delivered once, arriving at the minimum latency of the two paths.

$$
T_{\text{PRP}} = \min(T_A, \ T_B) = \min\!\left(N_A \cdot t_{\text{sw}} + \frac{L_A}{v_f}, \;\; N_B \cdot t_{\text{sw}} + \frac{L_B}{v_f}\right)
$$

where:
- $T_A$, $T_B$ = total frame delivery time via LAN A and LAN B respectively [μs]
- $N_A$, $N_B$ = number of managed switches in each path [-]
- $t_{\text{sw}}$ = store-and-forward switching delay per switch ≈ 5 μs [μs]
- $L_A$, $L_B$ = total fibre length of LAN A and LAN B paths [m]
- $v_f$ = propagation speed in single-mode fibre ≈ $2.0 \times 10^8$ m/s

For a typical OSS process bus with a 3-hop LAN A path and 50 m of fibre, $T_A \approx 3 \times 5 + 0.25 = 15.25\ \mu\text{s}$ — approximately 200 times faster than the 3 ms GOOSE requirement.

If LAN A's switch fails at $t = 0$, the frame that would have arrived via LAN A never arrives. The frame already on its way via LAN B is unaffected. The destination receives one frame — the LAN B copy — and does not receive a duplicate. From the application's perspective, nothing has changed. There is no recovery event because there is nothing to recover from.

**The reliability gain**

The probability that both LANs fail simultaneously — assuming statistically independent failure modes — is the product of the individual failure probabilities:

$$
P_{\text{fail,PRP}} = P_{\text{fail,A}} \times P_{\text{fail,B}}
$$

where:
- $P_{\text{fail,A}}$, $P_{\text{fail,B}}$ = probability of communication failure on each independent LAN path [-]

For a well-maintained managed-switch network, a typical path availability is 99.99% (four nines), corresponding to $P_{\text{fail}} = 10^{-4}$. With PRP:

$$
P_{\text{fail,PRP}} = 10^{-4} \times 10^{-4} = 10^{-8}
$$

Eight nines of availability. Expected annual downtime for a GOOSE stream on a PRP network:

$$
T_{\text{down,PRP}} = P_{\text{fail,PRP}} \times T_{\text{year}} = 10^{-8} \times 31{,}536{,}000 \ \text{s} \approx 0.32 \ \text{s/year}
$$

Compared with a single-LAN RSTP network: $T_{\text{down,RSTP}} = 10^{-4} \times 31{,}536{,}000 \approx 3{,}154 \ \text{s/year}$. PRP reduces expected communication downtime by a factor of ten thousand.

The independence assumption is doing most of this work — and it is only valid if the two physical cable routes are genuinely separate. Katrijn pointed to the two conduits running along the comms room ceiling, one blue and one red, entering the rack housing at different heights.

"In the Netherlands," she said, "we say: if you want to know where the dikes fail, ask the dikes engineer, not the water." She touched the blue conduit. "LAN A enters from the east cable entry point. LAN B enters from the west. A fire in the east tray does not touch LAN B. A flooding event in the west conduit does not touch LAN A." She looked at the patch panel. "Independence is not a software property. It is a physical one."

For devices with only a single Ethernet port — older protection relays, legacy metering units, some MU designs from before IEC 62439-3 was published — a RedBox (Redundancy Box) acts as a PRP proxy. The RedBox connects to both LAN A and LAN B and presents a single Ethernet port to the legacy device. Frames from the legacy device are duplicated and sent on both LANs; duplicates arriving from both LANs are resolved by the RedBox before forwarding to the legacy device. The legacy device participates in the redundant network without requiring hardware modification.

<!-- IMAGE: fig-30-01 -->
> **[Figure 30.1]** — PRP Network Architecture: Dual LAN with DANP and RedBox
> **Type:** Network architecture diagram
> **Content:** Two parallel LAN structures (LAN A: blue shading, LAN B: red shading) side by side with no connections between them. Each LAN has 3 managed switches in a mesh topology. Three DANP devices are shown straddling both LANs with dual-port connections — one Protection Relay DANP, one Bay Controller DANP, one Merging Unit DANP. On the right side, a RedBox has two connections (one to LAN A, one to LAN B) and a single Ethernet port to a Legacy Meter. The RCT trailer is shown as a small yellow tag appended to the Ethernet frame icon on both LANs. Blue and red arrows show the identical frame travelling simultaneously on both paths. Label at top: "Both LANs carry every frame simultaneously — first arrival wins, duplicate discarded."
> **Caption:** The PRP architecture. Every DANP transmits identical frames on LAN A and LAN B simultaneously. The first copy to arrive is delivered to the application; the duplicate is discarded by the sequence number in the Redundancy Control Trailer. A RedBox provides PRP participation for single-port legacy devices without hardware modification.
> **Alt text:** Network diagram showing two independent Ethernet LANs (A and B) connected by doubly-attached nodes with a RedBox for legacy single-port device access.
> **Data source:** Author illustration per IEC 62439-3:2021, Figure 2 (PRP network architecture).
> **Resolution:** 1400 × 800 px
> **Color notes:** LAN A in blue, LAN B in red, DANP nodes in purple (straddles both), RCT trailer in yellow, RedBox in green.

---

## 30.3 HSR: High-Availability Seamless Ring

PRP's requirement for two independent physical networks adds cost: two sets of managed switches, two cable runs, two maintenance contracts. For a large OSS with dozens of IEDs spread across multiple rooms, this trade-off is usually justified — the reliability gain is worth the investment. But for physically compact installations where all the devices in a network segment are close together and can be linked in a single line, a ring-based approach achieves the same zero-failover property with a simpler physical infrastructure.

HSR — High-availability Seamless Redundancy — was developed alongside PRP within IEC 62439-3, first published in February 2010, by a five-company consortium including Hirschmann, ABB, Siemens, Alstom, and RuggedCom, working within IEC SC65C Working Group 15. HSR applies the same duplicate-frame principle as PRP but distributes it across a single ring of devices rather than two separate LANs.[^5]

**Ring architecture**

In HSR, every device is connected in a closed ring. A DANH — Doubly Attached Node implementing HSR — has two ring ports. When it sends a frame, it sends the identical frame out both ring ports simultaneously, clockwise and anticlockwise around the ring. The clockwise copy reaches every node it passes. The anticlockwise copy reaches every node from the other direction.

Every node receives two copies. The first copy to arrive at the destination is delivered to the application; the second copy — arriving from the opposite direction — is discarded by the duplicate detection algorithm. If a node or link in the ring fails, the copy travelling through the failure never arrives. The copy travelling away from the failure reaches the destination unimpeded. No reconvergence. No recovery. Zero failover.

The worst-case latency through an HSR ring under a single-failure condition is bounded by the ring's physical size:

$$
T_{\text{HSR,max}} = (N - 1) \cdot t_{\text{sw}} + \frac{L_{\text{ring}}}{v_f}
$$

where:
- $N$ = number of DANH nodes in the ring [-]
- $t_{\text{sw}}$ = per-node switching delay ≈ 5 μs [μs]
- $L_{\text{ring}}$ = total circumference of the ring (all fibre segments combined) [m]
- $v_f$ = propagation speed in single-mode fibre ≈ $2.0 \times 10^8$ m/s

For a process-bus ring with 10 nodes and 200 m of total fibre — typical for the GIS hall of a 66 kV OSS:

$$
T_{\text{HSR,max}} = 9 \times 5 + \frac{200}{2.0 \times 10^8 \times 10^{-6}} = 45 + 1.0 = 46 \ \mu\text{s}
$$

The 3 ms GOOSE requirement is met with a 65-fold margin under worst-case single-failure conditions.

**PRP vs HSR: when to use each**

The choice between PRP and HSR is primarily driven by topology and cost:

| Property | PRP | HSR |
|----------|-----|-----|
| Physical infrastructure | Two separate LANs | Single ring |
| Cable runs | Higher (two routes) | Lower |
| Independent failure modes | Yes — separate physical routes | Partial — shared tray possible |
| Typical application | Station bus (IEDs spread across building) | Process bus (bays in one panel row) |
| Legacy device support | RedBox | RedBoxHSR |
| Node count scaling | Unlimited (flat switching) | Bounded by ring latency formula above |

The OSS in this project uses PRP for the station bus — the protection relays, bay controllers, SCADA servers, and engineering workstations are distributed across different rooms of the OSS building, and two genuinely independent cable routes are feasible. The process bus in the GIS hall, where the 12 merging units for each bay are mounted in a sequential row, uses HSR: a single fibre ring threaded through the bay panels, with no second cable run required.

A QuadBox — a device with four ports — bridges the two domains. It connects to the HSR ring (two ring ports) and to both PRP LANs (one port each), managing the duplicate-discard boundary between the HSR and PRP domains. A protection relay on the PRP station bus subscribes to sampled values from a merging unit on the HSR process bus; the QuadBox forwards the SV stream across the boundary while correctly handling the RCT and HSR frame headers so that neither domain receives spurious duplicates from the other.

<!-- IMAGE: fig-30-02 -->
> **[Figure 30.2]** — HSR Ring Connected to PRP Station Bus via QuadBox
> **Type:** Network architecture diagram
> **Content:** Left portion: HSR ring of 10 nodes (merging units, bay controllers labelled MU-1 through MU-8 and BC-1, BC-2) arranged in a closed circle. Each node has two ring ports. A failed node (MU-5) is shown in grey with an × through it. Blue clockwise arrows and red anticlockwise arrows show simultaneous bidirectional frame travel. The anticlockwise path around the failure continues to the destination. Upper right: a QuadBox with 4 ports — 2 ring ports in the HSR ring, and 2 ports connecting to PRP LAN A (blue) and LAN B (red). Right side: PRP station bus with 3 protection relay DANPs. Annotation: "QuadBox resolves duplicate-discard boundary between HSR and PRP domains."
> **Caption:** The HSR ring (process bus) connects to the PRP station bus through a QuadBox. Frames travel simultaneously in both directions around the ring. A single node failure blocks one direction; the frame travelling away from the failure continues unimpeded. The QuadBox bridges the two redundancy domains without introducing a single point of failure.
> **Alt text:** Diagram of an HSR ring with bidirectional frame transmission and a failed node, connected to a PRP dual-LAN architecture through a QuadBox.
> **Data source:** Author illustration per IEC 62439-3:2021, Figure 14 (HSR with QuadBox connection to PRP).
> **Resolution:** 1400 × 800 px
> **Color notes:** HSR clockwise arrows in blue, anticlockwise in red, failed node in grey, QuadBox in purple, PRP LAN A in blue, LAN B in red.

---

## 30.4 IEC 60870-5-104: The PSE Warsaw Window

The PRP and HSR networks handle communication inside the OSS. All of that traffic — GOOSE trip commands, sampled value streams, MMS configuration reads — lives on the local Ethernet networks within the building.

One communication channel runs in a different direction: from the OSS to the PSE National Dispatch Centre in Warsaw, 600 kilometres away. This channel carries operational state rather than protection-grade data: the farm's active power, reactive power, bus voltages, alarm summary, circuit breaker positions, and the PPC setpoints that PSE can command remotely when needed.

The protocol for this channel is IEC 60870-5-104, the last member of an IEC TC57 telecontrol family that traces back to the early 1990s.[^6]

The origin of IEC 60870-5 lies in a specific European problem. Through the 1980s, transmission operators had inherited a patchwork of proprietary SCADA communication systems. One manufacturer's remote terminal units could not be read by another manufacturer's control centre software without costly custom gateway engineering. IEC TC57 Working Group 3 responded by defining a common application-layer standard for telecontrol: a compact binary format called the Application Service Data Unit (ASDU), encoding a small vocabulary of information objects — single-point and double-point status, measured values with quality flags, timestamps, and control commands — in a form that any vendor could implement.

IEC 60870-5-101, published in 1995, ran this application layer over serial dedicated circuits: point-to-point links between the substation RTU and the utility control centre. As utilities migrated to IP-based wide area networks in the late 1990s, IEC TC57 produced the -104 variant: the identical -101 application layer, mapped directly onto TCP/IP.[^7] The ASDU format, the object type codes, and the cause-of-transmission encoding from -101 are preserved without modification. TCP port 2404 replaces the serial physical layer. Engineers with -101 RTU networks could upgrade to -104 by changing only the transport layer, retaining their existing object tables, engineering tools, and control centre configuration.

**How it works**

IEC 60870-5-104 is primarily event-driven. State changes — a circuit breaker opening, an alarm activating, a protection relay operating — are transmitted by the controlled station (the OSS) as spontaneous messages, without waiting to be polled. The controlling station (PSE Warsaw) receives protection-grade events with latency governed by network propagation, not by a polling cycle.

Measured values are reported on a configured cyclic basis. For this project, the cycle is 30 seconds for primary measurements (active power, reactive power, voltage) and 60 seconds for secondary metering values. General Interrogation (GI) — a full database resynchronisation — is sent by the control centre at connection startup and after communication restoration. GI is not run periodically; it is an exceptional operation. Running GI on a 500 MW farm requires transmitting approximately 1,400 ASDUs, occupying the link for several seconds.

The bandwidth requirement for steady-state cyclic measurement reporting is modest:

$$
B_{\text{cyclic}} = \frac{N_{\text{points}} \times S_{\text{ASDU}}}{T_{\text{cycle}}} = \frac{250 \times 18 \ \text{bytes}}{30 \ \text{s}} = 150 \ \text{bytes/s} = 1.2 \ \text{kbit/s}
$$

where:
- $N_{\text{points}}$ = number of measured analog values reported per cycle [-]
- $S_{\text{ASDU}}$ = size of a Type 13 (short floating-point) ASDU including transport headers ≈ 18 bytes
- $T_{\text{cycle}}$ = cyclic reporting interval [s]

A 1.2 kbit/s steady-state stream is negligible bandwidth. Even including spontaneous event reports and the occasional GI cycle, the farm's IEC 60870-5-104 traffic peak — during connection establishment with full GI — does not exceed 120 kbit/s. The OSS uses a dual-route 10 Mbit/s MPLS leased circuit to PSE Warsaw, making bandwidth the least constrained parameter in the telecontrol link design.

> **Standard reference:** IEC 60870-5-104:2006 (Edition 2), "Telecontrol equipment and systems — Part 5-104: Transmission protocols — Network access for IEC 60870-5-101 using standard transport profiles" — Clause 9 (data transfer procedures), Clause 10 (connection establishment), Clause 11 (time synchronisation). TCP port 2404, IANA-registered for this protocol.

<!-- IMAGE: fig-30-03 -->
> **[Figure 30.3]** — OSS Communications Architecture: Local Networks and WAN Link to PSE
> **Type:** Layered architecture diagram
> **Content:** Three horizontal layers. Top layer: "PSE Warsaw — National Dispatch Centre" box with EMS/SCADA label. Middle layer: "OSS" box containing three sub-zones: (1) Process Bus — HSR ring with 10 MU and BC nodes in a circle, labelled "IEC 61850-9-2 SV + GOOSE, HSR zero-failover"; (2) Station Bus — PRP dual-LAN with 4 protection relays, 4 bay controllers, SCADA server, labelled "IEC 61850 MMS + GOOSE, PRP LAN A + LAN B"; (3) Gateway — single box connecting station bus to WAN. Bottom connecting element: vertical arrow from Gateway to PSE Warsaw labelled "IEC 60870-5-104 over TCP/IP, dual-route MPLS 10 Mbit/s". Colour coding: HSR ring in green, PRP LAN A in blue, PRP LAN B in red, WAN link in orange.
> **Caption:** Three communication layers in the OSS: the HSR process bus (zero-failover, sampled values and local GOOSE, physically confined to the GIS hall), the PRP station bus (zero-failover, MMS and GOOSE, distributed across the building), and the IEC 60870-5-104 WAN link to the PSE National Dispatch Centre. Each layer uses the protocol and redundancy architecture matched to its timing requirements.
> **Alt text:** Layered diagram showing HSR process bus, PRP station bus, and IEC 60870-5-104 WAN link connecting the OSS to the TSO control centre.
> **Data source:** Author illustration.
> **Resolution:** 1400 × 900 px
> **Color notes:** Process bus in green, PRP LAN A in blue, LAN B in red, WAN link in orange.

---

## 30.5 Worked Example: OSS Network Architecture and Reliability Budget

### The network inventory

The OSS has 49 IEDs distributed across three communication segments:

| Segment | Redundancy scheme | Primary protocol | IED count |
|---------|-------------------|-----------------|-----------|
| Station bus | PRP (LAN A + LAN B) | MMS, GOOSE, time sync | 34 |
| Process bus (GIS hall) | HSR ring (12 nodes) | Sampled Values, GOOSE | 12 |
| WAN (PSE Warsaw) | Dual-route MPLS | IEC 60870-5-104 | 1 gateway |

**Step 1 — RSTP baseline (what a conventional network would deliver):**

Station bus with RSTP, 6-hop path from protection relay to Bay 3 bay controller:

$$
T_{\text{RSTP,min}} = 6 \times 15 \ \text{ms} = 90 \ \text{ms}
$$

Against the 3 ms GOOSE Type 1A requirement: 30× too slow. RSTP is disqualified for the process bus without further analysis.

**Step 2 — PRP station bus delivery time:**

LAN A path: 3 managed switches, $L_A = 80\ \text{m}$ fibre (east cable route):

$$
T_A = 3 \times 5 + \frac{80}{2.0 \times 10^8 \times 10^{-6}} = 15.0 + 0.4 = 15.4 \ \mu\text{s}
$$

LAN B path: 4 managed switches, $L_B = 120\ \text{m}$ (west cable route, longer run):

$$
T_B = 4 \times 5 + \frac{120}{2.0 \times 10^8 \times 10^{-6}} = 20.0 + 0.6 = 20.6 \ \mu\text{s}
$$

Normal operation: $T_{\text{PRP}} = \min(15.4,\ 20.6) = 15.4\ \mu\text{s}$ — 195× faster than 3 ms.
LAN A switch failure: $T_{\text{PRP}} = 20.6\ \mu\text{s}$ — still 146× faster than 3 ms. Zero transition time between states.

**Step 3 — HSR process-bus delivery:**

12 nodes in GIS hall ring, $L_{\text{ring}} = 240\ \text{m}$ total fibre (11 segments, ~22 m each):

$$
T_{\text{HSR,max}} = (12 - 1) \times 5 + \frac{240}{2.0 \times 10^8 \times 10^{-6}} = 55 + 1.2 = 56.2 \ \mu\text{s}
$$

Single MU failure: the anticlockwise path continues to deliver within 56.2 μs. Margin: 53× against 3 ms.

**Step 4 — Communication reliability budget:**

Individual LAN path availability: 99.99% → $P_{\text{fail}} = 10^{-4}$.

With PRP (independent paths):

$$
P_{\text{fail,PRP}} = (10^{-4})^2 = 10^{-8}
$$

Expected annual downtime for a GOOSE stream:
- Single RSTP LAN: $10^{-4} \times 31{,}536{,}000 \ \text{s} = 3{,}154 \ \text{s/year} = 52.6 \ \text{min/year}$
- PRP dual-LAN: $10^{-8} \times 31{,}536{,}000 \ \text{s} \approx 0.32 \ \text{s/year}$

The protection system on PRP expects approximately 315 ms of communication unavailability per year — expected to occur during normal scheduled maintenance windows, not during fault events.

**Step 5 — IEC 60870-5-104 bandwidth check:**

Steady-state cyclic reporting (250 analog values, 30-second cycle):

$$
B_{\text{cyclic}} = \frac{250 \times 18}{30} = 150 \ \text{bytes/s} = 1.2 \ \text{kbit/s}
$$

Peak load during General Interrogation at connection startup: $\approx 1{,}400 \times 18\ \text{bytes} \approx 25{,}200\ \text{bytes}$ transmitted in approximately 2 seconds = 100 kbit/s peak. Steady-state is 1.2% of the 10 Mbit/s MPLS link capacity. Peak is 1.0% of MPLS capacity. Bandwidth constraint: not applicable.

PSE Warsaw requires alarm events to be received within 2 seconds of occurrence. The MPLS round-trip time Warsaw–OSS is approximately 8 ms. Spontaneous ASDU transmission latency is negligible. The 2-second PSE requirement is satisfied with a margin of 250×.

---

## Key Takeaways

- **RSTP is insufficient for GOOSE process-bus protection.** Even optimistic RSTP reconvergence (≥50 ms, more typically 90 ms for a 6-hop path) exceeds the 3 ms GOOSE Type 1A requirement by 15–30×. IEC 62439-3 PRP and HSR were designed specifically to deliver zero-failover-time redundancy for IEC 61850 substations.

- **PRP achieves zero failover by transmitting every frame simultaneously on two independent LANs.** The receiver accepts the first arriving frame and discards the duplicate using the RCT sequence number. If one LAN fails, the other LAN was already delivering the same frames. There is no recovery event — only a cessation of duplicates. The reliability gain ($10^{-4} \rightarrow 10^{-8}$) assumes genuinely independent physical paths, which is a cabling and civil engineering requirement, not a software one.

- **HSR applies the same dual-path principle in a ring topology.** Frames travel simultaneously in both directions around the ring; a single node or link failure blocks one direction while the other continues unimpeded. HSR is more economical than PRP for physically compact process-bus installations where all devices are close together and a single cable tray is acceptable.

- **A QuadBox bridges HSR and PRP domains** without introducing a single point of failure. It handles the duplicate-discard boundary between the ring and dual-LAN architectures, enabling protection relays on the PRP station bus to subscribe to sampled values from merging units on the HSR process bus.

- **IEC 60870-5-104 connects the wind farm to the TSO control centre** over TCP/IP (port 2404), preserving the IEC 60870-5-101 ASDU format. The protocol is primarily event-driven for state changes and cyclic for measurements; steady-state bandwidth for a 500 MW farm is approximately 1.2 kbit/s. The bandwidth constraint is irrelevant; the latency constraint — alarm delivery within 2 seconds — is met with a 250× margin on a typical MPLS WAN.

---

## For Further Reading

1. Kirrmann, H., and Weibel, H. (2008). "IEC 62439 — PRP: Bumpless recovery for highly available, hard real-time industrial networks." *Proceedings of the IEEE International Symposium on Industrial Electronics (ISIE)*, Cambridge, UK, June 2008, pp. 2431–2437. DOI: 10.1109/ISIE.2008.4677175. The original peer-reviewed paper by PRP's primary inventor, presenting the duplicate-discard algorithm, the Redundancy Control Trailer format, and measurements of DANP implementation latency at ABB and ZHAW. The paper uses the phrase "bumpless redundancy" throughout, and Table I presents the first published GOOSE delivery time measurements under single-LAN-failure conditions for a four-IED test network. Essential reading for anyone specifying or commissioning an IEC 62439-3 network for process-bus protection applications.

2. IEC 62439-3:2021 (Edition 4). "Industrial communication networks — High availability automation networks — Part 3: Parallel Redundancy Protocol (PRP) and High-availability Seamless Redundancy (HSR)." International Electrotechnical Commission, Geneva. The normative standard defining both PRP and HSR, including the RCT Annex A format, duplicate-discard algorithm (Clause 6.4), QuadBox port state machine (Clause 7.3), and conformance test requirements (Clause 8). Edition 4 supersedes the 2016 Edition 3 and includes alignment with IEEE 802.1Q-2018 VLAN tagging and updated RedBox/QuadBox specifications. Procurement specifications and FAT test procedures for IEC 61850 substations must reference the current edition rather than the widely-circulated 2010 or 2012 editions.

3. Adamiak, M., et al. (2013). "Application of IEC 62439-3 in Protection and Control Systems." *CIGRÉ Session 44*, Paris, August 2013, Paper B5-305. CIGRÉ, Paris. A field application survey covering PRP and HSR deployments in European transmission substations, with measurements of actual GOOSE delivery times under simulated failure conditions across seven different switch manufacturers. Table 3 presents per-manufacturer delivery time under LAN A failure, ranging from 14 μs to 38 μs — all within the 3 ms requirement by a factor of 80–200. The paper also includes the first published QuadBox latency measurements for combined PRP-HSR topologies (17–42 μs under normal conditions; 18–44 μs under single-ring-node failure), and an economic comparison of PRP versus RSTP infrastructure costs at three European transmission substations.

---

*Katrijn powered down the protocol analyser at half past one.*

*She had covered the full architecture in four hours: PRP station bus (two independent cable routes, blue and red, entering the building at opposite corners), HSR process bus (the ring looped through the GIS hall bay panels), QuadBox (bridging the two domains without creating the single point of failure it was installed to prevent), and the IEC 60870-5-104 link terminating on the SCADA server's WAN interface, running at 1.2 kbit/s steady state to a control centre 600 kilometres away.*

*Kaan had filled four pages of his notebook. The last page held a sketch — not particularly accurate — of the OSS communications topology. LAN A in blue, LAN B in red, the HSR ring drawn as a rough circle in the inset labelled GIS Hall. The QuadBox at the boundary. The single line to Warsaw.*

*"One procedure before we close," Katrijn said, folding her cable tie and slipping it into her vest pocket. "Every three months, we run the redundancy audit. We disconnect LAN A completely and verify that every GOOSE stream continues, every SV subscription continues, every MMS session reconnects cleanly. Then LAN A restored, LAN B disconnected. Same test." She closed the analyser's lid. "If you never test the failure mode, you only know the redundancy has not been tested. You do not know it works."*

*She pulled up the last audit report on her tablet: forty-nine IEDs tested, forty-nine confirmed redundant, zero GOOSE delivery failures, two MMS sessions slower than the specified reconnect threshold. Both had been investigated and resolved before the next shift.*

*The date on the report was six weeks ago.*

*Kaan looked at the topology diagram on her screen — the blue lines and red lines and the small green circle of the HSR ring — and thought about what it represented. Five layers, now, that he had walked through in sequence. Physical fibre. Network redundancy. Data model. Protocols. Protection logic. Each layer visible to the layer above it and invisible to the layer below. The OSS did not know it was running on fibre optic cable; the fibre did not know it was carrying protection data. The stack worked because each layer solved one problem cleanly and left the others for someone else.*

*The corridor door opened. Anders leaned in.*

*"When you are finished," he said to Kaan, "there is someone who wants to talk about what happens when the network is doing everything correctly — and someone who should not be on it arrives."*

*Kaan picked up his notebook and followed.*

*Chapter 31 was about the one thing that PRP and HSR could not protect against: a correctly-addressed message, from the wrong source.*

---

## Notes

[^1]: Perlman, R. (1985). "An Algorithm for Distributed Computation of a Spanning Tree in an Extended LAN." *Proceedings of the ACM SIGCOMM '85: 9th Symposium on Data Communications*, Stowe, Vermont, September 1985, pp. 44–53. DOI: 10.1145/319056.319004. ACM, New York. Radia Perlman was a consulting engineer at Digital Equipment Corporation (DEC) when she developed the algorithm in 1984; the paper was presented and published in 1985. The Algorhyme that serves as the paper's abstract was composed, by Perlman's own account, in approximately two minutes. The algorithm was incorporated into IEEE 802.1D-1990 (Media Access Control (MAC) Bridges) as the spanning tree standard for IEEE 802 bridged networks. IEEE 802.1D was revised in 1998 and replaced in 2004 by a version incorporating RSTP as the baseline, obsoleting the original 1990 standard. Perlman has noted in interviews that she did not intend spanning tree to become the permanent solution to Ethernet loop prevention; she expected it would be replaced by something better within a few years. It remained the dominant approach for three decades.

[^2]: IEEE Std 802.1w-2001. "IEEE Standard for Information Technology — Telecommunications and Information Exchange Between Systems — Local and Metropolitan Area Networks — Common Specifications — Part 3: Media Access Control (MAC) Bridges — Amendment 2: Rapid Reconfiguration." IEEE, New York, 2001. RSTP replaced the timer-based reconvergence of classic STP with a proposal-agreement handshake between adjacent bridges, allowing port state transitions without waiting for Max Age expiry. The standard's informative annexes cite "less than one second" as the typical convergence time for well-configured topologies; real-world measurements in substation environments have shown 45 ms (optimistic, small topology, no background traffic) to several seconds (large topology, mixed-speed links). IEEE 802.1w-2001 was withdrawn and incorporated into IEEE 802.1D-2004, which made RSTP the normative baseline for all bridged Ethernet networks. IEEE 802.1D-2004 was itself superseded by IEEE 802.1Q (the unified bridging standard), but RSTP remains the spanning-tree mechanism specified by IEEE 802.1Q-2018 for networks that do not implement Multiple Spanning Tree Protocol (MSTP).

[^3]: Kirrmann, H., and Weibel, H. (2008). DOI: 10.1109/ISIE.2008.4677175 (full citation in For Further Reading above). The development of PRP at ABB Corporate Research in Baden is traced in this paper to the late 1990s. Kirrmann identified that the timing requirements emerging from IEC 61850 GOOSE standardisation work — being developed in parallel by IEC TC57 — were fundamentally incompatible with any recovery-time-based redundancy approach. The phrase "bumpless redundancy" appears in ABB internal documentation from 2001–2003; "Parallel Redundancy Protocol" was adopted when the concept entered IEC 62439 standardisation work. ZHAW InES (Zurich University of Applied Sciences at Winterthur, Institute of Embedded Systems) built the first independent Linux-based DANP and demonstrated interoperability with ABB's implementation at the IEEE International Symposium on Precision Clock Synchronization (ISPCS) in 2007, confirming that PRP was implementable by any party following the specification.

[^4]: IEC 62439-3:2010 (Edition 1). "Industrial communication networks — High availability automation networks — Part 3: Parallel Redundancy Protocol (PRP) and High-availability Seamless Redundancy (HSR)." International Electrotechnical Commission, Geneva, February 2010. PRP was defined in Clause 4 of the 2010 edition; HSR was added alongside PRP in the same edition, reflecting its contemporaneous development by the five-company consortium. Edition 2 (July 2012) introduced the QuadBox specification and clarified the duplicate-discard boundary between PRP and HSR domains. Edition 3 (2016) aligned with IEEE 802.1Q-2014. Edition 4 (2021) is the current normative version and should be used for all new projects and procurement specifications.

[^5]: The five HSR founding companies are identified in IEC 62439-3 ballot history documentation. Hirschmann (now part of Belden) contributed the ring topology concept from its existing Hirschmann RSTP-based ring products (HiPER-Ring); ABB contributed the duplicate-frame and discard-algorithm framework from PRP; Siemens, Alstom, and RuggedCom contributed requirements from their respective substation automation product lines. The QuadBox concept — a four-port device bridging PRP and HSR domains — was introduced in Edition 2 (2012) after field deployments revealed that most real substations would require both PRP (station bus, wide area) and HSR (process bus, compact area) operating together. See also: Ingram, D., et al. (2013). "Overview of IEC 62439-3 High Availability Networks for Substation Automation." *CIGRÉ SC B5 Colloquium*, Reykjavik, Iceland, 2013.

[^6]: IEC 60870-5-104:2006 (Edition 2). "Telecontrol equipment and systems — Part 5-104: Transmission protocols — Network access for IEC 60870-5-101 using standard transport profiles." International Electrotechnical Commission, Geneva, 2006. Supersedes the first edition (December 2000). Amendment 1:2016 added cause-of-transmission codes and clarified redundant TCP connection establishment. TCP port 2404 is the IANA-registered port for this protocol. IEC 60870-5-104 is deployed across European TSOs including PSE (Poland), RTE (France), REE (Spain), Terna (Italy), ČEPS (Czech Republic), and SONI (Northern Ireland). The North American equivalent is DNP3 (IEEE Std 1815-2012), which uses the same event-driven architecture but a different ASDU encoding.

[^7]: The IEC 60870-5 foundational parts (-1 through -5) were published 1992–1996 by IEC TC57 Working Group 3. IEC 60870-5-101 (Companion standard for basic telecontrol tasks) was published in 1995. The decision to produce IEC 60870-5-104 as a TCP/IP mapping of the existing -101 application layer was made around 1997–1998, when several European utilities began deploying IP-based SCADA infrastructure and needed a migration path from serial -101 RTUs without replacing all installed equipment. The first edition of -104 was published December 2000, approximately two years after the earliest commercial IEC 60870-5-104 implementations appeared in European transmission networks. ASDU type codes, cause-of-transmission values, and object address structures are identical between -101 and -104; an engineering tool that reads -101 object tables can generate -104 configurations without modification to the application layer.
