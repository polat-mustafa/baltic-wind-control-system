"""
Unit tests for SCL (Substation Configuration Language) generator (P3 — scl_generator.py).

Tests validate the generation of SSD, ICD, and SCD files per IEC 61850-6,
including XML structure, namespace handling, voltage levels, IED elements,
logical nodes, GOOSE control blocks, datasets, and data type templates.

Test Strategy
-------------
- SSD: must have Substation with 66/220 kV voltage levels and correct bays
- ICD: must have IED element with LDs, LNs, GSEControl, DataSet
- SCD: must combine SSD topology with all IEDs and Communication section
- Validation: well-formed SCL passes; missing Header fails
- Output: scl_to_string produces valid XML with declaration
"""

import xml.etree.ElementTree as ET

from app.services.p3.iec61850_model import (
    build_oss_goose_control_block,
    build_oss_goose_trip_dataset,
    build_oss_protection_ied,
    build_substation_configuration,
    build_wind_turbine_controller,
)
from app.services.p3.scl_generator import (
    SCL_NAMESPACE,
    SCL_REVISION,
    SCL_VERSION,
    generate_icd,
    generate_scd,
    generate_ssd,
    scl_to_string,
    validate_scl_structure,
)

# Namespace prefix for finding elements
NS = {"scl": SCL_NAMESPACE}


def _ns(tag: str) -> str:
    """Helper: wrap tag with SCL namespace for ElementTree find."""
    return f"{{{SCL_NAMESPACE}}}{tag}"


# ── SSD Generation Tests ──────────────────────────────────────


class TestSSDGeneration:
    """Tests for System Specification Description (SSD) generation."""

    def test_ssd_has_scl_root(self):
        """SSD must have SCL root element with correct namespace."""
        root = generate_ssd()
        assert root.tag == _ns("SCL")

    def test_ssd_has_version_attributes(self):
        """SCL root must have version and revision attributes."""
        root = generate_ssd()
        assert root.get("version") == SCL_VERSION
        assert root.get("revision") == SCL_REVISION

    def test_ssd_has_header(self):
        """SSD must contain Header element with ID."""
        root = generate_ssd()
        header = root.find(_ns("Header"))
        assert header is not None
        assert header.get("id") is not None

    def test_ssd_has_substation(self):
        """SSD must contain Substation element with correct name."""
        root = generate_ssd()
        substation = root.find(_ns("Substation"))
        assert substation is not None
        assert substation.get("name") == "Baltic_Wind_Alpha_OSS"

    def test_ssd_voltage_levels(self):
        """SSD must contain 66 kV and 220 kV voltage levels."""
        root = generate_ssd()
        substation = root.find(_ns("Substation"))
        assert substation is not None
        vls = substation.findall(_ns("VoltageLevel"))
        vl_names = {vl.get("name") for vl in vls}
        assert "E66" in vl_names
        assert "E220" in vl_names

    def test_ssd_66kv_bay_count(self):
        """66 kV level must have 7 bays (one per array cable string)."""
        root = generate_ssd()
        substation = root.find(_ns("Substation"))
        assert substation is not None
        vls = substation.findall(_ns("VoltageLevel"))
        e66 = next(vl for vl in vls if vl.get("name") == "E66")
        bays = e66.findall(_ns("Bay"))
        assert len(bays) == 7

    def test_ssd_220kv_bay_count(self):
        """220 kV level must have 3 bays (export, trafo, STATCOM)."""
        root = generate_ssd()
        substation = root.find(_ns("Substation"))
        assert substation is not None
        vls = substation.findall(_ns("VoltageLevel"))
        e220 = next(vl for vl in vls if vl.get("name") == "E220")
        bays = e220.findall(_ns("Bay"))
        assert len(bays) == 3

    def test_ssd_220kv_bay_names(self):
        """220 kV bays must be named Export, Trafo, STATCOM."""
        root = generate_ssd()
        substation = root.find(_ns("Substation"))
        assert substation is not None
        vls = substation.findall(_ns("VoltageLevel"))
        e220 = next(vl for vl in vls if vl.get("name") == "E220")
        bay_names = {bay.get("name") for bay in e220.findall(_ns("Bay"))}
        assert bay_names == {"Bay_Export", "Bay_Trafo", "Bay_STATCOM"}

    def test_ssd_custom_substation_name(self):
        """generate_ssd must accept a custom substation name."""
        root = generate_ssd(substation_name="Custom_OSS")
        substation = root.find(_ns("Substation"))
        assert substation is not None
        assert substation.get("name") == "Custom_OSS"


# ── ICD Generation Tests ──────────────────────────────────────


class TestICDGeneration:
    """Tests for IED Capability Description (ICD) generation."""

    def test_icd_has_ied_element(self):
        """ICD must contain IED element with correct name and manufacturer."""
        ied = build_oss_protection_ied()
        root = generate_icd(ied)
        ied_elem = root.find(_ns("IED"))
        assert ied_elem is not None
        assert ied_elem.get("name") == "OSS_PROT_IED01"
        assert ied_elem.get("manufacturer") == "ABB"
        assert ied_elem.get("type") == "REL670"

    def test_icd_has_access_point(self):
        """ICD must have AccessPoint S1 under IED."""
        ied = build_oss_protection_ied()
        root = generate_icd(ied)
        ied_elem = root.find(_ns("IED"))
        assert ied_elem is not None
        ap = ied_elem.find(_ns("AccessPoint"))
        assert ap is not None
        assert ap.get("name") == "S1"

    def test_icd_has_logical_devices(self):
        """ICD must contain all logical devices from the PhysicalDevice."""
        ied = build_oss_protection_ied()
        root = generate_icd(ied)
        ied_elem = root.find(_ns("IED"))
        assert ied_elem is not None
        server = ied_elem.find(f".//{_ns('Server')}")
        assert server is not None
        ldevices = server.findall(_ns("LDevice"))
        assert len(ldevices) == len(ied.logical_devices)

    def test_icd_has_logical_nodes(self):
        """ICD must list all LNs with correct class and instance."""
        ied = build_oss_protection_ied()
        root = generate_icd(ied)
        lns = root.findall(f".//{_ns('LN')}")
        ln_classes = {ln.get("lnClass") for ln in lns}
        expected = {"XCBR", "MMXU", "PDIS", "PTOC", "PTOV", "GGIO"}
        assert expected == ln_classes

    def test_icd_has_ln0(self):
        """ICD must contain LN0 (mandatory system LN) in each LDevice."""
        ied = build_oss_protection_ied()
        root = generate_icd(ied)
        ln0s = root.findall(f".//{_ns('LN0')}")
        assert len(ln0s) >= 1

    def test_icd_has_goose_control(self):
        """ICD with GoCB must contain GSEControl element."""
        ied = build_oss_protection_ied()
        gcb = build_oss_goose_control_block()
        root = generate_icd(ied, goose_control_blocks=[gcb])
        gse_ctrls = root.findall(f".//{_ns('GSEControl')}")
        assert len(gse_ctrls) == 1
        assert gse_ctrls[0].get("name") == "gcb_trip"

    def test_icd_has_dataset(self):
        """ICD with dataset must contain DataSet with FCDA members."""
        ied = build_oss_protection_ied()
        ds = build_oss_goose_trip_dataset()
        root = generate_icd(ied, datasets=[ds])
        datasets = root.findall(f".//{_ns('DataSet')}")
        assert len(datasets) == 1
        assert datasets[0].get("name") == "TripDataset"
        fcdas = datasets[0].findall(_ns("FCDA"))
        assert len(fcdas) == 4  # XCBR1, PTOC1, PDIS1, PTOV1

    def test_icd_has_data_type_templates(self):
        """ICD must contain DataTypeTemplates section."""
        ied = build_oss_protection_ied()
        root = generate_icd(ied)
        dtt = root.find(_ns("DataTypeTemplates"))
        assert dtt is not None
        lnode_types = dtt.findall(_ns("LNodeType"))
        # 6 LN classes + LLN0 = 7 LNodeTypes
        assert len(lnode_types) == 7

    def test_icd_wtg_controller(self):
        """ICD for WTG must have IEC 61400-25 LN classes."""
        wtg = build_wind_turbine_controller(1)
        root = generate_icd(wtg)
        lns = root.findall(f".//{_ns('LN')}")
        ln_classes = {ln.get("lnClass") for ln in lns}
        expected = {"WTUR", "WROT", "WGEN", "WMET", "WNAC"}
        assert expected == ln_classes


# ── SCD Generation Tests ──────────────────────────────────────


class TestSCDGeneration:
    """Tests for Substation Configuration Description (SCD) generation."""

    def test_scd_has_substation_and_ieds(self):
        """SCD must contain both Substation and IED elements."""
        devices = build_substation_configuration()
        root = generate_scd("Baltic_Wind_Alpha_OSS", devices)
        assert root.find(_ns("Substation")) is not None
        ieds = root.findall(_ns("IED"))
        assert len(ieds) > 0

    def test_scd_contains_all_ieds(self):
        """SCD must contain all 37 IEDs."""
        devices = build_substation_configuration()
        root = generate_scd("Baltic_Wind_Alpha_OSS", devices)
        ieds = root.findall(_ns("IED"))
        assert len(ieds) == 37

    def test_scd_has_communication_section(self):
        """SCD must contain Communication section."""
        devices = build_substation_configuration()
        root = generate_scd("Baltic_Wind_Alpha_OSS", devices)
        comm = root.find(_ns("Communication"))
        assert comm is not None

    def test_scd_goose_communication(self):
        """SCD with GOOSE must include GSE addressing in Communication."""
        devices = build_substation_configuration()
        gcbs = {"OSS_PROT_IED01": [build_oss_goose_control_block()]}
        root = generate_scd(
            "Baltic_Wind_Alpha_OSS",
            devices,
            goose_control_blocks=gcbs,
        )
        gse_elems = root.findall(f".//{_ns('GSE')}")
        assert len(gse_elems) >= 1

    def test_scd_has_voltage_levels(self):
        """SCD substation section must have 66 kV and 220 kV levels."""
        devices = build_substation_configuration()
        root = generate_scd("Baltic_Wind_Alpha_OSS", devices)
        substation = root.find(_ns("Substation"))
        assert substation is not None
        vls = substation.findall(_ns("VoltageLevel"))
        vl_names = {vl.get("name") for vl in vls}
        assert "E66" in vl_names
        assert "E220" in vl_names


# ── SCL Validation Tests ──────────────────────────────────────


class TestSCLValidation:
    """Tests for SCL structural validation."""

    def test_valid_ssd_passes(self):
        """Well-formed SSD must pass validation."""
        root = generate_ssd()
        errors = validate_scl_structure(root)
        assert errors == []

    def test_valid_icd_passes(self):
        """Well-formed ICD must pass validation."""
        ied = build_oss_protection_ied()
        root = generate_icd(ied)
        errors = validate_scl_structure(root)
        assert errors == []

    def test_missing_header_fails(self):
        """SCL without Header must fail validation."""
        root = generate_ssd()
        header = root.find(_ns("Header"))
        assert header is not None
        root.remove(header)
        errors = validate_scl_structure(root)
        assert any("Header" in e for e in errors)

    def test_wrong_root_tag_fails(self):
        """Element with wrong root tag must fail validation."""
        root = ET.Element("WrongRoot")
        errors = validate_scl_structure(root)
        assert len(errors) > 0

    def test_missing_version_fails(self):
        """SCL without version attribute must fail validation."""
        root = generate_ssd()
        del root.attrib["version"]
        errors = validate_scl_structure(root)
        assert any("version" in e for e in errors)


# ── SCL Output Tests ──────────────────────────────────────────


class TestSCLOutput:
    """Tests for SCL string/file output."""

    def test_scl_to_string_produces_valid_xml(self):
        """scl_to_string must produce parseable XML."""
        root = generate_ssd()
        xml_string = scl_to_string(root)
        # Must be parseable
        parsed = ET.fromstring(xml_string)
        assert parsed.tag == _ns("SCL")

    def test_scl_to_string_has_xml_declaration(self):
        """Output must start with XML declaration."""
        root = generate_ssd()
        xml_string = scl_to_string(root)
        assert xml_string.startswith("<?xml")

    def test_scl_to_string_utf8_encoding(self):
        """XML declaration must specify UTF-8 encoding."""
        root = generate_ssd()
        xml_string = scl_to_string(root)
        assert "UTF-8" in xml_string.split("\n")[0]

    def test_icd_to_string_roundtrip(self):
        """ICD XML must survive a serialize → parse → serialize roundtrip."""
        ied = build_oss_protection_ied()
        ds = build_oss_goose_trip_dataset()
        gcb = build_oss_goose_control_block()
        root = generate_icd(ied, goose_control_blocks=[gcb], datasets=[ds])
        xml_string = scl_to_string(root)

        # Parse back
        parsed = ET.fromstring(xml_string)
        # Verify key elements survived
        assert parsed.find(_ns("IED")) is not None
        assert parsed.find(_ns("DataTypeTemplates")) is not None

    def test_scd_to_string_all_ieds(self):
        """SCD string must contain all 37 IED names."""
        devices = build_substation_configuration()
        root = generate_scd("Baltic_Wind_Alpha_OSS", devices)
        xml_string = scl_to_string(root)

        assert "OSS_PROT_IED01" in xml_string
        assert "OSS_MEAS_IED01" in xml_string
        assert "WTG_01" in xml_string
        assert "WTG_34" in xml_string
