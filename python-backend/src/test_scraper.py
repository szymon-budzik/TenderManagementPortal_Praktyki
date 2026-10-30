from html_scraper import fetch_html_tenders
from matcher import evaluate_items
from storage import load_keywords

# Przykładowy publiczny BIP lub tablica ogłoszeń
test_url = "https://bip.erzeszow.pl/pl/330-zamowienia-publiczne.html"

print(f"--- TEST BEAUTIFULSOUP SCRAPERA ---")
print(f"Pobieranie strony: {test_url}\n")

success, tenders, error = fetch_html_tenders(test_url, limit=5)

if not success:
    print(f"Błąd parsowania: {error}")
    exit(1)

print(f"Pomyślnie sparsowano {len(tenders)} ogłoszeń z HTML:\n")
keywords = load_keywords()
evaluated = evaluate_items(tenders, keywords)

for i, item in enumerate(evaluated, 1):
    ev = item["evaluation"]
    title = item["data"]["title"]
    url = item["data"].get("url", "")
    print(f"[{i}] {title[:90]}...")
    print(f"    URL: {url}")
    print(f"    Scoring: {ev['score']} pkt | Status: {ev['status']}\n")