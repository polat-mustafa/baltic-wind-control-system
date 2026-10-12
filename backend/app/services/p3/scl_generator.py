"""
SCL (Substation Configuration Language) file generator per IEC 61850-6.

Generates three SCL file types used in substation automation engineering:

  SSD (System Specification Description)
  ────────────────────────────────────────
  Describes the substation topology — voltage levels, bays, and equipment —
  independent of any specific IED configuration. This is the starting point
  of the IEC 61850 engineering process.

  ICD (IED Capability Description)
  ────────────────────────────────────
  Describes one IED's capabilities — its logical devices, logical nodes,
  data objects, datasets, and GOOSE control blocks. Provided by the IED
  vendor (e.g., ABB supplies the REL670 ICD file).

  SCD (Substation Configuration Description)
  ──────────────────────────────────────────────
  The complete system configuration — combines the SSD topology with all
  ICD files plus inter-IED communication (GOOSE subscriptions, network
  addressing). This is the master engineering file used by the system
  integrator.

Standard — IEC 61850-6 SCL Schema
------------------------------------
SCL files are XML documents following the IEC 61850-6 schema. Key sections:
  - <Header>: File identification and version
  - <Substation>: Physical topology (voltage levels, bays, equipment)
  - <IED>: Intelligent Electronic Device configuration
  - <Communication>: Network addressing (IP, GOOSE multicast, VLAN)
  - <DataTypeTemplates>: LN type definitions (LNodeType, DOType, DAType)

Implementation Note
---------------------
The files validate against the IEC 61850-6 SCL schema (Ed. 2, 2007B; checked by
tests/test_scl_schema.py with the official XSD when it is available). The data model is
simplified: each common data class carries the attributes the platform uses plus the
mandatory Beh (and Mod / Health / NamPlt on LLN0), not every optional attribute of
IEC 61850-7-3; there are no vendor private sections or Services capabilities. A
production integration tool (e.g., ABB PCM600, Siemens DIGSI 5, Hitachi Energy ITT600)
adds those.

References
----------
- IEC 61850-6: Configuration description language for communication in
  electrical substations related to IEDs
- IEC 61850-6 Ed. 2.1: Enhanced SCL with additional elements
- IEC 61850-8-1: Specific communication service mapping (SCSM) —
  Mappings to MMS and to ISO/IEC 8802-3

Constants
---------
- SCL namespace: http://www.iec.ch/61850/2003/SCL
- SCL version: 2007, revision B (Edition 2)
"""

from __future__ import annotations

import xml.etree.ElementTree as ET

from app.services.p2.network_model import SB510, FarmSpec
from app.services.p3.iec61850_model import (
    Dataset,
    GOOSEControlBlock,
    LogicalDevice,
    LogicalNode,
    PhysicalDevice,
)

# ── SCL Namespace & Version ────────────────────────────────────

SCL_NAMESPACE = "http://www.iec.ch/61850/2003/SCL"
SCL_VERSION = "2007"
SCL_REVISION = "B"

# Register namespace to avoid ns0: prefixes in output
ET.register_namespace("", SCL_NAMESPACE)


# ── Internal Helpers ───────────────────────────────────────────


def _ns(tag: str) -> str:
    """Wrap a tag with the SCL namespace."""
    return f"{{{SCL_NAMESPACE}}}{tag}"


def _create_scl_root() -> ET.Element:
    """Create the root <SCL> element with namespace and version attributes."""
    root = ET.Element(_ns("SCL"))
    root.set("version", SCL_VERSION)
    root.set("revision", SCL_REVISION)
    return root


def _add_header(parent: ET.Element, header_id: str, version: str = "1.0") -> ET.Element:
    """Add a <Header> element to the SCL root."""
    header = ET.SubElement(parent, _ns("Header"))
    header.set("id", header_id)
    header.set("version", version)
    header.set("toolID", "OffshoreForge_P3")
    return header


# OSS bays: 66 kV = bay controller registry (one feeder per string, 2 incomers,
# coupler); 220 kV = export cables, transformer HV bays, STATCOM, shunt reactors


def bays_66(spec: FarmSpec = SB510) -> tuple[str, ...]:
    return tuple(f"BAY-OSS-66-{i:02d}" for i in range(1, len(spec.string_layout) + 4))


def bays_220(spec: FarmSpec = SB510) -> tuple[str, ...]:
    return (
        *(f"Q-E{i}" for i in range(1, spec.num_export_cables + 1)),
        "Q-T1",
        "Q-T2",
        "Q-STATCOM",
        # OSS shunt reactors (one per export circuit; their onshore twins are onshore bays)
        *(f"Q-R{i}" for i in range(1, spec.reactors_per_end + 1)),
    )


def _desc(spec: FarmSpec) -> str:
    return f"{spec.capacity_mw:.0f} MW offshore wind farm ({spec.name}) — Offshore Substation"


BAYS_66 = bays_66()  # SB-510: 01 … 09
BAYS_220 = bays_220()  # SB-510: Q-E1/2, Q-T1/2, Q-STATCOM, Q-R1/2


def _add_voltage_level(
    substation: ET.Element,
    name: str,
    voltage_kv: float,
    bay_names: list[str],
) -> ET.Element:
    """Add a <VoltageLevel> with bays to a <Substation> element."""
    vl = ET.SubElement(substation, _ns("VoltageLevel"))
    vl.set("name", name)
    vl.set("nomFreq", "50")
    vl.set("numPhases", "3")

    # Voltage child element
    voltage_elem = ET.SubElement(vl, _ns("Voltage"))
    voltage_elem.set("multiplier", "k")
    voltage_elem.set("unit", "V")
    voltage_elem.text = str(int(voltage_kv))

    # Bays, each with its primary switchgear (IEC 61850-6 ConductingEquipment)
    for bay_name in bay_names:
        bay = ET.SubElement(vl, _ns("Bay"))
        bay.set("name", bay_name)
        for eq_name, eq_type in (("QA1", "CBR"), ("QB1", "DIS"), ("QB9", "DIS"), ("QC9", "DIS")):
            eq = ET.SubElement(bay, _ns("ConductingEquipment"))
            eq.set("name", eq_name)
            eq.set("type", eq_type)

    return vl


TypeKey = tuple[str, tuple[tuple[str, str], ...]]  # LN class + (DO name, CDC) set


def _signature(ln: LogicalNode) -> TypeKey:
    return ln.class_name, tuple((do.name, do.cdc) for do in ln.data_objects)


def _lnode_type_ids(
    devices: list[PhysicalDevice],
) -> dict[TypeKey, str]:
    """One LNodeType per LN class *and* data-object set (two GGIO with different
    signals need two types); ids OF_<class>_<n>, deterministic in device order."""
    ids: dict[TypeKey, str] = {}
    count: dict[str, int] = {}
    for device in devices:
        for ld in device.logical_devices:
            for ln in ld.logical_nodes:
                sig = _signature(ln)
                if sig not in ids:
                    count[ln.class_name] = count.get(ln.class_name, 0) + 1
                    ids[sig] = f"OF_{ln.class_name}_{count[ln.class_name]}"
    return ids


def _add_logical_node_to_ld(ld_elem: ET.Element, ln: LogicalNode, ln_type: str) -> ET.Element:
    """Add an <LN> element for a logical node."""
    ln_elem = ET.SubElement(ld_elem, _ns("LN"))
    ln_elem.set("lnClass", ln.class_name)
    ln_elem.set("inst", str(ln.instance))
    ln_elem.set("lnType", ln_type)
    if ln.description:
        ln_elem.set("desc", ln.description)
    return ln_elem


def _add_logical_device(
    server: ET.Element,
    ld: LogicalDevice,
    type_ids: dict[TypeKey, str],
    datasets: list[Dataset] | None = None,
    goose_control_blocks: list[GOOSEControlBlock] | None = None,
) -> ET.Element:
    """Add an <LDevice> element with LN0, LNs, datasets, and GOOSE control."""
    ld_elem = ET.SubElement(server, _ns("LDevice"))
    ld_elem.set("inst", ld.inst)
    if ld.description:
        ld_elem.set("desc", ld.description)

    # LN0 — mandatory system logical node
    ln0 = ET.SubElement(ld_elem, _ns("LN0"))
    ln0.set("lnClass", "LLN0")
    ln0.set("inst", "")
    ln0.set("lnType", LLN0_TYPE)

    # Datasets and GOOSE control blocks live in the LN0 of the LD whose data they publish
    own = [ds for ds in datasets or [] if all(m.logical_device_inst == ld.inst for m in ds.members)]
    for ds in own:
        ds_elem = ET.SubElement(ln0, _ns("DataSet"))
        ds_elem.set("name", ds.name)
        if ds.description:
            ds_elem.set("desc", ds.description)
        for member in ds.members:
            fcda = ET.SubElement(ds_elem, _ns("FCDA"))
            fcda.set("ldInst", member.logical_device_inst)
            fcda.set("lnClass", member.logical_node_name.rstrip("0123456789"))
            # Extract instance number from LN name (e.g., "XCBR1" → "1")
            ln_inst = "".join(c for c in member.logical_node_name if c.isdigit())
            fcda.set("lnInst", ln_inst)
            fcda.set("doName", member.data_object_name)
            fcda.set("fc", member.fc.value)
    names = {ds.name for ds in own}
    for gcb in goose_control_blocks or []:
        if gcb.dataset_name not in names:
            continue
        gse_ctrl = ET.SubElement(ln0, _ns("GSEControl"))
        gse_ctrl.set("name", gcb.name)
        gse_ctrl.set("appID", gcb.go_id)
        gse_ctrl.set("datSet", gcb.dataset_name)
        gse_ctrl.set("confRev", "1")
        if gcb.description:
            gse_ctrl.set("desc", gcb.description)

    # Regular logical nodes
    for ln in ld.logical_nodes:
        _add_logical_node_to_ld(ld_elem, ln, type_ids[_signature(ln)])

    return ld_elem


def _add_ied(
    root: ET.Element,
    device: PhysicalDevice,
    type_ids: dict[TypeKey, str],
    datasets: list[Dataset] | None,
    goose_control_blocks: list[GOOSEControlBlock] | None,
) -> ET.Element:
    """<IED> → <AccessPoint S1> → <Server> (with the mandatory <Authentication>) → LDs."""
    ied = ET.SubElement(root, _ns("IED"))
    ied.set("name", device.name)
    ied.set("manufacturer", device.manufacturer)
    ied.set("type", device.model)
    if device.description:
        ied.set("desc", device.description)
    ap = ET.SubElement(ied, _ns("AccessPoint"))
    ap.set("name", "S1")
    server = ET.SubElement(ap, _ns("Server"))
    ET.SubElement(server, _ns("Authentication"))
    for ld in device.logical_devices:
        _add_logical_device(server, ld, type_ids, datasets, goose_control_blocks)
    return ied


# ── Data type templates (IEC 61850-7-3 common data classes, simplified) ──

LLN0_TYPE = "OF_LLN0"
# Enumerations (IEC 61850-7-3 / 7-4); TurSt is this platform's teaching enumeration of the
# IEC 61400-25-2 turbine states.
ENUMS: dict[str, tuple[str, ...]] = {
    "Beh": ("on", "blocked", "test", "test/blocked", "off"),
    "Health": ("Ok", "Warning", "Alarm"),
    "ctlModel": (
        "status-only",
        "direct-with-normal-security",
        "sbo-with-normal-security",
        "direct-with-enhanced-security",
        "sbo-with-enhanced-security",
    ),
    "dirGeneral": ("unknown", "forward", "backward", "both"),
    "TurSt": ("stopped", "starting", "running", "stopping", "error", "maintenance"),
}
ENUM_FIRST_ORD = {"ctlModel": 0, "dirGeneral": 0}  # others count from 1

# (name, fc, bType, type) per CDC; bType Struct/Enum name a DAType/EnumType id
_Q_T = [("q", "ST", "Quality", None), ("t", "ST", "Timestamp", None)]
CDC_DAS: dict[str, list[tuple[str, str, str, str | None]]] = {
    "SPS": [("stVal", "ST", "BOOLEAN", None), *_Q_T],
    "INS": [("stVal", "ST", "INT32", None), *_Q_T],
    "ENS": [("stVal", "ST", "Enum", None), *_Q_T],
    "ACT": [("general", "ST", "BOOLEAN", None), *_Q_T],
    "ACD": [
        ("general", "ST", "BOOLEAN", None),
        ("dirGeneral", "ST", "Enum", "dirGeneral"),
        *_Q_T,
    ],
    "SPC": [
        ("stVal", "ST", "BOOLEAN", None),
        *_Q_T,
        ("ctlVal", "CO", "BOOLEAN", None),
        ("ctlModel", "CF", "Enum", "ctlModel"),
    ],
    "DPC": [
        ("stVal", "ST", "Dbpos", None),
        *_Q_T,
        ("ctlVal", "CO", "BOOLEAN", None),
        ("ctlModel", "CF", "Enum", "ctlModel"),
    ],
    "BCR": [("actVal", "ST", "INT64", None), *_Q_T],
    "MV": [
        ("mag", "MX", "Struct", "OF_AnalogueValue"),
        ("q", "MX", "Quality", None),
        ("t", "MX", "Timestamp", None),
    ],
    "CMV": [
        ("cVal", "MX", "Struct", "OF_Vector"),
        ("q", "MX", "Quality", None),
        ("t", "MX", "Timestamp", None),
    ],
    "LPL": [
        ("vendor", "DC", "VisString255", None),
        ("swRev", "DC", "VisString255", None),
        ("configRev", "DC", "VisString255", None),
    ],
}
CDC_SDOS: dict[str, tuple[str, ...]] = {"WYE": ("phsA", "phsB", "phsC")}  # → CMV
# Every LN carries Beh (IEC 61850-7-4 mandatory); LLN0 also Mod, Health and NamPlt
COMMON_DOS = (("Beh", "ENS_Beh"),)
LLN0_DOS = (("Mod", "ENS_Beh"), ("Beh", "ENS_Beh"), ("Health", "ENS_Health"), ("NamPlt", "LPL"))


def _do_type_id(cdc: str, do_name: str) -> str:
    if cdc == "INS" and do_name == "TurSt":
        return "ENS_TurSt"  # an enumerated state, not an integer
    return cdc


def _add_data_type_templates(
    root: ET.Element,
    devices: list[PhysicalDevice],
    type_ids: dict[TypeKey, str],
) -> ET.Element:
    """<DataTypeTemplates>: LNodeType per LN class and data-object set, DOType per CDC
    (IEC 61850-7-3, simplified: the attributes the platform uses), DAType and EnumType.
    The output validates against the IEC 61850-6 SCL schema (engineering audit F7)."""
    dtt = ET.SubElement(root, _ns("DataTypeTemplates"))

    lln0 = ET.SubElement(dtt, _ns("LNodeType"))
    lln0.set("id", LLN0_TYPE)
    lln0.set("lnClass", "LLN0")
    for name, t in LLN0_DOS:
        ET.SubElement(lln0, _ns("DO"), {"name": name, "type": t})

    used: set[str] = {t for _, t in LLN0_DOS}
    reps: dict[str, LogicalNode] = {}
    for device in devices:
        for ld in device.logical_devices:
            for ln in ld.logical_nodes:
                reps.setdefault(type_ids[_signature(ln)], ln)
    for type_id, ln in reps.items():
        lnt = ET.SubElement(dtt, _ns("LNodeType"))
        lnt.set("id", type_id)
        lnt.set("lnClass", ln.class_name)
        for name, t in COMMON_DOS:
            ET.SubElement(lnt, _ns("DO"), {"name": name, "type": t})
            used.add(t)
        for do in ln.data_objects:
            t = _do_type_id(do.cdc, do.name)
            attrs = {"name": do.name, "type": t}
            if do.description:
                attrs["desc"] = do.description
            ET.SubElement(lnt, _ns("DO"), attrs)
            used.add(t)

    def do_type(type_id: str) -> None:
        cdc, _, enum = type_id.partition("_")
        dot = ET.SubElement(dtt, _ns("DOType"), {"id": type_id, "cdc": cdc})
        for sdo in CDC_SDOS.get(cdc, ()):
            ET.SubElement(dot, _ns("SDO"), {"name": sdo, "type": "CMV"})
        for name, fc, btype, ref in CDC_DAS.get(cdc, []):
            da = {"name": name, "fc": fc, "bType": btype}
            if btype == "Enum":
                da["type"] = ref or enum
            elif ref:
                da["type"] = ref
            ET.SubElement(dot, _ns("DA"), da)

    if any(t == "WYE" for t in used):
        used.add("CMV")
    for t in sorted(used):
        do_type(t)

    av = ET.SubElement(dtt, _ns("DAType"), {"id": "OF_AnalogueValue"})
    ET.SubElement(av, _ns("BDA"), {"name": "f", "bType": "FLOAT32"})
    vec = ET.SubElement(dtt, _ns("DAType"), {"id": "OF_Vector"})
    ET.SubElement(vec, _ns("BDA"), {"name": "mag", "bType": "Struct", "type": "OF_AnalogueValue"})

    for enum_id, values in ENUMS.items():
        et = ET.SubElement(dtt, _ns("EnumType"), {"id": enum_id})
        first = ENUM_FIRST_ORD.get(enum_id, 1)
        for k, v in enumerate(values):
            ev = ET.SubElement(et, _ns("EnumVal"), {"ord": str(first + k)})
            ev.text = v
    return dtt


# ── Public API — SCL Generation ────────────────────────────────


def generate_ssd(
    substation_name: str = "SB510_OSS",
    voltage_levels_kv: tuple[float, ...] = (66.0, 220.0),
    num_bays_per_level: dict[float, int] | None = None,
    spec: FarmSpec = SB510,
) -> ET.Element:
    """Generate a System Specification Description (SSD) SCL file.

    The SSD describes the substation topology — voltage levels, bays,
    and equipment — independent of any specific IED configuration.
    This is the starting point of the IEC 61850 engineering process.

    Parameters
    ----------
    substation_name : str
        Substation name in the SCL.
    voltage_levels_kv : tuple[float, ...]
        Voltage levels present in the substation.
    num_bays_per_level : dict[float, int] | None
        Number of bays per voltage level (truncates the plant's bay list).
        Default: all bays — 66 kV: 6 string feeders, 2 transformer incomers and
        the bus coupler; 220 kV: 2 export cables, 2 transformer HV bays,
        STATCOM and 3 shunt reactors.

    Returns
    -------
    ET.Element
        Root SCL XML element.
    """
    if num_bays_per_level is None:
        num_bays_per_level = {66.0: len(bays_66(spec)), 220.0: len(bays_220(spec))}

    root = _create_scl_root()
    _add_header(root, f"{substation_name}_SSD")

    substation = ET.SubElement(root, _ns("Substation"))
    substation.set("name", substation_name)
    substation.set("desc", _desc(spec))

    for kv in voltage_levels_kv:
        n_bays = num_bays_per_level.get(kv, 1)

        if kv == 66.0:
            level_name = "E66"
            bay_names = list(bays_66(spec)[:n_bays])
        elif kv == 220.0:
            level_name = "E220"
            bay_names = list(bays_220(spec)[:n_bays])
        else:
            level_name = f"E{int(kv)}"
            bay_names = [f"Bay_{i + 1}" for i in range(n_bays)]

        _add_voltage_level(substation, level_name, kv, bay_names)

    return root


def generate_icd(
    device: PhysicalDevice,
    goose_control_blocks: list[GOOSEControlBlock] | None = None,
    datasets: list[Dataset] | None = None,
) -> ET.Element:
    """Generate an IED Capability Description (ICD) SCL file.

    The ICD describes one IED's capabilities — its logical devices,
    logical nodes, data objects, datasets, and GOOSE control blocks.

    Parameters
    ----------
    device : PhysicalDevice
        The IED to describe.
    goose_control_blocks : list[GOOSEControlBlock] | None
        GOOSE control blocks for this IED.
    datasets : list[Dataset] | None
        Datasets configured on this IED.

    Returns
    -------
    ET.Element
        Root SCL XML element.
    """
    root = _create_scl_root()
    _add_header(root, f"{device.name}_ICD")
    type_ids = _lnode_type_ids([device])
    _add_ied(root, device, type_ids, datasets, goose_control_blocks)
    _add_data_type_templates(root, [device], type_ids)
    return root


def generate_scd(
    substation_name: str,
    devices: list[PhysicalDevice],
    goose_control_blocks: dict[str, list[GOOSEControlBlock]] | None = None,
    datasets: dict[str, list[Dataset]] | None = None,
    spec: FarmSpec = SB510,
) -> ET.Element:
    """Generate a Substation Configuration Description (SCD) SCL file.

    The SCD is the complete system configuration — combines the SSD
    (substation topology) with all ICD files (IED configurations) plus
    inter-IED communication (GOOSE subscriptions).

    This is the master engineering file used by the system integrator.

    Parameters
    ----------
    substation_name : str
        Substation name.
    devices : list[PhysicalDevice]
        All IEDs in the substation.
    goose_control_blocks : dict[str, list[GOOSEControlBlock]] | None
        GOOSE control blocks keyed by IED name.
    datasets : dict[str, list[Dataset]] | None
        Datasets keyed by IED name.

    Returns
    -------
    ET.Element
        Root SCL XML element.
    """
    if goose_control_blocks is None:
        goose_control_blocks = {}
    if datasets is None:
        datasets = {}

    root = _create_scl_root()
    _add_header(root, f"{substation_name}_SCD")

    # Substation topology (SSD section)
    substation = ET.SubElement(root, _ns("Substation"))
    substation.set("name", substation_name)
    substation.set("desc", _desc(spec))

    _add_voltage_level(substation, "E66", 66.0, list(bays_66(spec)))
    _add_voltage_level(substation, "E220", 220.0, list(bays_220(spec)))

    # Communication: one station bus, one ConnectedAP per IED with its IP and GOOSE
    comm = ET.SubElement(root, _ns("Communication"))
    subnet = ET.SubElement(comm, _ns("SubNetwork"))
    subnet.set("name", "StationBus")
    subnet.set("type", "8-MMS")
    for device in devices:
        device_gcbs = goose_control_blocks.get(device.name, [])
        if not device_gcbs and not device.ip_address:
            continue
        cap = ET.SubElement(subnet, _ns("ConnectedAP"))
        cap.set("iedName", device.name)
        cap.set("apName", "S1")
        if device.ip_address:
            addr = ET.SubElement(cap, _ns("Address"))
            p_ip = ET.SubElement(addr, _ns("P"))
            p_ip.set("type", "IP")
            p_ip.text = device.ip_address
        for gcb in device_gcbs:
            ld_inst = next(
                (
                    ds.members[0].logical_device_inst
                    for ds in datasets.get(device.name, [])
                    if ds.name == gcb.dataset_name and ds.members
                ),
                device.logical_devices[0].inst if device.logical_devices else "LD0",
            )
            gse = ET.SubElement(cap, _ns("GSE"))
            gse.set("ldInst", ld_inst)
            gse.set("cbName", gcb.name)
            gse_addr = ET.SubElement(gse, _ns("Address"))
            # IEC 61850-6 address formats: MAC with hyphens, APPID 4 and VLAN-ID 3 hex digits
            for p_type, text in (
                ("MAC-Address", gcb.mac_address.replace(":", "-").upper()),
                ("APPID", f"{int(gcb.app_id, 16):04X}"),
                ("VLAN-PRIORITY", "4"),
                ("VLAN-ID", f"{gcb.vlan_id:03X}"),
            ):
                p_el = ET.SubElement(gse_addr, _ns("P"))
                p_el.set("type", p_type)
                p_el.text = text
            for tag, ms in (("MinTime", gcb.min_time_ms), ("MaxTime", gcb.max_time_ms)):
                t_el = ET.SubElement(gse, _ns(tag), {"unit": "s", "multiplier": "m"})
                t_el.text = str(ms)

    type_ids = _lnode_type_ids(devices)
    for device in devices:
        _add_ied(
            root,
            device,
            type_ids,
            datasets.get(device.name) or None,
            goose_control_blocks.get(device.name) or None,
        )
    _add_data_type_templates(root, devices, type_ids)
    return root


# ── Output Functions ───────────────────────────────────────────


def scl_to_string(root: ET.Element, indent: bool = True) -> str:
    """Convert an SCL XML element tree to a formatted string.

    Parameters
    ----------
    root : ET.Element
        Root SCL element from generate_ssd/icd/scd.
    indent : bool
        If True, pretty-print with indentation. Default: True.

    Returns
    -------
    str
        Well-formed XML string with declaration.
    """
    if indent:
        ET.indent(root, space="  ")

    tree = ET.ElementTree(root)
    # Use bytes buffer to get declaration, then decode
    import io

    buf = io.BytesIO()
    tree.write(buf, encoding="UTF-8", xml_declaration=True)
    return buf.getvalue().decode("UTF-8")


def validate_scl_structure(root: ET.Element) -> list[str]:
    """Validate basic SCL structural requirements.

    Checks for required sections (Header, Substation or IED) and
    correct namespace usage. This is NOT full XSD validation — just
    basic sanity checks for educational purposes.

    Parameters
    ----------
    root : ET.Element
        Root SCL element to validate.

    Returns
    -------
    list[str]
        List of validation error messages. Empty list = valid.
    """
    errors: list[str] = []

    # Check root tag
    expected_root = _ns("SCL")
    if root.tag != expected_root:
        errors.append(f"Root element must be '{expected_root}', got '{root.tag}'")
        return errors  # Can't proceed without correct root

    # Check Header
    header = root.find(_ns("Header"))
    if header is None:
        errors.append("Missing required <Header> element")

    # Check for at least Substation or IED
    substation = root.find(_ns("Substation"))
    ied = root.find(_ns("IED"))
    if substation is None and ied is None:
        errors.append("SCL must contain at least <Substation> or <IED>")

    # Check version attribute
    version = root.get("version")
    if version != SCL_VERSION:
        errors.append(f"SCL version must be '{SCL_VERSION}', got '{version}'")

    # Check revision attribute
    revision = root.get("revision")
    if revision != SCL_REVISION:
        errors.append(f"SCL revision must be '{SCL_REVISION}', got '{revision}'")

    return errors
