#!/usr/bin/env python3
"""Check local navigation and JavaScript syntax without installing packages."""

from html.parser import HTMLParser
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent.parent
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.targets = set()
        self.references = []
        self.fallback = set()
        self.stack = []
        self.scripts = []
        self.script = None
        self.feed(path.read_text(encoding='utf-8'))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        in_fallback = attrs.get('id') == 'graph-fallback' or any(self.stack)
        if tag not in VOID:
            self.stack.append(in_fallback)
        if attrs.get('id'):
            self.targets.add(attrs['id'])
        if tag == 'a' and attrs.get('name'):
            self.targets.add(attrs['name'])
        for name in ('href', 'src'):
            if attrs.get(name):
                self.references.append((self.getpos()[0], name, attrs[name]))
        if in_fallback and tag == 'a' and attrs.get('href'):
            self.fallback.add(attrs['href'])
        script_type = attrs.get('type', '').strip().lower()
        if tag == 'script' and 'src' not in attrs and script_type in ('', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript'):
            self.script = [self.getpos()[0], '']

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if self.stack and tag not in VOID:
            self.stack.pop()
        if tag == 'script' and self.script is not None:
            self.scripts.append(self.script)
            self.script = None

    def handle_data(self, data):
        if self.script is not None:
            self.script[1] += data


def local_target(page, url):
    parts = urlsplit(url)
    if parts.scheme or parts.netloc:
        return None
    path = unquote(parts.path)
    target = page if not path else (ROOT / path.lstrip('/') if path.startswith('/') else page.parent / path)
    return target.resolve(), unquote(parts.fragment)


def main():
    problems = []
    pages = [Page(path) for path in [ROOT / 'index.html', *sorted((ROOT / 'articles').glob('*.html'))]]
    for page in pages:
        for line, attr, url in page.references:
            target = local_target(page.path, url)
            if target is None:
                continue
            path, fragment = target
            if not path.is_file():
                problems.append(f'{page.path.relative_to(ROOT)}:{line}: {attr}="{url}" does not resolve to a file')
            elif fragment and path == page.path.resolve() and fragment not in page.targets:
                problems.append(f'{page.path.relative_to(ROOT)}:{line}: missing fragment #{fragment}')

    graph = ROOT / 'assets/brain-graph.js'
    urls = re.findall(r'\burl\s*:\s*[\'\"]([^\'\"]+)[\'\"]', graph.read_text(encoding='utf-8'))
    if not urls:
        problems.append('assets/brain-graph.js: no article URLs found')
    for url in urls:
        target = local_target(ROOT / 'index.html', url)
        if target is None or not target[0].is_file():
            problems.append(f'assets/brain-graph.js: article {url} does not resolve to a file')
        if url not in pages[0].fallback:
            problems.append(f'assets/brain-graph.js: article {url} is absent from the fallback list')
    extra = pages[0].fallback - set(urls)
    for url in sorted(extra):
        problems.append(f'index.html: fallback article {url} is absent from graph data')

    node = shutil.which('node')
    if node:
        def check_js(path, label):
            result = subprocess.run([node, '--check', str(path)], capture_output=True, text=True)
            if result.returncode:
                problems.append(f'{label}: JavaScript syntax error\n{result.stderr.strip()}')

        for path in sorted((ROOT / 'assets').glob('*.js')):
            check_js(path, str(path.relative_to(ROOT)))
        with tempfile.TemporaryDirectory(prefix='check-site-') as directory:
            for page in pages:
                for index, (line, source) in enumerate(page.scripts):
                    path = Path(directory) / f'inline-{index}.js'
                    path.write_text(source, encoding='utf-8')
                    check_js(path, f'{page.path.relative_to(ROOT)}:{line}: inline script')
    else:
        print('node not on PATH; JavaScript syntax checks skipped')
    for problem in problems:
        print(problem)
    print(f'{len(problems)} problem(s); checked {len(pages)} HTML pages and {len(urls)} graph article URLs')
    return 1 if problems else 0


if __name__ == '__main__':
    raise SystemExit(main())
