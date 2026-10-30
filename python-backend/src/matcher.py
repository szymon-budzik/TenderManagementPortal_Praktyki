import re
from typing import List, Dict, Any

PRIORITY_WEIGHTS = {
    "Niski": 10,
    "Średni": 25,
    "Wysoki": 50,
    "Brak": 0
}

def _extract_searchable_text(item: Dict[str, Any]) -> str:
    """Łączy wszystkie tekstowe wartości z rekordu ogłoszenia w jeden ciąg."""
    chunks = []
    for val in item.values():
        if isinstance(val, str):
            chunks.append(val)
        elif isinstance(val, (list, tuple)):
            chunks.extend(str(x) for x in val if isinstance(x, (str, int, float)))
        elif isinstance(val, (int, float)):
            chunks.append(str(val))
    return " ".join(chunks).lower()

def evaluate_single_item(item: Dict[str, Any], keywords: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Ocenia pojedyncze ogłoszenie:
    1. Sprawdza słowa wykluczające -> natychmiastowy odrzut (REJECTED).
    2. Sprawdza słowa pożądane -> liczy punkty (MATCHED lub NEUTRAL).
    """
    text = _extract_searchable_text(item)

    # Rozdzielenie reguł
    negative_rules = [k for k in keywords if k.get("type") == "Wykluczające"]
    positive_rules = [k for k in keywords if k.get("type", "Pożądane") == "Pożądane"]

    # Krok 1: Twardy blacklist (Wykluczenia)
    for rule in negative_rules:
        word = rule.get("word", "").strip().lower()
        if not word:
            continue
        pattern = rf"\b{re.escape(word)}\b"
        if re.search(pattern, text):
            return {
                "status": "REJECTED",
                "score": 0,
                "matched_keywords": [],
                "rejected_by": rule.get("word"),
                "matched_categories": []
            }

    # Krok 2: Słowa pożądane i scoring
    total_score = 0
    matched_words = []
    matched_cats = set()

    for rule in positive_rules:
        word = rule.get("word", "").strip().lower()
        if not word:
            continue
        pattern = rf"\b{re.escape(word)}\b"
        if re.search(pattern, text):
            matched_words.append(rule.get("word"))
            prio = rule.get("priority", "Średni")
            total_score += PRIORITY_WEIGHTS.get(prio, 25)
            if rule.get("category"):
                matched_cats.add(rule.get("category"))

    if matched_words:
        status = "MATCHED"
    else:
        status = "NEUTRAL"

    return {
        "status": status,
        "score": total_score,
        "matched_keywords": matched_words,
        "rejected_by": None,
        "matched_categories": sorted(list(matched_cats))
    }

def evaluate_items(items: List[Dict[str, Any]], keywords: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Przepuszcza całą listę ogłoszeń przez silnik i dokleja metadane ewaluacji."""
    enriched = []
    for item in items:
        eval_result = evaluate_single_item(item, keywords)
        enriched.append({
            "data": item,
            "evaluation": eval_result
        })
    # Sortowanie: dopasowane z najwyższym scorem na górze, odrzucone na dole
    return sorted(
        enriched,
        key=lambda x: (
            1 if x["evaluation"]["status"] == "MATCHED" else (0 if x["evaluation"]["status"] == "NEUTRAL" else -1),
            x["evaluation"]["score"]
        ),
        reverse=True
    )