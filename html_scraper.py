import requests
from bs4 import BeautifulSoup
from datetime import datetime

def scrape_tender_from_website(url):
    """
    Pobiera stronę HTML i wyciąga z niej dane o przetargu za pomocą web scrapingu.
    """
    print(f"Pobieram kod HTML ze strony: {url}...")
    
    # Dodajemy nagłówki, aby zasymulować prawdziwą przeglądarkę
    # Niektóre portale blokują skrypty, które nie przedstawiają się jako przeglądarka
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        # Inicjalizujemy BeautifulSoup do analizy struktury HTML[cite: 1]
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Zależnie od struktury strony, musisz zlokalizować odpowiednie znaczniki.
        # W prawdziwym systemie będziesz musiał sprawdzić strukturę strony (Zbadaj element).
        # Poniżej symulacja wyciągania przykładowych danych (h1, div, span).
        
        # Szukamy tytułu przetargu (zakładając, że to jedyny tag <h1> na stronie)
        title_element = soup.find('h1')
        title = title_element.get_text(strip=True) if title_element else "Brak tytułu"
        
        # Szukamy opisu (zakładając, że znajduje się w divie o konkretnej klasie)
        description_element = soup.find('div', class_='tender-description')
        description = description_element.get_text(separator=" ", strip=True) if description_element else "Brak opisu"
        
        # Normalizujemy wyciągnięte dane do formatu gotowego dla Javy[cite: 2]
        normalized_data = {
            "externalId": url, # Jako ID tymczasowo podajemy link
            "title": title,
            "description": description,
            "source": "web_scraper",
            "ingestedAt": datetime.now().isoformat()
        }
        
        return normalized_data
        
    except requests.exceptions.RequestException as e:
        print(f"Błąd podczas pobierania strony: {e}")
        return None

if __name__ == "__main__":
    # Testowy link (możesz podmienić na stronę jakiegokolwiek portalu ogłoszeniowego)
    test_url = "https://example.com/przetargi/123" 
    
    result = scrape_tender_from_website(test_url)
    
    if result:
        print("\n--- WYNIK WEB SCRAPINGU ---")
        print(f"Tytuł: {result['title']}")
        print(f"Opis: {result['description']}")
        print("Pełny JSON:")
        print(result)