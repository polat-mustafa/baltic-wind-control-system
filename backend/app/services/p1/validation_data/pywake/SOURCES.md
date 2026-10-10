# Measured wake validation data (Horns Rev 1, Lillgrund)

Copied unchanged from PyWake v2.6.7, `py_wake/validation/data/` (DTU Wind Energy, TOPFARM),
via the GitHub mirror `DTUWindEnergy/PyWake` (Git LFS objects, SHA-256 checked against the LFS pointers).
Licence: MIT — see `LICENSE` in this folder (Copyright (c) 2018 TOPFARM).

- `*_WFdata_*` — measured SCADA power ratios (rows: P_i/P_1 with std and sample count; `WFeff`: farm
  efficiency vs wind direction). Horns Rev 1: 8 ± 0.5 m/s, 270 ± 2.5°, inner six rows averaged.
  Lillgrund: 9 ± 0.5 m/s, rows B/D/4/6 at 105/120/207/222°.
- `*_RANS_*`, `*_LES_*` — CFD reference results shipped with the same validation set.

Used by the wake-model validation (evidence programme B1, `docs/offshoreforge-roadmap.md`).
