# System Zarządzania i Automatyzacji Przetargów (Tender Management Portal)

Zintegrowana platforma webowa służąca do automatycznego pozyskiwania ogłoszeń przetargowych z zewnętrznych źródeł API (GET/POST) oraz stron internetowych (Web Scraper), wielokryterialnej oceny punktowej (*Scoring*) z podziałem na kategorie, harmonogramowania zadań (*Cron*) oraz eksportu i wysyłki raportów Excel (`.xlsx`) na wskazane adresy e-mail.

---

## 1. Architektura Systemu

System składa się z 4 współpracujących ze sobą kontenerów uruchamianych za pomocą **Docker Compose**:
* **`frontend`** (`port 5173 -> 80`) – aplikacja kliencka SPA (React + Vite + Tailwind CSS) serwowana przez serwer Nginx.
* **`java-backend`** (`port 8080`) – główny serwer aplikacyjny REST API (Java 21 + Spring Boot 3 + Spring Security JWT + Flyway).
* **`ingestion-worker`** (`port 8000`) – mikroserwis w języku Python (FastAPI + BeautifulSoup4 + Pandas + OpenPyXL) odpowiadający za Web Scraping stron HTML oraz generowanie i wysyłkę arkuszy Excel (`.xlsx`).
* **`postgres`** (`port 5432`) – relacyjna baza danych PostgreSQL 16 przechowująca przetargi, kategorie słów kluczowych, profile automatyzacji, historię pobrań oraz użytkowników.

---

## 2. Zmienne Środowiskowe

Konfiguracja środowiskowa przekazywana jest w pliku `docker-compose.yml` oraz `application.properties`:

### Kontener Bazy Danych (`postgres`)
| Zmienna | Wartość domyślna | Opis |
| :--- | :--- | :--- |
| `POSTGRES_DB` | `tender_db` | Nazwa bazy danych tworzonej przy starcie kontenera |
| `POSTGRES_USER` | `tender_user` | Nazwa użytkownika bazy danych |
| `POSTGRES_PASSWORD` | `secretpassword` | Hasło użytkownika bazy danych |

### Kontener Backendu (`java-backend`)
| Zmienna | Wartość domyślna | Opis |
| :--- | :--- | :--- |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://postgres:5432/tender_db` | Adres połączenia JDBC z bazą PostgreSQL w sieci Docker |
| `SPRING_DATASOURCE_USERNAME` | `tender_user` | Login do bazy danych |
| `SPRING_DATASOURCE_PASSWORD` | `secretpassword` | Hasło do bazy danych |
| `SCRAPER_SERVICE_URL` | `http://ingestion-worker:8000` | Wewnętrzny adres URL mikroserwisu Python (Scraper & Excel Worker) |
| `APP_JWT_SECRET` | *(klucz z `application.properties`)* | Klucz tajny HMAC-SHA256 służący do podpisywania tokenów JWT |
| `APP_JWT_EXPIRATION_MS` | `86400000` *(24h)* | Czas ważności tokenu autoryzacyjnego JWT w milisekundach |

---

## 3. Dane Dostępowe do Konta Administracyjnego

Podczas pierwszego uruchomienia systemu komponent `DataInitializer` automatycznie tworzy domyślne konto administratora (baza startuje bez żadnych predefiniowanych przetargów ani źródeł):

* **Adres aplikacji:** `http://localhost:5173`
* **Login:** `admin`
* **Hasło:** `admin123`
* **Rola:** `ROLE_ADMIN` (pełny dostęp do wszystkich zakładek oraz zarządzania uprawnieniami ról)

---

## 4. Instrukcja Uruchomienia Testowego

### Wymagania wstępne
* Zainstalowany i uruchomiony **Docker Desktop** (z obsługą `docker compose`).
* Wolne porty lokalne: `5173` (Frontend), `8080` (Backend Java), `8000` (Worker Python), `5432` (PostgreSQL).

### Krok 1: Uruchomienie czystego środowiska
W głównym katalogu repozytorium (tam, gdzie znajduje się plik `docker-compose.yml`) wykonaj w terminalu:

```bash
docker compose up --build -d
```

*(Opcjonalnie: jeśli chcesz całkowicie wyczyścić istniejący wolumen bazy danych i wystartować od zera, wykonaj najpierw `docker compose down -v`, a następnie `docker compose up --build -d`).*

### Krok 2: Weryfikacja stanu kontenerów
Sprawdź, czy wszystkie 4 serwisy mają status `Up` / `Running`:

```bash
docker compose ps
```

### Krok 3: Scenariusz testowy w przeglądarce
1. Otwórz przeglądarkę pod adresem **`http://localhost:5173`** i zaloguj się na konto **`admin`** / **`admin123`**.
2. Przejdź do zakładki **Endpointy** i dodaj źródło danych, np.:
   * **Nazwa:** `BZP e-Zamówienia`
   * **URL:** `https://ezamowienia.gov.pl/mo-board/api/v1/Board/Search?SortingColumnName=PublicationDate&SortingDirection=DESC&PageSize=50`
   * **Tryb:** `API GET`
   * Kliknij przycisk **Testuj** (żarówka), aby zweryfikować połączenie HTTP bez pobierania ogłoszeń do bazy.
3. Przejdź do zakładki **Keywordsy**:
   * Utwórz kategorię (np. `IT`) ze słowami kluczowymi po przecinku (np. `oprogramowanie, serwer, komputer, szkolenie`).
   * Kliknij na poszczególne słowa na liście, aby przypisać im wagę punktową (`1–100 pkt`) lub zaznaczyć **Wyklucz** (słowo wykluczające ma najwyższy priorytet i odrzuca cały przetarg).
4. Przejdź do zakładki **Wyszukiwarka**:
   * Zaznacz dodany endpoint oraz kategorię i kliknij **Uruchom pobieranie przetargów**.
   * System zapisze wyłącznie ogłoszenia z wynikiem `> 0 pkt` (pomijając ogłoszenia `0 pkt` oraz wykluczone).
5. Przejdź do zakładki **Automatyzacja i Excel**:
   * Stwórz profil automatyczny (np. `Firma IT`) z wybraną godziną uruchomienia Crona (czas polski `Europe/Warsaw`).
   * W sekcji historii pobrań zaznacz wybrane pobrania, aby wygenerować datowany plik **`raport_przetargi_RRRR-MM-DD_GG-MM.xlsx`** lub wysłać go na wskazane adresy e-mail.
