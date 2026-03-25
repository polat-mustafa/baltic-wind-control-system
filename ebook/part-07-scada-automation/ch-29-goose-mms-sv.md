# Chapter 29: GOOSE, MMS, and Sampled Values: Three Ways to Communicate

*The second monitor was the difference.*

*In Chapter 28's session, the right monitor had shown an XML file — dense green text on a dark background, the SCD's nested angle brackets filling the screen in a patient recursive structure. When Kaan arrived the following morning, the XML was gone. In its place was a packet capture window: rows of timestamped Ethernet frames scrolling upward at a constant rate. Each row showed a source MAC address, a destination MAC address, a protocol identifier, and a length in bytes. The destination addresses were not the point-to-point unicast addresses Kaan recognised from networking — they were multicast addresses starting with 01:0C:CD, which he had never seen before.*

*Hanna was watching the capture the way someone watches a slow river — not tracking individual frames but reading the texture of the flow.*

*"You're on time," she said. She had a small hardware device plugged into a spare port on the workstation's Ethernet tap — a test signal generator, Kaan guessed, about the size of a paperback book. "I am going to send a GOOSE message. Watch the second monitor."*

*She pressed a button on the generator.*

*On the second monitor, a single row lit up in red — different protocol identifier from the background flow, multicast destination, 124 bytes. The timestamp at the left edge read 09:14:22.002831 UTC. Hanna pointed to the row.*

*"That arrived 2.8 milliseconds after I pressed the button," she said. "No TCP. No IP. No acknowledgment request. No session layer. The message entered the Ethernet segment and every device with the matching AppID had it in 2.8 milliseconds."*

*"What does it say?" Kaan asked.*

*Hanna opened the frame's decoded payload. The fields listed: AppID 0x0012; DataSet PROT/LLN0\$GO\$DSTripGOOSE1; stNum 47; sqNum 0; timeAllowedToLive 2000 ms; allData: three BOOLEAN values — TRUE, TRUE, FALSE — for three circuit breakers in the array feeder protection scheme.*

*"Bay 3 protection relay," Hanna said. "It is announcing that circuit breakers 1 and 2 in the protection zone should trip, and breaker 3 should not. Any device subscribed to this dataset heard it in 2.8 milliseconds. No polling. No handshake. The event happened and the farm's nervous system was told."*

*Kaan looked at the XML file on the left monitor — still showing the SCD, the data model from yesterday. The SCD was the language. The GOOSE was the shout.*

*"You used three words yesterday," he said. "The standard is a data model, not a protocol. Today it is a protocol."*

*"Today," Hanna said, "it is three protocols. MMS speaks. GOOSE shouts. Sampled values breathe. Same data model underneath. Different transport for each job." She cleared the test frame and let the background flow resume. "The job determines the transport. That is the design principle."*

---

## 29.1 MMS: The Station Bus Conversation

Long before IEC 61850 existed, a solution to the same problem had been proposed in an entirely different industry.

In 1980, General Motors was running one of the largest manufacturing operations in the world across hundreds of factories, none of which could speak to each other's automation equipment. The assembly line programmable controllers were from Allen-Bradley. The machining centres used Fanuc controllers. The test stations had HP instrumentation. The material handling systems were ASEA. Every supplier had its own proprietary communication scheme. Integrating them required custom gateway after custom gateway, and each gateway was a maintenance burden and a failure point.

In 1982, GM launched MAP — the Manufacturing Automation Protocol — with a clear objective: a common communication framework that any industrial device, from any manufacturer, would be required to implement as a condition of supplying equipment to a GM factory. The technical core of MAP drew heavily on the ISO seven-layer Open Systems Interconnection model and, at the application layer, specified a protocol designed for reading and writing named data objects in remote devices: the Manufacturing Message Specification, published as ISO 9506 in 1990.[^1]

MMS never became ubiquitous in manufacturing — the OSI stack proved too computationally expensive for the embedded controllers of the late 1980s, and proprietary fieldbus protocols (Profibus, DeviceNet, CANopen) filled the gap before TCP/IP became dominant. But the IEC TC57 working groups, building the new substation communication standard in the late 1990s, recognised that MMS's application-layer model — reading and writing structured named data objects, with both polled and event-driven variants — was exactly what a substation needed at the station bus level. They defined an abstract layer called the Abstract Communication Service Interface (ACSI), which specified the services a compliant IEC 61850 system must provide, and then mapped those services onto MMS running over TCP/IP.[^2]

The ACSI mapping to MMS is straightforward. Each IEC 61850 service corresponds to one or more MMS PDU types:

- **GetDataValues** → MMS Read request: the SCADA server asks for the current value of a named data attribute (e.g., `PROT/MMXU1.PhV.phsA.cVal.mag.f`) and receives the floating-point voltage measurement in the MMS response.
- **SetDataValues** → MMS Write request: an engineer sets a protection parameter (e.g., `PROT/PIOC1.StrVal.setMag.f` = 1,800 A) by sending an MMS Write to the relay's configured address. This is how Lars's PLL bandwidth update worked in Chapter 27.
- **Report (BRCB/URCB)** → MMS InformationReport: instead of polling, the IED sends a report to the SCADA client whenever a subscribed data attribute changes beyond a configured deadband, or at a configured integrity period, or when a quality flag changes. Buffered (BRCB) reports queue events in case the network is temporarily unavailable; unbuffered (URCB) reports discard unsent events if the connection drops.
- **Log** → MMS Journal: time-stamped records of protection operations, alarm state changes, and setting modifications, stored in the IED's non-volatile memory and readable by audit tools.
- **Control (Direct/SBO)** → MMS Write + structured confirmation: opening or closing a circuit breaker via SCADA uses either a Direct Operate command (single message) or a Select-Before-Operate sequence (first message selects the target and confirms interlock status; second message executes) for additional safety margin.
- **File services** → MMS File Access: transferring firmware images, disturbance records (.comtrade), and ICD/CID configuration files between IEDs and the engineering workstation.

The delivery time for MMS operations is not designed for speed. It is designed for reliability. TCP provides guaranteed delivery and ordered sequencing; the price is the round-trip time for connection establishment, the stack processing time in the IED, and the network latency. In practice, MMS responses arrive between 50 milliseconds and several seconds after the request, depending on the IED's processing load and the request type.

$$
T_{\text{MMS}} \approx T_{\text{TCP}} + T_{\text{proc}} + T_{\text{network}} \approx 50\text{–}500 \text{ ms}
$$

where:
- $T_{\text{TCP}}$ = TCP acknowledgment and retransmission overhead [ms]
- $T_{\text{proc}}$ = IED application layer processing time for request or report generation [ms]
- $T_{\text{network}}$ = Ethernet frame delivery time across the station network [ms, typically < 5]

This latency is entirely acceptable for the tasks MMS performs: reading a voltage measurement, changing a protection setting, retrieving a disturbance record. None of those tasks require sub-10-millisecond delivery. What they require is correctness — the right value, to the right address, with confirmation of receipt. TCP provides exactly that.

The tasks that require sub-10-millisecond delivery are not performed by MMS.

---

## 29.2 GOOSE: The Layer-2 Shout

A protection relay that detects a fault on a 66 kV array feeder must communicate a trip command to the circuit breaker's bay controller within a time budget of a few milliseconds. The total fault clearance time — from fault inception to arc extinction — is typically 60 to 80 milliseconds for a primary protection operation. Of that budget, 20 milliseconds are consumed by the relay detecting the fault, and 40 to 60 milliseconds are consumed by the circuit breaker opening. That leaves 4 milliseconds or less for the communication between relay and breaker.

TCP/IP cannot meet this requirement. The minimum round-trip time for a TCP acknowledgment on a 100 Mbps LAN segment is approximately 0.5 milliseconds under ideal conditions — but TCP requires connection establishment (SYN/SYN-ACK/ACK), and the cumulative latency of the IP routing layer, the TCP processing stack, and the socket buffer is sufficient to violate the 4-millisecond budget in any realistic substation environment. More fundamentally, TCP is a point-to-point protocol: a single trip signal directed at a single recipient. In a protection scheme where a fault in one bay may require simultaneous action in multiple adjacent bays — busbar protection, inter-tripping, auto-reclose blocking — point-to-point messages must be sent one at a time, each consuming its own latency budget.

GOOSE eliminates both problems by abandoning TCP, IP, and the entire upper-layer stack. A GOOSE message is an IEEE 802.3 Ethernet frame addressed to a Layer-2 multicast destination. It is not routed. It is not acknowledged. It is not session-managed. It is published onto the Ethernet segment, and every device with a network interface receives it in the same single wire propagation delay — the time for an electrical signal to travel the length of the cable, on the order of microseconds per hundred metres.

The performance classes for GOOSE trip messages (IEC 61850-5 Type 1A) require delivery to all subscribers within 3 milliseconds at 100 Mbps. This budget encompasses the publisher's processing time, the frame transmission time (124 bytes at 100 Mbps = 9.9 μs), and any single intervening Ethernet switch's forwarding latency (typically 5–10 μs for managed switches with cut-through forwarding). The end-to-end delivery is typically 1–4 milliseconds in a correctly designed station network.

The GOOSE PDU carries the following key fields:

- **AppID** — a 16-bit application identifier assigned during engineering (range 0x0000–0x3FFF for GOOSE). All subscribers filter on this identifier; frames with non-matching AppIDs are discarded at the Ethernet interface before any processing.
- **DataSet** — the reference to the IEC 61850 DataSet containing the data being published (e.g., `PROT/LLN0$GO$DSTripGOOSE1`). The DataSet is a pre-configured list of data attributes from the publisher's own object model — the trip status of three circuit breakers, for example, or the start and operate flags of four protection functions.
- **stNum** — the state number. This integer increments every time the value of any data attribute in the DataSet changes. Receiving devices track stNum: if a received frame has a stNum lower than the last seen value, it is an old message and is discarded.
- **sqNum** — the sequence number. This increments with each retransmission of the same state. Receiving devices use sqNum to confirm continuity — a gap in sqNum means a frame was lost on the network.
- **timeAllowedToLive** — the number of milliseconds for which a subscriber should consider this frame's data valid before declaring a loss-of-communication condition. Set to approximately twice the expected retransmission interval.
- **t** — the IEEE 1588 timestamp of the event that caused stNum to change, with microsecond resolution.
- **confRev** — the configuration revision number. If a publisher is reconfigured (its DataSet contents change), confRev increments. Subscribers that detect a confRev change alert the operator: the dataset they subscribed to may no longer match what the publisher is sending.

The retransmission pattern is the design's most elegant feature. On a state change, the publisher immediately transmits the new value — and then retransmits at exponentially increasing intervals:

$$
T_n = \min\left(T_{\max},\ T_1 \cdot 2^{n-1}\right)
$$

where:
- $T_n$ = retransmission interval after the $n$-th retransmission [ms]
- $T_1$ = minimum retransmission interval, typically 2 ms [ms]
- $T_{\max}$ = steady-state heartbeat interval, typically 10,000 ms [ms]
- $n$ = retransmission count [integer ≥ 1]

After a state change, the sequence runs: immediately, 2 ms, 4 ms, 8 ms, 16 ms, 32 ms, 64 ms, 128 ms, 256 ms, 512 ms, 1,024 ms, 2,048 ms, 4,096 ms, 8,192 ms — and thereafter at the 10-second steady-state heartbeat. The burst of rapid retransmissions immediately after the event compensates for the possibility that a single Ethernet frame was lost. Any subscriber that misses the first transmission will receive the second within 2 milliseconds; any subscriber that misses the first two will receive the third within 6 milliseconds total. The steady-state heartbeat at 10-second intervals maintains the timeAllowedToLive watchdog — a subscriber that has not received a heartbeat for longer than two expected intervals raises a loss-of-communication alarm.

This design has no acknowledgment mechanism by intent. GOOSE is fire-and-forget from the publisher's perspective: it publishes and retransmits, without waiting for confirmation. The responsibility for detecting missed messages rests with the subscriber's stNum and sqNum tracking. In a protection context, the absence of an expected GOOSE frame is itself a signal: loss-of-GOOSE drives a fail-safe response (typically, a backup trip or an alarm) rather than waiting for a TCP retransmission timeout.

Before IEC 61850, the same trip signal traveled over a copper cable from the protection relay's output relay contact to the circuit breaker's trip coil input terminal. The copper cable was reliable, simple, and required no software to maintain. It was also a point-to-point wiring, specific to one relay and one breaker, and produced no record of when it operated or what value it carried. After IEC 61850, the same signal travels as a GOOSE frame with a microsecond timestamp, a state counter, and a DataSet reference that identifies not just the trip command but the protection function that issued it. The fault clearance that took 65 milliseconds before takes 65 milliseconds after — but after, every millisecond of it is logged.

> **Standard reference:** IEC 61850-5:2013, "Communication networks and systems for power utility automation — Part 5: Communication requirements for functions and device models" — Clause 8 (performance requirements) and Table 9 (transfer time requirements by message type). Type 1A messages (trip signals, inter-trip) require delivery within 3 ms at performance class P2/P3; Type 1B messages (other fast messages) require 20 ms at P2/P3.

<!-- IMAGE: fig-29-01 -->
> **[Figure 29.1]** — GOOSE Retransmission Pattern: State Change and Heartbeat Recovery
> **Type:** Time-axis diagram with frame annotations
> **Content:** Horizontal time axis from 0 to 30,000 ms. At t=0: "State change (fault detection)" vertical marker. First six transmissions marked with downward arrows at: 0, 2, 6, 14, 30, 62 ms (cumulative sum of T_n). Interval labels above each arrow: "imm.", "2 ms", "4 ms", "8 ms", "16 ms", "32 ms". Then compressed gap notation "…" followed by heartbeat arrows at 10,000 ms and 20,000 ms labelled "T_max = 10 s". Upper annotation: "stNum = 47 throughout" and "sqNum increments: 0, 1, 2, 3, 4, 5…". At t=0 a second horizontal bar shows "subscriber timeAllowedToLive countdown = 2,000 ms → reset at each received frame". Grey shading across 0-4ms labelled "P2/P3 delivery requirement window".
> **Caption:** The GOOSE retransmission pattern after a state change. Frames are sent at exponentially increasing intervals to guarantee delivery despite single-frame loss. The 10-second steady-state heartbeat maintains the timeAllowedToLive watchdog. Any subscriber that does not receive a frame within 2× the expected retransmission interval triggers a loss-of-communication alarm.
> **Alt text:** Timeline showing GOOSE frame transmissions at exponentially increasing intervals after a state change at t=0, converging to a 10-second heartbeat.
> **Data source:** Author illustration per IEC 61850-8-1:2011, Clause 9 (GOOSE message timing); IEC 61850-5:2013, Clause 8.4.
> **Resolution:** 1400 × 600 px
> **Color notes:** Trip frames in red; steady-state heartbeat frames in blue; 3ms delivery window in grey.

---

## 29.3 Sampled Values: The Continuous Breath

Protection relays have, since the earliest numerical designs of the 1980s, required a continuous stream of analog measurements: three-phase voltage, three-phase current, and sometimes additional signals for neutral current, differential restraint, or busbar voltage. In a conventional wired substation, these signals arrive via copper cables from the current transformer and voltage transformer secondaries — 5 A secondary for CTs, 110 V secondary for VTs, with specified burden limits that cannot be exceeded without introducing measurement error.

The copper secondary circuit has known limitations. A 66 kV current transformer has a saturation characteristic: at very high fault currents, the iron core saturates and the secondary output becomes distorted. The saturation delay introduces timing error into differential protection algorithms. The copper cable imposes a burden that must be budgeted across all the relays and meters sharing the same CT core. And the physical cable from the switchgear bay to the protection relay panel may run 50 metres through cable trays — a length that introduces impedance, capacitive coupling to adjacent conductors, and a maintenance challenge when it needs replacement.

IEC 61850-9-2 defines an alternative. The Sampled Values (SV) service specifies a protocol in which an intelligent electronic device — the **merging unit** (MU) — digitises the CT and VT secondary outputs at the switchgear bay, applies an IEEE 1588 timestamp to each sample, and publishes a continuous multicast Ethernet stream to the station network. Protection relays subscribe to the merging unit's SV stream and receive live, timestamped digital samples instead of analog secondary signals. The copper secondary cables that once ran from the switchgear bay to the relay panel are replaced by a single fibre-optic Ethernet cable from the merging unit to the station switch.

The practical implementation of IEC 61850-9-2 for protection applications uses the **IEC 61850-9-2 Light Edition (LE)**, a profile published in 2004 by the UCA International Users Group to harmonise the standard's implementation across manufacturers before the IEC formally ratified the full specification.[^3] The LE profile specifies two sample rates:

- **80 samples per period** (80 SPP) — the standard protection and metering rate. At 50 Hz, this gives 4,000 samples per second per channel.
- **256 samples per period** (256 SPP) — for digital fault recorders, power quality analysers, and applications requiring sub-millisecond waveform resolution.

Each SV frame carries 8 analog channels — typically three-phase voltage (phase-to-neutral), three-phase current, a protection-grade voltage, and a protection-grade current — plus a sample counter, timestamp, and quality flags. The data rate generated by a single merging unit at 80 SPP on a 100 Mbps network is:

$$
R_{\text{SV}} = N_{\text{ch}} \times f_s \times B_{\text{sample}} + B_{\text{header}}
$$

where:
- $N_{\text{ch}}$ = number of analog channels per frame [dimensionless, typically 8]
- $f_s$ = sampling frequency [samples/s; 80 SPP at 50 Hz gives $f_s = 4{,}000$ s⁻¹]
- $B_{\text{sample}}$ = bits per sample per channel [32 bits for INT32 value + 16 bits quality = 48 bits]
- $B_{\text{header}}$ = frame header overhead [bits; approximately 320 bits for IEC 61850-9-2 LE header, MAC addresses, and EtherType]

For a standard 8-channel merging unit at 80 SPP:

$$
R_{\text{SV}} = 4{,}000 \ \text{frames/s} \times (8 \times 48 + 320) \  \text{bits/frame} = 4{,}000 \times 704 = 2.82 \ \text{Mbps}
$$

On a 100 Mbps station network, a single merging unit consumes 2.82% of the available bandwidth — modest enough that the eight merging units in an eight-feeder OSS consume approximately 22.5% of the network capacity in SV traffic alone, leaving ample headroom for GOOSE, MMS, and management traffic.

The architectural consequence of the process bus is not just cabling simplification. It is a change in what protection architectures are physically possible. In a traditional wired substation, transformer differential protection — which compares the current entering a transformer's primary winding with the current leaving its secondary winding — requires that the CT secondary cables from both the HV and LV sides of the transformer terminate at the same protection relay. If the relay is in a different bay from one of the CTs, a long secondary cable run is unavoidable. In a process bus architecture, the merging units on both the HV and LV sides publish their sampled current data to the Ethernet network. A protection relay anywhere on the network can subscribe to both streams simultaneously, compare the timestamped samples, and execute the differential algorithm without any physical co-location requirement.

<!-- IMAGE: fig-29-02 -->
> **[Figure 29.2]** — Process Bus Architecture: Merging Units, SV Streams, and GOOSE Trip
> **Type:** Single-line diagram with protocol labels
> **Content:** Primary equipment at top: 66 kV busbar, circuit breaker (CB3), current transformer (CT) and voltage transformer (VT) on array feeder 3. From CT/VT: dashed line to "Merging Unit (MU3)" box at switchgear bay level (labelled "IEC 61850-9-2 LE, 80 SPP, 4,000 samp/s"). From MU3: orange arrow labelled "SV multicast (fibre)" pointing down to station Ethernet switch. From switch: SV arrow fanning out to "Protection Relay IED" (labelled "REF615_Bay03") and "Digital Fault Recorder". Protection IED also has a second path: from its GOOSE publisher, a red arrow labelled "GOOSE trip (< 3 ms)" going back through the switch to "Bay Controller IED" (which drives CB3 trip coil). MMS arrow in blue from Protection IED through switch to "SCADA Server" (labelled "report 50–500 ms"). Bottom: three protocol legend boxes: SV (orange, continuous), GOOSE (red, event-triggered), MMS (blue, request-response). Right side: "Copper secondary circuit (legacy)" greyed out with crossed-out 50m cable run.
> **Caption:** The IEC 61850 process bus replaces copper CT/VT secondary cables with fibre Ethernet. The merging unit digitises analog signals at 80 samples per period and publishes a continuous Sampled Values stream. The protection relay subscribes to SV data, detects faults, and publishes GOOSE trip messages to the circuit breaker bay controller — all within the 4-millisecond GOOSE delivery budget.
> **Alt text:** Architecture diagram showing a merging unit near primary switchgear digitising CT and VT signals, sending sampled values via Ethernet to a protection relay, which sends GOOSE messages to the circuit breaker and MMS reports to the SCADA server.
> **Data source:** Author illustration per IEC 61850-9-2 LE (2004, UCA IUG); IEC 61850-5:2013.
> **Resolution:** 1400 × 900 px
> **Color notes:** SV stream orange, GOOSE red, MMS blue; legacy copper circuit grey.

---

## 29.4 The Fault Clearance Timeline

Three protocols. Three transport mechanisms. Three delivery timescales. A fault event on a 66 kV array feeder brings all three into operation simultaneously, in a sequence that takes less time to complete than a human blink.

The timeline unfolds in five stages, each governed by a different physics:

**Stage 1 — Fault inception and waveform distortion (t = 0 to t ≈ 0 ms):**
A short circuit develops on Array Feeder 3 — cable insulation failure, typically at a joint. The fault current rises in microseconds to several times the rated value. The merging unit in Bay 3 is already sampling at 4,000 samples per second; the distorted current waveform appears in its SV stream at the next sample instant, at most 0.25 milliseconds after fault inception.

**Stage 2 — Protection relay detection (t ≈ 0 ms to t ≈ 20 ms):**
The protection relay subscribed to MU3's SV stream receives the distorted samples. For instantaneous overcurrent protection (PIOC), detection requires the measured current to exceed the pickup threshold — a single sample may be sufficient for a high-magnitude bolted fault. For differential protection, the relay compares the HV and LV SV streams and detects an imbalance within one power cycle (20 ms at 50 Hz). For distance protection, the relay calculates the apparent impedance from consecutive SV samples and detects an impedance inside Zone 1 within 10–20 ms.

$$
T_{\text{detect}} = \frac{N_{\text{samples}}}{f_s} = \frac{N_{\text{samples}}}{4{,}000 \text{ samples/s}}
$$

where:
- $T_{\text{detect}}$ = protection detection time [s]
- $N_{\text{samples}}$ = number of samples required to confirm the fault condition [dimensionless; 1–80 depending on algorithm and fault magnitude]

For a bolted three-phase fault at 10× rated current with instantaneous overcurrent protection: $N_{\text{samples}} = 1$, $T_{\text{detect}} = 0.25$ ms. For differential protection at 2× restraint threshold: $N_{\text{samples}} \approx 40$ (one cycle), $T_{\text{detect}} = 10$ ms.

**Stage 3 — GOOSE trip command (t ≈ 20 ms to t ≈ 23 ms):**
The protection relay publishes a GOOSE frame to the station network with the trip Boolean set to TRUE. The bay controller for Bay 3 receives the GOOSE frame within 2.8 milliseconds (consistent with the P2/P3 class ≤ 3 ms requirement) and activates the circuit breaker's trip coil.

**Stage 4 — Circuit breaker opening (t ≈ 23 ms to t ≈ 70 ms):**
The circuit breaker's operating mechanism responds to the trip coil energisation. Contact parting takes 30–40 milliseconds for a modern SF6 circuit breaker at 66 kV. The arc that forms as the contacts separate is quenched at the next current zero crossing (up to 10 ms for a 50 Hz system). Total circuit breaker operating time: 40–60 ms.

**Stage 5 — SCADA reporting (t ≈ 70 ms to t ≈ 300 ms):**
As the circuit breaker opens, the XCBR logical node in the bay controller IED detects the change in `Pos.stVal` from closed to open. The buffered report control block (BRCB) in the IED triggers an MMS InformationReport, which arrives at the SCADA server 50–200 milliseconds after the circuit breaker state changes.

$$
T_{\text{clear}} = T_{\text{detect}} + T_{\text{GOOSE}} + T_{\text{CB}}
$$

where:
- $T_{\text{detect}}$ = protection detection time [ms; 0.25–20 ms depending on fault type and protection function]
- $T_{\text{GOOSE}}$ = GOOSE delivery time from relay to bay controller [ms; ≤ 3 ms at P2/P3]
- $T_{\text{CB}}$ = circuit breaker operating time from trip coil energisation to arc extinction [ms; 40–60 ms for 66 kV SF6]

For a typical differential protection operation: $T_{\text{clear}} = 10 + 3 + 50 = 63$ ms. This is within the IEC 60909-0 fault clearance requirement and the FRT capability window calculated in Chapter 23.

The SCADA report arrives too late to influence the fault clearance — the arc was extinguished 200 milliseconds before the operator reads the alarm. But the report carries the complete record: protection function that operated, timestamp of GOOSE trip, timestamp of circuit breaker open, magnitude of fault current from the last SV samples, quality flags, and disturbance record reference. The copper hardwired system completed the fault clearance in the same 63 milliseconds. It left no record that was not manually extracted from an oscilloscope or protection engineer's notebook.

---

## 29.5 IEEE 1588 Precision Time Protocol: Microseconds Across the Network

The fault clearance timeline works correctly only if the SV samples from different merging units are aligned in time. For transformer differential protection — comparing current in at the HV busbar with current out at the LV terminals — the merging units on the HV side and the LV side must be synchronised to within one microsecond. If MU_HV's sample at t = 100.000 ms shows a current flowing into the transformer, and MU_LV's nominally simultaneous sample was actually recorded at t = 100.001 ms, the differential algorithm sees a spurious imbalance. At 220 kV, even a 1-microsecond timing error introduces a current discrepancy of several hundred amperes — sufficient to cause a false trip.

In the era of copper wired substations, synchronisation was provided by IRIG-B: an analogue time code signal broadcast over copper cable from a GPS-disciplined master clock to every IED's dedicated time input. IRIG-B achieves approximately 1-microsecond accuracy. In an IEC 61850 process bus architecture, running IRIG-B cable to every merging unit and protection relay defeats much of the purpose of replacing copper with fibre. The synchronisation must travel over the same Ethernet network as the SV and GOOSE data.

In 2002, the IEEE published a standard — IEEE 1588, "Standard for a Precision Clock Synchronization Protocol for Networked Measurement and Control Systems" — that provided exactly this capability. The protocol was developed by John Eidson at Hewlett-Packard Laboratories, who had been working since the mid-1990s on the problem of synchronising test instruments in automated measurement systems. Eidson's key insight was that the main source of timestamp error in software-based synchronisation (NTP achieves only ~1 ms) is the variable delay between when an event occurs and when the operating system's software timer processes it. By moving the timestamp into hardware — at the Ethernet PHY layer, where frames are physically transmitted and received — the variable software delay is eliminated. The result is synchronisation accuracy below 100 nanoseconds on a well-designed LAN segment.[^4]

IEEE 1588 (known as PTP, the Precision Time Protocol) uses a master-slave hierarchy:

**Grandmaster Clock (GMC)** — a GPS-disciplined clock with PTP software. Absolute accuracy typically ≤ 100 ns. Publishes Announce messages every 1–2 seconds; selected as master by all devices that receive it, using the Best Master Clock Algorithm (BMCA) defined in the standard.

**Boundary Clock (BC)** — implemented in managed Ethernet switches. A boundary clock synchronises one of its ports to the grandmaster (acting as a slave), then re-publishes the corrected time on all other ports (acting as a master to connected IEDs). Each boundary clock compensates for the fixed propagation delay through the switch fabric and subtracts its own contribution to the accumulated timestamp error. The result: each IED in the network sees a timestamp source that appears as if the grandmaster were connected directly to its port.

**Ordinary Clock (OC)** — the PTP implementation in each IED (merging unit, protection relay, bay controller). Synchronises to the best available master clock detected on its network port.

$$
\delta t_{\text{sync}} \leq N_{\text{hops}} \times \delta t_{\text{BC}} + \delta t_{\text{GMC}}
$$

where:
- $\delta t_{\text{sync}}$ = synchronisation accuracy at the end device [ns]
- $N_{\text{hops}}$ = number of boundary clock hops between grandmaster and end device [dimensionless; typically 2–4]
- $\delta t_{\text{BC}}$ = residual timestamp error per boundary clock [ns; ≤ 10–30 ns with hardware timestamping]
- $\delta t_{\text{GMC}}$ = grandmaster absolute accuracy [ns; ≤ 100 ns with GPS disciplining]

For a two-hop path from grandmaster through two boundary clocks to a merging unit: $\delta t_{\text{sync}} \leq 2 \times 30 + 100 = 160$ ns. Well within the 1,000 ns (1 μs) requirement of IEC 61850-5 for sampled values applications.

> **Standard reference:** IEC 61850-5:2013, "Communication networks and systems for power utility automation — Part 5: Communication requirements for functions and device models" — Table 10 (time synchronisation accuracy requirements). Accuracy class T3 (≤ 1 μs) is required for Sampled Values applications (process bus differential protection). Accuracy class T5 (≤ 1 ms) is sufficient for event timestamping (GOOSE and MMS reports).

IEEE 1588 has spread far beyond its origins in laboratory test equipment. Version 2 (IEEE 1588-2008) introduced hardware timestamping and transparent clocks as standard options, and the protocol is now used in 5G base station synchronisation (ITU-T G.8275), high-frequency trading platforms where the latency of a single nanosecond represents a competitive advantage, and the accelerator control system at CERN's Large Hadron Collider. The same protocol that synchronises the proton beam timing in Geneva to sub-nanosecond accuracy is synchronising the merging units in the offshore substation's process bus to sub-microsecond accuracy. Eidson, who was thinking about the timing requirements of a bench-top oscilloscope in 1996, had written a standard that turned out to be needed by an extraordinary range of industries that none of them could have predicted.

<!-- IMAGE: fig-29-03 -->
> **[Figure 29.3]** — IEEE 1588 PTP Hierarchy: From GPS Grandmaster to Merging Unit
> **Type:** Network topology diagram with clock accuracy annotations
> **Content:** Top: GPS satellite → GPS antenna → "Grandmaster Clock (GMC)" box (labelled "absolute accuracy ≤ 100 ns"). Below GMC: two arrows to two "Boundary Clock (BC)" boxes inside managed switches (labelled "residual error ≤ 30 ns per hop, hardware timestamping"). Below each BC: arrows fanning to 4–6 end devices: "Merging Unit (MU)" boxes (orange), "Protection IED" boxes (blue), "Bay Controller IED" boxes (green). Accuracy annotation at each level: GMC "100 ns", BC "130 ns", end device "160 ns (2 hops)". Horizontal grey band at "1,000 ns (1 μs)" labelled "IEC 61850-5 T3 requirement". All end-device accuracies shown below this band. Right side annotation: "PTP Announce / Sync / Follow_Up / Delay_Req / Delay_Resp exchange messages" listed.
> **Caption:** The IEEE 1588 PTP hierarchy synchronises all IEDs in the OSS to a GPS-disciplined grandmaster clock via boundary clocks in the managed Ethernet switches. With hardware timestamping, end-device accuracy is typically 100–200 ns — well within the 1 μs requirement of IEC 61850-5 for sampled values applications.
> **Alt text:** Network hierarchy from GPS grandmaster clock through boundary clocks in Ethernet switches to merging units and protection relays, with nanosecond accuracy annotations at each level.
> **Data source:** Author illustration per IEEE 1588-2008; IEC 61850-5:2013, Table 10.
> **Resolution:** 1200 × 900 px
> **Color notes:** GMC gold, boundary clocks grey, merging units orange, protection IEDs blue.

---

## 29.6 Worked Example: Three Protocols, One Fault Event

**Farm:** 500 MW offshore wind farm. 8 × 66 kV array feeders; 49 IEDs in the OSS; one IEC 61850-9-2 LE process bus with 8 merging units (one per feeder bay); 1 grandmaster clock, 4 managed switches with boundary clocks.

**Scenario:** Phase-to-phase fault on Array Feeder 3, 2 km from the OSS busbars. Fault current at OSS: 8,400 A (three-phase symmetric equivalent from IEC 60909-0 calculation, Ch 19). Feeder protection: differential protection with merging units at the OSS bay and at the offshore string turbine end.

---

**Step 1 — SV data rate calculation:**

Each of the 8 merging units generates an SV stream at 80 SPP:

$$
R_{\text{MU}} = 4{,}000 \ \text{frames/s} \times 704 \ \text{bits/frame} = 2.82 \ \text{Mbps per MU}
$$

Total SV load from 8 MUs: $8 \times 2.82 = 22.5$ Mbps on the 100 Mbps station network. Network utilisation from SV alone: 22.5%.

GOOSE adds a small steady-state load: 49 IEDs × average 2 GOOSE datasets × one heartbeat/10 s × 124 bytes = approximately 0.08 Mbps in steady state (spikes to ~1.2 Mbps during a busbar protection event with 20 simultaneous GOOSE activations — still only 1.2% of bandwidth).

MMS reports during normal operation: approximately 0.05 Mbps.

Total normal operation network utilisation: ≈ 23%. During a major event with all GOOSE activating: ≈ 24.3%. Well within 100 Mbps capacity.

---

**Step 2 — GOOSE subscription count:**

The protection relay IED for Bay 3 (REF615_Bay03) subscribes to the following GOOSE datasets:
- MU3_Bay03: SV stream (not GOOSE, separate subscription)
- Bus differential protection IED: busbar trip command
- Auto-reclose blocking from adjacent feeders: 4 IEDs × 1 dataset = 4 subscriptions
- Remote end turbine inter-trip: 1 dataset

Total GOOSE subscriptions for REF615_Bay03: 6 datasets. The full OSS IED population (49 IEDs) has an estimated total of 49 × 4 = ~196 GOOSE subscription-pairs. During the Array Feeder 3 fault, REF615_Bay03 publishes 1 GOOSE trip dataset that is subscribed to by 3 IEDs (Bay 3 circuit breaker bay controller, busbar protection, auto-reclose supervisor).

---

**Step 3 — Fault clearance timeline calculation:**

| Stage | Event | Elapsed time |
|-------|-------|-------------|
| Fault inception | Phase-to-phase fault develops on Array Feeder 3 | t = 0 ms |
| MU3 sample interval | First distorted sample in SV stream | t ≤ 0.25 ms |
| Relay detection (differential) | 1 cycle: 80 samples × 0.25 ms | t = 20 ms |
| GOOSE trip published | P2/P3 class, 100 Mbps network | t = 20 ms |
| GOOSE received at bay controller | 2.8 ms delivery (measured earlier) | t = 22.8 ms |
| Trip coil energised | Bay controller activates output relay | t = 23 ms |
| Circuit breaker contacts part | 66 kV SF6, 35 ms operating time | t = 58 ms |
| Arc extinction (current zero) | Next zero crossing after contact parting | t = 68 ms |
| SCADA MMS report arrives | BRCB triggered by XCBR1.Pos.stVal change | t = 190 ms |

**Total primary protection fault clearance time:** 68 ms. This is within the FRT ride-through window (Ch 23): the 140 ms shallow fault voltage window allows 68 ms of fault clearance with 72 ms of residual ride-through margin. The Type 4 converter's DC link would rise to approximately 1,020 V during 68 ms of blocked active current (well below the 1,180 V chopper threshold calculated in Ch 23).

---

**Step 4 — PTP synchronisation verification:**

The differential protection relay requires that SV samples from MU3_Bay03 (OSS side) and MU3_Remote (turbine end) be time-aligned to ≤ 1 μs. Both merging units receive PTP synchronisation from the same grandmaster through 2 boundary clock hops:

$$
\delta t_{\text{sync}} \leq 2 \times 30 + 100 = 160 \ \text{ns}
$$

A 160 ns alignment error at 66 kV / 66 A rated current introduces a differential measurement error of:

$$
\Delta I_{\text{error}} = I_{\text{rated}} \times 2\pi f \times \delta t = 66 \times 2\pi \times 50 \times 160 \times 10^{-9} = 0.003 \ \text{A}
$$

This error is three milliamps on a 66-ampere rated current — 0.005% of rated. The differential protection's minimum operate current is 0.1 × 66 = 6.6 A. The timing error contributes a false differential of 0.003 A — 0.05% of the operate threshold. PTP synchronisation is more than adequate.

---

## Key Takeaways

- **MMS speaks; GOOSE shouts; sampled values breathe.** Three protocols serve three delivery timescales — hundreds of milliseconds for station-level monitoring (MMS), under 3 milliseconds for trip commands and interlocks (GOOSE), continuous 4,000-samples-per-second streams for protection algorithms (SV). One IEC 61850 data model underlies all three.

- **GOOSE operates at Layer 2 specifically to eliminate TCP/IP latency.** No routing, no session management, no acknowledgment — just multicast Ethernet frames with an application-layer DataSet and a state counter. The retransmission pattern at exponentially increasing intervals provides robustness without acknowledgment overhead, and the timeAllowedToLive field turns communication loss into an active detection condition.

- **Sampled values replace copper CT secondary cables with fibre.** The merging unit digitises analog signals at the primary equipment bay and publishes a PTP-timestamped stream to the station network. Protection relays anywhere on the network subscribe to any merging unit's stream — enabling differential protection architectures that are physically impossible with hardwired secondary circuits.

- **IEEE 1588 PTP provides sub-microsecond time synchronisation over Ethernet.** With hardware timestamping in boundary clocks and merging units, the alignment error between SV streams from different bays is below 200 ns — a factor of five better than the 1-microsecond requirement. The protocol that Hewlett-Packard designed for test instruments in 1996 is now the time reference for the protection system guarding 510 MW of generation.

- **Every fault clearance is now a complete record.** The combination of SV-timestamped fault current samples, GOOSE-timestamped trip commands, and MMS-timestamped circuit breaker position changes gives the protection engineer a microsecond-accurate reconstruction of every protection operation — without any separate oscilloscope or manual recording. The IEC 61850 substation does not just clear faults faster; it remembers them with a precision that copper hardwiring never could.

---

## For Further Reading

1. Adamiak, M., Baigent, D., and Mackiewicz, R. (2009). "IEC 61850 Communications Networks and Systems in Substations: An Overview for Users." *GE Energy/GE Multilin*. Available at: https://www.gegridsolutions.com/products/techpapers/adamiak-baigent-etal-iec61850-overview-2009.pdf. The most widely referenced practitioner overview of GOOSE, MMS, and sampled values, written by engineers who participated in the development of the standard. Covers the GOOSE transmission sequence, the distinction between station bus and process bus, and the MMS service mapping in sufficient detail to serve as an implementation reference. Particularly clear on the retransmission pattern and the timeAllowedToLive watchdog, with worked timing diagrams for a variety of protection schemes.

2. IEC 61850-5:2013. "Communication networks and systems for power utility automation — Part 5: Communication requirements for functions and device models." International Electrotechnical Commission, Geneva. The normative source for GOOSE performance class requirements (Tables 7–10, message type classification). The Type 1A/1B distinction (trip signals vs. other fast messages), the P1/P2/P3 performance class definitions, and the time synchronisation accuracy classes (T1 through T6) are all defined here. Engineers designing the Ethernet network for an IEC 61850 process bus must satisfy the requirements in this part as a prerequisite to claiming compliance.

3. Eidson, J. C. (2006). *Measurement, Control and Communication Using IEEE 1588*. Springer, London. ISBN 978-1-84628-250-8. The definitive technical reference by the protocol's creator, covering the design principles of IEEE 1588-2002, the hardware timestamping architecture, the Best Master Clock Algorithm, and the performance characterisation of boundary clocks under typical LAN conditions. Chapter 5 (network topologies for substation applications) and Chapter 7 (performance measurement and uncertainty analysis) are directly applicable to the IEC 61850 process bus synchronisation requirements discussed in this chapter.

---

*Hanna ran the complete simulation at 11:15.*

*The test generator injected a synthetic fault current into the Bay 3 protection relay's SV subscription — not a real fault, but a sequence of samples that looked to the relay's differential algorithm exactly like a 8,400-ampere phase-to-phase fault two kilometres out on the feeder. Kaan watched the second monitor.*

*The GOOSE trip frame appeared in the capture 22.8 milliseconds after the injected fault — a red row in the stream, the stNum ticking up from 46 to 47. Three hundred and forty milliseconds later, a blue MMS row appeared: the buffered report from the bay controller, reporting that XCBR1.Pos.stVal had changed from closed to open. The complete record of a fault that had not actually happened, timestamped to the microsecond.*

*"In a copper-wired substation," Hanna said, "you would see a protection relay flag lamp illuminate. If you were lucky, you had an oscilloscope triggered to the event, and you could read the fault waveform off the paper record. You had to be standing in the right room at the right time." She exported the capture file to a folder labelled simulation\_20260325\_bay3. "This record will still be here in twenty years. Every microsecond of it. Whoever is here in twenty years will be able to reconstruct exactly what happened."*

*Kaan thought about Sigrid's calibration notebook — the timing tests in her handwriting, the green or red ink for pass or fail. The same data, but private, local, dependent on one person's discipline to exist at all. IEC 61850 had not replaced Sigrid's expertise. It had given her expertise a network to run on.*

*"What happens," he said, "if the switch fails?"*

*Hanna looked at him for a moment, then typed something into the simulation console. The SV stream stopped. On the second monitor, the rolling rows of multicast frames froze, then continued — but without the MU3 contributions, the eight-channel orange rows from Bay 3's merging unit.*

*"Protection relay," she said. The relay's BRCB report appeared: `PROT/LLN0$CO$Liveness = FALSE`. Loss-of-communication alarm. The differential protection function, deprived of its SV input, activated its fail-safe mode.*

*"The communication network," Hanna said, "is the protection system now. The switch is not passive infrastructure. It is an active component of the protection scheme." She cleared the simulation. "That question takes all of tomorrow."*

*It would. Chapter 30 was about the network itself.*

---

## Notes

[^1]: General Motors Corporation. MAP (Manufacturing Automation Protocol) specification, 1982–1988. The MAP initiative, announced by General Motors in 1980 and formally launched in 1982, set out to define a vendor-neutral factory automation communication architecture based on the ISO/OSI seven-layer model. The application layer protocol — the Manufacturing Message Specification (MMS) — was standardised as ISO 9506:1990 (Part 1: Service definition; Part 2: Protocol specification) and revised as ISO 9506:2003 (second edition). The origins of MMS in factory automation rather than power systems engineering are reflected in some of its terminology (the "domains" concept, which maps naturally to programmable logic controllers, and the "Journal" service, designed for machine event logging). When IEC TC57 adopted MMS as the transport for IEC 61850's Abstract Communication Service Interface, it selected a protocol that had already proven its structured data model and reliable delivery semantics in industrial environments, even though MAP itself had ultimately lost to TCP/IP-based Ethernet as the factory automation standard of record. The ISO 9506:2003 standard remains in force; the IEC 61850 mapping to MMS is defined in IEC 61850-8-1:2011 (Edition 2).

[^2]: IEC 61850-8-1:2011 (Edition 2). "Communication networks and systems for power utility automation — Part 8-1: Specific Communication Service Mapping (SCSM) — Mappings to MMS (ISO 9506-1 and ISO 9506-2) and to ISO/IEC 8802-3." International Electrotechnical Commission, Geneva. This part defines the normative mapping between the abstract ACSI service definitions (defined in IEC 61850-7-2) and the MMS PDU encoding, object naming, and ISO 9506 service primitives. Clause 7 covers the complete service-to-MMS PDU mapping (GetDataValues → MMS Read, SetDataValues → MMS Write, Report → MMS InformationReport, Control → MMS Write with structured return code). Annex A provides the mapping between IEC 61850 data types and MMS data type encodings, including the FLOAT32, INT32, BOOLEAN, and CODED ENUM types that appear most frequently in protection and metering logical nodes. Engineers implementing an IEC 61850 SCADA client or engineering tool must use this part alongside IEC 61850-7-2 (ACSI) and IEC 61850-7-4 (logical node classes) as the three primary implementation references.

[^3]: UCA International Users Group. "IEC 61850-9-2 LE Implementation Guideline." Published 2004. The "Light Edition" (LE) profile was developed by the UCA International Users Group — the industry consortium that manages interoperability testing and conformance for IEC 61850 implementations — to provide a practical, implementable subset of the full IEC 61850-9-2 specification (which contained several optional parameters that different manufacturers had implemented differently, causing interoperability failures in early process bus deployments). The LE profile mandates: sample rate options of 80 samples per period (protection and metering) or 256 samples per period (digital fault recorder quality); dataset structure of 8 analog channels (4 current + 4 voltage per CT/VT set) plus a sample counter; IEC 61588 (IEEE 1588) time synchronisation with accuracy class T3 (≤ 1 μs); and Ethernet frame encoding per IEC 61850-9-2. The LE profile was subsequently incorporated into the IEC 61869-9:2016 standard for instrument transformers with digital outputs, and the IEC 61850-9-2 Edition 2 (2011) aligned the normative specification with the LE profile's choices. For new projects as of 2024, the relevant normative reference is IEC 61869-9:2016 read in conjunction with IEC 61850-9-2:2011 Edition 2.

[^4]: Eidson, J. C., Fischer, M., and White, J. (2002). "IEEE-1588™ Standard for a Precision Clock Synchronization Protocol for Networked Measurement and Control Systems." *Proceedings of the 34th Annual Precise Time and Time Interval (PTTI) Systems and Applications Meeting*, Reston, Virginia, December 2002. IEEE, New York. The original conference paper presenting the IEEE 1588-2002 standard. Eidson was at Hewlett-Packard Laboratories in Palo Alto at the time of the standard's development; the test-and-measurement motivation (synchronising HP oscilloscopes and VXI instruments to better than 1-microsecond accuracy across LAN segments) is explicit in the paper's introduction. The key innovation — hardware timestamping at the physical layer of the Ethernet interface, rather than software timestamping in the operating system — is described in Section III. IEEE 1588-2008 (version 2) added backward-incompatible improvements including transparent clocks, power profile definitions, and enhanced security mechanisms; the relevant revision for power systems applications is the IEC 61850 Power Profile defined in IEC/IEEE 61850-9-3:2016, which maps the IEEE 1588-2008 protocol to the accuracy and topology requirements of process bus installations. The standard was revised again as IEEE 1588-2019, which added hybrid time distribution methods and improved the correction-field handling in transparent clocks.
