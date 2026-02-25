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
These are simplified educational SCL files. A production system integration
tool (e.g., ABB PCM600, Siemens DIGSI 5, Hitachi Energy ITT600) generates
the full schema with 200+ elements, XSD validation, and vendor-specific
extensions. Our simplified SCL demonstrates the key structural concepts
that interviewers test.

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
from pathlib import Path

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
    header.set("toolID", "BalticWindAlpha_P3")
    return header


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

    # Bays
    for bay_name in bay_names:
        bay = ET.SubElement(vl, _ns("Bay"))
        bay.set("name", bay_name)

    return vl


def _add_logical_node_to_ld(
    ld_elem: ET.Element,
    ln: LogicalNode,
) -> ET.Element:
    """Add an <LN> element for a logical node."""
    ln_elem = ET.SubElement(ld_elem, _ns("LN"))
    ln_elem.set("lnClass", ln.class_name)
    ln_elem.set("inst", str(ln.instance))
    ln_elem.set("lnType", f"{ln.class_name}_type")
    if ln.description:
        ln_elem.set("desc", ln.description)
    return ln_elem


def _add_logical_device(
    server: ET.Element,
    ld: LogicalDevice,
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
    ln0.set("lnType", "LLN0_type")

    # Datasets inside LN0
    if datasets:
        for ds in datasets:
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

    # GOOSE Control Blocks inside LN0
    if goose_control_blocks:
        for gcb in goose_control_blocks:
            gse_ctrl = ET.SubElement(ln0, _ns("GSEControl"))
            gse_ctrl.set("name", gcb.name)
            gse_ctrl.set("appID", gcb.app_id)
            gse_ctrl.set("datSet", gcb.dataset_name)
            gse_ctrl.set("confRev", "1")
            if gcb.description:
                gse_ctrl.set("desc", gcb.description)

    # Regular logical nodes
    for ln in ld.logical_nodes:
        _add_logical_node_to_ld(ld_elem, ln)

    return ld_elem


def _add_data_type_templates(
    root: ET.Element,
    devices: list[PhysicalDevice],
) -> ET.Element:
    """Add <DataTypeTemplates> with LNodeType definitions.

    Creates a type template for each unique LN class found across
    all devices, listing their data objects.
    """
    dtt = ET.SubElement(root, _ns("DataTypeTemplates"))

    # Collect unique LN classes and their data objects
    seen_classes: set[str] = set()
    for device in devices:
        for ld in device.logical_devices:
            for ln in ld.logical_nodes:
                if ln.class_name in seen_classes:
                    continue
                seen_classes.add(ln.class_name)

                lnode_type = ET.SubElement(dtt, _ns("LNodeType"))
                lnode_type.set("id", f"{ln.class_name}_type")
                lnode_type.set("lnClass", ln.class_name)

                for do in ln.data_objects:
                    do_elem = ET.SubElement(lnode_type, _ns("DO"))
                    do_elem.set("name", do.name)
                    do_elem.set("type", f"{do.cdc}_{do.name}")
                    if do.description:
                        do_elem.set("desc", do.description)

    # Add LLN0 type (always present)
    lln0_type = ET.SubElement(dtt, _ns("LNodeType"))
    lln0_type.set("id", "LLN0_type")
    lln0_type.set("lnClass", "LLN0")

    return dtt


# ── Public API — SCL Generation ────────────────────────────────


def generate_ssd(
    substation_name: str = "Baltic_Wind_Alpha_OSS",
    voltage_levels_kv: tuple[float, ...] = (66.0, 220.0),
    num_bays_per_level: dict[float, int] | None = None,
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
        Number of bays per voltage level.
        Default: {66.0: 7, 220.0: 3}.

    Returns
    -------
    ET.Element
        Root SCL XML element.
    """
    if num_bays_per_level is None:
        # 66 kV: 7 bays for 7 array cable strings
        # 220 kV: 3 bays (export, transformer, STATCOM)
        num_bays_per_level = {66.0: 7, 220.0: 3}

    root = _create_scl_root()
    _add_header(root, f"{substation_name}_SSD")

    substation = ET.SubElement(root, _ns("Substation"))
    substation.set("name", substation_name)
    substation.set("desc", "510 MW Baltic Sea Offshore Wind Farm — Offshore Substation")

    for kv in voltage_levels_kv:
        n_bays = num_bays_per_level.get(kv, 1)

        if kv == 66.0:
            level_name = "E66"
            bay_names = [f"Bay_String{i + 1}" for i in range(n_bays)]
        elif kv == 220.0:
            level_name = "E220"
            bay_names = ["Bay_Export", "Bay_Trafo", "Bay_STATCOM"][:n_bays]
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

    # IED element
    ied = ET.SubElement(root, _ns("IED"))
    ied.set("name", device.name)
    ied.set("manufacturer", device.manufacturer)
    ied.set("type", device.model)
    if device.description:
        ied.set("desc", device.description)

    # Access point
    ap = ET.SubElement(ied, _ns("AccessPoint"))
    ap.set("name", "S1")

    # Server
    server = ET.SubElement(ap, _ns("Server"))

    # Logical devices
    for ld in device.logical_devices:
        _add_logical_device(
            server, ld,
            datasets=datasets,
            goose_control_blocks=goose_control_blocks,
        )

    # Data type templates
    _add_data_type_templates(root, [device])

    return root


def generate_scd(
    substation_name: str,
    devices: list[PhysicalDevice],
    goose_control_blocks: dict[str, list[GOOSEControlBlock]] | None = None,
    datasets: dict[str, list[Dataset]] | None = None,
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
    substation.set("desc", "510 MW Baltic Sea Offshore Wind Farm — Offshore Substation")

    _add_voltage_level(
        substation, "E66", 66.0,
        [f"Bay_String{i + 1}" for i in range(7)],
    )
    _add_voltage_level(
        substation, "E220", 220.0,
        ["Bay_Export", "Bay_Trafo", "Bay_STATCOM"],
    )

    # Communication section — GOOSE multicast addressing
    comm = ET.SubElement(root, _ns("Communication"))
    for device in devices:
        device_gcbs = goose_control_blocks.get(device.name, [])
        if not device_gcbs and not device.ip_address:
            continue

        subnet = ET.SubElement(comm, _ns("SubNetwork"))
        subnet.set("name", "StationBus")
        subnet.set("type", "8-MMS")

        cap = ET.SubElement(subnet, _ns("ConnectedAP"))
        cap.set("iedName", device.name)
        cap.set("apName", "S1")

        # IP address
        if device.ip_address:
            addr = ET.SubElement(cap, _ns("Address"))
            p_ip = ET.SubElement(addr, _ns("P"))
            p_ip.set("type", "IP")
            p_ip.text = device.ip_address

        # GOOSE addresses
        for gcb in device_gcbs:
            gse = ET.SubElement(cap, _ns("GSE"))
            gse.set("ldInst", device.logical_devices[0].inst if device.logical_devices else "LD0")
            gse.set("cbName", gcb.name)

            gse_addr = ET.SubElement(gse, _ns("Address"))
            p_mac = ET.SubElement(gse_addr, _ns("P"))
            p_mac.set("type", "MAC-Address")
            p_mac.text = gcb.mac_address

            p_appid = ET.SubElement(gse_addr, _ns("P"))
            p_appid.set("type", "APPID")
            p_appid.text = gcb.app_id

            p_vlan = ET.SubElement(gse_addr, _ns("P"))
            p_vlan.set("type", "VLAN-ID")
            p_vlan.text = str(gcb.vlan_id)

    # IED sections (one per device)
    for device in devices:
        ied = ET.SubElement(root, _ns("IED"))
        ied.set("name", device.name)
        ied.set("manufacturer", device.manufacturer)
        ied.set("type", device.model)
        if device.description:
            ied.set("desc", device.description)

        ap = ET.SubElement(ied, _ns("AccessPoint"))
        ap.set("name", "S1")
        server = ET.SubElement(ap, _ns("Server"))

        device_ds = datasets.get(device.name, [])
        device_gcbs = goose_control_blocks.get(device.name, [])

        for ld in device.logical_devices:
            _add_logical_device(
                server, ld,
                datasets=device_ds if device_ds else None,
                goose_control_blocks=device_gcbs if device_gcbs else None,
            )

    # Data type templates
    _add_data_type_templates(root, devices)

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


def write_scl_file(root: ET.Element, path: Path) -> None:
    """Write an SCL XML element tree to a file.

    Parameters
    ----------
    root : ET.Element
        Root SCL element.
    path : Path
        Output file path (typically .ssd, .icd, or .scd extension).
    """
    xml_string = scl_to_string(root, indent=True)
    path.write_text(xml_string, encoding="UTF-8")


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
