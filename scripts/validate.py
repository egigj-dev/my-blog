#!/usr/bin/env python3
"""Static site checks; no network requests or third-party Python packages."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
ARTICLES = {'activation-functions', 'alexnet-paper', 'cifar10-transfer-learning',
            'data-augmentation', 'optimization-techniques', 'regularization-techniques',
            'backpropagation', 'model-evaluation-calibration'}
errors = []

class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path, self.ids, self.refs, self.headings = path, set(), [], []
        self.meta, self.scripts, self.inline, self.in_script = {}, [], [], False
        self.title, self.h1, self.capture = '', '', None
        self.feed(path.read_text())
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            if a['id'] in self.ids: errors.append(f'{self.path}: duplicate ID {a["id"]}')
            self.ids.add(a['id'])
        for key in ('href', 'src', 'poster'):
            if a.get(key): self.refs.append(a[key])
        if tag == 'meta': self.meta[a.get('property', a.get('name'))] = a.get('content', '')
        if re.fullmatch('h[1-6]', tag): self.headings.append(int(tag[1]))
        if tag in ('title', 'h1'): self.capture = tag
        if tag == 'script' and not a.get('src'): self.in_script = True; self.inline = []
        if tag == 'img' and not a.get('alt'): errors.append(f'{self.path}: image missing alt')
        if tag == 'input' and not (a.get('aria-label') or a.get('type') in ('hidden', 'submit')):
            # All current inputs require an explicit label for regression checks.
            errors.append(f'{self.path}: input lacks aria-label')
    def handle_data(self, data):
        if self.capture == 'title': self.title += data
        if self.capture == 'h1': self.h1 += data
        if self.in_script: self.inline.append(data)
    def handle_endtag(self, tag):
        if tag == self.capture: self.capture = None
        if tag == 'script' and self.in_script:
            self.scripts.append(''.join(self.inline)); self.in_script = False

paths = [ROOT / 'index.html', *sorted((ROOT / 'articles').glob('*.html'))]
pages = {p: Page(p) for p in paths}
if {p.stem for p in paths[1:]} != ARTICLES: errors.append('Expected exactly the eight stable article URLs')
for p, page in pages.items():
    if page.headings.count(1) != 1 or page.headings[0] != 1: errors.append(f'{p}: expected one leading h1')
    for previous, current in zip(page.headings, page.headings[1:]):
        if current > previous + 1: errors.append(f'{p}: heading level skips h{previous} to h{current}')
    if not page.meta.get('description') or not page.meta.get('og:title') or not page.meta.get('og:description'):
        errors.append(f'{p}: missing metadata')
    if p.parent.name == 'articles' and page.title.strip() != page.h1.strip(): errors.append(f'{p}: title differs from h1')
    if page.meta.get('og:title') != page.title: errors.append(f'{p}: OG title differs from title')
    for ref in page.refs:
        u = urlsplit(ref)
        if u.scheme or u.netloc: continue
        target = (p.parent / unquote(u.path)).resolve() if u.path else p
        if target.is_dir(): target /= 'index.html'
        if not target.exists(): errors.append(f'{p.relative_to(ROOT)}: missing {ref}'); continue
        if u.fragment and target in pages and unquote(u.fragment) not in pages[target].ids:
            errors.append(f'{p.relative_to(ROOT)}: missing fragment {ref}')
        # Published assets must survive a checkout; untracked new files are allowed,
        # ignored files are not.
        result = subprocess.run(['git', 'check-ignore', '-q', str(target)], cwd=ROOT)
        if result.returncode == 0: errors.append(f'{p.relative_to(ROOT)}: ignored dependency {ref}')
    if p.parent.name == 'articles':
        readtime = re.search(r'(\d+) min read', p.read_text())
        card = re.search(r'href="articles/'+re.escape(p.name)+r'" class="card.*?</a>', paths[0].read_text(), re.S)
        if not card or not readtime or readtime.group(0) not in card.group(0): errors.append(f'{p}: reading time differs from card')
# Shared assets must cover all nine pages; archived mislabeled rasters stay unpublished.
for p in paths:
    source = p.read_text()
    prefix = '../' if p.parent.name == 'articles' else ''
    for asset in ('site.css', 'site.js'):
        if source.count(prefix + 'assets/' + asset) != 1:
            errors.append(f'{p}: expected one shared {asset} reference')
    if re.search(r'<img[^>]+src=["\'][^"\']*alexnet-architecture(?:-2)?\.png', source):
        errors.append(f'{p}: mislabeled archived AlexNet raster is displayed')
    if 'localStorage' in source: errors.append(f'{p}: theme storage must stay in shared layer')

# Check every standalone and inline script with the installed Node parser.
node = shutil.which('node')
if node:
    sources = [(str(p.relative_to(ROOT)), p.read_text()) for p in (ROOT / 'assets').glob('*.js')]
    sources += [(f'{p.name} inline {i}', s) for p, page in pages.items() for i, s in enumerate(page.scripts)]
    with tempfile.TemporaryDirectory() as temp:
        for i, (name, source) in enumerate(sources):
            file = Path(temp) / f'{i}.js'; file.write_text(source)
            result = subprocess.run([node, '--check', str(file)], capture_output=True, text=True)
            if result.returncode: errors.append(f'{name}: {result.stderr}')
    result = subprocess.run([node, str(ROOT / 'scripts/test-numerics.js')], cwd=ROOT)
    if result.returncode: errors.append('Numerical/behavioral regression tests failed')
else: print('SKIP: Node syntax and numerical/behavioral tests (Node unavailable)')
if errors:
    print('\n'.join(errors)); raise SystemExit(1)
print(f'PASS: {len(pages)} pages, eight stable article URLs, local links/assets/fragments, unique IDs, headings, metadata, reading times and published dependencies')
if node: print('PASS: standalone and inline JavaScript syntax')
