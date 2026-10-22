# 2. Cross-section classification

## The idea

A thin plate in compression can buckle locally **before** the steel yields. The more slender the
plate, the earlier this happens. Design standards therefore sort cross-sections into four
**classes**, according to how they behave in bending and compression.

| Class | Behaviour | Consequence for the design |
|---|---|---|
| 1 | Reaches the plastic moment and can rotate a lot | Plastic global analysis is allowed |
| 2 | Reaches the plastic moment, rotation is limited | Plastic moment resistance can be used |
| 3 | Yields at the extreme fibre, local buckling stops it there | Elastic resistance (or an elasto-plastic method) is used |
| 4 | Local buckling happens before yield | Effective cross-section is needed |

## Slenderness of a plate

The slenderness of a plate part is the ratio of its width $c$ to its thickness $t$. It is compared
with limits that depend on the yield strength through the factor

$$
\varepsilon = \sqrt{\frac{235}{f_y}}
$$

with $f_y$ in N/mm². A higher steel grade gives a smaller $\varepsilon$, so the limits become
stricter.

| Steel grade | $f_y$ [N/mm²] | $\varepsilon$ |
|---|---|---|
| S235 | 235 | 1.000 |
| S275 | 275 | 0.924 |
| S355 | 355 | 0.814 |
| S420 | 420 | 0.748 |
| S460 | 460 | 0.715 |

!!! tip "Where are the limits?"
    The limits of $c/t$ for each class are given in the tables of the design standard. They
    depend on the loading (bending, compression or both) and are not repeated here. Read them from
    the edition of the standard you use.

## Worked example: IPE 330

The dimensions of the IPE 330 are $h = 330$ mm, $b = 160$ mm, $t_w = 7.5$ mm, $t_f = 11.5$ mm and
$r = 18$ mm.

**Web** (internal part, between the fillets):

$$
c_w = h - 2\,t_f - 2\,r = 330 - 2(11.5) - 2(18) = 271\ \text{mm}
\qquad
\frac{c_w}{t_w} = \frac{271}{7.5} = 36.1
$$

**Flange** (outstand):

$$
c_f = \frac{b - t_w - 2\,r}{2} = \frac{160 - 7.5 - 2(18)}{2} = 58.25\ \text{mm}
\qquad
\frac{c_f}{t_f} = \frac{58.25}{11.5} = 5.07
$$

The web is the slender part of this section: its $c/t$ is much larger than that of the flange, so
the web decides the class under compression.

!!! note "Next step"
    Compare $c_w/t_w$ and $c_f/t_f$ with the limits of the standard for your load case. The
    chapter [Flexural buckling](03-buckling.md) continues with a section that is not limited by
    local buckling.
