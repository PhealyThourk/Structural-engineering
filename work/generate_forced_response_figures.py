import math
from pathlib import Path

out = Path('docs/assets/images')
out.mkdir(parents=True, exist_ok=True)
m, k, xi, P0 = 8_000_000.0, 2e9, 0.05, 5_000_000.0
u0 = v0 = 0.0
wn = math.sqrt(k / m)
wd = wn * math.sqrt(1 - xi**2)


def svg_start(title, width=1000, height=560):
    return [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
            '<rect width="100%" height="100%" fill="white"/>',
            '<style>text{font-family:Arial,sans-serif;fill:#222}.grid{stroke:#bbb;stroke-width:1}.axis{stroke:#333;stroke-width:1.4}</style>',
            f'<text x="500" y="30" text-anchor="middle" font-size="21">{title}</text>']

def esc(s):
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def write_svg(filename, parts):
    parts.append('</svg>')
    (out / filename).write_text('\n'.join(parts), encoding='utf-8')

# Dynamic amplification factor A as a function of beta.
W,H=900,520; L,T,R,B=85,65,850,445
p=svg_start('Dynamic amplification factor A (ξ = 0.05)',W,H)
for i in range(7):
    xval=i*.5; x=L+(R-L)*xval/3
    p += [f'<line class="grid" x1="{x}" y1="{T}" x2="{x}" y2="{B}"/>',f'<text x="{x}" y="{B+23}" text-anchor="middle" font-size="13">{xval:.1f}</text>']
for val in range(0,13,2):
    y=B-(B-T)*val/12
    p += [f'<line class="grid" x1="{L}" y1="{y}" x2="{R}" y2="{y}"/>',f'<text x="{L-12}" y="{y+4}" text-anchor="end" font-size="13">{val}</text>']
coords=[]
for j in range(1001):
    b=3*j/1000; amplification=1/math.sqrt((1-b*b)**2+(2*xi*b)**2)
    coords.append(f'{L+(R-L)*b/3:.2f},{B-(B-T)*amplification/12:.2f}')
p += [f'<polyline points="{" ".join(coords)}" fill="none" stroke="#1769aa" stroke-width="3"/>',
      f'<line class="axis" x1="{L}" y1="{T}" x2="{L}" y2="{B}"/><line class="axis" x1="{L}" y1="{B}" x2="{R}" y2="{B}"/>',
      f'<text x="467" y="{H-20}" text-anchor="middle" font-size="16">Frequency ratio, β = Ω / ωₙ</text>',
      f'<text x="22" y="255" transform="rotate(-90 22 255)" text-anchor="middle" font-size="16">Dynamic amplification factor, A</text>',
      f'<circle cx="{L+(R-L)*math.sqrt(1-2*xi**2)/3}" cy="{B-(B-T)/(2*xi*math.sqrt(1-xi**2))/12}" r="5" fill="#c43c39"/>',
      f'<text x="{L+(R-L)*math.sqrt(1-2*xi**2)/3+15}" y="{B-(B-T)/(2*xi*math.sqrt(1-xi**2))/12-12}" font-size="13">Maximum: β = {math.sqrt(1-2*xi**2):.4f}, A = {1/(2*xi*math.sqrt(1-xi**2)):.4f}</text>', 
      f'<text x="{R-5}" y="{B-12}" text-anchor="end" font-size="13">Static displacement: P₀/k = {P0/k*1000:.1f} mm</text>']
write_svg('dynamic-denominator-vs-beta.svg',p)

# Peak frequency ratio as a function of damping ratio, from dA/dbeta = 0.
W,H=900,520; L,T,R,B=85,65,850,445
xi_limit=1.0
xi_transition=1/math.sqrt(2)
beta_peak_current=math.sqrt(1-2*xi**2)
p=svg_start('Frequency ratio at maximum amplification',W,H)
for i in range(11):
    xival=i*0.1; x=L+(R-L)*xival/xi_limit
    p += [f'<line class="grid" x1="{x}" y1="{T}" x2="{x}" y2="{B}"/>',f'<text x="{x}" y="{B+23}" text-anchor="middle" font-size="13">{xival:.1f}</text>']
for i in range(6):
    val=i*.2; y=B-(B-T)*val
    p += [f'<line class="grid" x1="{L}" y1="{y}" x2="{R}" y2="{y}"/>',f'<text x="{L-12}" y="{y+4}" text-anchor="end" font-size="13">{val:.1f}</text>']
coords=[]
for j in range(1001):
    ratio=xi_limit*j/1000
    beta_peak=math.sqrt(max(0,1-2*ratio**2)) if ratio < xi_transition else 0.0
    coords.append(f'{L+(R-L)*ratio/xi_limit:.2f},{B-(B-T)*beta_peak:.2f}')
xp=L+(R-L)*xi/xi_limit; yp=B-(B-T)*beta_peak_current
p += [f'<polyline points="{" ".join(coords)}" fill="none" stroke="#1769aa" stroke-width="3"/>',
      f'<line class="axis" x1="{L}" y1="{T}" x2="{L}" y2="{B}"/><line class="axis" x1="{L}" y1="{B}" x2="{R}" y2="{B}"/>',
      f'<text x="467" y="{H-20}" text-anchor="middle" font-size="16">Damping ratio, ξ</text>',
      f'<text x="22" y="255" transform="rotate(-90 22 255)" text-anchor="middle" font-size="16">Peak frequency ratio, βₘₐₓ</text>',
      f'<circle cx="{xp}" cy="{yp}" r="5" fill="#c43c39"/>',
      f'<text x="{xp+15}" y="{yp+23}" font-size="13">ξ = {xi:.2f}: βₘₐₓ = {beta_peak_current:.4f}</text>']
write_svg('beta-peak-vs-damping.svg',p)
for freq in (2.5,3.0,5.0):
    Om=2*math.pi*freq; beta=Om/wn; A=1/math.sqrt((1-beta**2)**2+(2*xi*beta)**2)
    phi=math.atan2(2*xi*beta,1-beta**2)
    B1=u0+(2*xi*beta*A**2)*(P0/k)
    B2=(v0+xi*wn*B1)/wd-((1-beta**2)*Om/wd*A**2)*(P0/k)
    def values(t):
        tr=math.exp(-xi*wn*t)*(B1*math.cos(wd*t)+B2*math.sin(wd*t))*1000
        ss=P0/k*A*math.sin(Om*t-phi)*1000
        return tr+ss,tr,ss
    samples=[values(10*j/2500) for j in range(2501)]
    ymax=max(abs(v) for row in samples for v in row)*1.12
    ymin=-ymax
    W,H=1180,600; L,T,R,B=75,65,825,510
    p=svg_start(f'Damped SDOF response to sinusoidal force ({freq:g} Hz)',W,H)
    # ticks and grid
    for i in range(11):
        tv=i; x=L+(R-L)*tv/10
        p += [f'<line class="grid" x1="{x}" y1="{T}" x2="{x}" y2="{B}"/>',f'<text x="{x}" y="{B+22}" text-anchor="middle" font-size="12">{tv}</text>']
    for i in range(5):
        val=ymin+(ymax-ymin)*i/4; y=B-(B-T)*i/4
        p += [f'<line class="grid" x1="{L}" y1="{y}" x2="{R}" y2="{y}"/>',f'<text x="{L-10}" y="{y+4}" text-anchor="end" font-size="12">{val:.1f}</text>']
    colors=('#111111','#2878b5','#ed7d31'); dashes=('',' stroke-dasharray="7 4"',' stroke-dasharray="2 5"')
    for series,color,dash in zip(range(3),colors,dashes):
        points=[]
        for j,row in enumerate(samples):
            val=row[series]; x=L+(R-L)*j/2500; y=B-(B-T)*(val-ymin)/(ymax-ymin)
            points.append(f'{x:.1f},{y:.1f}')
        p.append(f'<polyline points="{" ".join(points)}" fill="none" stroke="{color}" stroke-width="1.7"{dash}/>')
    p += [f'<line class="axis" x1="{L}" y1="{T}" x2="{L}" y2="{B}"/><line class="axis" x1="{L}" y1="{B}" x2="{R}" y2="{B}"/>',
          f'<text x="450" y="{H-25}" text-anchor="middle" font-size="15">Time (s)</text>',
          '<text x="20" y="285" transform="rotate(-90 20 285)" text-anchor="middle" font-size="15">Displacement (mm)</text>']
    # legend and inputs outside plot axes
    for i,(name,color,dash) in enumerate(zip(('Total response','Transient part','Steady-state part'),colors,dashes)):
        y=86+i*23
        p += [f'<line x1="850" y1="{y}" x2="890" y2="{y}" stroke="{color}" stroke-width="2"{dash}/>',f'<text x="900" y="{y+5}" font-size="14">{name}</text>']
    amp=P0/k*A*1000
    lines=[('INPUTS',True),(f'm = {m:,.0f} kg',False),(f'k = {k:.2e} N/m',False),(f'ξ = {xi:.3f}',False),(f'P₀ = {P0:,.0f} N',False),(f'Ω = {Om:.3f} rad/s ({freq:.1f} Hz)',False),(f'u₀ = {u0:.3f} m',False),(f'v₀ = {v0:.3f} m/s',False),('',False),('DERIVED',True),(f'ωₙ = {wn:.3f} rad/s ({wn/(2*math.pi):.3f} Hz)',False),(f'ω_d = {wd:.3f} rad/s ({wd/(2*math.pi):.3f} Hz)',False),(f'β = {beta:.3f}',False),(f'Steady amplitude = {amp:.2f} mm',False)]
    p += ['<rect x="850" y="175" width="300" height="330" rx="10" fill="#fff" stroke="#888" stroke-width="1.5"/>']
    for i,(line,bold) in enumerate(lines):
        p.append(f'<text x="868" y="{200+i*21}" font-size="13" font-weight="{"bold" if bold else "normal"}">{esc(line)}</text>')
    write_svg(f'forced-response-{freq:g}hz.svg',p)
