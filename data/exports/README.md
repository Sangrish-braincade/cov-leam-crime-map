# Research export: Coventry, Leamington, Warwick & Kenilworth crime panel

police.uk street-level crime, 2023-08 to 2026-07, assigned to 2021 Lower Layer Super Output Areas (LSOAs).
Regenerate with `node scripts/export-panel.mjs`.

## Files

**`panel_lsoa_month_category_outcome.csv`**: long format, one row per non-empty cell (80,764 rows).

| column | meaning |
|---|---|
| `lsoa21cd` | 2021 LSOA code (join to census, IMD 2025, etc.) |
| `month` | `YYYY-MM`. police.uk gives the month only, never a day or time |
| `category` | police.uk street-level category slug (14 values) |
| `outcome` | police.uk's latest outcome for the crime, as published; `none (anti-social behaviour)` for ASB, which gets no outcome |
| `crimes` | number of crimes in the cell |

Cells with zero crimes are omitted: treat a missing combination as 0.

**`lsoa_lookup.csv`**: all 336 LSOAs that intersect the map's bounding box, with local authority, the 2021 rural-urban classification and total crimes. LSOAs at the edge of the box are only partly covered, so filter on `local_authority` (e.g. Coventry, Warwick) for complete areas.

## Coverage

- 159,487 crimes; 159,487 fall inside an LSOA in the lookup, 0 fall outside it (edge of the box).
- 5,578 distinct police.uk locations, each assigned to an LSOA by point-in-polygon on the full-resolution boundaries.

## Caveats for analysis

- **Locations are anonymised.** police.uk moves each crime to the nearest of a fixed set of points (street centres or venues such as "Supermarket"). A point near an LSOA boundary may represent crimes on either side; analysis at LSOA level or above is appropriate, and anything finer is not.
- **Outcomes are the latest published status** at the time of the last refresh. Recent months carry more "Under investigation"; they update as police.uk republishes.
- **Recorded crime only**, and recording practice varies by category (drugs and weapons offences rise where police search people).
- Coventry is West Midlands Police; Warwick district is Warwickshire Police. A small number of crimes are British Transport Police.

Sources: police.uk (Open Government Licence v3.0); LSOA boundaries and rural-urban classification: Office for National Statistics (OGL v3.0).
