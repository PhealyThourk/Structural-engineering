# -*- coding: utf-8 -*-
"""
Creates the figures used in the sample articles. Run it from the project folder:

    pip install matplotlib numpy
    python scripts/make_figures.py

The PNG files are saved in docs/assets/images/. Edit the numbers below and run it again
to make your own figures; then use them in a page with
    ![caption](../assets/images/name.png)
"""
import os
import sys

import numpy as np
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.figure import Figure

sys.path.insert(0, os.path.dirname(__file__))
from Section_figure import plot_section          # cross-section with dimensions

OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "assets", "images")
os.makedirs(OUT, exist_ok=True)

# ---- 1. cross-section of an IPE 330 (dimensions in mm) ----
plot_section(h=330, b=160, tw=7.5, tf=11.5, r1=18,
             filename=os.path.join(OUT, "ipe330-section.png"),
             title="IPE 330", dpi=200)


# ---- 2. flexural buckling curves a and b with two calculated points ----
def chi(lam, alpha):
    phi = 0.5 * (1 + alpha * (lam - 0.2) + lam**2)
    return np.minimum(1.0 / (phi + np.sqrt(phi**2 - lam**2)), 1.0)


lam = np.linspace(0, 3.0, 300)
fig = Figure(figsize=(7, 4.6))
FigureCanvasAgg(fig)
ax = fig.add_subplot(111)
ax.plot(lam, chi(lam, 0.21), color="#1F3A5F", label="Curve a (α = 0.21)")
ax.plot(lam, chi(lam, 0.34), color="#4A6FA5", label="Curve b (α = 0.34)")
points = [("y-axis", 0.466, 0.934, 0.21, "#2E7D6B"), ("z-axis", 0.900, 0.661, 0.34, "#D64545")]
for name, x, y, alpha, color in points:
    ax.scatter([x], [y], color=color, zorder=5, s=36)
    ax.annotate(f"{name}: λ̄ = {x:.2f}, χ = {y:.2f}", (x, y), textcoords="offset points",
                xytext=(12, 8), color=color, fontsize=9)
ax.set_xlabel(r"Relative slenderness $\bar{\lambda}$")
ax.set_ylabel(r"Reduction factor $\chi$")
ax.set_xlim(0, 3)
ax.set_ylim(0, 1.05)
ax.grid(True, linestyle="--", alpha=0.6)
ax.legend(loc="upper right")
fig.savefig(os.path.join(OUT, "buckling-curves.png"), dpi=200, bbox_inches="tight", facecolor="white")
print("Figures saved in", os.path.abspath(OUT))
