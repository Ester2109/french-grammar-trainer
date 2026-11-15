
import json
from pathlib import Path

# FILES
DICTIONARY = Path("kaikki.org-dictionary-French.jsonl")
SOURCE = Path("verbs.json")
OUTPUT = Path("verbs_english_complete.json")
MISSING = Path("verbs_missing_translations.txt")

MAX_TRANSLATIONS = 5


def clean_gloss(text):
    """Clean a dictionary definition."""
    if not isinstance(text, str):
        return ""

    text = " ".join(text.split()).strip()

    if not text:
        return ""

    return text


def get_translations(entry):
    """Extract English definitions from a verb entry."""
    results = []

    for sense in entry.get("senses", []):
        if not isinstance(sense, dict):
            continue

        # Prefer ordinary definitions.
        glosses = sense.get("glosses", [])

        # Raw glosses are a fallback.
        if not glosses:
            glosses = sense.get("raw_glosses", [])

        for gloss in glosses:
            value = clean_gloss(gloss)

            if value and value not in results:
                results.append(value)

            if len(results) >= MAX_TRANSLATIONS:
                return results

    return results


def main():
    if not SOURCE.exists():
        print("ERROR: verbs.json was not found.")
        return

    if not DICTIONARY.exists():
        print("ERROR: Dictionary file was not found.")
        print(f"Expected: {DICTIONARY.name}")
        return

    print("Loading your existing verbs...", flush=True)

    with SOURCE.open("r", encoding="utf-8") as file:
        document = json.load(file)

    verbs = document.get("verbs", document)

    target_names = {
        name
        for name, data in verbs.items()
        if isinstance(data, dict)
        and not name.startswith("_")
    }

    translations = {}

    print(
        f"Found {len(target_names)} verbs.",
        flush=True
    )

    print(
        "Reading Wiktionary dictionary...",
        flush=True
    )

    lines_read = 0
    matched_entries = 0

    with DICTIONARY.open(
        "r",
        encoding="utf-8"
    ) as file:

        for line in file:
            lines_read += 1

            if lines_read % 100000 == 0:
                print(
                    f"Read {lines_read:,} entries | "
                    f"Matched {matched_entries:,}",
                    flush=True
                )

            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            word = entry.get("word", "")
            pos = entry.get("pos", "")

            # Only match actual French verbs.
            if word not in target_names:
                continue

            if pos != "verb":
                continue

            meanings = get_translations(entry)

            if not meanings:
                continue

            matched_entries += 1

            if word not in translations:
                translations[word] = []

            for meaning in meanings:
                if (
                    meaning not in translations[word]
                    and len(translations[word]) < MAX_TRANSLATIONS
                ):
                    translations[word].append(meaning)

    print("\nDictionary reading completed!", flush=True)

    added = 0
    already_translated = 0
    missing = []

    for name in sorted(target_names):
        data = verbs[name]

        current = data.get("translation_en", [])

        if isinstance(current, str):
            current = [current] if current.strip() else []

        if current:
            already_translated += 1
            continue

        meanings = translations.get(name, [])

        if meanings:
            data["translation_en"] = meanings
            added += 1
        else:
            data["translation_en"] = []
            missing.append(name)

    print("Saving updated verb database...", flush=True)

    with OUTPUT.open("w", encoding="utf-8") as file:
        json.dump(
            document,
            file,
            ensure_ascii=False,
            indent=2
        )

    MISSING.write_text(
        "\n".join(missing),
        encoding="utf-8"
    )

    total = len(target_names)

    print("\n" + "=" * 45)
    print("TRANSLATION RESULTS")
    print("=" * 45)

    print(f"Total verbs:          {total}")
    print(f"Already translated:   {already_translated}")
    print(f"New translations:     {added}")
    print(f"Still missing:        {len(missing)}")
    print(f"Total with English:   {already_translated + added}")

    print("\nFiles created:")
    print(f"- {OUTPUT.name}")
    print(f"- {MISSING.name}")

    print("\nDone!")


if __name__ == "__main__":
    main()
