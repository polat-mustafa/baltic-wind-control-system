"""P3 sub-router: SCL file generation endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException

from app.routers.farm_spec import FarmSpecDep
from app.schemas.scada import (
    SCLFileResponse,
    SCLFileType,
    SCLGenerateRequest,
)
from app.services.p2.network_model import SB510
from app.services.p3.iec61850_model import (
    Dataset,
    GOOSEControlBlock,
    build_oss_goose_control_block,
    build_oss_goose_trip_dataset,
    build_substation_configuration,
    get_device_by_name,
)
from app.services.p3.scl_generator import (
    generate_icd,
    generate_scd,
    generate_ssd,
    scl_to_string,
    validate_scl_structure,
)

router = APIRouter()


@router.post("/scl-generate", response_model=SCLFileResponse, status_code=201)
async def generate_scl_file(request: SCLGenerateRequest, spec: FarmSpecDep) -> SCLFileResponse:
    """Generate an IEC 61850-6 SCL configuration file.

    Supported file types:
    - SSD: Substation Specification Description (voltage levels + bays)
    - ICD: IED Capability Description (single IED logical nodes)
    - SCD: Substation Configuration Description (all IEDs combined)
    """
    devices = build_substation_configuration(spec.num_turbines)
    substation = "SB510_OSS" if spec == SB510 else "PRJ_OSS"

    if request.file_type == SCLFileType.SSD:
        root = generate_ssd(substation, spec=spec)
    elif request.file_type == SCLFileType.ICD:
        if request.device_name is None:
            raise HTTPException(
                status_code=422,
                detail="device_name is required for ICD file generation.",
            )
        device = get_device_by_name(devices, request.device_name)
        if device is None:
            valid = [d.name for d in devices[:5]]
            raise HTTPException(
                status_code=404,
                detail=f"Device '{request.device_name}' not found. Examples: {valid}",
            )
        ds, gcbs = _goose(device.name)
        root = generate_icd(device, goose_control_blocks=gcbs or None, datasets=ds or None)
    elif request.file_type == SCLFileType.SCD:
        prot = devices[0].name
        ds, gcbs = _goose(prot)
        root = generate_scd(
            substation, devices, goose_control_blocks={prot: gcbs}, datasets={prot: ds}, spec=spec
        )
    else:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid file_type: '{request.file_type}'.",
        )

    # Validate SCL structure
    errors = validate_scl_structure(root)
    if errors:
        raise HTTPException(
            status_code=500,
            detail=f"SCL validation errors: {errors}",
        )

    xml_content = scl_to_string(root)
    name = f"Baltic_Wind_Alpha_{request.file_type.value}"
    if request.device_name:
        name += f"_{request.device_name}"

    return SCLFileResponse(
        id=uuid.uuid4(),
        file_type=request.file_type.value,
        name=name,
        xml_content=xml_content,
        device_name=request.device_name,
        created_at=datetime.now(UTC),
    )


def _goose(ied_name: str) -> tuple[list[Dataset], list[GOOSEControlBlock]]:
    """The OSS protection IED publishes the busbar trip GOOSE (dataset + control block)."""
    if ied_name != "OSS_PROT_IED01":
        return [], []
    return [build_oss_goose_trip_dataset(ied_name)], [build_oss_goose_control_block(ied_name)]
