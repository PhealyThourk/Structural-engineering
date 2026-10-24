README - Forced Harmonic Response Plotter
========================================

1. Files
--------

Program:
  docs/assets/tools/forced-response-tool.html

Website launch button:
  docs/tools.md

This README explains the standalone HTML program. The HTML file contains its page
structure, CSS styling, and JavaScript calculation. It does not load a separate
JavaScript file or depend on a Python program or charting library.


2. Finding the calculation code
-------------------------------

Open forced-response-tool.html in a code editor and search for:

  function calculateResponse(input)

This is the main calculation function. It starts at line 264. Its formulas are
written on separate, indented lines and grouped by purpose.

The related functions are listed below. Line numbers refer to the current
forced-response-tool.html file.

  Line      Function                    Purpose
  ----      --------                    -------
  212       createSvgElement()           Makes SVG chart elements.
  227       readInputs()                 Reads the values entered by the user.
  241       validateInputs()             Checks that the values are valid.
  264       calculateResponse()          Calculates frequencies and responses.
  357       drawChart()                  Draws axes, grid, labels, and curves.
  454       showResults()                Displays derived values below the chart.
  475       enableHoverReadout()         Shows values under the mouse pointer.
  509       updatePlot()                 Runs validation, calculation, and redraw.
  550       resetInputs()                Restores the example input values.

The event setup at lines 558-562 connects the buttons and input fields to these
functions. The page calls updatePlot() once at startup to draw the example.


3. Inputs and units
-------------------

  Input ID     Meaning                         Unit
  --------     -------                         ----
  m            Mass                            kg
  k            Stiffness                       N/m
  xi           Damping ratio                   dimensionless
  p0           Force amplitude                 N
  freq         Forcing frequency               Hz
  u0           Initial displacement            m
  v0           Initial velocity                m/s
  dur          Plot duration                   s

Input reading is handled by readInputs(). Range and finite-number checks are
handled by validateInputs(). The damping ratio must be at least zero and less
than one, which is the underdamped case used by this calculation.


4. Calculation steps in calculateResponse()
-------------------------------------------

A. System and forcing frequencies
   Lines 276-279 calculate:

     Natural circular frequency:
       omegaN = sqrt(stiffness / mass)

     Damped circular frequency:
       omegaD = omegaN * sqrt(1 - dampingRatio^2)

     Forcing circular frequency:
       forcingOmega = 2 * pi * forcingFrequencyHz

     Frequency ratio:
       frequencyRatio = forcingOmega / omegaN

B. Dynamic denominator and phase
   Lines 281-288 calculate:

     dynamicDenominator =
       (1 - frequencyRatio^2)^2
       + (2 * dampingRatio * frequencyRatio)^2

     phase = atan2(
       2 * dampingRatio * frequencyRatio,
       1 - frequencyRatio^2
     )

   atan2 is used so the phase is placed in the correct quadrant.

C. Transient-response coefficients
   Lines 298-308 calculate B1 and B2 from the initial conditions and the
   harmonic-load response procedure:

     B1 =
       initialDisplacement
       + (2 * dampingRatio * frequencyRatio / dynamicDenominator)
         * (forceAmplitude / stiffness)

     B2 =
       (initialVelocity + dampingRatio * omegaN * B1) / omegaD
       - ((1 - frequencyRatio^2) * forcingOmega
          / (omegaD * dynamicDenominator))
         * (forceAmplitude / stiffness)

   When damping is zero, B1 is set to the initial displacement directly.
   The function checks for undamped resonance first and displays an error
   instead of attempting an unbounded response.

D. Response history
   Lines 310-343 sample the duration at 1,201 evenly spaced time points. At
   each time, the function calculates:

     Transient displacement:
       transient =
         exp(-dampingRatio * omegaN * time)
         * (B1 * cos(omegaD * time) + B2 * sin(omegaD * time))

     Steady-state displacement:
       steadyState =
         forceAmplitude / (stiffness * sqrt(dynamicDenominator))
         * sin(forcingOmega * time - phase)

     Total displacement:
       total = transient + steadyState

   The JavaScript multiplies each displacement by 1,000 at calculation time
   because the chart and hover readout display millimetres. The input
   displacement and velocity remain in metres and metres per second.

E. Derived values
   calculateResponse() returns the response samples plus natural frequency,
   damped frequency, frequency ratio, and steady-state amplitude. showResults()
   formats these values into result cards.


5. Plotting and hover display
-----------------------------

drawChart() uses SVG, which is built into modern browsers. It draws the grid,
axis tick labels, axis titles, and three sampled response curves:

  Total response       black solid line
  Transient response   blue dashed line
  Steady-state part    orange dotted line

The vertical chart scale is chosen from the largest sampled absolute value
among the total response and both components, with a margin so the lines fit.

enableHoverReadout() maps the pointer's horizontal position to the nearest
sampled time. It displays the time (x value), total displacement (y value),
transient displacement, and steady-state displacement. A vertical cursor and
a marker identify the corresponding point on the total-response curve.


6. Updating and resetting
-------------------------

updatePlot() is the central update sequence:

  1. Read the current inputs.
  2. Validate the inputs.
  3. Calculate the response history.
  4. Redraw the chart and hover marker.
  5. Refresh the derived result cards.

The Update plot button calls updatePlot(). Input edits also call updatePlot()
immediately. Reset example restores the default values and redraws the plot.


7. Model assumptions and limits
-------------------------------

The program models a linear, underdamped, single-degree-of-freedom system
subjected to a sinusoidal force:

  P(t) = P0 * sin(forcingOmega * t)

An ideal undamped oscillator at resonance has an unbounded response; the tool
detects that case and displays an error. Non-finite or excessively large
calculated responses are also reported as errors.

Use engineering judgment to confirm that the SDOF model and entered properties
are suitable for the physical system. The plotter is an analysis aid and does
not replace independent engineering review.
