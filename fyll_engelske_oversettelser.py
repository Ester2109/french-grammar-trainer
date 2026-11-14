import concurrent.futures
import json
import random
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

SOURCE = Path('verbs.json')
OUTPUT = Path('verbs_english_complete.json')
CHECKPOINT = Path('translation_progress.json')
WORKERS = 4


def translate(verb):
    params = urlencode({'client':'gtx','sl':'fr','tl':'en','dt':'t','q':verb})
    url = 'https://translate.googleapis.com/translate_a/single?' + params
    for attempt in range(6):
        try:
            req = Request(url, headers={'User-Agent':'Mozilla/5.0'})
            with urlopen(req, timeout=20) as response:
                data = json.load(response)
            value = ''.join(part[0] or '' for part in data[0]).strip()
            if not value:
                raise ValueError('Empty translation')
            return verb, value, None
        except Exception as exc:
            if attempt == 5:
                return verb, None, str(exc)
            time.sleep(min(30, 1.5 * (2 ** attempt)) + random.random())


def main():
    if not SOURCE.exists():
        raise SystemExit('Could not find verbs.json. Put this script next to verbs.json.')
    with SOURCE.open(encoding='utf-8') as f:
        document = json.load(f)
    verbs = document.get('verbs', document)
    if not isinstance(verbs, dict):
        raise SystemExit('Unexpected JSON structure')
    progress = {}
    if CHECKPOINT.exists():
        with CHECKPOINT.open(encoding='utf-8') as f:
            progress = json.load(f)
    pending = []
    for name, entry in verbs.items():
        if not isinstance(entry, dict) or name.startswith('_'):
            continue
        current = entry.get('translation_en')
        if isinstance(current, str):
            current = [current] if current.strip() else []
        if current:
            continue
        if name in progress and progress[name]:
            entry['translation_en'] = [progress[name]]
        else:
            pending.append(name)
    print(f'{len(pending)} verbs need translation. This may take several minutes.')
    failures = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = {executor.submit(translate, name): name for name in pending}
        for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
            name, value, error = future.result()
            if value:
                verbs[name]['translation_en'] = [value]
                progress[name] = value
            else:
                failures[name] = error
            if i % 100 == 0 or i == len(pending):
                CHECKPOINT.write_text(json.dumps(progress, ensure_ascii=False), encoding='utf-8')
                print(f'{i}/{len(pending)} processed; {len(failures)} failed so far')
    with OUTPUT.open('w', encoding='utf-8') as f:
        json.dump(document, f, ensure_ascii=False, indent=2)
    print(f'Finished: {OUTPUT.resolve()}')
    if failures:
        print(f'{len(failures)} failed; run the script again to retry them.')
    else:
        print('All missing translations were filled in.')


if __name__ == '__main__':
    main()
