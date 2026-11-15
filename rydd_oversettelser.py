
import json
import re
from pathlib import Path

SOURCE = Path("verbs.json")
OUTPUT = Path("verbs_cleaned.json")

MAX_TRANSLATIONS = 4
MAX_WORDS = 8

# Manual improvements for verbs with several meanings.
# Add more verbs here whenever needed.
MANUAL = {
    "craquer": [
        "to crack",
        "to break",
        "to give in",
        "to fall for"
    ],
    "être": ["to be"],
    "avoir": ["to have"],
    "aller": ["to go"],
    "faire": ["to do", "to make"],
    "prendre": ["to take"],
    "mettre": ["to put"],
    "venir": ["to come"],
    "voir": ["to see"],
    "savoir": ["to know"],
    "pouvoir": ["to be able to"],
    "vouloir": ["to want"],
    "devoir": ["to have to", "to owe"],
    "dire": ["to say", "to tell"],
    "parler": ["to speak", "to talk"],
    "manger": ["to eat"],
    "boire": ["to drink"],
    "dormir": ["to sleep"],
    "partir": ["to leave"],
    "sortir": ["to go out", "to leave"],
    "rester": ["to stay"],
    "trouver": ["to find"],
    "chercher": ["to look for", "to search"],
    "donner": ["to give"],
    "recevoir": ["to receive"],
    "écrire": ["to write"],
    "lire": ["to read"],
    "comprendre": ["to understand"],
    "apprendre": ["to learn"],
    "attendre": ["to wait"],
    "ouvrir": ["to open"],
    "fermer": ["to close"],
    "acheter": ["to buy"],
    "vendre": ["to sell"],
    "aimer": ["to like", "to love"],
    "détester": ["to hate"],
    "penser": ["to think"],
    "croire": ["to believe"],
    "connaître": ["to know", "to be familiar with"],
    "vivre": ["to live"],
    "mourir": ["to die"],
    "naître": ["to be born"],
    "courir": ["to run"],
    "marcher": ["to walk", "to work"],
    "jouer": ["to play"],
    "travailler": ["to work"],
    "étudier": ["to study"],
    "finir": ["to finish"],
    "commencer": ["to begin", "to start"],
    "continuer": ["to continue"],
    "essayer": ["to try"],
    "réussir": ["to succeed"],
    "perdre": ["to lose"],
    "gagner": ["to win", "to earn"],
    "tomber": ["to fall"],
    "monter": ["to go up", "to climb"],
    "descendre": ["to go down", "to descend"],
    "entrer": ["to enter"],
    "rentrer": ["to return", "to go back"],
    "retourner": ["to return", "to turn over"],
    "passer": ["to pass", "to spend"],
    "arriver": ["to arrive", "to happen"],
    "tenir": ["to hold"],
    "porter": ["to carry", "to wear"],
    "laisser": ["to leave", "to let"],
    "demander": ["to ask"],
    "répondre": ["to answer", "to reply"],
    "aider": ["to help"],
    "choisir": ["to choose"],
    "changer": ["to change"],
    "utiliser": ["to use"],
    "expliquer": ["to explain"],
    "montrer": ["to show"],
    "envoyer": ["to send"],
    "suivre": ["to follow"],
    "conduire": ["to drive"],
    "construire": ["to build"],
    "produire": ["to produce"],
    "détruire": ["to destroy"]
}


def clean_text(value):
    if not isinstance(value, str):
        return ""

    text = value.strip()

    # Remove Wiktionary-style introductory labels.
    text = re.sub(
        r"^\([^)]{1,50}\)\s*",
        "",
        text
    )

    text = re.sub(
        r"^\[[^\]]{1,50}\]\s*",
        "",
        text
    )

    # Remove surrounding whitespace and punctuation.
    text = text.strip(" .;,")

    # Normalize whitespace.
    text = " ".join(text.split())

    return text


def split_meanings(text):
    """
    Split definitions only at semicolons.
    Avoid splitting at commas, which may be
    part of an explanation.
    """
    return [
        part.strip()
        for part in text.split(";")
        if part.strip()
    ]


def clean_translations(values):
    if isinstance(values, str):
        values = [values]

    if not isinstance(values, list):
        return []

    results = []
    seen = set()

    for original in values:
        if not isinstance(original, str):
            continue

        for part in split_meanings(original):
            text = clean_text(part)

            if not text:
                continue

            # Skip overly long dictionary explanations.
            if len(text.split()) > MAX_WORDS:
                continue

            # Skip obvious dictionary placeholders.
            if text.lower() in {
                "see above",
                "alternative form",
                "obsolete form",
                "inflection of",
                "form of"
            }:
                continue

            # Add "to" to simple English infinitives.
            if (
                not text.lower().startswith("to ")
                and re.fullmatch(
                    r"[A-Za-z]+(?: [A-Za-z]+){0,2}",
                    text
                )
                and not text.lower().startswith(
                    ("a ", "an ", "the ")
                )
            ):
                text = "to " + text

            key = text.casefold()

            if key in seen:
                continue

            seen.add(key)
            results.append(text)

            if len(results) >= MAX_TRANSLATIONS:
                return results

    return results


def main():
    if not SOURCE.exists():
        print("ERROR: verbs.json not found.")
        return

    with SOURCE.open(
        "r",
        encoding="utf-8"
    ) as file:
        document = json.load(file)

    verbs = document.get("verbs", document)

    total = 0
    changed = 0
    missing = 0

    for name, entry in verbs.items():
        if not isinstance(entry, dict):
            continue

        if name.startswith("_"):
            continue

        total += 1

        original = entry.get(
            "translation_en",
            []
        )

        if name in MANUAL:
            cleaned = MANUAL[name]
        else:
            cleaned = clean_translations(original)

        if cleaned != original:
            changed += 1

        entry["translation_en"] = cleaned

        if not cleaned:
            missing += 1

    with OUTPUT.open(
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            document,
            file,
            ensure_ascii=False,
            indent=2
        )

    print("\nTRANSLATION CLEANUP COMPLETE")
    print("----------------------------")
    print(f"Total verbs:       {total}")
    print(f"Entries changed:   {changed}")
    print(f"Still missing:     {missing}")
    print(f"Output file:       {OUTPUT.name}")


if __name__ == "__main__":
    main()
