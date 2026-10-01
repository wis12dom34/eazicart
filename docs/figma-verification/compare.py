"""Generate side-by-side, 50% overlay and 4x RGB difference evidence."""
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance, ImageStat
import json

captures = Path(__file__).parent / 'captures'
metrics = {}
for reference in sorted(captures.glob('*-reference.png')):
    name = reference.name.removesuffix('-reference.png')
    application = captures / f'{name}-app.png'
    if name == 'drawer':
        application = captures / 'drawer-isolated-app.png'
    if not application.exists():
        continue
    ref, app = Image.open(reference).convert('RGB'), Image.open(application).convert('RGB')
    if ref.size != app.size:
        raise ValueError(f'{name}: reference {ref.size} differs from app {app.size}')
    side = Image.new('RGB', (ref.width * 2, ref.height), 'white')
    side.paste(ref, (0, 0)); side.paste(app, (ref.width, 0))
    side.save(captures / f'{name}-comparison.png')
    Image.blend(ref, app, .5).save(captures / f'{name}-overlay.png')
    difference = ImageChops.difference(ref, app)
    ImageEnhance.Brightness(difference).enhance(4).save(captures / f'{name}-diff.png')
    metrics[name] = {'viewport': list(ref.size), 'mean_absolute_rgb_difference': sum(ImageStat.Stat(difference).mean) / 3}
(captures / 'comparison-metrics.json').write_text(json.dumps(metrics, indent=2) + '\n')
print(f'Generated comparisons for {len(metrics)} screens; metrics are diagnostic, not a fidelity acceptance threshold.')
