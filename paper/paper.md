---
title: 'OffshoreForge: a lifecycle-coupled offshore wind engineering platform with built-in validation evidence'
tags:
  - Python
  - TypeScript
  - offshore wind
  - power systems
  - wind energy
  - engineering education
  - verification and validation
authors:
  - name: Mustafa Polat
    # orcid: add the author's ORCID iD here before submission
    affiliation: 1
affiliations:
  - name: Independent researcher (to be confirmed before submission)
    index: 1
date: 13 October 2026
bibliography: paper.bib
---

# Summary

OffshoreForge is an open-source platform that follows one offshore wind farm through its
whole life: site screening, wind resource and energy yield, grid connection, substation
automation, commissioning, operation, forecasting, condition monitoring, maintenance and
decommissioning. Every stage works on the same farm. The reference case, SB-510, is a
510 MW farm of 34 IEA 15 MW reference turbines [@gaertner2020] in the Polish Baltic, with
a 66 kV array and two 108 km 220 kV export circuits. A user can also define their own
project. The backend is written in Python (FastAPI) and builds on established open tools:
PyWake for wakes, pandapower [@thurner2018] for load flow and IEC 60909 short circuit,
ANDES [@cui2021] for RMS dynamics and ROSCO [@abbas2022] for turbine control. The browser
frontend (React, TypeScript) presents each stage as an interactive engineering page.

The design choice that sets the platform apart is that its claims are checked. Each model
is tested against something the project did not write: measured data, a closed-form
solution, a standard's worked example, or another organisation's code. These checks run
as tests and write their results to an in-app *Evidence* page. A later test run fails if a
recorded value drifts.

# Statement of need

Offshore wind engineering is split across disciplines. Each has mature specialist tools,
commercial and open: PyWake, FLORIS and WindPRO for wakes and energy yield; PowerFactory,
PSS/E, pandapower and OpenDSS for power systems; OpenFAST and HAWC2 for loads; WOMBAT for
operations and maintenance. Decisions made in one discipline set the boundary conditions of
the next. The export cable's thermal rating limits the reactor choice, which changes the
electrical losses in the energy-yield cascade. The weather windows of the installation
hindcast set the availability of the maintenance model. These couplings are hard to see,
and hard to teach, when each discipline lives in its own tool with its own example farm.

OffshoreForge targets engineers in training and early-career engineers. It also targets
researchers who need a transparent, end-to-end reference case. It links the disciplines on
one consistent farm and states, for every number, where it comes from and how it was
checked. Every module has a model card (purpose, assumptions, validity range, verification,
validation, known limits) in the terms of ASME V&V 10 and 20. Every method is mapped to its
primary source in a references page.

# Verification and validation

Selected checks, each recorded on the Evidence page:

- **Energy yield:** an ERA5-driven [@hersbach2020] chain of power curve, wakes and losses
  reproduces the metered output of the Rødsand II farm with an annual bias of +1.1 % and
  monthly R² = 0.96. Wake models agree with measured row power ratios at Horns Rev 1 and
  Lillgrund. TurbOPark [@nygaard2022] matches Ørsted's reference code, and the farm wake
  loss agrees with NREL FLORIS within 0.5 percentage points.
- **Power system:** pandapower results are re-solved in EPRI OpenDSS (within 8 × 10⁻⁵ pu on
  every bus) and checked against IEC 60909 hand calculations. The IEC 60287 cable rating
  engine reproduces CIGRE TB 880 case 0-1 (821.8 A).
- **Converter–grid stability:** a generalized Nyquist criterion on the converter Norton
  model [@harnefors2016] counts the right-half-plane poles correctly in 9 of 9 test cases.
- **Transients:** an EMT model of energising the export cable with Dommel's companion
  models [@dommel1969] matches the Ferranti rise and the analytic ringing frequency.
  Transformer inrush matches Specht's closed form, and switching overvoltages feed an
  IEC 60071-2 insulation co-ordination.
- **Turbine and structure:** the controller matches the official IEA 15 MW steady-state
  table and NREL's compiled ROSCO. The tower-and-jacket first natural frequency is within
  1.2 % of an OpenFAST model of the same structure.
- **Operations:** the fleet maintenance replay, driven by published failure rates
  [@carroll2016] on a 30-year hindcast, is cross-checked against NREL WOMBAT. Forecasts on
  16 731 measured hours beat the transmission system operator's day-ahead forecast
  (nRMSE 15.4 % vs 16.9 % of capacity).

An independent engineering audit (in the repository) lists retracted claims and open
findings, and the scripts that reproduce each number.

# Acknowledgements

The platform relies on open data from ENTSO-E, Energinet, PSE, Copernicus (ERA5,
CMEMS) and the IEA Wind Task 37 reference turbine, and on the open-source projects cited
above.

# References
