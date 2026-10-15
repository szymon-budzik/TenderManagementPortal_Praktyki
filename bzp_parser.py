import json
from datetime import datetime

# ==========================================
# PARSER DLA PLATFORMY e-ZAMÓWIENIA (BZP)
# ==========================================

def normalize_bzp_tender(bzp_item):
    """
    Tłumaczy strukturę JSON z e-Zamówień 
    na uniwersalny format akceptowany przez Wasz backend w Javie.
    """
    tender_id = bzp_item.get('noticeId') or bzp_item.get('objectId', 'Brak ID')
    title = bzp_item.get('orderTitle', 'Brak tytułu')
    description = bzp_item.get('shortDescription', 'Brak opisu')
    
    return {
        "externalId": str(tender_id),
        "title": title,
        "description": description,
        "source": "e-Zamówienia (BZP)",
        "ingestedAt": datetime.now().isoformat()
    }

def fetch_ezamowienia_mock():
    """
    Symuluje pobieranie danych z API, wykorzystując mock (zaślepkę).
    """
    print("Odpytuję API e-Zamówień (Używam Mocka/Zaślepki)...")
    
    # Symulowana odpowiedź serwera (dokładnie taka struktura, jaką zwraca BZP)
    mocked_response_json = """
    {
        "data": [
            {
                "noticeId": "BZP-2026-10-01-A",
                "orderTitle": "Dostawa sprzętu komputerowego dla urzędu",
                "shortDescription": "Przedmiotem zamówienia jest dostawa 50 sztuk laptopów."
            },
            {
                "objectId": "BZP-2026-10-02-B",
                "orderTitle": "Rozbudowa infrastruktury serwerowej",
                "shortDescription": "Zakup i instalacja serwerów bazy danych PostgreSQL."
            }
        ]
    }
    """
    
    # json.loads() zamienia tekstowy JSON na słownik Pythona (to samo robiło response.json())
    data = json.loads(mocked_response_json)
    
    tenders_list = data.get('data', [])
    
    print(f"Pobrano {len(tenders_list)} surowych ogłoszeń. Normalizowanie...")
    
    normalized_tenders = []
    for item in tenders_list:
        clean_tender = normalize_bzp_tender(item)
        normalized_tenders.append(clean_tender)
        
    return normalized_tenders

if __name__ == "__main__":
    print("--- TEST PARSERA BZP (MOCK) ---")
    results = fetch_ezamowienia_mock()
    
    for i, tender in enumerate(results, 1):
        print(f"\n[Przetarg {i}]")
        print(f"ID: {tender['externalId']}")
        print(f"Tytuł: {tender['title']}")
        print(f"Opis: {tender['description']}")