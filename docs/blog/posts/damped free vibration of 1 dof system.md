---
date: 2026-10-21
categories:
  - Structural dynamics
  - Damped free vibration of 1 dof system
---

# Damped free vibration of a 1-DOF system

A single-degree-of-freedom system in free vibration is one of the simplest models used to study structural dynamics. When the system is displaced from its equilibrium position by an amount $x_0$ and given an initial velocity $v_0$, it responds according to its natural properties of mass, stiffness, and damping. This motion, known as the free response, illustrates how the system oscillates without any external forces acting upon it.

<!-- more -->

## General solution to underdamped free vibration

$$
x(t) = e^{-\xi\omega_n t}\left[x_0\cos(\omega_d t) + \frac{v_0 + \xi\omega_n x_0}{\omega_d}\sin(\omega_d t)\right],
\qquad
\omega_d = \omega_n\sqrt{1-\xi^2}
$$

With damping rato $\xi = 0.03$, natural frequency $f_n = 2.5$ Hz, initial displacement $x_0 = 0.001 \; m$, initial velocity $v_0 = 0.001 \; m/s$, the amplitude falls by about 17 % in every cycle.

This solution can be put into polar form as

$$
x(t) = \rho_0 e^{-\xi\omega_n t}\cos(\omega_d t - \varphi)
$$

With

$$
x_0 = \rho_0 \cos(\varphi),
\qquad
v_0 = \omega_d \rho_0 \sin(\varphi) - \xi \omega_n x_0
$$

Where amplitude

$$
\rho_0 = \sqrt{x_0^2 + \left(\frac{v_0 + \xi\omega_n x_0}{\omega_d}\right)^2}
$$

and phase shift

$$
\varphi = \tan^{-1}\left(\frac{v_0 + \xi \omega_n x_0}{\omega_d x_0}\right)
$$

## The animation

The video shows an underdamped system with damping ratio $\xi = 0.03$ in three views: a rotating
3D spiral, the time response with its envelope, and the phase plane.

<!--  YOUTUBE ALTERNATIVE: delete the <video> block above and use this one instead. 
     Replace VIDEO_ID with the part after "v=" in the YouTube address.-->
<iframe
  src="https://www.youtube.com/embed/yU5CZapkWpY"
  title="Damped free vibration"
  width="100%"
  height="540"
  style="max-width: 100%;"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen>
</iframe>
          

## What you see

- **3D spiral:** displacement $x$, velocity $v/\omega_n$ and time $\omega_n t$. The spiral shrinks as
  the system loses energy.
- **Time response:** the oscillation stays inside the envelope $\pm\rho_0 e^{-\xi\omega_n t}$.
- **Phase plane:** the circles move toward the centre, the equilibrium.








