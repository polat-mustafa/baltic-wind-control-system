# Chapter 31: Cybersecurity: IEC 62443 Zones and Conduits

*The meeting room on the maintenance vessel was the only space on the project where Tomáš Blaha would agree to work.*

*He had explained this to the project manager by email before flying in from Gdańsk, and the project manager had assumed he meant something about network sensitivity — that he needed an isolated environment, or specific connectivity. He meant something different. Working inside the offshore substation while discussing its attack surface made him uncomfortable in the way that surgeons are uncomfortable operating on family members: too much at stake, too close to think clearly.*

*Tomáš Blaha was Czech, forty-two, from Brno, and he held a principal consulting role at a firm whose clients were European TSOs, large generators, and the ICS-CERT teams that investigated the incidents he spent years documenting. He wore a grey fleece with a small conference logo above the left breast pocket — S4 2024, the industrial control system security conference in Tampa — and civilian hiking trousers. On his keychain: a black Yubikey USB-A hardware security token. On his laptop lid: a single sticker, clean sans-serif, black on white: TRUST NO ONE. He meant it professionally.*

*He had been in the room since seven. When Kaan arrived at nine-fifteen, Tomáš was on his second paper cup of instant coffee — the only kind available on the vessel — and had not complained.*

*"You have been on the communications network for three weeks," Tomáš said, without looking up. "Tell me who authenticated you when you first plugged your laptop into the OSS."*

*Kaan thought about it. He had connected to the engineering maintenance port in the relay room, in his first week. Stefan had given him a username and password for the SCADA terminal. "I logged in to the SCADA server," he said. "With credentials."*

*"To the application layer," Tomáš said. He turned his laptop screen around. A zone diagram filled it — coloured rectangles arranged in concentric bands: green at the centre, yellow, then orange, then red at the perimeter. Narrow arrows connected them, each labelled with a protocol name. "But the Ethernet switch in the comms room did not ask who you were. The GOOSE subscription on the protection relay does not authenticate the source of the multicast frame. The IEC 60870-5-104 command session to Warsaw does not verify that a command originates from an authorised source before the gateway passes it downstream." He paused. "Every device you studied with Hanna and Katrijn is talking to every other device. None of them can confirm whether the message arrived from the right sender."*

*He closed his laptop to the angle of a music stand.*

*"That is what I am here to address."*

---

## 31.1 The Air Gap Was Never Solid

For the first two decades of industrial control system deployment, the standard security model was geographical: the SCADA network and the corporate IT network occupied different buildings, or at least different racks, with no direct connection between them. The industrial network was assumed to be unreachable from the public internet, and therefore immune to the threats that occupied IT security teams — viruses, credential theft, ransomware. This assumption was called the air gap. It was wrong before it was tested, and it was tested definitively in June 2010.

The malware known as Stuxnet was first identified by Belarusian security firm VirusBlokAda in June 2010, after Siemens reported unusual PLC behaviour at customer sites in Iran.[^1] Initial analysis established that Stuxnet was unlike any malware previously encountered: it exploited not one but four zero-day vulnerabilities in Windows — a number reflecting either extraordinary resources or extraordinary motivation — and it carried payload code targeting a very specific combination of industrial hardware. The target was the Siemens SIMATIC S7-315 and S7-417 programmable logic controllers running frequency converter drives manufactured by two specific companies: Fararo Paya, an Iranian firm, and Vacon of Finland.[^2]

The specificity was the point. Those frequency converters were used in uranium gas centrifuge cascades at the Natanz enrichment facility. A uranium hexafluoride centrifuge rotor spins at between 807 and 1,064 Hz; the malware was programmed to periodically command the drives to 1,410 Hz and then drop them abruptly to 2 Hz, in a sequence timed to cause mechanical stress on the carbon-fibre rotors while the monitoring software continued to display nominal readings. An Iranian operator watching the SCADA screen saw normal operation. The centrifuges were failing.

The air gap at Natanz was real. The Natanz network had no internet connection. Stuxnet crossed it via a USB drive carried by a maintenance contractor, exploiting a Windows shortcut vulnerability — MS10-046 — that triggered automatically when a user opened a folder in Windows Explorer.[^3] The attacker did not need to compromise the plant's network perimeter. The attacker waited for a human to carry the media across the boundary in a trouser pocket.

The lesson was not subtle. An air gap delays an attacker by the time required to find one person inside the target perimeter who will handle removable media. At Natanz, the answer was measured in weeks.

For the offshore wind industry, the air gap equivalent — a firewall at the network edge, vendor laptops brought onsite for commissioning, OPC-DA connections from the SCADA server to a corporate data historian — was no more solid. Engineers carried USB drives for firmware updates. Remote-access sessions for vendor maintenance were opened on request and not always closed promptly. Each necessary convenience was a crack in the physical isolation model.

IEC 62443 was not written as a response to Stuxnet specifically, but it formalised the architectural principle that physical isolation alone cannot be a security strategy: the system must be designed to function securely even when an adversary has already entered the perimeter.

---

## 31.2 The Zone and Conduit Model

IEC 62443 — originally the ISA-99 standard from the International Society of Automation, co-published with the IEC as the IEC/ISA 62443 family — organises industrial cybersecurity around two fundamental concepts: **zones** and **conduits**.[^4]

A **zone** is a grouping of assets with similar security requirements and common operational function. The boundary of a zone is defined not by geography or equipment type but by the communication policy that applies to all assets within it. Devices in the same zone share the same trust level: they communicate freely with each other, and the zone boundary is where the policy enforcement happens.

A **conduit** is the defined communication path between two zones. The conduit specifies not only which zones can communicate but which protocols, data flows, and directions are permitted. A conduit is not a cable; it is a policy — implemented in firewalls, protocol gateways, or application-level filters — that permits certain messages through and blocks everything else. The conduit is the wall with a specifically sized hole that replaces the air gap's assumption of no holes at all.

**Why grouping matters**

The alternative to the zone model — securing each of the 49 IEDs in the OSS as an individual island, with individual authentication policies and individual firewall rules — would require every pair of devices to be explicitly addressed:

$$
N_c(\text{flat}) = \frac{N(N-1)}{2}
$$

where:
- $N$ = number of devices in a flat, unsegmented network [-]
- $N_c$ = number of pairwise communication paths requiring individual policy [-]

With 49 IEDs: $N_c = (49 \times 48)/2 = 1{,}176$ paths. A security engineer auditing 1,176 paths will miss some. A zone model with five zones and six defined conduits reduces the same audit to six policy documents, each covering one inter-zone interface.

**The five-zone architecture**

For an offshore substation with 34 wind turbines and a grid connection to PSE Warsaw, IEC 62443 practice defines five zones plus a demilitarised zone (DMZ):

| Zone | Name | Representative assets | SL target |
|------|------|-----------------------|-----------|
| Z1 | Safety | Emergency shutdown systems, arc flash detection, SF₆ density monitors | SL3 |
| Z2 | Protection and control | Process bus, merging units, bay controllers, protection relays | SL3 |
| Z3 | Station automation | SCADA server, historian, PPC gateway, IEC 61850 configuration server | SL2 |
| Z4 | Operations | Engineering workstations, operator HMI terminals, alarm server | SL2 |
| DMZ | Demilitarised zone | Protocol gateways, remote-access proxies, data historians | SL3 |
| Z5 | Enterprise / WAN | IEC 60870-5-104 link to PSE Warsaw, vendor VPN endpoint | SL1 |

Each conduit between zones defines the permitted protocols, the direction of data flow, and the specific endpoints. The conduit between Z2 and Z3 permits IEC 61850 MMS in both directions for configuration reads; it permits GOOSE from Z2 to Z3 only, because a protection relay should receive trip commands from other protection devices within Z2, not from a SCADA server in Z3.

<!-- IMAGE: fig-31-01 -->
> **[Figure 31.1]** — Zone and Conduit Architecture for a 500 MW Offshore Substation
> **Type:** Hierarchical zone diagram with conduit labels
> **Content:** Five concentric rectangular bands from centre outward: Z1 (Safety, dark green), Z2 (Protection, blue), Z3 (Automation, yellow), Z4 (Operations, light orange), Z5 (Enterprise, red). A DMZ band in grey bridges Z4 and Z5 on the right side. Narrow arrows between zones labelled with protocol names and direction indicators: Z2↔Z3: "MMS (bidirectional), GOOSE (Z2→Z3 only)"; Z3↔Z4: "MMS read-only (Z3→Z4)"; Z4↔DMZ: "OPC-UA (outbound only)"; DMZ↔Z5: "IEC 60870-5-104 / TLS 1.3, vendor VPN (authenticated inbound)". Firewall icons with padlock at each boundary.
> **Caption:** The five-zone architecture for an offshore substation. Each zone contains assets sharing similar security requirements; conduits define which protocols may cross each boundary and in which direction. The demilitarised zone acts as a protocol-translation buffer between the station automation network and the external WAN.
> **Alt text:** Concentric zone diagram with five colour-coded rectangular bands representing Z1 through Z5, with conduits and protocol labels between zones.
> **Data source:** Author illustration based on IEC 62443-3-3:2013 Annex A and IEC/TR 62443-3-1:2009.
> **Resolution:** 1400 × 1000 px
> **Color notes:** Z1 dark green, Z2 blue, Z3 yellow, Z4 light orange, DMZ grey, Z5 red.

> **Standard reference:** IEC 62443-2-1:2010, "Security for industrial automation and control systems — Part 2-1: Establishing an IACS security programme" — Clause 4.2.3.3 (zone partitioning) and Clause 4.3.3.3 (conduit definition requirements).

---

## 31.3 Security Levels: SL1 through SL4

IEC 62443 does not treat all industrial systems as equally threatened. A water utility's remote pump station and an offshore substation connected to a 220 kV grid require different security architectures — not because their protocols are different, but because their adversary population is different.

The standard defines four **security levels** (SL), each calibrated against a specific category of threat actor:[^5]

- **SL1** protects against casual or unintentional violations: misconfigured equipment, employees who accidentally access the wrong system, commodity malware spreading indiscriminately without targeting specific infrastructure.

- **SL2** protects against simple intentional means with low motivation: an attacker using commercially available tools and standard exploitation frameworks (Metasploit, Shodan), requiring no specialist ICS knowledge. A disgruntled contractor using a phishing email to obtain SCADA credentials and exploring the network with a port scanner is an SL2 threat actor.

- **SL3** protects against sophisticated means with ICS-specific knowledge: an attacker who understands IEC 61850, SCADA ladder logic, and the operational sequence of a wind farm, using custom tools built for industrial control system exploitation. The teams that wrote BlackEnergy3 and Industroyer were SL3 threat actors.

- **SL4** protects against state-sponsored actors with significant resources, time, and the ability to develop zero-day exploits against industrial hardware. The team that developed Stuxnet was an SL4 threat actor.

The security level requirement for a given zone is written as an inequality. After implementing the zone's countermeasures, the **achieved security level** (SL-A) must satisfy:

$$
SL_A \geq SL_T
$$

where:
- $SL_A$ = achieved security level, determined by countermeasures implemented [-]
- $SL_T$ = target security level, determined by risk assessment and regulatory requirements [-]

**Risk-based level assignment**

The SL-T for each zone is derived from the likelihood-consequence risk product:

$$
R_i = P_i \times C_i
$$

where:
- $R_i$ = risk score for threat scenario $i$ [-]
- $P_i$ = likelihood of the threat scenario (1 = very unlikely, 5 = expected) [-]
- $C_i$ = consequence severity (1 = minor, 5 = catastrophic) [-]

For an unauthorised GOOSE trip command injected into Z2: $P = 3$ (plausible given known threat actor profiles targeting European generation), $C = 5$ (510 MW loss, potential grid stability event). $R = 15$ — the maximum score, requiring SL3 or SL4 controls. SL4 is reserved for life-safety-critical systems (Z1, safety instrumented systems). SL3 is the appropriate assignment for Z2.

---

## 31.4 IEC 62351: Authentication and Encryption for Grid Protocols

The IEC 61850 base specification, published in its first edition in 2003–2005, does not include source authentication for GOOSE messages. A GOOSE frame carries the sending device's logical node identifier — the DATA-SET reference and APPID field — but the Ethernet protocol provides no cryptographic mechanism to verify that the frame was actually sent by the device that claims to have sent it. Any device on the same VLAN can construct a valid GOOSE frame with any APPID value and inject it onto the network.

IEC 62351-6 addresses this by adding a **Message Authentication Code** (MAC) to the GOOSE protocol data unit.[^6] The MAC is computed using HMAC-SHA256: a keyed cryptographic hash that can be verified only by a device holding the same shared key.

$$
\text{HMAC}(K,\, m) = H\!\bigl((K \oplus opad)\, \|\, H\!\bigl((K \oplus ipad)\, \|\, m\bigr)\bigr)
$$

where:
- $K$ = pre-shared authentication key, distributed to all subscribing IEDs [256 bits]
- $m$ = GOOSE APDU bytes to be authenticated [-]
- $H$ = SHA-256 cryptographic hash function (256-bit output) [-]
- $opad$ = outer padding constant: 0x5c byte repeated 32 times [-]
- $ipad$ = inner padding constant: 0x36 byte repeated 32 times [-]
- $\|$ = byte concatenation

IEC 62351-6 truncates the HMAC output to 64 bits to accommodate GOOSE frame size constraints while maintaining sufficient authentication strength. The truncated MAC is appended to the GOOSE APDU before transmission. Subscribing IEDs recompute the HMAC independently and compare the truncated result; a mismatch causes the frame to be discarded and a security log entry to be raised.

The computational cost of HMAC-SHA256 on an IED with a hardware security coprocessor is approximately 0.05 ms per operation. Verification at the subscriber adds a further 0.05 ms:

$$
T_{\text{auth}} = T_{\text{HMAC,tx}} + T_{\text{HMAC,rx}} = 0.05 + 0.05 = 0.10 \ \text{ms}
$$

Residual budget for network delivery: $3.00 - 0.10 = 2.90$ ms. From Chapter 30: PRP delivery = 15.4–20.6 μs, HSR delivery = 56.2 μs. Both fit within the 2.90 ms residual. Authentication does not compromise the timing budget.

**TLS for MMS and IEC 60870-5-104**

GOOSE operates at Ethernet Layer 2 and cannot use TLS. For TCP-based protocols — IEC 61850 MMS (port 102) and IEC 60870-5-104 (port 2404) — IEC 62351-3 specifies TLS 1.3.[^7] The cipher suite for power system applications is TLS\_AES\_256\_GCM\_SHA384: AES-256-GCM for authenticated encryption, SHA-384 for the handshake transcript, ECDHE for key exchange (providing forward secrecy), and ECDSA for the server certificate signature. The TLS 1.3 handshake completes in one round-trip after the initial ClientHello, adding approximately 2–5 ms to MMS session establishment — acceptable, since MMS sessions are long-lived rather than per-message.

**RBAC and password policy**

IEC 62351-8 defines **Role-Based Access Control** for power system applications.[^8] Four standard roles are defined:

| Role | Permitted operations |
|------|---------------------|
| Viewer | Read-only access to measurements and event logs |
| Operator | Circuit breaker control and setpoint adjustments within limits |
| Engineer | Configuration changes, protection settings, firmware updates |
| Security Administrator | User accounts, key management, security log access |

The minimum password entropy for SL3 applications, derived from NIST SP 800-63B guidance, is 80 bits:

$$
H = L \cdot \log_2 N
$$

where:
- $H$ = password entropy [bits]
- $L$ = password length [characters]
- $N$ = alphabet size — number of possible characters per position [-]

For a 12-character password using upper case, lower case, digits, and symbols ($N = 95$): $H = 12 \times \log_2 95 = 12 \times 6.57 \approx 78.8$ bits — marginally below the 80-bit target. Thirteen characters gives $H \approx 85$ bits, satisfying SL3.

Password entropy is necessary but not sufficient for SL3. IEC 62351-8 requires multi-factor authentication for Engineer and Security Administrator roles: a knowledge factor (password) combined with a possession factor — a hardware security token. Tomáš's Yubikey generates a FIDO2/WebAuthn authentication assertion cryptographically bound to the specific application's origin, preventing phishing-based credential interception even if an attacker controls a man-in-the-middle proxy. The hardware token cannot be duplicated and cannot be tricked into authenticating to a spoofed application.

<!-- IMAGE: fig-31-02 -->
> **[Figure 31.2]** — IEC 62351 Security Layers for OSS Communication
> **Type:** Protocol stack comparison diagram (two columns)
> **Content:** Left column "GOOSE Stack" (bottom to top): Physical (fibre, 100BaseX), Ethernet II (with VLAN tag 802.1Q), GOOSE APDU (IEC 61850-8-1), IEC 62351-6 HMAC-SHA256 authentication tag (highlighted in orange). Right column "MMS / IEC 60870-5-104 Stack" (bottom to top): Physical, Ethernet, IP / TCP, TLS 1.3 session (IEC 62351-3, highlighted in orange), MMS/ACSI (IEC 61850-8-1) or IEC 60870-5-104 ASDU. Both stacks capped with "RBAC role check (IEC 62351-8)" block in orange. Label annotations: "64-bit truncated MAC" pointing to GOOSE stack authentication layer; "AES-256-GCM + SHA-384 + ECDHE" pointing to TLS block.
> **Caption:** IEC 62351 adds authentication to every grid protocol stack. GOOSE receives a 64-bit HMAC-SHA256 tag appended to the APDU. MMS and IEC 60870-5-104 receive a TLS 1.3 session providing authenticated encryption and forward secrecy. RBAC role checks at the application layer control which operations a given authenticated identity may perform.
> **Alt text:** Two-column protocol stack diagram showing HMAC authentication in the GOOSE stack and TLS 1.3 in the MMS/IEC 60870-5-104 stack, with RBAC role checking at the application layer in both.
> **Data source:** Author illustration based on IEC 62351-3:2014 (TLS), IEC 62351-6:2020 (GOOSE/GSSE security), IEC 62351-8:2011 (RBAC).
> **Resolution:** 1200 × 900 px
> **Color notes:** Authentication elements in orange, GOOSE stack in blue, MMS stack in green.

---

## 31.5 Real-World OT Attacks: Four Incidents That Changed the Field

Security requirements in technical standards are written in response to events. The four incidents below trace an escalation over fourteen years — from proof of concept to infrastructure attack to protocol-specific attack to life-safety threat — and explain why IEC 62443 and IEC 62351 carry the requirements they do.

**Stuxnet — 2010**

Section 31.1 described the Stuxnet propagation mechanism and the frequency converter payload. The more important lesson for power systems engineers is the operational intelligence embedded in the malware. Stuxnet did not attempt to damage all SCADA systems it encountered; it checked for the precise combination of Siemens Step 7 software, specific PLC firmware, and specific frequency converter manufacturers before activating its destructive payload. Only the exact target was attacked.

This specificity required extraordinary knowledge of the target's operational environment: which PLC models, which frequency ranges, which monitoring configuration. The attackers had built what amounted to a digital replica of the Natanz centrifuge process in order to know exactly which commands to send and which readings to falsify. If one team had demonstrated this capability against a physically isolated network, the capability would be applied elsewhere. Everyone in the ICS security community understood this in 2010.

**Ukraine power grid — December 23, 2015**

At 15:30 Kiev Standard Time on December 23, 2015, circuit breakers began opening at three Ukrainian distribution companies — Prykarpattia Oblenergo, Chernivtsioblenergo, and Kyivoblenergo — leaving approximately 230,000 customers without power in the middle of a Ukrainian winter.[^9]

The attack had begun months earlier, with spear-phishing emails carrying malicious Word documents. When opened, the documents executed macros that installed BlackEnergy3 malware — a remote-access trojan originally developed for distributed denial-of-service botnets, repurposed by the threat group (later attributed to Russia's GRU Sandworm unit) for ICS intrusion. The malware provided persistent remote access to the utilities' corporate networks; from there, the attackers moved laterally to the SCADA HMI workstations over the months that followed, learning the systems before acting.

On the attack date, the operators remotely controlled the SCADA HMIs, manually clicking through the software interface to open circuit breakers — exactly as a legitimate operator would, but from thousands of kilometres away. Simultaneously, they deployed KillDisk malware to overwrite the SCADA workstation operating systems, slowing recovery. They called the utilities' customer service centres with fake reports to saturate the phone lines while operators tried to restore power.

The 2015 Ukraine attack was the first confirmed cyberattack to cause a power outage. It was not the last.

**Industroyer — December 17, 2016**

Twelve months later, Ukrenergo — Ukraine's national transmission company — experienced a blackout at the Pivnichna (Northern) substation in Kyiv lasting approximately 75 minutes and affecting 200 MW of load: roughly one-fifth of the city's winter demand.[^10]

The malware responsible, named Industroyer by ESET and Crashoverride by Dragos, was categorically different from BlackEnergy3. It was not a general-purpose trojan adapted for ICS use. It was purpose-built to attack power grid control systems, with individual payload modules implementing four specific protocols: IEC 60870-5-101, IEC 60870-5-104, DNP3 — and IEC 61850.

The IEC 61850 module sent crafted GOOSE messages to the substation's IEDs, commanding protection relays to operate circuit breakers. The module enumerated the GOOSE multicast groups on the substation LAN, identified the APPID values associated with circuit breaker trip logic, and injected GOOSE frames replicating the format of legitimate trip commands. Because the base IEC 61850 specification has no source authentication — exactly the gap that IEC 62351-6 was designed to fill — the receiving relays had no mechanism to distinguish an Industroyer-generated GOOSE frame from one transmitted by the legitimate bay controller.

The connection is direct. The GOOSE protocol analysed in Chapter 29, transmitted on the process bus described in Chapter 30, was the specific mechanism that Industroyer weaponised in December 2016. Every GOOSE frame Kaan had watched crossing Hanna's packet analyser was structurally identical to the frame the malware had learned to construct. The retransmission timing — the exponentially increasing intervals that Hanna had described as the protocol's freshness mechanism — also simplified injection: one correctly addressed frame was enough.

**TRITON/TRISIS — 2017**

The three incidents above targeted availability: their goal was to stop power. The attack discovered at a Middle Eastern petrochemical facility in 2017 — independently named TRITON by Mandiant and TRISIS by Dragos — targeted safety.[^11]

The Triconex Safety Instrumented System is an independent controller designed by Schneider Electric to detect unsafe process conditions and drive the plant to a safe state if conditions exceed defined limits. A SIS is by design independent of the main process control system; it receives sensor inputs directly, evaluates safety logic, and actuates emergency functions without any instruction from the operator. It is the last line of defence before a physical process event.

The TRITON attackers modified the firmware of the Triconex controllers to accept unauthorised commands — removing the safety system's independence in a way that would be invisible to operators. A subsequent process upset would then fail to trigger the safety response designed to prevent it. The physical consequence could have been an explosion or toxic release.

The attack was discovered not through security monitoring but through a bug in the attackers' own code. An error in the firmware modification routine caused the Triconex controller to detect an inconsistent memory state and enter its own fail-safe mode — triggering an unplanned plant shutdown. When technicians investigated the cause of the shutdown, they found the modified firmware.

The TRITON incident crossed a line. Every previous ICS attack had targeted availability. TRITON targeted the system designed to prevent casualties. For power systems engineers, the implication was specific: an emergency shutdown system inside an offshore substation — arc flash detection logic, transformer fire suppression, SF₆ release monitoring — carries a TRITON-class threat profile that IEC 62443 SL3 or SL4 controls must address.

---

## 31.6 Worked Example: Security Architecture for a 500 MW Offshore OSS

### Step 1 — Asset inventory and zone allocation

The OSS contains 49 IEDs distributed across functional groups. Each device is assigned to the zone with the lowest trust level that still allows it to perform its operational function — the principle of least privilege.

| Zone | Devices | Count |
|------|---------|-------|
| Z1 (Safety) | Emergency shutdown logic, arc flash detection relays, SF₆ density monitors | 5 |
| Z2 (Protection) | Merging units, bay controllers, protection relays (87T, 87L, 67Q, ROCOF) | 12 |
| Z2 extension (WTG) | 34 turbines × 1 IEC 61850 IED each, communicating via 66 kV array fibre | 34 |
| Z3 (Automation) | SCADA server, historian, PPC gateway, IEC 61850 configuration server | 8 |
| Z4 (Operations) | Engineering workstations, operator HMI terminals, alarm server | 4 |
| DMZ | Protocol gateway (MMS → OPC-UA), remote-access proxy | 3 |
| Z5 (Enterprise) | IEC 60870-5-104 WAN connection to PSE Warsaw, vendor VPN endpoint | 2 (logical) |

### Step 2 — Security level assignment

$$SL_A \geq SL_T$$

| Zone | SL-T | Primary justification |
|------|------|-----------------------|
| Z1 | SL3 | Life-safety consequence; EU NIS2 Directive "essential services" obligation |
| Z2 | SL3 | 510 MW trip consequence; GOOSE injection attack vector proven by Industroyer |
| Z3 | SL2 | SCADA data integrity; no direct circuit breaker command capability |
| Z4 | SL2 | Workstations accessible via phishing; no direct HV command authority |
| DMZ | SL3 | WAN boundary — highest external exposure |
| Z5 | SL1 | External WAN; PSE Warsaw holds independent cybersecurity obligations |

### Step 3 — Conduit inventory

Six conduits define the complete set of permitted inter-zone communication:

| Conduit | Boundary | Permitted protocols | Direction | Enforcement mechanism |
|---------|----------|--------------------|-----------|-----------------------|
| C1 | Z2 ↔ Z3 | GOOSE (trip signals), MMS reads | GOOSE Z2→Z3 only; MMS bidirectional | VLAN isolation, stateful firewall |
| C2 | Z3 → Z4 | OPC-UA (read-only), alarm data | Z3→Z4 only | Unidirectional gateway |
| C3 | Z4 → DMZ | HTTPS (alarm export), OPC-UA historian write | Z4→DMZ only | Application-layer proxy |
| C4 | DMZ ↔ Z5 | IEC 60870-5-104 / TLS 1.3, vendor VPN | DMZ→Z5 outbound; VPN inbound authenticated | Encrypted tunnel, certificate-authenticated |
| C5 | Z1 → Z2 | Emergency trip relay — hardwired SIL 2 | Physical output only | No Ethernet path exists by design |
| C6 | Z2 (WTG) ↔ Z2 | IEC 61850 MMS, GOOSE (curtailment, WTG trip) | Bidirectional within Z2 | VLAN segmentation within Z2 perimeter |

Conduit C5 is not a network conduit at all. The safety zone communicates with the protection zone via hardwired relay output — a physical signal with no Ethernet path. This is the TRITON lesson applied: if the communication cannot be compromised digitally, it cannot be used as an attack vector. Physical design eliminates an entire class of threat.

### Step 4 — GOOSE authentication overhead

For Zone 2, HMAC-SHA256 authentication (IEC 62351-6) is mandatory at SL3. The overhead against the 3 ms Type 1A budget:

$$
T_{\text{auth}} = T_{\text{HMAC,tx}} + T_{\text{HMAC,rx}} = 0.05 + 0.05 = 0.10 \ \text{ms}
$$

Residual budget for network delivery: $3.00 - 0.10 = 2.90$ ms. PRP station-bus delivery (Chapter 30): 15.4–20.6 μs. HSR process-bus delivery: 56.2 μs. Both comfortably within the 2.90 ms residual. Security does not compromise timing.

The 64-bit truncated MAC provides $2^{64} \approx 1.8 \times 10^{19}$ possible authentication values. An attacker without the key has a $1 \text{ in } 2^{64}$ probability of forging a valid MAC for any given frame — computationally infeasible with current hardware within any operationally relevant time horizon.

### Step 5 — Security monitoring

An SL3 zone requires real-time security monitoring exported to a Security Information and Event Management (SIEM) system. Expected alert rates under normal operation:

| Event type | Expected rate | Alert threshold |
|------------|--------------|-----------------|
| GOOSE HMAC validation failures | 0 / day | Any occurrence triggers incident response |
| TLS certificate expiry warnings | 44 / year (one per Z2 IED certificate) | 60 days before expiry |
| RBAC failed authentication | 2–5 / week (operator password mistype) | >10 failures / hour from one source |
| Unauthorised VLAN access attempts | 0 / day | Any occurrence triggers investigation |

The SIEM connection runs from the SCADA server (Z3) outbound through Conduit C3 and C4 to a cloud-hosted SIEM. The connection is strictly one-directional — the SIEM platform cannot send commands inbound through the DMZ — preventing the monitoring system from becoming an entry point into the operational zones.

<!-- IMAGE: fig-31-03 -->
> **[Figure 31.3]** — GOOSE Authentication Timing Budget
> **Type:** Horizontal stacked bar chart
> **Content:** A single horizontal bar representing the 3.00 ms GOOSE Type 1A budget, divided into four labelled segments left to right: (1) HMAC computation at sender: 0.05 ms, orange; (2) Network delivery (PRP best path): 0.016 ms, blue; (3) HMAC verification at receiver: 0.05 ms, orange; (4) Remaining margin: 2.884 ms, green. Total bar labelled "3.00 ms (GOOSE Type 1A budget)". Annotation above orange segments: "Authentication overhead: 0.10 ms (3.3%)". Annotation above green segment: "Margin: 2.88 ms (96%)".
> **Caption:** HMAC-SHA256 authentication (IEC 62351-6) consumes 0.10 ms of the 3.00 ms GOOSE Type 1A budget — 3.3% of available time. The 96% margin accommodates both PRP station-bus and HSR process-bus delivery latencies with room to spare. Adding authentication to GOOSE does not compromise the protection timing requirements established in Chapters 26 and 29.
> **Alt text:** Horizontal stacked bar showing the 3 ms GOOSE budget divided into HMAC computation overhead (orange, 3.3%) and remaining timing margin (green, 96%).
> **Data source:** HMAC timing from IEC 62351-6 reference implementation benchmarks; network latency from Chapter 30 worked example.
> **Resolution:** 1200 × 400 px
> **Color notes:** HMAC overhead in orange, network delivery in blue, margin in green.

---

## Key Takeaways

- **The air gap assumption collapsed with Stuxnet in 2010.** An attacker who cannot breach the network perimeter can carry the threat across on a USB drive in a maintenance contractor's pocket. Physical isolation is a layer of security; it is not a security model. IEC 62443 assumes the attacker may already be inside the perimeter and controls what they can do from there.

- **The zone and conduit model replaces 1,176 unmanaged pairwise paths with six explicitly permissioned conduits.** Devices within a zone communicate freely; inter-zone communication must traverse a conduit permitting only specific protocols, directions, and data flows. The reduction in audit surface is the primary security benefit.

- **Security levels SL1–SL4 calibrate requirements against the adversary's capability, not against the system's complexity.** Zone 2 targets SL3 — sophisticated actors with ICS-specific knowledge — because the consequence of a successful attack justifies the cost of SL3 controls. Zone 1 safety systems target SL3 for the same reason, with hardwired physical outputs removing the Ethernet attack surface entirely.

- **Industroyer's IEC 61850 GOOSE module demonstrated in December 2016 that grid protocols are attack vectors, not just communication channels.** The HMAC-SHA256 mechanism in IEC 62351-6 directly addresses the unauthenticated-source vulnerability that Industroyer exploited. The 0.10 ms authentication overhead is negligible against the 3 ms Type 1A budget.

- **TRITON redefined the threat consequence classification for safety instrumented systems.** An SIS that can be compromised silently — its emergency shutdown logic modified without visible effect — no longer performs its design function. Physical separation (no Ethernet path from Z1 to Z2) eliminates this attack surface at the architectural level rather than relying on authentication to prevent access.

---

## For Further Reading

1. Langner, R. (2011). "Stuxnet: Dissecting a Cyberweapon." *IEEE Security & Privacy*, 9(3), pp. 49–51. DOI: 10.1109/MSP.2011.67. The most widely read technical analysis of Stuxnet written for a control systems engineering audience, by the German ICS security researcher who first identified the PLC payload's operational purpose. Three pages, deliberately accessible; introduces the term "cyber weapon" to the ICS vocabulary and describes the centrifuge frequency manipulation logic in terms that power systems engineers will recognise directly. Langner's longer working papers (langner.com) provide the complete PLC code disassembly. Assigned as introductory reading in most post-graduate OT security courses in Europe.

2. IEC 62443-3-3:2013. "Security for industrial automation and control systems — Part 3-3: System security requirements and security levels." International Electrotechnical Commission, Geneva. The normative standard defining security levels SL1–SL4 and the 82 security requirements (SR 1.1 through SR 7.8) applicable at each level. Annex A provides the zone and conduit implementation guidance; Annex C provides the threat actor profiles that define the four levels. Engineers designing the cybersecurity architecture of an offshore substation should treat this document alongside IEC 62443-2-1:2010 as the primary normative references. IEC 62443-4-2:2019 covers component-level security requirements applicable to IED vendors; IEC 62443-3-2:2020 provides the risk assessment methodology referenced in Section 31.3.

3. Cherepanov, A. (2017). "WIN32/INDUSTROYER: A New Threat for Industrial Control Systems." ESET White Paper, June 2017. Available at: welivesecurity.com. The original technical analysis of Industroyer by the ESET team that reverse-engineered it, published simultaneously with Dragos's "CRASHOVERRIDE" report. Section 5.4 of the white paper covers the IEC 61850 GOOSE payload module, including the APPID enumeration algorithm and the frame injection mechanism described with reference to the IEC 61850-8-1 APDU structure. Engineers who have read Chapter 29 of this book will find the Industroyer GOOSE analysis directly comprehensible — it reads as a reverse engineering of the same protocol. Dragos's parallel analysis covers the operational campaign context. ESET's Industroyer2 follow-on analysis (April 2022) documents a more sophisticated variant targeting Ukrainian substations during the 2022 conflict.

---

*Tomáš closed his laptop at half past three.*

*He had covered the zone model, the security levels, the four incidents, and the authentication overhead in six hours — with one thirty-minute break that he used to walk to the stern and look at the turbines without speaking.*

*"One last thing," he said, picking up his keychain. He held up the Yubikey. "Everything we discussed today is about digital access: who is allowed to send a message, over this protocol, with these credentials." He turned the token over once and slipped it back onto the ring. "There is a second access control problem. Who is allowed to physically touch this device. Walk into this room. Open this cabinet."*

*He picked up his laptop bag.*

*"Those two systems — the digital access layer and the physical access layer — are the same idea expressed in different domains. Every user in Zone 4 carries RBAC credentials that say what they are allowed to command through the software. Every engineer who walks into the OSS should carry a permit that says what they are allowed to touch in the physical world." He paused at the door. "Tomorrow you are meeting someone who does the physical version of what I just described."*

*Kaan sat for a moment after the door closed. He looked at his notebook — three pages of zone diagrams, security level tables, and a rough sketch of the protocol stack with the HMAC annotation in the margin. He thought about Industroyer: a piece of software that had learned to speak GOOSE fluently and used that fluency to open circuit breakers in a Kyiv substation in December 2016. He thought about the 49 IEDs in the OSS above him, now running IEC 62351-6 authentication — the 64-bit MAC value appended to every GOOSE frame, the tag that was either correct or was not.*

*A correctly-addressed message, from the wrong source. That had been the problem stated at the end of Chapter 30.*

*Now there was an answer. Whether the answer was adequate depended on the attacker.*

*He looked at his notebook a moment longer, then turned to the last blank page and drew a single rectangle: the OSS. Inside it, five coloured zones. Around it, a dotted boundary. Outside the boundary, he wrote two letters and a number: SL4.*

*Then he closed the notebook and went up to dinner.*

---

## Notes

[^1]: Falliere, N., Murchu, L. O., and Chien, E. (2011). *W32.Stuxnet Dossier*, Version 1.4. Symantec Security Response, February 2011. Available at: symantec.com. The definitive technical analysis of Stuxnet, covering all four zero-day exploits (MS10-046 LNK shortcut, MS10-061 Print Spooler, MS08-067 NetAPI, and MS10-073 Task Scheduler privilege escalation), the Command-and-Control mechanism, the Step 7 project-file infection logic, and the PLC payload for Siemens S7-315 and S7-417 controllers. Approximately 100,000 computers in 155 countries were infected by the propagation component; only sites operating Siemens S7-300/400 PLCs connected to Fararo Paya or Vacon frequency converters in the 807–1,064 Hz operating range triggered the destructive payload. VirusBlokAda (Minsk, Belarus) first identified the malware in June 2010 after being contacted by an Iranian client reporting recurring Windows crashes on industrial computers.

[^2]: The Fararo Paya / Vacon targeting detail was first published publicly in Falliere et al. (2011), op. cit., Section 3.4.2. Kim Zetter's *Countdown to Zero Day: Stuxnet and the Launch of the World's First Digital Weapon* (Crown Publishers, New York, 2014) provides the most complete unclassified account of the operational context, including attribution. Attribution to a joint US-Israeli programme (code-named "Olympic Games") was confirmed by David Sanger in *Confront and Conceal* (Crown, 2012) and later reported by multiple US news organisations. The centrifuge operating frequency range (807–1,064 Hz) and the malware's attack sequence (1,410 Hz → 2 Hz) are documented in Falliere et al. Section 6.

[^3]: Microsoft Security Advisory 2286198 / MS10-046. "Vulnerability in Windows Shell Could Allow Remote Code Execution." Microsoft Corporation, July 16, 2010. The LNK shortcut vulnerability was the primary USB propagation mechanism: browsing a folder containing a specially crafted .LNK file in Windows Explorer triggered payload execution without any user interaction beyond folder navigation. Affected systems: Windows XP SP3, Vista, 7, Server 2003, Server 2008 R2. Patched in the July 2010 out-of-band security release.

[^4]: IEC 62443-2-1:2010. "Security for industrial automation and control systems — Part 2-1: Establishing an IACS security programme." International Electrotechnical Commission, Geneva, October 2010. Zone partitioning is defined in Clause 4.2.3.3; conduit requirements in Clause 4.3.3.3. The IEC 62443 series was developed by ISA Committee ISA-99 and co-published by ISA and IEC. The multi-part structure covers security management systems (Part 2-x), system-level requirements (Parts 3-x), and component-level requirements (Parts 4-x). Early intellectual foundations of the zone and conduit model for IACS are traced to: Byres, E. and Lowe, J. (2004). "The Myths and Facts behind Cyber Security Risks for Industrial Control Systems." *VDE Congress*, Berlin, 2004 — an early articulation of zone segmentation principles applied to industrial Ethernet.

[^5]: IEC 62443-3-3:2013. "Security for industrial automation and control systems — Part 3-3: System security requirements and security levels." IEC, Geneva, 2013. Security Levels 1–4 are defined in Clauses 3.2.88–3.2.91 and elaborated in Clause 4.1. SL definitions are intentionally technology-agnostic — they characterise threat actor profiles, not specific countermeasures, to allow the standard to remain valid across technology generations. SL4 explicitly references "nation-state level" threat actors in Annex C; this characterisation was conservative when drafted in 2013 and accurate in retrospect given the Industroyer and TRITON attributions published in 2020.

[^6]: IEC 62351-6:2020. "Power systems management and associated information exchange — Data and communications security — Part 6: Security for IEC 61850." IEC, Geneva, 2020. HMAC-SHA256 authentication for GOOSE is specified in Clause 7.4 and Annex B. MAC truncation to 64 bits is defined in Clause 7.4.2. The 64-bit truncated MAC provides $2^{64}$ possible values per message; forgery probability without the key is $2^{-64}$ per frame — computationally infeasible within any operationally relevant time horizon. Pre-shared key management (distribution, rotation intervals, compromise recovery procedures) is addressed in IEC 62351-9:2017.

[^7]: IEC 62351-3:2014. "Power systems management and associated information exchange — Data and communications security — Part 3: Communication network and system security — Profiles including TCP/IP." IEC, Geneva, 2014. Specifies TLS profiles for IEC 60870-5-104 (port 2404) and IEC 61850 MMS (port 102). The 2014 edition specifies TLS 1.2 minimum; subsequent IEC TC57 guidance and NIST SP 800-52 Rev 2 (2019) recommendations have elevated the practical minimum to TLS 1.3 for new deployments. The cipher suite TLS\_AES\_256\_GCM\_SHA384 is included in IEC 62351-3 Amendment 1. PSE Poland's TLS requirements for TSO-generator IEC 60870-5-104 connections are defined in the Grid Connection Agreement cybersecurity annex, aligned with the ENTSO-E Network Code on Cybersecurity (Commission Regulation (EU) 2024/1366).

[^8]: IEC 62351-8:2011. "Power systems management and associated information exchange — Data and communications security — Part 8: Role-based access control for power systems." IEC, Geneva, 2011. Standard roles (Viewer, Operator, Engineer, Security Administrator) are defined in Clause 5.3.1. RBAC is implemented as an X.509 attribute certificate extension embedded in the TLS session; the application receives the authenticated role and applies the corresponding permission set. Multi-factor authentication requirements for high-privilege roles at SL3 are addressed in IEC TR 62351-12:2020. FIDO2/WebAuthn hardware token compatibility with IEC 62351-8 RBAC is confirmed in IEC TC57 Working Group 15 liaison document WG15-LD-0042 (2022).

[^9]: E-ISAC and SANS ICS. (2016). "Analysis of the Cyber Attack on the Ukrainian Power Grid." Defence Use Case, March 18, 2016. Available from: ics-cert.us-cert.gov. Covers the BlackEnergy3 infection vector (spear-phishing with malicious Word macros), lateral movement from corporate IT to SCADA HMI networks, the manual circuit breaker operations, KillDisk deployment, and the telephony denial-of-service against customer service centres. The 230,000 customer figure is drawn from post-event reports by Ukrenergo and Prykarpattia Oblenergo. Attribution to GRU Sandworm unit was confirmed in the US Department of Justice indictment against six GRU officers (United States v. Yuriy Sergeyevich Andrienko et al., October 2020).

[^10]: Cherepanov, A. (2017). "WIN32/INDUSTROYER: A New Threat for Industrial Control Systems." ESET White Paper, June 2017. welivesecurity.com. The IEC 61850 module analysis is in Section 5.4, covering APPID enumeration and frame injection logic with reference to the IEC 61850-8-1 GOOSE APDU structure. The 75-minute outage duration and 200 MW load figure are from DTEK Ukrenergo's post-event report, December 2016. ESET's parallel Industroyer2 analysis (April 2022, *WIN32/Industroyer2*) documents a more capable variant targeting Ukrainian high-voltage substations during the 2022 conflict, confirming the original toolchain remains under active development.

[^11]: Dragos Inc. (2017). "TRISIS Malware: Analysis of Safety System Targeted Attack." Dragos Intelligence, December 14, 2017. Published simultaneously with Mandiant's "TRITON/TRISIS" analysis (FireEye Intelligence, December 14, 2017). The Triconex Model 3008 firmware modification mechanism and the accidental fail-safe activation (caused by a race condition in the attacker's TriStation 1131 protocol emulation) are documented in both reports and confirmed by ICS-CERT Alert IR-ALERT-H-17-093-01 (2018). Attribution to the Russian State Research Centre CNIIHM (Central Scientific Research Institute of Chemistry and Mechanics, Moscow) was published in the US Treasury Department OFAC sanctions designation, October 2020.
