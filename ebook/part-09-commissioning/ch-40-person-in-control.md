# Chapter 40: The Person in Control

*The card was roughly the size of a business card, printed on plain paper and laminated with a thin red border. Kaan found it propped against the monitor on the PiC desk when he arrived at the control room at 07:45 on a Monday morning, five weeks after Step 42. His name was on it. Below his name, two words: PERSON IN CONTROL.*

*The PiC desk was a real desk — not an office, not a title, but a specific position in the OSS control room, to the left of the main SCADA screens, with a slightly different chair and a red-striped border around the workstation laminate. The red stripe was the building code's way of saying: the person sitting here is different from the people sitting elsewhere. For ten months, other people had been sitting there. This morning, it had Kaan's card on it.*

*Brigid O'Neill was at the side bench, reviewing a permit form with Marek Wojciechowski — the site's plant operator, a compact man in his mid-thirties who had run more isolation sequences than he could count and communicated in a precise blend of Polish and technical English that Kaan had spent ten months learning to parse. Marek had been issuing the instructions for every significant switching action since first energisation. Today he would be issuing them on Kaan's authority.*

*Anders was at a desk in the back of the room with a coffee. He had not taken the PiC desk. He was not going to.*

*Kaan sat down.*

*There was a switching programme on the desk. Feeder 3. Cable insulation re-measurement — a standard four-week post-commissioning check, a routine verification that the 12 kilometres of 66 kV array cable connecting Turbines 3.1 through 3.5 had not suffered insulation degradation during its first month under voltage. The Megger test took forty minutes. The isolation required to perform it — opening the 66 kV feeder circuit breaker and closing the earth switches on both ends — would take twenty. The total programme was twelve steps.*

*"Same programme as Feeder 1 and 2," Brigid said, without looking up. "Same scope. One difference."*

*Kaan waited.*

*"The person authorising it."*

*He looked at the card. He looked at the programme. He looked at Marek, who was reading the same programme with the particular patience of a man for whom waiting is the professional skill that separates good operators from dangerous ones. He had signed many things in this building. Permission for work. Witness to commissioning. Authorisation for personnel access.*

*He had never signed as the person who decided when voltage entered and left a circuit.*

*Anders, from the back of the room, said nothing.*

*Kaan picked up the pen.*

---

## 40.1 The PiC Role — Authority Over Voltage, Not Over People

The authority conveyed by the PiC card is precise, total within its defined scope, and has nothing to do with seniority or professional rank.

The Electricity at Work Regulations 1989 — the UK statute governing safety in electrical systems, and the precedent on which most European offshore operator safety policies are modelled — contains no direct requirement for a formally designated "Person in Control." What it contains is something more demanding: Regulation 3(1) states that "it is the duty of every employer to comply with the provisions of these Regulations in so far as they relate to matters which are within his control," and Regulation 14 prohibits work that creates a risk of danger to any person. The Authorised Person and Person in Control roles were developed through operational guidance — specifically HSG85 (*Electricity at Work: Safe Working Practices*) and the Memorandum of Guidance HSR25 — to make those duties concrete: to ensure that there is always a named individual who can be asked "does this circuit have voltage on it?" and who is personally responsible for the answer.

Around a thousand accidents involving electrical shock or burns are reported to the UK HSE each year. Approximately thirty are fatal. The pattern in fatal HV accidents, identified in successive post-incident investigations, is consistent: the victim contacted a conductor believed to be isolated but not independently verified as dead. Not every victim was careless. Some were following procedures that had been followed a thousand times before. The gap — the moment when belief replaced measurement — was enough.

The PiC role closes the gap by making uncertainty procedurally impermissible. The PiC cannot proceed until the circuit is confirmed dead, not believed dead. The distinction is not semantic.

The role has two properties that define its character.

**First: it is not delegatable.** The PiC can formally transfer the role to another qualified person through a documented handover procedure — with a new safety document, a fresh set of confirmations, and a signed transfer record. They cannot ask someone else to "just run the next step" while they take a phone call. If the PiC is unavailable, the programme stops. The voltage state of the protected zone remains unchanged until the PiC returns or a formal handover is completed.

**Second: it is bounded in time and scope.** The PiC card represents a specific safety document for a specific operation. When the operation is complete and the safety document is closed, the PiC role ends. Kaan was the PiC for Feeder 3 for the duration of the twelve-step programme. He was not the PiC for Feeder 4, which remained energised and continued supplying five turbines throughout the entire operation.

"Your authority," Brigid told him, reviewing his completed access form, "is exactly as large as this programme and not one millimetre larger."

A first-year engineer designated PiC for a 66 kV feeder isolation has, for the duration of that safety document, more authority over that circuit than the company's project director. The project director cannot overrule the PiC's decision to call a hold. The project director cannot instruct the PiC to proceed when the PiC has called a hold. The role is defined entirely by the boundaries of the safety document — within those boundaries, the PiC's authority is absolute. This is not organisational politics. It is the consequence of the physics: the arc flash energy at 66 kV is independent of rank.

<!-- IMAGE: fig-40-1 -->
> **Figure 40.1** — The PiC Authority Boundary: Scope and Limits
> **Type:** Annotated zone diagram
> **Content:** Schematic of the OSS 66 kV busbar showing six feeders. Feeder 3 outlined with a thick red boundary box labelled "PiC Authority Zone — [Name], PiC, [date/time]". Feeders 1, 2, 4, 5, 6 shown in grey — "Adjacent live circuits: outside PiC authority." A key note states: "The PiC's authority does not extend to adjacent energised circuits. Physical boundary = safety document boundary."
> **Caption:** The PiC's authority is coterminous with the safety document boundary. Adjacent circuits remain outside the PiC's authority regardless of the PiC's seniority or qualifications.
> **Alt text:** Schematic of six 66 kV feeders with one feeder highlighted as the PiC authority zone, others shown as adjacent live circuits.
> **Data source:** Author illustration.
> **Resolution:** 1200 × 800 px minimum
> **Color notes:** PiC zone red border; live circuits grey; dead circuits blue; earth symbols green.

---

## 40.2 Isolated, Dead, Earthed — Three Different Conditions

Before the PiC issues any safety document permitting access to a conductor, three distinct physical states must be established for that conductor. They are not synonyms. They are sequential conditions, each addressing a different physical risk, each confirmed by different instruments.

**Isolated** means that the conductor has been electrically separated from all sources of supply and voltage. Isolating Feeder 3 required opening the 66 kV busbar-side feeder circuit breaker, racking out the busbar isolator to a visible air gap, opening the turbine-side connection point at each of the five turbines, and locking all switching devices in their open position. A conductor is isolated when no current-carrying path connects it to any energy source.

But isolation is not sufficient for safe access. A perfectly isolated conductor can still carry voltage.

Two 66 kV cables running in parallel through the same burial trench are electromagnetically coupled. When one cable carries load current and the other is isolated, the energised cable's electric field induces a voltage on the isolated cable by capacitive coupling. The magnitude depends on the cable separation, the voltage class, and the proximity length. For a 66 kV offshore array system with close trench spacing, induced voltages of several kilovolts on an isolated adjacent cable are physically plausible. A person who contacts that conductor without first measuring it may receive a shock from a circuit that was correctly and fully isolated.

**Dead** means that a physical voltage measurement, performed with a calibrated instrument, has confirmed that the conductor is at or below a threshold voltage. The threshold defined in IEC 61936-1:2021 and consistent with EN 50110-1:2013 Clause 6.3.1 is ten per cent of the nominal phase-to-earth voltage:

$$
V_{dead} \leq \frac{0.10 \times V_n}{\sqrt{3}}
$$

where:
- $V_{dead}$ = measured conductor voltage [V]
- $V_n$ = nominal line-to-line voltage [V]

For the Feeder 3 system with $V_n = 66{,}000$ V:

$$
V_{dead,max} = \frac{0.10 \times 66{,}000}{1.732} = 3{,}811 \text{ V}
$$

A conductor measuring below this threshold is not harmless — 3,500 V represents a significant shock hazard under some contact conditions — but it confirms the absence of operating voltage from an active supply. The residual level represents, at most, capacitively coupled or trapped charge that the subsequent earthing step will drain to functional earth potential before work begins.

The dead test must be performed at the point of access: the specific terminal, cable end, or busbar section that the work team will physically touch. Not at the panel. Not by radio from across the room. The measurement instrument must be category IV rated for the nominal system voltage — minimum 100 kV impulse withstand for a 66 kV system — and calibrated to traceable standards. A test lamp used on a 66 kV circuit is not a dead test. It is a voltage indicator for a conductor that is already known to be dead.

**Earthed** means that the confirmed-dead conductor has been connected to protective earth — through a dedicated earth switch, temporary earthing clamps, or both — so that any subsequent inadvertent re-energisation will produce a fault current that trips the upstream protection relay before the conductor rises to a dangerous voltage. A dead conductor that is not earthed can be re-energised in seconds by any of several credible scenarios: a second circuit breaker closed by an operator on a different panel in a different building; a protection relay auto-reclose sequence following an upstream fault; a cable fault that creates a path back to an adjacent energised circuit.

Earthing does not make the circuit safer while it is already dead. It makes the consequences of an inadvertent re-energisation survivable: the fault current trips the source relay before the voltage can rise; the person touching the earthed conductor experiences a brief current pulse rather than full 66 kV applied voltage.

The three states form a sequential chain: isolation creates the physical precondition; the dead test verifies it; earthing protects against its reversal.

For earth switch state confirmation, IEC 61936-1:2021 Clause 6.2.4 requires that both the mechanical indication and the SCADA digital input agree:

$$
P_{confirmed} = P_{mechanical} \wedge P_{SCADA}
$$

where:
- $P_{mechanical}$ = earth switch mechanical position indicator shows CLOSED [boolean]
- $P_{SCADA}$ = SCADA digital input from earth switch auxiliary contact shows CLOSED [boolean]

Neither indicator alone satisfies the standard. A mechanical indicator can fail (stuck indicator, damaged position flag). A SCADA digital input can fail (auxiliary contact wiring fault, IEC 61850 communication loss). When both independently confirm CLOSED, the probability that the earth switch is actually open is the product of two independent failure probabilities — several orders of magnitude lower than relying on either channel alone. This independence requires that the two indicators be fed from separate auxiliary contacts, wired through physically separate cable routes.

<!-- IMAGE: fig-40-2 -->
> **Figure 40.2** — The Isolated / Dead / Earthed Sequence
> **Type:** Sequential process flow diagram (left to right)
> **Content:** Three stages shown as boxes connected by arrows: (1) "ISOLATED: All sources disconnected, isolators open and locked, physical air gap visible." (2) "DEAD: Voltage measurement at point of access confirms V < V_dead,max. Instrument: Category IV voltmeter, calibrated." (3) "EARTHED: Earth switch closed (dual confirmation: mechanical + SCADA). Temporary earths applied at point of work." Below the flow: "SAFE FOR ACCESS" label with a green checkmark. Each stage has a red box labelled with the residual risk addressed: (1) "Risk: backfeed through unknown path," (2) "Risk: induced/coupled voltage from adjacent energised circuit," (3) "Risk: inadvertent re-energisation by third party."
> **Caption:** Isolation, dead-test, and earthing are sequential, non-interchangeable physical states. Each addresses a distinct residual risk; no single step substitutes for the others.
> **Alt text:** Flow diagram showing three sequential conductor states — isolated, dead, earthed — with the physical risk addressed by each transition.
> **Data source:** Author illustration, consistent with IEC 61936-1:2021 and EN 50110-1:2013 Clause 6.3.
> **Resolution:** 1400 × 700 px minimum
> **Color notes:** Live state red; isolated state orange; dead state yellow; earthed/safe state green.

---

## 40.3 The Four-Condition Authorization

Before the PiC signs any safety document permitting access to the protected zone, four conditions must be satisfied simultaneously. They must all be confirmed TRUE at the same moment. Signing a permit before any one has been verified is a procedural breach — and, more precisely, a physical gamble whose odds are determined by the physics of the unverified conductor.

$$
\text{AUTHORIZE} \iff P_{isolated} \wedge P_{dead} \wedge P_{earthed} \wedge P_{accounted}
$$

where:
- $P_{isolated}$ = all sources of supply to the protected zone confirmed OPEN and locked out [boolean]
- $P_{dead}$ = voltage measurement on all conductors in the protected zone confirms $V < V_{dead,max}$ [boolean]
- $P_{earthed}$ = earth switches on all conductors confirmed CLOSED by dual-check [boolean]
- $P_{accounted}$ = all persons who will enter the protected zone identified, present, and briefed [boolean]

The first three conditions concern the conductor. The fourth concerns the people.

The accounted condition is the one most easily dismissed as administrative — and the one whose failure is most difficult to trace after an incident. Its purpose is not to count heads. Its purpose is to ensure that every person who will enter the protected zone has personally heard and confirmed their understanding of which conductors are dead and which remain live.

In the Feeder 3 isolation, the dead conductors were the Feeder 3 cables and their associated terminals in the cable basement. The Feeder 4 and Feeder 5 cables — connected to live turbines, energised at 66 kV, running in cable trays that passed through the same cable basement — remained fully energised throughout the operation. The physical distance between the dead cables and the live cables at the closest approach was forty centimetres. A worker who entered the basement believing that "the feeders" had been isolated, without having been told precisely which feeder was the subject of the safety document, was in danger from a conductor that was never included in the isolation.

The briefing that accompanies the accounted condition is not a safety formality. It is the mechanism by which the accounted condition is established. Each person receives the safety document boundary description, confirms they have understood it, and signs the access log. Not because the signature makes them safer, but because reading and physically signing the boundary description is the most reliable available method of ensuring they have actually processed it. Verbal confirmation alone — "yes, I understand" spoken in passing — does not satisfy the accounted condition.

---

## 40.4 The Confirmation Loop — Communication as the Last Defence

In 1977, a KLM Boeing 747 began its takeoff roll at Los Rodeos Airport, Tenerife, without clearance from air traffic control. The KLM captain — among the most experienced pilots in the Dutch airline — misinterpreted a radio exchange with the controller as takeoff clearance. The controller had said "OK, stand by for takeoff, I will call you." The captain heard the word "OK" and began rolling. Five hundred and eighty-three people died. The subsequent investigation, conducted by the Spanish Air Investigation Commission and reviewed by ICAO, identified the ambiguous use of "OK" as a critical communication failure. In the years that followed, ICAO mandated a strict readback protocol: any critical instruction must be repeated back in full by the recipient, confirmed by the sender, before execution. The word "takeoff" was restricted to the moment of actual clearance, to eliminate any possible ambiguity between the instruction and the clearance.

Offshore electrical switching arrived at the same architecture by a different route. The five-element confirmation loop — codified in EN 50110-1:2013 Clause 6.5 and in the HSG85 guidance for HV switching — requires that every switching action affecting the isolation state of a conductor follow five steps:

1. **Command** — PiC issues the instruction, naming the specific device and action: *"Marek, close earth switch ES-66-F3-N. Step 5."*
2. **Repeat-back** — Operator repeats the instruction verbatim: *"Close earth switch ES-66-F3-N. Step 5. Confirmed."*
3. **Confirm** — PiC confirms the repeat-back is correct: *"Correct. Execute."*
4. **Report** — Operator executes and reports both indications: *"Earth switch ES-66-F3-N closed. Mechanical indication CLOSED. SCADA digital input CLOSED."*
5. **Receipt** — PiC acknowledges and logs: *"Receipt confirmed. Step 5, 09:52, signed."*

The five elements are not bureaucracy. They are the six seconds between an instruction and its physical consequence. A device mismatch caught during step two costs six seconds. A device mismatch not caught — a step executed on the wrong earth switch, or in the wrong direction — can remove the earthing protection from a circuit the work team is about to access.

The loop catches three distinct failure modes:

**Device misidentification.** The operator at the GIS panel has four earth switch actuators in front of them. Steps 2 and 3 ensure they repeat the specific device designation back and receive explicit confirmation before touching any actuator. The confirmation is not "is this the right one?"; it is the physical act of speaking the name aloud and hearing it confirmed.

**Direction ambiguity.** "Open" and "close" are among the most easily confused words in a switching operation, particularly under cognitive load. Verbatim repeat-back, with explicit confirmation before execution, prevents the operator from interpreting "close" as the logical next action in a sequence that includes both openings and closings.

**Step ordering errors.** The operator cannot proceed to step 4 without receiving step 3. The loop creates a mandatory gate in the sequence. Rushing — the most common failure mode in repeat procedures — is structurally prevented by the requirement to receive confirmation before acting.

Every step of the five-element loop is logged with a timestamp and the PiC's signature. The log is not a record of what should have happened. It is a record of what did happen, in the order it happened, with a specific time at each step — the commissioning record's evidence that the procedure was followed correctly, readable by any engineer who works on this equipment in the next thirty years.

<!-- IMAGE: fig-40-3 -->
> **Figure 40.3** — The Five-Element Confirmation Loop
> **Type:** Circular flow diagram with two actors
> **Content:** A circle with five nodes, alternating between two actors: PiC (left side) and Operator (right side). Arrows flow clockwise. Nodes: (1) PiC: "Command — device + action + step number." (2) Operator: "Repeat-back — verbatim." (3) PiC: "Confirm — 'Correct. Execute.'" (4) Operator: "Execute + Report — action + both indications." (5) PiC: "Receipt + Log — timestamp + signature." Below the circle: a red box labelled "MISMATCH DETECTED AT STEP 2 → restart at step 1. MISMATCH DETECTED AT STEP 4 → halt, verify, restart at step 1."
> **Caption:** The five-element confirmation loop creates a mandatory gate between instruction and physical action. Each step must complete before the next begins; a mismatch at any step halts the sequence before the action is executed.
> **Alt text:** Circular flow diagram showing five-element confirmation loop alternating between PiC and operator.
> **Data source:** Author illustration, consistent with EN 50110-1:2013 Clause 6.5.
> **Resolution:** 1200 × 1000 px minimum
> **Color notes:** PiC elements blue; operator elements orange; mismatch handling red.

---

## 40.5 GO/NO-GO Authority — The Unconditional Hold

The PiC holds one piece of authority that cannot be overruled by any other person in the operational chain: the authority to stop the operation.

Not defer it. Not request a management review. Stop it, immediately and unilaterally, with no requirement to explain the decision to anyone on site before the stop takes effect.

The command is two words: *"Work hold."*

When those two words are transmitted — by radio, by telephone, or spoken aloud in the control room — every person in the protected zone stops in place, maintains their current position, and awaits further instruction from the PiC. No switching action continues. Voltage state changes are suspended. The operation does not resume until the PiC issues *"Work resume"* (with all four authorization conditions re-confirmed) or *"Evacuate [zone]"* (emergency exit).

The conditions under which the PiC calls a hold are neither prescribed nor limited. The PiC calls a hold when anything changes that was not anticipated by the switching programme. That includes:

- Any SCADA indication that does not match the expected post-step state
- Any SCADA indication showing UNDEFINED or FAULT for any device in the protected zone
- Any discrepancy between mechanical position and SCADA digital input
- Any personnel change in the access list after the safety document was issued
- Any communication raising doubt about the status of any adjacent circuit
- Any instrument reading outside the range predicted by the pre-isolation calculations

The last condition is deliberately broad. The PiC is not required to determine whether the doubt is valid before calling a hold. The hold is the response to the doubt. The investigation follows the hold.

The GO/NO-GO decision at each potential hold condition can be represented as a risk assessment:

$$
R = L \times C
$$

where:
- $R$ = risk level [1–25]
- $L$ = likelihood of a harmful event if the operation continues under current conditions [1–5]
- $C$ = consequence severity if a harmful event occurs [1–5]

For switching operations in the vicinity of energised 66 kV conductors, the consequence score is always $C = 5$: an arc flash at 66 kV with a fault current of 12,700 A and a protection relay operating time of 200 ms releases arc energy in the range of 300–500 kJ per phase. At these energy levels, GIS compartment integrity is not guaranteed; a worker within the exclusion zone faces a pressure wave event regardless of PPE category. The consequence is set by the physics of the circuit, not by the circumstances of the incident.

The GO/NO-GO calculation therefore simplifies: if any non-zero probability of a harmful event exists under current conditions ($L > 0$, $R > 0$), the PiC calls hold. This is not risk aversion. It is arithmetic applied to an irreversible consequence.

---

## 40.X Worked Example: The Earth Switch That Was Not Confirmed

**Context:** Feeder 3 isolation for cable insulation re-measurement. Twelve-step programme. Steps 1–4 complete at 09:52:

- Step 1: Feeder 3 energised, confirmed from SCADA. Step signed.
- Step 2: 66 kV busbar-side feeder circuit breaker CB-66-F3 confirmed OPEN and padlocked. Step signed.
- Step 3: Dead test on Feeder 3 conductor at busbar cable termination. All three phases: $V < 500$ V. Confirmed below $V_{dead,max} = 3{,}811$ V. Step signed.
- Step 4: Turbine-side connection isolators (5 × WTG switches) confirmed OPEN and locked. Step signed.

**Step 5:** Marek commanded to close earth switch ES-66-F3-N (busbar-side earth switch, Feeder 3).

Marek's report, received at 09:52:31:

*"Earth switch ES-66-F3-N close commanded. Mechanical indication: CLOSED. SCADA digital input: UNDEFINED."*

Mechanical indication: CLOSED. Expected: CLOSED. ✓
SCADA digital input: UNDEFINED. Expected: CLOSED. ✗

Applying the dual-confirmation criterion:

$$
P_{confirmed} = P_{mechanical} \wedge P_{SCADA} = \text{TRUE} \wedge \text{FALSE} = \text{FALSE}
$$

The earth switch is mechanically closed and physically earthing the Feeder 3 conductor. But the SCADA system does not confirm this. The four-condition authorization logic cannot proceed to Step 6, which would close the work-side earth switch at the feeder's cable end — because Step 6 relies on Step 5 being confirmed, and Step 5 has not been confirmed.

**Kaan's action at 09:54:**

*"Work hold. Step 5 incomplete. ES-66-F3-N mechanical CLOSED, SCADA UNDEFINED. Hold at 09:54. Marek, do not proceed. Hanna — I need the SCADA IED for ES-66-F3-N."*

Hanna Virtanen, reached by radio from the secondary commissioning room, identified the fault in forty-two seconds: the auxiliary contact on ES-66-F3-N — a small copper contact on the physical earth switch shaft that closes when the main switch closes, providing the digital signal to the SCADA IED — had a loose terminal screw, introduced during the earth switch's most recent maintenance cycle. The contact was physically closed. The screw was vibrating open under the harmonic load of the adjacent energised feeders, breaking the circuit before the IEC 61850 digital input could register a stable CLOSED state.

Marek tightened the screw. Duration: eleven minutes from hold to resolution.

At 10:06, the SCADA digital input changed from UNDEFINED to CLOSED.

$$
P_{confirmed} = P_{mechanical} \wedge P_{SCADA} = \text{TRUE} \wedge \text{TRUE} = \text{TRUE}
$$

Step 5 re-executed and confirmed. Programme continued. Total hold duration: 12 minutes.

**Cost of the hold:**

During the 12-minute hold, Feeder 3's five turbines were isolated from the 66 kV busbar. Wind speed: 11.4 m/s. Each turbine was producing approximately 12 MW (Region 3, near rated):

$$
E_{deferred} = P_{Feeder3} \times t_{hold} = 60 \text{ MW} \times \frac{12}{60} \text{ h} = 12 \text{ MWh}
$$

At a Day-Ahead spot price of approximately €62/MWh:

$$
\text{Revenue deferred} = 12 \text{ MWh} \times €62/\text{MWh} = €744
$$

The alternative — proceeding with Step 6 (closing the work-side earth switch) while Step 5 remained unconfirmed — would have violated IEC 61936-1:2021 Clause 6.2.4, breached the four-condition authorization logic, and placed the work team in a cable basement under a switching action whose safety state had not been independently confirmed. The arc energy available at the earth switch terminal in the event of an incorrect state: approximately 300–500 kJ per phase, at a fault current of 12,700 A, for a relay operating time of 200 ms — consistent with the IEC 62271-200:2021 internal arc classification for 66 kV metal-enclosed switchgear.

The €744 revenue deferral was not a cost-benefit decision. It was the price of performing the procedure correctly.

At 10:48, the cable insulation resistance measurement was complete: Feeder 3 IR = 9,400 MΩ — consistent with the Month 0 measurement (8,700 MΩ) and within the IEC 60229:2007 acceptance criterion for new 66 kV cables. Kaan signed Step 12 at 10:52.

<!-- IMAGE: fig-40-4 -->
> **Figure 40.4** — Worked Example Timeline: Step 5 Hold and Resolution
> **Type:** Horizontal timeline with annotated events
> **Content:** Timeline from 09:50 to 10:55. Events annotated with flags: 09:52 (Step 5 commanded), 09:52:31 (UNDEFINED reported), 09:54 (Work hold called), 09:54:42 (fault identified — loose terminal screw), 09:55 (repair begins), 10:06 (SCADA CLOSED confirmed, hold lifted), 10:07 (Step 5 signed), 10:48 (IR measurement complete), 10:52 (Step 12 signed). Shaded region 09:54–10:06 labelled "Hold Period: 12 minutes, €744 deferred." Arrow at 09:54 labelled "SCADA UNDEFINED: hold called. Cost: €744." Arrow at 10:06 labelled "Dual confirmation achieved. Programme resumed."
> **Caption:** The 12-minute hold at Step 5 cost €744 in deferred generation. Proceeding without dual confirmation would have placed the work team in the cable basement under a switching operation whose earth switch state had not been independently verified.
> **Alt text:** Timeline showing hold event from 09:54 to 10:06 with cost annotation and resolution steps.
> **Data source:** Author illustration.
> **Resolution:** 1400 × 600 px minimum
> **Color notes:** Timeline line black; hold period shaded red; resume point green; annotation flags dark grey.

---

## Key Takeaways

- **The PiC has authority over voltage, not over people.** The role is bounded by the safety document: the PiC cannot be overruled within that boundary by any seniority. The distinction between the AP qualification and the PiC role is the difference between a credential and a responsibility — the AP proves competence; the PiC accepts command over the voltage state of a specific circuit for the duration of a specific operation.

- **Isolated, dead, and earthed are sequential physical conditions, not synonyms.** A conductor is isolated when all sources of supply have been disconnected. It is dead only when a physical voltage measurement confirms $V < 0.10 \times V_n/\sqrt{3}$ at the point of access. It is earthed when a confirmed-dead conductor has been connected to protective earth, making any inadvertent re-energisation a controlled fault event rather than a silent hazard to the work team.

- **Dual-confirmation of earth switch position is not administrative redundancy.** The mechanical and SCADA indicators address independent failure modes. Their independent failure probabilities multiply. A SCADA-only or mechanical-only confirmation is a single point of failure in a protective system. IEC 61936-1:2021 Clause 6.2.4 requires both.

- **The five-element confirmation loop creates a mandatory gate between instruction and action.** Command → repeat-back → confirm → execute+report → acknowledge. A device mismatch caught at step two costs six seconds. A mismatch executed costs the protective zone. The loop is not about distrust of experienced operators — it is about the architecture of the seconds between a command and its physical consequence.

- **The GO/NO-GO authority is unconditional and cannot be overruled.** The PiC calls a hold when anything changes that was not anticipated by the programme. The call requires no justification before it takes effect. For a 66 kV circuit with a 12,700 A fault current, the consequence score is always C = 5; any non-zero likelihood of an incorrect voltage state makes hold the arithmetically correct response.

---

## For Further Reading

- **HSE (2013).** *Electricity at Work: Safe Working Practices*, HSG85. 3rd edition. HSE Books. ISBN: 978-0-7176-6237-2. The primary UK guidance document for AP and PiC procedures. Section 3 defines the sequential states of isolated, dead, and earthed in terms directly applicable to HV switching operations, and Section 4 covers the permit-to-work framework. The appendices include model switching instruction formats and permit forms consistent with EN 50110-1 and IEC 61936-1 requirements. The guidance makes explicit that the designation of an Authorised Person is not sufficient — the person must also be identified as Person in Control of the specific operation before the operation begins, and that designation must appear on the safety document itself.

- **EN 50110-1:2013.** *Operation of electrical installations — Part 1: General requirements.* CENELEC. Clause 6.5 specifies the switching procedure requirements for HV systems, including the role of the responsible person, the requirement for written switching instructions, the confirmation procedure, and the documentation of each step. Annex A provides the five-element confirmation sequence used in this chapter. EN 50110-1 was developed to harmonise operational safety practices across EU member states and is the European implementation of principles also codified in IEC 61936-1:2021. The standard distinguishes between the "responsible person" (the PiC, who has authority to issue safety documents) and the "skilled person" (the AP, who is qualified to work on isolated conductors) — the same person may hold both designations simultaneously, but the roles are distinct.

- **IEC 62271-200:2021.** *AC metal-enclosed switchgear and controlgear for rated voltages above 1 kV and up to and including 52 kV.* International Electrotechnical Commission. Section 6.106 covers the internal arc classification (IAC) testing and marking of metal-enclosed switchgear, including the accessible face classification (A, B, F) and the arc duration and current levels for which the switchgear must retain structural integrity. The arc test durations and current levels specified in IEC 62271-200 are directly relevant to the protection relay operating times used in the arc energy calculations in this chapter: the faster the protection relay clears the fault, the lower the arc energy, and the more likely the switchgear is to retain integrity and protect the work team in an adjacent zone. The standard also covers the earthing device requirements for class PM and PI switchgear relevant to the dual-confirmation requirement.

---

*The Feeder 3 IR measurement certificate was the last form to be signed. 9,400 MΩ. Date and time: 10:43, 17 October. Measured by: Marek Wojciechowski, AP. Authorised by: K. Arslan, PiC. Kaan looked at the signature. It was the same signature he had put on fifty commissioning documents over the past ten months. The letters were unchanged.*

*He unclipped the PiC card from the lanyard holder and returned it to Brigid. The role, as she had told him it would, ended when the operation ended. The card was a laminated piece of paper. It weighed nothing.*

*But what he understood now — sitting in the PiC chair, looking at a SCADA screen that showed Feeder 3 back in service, all five turbines reconnected and generating 53 MW in 11.4 m/s wind — was that the card had not conveyed the responsibility. It had named it. The responsibility had existed from the moment he accepted the role. The card was the record that he had accepted it.*

*He thought about the twelve-minute hold at Step 5. About the loose terminal screw on the ES-66-F3-N auxiliary contact. About Hanna identifying the fault in forty-two seconds and Marek tightening the screw in eleven minutes. About the €744 in deferred revenue that those eleven minutes had cost. About the 300–500 kJ per phase that those eleven minutes had avoided.*

*He thought about Anders, who had said nothing from the back of the room for three hours and twenty-six minutes.*

*He handed the card to Brigid.*

*"When's the next one?" he asked.*

*"Tomorrow," she said, without looking up. "Feeder 5. Cable splice inspection — first time inside a 66 kV termination head since commissioning. If the work team finds something that requires extending the isolation boundary, you re-issue the safety document with the new scope."*

*She paused.*

*"The procedures do not change. What changes is what's inside the termination head when they open it."*

*Anders, from the back of the room, made a sound that was not quite a word. Kaan turned.*

*"The arc flash calculation," Anders said. "You remember the relay operating time from Chapter 26?"*

*Kaan did.*

*"Tomorrow: what happens when that operating time is the wrong side of the physics."*

---

## Notes

[^1]: The Electricity at Work Regulations 1989. Statutory Instrument 1989 No. 635. UK Parliament. Available at legislation.gov.uk. Regulation 3(1) specifies the duty of every employer to comply with the Regulations "in so far as they relate to matters which are within his control." Regulation 4 covers system design and maintenance. Regulation 14 prohibits work "in such circumstances as may give rise to danger." The Regulations came into force on 1 April 1990, replacing the Electricity (Factories Act) Special Regulations 1908 and 1944. The Authorised Person and Person in Control designations are not defined in the Regulations themselves but are elaborated in HSR25 (*Memorandum of Guidance on the Electricity at Work Regulations 1989*, 3rd ed., 2007, HSE Books) and HSG85 (*Electricity at Work: Safe Working Practices*, 3rd ed., 2013, HSE Books). The offshore application is governed by the Offshore Electricity and Noise Regulations 1997, which extends the EAWR to offshore installations. For approximately 1,000 electrical accidents and approximately 30 fatalities per year in UK workplaces: HSE *Statistics — Work-related fatal injuries in Great Britain* (annual), and HSE *Electrical safety — key statistics*, available at hse.gov.uk/electricity.

[^2]: EN 50110-1:2013. *Operation of electrical installations — Part 1: General requirements.* CENELEC. Clause 6.5.2 specifies the confirmation loop requirement: "Each switching instruction shall be repeated back to the operator issuing the instruction before execution, and the instruction shall be confirmed correct by the issuing operator before the switching action is carried out." Clause 6.5.3 requires the result of each switching action to be reported and confirmed before the next instruction is issued. The five-element structure described in this chapter (command → repeat-back → confirm → execute+report → acknowledge) is the practical implementation of Clauses 6.5.2–6.5.3 as codified in UK National Grid and PSE standard operating procedures for HV installations, and as described in HSG85 Appendix 3 (Model switching instruction format). The EN 50110-1 standard is the European implementation of principles also contained in IEC 61936-1:2021 Section 6.2 and in country-specific supplements (e.g., German BGV A3, French NF C 18-510).

[^3]: The Tenerife airport disaster occurred on 27 March 1977 at Los Rodeos Airport (now Tenerife North Airport), Tenerife, Canary Islands. The collision between KLM Flight 4805 and Pan Am Flight 1736 killed 583 people — all 248 on the KLM aircraft and 335 of the 396 aboard the Pan Am aircraft, with 61 Pan Am survivors. The Spanish accident investigation report identified the KLM captain's misinterpretation of the ambiguous radio phrase "OK, stand by for takeoff, I will call you" as the proximate cause of the takeoff without clearance. The accident report also identified several contributing factors including runway visibility, frequency congestion, and the non-standard use of the phrase "we are now at takeoff" by the KLM first officer in his readback. The immediate consequence for international aviation safety was ICAO's revision of Annex 10 (Volume II), Doc 4444 (Procedures for Air Navigation Services — Air Traffic Management), and Doc 9432 (Manual of Radiotelephony) to mandate strict readback requirements for all critical ATC instructions and to prohibit the use of "OK," "roger," or "wilco" as acknowledgment of a clearance. The word "takeoff" was henceforth restricted to the moment of actual clearance or its cancellation. The structural parallel between the aviation readback protocol and the HV switching confirmation loop is a convergent architectural solution to the same engineering problem: ensuring that the person issuing a critical instruction and the person executing it hold an identical understanding of the instruction before the physical action is taken. The aviation and electrical industries developed these solutions independently; both began with accidents.

[^4]: The dead-zone voltage threshold of $0.10 \times V_n / \sqrt{3}$ is specified in IEC 61936-1:2021 Annex E and is consistent with EN 50110-1:2013 Clause 6.3.1 and with IEC 60479-1:2018 (*Effects of current on human beings and livestock — Part 1: General aspects*), which establishes the ventricular fibrillation threshold current as a function of contact duration and path impedance. The 10% threshold is not an arbitrary safety margin: it is calibrated against the contact impedance and current path lengths associated with accidental contact with an HV conductor in an industrial environment, such that a conductor at or below the threshold — while not safe for prolonged contact — is below the fibrillation threshold for the brief contact durations typical of accidental touch. A conductor above the threshold requires no special circumstances to cause fibrillation; a conductor below the threshold requires the contact to be sustained or the contact impedance to be unusually low. The earth switch procedure that follows dead certification removes the residual voltage to functional earth potential in any case. Test instrument requirements: IEC 61010-1:2010 Category IV minimum for HV systems, with impulse withstand voltage rating not less than the system nominal voltage × 2 plus 1,000 V, consistent with installation category IV (at the origin of the electrical installation).

[^5]: IEC 61936-1:2021, Clause 6.2.4 (*Earthing*): "Before an earth connection is considered effective for the purposes of issuing a safety document, its closed position shall be confirmed by at least two independent means." The standard does not prescribe the specific combination of indicators, but states that the two means must be "independent" — meaning that a single point of failure in the confirmation system cannot produce a false confirmation from both means simultaneously. The most common implementation — mechanical position indicator plus SCADA digital input from a separate auxiliary contact — satisfies this requirement only if the two auxiliary contacts are physically separate (not a common contact with two terminals), wired through physically separate cable paths, and not both powered from the same supply source. Designs that feed the SCADA digital input from the same auxiliary contact that drives the mechanical indicator do not satisfy independence and would not satisfy Clause 6.2.4. The IEC 62271-200:2021 internal arc classification standard and IEC 62271-100:2021 (HV AC circuit-breakers) both provide supplementary requirements for the position indication systems on earthing devices intended for use in safety document applications.
