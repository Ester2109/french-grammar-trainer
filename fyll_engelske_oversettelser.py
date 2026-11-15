
import concurrent.futures
import json
import random
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

SOURCE = Path("verbs.json")
OUTPUT = Path("verbs_english_complete.json")
CHECKPOINT = Path("translation_progress.json")

WORKERS = 4


def translate(verb):
    params = urlencode({
        "client": "gtx",
        "sl": "fr",
        "tl": "en",
        "dt": "t",
        "q": verb
    })

    url = (
        "https://translate.googleapis.com/"
        "translate_a/single?" + params
    )

    for attempt in range(3):
        try:
            request = Request(
                url,
                headers={"User-Agent": "Mozilla/5.0"}
            )

            with urlopen(request, timeout=8) as response:
                data = json.load(response)

            translation = "".join(
                part[0] or ""
                for part in data[0]
            ).strip()

            if not translation:
                raise ValueError("Empty translation")

            return verb, translation, None

        except Exception as error:
            if attempt == 2:
                return verb, None, str(error)

            time.sleep(1 + random.random())


def save_progress(progress):
    CHECKPOINT.write_text(
        json.dumps(
            progress,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )


def main():
    if not SOURCE.exists():
        print("ERROR: verbs.json not found.")
        return

    with SOURCE.open(encoding="utf-8") as file:
        document = json.load(file)

    verbs = document.get("verbs", document)

    progress = {}

    if CHECKPOINT.exists():
        with CHECKPOINT.open(encoding="utf-8") as file:
            progress = json.load(file)

    pending = []

    for name, entry in verbs.items():
        if not isinstance(entry, dict):
            continue

        if name.startswith("_"):
            continue

        current = entry.get("translation_en", [])

        if current:
            continue

        if name in progress and progress[name]:
            entry["translation_en"] = [progress[name]]
        else:
            pending.append(name)

    total = len(pending)

    print(
        f"\n{total} verbs need translation.\n",
        flush=True
    )

    failures = {}

    try:
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=WORKERS
        ) as executor:

            futures = {
                executor.submit(translate, name): name
                for name in pending
            }

            for i, future in enumerate(
                concurrent.futures.as_completed(futures),
                1
            ):
                name, translation, error = future.result()

                if translation:
                    verbs[name]["translation_en"] = [
                        translation
                    ]

                    progress[name] = translation

                    print(
                        f"[{i}/{total}] "
                        f"{name} -> {translation}",
                        flush=True
                    )

                else:
                    failures[name] = error

                    print(
                        f"[{i}/{total}] "
                        f"FAILED: {name} ({error})",
                        flush=True
                    )

                if i % 10 == 0:
                    save_progress(progress)

    except KeyboardInterrupt:
        print("\nStopped by user.")

    finally:
        save_progress(progress)

        with OUTPUT.open("w", encoding="utf-8") as file:
            json.dump(
                document,
                file,
                ensure_ascii=False,
                indent=2
            )

        translated = len(progress)

        print("\nProgress saved!")
        print(f"Translations saved: {translated}")
        print(f"Output file: {OUTPUT.resolve()}")
        print(f"Failures this run: {len(failures)}")


if __name__ == "__main__":
    main()
