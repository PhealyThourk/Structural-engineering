# 1. Introduction

## Scope

This book explains how to check a steel **member**, a beam or a column, for the most common
failure modes:

- the strength of the cross-section,
- buckling of a member in compression,
- lateral torsional buckling of a beam,
- the combined effect of bending and compression.

## Notation

| Symbol | Meaning | Unit |
|---|---|---|
| $A$ | cross-sectional area | cm² |
| $f_y$ | yield strength | N/mm² |
| $E$ | modulus of elasticity, 210 000 | N/mm² |
| $i$ | radius of gyration | mm |
| $L_{cr}$ | buckling length | m |
| $N_{Ed}$ | design axial force (compression positive) | kN |
| $N_{b,Rd}$ | design buckling resistance | kN |
| $\gamma_{M1}$ | partial factor for stability | - |

## Units

Forces are in kN, moments in kNm, lengths in mm or m (stated in each equation) and stresses in
N/mm². The examples show the unit of every result.

!!! note "Sign convention"
    Compression is positive. A negative axial force is tension.

## How the examples are calculated

All numbers in the examples were calculated with a short Python program, shown at the end of each
chapter. You can copy the code and change the inputs.
