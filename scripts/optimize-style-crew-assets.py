"""Encode generated originals as WebP without cropping or resizing. Preserve PNGs."""
from pathlib import Path
import json
from PIL import Image
root = Path(__file__).resolve().parent.parent
before = after = 0
for source in (root / 'public/images/style-crew').glob('*.png'):
    target = source.with_suffix('.webp')
    with Image.open(source) as image:
        image.convert('RGB').save(target, 'WEBP', quality=88, method=6)
    before += source.stat().st_size
    after += target.stat().st_size
data_path = root / 'src/data/styleCrewExpansion.json'
data = json.loads(data_path.read_text(encoding='utf-8'))
for person in data:
    person['avatar'] = str(Path(person['avatar']).with_suffix('.webp')).replace('\\', '/')
    for item in person['wardrobe'] + person['extraPosts']:
        item['image'] = str(Path(item['image']).with_suffix('.webp')).replace('\\', '/')
data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'sourceBytes':before, 'webpBytes':after, 'originalsPreserved':True}))
