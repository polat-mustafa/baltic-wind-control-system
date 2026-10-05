"""Factory acceptance tests (services/p5/fat.py) — IEC 60076-1 Table 1 tolerances."""

import pytest

from app.core.exceptions import ValidationError
from app.services.p5.fat import (
    FAT_TEMPLATES,
    PASS_FAIL,
    EquipmentClass,
    FATCampaignStateError,
    FATTestNotFoundError,
    TestCampaignStatus,
    TestVerdict,
    all_passed,
    approve_campaign,
    create_fat_campaign,
    record_result,
)
from tests.p5_support import fill_typical


def spec(cls, test_id):
    return next(s for s in FAT_TEMPLATES[cls] if s.test_id == test_id)


def test_transformer_tolerances_follow_iec_60076_1():
    tx = EquipmentClass.POWER_TRANSFORMER
    ratio = spec(tx, "FAT-T01")
    assert (ratio.min_value, ratio.max_value) == (-0.5, 0.5)  # lower of 0.5 % and vk/10 = 1.25 %
    z = spec(tx, "FAT-T02")
    assert z.min_value == pytest.approx(12.5 * 0.925) and z.max_value == pytest.approx(12.5 * 1.075)
    assert spec(tx, "FAT-T03").max_value == pytest.approx(750 * 1.15)  # load loss, +15 %
    assert spec(tx, "FAT-T04").max_value == pytest.approx(60 * 1.15)  # no-load loss, +15 %
    assert spec(tx, "FAT-T05").max_value == pytest.approx(0.05 * 1.3)  # no-load current, +30 %
    assert spec(tx, "FAT-T06").max_value == 250.0  # IVPD, IEC 60076-3:2013


def test_gis_and_protection_limits():
    assert spec(EquipmentClass.GIS_220KV, "FAT-G03").max_value == 120.0  # 1.2 Ru
    assert spec(EquipmentClass.PROTECTION_PANEL, "FAT-P03").max_value == 3.0  # TT6


@pytest.mark.parametrize("cls", list(EquipmentClass))
def test_typical_values_pass_and_campaign_approves(cls):
    fat = create_fat_campaign("TAG", cls)
    fill_typical(fat)
    assert fat.status == TestCampaignStatus.COMPLETED and all_passed(fat)
    approve_campaign(fat, "Owner's engineer")
    assert fat.status == TestCampaignStatus.APPROVED
    with pytest.raises(FATCampaignStateError):
        record_result(fat, next(iter(fat.specs)), 0.0, "x")


def test_failed_test_blocks_approval_until_retest():
    fat = create_fat_campaign("TX-OSS-01", EquipmentClass.POWER_TRANSFORMER)
    fill_typical(fat)
    assert record_result(fat, "FAT-T06", 310.0, "HV lab").verdict == TestVerdict.FAIL
    with pytest.raises(FATCampaignStateError):
        approve_campaign(fat, "Owner's engineer")
    assert (
        record_result(fat, "FAT-T06", 120.0, "HV lab", "after re-processing").verdict
        == TestVerdict.PASS
    )
    approve_campaign(fat, "Owner's engineer")


def test_pass_fail_tests_accept_only_0_or_1():
    fat = create_fat_campaign("TX-OSS-01", EquipmentClass.POWER_TRANSFORMER)
    assert spec(EquipmentClass.POWER_TRANSFORMER, "FAT-T07").unit == PASS_FAIL
    with pytest.raises(ValidationError):
        record_result(fat, "FAT-T07", 0.5, "HV lab")
    assert record_result(fat, "FAT-T07", 0.0, "HV lab").verdict == TestVerdict.FAIL
    with pytest.raises(FATTestNotFoundError):
        record_result(fat, "FAT-G01", 1.0, "HV lab")
