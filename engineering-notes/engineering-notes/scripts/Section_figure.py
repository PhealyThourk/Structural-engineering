# -*- coding: utf-8 -*-
"""
Section_figure.py - draws an I- or H-section with its dimensions and saves it as a PNG.

    from Section_figure import plot_section
    plot_section(h=330, b=160, tw=7.5, tf=11.5, r1=18, filename="Cross-section.png",
                 title="IPE 330 · EN 10365:2017")

All dimensions in mm. The figure is drawn from the real dimensions (to scale):
overall height h, flange width b, web thickness t_w, flange thickness t_f,
root radius r_1, and the axes y-y (strong axis) and z-z (weak axis).

The figure is made with matplotlib's object interface (no pyplot), so it is safe to use
on a web server and never opens a window.

Copyright (c) Phealy Thourk. All rights reserved.
"""

import numpy as np
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.figure import Figure
from matplotlib.patches import Polygon

NAVY = "#1F3A5F"
FILL = "#DCE6F5"
DIM = "#3A4A60"
AXIS = "#D64545"


def _outline(h, b, tw, tf, r):
    """Corner points of the section (origin = centroid, y horizontal, z vertical)."""
    H, B, a = h / 2.0, b / 2.0, tw / 2.0

    def arc(cx, cz, t0, t1, n=24):
        t = np.radians(np.linspace(t0, t1, n))
        return list(zip(cx + r * np.cos(t), cz + r * np.sin(t)))

    pts = [(-B, H), (B, H), (B, H - tf), (a + r, H - tf)]
    pts += arc(a + r, H - tf - r, 90, 180)             # top right fillet
    pts += arc(a + r, -H + tf + r, 180, 270)           # bottom right fillet (web runs between)
    pts += [(B, -H + tf), (B, -H), (-B, -H), (-B, -H + tf), (-a - r, -H + tf)]
    pts += arc(-a - r, -H + tf + r, 270, 360)          # bottom left fillet
    pts += arc(-a - r, H - tf - r, 0, 90)              # top left fillet (web runs between)
    pts += [(-B, H - tf)]
    return pts


def plot_section(h, b, tw, tf, r1, filename="Cross-section.png", title=None, dpi=300):
    """Draw the section with dimensions and save it to `filename` (PNG). Returns the filename."""
    h, b, tw, tf, r1 = (float(v) for v in (h, b, tw, tf, r1))
    H, B, a = h / 2.0, b / 2.0, tw / 2.0
    r = max(0.0, min(r1, (B - a) - 1e-6, (H - tf) - 1e-6))   # keep the drawing valid
    s = max(h, b)                                             # scale for the dimension offsets

    fig = Figure(figsize=(6.4, 6.0))
    FigureCanvasAgg(fig)
    ax = fig.add_subplot(111)
    ax.set_aspect("equal")
    ax.axis("off")

    # ---- section ----
    ax.add_patch(Polygon(_outline(h, b, tw, tf, r), closed=True, facecolor=FILL,
                         edgecolor=NAVY, linewidth=1.8, joinstyle="round", zorder=3))

    # ---- axes y-y and z-z ----
    axis_style = dict(color=AXIS, linewidth=0.9, linestyle=(0, (9, 3, 1.5, 3)), zorder=4)
    ax.plot([-B - 0.07 * s, B + 0.07 * s], [0, 0], **axis_style)
    ax.plot([0, 0], [-H - 0.07 * s, H + 0.07 * s], **axis_style)
    ax.text(B + 0.09 * s, 0, "y", color=AXIS, fontsize=11, style="italic", va="center", ha="left")
    ax.text(0, H + 0.09 * s, "z", color=AXIS, fontsize=11, style="italic", va="bottom", ha="center")

    thin = dict(color=DIM, linewidth=0.7, zorder=2)
    arrow2 = dict(arrowstyle="<|-|>", color=DIM, linewidth=0.9, shrinkA=0, shrinkB=0,
                  mutation_scale=9)
    arrow1 = dict(arrowstyle="-|>", color=DIM, linewidth=0.9, shrinkA=0, shrinkB=0,
                  mutation_scale=9)
    fs = 10.5

    # ---- overall height h (left) ----
    x = -B - 0.12 * s
    for z in (H, -H):
        ax.plot([-B - 0.015 * s, x - 0.02 * s], [z, z], **thin)
    ax.annotate("", xy=(x, H), xytext=(x, -H), arrowprops=arrow2)
    ax.text(x - 0.02 * s, 0, f"$h$ = {h:g} mm", rotation=90, ha="right", va="center", fontsize=fs, color=INK if False else DIM)

    # ---- flange width b (bottom) ----
    z = -H - 0.12 * s
    for xx in (B, -B):
        ax.plot([xx, xx], [-H - 0.015 * s, z - 0.02 * s], **thin)
    ax.annotate("", xy=(B, z), xytext=(-B, z), arrowprops=arrow2)
    ax.text(0, z - 0.025 * s, f"$b$ = {b:g} mm", ha="center", va="top", fontsize=fs, color=DIM)

    # ---- flange thickness t_f (right, top flange) ----
    x = B + 0.10 * s
    L = 0.07 * s
    for zz in (H, H - tf):
        ax.plot([B + 0.015 * s, x + 0.02 * s], [zz, zz], **thin)
    ax.annotate("", xy=(x, H), xytext=(x, H + L), arrowprops=arrow1)
    ax.annotate("", xy=(x, H - tf), xytext=(x, H - tf - L), arrowprops=arrow1)
    ax.text(x + 0.03 * s, H - tf / 2.0 - 0.0 * s, f"$t_f$ = {tf:g} mm", ha="left", va="center",
            fontsize=fs, color=DIM)

    # ---- web thickness t_w (arrows from outside, at 30 % of the half height) ----
    zw = 0.30 * H
    L = 0.09 * s
    ax.annotate("", xy=(-a, zw), xytext=(-a - L, zw), arrowprops=arrow1)
    ax.annotate("", xy=(a, zw), xytext=(a + L, zw), arrowprops=arrow1)
    ax.text(a + L + 0.015 * s, zw, f"$t_w$ = {tw:g} mm", ha="left", va="center", fontsize=fs, color=DIM)

    # ---- root radius r_1 (leader to the middle of the top right fillet) ----
    if r > 0:
        px, pz = a + r * (1 - np.cos(np.pi / 4)), H - tf - r * (1 - np.sin(np.pi / 4))
        tx, tz = a + 0.55 * (B - a), H - tf - 0.30 * H
        ax.annotate("", xy=(px, pz), xytext=(tx, tz + 0.02 * s), arrowprops=arrow1)
        ax.text(tx, tz, f"$r_1$ = {r1:g} mm", ha="left", va="top", fontsize=fs, color=DIM)

    # ---- limits and title ----
    ax.set_xlim(-B - 0.2 * s, B + 0.3 * s)
    ax.set_ylim(-H - 0.2 * s, H + 0.14 * s)
    if title:
        ax.set_title(title, loc="left", fontsize=11.5, fontweight="bold", color=NAVY, pad=6)

    fig.savefig(filename, dpi=dpi, bbox_inches="tight", facecolor="white")
    return filename


if __name__ == "__main__":
    # quick demo: IPE 330
    plot_section(330, 160, 7.5, 11.5, 18, "Cross-section.png", title="IPE 330 · EN 10365:2017")
    print("Saved Cross-section.png")
