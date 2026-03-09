"""P3 sub-router: IEC 61850 device registry endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.scada import (
    PhysicalDeviceSchema,
    SubstationSummaryResponse,
)
from app.services.p3.iec61850_model import (
    build_substation_configuration,
    get_device_by_name,
    get_total_logical_node_count,
)

router = APIRouter()


@router.get("/devices", response_model=SubstationSummaryResponse)
async def get_substation_summary() -> SubstationSummaryResponse:
    """Get the complete IEC 61850 substation configuration summary.

    Returns all 37 IEDs (3 OSS + 34 WTG) with their logical nodes,
    data objects, and GOOSE control blocks.
    """
    devices = build_substation_configuration()
    total_lns = get_total_logical_node_count(devices)

    device_schemas = []
    protection_count = 0
    measurement_count = 0
    bay_count = 0
    wtg_count = 0

    for d in devices:
        ld_schemas = []
        for ld in d.logical_devices:
            ln_schemas = []
            for ln in ld.logical_nodes:
                do_schemas = []
                for do in ln.data_objects:
                    da_schemas = [
                        {
                            "name": da.name,
                            "data_type": da.data_type,
                            "fc": da.fc,
                            "description": da.description,
                            "unit": da.unit,
                        }
                        for da in do.attributes
                    ]
                    do_schemas.append(
                        {
                            "name": do.name,
                            "cdc": do.cdc,
                            "attributes": da_schemas,
                            "description": do.description,
                        }
                    )
                ln_schemas.append(
                    {
                        "class_name": ln.class_name,
                        "instance": ln.instance,
                        "full_name": ln.name,
                        "category": ln.category.value,
                        "data_objects": do_schemas,
                        "description": ln.description,
                    }
                )
            ld_schemas.append(
                {
                    "inst": ld.inst,
                    "logical_nodes": ln_schemas,
                    "description": ld.description,
                }
            )

        device_schemas.append(
            PhysicalDeviceSchema(
                name=d.name,
                equipment_type=d.equipment_type.value,
                manufacturer=d.manufacturer,
                model=d.model,
                logical_devices=ld_schemas,
                ip_address=d.ip_address,
                description=d.description,
            )
        )

        if d.equipment_type.value == "protection_ied":
            protection_count += 1
        elif d.equipment_type.value == "measurement_ied":
            measurement_count += 1
        elif d.equipment_type.value == "bay_controller":
            bay_count += 1
        elif d.equipment_type.value == "wtg_controller":
            wtg_count += 1

    return SubstationSummaryResponse(
        total_devices=len(devices),
        total_logical_nodes=total_lns,
        protection_ieds=protection_count,
        measurement_ieds=measurement_count,
        bay_controllers=bay_count,
        wtg_controllers=wtg_count,
        goose_control_blocks=1,  # One GoCB on OSS protection IED
        devices=device_schemas,
    )


@router.get("/devices/{device_name}", response_model=PhysicalDeviceSchema)
async def get_device_detail(device_name: str) -> PhysicalDeviceSchema:
    """Get detailed IEC 61850 configuration for a specific device.

    Returns the full logical device → logical node → data object hierarchy.

    Parameters
    ----------
    device_name : str
        IED instance name (e.g., 'OSS_PROT_IED01', 'WTG_01').
    """
    devices = build_substation_configuration()
    device = get_device_by_name(devices, device_name)

    if device is None:
        valid_names = [d.name for d in devices[:5]]
        raise HTTPException(
            status_code=404,
            detail=(f"Device '{device_name}' not found. Examples: {valid_names}"),
        )

    ld_schemas = []
    for ld in device.logical_devices:
        ln_schemas = []
        for ln in ld.logical_nodes:
            do_schemas = []
            for do in ln.data_objects:
                da_schemas = [
                    {
                        "name": da.name,
                        "data_type": da.data_type,
                        "fc": da.fc,
                        "description": da.description,
                        "unit": da.unit,
                    }
                    for da in do.attributes
                ]
                do_schemas.append(
                    {
                        "name": do.name,
                        "cdc": do.cdc,
                        "attributes": da_schemas,
                        "description": do.description,
                    }
                )
            ln_schemas.append(
                {
                    "class_name": ln.class_name,
                    "instance": ln.instance,
                    "full_name": ln.name,
                    "category": ln.category.value,
                    "data_objects": do_schemas,
                    "description": ln.description,
                }
            )
        ld_schemas.append(
            {
                "inst": ld.inst,
                "logical_nodes": ln_schemas,
                "description": ld.description,
            }
        )

    return PhysicalDeviceSchema(
        name=device.name,
        equipment_type=device.equipment_type.value,
        manufacturer=device.manufacturer,
        model=device.model,
        logical_devices=ld_schemas,
        ip_address=device.ip_address,
        description=device.description,
    )
