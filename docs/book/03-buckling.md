# 3. Flexural buckling

## The idea

A slender column loaded in compression can bend sideways and fail **below** its squash load
$N_{pl}$. The ratio between the buckling resistance and the squash load is the **reduction
factor** $\chi$. It depends only on the relative slenderness $\bar{\lambda}$ and on the
imperfections of the member.

## Equations

Squash load and relative slenderness:

$$
N_{pl} = A\,f_y
\qquad
\bar{\lambda} = \frac{L_{cr}/i}{\lambda_1}
\qquad
\lambda_1 = \pi\sqrt{\frac{E}{f_y}}
$$

Reduction factor:

$$
\Phi = 0.5\left[1 + \alpha\,(\bar{\lambda} - 0.2) + \bar{\lambda}^{2}\right]
\qquad
\chi = \frac{1}{\Phi + \sqrt{\Phi^{2} - \bar{\lambda}^{2}}} \le 1.0
$$

Design buckling resistance:

$$
N_{b,Rd} = \frac{\chi\,A\,f_y}{\gamma_{M1}}
$$

The imperfection factor $\alpha$ depends on the **buckling curve**:

| Curve | a0 | a | b | c | d |
|---|---|---|---|---|---|
| $\alpha$ | 0.13 | 0.21 | 0.34 | 0.49 | 0.76 |

The curve to use for a rolled I-section depends on the ratio $h/b$, the flange thickness and the
axis. The selection table is in the design standard.

## Worked example: IPE 330, S235

Data: $A = 62.6$ cm², $i_y = 137$ mm, $i_z = 35.5$ mm, $f_y = 235$ N/mm², $\gamma_{M1} = 1.0$.
The buckling length is 6 m about the y-axis and 3 m about the z-axis (an intermediate support
about the weak axis). Here $h/b = 2.06$ and $t_f = 11.5$ mm, so curve **a** is used about the
y-axis and curve **b** about the z-axis.

First, the values that do not depend on the axis:

$$
N_{pl} = 6260 \times 235 / 1000 = 1471.1\ \text{kN}
\qquad
\lambda_1 = \pi\sqrt{\frac{210\,000}{235}} = 93.91
$$

| Quantity | y-axis | z-axis |
|---|---|---|
| $L_{cr}$ [mm] | 6000 | 3000 |
| $L_{cr}/i$ | 43.80 | 84.51 |
| $\bar{\lambda}$ | 0.466 | 0.900 |
| Curve, $\alpha$ | a, 0.21 | b, 0.34 |
| $\Phi$ | 0.637 | 1.024 |
| $\chi$ | 0.934 | 0.661 |
| $N_{b,Rd}$ [kN] | 1374.6 | 972.8 |

The **weak axis governs**: $N_{b,Rd} = 972.8$ kN. For a design force of $N_{Ed} = 500$ kN the
utilization is $500 / 972.8 = 0.51$.

=== "Python"

    ```python
    import numpy as np

    def flexural_buckling(A_cm2, i_mm, Lcr_mm, alpha, fy=235.0, E=210000.0, gamma_M1=1.0):
        lam1 = np.pi * np.sqrt(E / fy)
        lam = (Lcr_mm / i_mm) / lam1                      # relative slenderness
        phi = 0.5 * (1 + alpha * (lam - 0.2) + lam**2)
        chi = min(1.0, 1.0 / (phi + np.sqrt(phi**2 - lam**2)))
        Nb_Rd = chi * A_cm2 * 100 * fy / gamma_M1 / 1000   # kN
        return lam, chi, Nb_Rd

    print(flexural_buckling(62.6, 137.0, 6000, alpha=0.21))   # y-axis
    print(flexural_buckling(62.6, 35.5, 3000, alpha=0.34))    # z-axis
    ```

=== "Result"

    ```text
    (0.466, 0.934, 1374.6)    y-axis
    (0.900, 0.661,  972.8)    z-axis
    ```

The same example, with the figure of the buckling curves, is in the article
[Flexural buckling of an IPE 330 column](../blog/posts/flexural-buckling-ipe330.md).
