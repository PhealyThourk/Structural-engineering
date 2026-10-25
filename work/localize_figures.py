from pathlib import Path

translations = {
'dynamic-denominator-vs-beta.svg': {
'Dynamic amplification factor A (ξ = 0.05)': 'កត្តាពង្រីកថាមវន្ត A (ξ = 0.05)',
'Frequency ratio, β = Ω / ωₙ': 'សមាមាត្រប្រេកង់, β = Ω / ωₙ', 'Dynamic amplification factor, A': 'កត្តាពង្រីកថាមវន្ត, A', 'Maximum: β = 0.9975, A = 10.0125': 'អតិបរមា៖ β = 0.9975, A = 10.0125', 'Static displacement: P₀/k = 2.5 mm': 'ការផ្លាស់ទីឋិតិវន្ត: P₀/k = 2.5 mm',
},
'beta-peak-vs-damping.svg': {'Frequency ratio at maximum amplification': 'សមាមាត្រប្រេកង់នៅកត្តាពង្រីកអតិបរមា', 'Damping ratio, ξ': 'អនុបាតអំពើអូសទាញ, ξ', 'Peak frequency ratio, βₘₐₓ': 'សមាមាត្រប្រេកង់កំពូល, βₘₐₓ', 'ξ = 0.05: βₘₐₓ = 0.9975': 'ξ = 0.05៖ βₘₐₓ = 0.9975'},
'forced-response-2.5hz.svg': {},
'forced-response-3hz.svg': {},
'forced-response-5hz.svg': {},
}
for name, mapping in translations.items():
    src=Path('docs/assets/images')/name
    text=src.read_text(encoding='utf-8')
    for a,b in mapping.items():
        text=text.replace(a,b)
    if name.startswith('forced-response-'):
        text=text.replace('Damped SDOF response to sinusoidal force', 'ចម្លើយ SDOF មានអំពើអូសទាញ ក្រោមកម្លាំងស៊ីនុយសូអ៊ីត')
        text=text.replace('Time (s)', 'ពេលវេលា (s)')
        text=text.replace('Displacement (mm)', 'ការផ្លាស់ទី (mm)')
        text=text.replace('Total response', 'ចម្លើយសរុប')
        text=text.replace('Transient part', 'ផ្នែកបណ្ដោះអាសន្ន')
        text=text.replace('Steady-state part', 'ផ្នែកស្ថិរភាព')
        text=text.replace('INPUTS', 'ទិន្នន័យបញ្ចូល')
        text=text.replace('DERIVED', 'តម្លៃគណនា')
        text=text.replace('Steady amplitude', 'អំព្លីទុតស្ថិរភាព')
    text=text.replace("font-family:Arial,sans-serif", "font-family:'Noto Sans Khmer','Khmer OS','Leelawadee UI',Arial,sans-serif")
    (src.parent / f'{src.stem}.km.svg').write_text(text, encoding='utf-8')
