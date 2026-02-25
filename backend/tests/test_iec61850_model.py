"""
Unit tests for IEC 61850 data model (P3 — iec61850_model.py).

Tests validate the IEC 61850 device hierarchy, logical node structure,
data object contents, GOOSE control blocks, and the complete Baltic Wind
Alpha substation configuration (37 devices: 3 OSS IEDs + 34 WTG controllers).

Test Strategy
-------------
- Hierarchy completeness: every device has logical devices, nodes, and data objects
- OSS Protection IED: must contain XCBR, MMXU, PDIS, PTOC, PTOV, GGIO
- WTG Controller: must contain WTUR, WROT, WGEN, WMET, WNAC (IEC 61400-25)
- GOOSE: trip dataset must reference correct LNs, timing must be < 4 ms
- Naming: WTG_01 through WTG_34, unique IP addresses
"""

import pytest

from app.services.p3.iec61850_model import (
    TOTAL_DEVICES,
    DataAttributeType,
    EquipmentType,
    FunctionalConstraint,
    LogicalNodeCategory,
    SwitchPosition,
    TurbineOperatingState,
    build_bay_controller,
    build_oss_goose_control_block,
    build_oss_goose_trip_dataset,
    build_oss_measurement_ied,
    build_oss_protection_ied,
    build_substation_configuration,
    build_wind_turbine_controller,
    find_logical_node,
    get_device_by_name,
    get_total_logical_node_count,
)

# ── Hierarchy Structure Tests ──────────────────────────────────


class TestIEC61850Hierarchy:
    """Tests for the IEC 61850 data model hierarchy structure."""

    def test_physical_device_has_logical_devices(self):
        """OSS Protection IED must have at least one logical device."""
        ied = build_oss_protection_ied()
        assert len(ied.logical_devices) >= 1

    def test_logical_device_has_logical_nodes(self):
        """LD_Protection must have logical nodes."""
        ied = build_oss_protection_ied()
        ld = ied.logical_devices[0]
        assert len(ld.logical_nodes) > 0

    def test_logical_node_has_data_objects(self):
        """Each logical node must have at least one data object."""
        ied = build_oss_protection_ied()
        for ld in ied.logical_devices:
            for ln in ld.logical_nodes:
                assert len(ln.data_objects) > 0, f"{ln.name} has no data objects"

    def test_data_object_has_attributes(self):
        """Each data object must have at least one data attribute."""
        ied = build_oss_protection_ied()
        for ld in ied.logical_devices:
            for ln in ld.logical_nodes:
                for do in ln.data_objects:
                    assert len(do.attributes) > 0, (
                        f"{ln.name}.{do.name} has no attributes"
                    )

    def test_data_attribute_functional_constraints(self):
        """Data attributes must have valid functional constraints."""
        ied = build_oss_protection_ied()
        valid_fcs = set(FunctionalConstraint)
        for ld in ied.logical_devices:
            for ln in ld.logical_nodes:
                for do in ln.data_objects:
                    for da in do.attributes:
                        assert da.fc in valid_fcs, (
                            f"{ln.name}.{do.name}.{da.name} has invalid FC: {da.fc}"
                        )


# ── OSS Protection IED Tests ──────────────────────────────────


class TestOSSProtectionIED:
    """Tests for the OSS Protection IED (ABB REL670)."""

    def test_protection_ied_manufacturer(self):
        """OSS Protection IED must be ABB REL670."""
        ied = build_oss_protection_ied()
        assert ied.manufacturer == "ABB"
        assert ied.model == "REL670"

    def test_protection_ied_equipment_type(self):
        """Must be classified as protection_ied."""
        ied = build_oss_protection_ied()
        assert ied.equipment_type == EquipmentType.PROTECTION_IED

    def test_protection_ied_logical_nodes(self):
        """Must contain XCBR, MMXU, PDIS, PTOC, PTOV, GGIO."""
        ied = build_oss_protection_ied()
        ld = ied.logical_devices[0]
        ln_classes = {ln.class_name for ln in ld.logical_nodes}
        expected = {"XCBR", "MMXU", "PDIS", "PTOC", "PTOV", "GGIO"}
        assert expected == ln_classes

    def test_protection_ied_has_6_lns(self):
        """OSS Protection IED must have exactly 6 logical nodes."""
        ied = build_oss_protection_ied()
        ld = ied.logical_devices[0]
        assert len(ld.logical_nodes) == 6

    def test_xcbr_has_position_data_object(self):
        """XCBR1 must have Pos (position) data object with DPC type."""
        ied = build_oss_protection_ied()
        ld = ied.logical_devices[0]
        xcbr = next(ln for ln in ld.logical_nodes if ln.class_name == "XCBR")
        pos_do = next(do for do in xcbr.data_objects if do.name == "Pos")
        assert pos_do.cdc == "DPC"

    def test_mmxu_has_power_measurements(self):
        """MMXU1 must have TotW, TotVAr, Hz, PhV, A data objects."""
        ied = build_oss_protection_ied()
        ld = ied.logical_devices[0]
        mmxu = next(ln for ln in ld.logical_nodes if ln.class_name == "MMXU")
        do_names = {do.name for do in mmxu.data_objects}
        expected = {"TotW", "TotVAr", "Hz", "PhV", "A"}
        assert expected == do_names

    def test_logical_node_name_format(self):
        """LN name must be class + instance (e.g., 'XCBR1')."""
        ied = build_oss_protection_ied()
        ld = ied.logical_devices[0]
        for ln in ld.logical_nodes:
            assert ln.name == f"{ln.class_name}{ln.instance}"

    def test_protection_ied_ip_address(self):
        """Default IP address must be 192.168.1.10."""
        ied = build_oss_protection_ied()
        assert ied.ip_address == "192.168.1.10"


# ── OSS Measurement IED Tests ─────────────────────────────────


class TestOSSMeasurementIED:
    """Tests for the OSS Measurement IED (ABB REC670)."""

    def test_measurement_ied_has_mmxu(self):
        """Measurement IED must have at least one MMXU logical node."""
        ied = build_oss_measurement_ied()
        ld = ied.logical_devices[0]
        ln_classes = {ln.class_name for ln in ld.logical_nodes}
        assert "MMXU" in ln_classes

    def test_measurement_ied_type(self):
        """Must be classified as measurement_ied."""
        ied = build_oss_measurement_ied()
        assert ied.equipment_type == EquipmentType.MEASUREMENT_IED


# ── Bay Controller Tests ───────────────────────────────────────


class TestBayController:
    """Tests for the STATCOM Bay Controller (ABB COM600)."""

    def test_bay_controller_has_xcbr_and_mmxu(self):
        """Bay controller must have XCBR and MMXU."""
        bc = build_bay_controller()
        ld = bc.logical_devices[0]
        ln_classes = {ln.class_name for ln in ld.logical_nodes}
        assert {"XCBR", "MMXU"} == ln_classes

    def test_bay_controller_type(self):
        """Must be classified as bay_controller."""
        bc = build_bay_controller()
        assert bc.equipment_type == EquipmentType.BAY_CONTROLLER


# ── Wind Turbine Controller Tests ──────────────────────────────


class TestWindTurbineController:
    """Tests for Wind Turbine Controller IED (IEC 61400-25)."""

    def test_wtg_controller_logical_nodes(self):
        """WTG controller must contain WTUR, WROT, WGEN, WMET, WNAC."""
        wtg = build_wind_turbine_controller(1)
        ld = wtg.logical_devices[0]
        ln_classes = {ln.class_name for ln in ld.logical_nodes}
        expected = {"WTUR", "WROT", "WGEN", "WMET", "WNAC"}
        assert expected == ln_classes

    def test_wtg_has_5_lns(self):
        """WTG controller must have exactly 5 IEC 61400-25 logical nodes."""
        wtg = build_wind_turbine_controller(1)
        ld = wtg.logical_devices[0]
        assert len(ld.logical_nodes) == 5

    def test_wtg_naming_convention(self):
        """WTG controllers must be named WTG_01 through WTG_34."""
        for i in range(1, 35):
            wtg = build_wind_turbine_controller(i)
            assert wtg.name == f"WTG_{i:02d}"

    def test_wtg_ip_auto_generation(self):
        """Auto-generated IP must be 192.168.2.{turbine_number}."""
        wtg = build_wind_turbine_controller(5)
        assert wtg.ip_address == "192.168.2.5"

    def test_wtg_manufacturer(self):
        """WTG controller must be Vestas V236-15.0."""
        wtg = build_wind_turbine_controller(1)
        assert wtg.manufacturer == "Vestas"
        assert wtg.model == "V236-15.0"

    def test_wtg_equipment_type(self):
        """Must be classified as wtg_controller."""
        wtg = build_wind_turbine_controller(1)
        assert wtg.equipment_type == EquipmentType.WTG_CONTROLLER

    def test_wtg_invalid_number_raises(self):
        """Turbine number outside 1-34 must raise ValueError."""
        with pytest.raises(ValueError, match="Turbine number must be"):
            build_wind_turbine_controller(0)
        with pytest.raises(ValueError, match="Turbine number must be"):
            build_wind_turbine_controller(35)

    def test_wgen_has_active_power(self):
        """WGEN must have TotW data object for active power output."""
        wtg = build_wind_turbine_controller(1)
        ld = wtg.logical_devices[0]
        wgen = next(ln for ln in ld.logical_nodes if ln.class_name == "WGEN")
        do_names = {do.name for do in wgen.data_objects}
        assert "TotW" in do_names

    def test_wmet_has_wind_speed(self):
        """WMET must have HorWdSpd data object for wind speed."""
        wtg = build_wind_turbine_controller(1)
        ld = wtg.logical_devices[0]
        wmet = next(ln for ln in ld.logical_nodes if ln.class_name == "WMET")
        do_names = {do.name for do in wmet.data_objects}
        assert "HorWdSpd" in do_names

    def test_all_wtg_lns_are_wind_category(self):
        """All WTG logical nodes must have category 'W' (Wind)."""
        wtg = build_wind_turbine_controller(1)
        ld = wtg.logical_devices[0]
        for ln in ld.logical_nodes:
            assert ln.category == LogicalNodeCategory.WIND


# ── Substation Configuration Tests ─────────────────────────────


class TestSubstationConfiguration:
    """Tests for the complete Baltic Wind Alpha device set."""

    def test_total_device_count(self):
        """Must have 37 devices (3 OSS IEDs + 34 WTG controllers)."""
        devices = build_substation_configuration()
        assert len(devices) == TOTAL_DEVICES

    def test_total_logical_node_count(self):
        """Total LN count must match: 6 (prot) + 1 (meas) + 2 (bay) + 34×5 (WTG)."""
        devices = build_substation_configuration()
        expected = 6 + 1 + 2 + 34 * 5  # = 179
        assert get_total_logical_node_count(devices) == expected

    def test_ip_address_uniqueness(self):
        """All devices must have unique IP addresses."""
        devices = build_substation_configuration()
        ips = [d.ip_address for d in devices]
        assert len(ips) == len(set(ips))

    def test_find_logical_node_existing(self):
        """find_logical_node must locate XCBR1 in the protection IED."""
        devices = build_substation_configuration()
        ln = find_logical_node(devices, "XCBR", 1)
        assert ln is not None
        assert ln.name == "XCBR1"

    def test_find_logical_node_wtur(self):
        """find_logical_node must locate WTUR1 in a WTG controller."""
        devices = build_substation_configuration()
        ln = find_logical_node(devices, "WTUR", 1)
        assert ln is not None
        assert ln.name == "WTUR1"

    def test_find_logical_node_missing(self):
        """find_logical_node must return None for non-existent LN."""
        devices = build_substation_configuration()
        ln = find_logical_node(devices, "NONEXISTENT", 1)
        assert ln is None

    def test_get_device_by_name(self):
        """get_device_by_name must locate OSS_PROT_IED01."""
        devices = build_substation_configuration()
        device = get_device_by_name(devices, "OSS_PROT_IED01")
        assert device is not None
        assert device.manufacturer == "ABB"

    def test_get_device_by_name_wtg(self):
        """get_device_by_name must locate WTG_17."""
        devices = build_substation_configuration()
        device = get_device_by_name(devices, "WTG_17")
        assert device is not None
        assert device.manufacturer == "Vestas"

    def test_get_device_by_name_missing(self):
        """get_device_by_name must return None for non-existent device."""
        devices = build_substation_configuration()
        assert get_device_by_name(devices, "MISSING") is None


# ── GOOSE Control Block Tests ──────────────────────────────────


class TestGOOSEControlBlocks:
    """Tests for GOOSE Control Block definitions."""

    def test_goose_trip_dataset_members(self):
        """Trip dataset must reference XCBR1, PTOC1, PDIS1, PTOV1."""
        ds = build_oss_goose_trip_dataset()
        ln_names = {m.logical_node_name for m in ds.members}
        expected = {"XCBR1", "PTOC1", "PDIS1", "PTOV1"}
        assert expected == ln_names

    def test_goose_trip_dataset_fc(self):
        """All trip dataset members must use ST functional constraint."""
        ds = build_oss_goose_trip_dataset()
        for member in ds.members:
            assert member.fc == FunctionalConstraint.ST

    def test_goose_control_block_app_id(self):
        """GoCB must have a hex Application ID."""
        gcb = build_oss_goose_control_block()
        assert gcb.app_id.startswith("0x")

    def test_goose_mac_address_format(self):
        """GOOSE MAC must be a multicast address starting with 01:0C:CD."""
        gcb = build_oss_goose_control_block()
        assert gcb.mac_address.startswith("01:0C:CD")

    def test_goose_timing_constraints(self):
        """min_time_ms must be <= 4 ms for protection-grade latency."""
        gcb = build_oss_goose_control_block()
        assert gcb.min_time_ms <= 4

    def test_goose_vlan_id(self):
        """GOOSE VLAN must be in the 100-199 range."""
        gcb = build_oss_goose_control_block()
        assert 100 <= gcb.vlan_id <= 199

    def test_dataset_member_reference_format(self):
        """Dataset member reference must follow LD/LN$DO format."""
        ds = build_oss_goose_trip_dataset()
        for member in ds.members:
            ref = member.reference
            assert "/" in ref, f"Missing '/' in reference: {ref}"
            assert "$" in ref, f"Missing '$' in reference: {ref}"


# ── Enum Tests ─────────────────────────────────────────────────


class TestEnums:
    """Tests for IEC 61850 enumeration types."""

    def test_switch_positions_complete(self):
        """All four Dbpos states must be defined."""
        positions = list(SwitchPosition)
        assert len(positions) == 4
        assert SwitchPosition.INTERMEDIATE in positions
        assert SwitchPosition.OFF in positions
        assert SwitchPosition.ON in positions
        assert SwitchPosition.BAD_STATE in positions

    def test_turbine_operating_states(self):
        """All expected turbine operating states must exist."""
        states = list(TurbineOperatingState)
        assert len(states) == 6
        assert TurbineOperatingState.RUNNING in states
        assert TurbineOperatingState.ERROR in states

    def test_data_attribute_types(self):
        """Common IEC 61850 data types must be available."""
        assert DataAttributeType.BOOLEAN == "BOOLEAN"
        assert DataAttributeType.FLOAT32 == "FLOAT32"
        assert DataAttributeType.TIMESTAMP == "Timestamp"

    def test_logical_node_categories(self):
        """All standard LN categories must be defined."""
        cats = list(LogicalNodeCategory)
        assert len(cats) == 6
        assert LogicalNodeCategory.PROTECTION == "P"
        assert LogicalNodeCategory.WIND == "W"

    def test_equipment_types(self):
        """All required equipment types must be defined."""
        types = list(EquipmentType)
        assert EquipmentType.PROTECTION_IED in types
        assert EquipmentType.WTG_CONTROLLER in types


# ── Immutability Tests ─────────────────────────────────────────


class TestImmutability:
    """Tests that frozen dataclasses enforce immutability."""

    def test_physical_device_is_frozen(self):
        """PhysicalDevice must be immutable (frozen=True)."""
        ied = build_oss_protection_ied()
        with pytest.raises(AttributeError):
            ied.name = "modified"  # type: ignore[misc]

    def test_logical_node_is_frozen(self):
        """LogicalNode must be immutable (frozen=True)."""
        ied = build_oss_protection_ied()
        ln = ied.logical_devices[0].logical_nodes[0]
        with pytest.raises(AttributeError):
            ln.class_name = "modified"  # type: ignore[misc]

    def test_goose_control_block_is_frozen(self):
        """GOOSEControlBlock must be immutable (frozen=True)."""
        gcb = build_oss_goose_control_block()
        with pytest.raises(AttributeError):
            gcb.min_time_ms = 999  # type: ignore[misc]
