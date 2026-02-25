"""
IEC 61850 data model for 510 MW Baltic Sea offshore wind farm.

Implements the complete IEC 61850 device hierarchy used in substation
automation systems. This is the foundational data model upon which GOOSE
messaging (Lesson 010), protection simulation, and SCADA communication
are built.

Physics — IEC 61850 Is a Data Model, Not a Protocol
-----------------------------------------------------
IEC 61850 defines HOW substation data is structured, not how it is
transported. The same data model can be mapped to different protocols:
  - MMS (Manufacturing Message Specification): client-server, TCP/IP
  - GOOSE (Generic Object-Oriented Substation Event): Layer 2 Ethernet
  - Sampled Values (SV): Layer 2 Ethernet for digitised CT/VT waveforms

Standard — IEC 61850 Data Hierarchy
-------------------------------------
The hierarchy mirrors the physical structure of a real substation:

  Physical Device (IED)           e.g., ABB REL670 protection relay
  └── Logical Device              e.g., LD_Protection
      └── Logical Node            e.g., XCBR1 (circuit breaker)
          └── Data Object         e.g., Pos (position — DPC type)
              └── Data Attribute  e.g., stVal (status value — BOOLEAN)

Each level has a specific IEC 61850 part:
  - Part 7-4: Logical Node classes and data objects
  - Part 7-3: Common Data Classes (CDC) — templates for data objects
  - Part 7-2: Abstract Communication Service Interface (ACSI)
  - Part 6:   SCL (Substation Configuration Language) — XML config files

Standard — IEC 61400-25 Wind Turbine Extension
-------------------------------------------------
IEC 61400-25 extends IEC 61850 with wind-specific logical nodes:
  - WTUR: Turbine operating state
  - WROT: Rotor speed, blade pitch angle
  - WGEN: Generator power output
  - WMET: Meteorological data (wind speed, direction, temperature)
  - WNAC: Nacelle conditions (temperature, yaw angle)

Constants (Baltic Wind Alpha)
------------------------------
- 34 × V236-15.0 MW = 510 MW total
- OSS Protection IED: ABB REL670 (XCBR, MMXU, PDIS, PTOC, PTOV, GGIO)
- OSS Measurement IED: ABB REC670
- 34 × WTG Controllers: Vestas V236-15.0 internal controller
- Bay Controller: ABB COM600 for STATCOM bay

References
----------
- IEC 61850-7-4: Logical node classes and data object classes
- IEC 61850-7-3: Common data classes
- IEC 61850-7-2: Abstract communication service interface (ACSI)
- IEC 61850-6: Configuration description language (SCL)
- IEC 61400-25-2: Wind power plant information models
- IEC 61850-8-1: GOOSE and GSSE mapping to Ethernet
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

# ── Enums ──────────────────────────────────────────────────────────


class DataAttributeType(StrEnum):
    """IEC 61850-7-2 basic data types for Data Attributes."""

    BOOLEAN = "BOOLEAN"
    INT32 = "INT32"
    FLOAT32 = "FLOAT32"
    VISIBLE_STRING = "VisString"
    TIMESTAMP = "Timestamp"
    QUALITY = "Quality"
    CODED_ENUM = "CodedEnum"
    ANALOGUE_VALUE = "AnalogueValue"


class FunctionalConstraint(StrEnum):
    """IEC 61850-7-2 functional constraints.

    Functional constraints partition data attributes by purpose,
    enabling selective access (e.g., read only status, not config).
    """

    ST = "ST"  # Status — current state (read-only from client)
    MX = "MX"  # Measured value — analogue measurements
    CO = "CO"  # Control — operate commands (write from client)
    CF = "CF"  # Configuration — settings (write by engineer)
    SP = "SP"  # Setpoint — operator adjustable values
    DC = "DC"  # Description — static descriptive information


class LogicalNodeCategory(StrEnum):
    """IEC 61850-7-4 logical node group categories.

    Each LN class belongs to a group identified by its first letter.
    """

    PROTECTION = "P"  # PDIS, PTOC, PTOV — protection functions
    MEASUREMENT = "M"  # MMXU — measurement unit
    SWITCHGEAR = "X"  # XCBR, XSWI — switchgear control
    GENERIC = "G"  # GGIO — generic process I/O
    WIND = "W"  # WTUR, WROT, WGEN, WMET, WNAC (IEC 61400-25)
    SYSTEM = "L"  # LLN0, LPHD — system/physical device LNs


class EquipmentType(StrEnum):
    """Type of physical device in the substation."""

    PROTECTION_IED = "protection_ied"
    MEASUREMENT_IED = "measurement_ied"
    BAY_CONTROLLER = "bay_controller"
    WTG_CONTROLLER = "wtg_controller"
    MERGING_UNIT = "merging_unit"
    GATEWAY = "gateway"


class SwitchPosition(StrEnum):
    """IEC 61850 XCBR/XSWI position — Dbpos (double-bit position).

    Two-bit encoding per IEC 61850-7-3 DPC (Double Point Controllable):
      00 = intermediate (transitioning)
      01 = off (open)
      10 = on (closed)
      11 = bad_state (error)
    """

    INTERMEDIATE = "intermediate"
    OFF = "off"
    ON = "on"
    BAD_STATE = "bad_state"


class TurbineOperatingState(StrEnum):
    """IEC 61400-25 WTUR operating states."""

    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    ERROR = "error"
    MAINTENANCE = "maintenance"


# ── Data Hierarchy (bottom-up) ──────────────────────────────────


@dataclass(frozen=True)
class DataAttribute:
    """Leaf of the IEC 61850 hierarchy — a single typed value.

    Attributes
    ----------
    name : str
        Attribute name per IEC 61850-7-3 (e.g., 'stVal', 'mag.f', 'q').
    data_type : DataAttributeType
        IEC 61850 basic type.
    fc : FunctionalConstraint
        Functional constraint: ST, MX, CO, CF, SP, DC.
    description : str
        Human-readable engineering description.
    unit : str
        Engineering unit (e.g., 'kV', 'MW', 'Hz', 'deg'). Empty if dimensionless.
    """

    name: str
    data_type: DataAttributeType
    fc: FunctionalConstraint
    description: str
    unit: str = ""


@dataclass(frozen=True)
class DataObject:
    """A named group of Data Attributes within a Logical Node.

    Maps to IEC 61850-7-3 Common Data Classes (CDC).
    Examples: Pos (DPC), TotW (MV), Hz (MV), PhV (WYE).

    Attributes
    ----------
    name : str
        Data object name per IEC 61850-7-4 (e.g., 'Pos', 'TotW', 'PhV').
    cdc : str
        Common Data Class type: 'SPC', 'DPC', 'MV', 'WYE', 'INS', 'BCR'.
    attributes : tuple[DataAttribute, ...]
        Ordered tuple of data attributes within this DO.
    description : str
        Human-readable engineering description.
    """

    name: str
    cdc: str
    attributes: tuple[DataAttribute, ...] = field(default_factory=tuple)
    description: str = ""


@dataclass(frozen=True)
class LogicalNode:
    """A function within a Logical Device (e.g., XCBR1, MMXU1, PDIS1).

    Logical nodes are the core of IEC 61850 — each represents a specific
    function (protection, measurement, control) with standardised data.

    Attributes
    ----------
    class_name : str
        IEC 61850-7-4 LN class (e.g., 'XCBR', 'MMXU', 'PTOC').
    instance : int
        Instance number (e.g., 1 for XCBR1, 2 for XCBR2).
    category : LogicalNodeCategory
        LN group category (P, M, X, G, W, L).
    data_objects : tuple[DataObject, ...]
        Ordered tuple of data objects within this LN.
    description : str
        Human-readable engineering description.
    """

    class_name: str
    instance: int
    category: LogicalNodeCategory
    data_objects: tuple[DataObject, ...] = field(default_factory=tuple)
    description: str = ""

    @property
    def name(self) -> str:
        """Full LN reference: e.g., 'XCBR1', 'MMXU1'."""
        return f"{self.class_name}{self.instance}"


@dataclass(frozen=True)
class LogicalDevice:
    """A logical grouping of functions within a Physical Device.

    Attributes
    ----------
    inst : str
        Instance name (e.g., 'LD_Protection', 'LD_Turbine').
    logical_nodes : tuple[LogicalNode, ...]
        Ordered tuple of logical nodes within this LD.
    description : str
        Human-readable engineering description.
    """

    inst: str
    logical_nodes: tuple[LogicalNode, ...] = field(default_factory=tuple)
    description: str = ""


@dataclass(frozen=True)
class PhysicalDevice:
    """Top of the IEC 61850 hierarchy — a real IED or controller.

    Attributes
    ----------
    name : str
        IED instance name (e.g., 'OSS_PROT_IED01', 'WTG_01').
    equipment_type : EquipmentType
        Type of physical device.
    manufacturer : str
        E.g., 'ABB', 'Siemens', 'SEL', 'Vestas'.
    model : str
        E.g., 'REL670', 'SIPROTEC 7SJ85'.
    logical_devices : tuple[LogicalDevice, ...]
        Ordered tuple of logical devices within this IED.
    ip_address : str
        MMS/station bus IP address.
    description : str
        Human-readable engineering description.
    """

    name: str
    equipment_type: EquipmentType
    manufacturer: str
    model: str
    logical_devices: tuple[LogicalDevice, ...] = field(default_factory=tuple)
    ip_address: str = ""
    description: str = ""


# ── GOOSE Control Block & Dataset (foundation for Lesson 010) ───


@dataclass(frozen=True)
class DatasetMember:
    """A reference to a DataObject within a Dataset.

    Attributes
    ----------
    logical_device_inst : str
        Logical device instance name.
    logical_node_name : str
        Full LN reference (e.g., 'XCBR1').
    data_object_name : str
        Data object name (e.g., 'Pos').
    fc : FunctionalConstraint
        Functional constraint for filtering.
    """

    logical_device_inst: str
    logical_node_name: str
    data_object_name: str
    fc: FunctionalConstraint

    @property
    def reference(self) -> str:
        """Full IEC 61850 object reference.

        Format: {LD}/{LN}${DO}
        Example: LD_Protection/XCBR1$Pos
        """
        return f"{self.logical_device_inst}/{self.logical_node_name}${self.data_object_name}"


@dataclass(frozen=True)
class Dataset:
    """IEC 61850 dataset — groups data for GOOSE/Report publishing.

    Datasets define which data objects are published together.
    GOOSE uses datasets to send protection trip signals as a bundle.

    Attributes
    ----------
    name : str
        Dataset name (e.g., 'TripDataset', 'MeasDataset').
    members : tuple[DatasetMember, ...]
        Ordered tuple of dataset members.
    description : str
        Human-readable engineering description.
    """

    name: str
    members: tuple[DatasetMember, ...] = field(default_factory=tuple)
    description: str = ""


@dataclass(frozen=True)
class GOOSEControlBlock:
    """GOOSE Control Block (GoCB) per IEC 61850-7-2.

    Defines what a device publishes via GOOSE. GOOSE operates at
    Layer 2 Ethernet (no IP routing), achieving < 4 ms latency for
    protection trip signals — 200x faster than SCADA polling.

    Attributes
    ----------
    name : str
        GoCB name (e.g., 'gcb_trip').
    app_id : str
        GOOSE Application ID for Ethernet frame (e.g., '0x0001').
    go_id : str
        GOOSE identifier string (e.g., 'OSS_220kV_BB_TRIP').
    dataset_name : str
        Reference to the Dataset to publish.
    mac_address : str
        Multicast destination MAC per IEC 61850-8-1 Annex A.
    vlan_id : int
        VLAN for GOOSE traffic separation (typically 100-199).
    min_time_ms : int
        Minimum retransmission interval [ms]. Default: 2.
    max_time_ms : int
        Maximum retransmission interval [ms]. Default: 1000.
    description : str
        Human-readable engineering description.
    """

    name: str
    app_id: str
    go_id: str
    dataset_name: str
    mac_address: str = "01:0C:CD:01:00:01"
    vlan_id: int = 100
    min_time_ms: int = 2
    max_time_ms: int = 1000
    description: str = ""


# ── Constants ──────────────────────────────────────────────────


NUM_TURBINES = 34
NUM_OSS_IEDS = 2  # 1 protection + 1 measurement
NUM_BAY_CONTROLLERS = 1  # STATCOM bay
TOTAL_DEVICES = NUM_TURBINES + NUM_OSS_IEDS + NUM_BAY_CONTROLLERS  # 37


# ── Logical Node Builders (standardised data objects) ───────────


def _build_xcbr_ln(instance: int = 1) -> LogicalNode:
    """Build XCBR (Circuit Breaker) logical node per IEC 61850-7-4.

    XCBR controls and monitors circuit breaker position. The Pos data
    object uses DPC (Double Point Controllable) — two bits encoding
    four states: intermediate, off (open), on (closed), bad_state.
    """
    return LogicalNode(
        class_name="XCBR",
        instance=instance,
        category=LogicalNodeCategory.SWITCHGEAR,
        description="Circuit breaker control and monitoring",
        data_objects=(
            DataObject(
                name="Pos",
                cdc="DPC",
                description="Circuit breaker position (open/close/intermediate)",
                attributes=(
                    DataAttribute(
                        "stVal",
                        DataAttributeType.CODED_ENUM,
                        FunctionalConstraint.ST,
                        "Position status value",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.ST, "Quality flag"
                    ),
                    DataAttribute(
                        "t",
                        DataAttributeType.TIMESTAMP,
                        FunctionalConstraint.ST,
                        "Timestamp of last change",
                    ),
                    DataAttribute(
                        "ctlVal",
                        DataAttributeType.BOOLEAN,
                        FunctionalConstraint.CO,
                        "Control command value",
                    ),
                ),
            ),
            DataObject(
                name="BlkOpn",
                cdc="SPC",
                description="Block open command — prevents breaker opening",
                attributes=(
                    DataAttribute(
                        "stVal", DataAttributeType.BOOLEAN, FunctionalConstraint.ST, "Block status"
                    ),
                    DataAttribute(
                        "ctlVal",
                        DataAttributeType.BOOLEAN,
                        FunctionalConstraint.CO,
                        "Block control",
                    ),
                ),
            ),
            DataObject(
                name="CBOpCap",
                cdc="INS",
                description="Circuit breaker operating capability",
                attributes=(
                    DataAttribute(
                        "stVal",
                        DataAttributeType.INT32,
                        FunctionalConstraint.ST,
                        "Operating capability status",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.ST, "Quality flag"
                    ),
                ),
            ),
        ),
    )


def _build_mmxu_ln(instance: int = 1) -> LogicalNode:
    """Build MMXU (Measurement Unit) logical node per IEC 61850-7-4.

    MMXU provides three-phase electrical measurements. This is the
    primary source of real-time power, voltage, current, and frequency
    data for the SCADA system.
    """
    return LogicalNode(
        class_name="MMXU",
        instance=instance,
        category=LogicalNodeCategory.MEASUREMENT,
        description="Three-phase electrical measurements",
        data_objects=(
            DataObject(
                name="TotW",
                cdc="MV",
                description="Total active power [MW]",
                attributes=(
                    DataAttribute(
                        "mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Magnitude",
                        "MW",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                    DataAttribute(
                        "t", DataAttributeType.TIMESTAMP, FunctionalConstraint.MX, "Timestamp"
                    ),
                ),
            ),
            DataObject(
                name="TotVAr",
                cdc="MV",
                description="Total reactive power [MVAR]",
                attributes=(
                    DataAttribute(
                        "mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Magnitude",
                        "MVAR",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                    DataAttribute(
                        "t", DataAttributeType.TIMESTAMP, FunctionalConstraint.MX, "Timestamp"
                    ),
                ),
            ),
            DataObject(
                name="Hz",
                cdc="MV",
                description="System frequency [Hz]",
                attributes=(
                    DataAttribute(
                        "mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Magnitude",
                        "Hz",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                    DataAttribute(
                        "t", DataAttributeType.TIMESTAMP, FunctionalConstraint.MX, "Timestamp"
                    ),
                ),
            ),
            DataObject(
                name="PhV",
                cdc="WYE",
                description="Phase-to-neutral voltages [kV]",
                attributes=(
                    DataAttribute(
                        "phsA.cVal.mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Phase A voltage",
                        "kV",
                    ),
                    DataAttribute(
                        "phsB.cVal.mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Phase B voltage",
                        "kV",
                    ),
                    DataAttribute(
                        "phsC.cVal.mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Phase C voltage",
                        "kV",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                ),
            ),
            DataObject(
                name="A",
                cdc="WYE",
                description="Phase currents [A]",
                attributes=(
                    DataAttribute(
                        "phsA.cVal.mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Phase A current",
                        "A",
                    ),
                    DataAttribute(
                        "phsB.cVal.mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Phase B current",
                        "A",
                    ),
                    DataAttribute(
                        "phsC.cVal.mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Phase C current",
                        "A",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                ),
            ),
        ),
    )


def _build_pdis_ln(instance: int = 1) -> LogicalNode:
    """Build PDIS (Distance Protection) logical node per IEC 61850-7-4.

    Distance protection measures impedance to determine fault location.
    Zone 1 covers ~80% of the protected line; Zone 2 covers ~120%.
    """
    return LogicalNode(
        class_name="PDIS",
        instance=instance,
        category=LogicalNodeCategory.PROTECTION,
        description="Distance protection (impedance-based fault detection)",
        data_objects=(
            DataObject(
                name="Op",
                cdc="ACT",
                description="Operation status — TRUE when protection has tripped",
                attributes=(
                    DataAttribute(
                        "general",
                        DataAttributeType.BOOLEAN,
                        FunctionalConstraint.ST,
                        "General trip status",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.ST, "Quality flag"
                    ),
                    DataAttribute(
                        "t", DataAttributeType.TIMESTAMP, FunctionalConstraint.ST, "Trip timestamp"
                    ),
                ),
            ),
            DataObject(
                name="Str",
                cdc="ACD",
                description="Start status — TRUE when protection has started",
                attributes=(
                    DataAttribute(
                        "general",
                        DataAttributeType.BOOLEAN,
                        FunctionalConstraint.ST,
                        "General start status",
                    ),
                    DataAttribute(
                        "dirGeneral",
                        DataAttributeType.CODED_ENUM,
                        FunctionalConstraint.ST,
                        "Fault direction",
                    ),
                ),
            ),
        ),
    )


def _build_ptoc_ln(instance: int = 1) -> LogicalNode:
    """Build PTOC (Time Overcurrent Protection) logical node per IEC 61850-7-4.

    PTOC detects overcurrent conditions and trips the associated breaker.
    Used as backup protection for the 220 kV busbar.
    """
    return LogicalNode(
        class_name="PTOC",
        instance=instance,
        category=LogicalNodeCategory.PROTECTION,
        description="Time overcurrent protection",
        data_objects=(
            DataObject(
                name="Op",
                cdc="ACT",
                description="Operation status — TRUE when protection has tripped",
                attributes=(
                    DataAttribute(
                        "general",
                        DataAttributeType.BOOLEAN,
                        FunctionalConstraint.ST,
                        "General trip status",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.ST, "Quality flag"
                    ),
                    DataAttribute(
                        "t", DataAttributeType.TIMESTAMP, FunctionalConstraint.ST, "Trip timestamp"
                    ),
                ),
            ),
            DataObject(
                name="Str",
                cdc="ACD",
                description="Start status — TRUE when overcurrent detected",
                attributes=(
                    DataAttribute(
                        "general",
                        DataAttributeType.BOOLEAN,
                        FunctionalConstraint.ST,
                        "Start status",
                    ),
                ),
            ),
        ),
    )


def _build_ptov_ln(instance: int = 1) -> LogicalNode:
    """Build PTOV (Overvoltage Protection) logical node per IEC 61850-7-4.

    Monitors voltage and trips when V exceeds threshold (e.g., 1.10 pu).
    Critical for Ferranti effect protection on long cables.
    """
    return LogicalNode(
        class_name="PTOV",
        instance=instance,
        category=LogicalNodeCategory.PROTECTION,
        description="Overvoltage protection",
        data_objects=(
            DataObject(
                name="Op",
                cdc="ACT",
                description="Operation status — TRUE when protection has tripped",
                attributes=(
                    DataAttribute(
                        "general",
                        DataAttributeType.BOOLEAN,
                        FunctionalConstraint.ST,
                        "General trip status",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.ST, "Quality flag"
                    ),
                    DataAttribute(
                        "t", DataAttributeType.TIMESTAMP, FunctionalConstraint.ST, "Trip timestamp"
                    ),
                ),
            ),
            DataObject(
                name="Str",
                cdc="ACD",
                description="Start status — TRUE when overvoltage detected",
                attributes=(
                    DataAttribute(
                        "general",
                        DataAttributeType.BOOLEAN,
                        FunctionalConstraint.ST,
                        "Start status",
                    ),
                ),
            ),
        ),
    )


def _build_ggio_ln(instance: int = 1) -> LogicalNode:
    """Build GGIO (Generic Process I/O) logical node per IEC 61850-7-4.

    GGIO handles non-electrical signals: SF6 gas pressure, oil temperature,
    ambient conditions, door contacts, etc.
    """
    return LogicalNode(
        class_name="GGIO",
        instance=instance,
        category=LogicalNodeCategory.GENERIC,
        description="Generic process I/O (SF6 pressure, oil temp, etc.)",
        data_objects=(
            DataObject(
                name="AnIn1",
                cdc="MV",
                description="SF6 gas pressure [bar]",
                attributes=(
                    DataAttribute(
                        "mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Magnitude",
                        "bar",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                ),
            ),
            DataObject(
                name="AnIn2",
                cdc="MV",
                description="Transformer oil temperature [°C]",
                attributes=(
                    DataAttribute(
                        "mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Magnitude",
                        "°C",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                ),
            ),
            DataObject(
                name="Ind1",
                cdc="SPS",
                description="Door contact status (open/closed)",
                attributes=(
                    DataAttribute(
                        "stVal",
                        DataAttributeType.BOOLEAN,
                        FunctionalConstraint.ST,
                        "Contact status",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.ST, "Quality flag"
                    ),
                ),
            ),
        ),
    )


# ── Wind Turbine Logical Nodes (IEC 61400-25) ──────────────────


def _build_wtur_ln(instance: int = 1) -> LogicalNode:
    """Build WTUR (Wind Turbine General) logical node per IEC 61400-25-2."""
    return LogicalNode(
        class_name="WTUR",
        instance=instance,
        category=LogicalNodeCategory.WIND,
        description="Wind turbine general operating state",
        data_objects=(
            DataObject(
                name="TurSt",
                cdc="INS",
                description="Turbine operating state (stopped/running/error)",
                attributes=(
                    DataAttribute(
                        "stVal",
                        DataAttributeType.CODED_ENUM,
                        FunctionalConstraint.ST,
                        "Operating state",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.ST, "Quality flag"
                    ),
                    DataAttribute(
                        "t", DataAttributeType.TIMESTAMP, FunctionalConstraint.ST, "Timestamp"
                    ),
                ),
            ),
            DataObject(
                name="TotWh",
                cdc="BCR",
                description="Total energy production [MWh]",
                attributes=(
                    DataAttribute(
                        "actVal",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.ST,
                        "Counter value",
                        "MWh",
                    ),
                ),
            ),
        ),
    )


def _build_wrot_ln(instance: int = 1) -> LogicalNode:
    """Build WROT (Wind Turbine Rotor) logical node per IEC 61400-25-2."""
    return LogicalNode(
        class_name="WROT",
        instance=instance,
        category=LogicalNodeCategory.WIND,
        description="Rotor speed and blade pitch monitoring",
        data_objects=(
            DataObject(
                name="RotSpd",
                cdc="MV",
                description="Rotor speed [rpm]",
                attributes=(
                    DataAttribute(
                        "mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Rotor speed",
                        "rpm",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                ),
            ),
            DataObject(
                name="BlPitchAn",
                cdc="MV",
                description="Blade pitch angle [deg]",
                attributes=(
                    DataAttribute(
                        "mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Pitch angle",
                        "deg",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                ),
            ),
        ),
    )


def _build_wgen_ln(instance: int = 1) -> LogicalNode:
    """Build WGEN (Wind Turbine Generator) logical node per IEC 61400-25-2."""
    return LogicalNode(
        class_name="WGEN",
        instance=instance,
        category=LogicalNodeCategory.WIND,
        description="Generator power output and reactive power",
        data_objects=(
            DataObject(
                name="TotW",
                cdc="MV",
                description="Active power output [MW]",
                attributes=(
                    DataAttribute(
                        "mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Active power",
                        "MW",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                    DataAttribute(
                        "t", DataAttributeType.TIMESTAMP, FunctionalConstraint.MX, "Timestamp"
                    ),
                ),
            ),
            DataObject(
                name="TotVAr",
                cdc="MV",
                description="Reactive power output [MVAR]",
                attributes=(
                    DataAttribute(
                        "mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Reactive power",
                        "MVAR",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                ),
            ),
        ),
    )


def _build_wmet_ln(instance: int = 1) -> LogicalNode:
    """Build WMET (Wind Turbine Meteorological) logical node per IEC 61400-25-2."""
    return LogicalNode(
        class_name="WMET",
        instance=instance,
        category=LogicalNodeCategory.WIND,
        description="Meteorological data from nacelle sensors",
        data_objects=(
            DataObject(
                name="HorWdSpd",
                cdc="MV",
                description="Horizontal wind speed [m/s]",
                attributes=(
                    DataAttribute(
                        "mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Wind speed",
                        "m/s",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                ),
            ),
            DataObject(
                name="HorWdDir",
                cdc="MV",
                description="Wind direction [deg]",
                attributes=(
                    DataAttribute(
                        "mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Wind direction",
                        "deg",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                ),
            ),
            DataObject(
                name="EnvTmp",
                cdc="MV",
                description="Ambient temperature [°C]",
                attributes=(
                    DataAttribute(
                        "mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Temperature",
                        "°C",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                ),
            ),
        ),
    )


def _build_wnac_ln(instance: int = 1) -> LogicalNode:
    """Build WNAC (Wind Turbine Nacelle) logical node per IEC 61400-25-2."""
    return LogicalNode(
        class_name="WNAC",
        instance=instance,
        category=LogicalNodeCategory.WIND,
        description="Nacelle conditions and yaw control",
        data_objects=(
            DataObject(
                name="NacTmp",
                cdc="MV",
                description="Nacelle internal temperature [°C]",
                attributes=(
                    DataAttribute(
                        "mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Temperature",
                        "°C",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                ),
            ),
            DataObject(
                name="YawAngle",
                cdc="MV",
                description="Nacelle yaw angle [deg]",
                attributes=(
                    DataAttribute(
                        "mag.f",
                        DataAttributeType.FLOAT32,
                        FunctionalConstraint.MX,
                        "Yaw angle",
                        "deg",
                    ),
                    DataAttribute(
                        "q", DataAttributeType.QUALITY, FunctionalConstraint.MX, "Quality flag"
                    ),
                ),
            ),
        ),
    )


# ── Factory Functions — Baltic Wind Alpha Device Set ────────────


def build_oss_protection_ied(
    name: str = "OSS_PROT_IED01",
    ip_address: str = "192.168.1.10",
) -> PhysicalDevice:
    """Build the OSS Protection IED (ABB REL670).

    Contains all protection and measurement logical nodes for the
    220 kV busbar: circuit breaker, measurements, distance protection,
    overcurrent protection, overvoltage protection, and generic I/O.

    Parameters
    ----------
    name : str
        IED instance name.
    ip_address : str
        MMS station bus IP address.

    Returns
    -------
    PhysicalDevice
        Complete protection IED with 6 logical nodes.
    """
    return PhysicalDevice(
        name=name,
        equipment_type=EquipmentType.PROTECTION_IED,
        manufacturer="ABB",
        model="REL670",
        ip_address=ip_address,
        description="220 kV busbar protection relay — distance + overcurrent + overvoltage",
        logical_devices=(
            LogicalDevice(
                inst="LD_Protection",
                description="Protection and measurement functions",
                logical_nodes=(
                    _build_xcbr_ln(1),
                    _build_mmxu_ln(1),
                    _build_pdis_ln(1),
                    _build_ptoc_ln(1),
                    _build_ptov_ln(1),
                    _build_ggio_ln(1),
                ),
            ),
        ),
    )


def build_oss_measurement_ied(
    name: str = "OSS_MEAS_IED01",
    ip_address: str = "192.168.1.11",
) -> PhysicalDevice:
    """Build the OSS Measurement IED (ABB REC670).

    Dedicated measurement IED for detailed three-phase power quality
    monitoring at the OSS 220 kV busbar.

    Parameters
    ----------
    name : str
        IED instance name.
    ip_address : str
        MMS station bus IP address.

    Returns
    -------
    PhysicalDevice
        Measurement IED with MMXU logical node.
    """
    return PhysicalDevice(
        name=name,
        equipment_type=EquipmentType.MEASUREMENT_IED,
        manufacturer="ABB",
        model="REC670",
        ip_address=ip_address,
        description="OSS 220 kV power quality measurement unit",
        logical_devices=(
            LogicalDevice(
                inst="LD_Measurement",
                description="Power quality measurement",
                logical_nodes=(_build_mmxu_ln(1),),
            ),
        ),
    )


def build_bay_controller(
    name: str = "OSS_BAY_CTRL01",
    ip_address: str = "192.168.1.12",
) -> PhysicalDevice:
    """Build the STATCOM Bay Controller (ABB COM600).

    Controls the STATCOM circuit breaker and monitors bay status.

    Parameters
    ----------
    name : str
        IED instance name.
    ip_address : str
        MMS station bus IP address.

    Returns
    -------
    PhysicalDevice
        Bay controller with XCBR and MMXU logical nodes.
    """
    return PhysicalDevice(
        name=name,
        equipment_type=EquipmentType.BAY_CONTROLLER,
        manufacturer="ABB",
        model="COM600",
        ip_address=ip_address,
        description="STATCOM bay controller — breaker control + measurements",
        logical_devices=(
            LogicalDevice(
                inst="LD_BayControl",
                description="STATCOM bay control and monitoring",
                logical_nodes=(
                    _build_xcbr_ln(1),
                    _build_mmxu_ln(1),
                ),
            ),
        ),
    )


def build_wind_turbine_controller(
    turbine_number: int,
    ip_address: str = "",
) -> PhysicalDevice:
    """Build a Wind Turbine Controller IED with IEC 61400-25 logical nodes.

    Each V236-15.0 MW turbine has an internal controller that presents
    SCADA data using the IEC 61400-25 data model (WTUR, WROT, WGEN,
    WMET, WNAC).

    Parameters
    ----------
    turbine_number : int
        Turbine number (1-34). Used for naming: 'WTG_01'.
    ip_address : str
        MMS station bus IP. Auto-generated if empty: '192.168.2.{turbine_number}'.

    Returns
    -------
    PhysicalDevice
        Wind turbine controller with 5 IEC 61400-25 logical nodes.
    """
    if not 1 <= turbine_number <= NUM_TURBINES:
        msg = f"Turbine number must be 1-{NUM_TURBINES}, got {turbine_number}"
        raise ValueError(msg)

    if not ip_address:
        ip_address = f"192.168.2.{turbine_number}"

    return PhysicalDevice(
        name=f"WTG_{turbine_number:02d}",
        equipment_type=EquipmentType.WTG_CONTROLLER,
        manufacturer="Vestas",
        model="V236-15.0",
        ip_address=ip_address,
        description=f"Vestas V236-15.0 MW turbine controller — WTG #{turbine_number}",
        logical_devices=(
            LogicalDevice(
                inst="LD_Turbine",
                description="Wind turbine SCADA data per IEC 61400-25",
                logical_nodes=(
                    _build_wtur_ln(1),
                    _build_wrot_ln(1),
                    _build_wgen_ln(1),
                    _build_wmet_ln(1),
                    _build_wnac_ln(1),
                ),
            ),
        ),
    )


def build_oss_goose_trip_dataset(
    ied_name: str = "OSS_PROT_IED01",
) -> Dataset:
    """Build the Trip Dataset for GOOSE publishing from protection IED.

    This dataset contains the protection trip signals that are published
    via GOOSE when a fault is detected. It includes the circuit breaker
    position and all protection function operation statuses.

    Parameters
    ----------
    ied_name : str
        Source IED name (for documentation/reference).

    Returns
    -------
    Dataset
        Trip dataset with XCBR position + protection trip signals.
    """
    return Dataset(
        name="TripDataset",
        description=f"Protection trip signals from {ied_name}",
        members=(
            DatasetMember("LD_Protection", "XCBR1", "Pos", FunctionalConstraint.ST),
            DatasetMember("LD_Protection", "PTOC1", "Op", FunctionalConstraint.ST),
            DatasetMember("LD_Protection", "PDIS1", "Op", FunctionalConstraint.ST),
            DatasetMember("LD_Protection", "PTOV1", "Op", FunctionalConstraint.ST),
        ),
    )


def build_oss_goose_control_block(
    ied_name: str = "OSS_PROT_IED01",
    dataset_name: str = "TripDataset",
) -> GOOSEControlBlock:
    """Build the GOOSE Control Block for OSS protection trip.

    GOOSE operates at Layer 2 Ethernet (no IP routing).
    AppID and MAC address follow IEC 61850-8-1 Annex A allocation.

    Parameters
    ----------
    ied_name : str
        Source IED name.
    dataset_name : str
        Dataset to publish.

    Returns
    -------
    GOOSEControlBlock
        GoCB configured for 220 kV busbar protection trip.
    """
    return GOOSEControlBlock(
        name="gcb_trip",
        app_id="0x0001",
        go_id=f"{ied_name}_220kV_BB_TRIP",
        dataset_name=dataset_name,
        mac_address="01:0C:CD:01:00:01",
        vlan_id=100,
        min_time_ms=2,
        max_time_ms=1000,
        description="220 kV busbar protection trip GOOSE publisher",
    )


def build_substation_configuration() -> list[PhysicalDevice]:
    """Build the complete IEC 61850 configuration for Baltic Wind Alpha.

    Returns the full set of IEDs:
    - 1 × OSS Protection IED (ABB REL670)
    - 1 × OSS Measurement IED (ABB REC670)
    - 1 × STATCOM Bay Controller (ABB COM600)
    - 34 × WTG Controllers (Vestas V236-15.0)

    Returns
    -------
    list[PhysicalDevice]
        All 37 IEDs in the substation.
    """
    devices: list[PhysicalDevice] = [
        build_oss_protection_ied(),
        build_oss_measurement_ied(),
        build_bay_controller(),
    ]
    for i in range(1, NUM_TURBINES + 1):
        devices.append(build_wind_turbine_controller(i))

    return devices


# ── Utility Functions ──────────────────────────────────────────


def get_total_logical_node_count(devices: list[PhysicalDevice]) -> int:
    """Count total logical nodes across all devices.

    Parameters
    ----------
    devices : list[PhysicalDevice]
        List of IEDs.

    Returns
    -------
    int
        Total logical node count.
    """
    total = 0
    for device in devices:
        for ld in device.logical_devices:
            total += len(ld.logical_nodes)
    return total


def find_logical_node(
    devices: list[PhysicalDevice],
    ln_class: str,
    instance: int = 1,
) -> LogicalNode | None:
    """Find a specific logical node by class and instance across all devices.

    Parameters
    ----------
    devices : list[PhysicalDevice]
        List of IEDs to search.
    ln_class : str
        Logical node class (e.g., 'XCBR', 'WTUR').
    instance : int
        Instance number (default: 1).

    Returns
    -------
    LogicalNode | None
        The matching LN, or None if not found.
    """
    for device in devices:
        for ld in device.logical_devices:
            for ln in ld.logical_nodes:
                if ln.class_name == ln_class and ln.instance == instance:
                    return ln
    return None


def get_device_by_name(
    devices: list[PhysicalDevice],
    name: str,
) -> PhysicalDevice | None:
    """Find a device by its name.

    Parameters
    ----------
    devices : list[PhysicalDevice]
        List of IEDs to search.
    name : str
        Device name (e.g., 'OSS_PROT_IED01', 'WTG_01').

    Returns
    -------
    PhysicalDevice | None
        The matching device, or None if not found.
    """
    for device in devices:
        if device.name == name:
            return device
    return None
