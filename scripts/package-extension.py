"""Create the self-contained browser companion download, without credentials."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
output = root / 'public' / 'downloads' / 'ootie-browser-companion.zip'
output.parent.mkdir(parents=True, exist_ok=True)
files = ['manifest.json','popup.html','popup.css','popup.js','content.js','handoff.js','messages.js',
         'icons/icon16.png','icons/icon48.png','icons/icon128.png']
with ZipFile(output,'w',ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root/'extension'/name, 'ootie-browser-companion/'+name)
print(f'Packaged {len(files)} files: {output}')
