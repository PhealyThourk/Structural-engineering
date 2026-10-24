from pathlib import Path

translations = {
'dynamic-denominator-vs-beta.svg': {
'D as a function of frequency ratio (ξ = 0.05)': 'D តាមសមាមាត្រប្រេកង់ (ξ = 0.05)',
'Frequency ratio, β = Ω / ωₙ': 'សមាមាត្រប្រេកង់, β = Ω / ωₙ',
},
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
