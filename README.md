# System Zarządzania i Automatyzacji Przetargów (Tender Management Portal)

Zintegrowana platforma webowa do automatycznego monitorowania ogłoszeń przetargowych z zewnętrznych źródeł API (GET/POST) oraz stron internetowych (Web Scraper), wielokryterialnej oceny punktowej (*Scoring*), śledzenia zmian i terminów składania ofert w obserwowanych postępowaniach, harmonogramowania zadań (*Cron*) oraz eksportu i wysyłki raportów Excel (`.xlsx`).

---

## 1. Główne Funkcjonalności

* **Agnostyczny silnik źródeł danych (0% hardkodowania portali):**
  * Obsługa **API GET**, **API POST** (edytor JSON z walidacją/formatowaniem oraz tryb tabeli klucz–wartość) i **Web Scrapera** (BeautifulSoup4 + własne selektory CSS).
  * **Dynamiczne zmienne daty** w URL i payloadzie (np. `{TODAY}`, `{YESTERDAY}`, `{TODAY-1D_START}`, `{TODAY_END}`, `{TODAY-7D_COMPACT}`), automatycznie rozwiązywane w strefie `Europe/Warsaw`.
  * **Konfigurowalne szablony linków (`linkTemplate`)** budujące klikalne adresy na podstawie dowolnego pola z odpowiedzi JSON (np. `{objectId}`, `{tenderId}`, `{id}`).
  * Testowanie połączenia bez zapisu do bazy (diagnostyka HTTP z eksportem do Markdown) oraz notatki robocze przypisane do endpointów.
* **Scoring wielokategorialny i Keyword Highlighter:**
  * Własne wagi punktowe (`1–100 pkt`), wykluczenia o najwyższym priorytecie, obsługa wieloznaczników (`*` / wildcard) oraz trybów dopasowania `OR` / `AND` per kategoria.
  * Kolorowe podświetlanie trafionych słów kluczowych (**Keyword Highlighter**) i legenda trafień w szczegółach przetargów.
* **Moduł „Obserwowane” (śledzenie zmian i terminów):**
  * Dedykowana zakładka z licznikiem na żywo w pasku bocznym dla postępowań oznaczonych jako `INTERESTED`.
  * Odliczanie czasu do terminu składania ofert **w godzinach** (aktualizowane na żywo) z możliwością ręcznej korekty daty i szybkim linkiem obok licznika.
  * Grupowanie wykrytych aktualizacji bezpośrednio nad bazowym ogłoszeniem, dedykowane sprawdzanie zmian wyłącznie dla obserwowanych przetargów oraz **wizualne porównanie wersji (Diff „Przed / Po”)**.
  * Możliwość zaznaczenia dowolnych oryginałów i aktualizacji w celu utworzenia gotowego raportu w zakładce **Raporty**.
* **Automatyzacja, Powiadomienia i Raporty Excel:**
  * Wieloprofilowy harmonogram **CRON** (wybrane dni/godziny lub interwały minutowe), obsługa wielu kont **SMTP** (bez zwracania haseł w odpowiedziach `GET` — eksponowana jest jedynie flaga `hasPassword`) oraz dzwoneczek powiadomień o wynikach automatycznych uruchomień.
  * Eksport wybranych pobrań i raportów z Obserwowanych do datowanego pliku `.xlsx` (klikalne hiperłącza, źródło endpointa, oczyszczone szczegóły, autofiltr i zamrożony nagłówek) oraz ręczna lub automatyczna wysyłka e-mail.
* **Zarządzanie rolami i Backup JSON:**
  * Autoryzacja JWT i kontrola dostępu oparta na rolach (RBAC).
  * Pełny **eksport i import konfiguracji (Backup JSON)** obejmujący endpointy, kategorie słów kluczowych i profile automatyzacji (tryb `MERGE` lub `REPLACE` z automatycznym przemapowaniem ID).

---

## 2. Architektura i Struktura Projektu

System składa się z 4 współpracujących kontenerów uruchamianych przez **Docker Compose**:

* **`frontend`** (`port 5173 -> 80`) – aplikacja kliencka SPA (React + Vite + Tailwind CSS + Lucide) serwowana przez Nginx.
* **`java-backend`** (`port 8080`) – główny serwer aplikacyjny REST API (Java 21 + Spring Boot + Spring Security JWT + Flyway `V1–V14`).
* **`ingestion-worker`** (`port 8000`) – mikroserwis Python (FastAPI + BeautifulSoup4 + Pandas + OpenPyXL) realizujący Web Scraping HTML, generowanie arkuszy `.xlsx` oraz wysyłkę SMTP.
* **`postgres`** (`port 5432`) – relacyjna baza danych PostgreSQL 16 przechowująca przetargi, historię ich aktualizacji (`tender_updates`), kategorie słów kluczowych, endpointy, konta SMTP, profile automatyzacji, powiadomienia, historię pobrań oraz użytkowników.

### Struktura repozytorium

```text
przetargi-app/
├── docker-compose.yml
├── backend/java-backend/
│   └── src/
│       ├── main/java/com/przetargi/java_backend/
│       │   ├── config/          # Konfiguracja Spring Security, JWT, obsługa błędów, DataInitializer
│       │   ├── controller/      # Cienkie kontrolery REST (mapowanie HTTP i walidacja, pełna warstwa DTO)
│       │   ├── dto/             # Rekordy i klasy DTO żądań/odpowiedzi
│       │   ├── entity/          # Encje JPA i enumy domenowe
│       │   ├── repository/      # Repozytoria Spring Data JPA i specyfikacje
│       │   └── service/         # Wyspecjalizowane serwisy domenowe (scoring, daty, źródła, aktualizacje, raporty, SMTP, harmonogram, backup)
│       ├── main/resources/db/migration/  # Migracje Flyway V1–V14
│       └── test/java/com/przetargi/java_backend/service/  # Testy jednostkowe JUnit 5 / Mockito
├── frontend/src/
│   ├── api.js                   # Klient Axios z interceptorami JWT
│   ├── services/                # Moduły zapytań HTTP (endpoints, tenders, automation, keywords, users)
│   ├── hooks/                   # Custom hooki (useSort, usePagination, usePolling, useConfirmDialog)
│   └── components/              # Widoki oraz modułowe podkomponenty w podfolderach (endpoints/, observed/, automation/, keywords/, tenders/, analytics/, users/, reports/)
└── ingestion-worker/
    ├── main.py                  # Punkt wejścia FastAPI (/scrape, /excel/export, /excel/email)
    ├── models.py                # Schematy Pydantic
    ├── scraper.py               # Pobieranie HTML i parsowanie BS4 / Pandas
    ├── excel_export.py          # Generowanie i stylowanie arkuszy .xlsx (OpenPyXL)
    ├── email_sender.py          # Wysyłka załączników Excel przez SMTP
    └── Dockerfile
```

---

## 3. Zmienne Środowiskowe

Konfiguracja środowiskowa przekazywana jest w pliku `docker-compose.yml` oraz `backend/java-backend/src/main/resources/application.properties`:

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
| `JWT_SECRET` | *(wartość domyślna w `application.properties`)* | Klucz tajny HMAC-SHA256 (min. 32 znaki) służący do podpisywania tokenów JWT |
| `APP_JWT_EXPIRATION_MS` | `86400000` *(24h)* | Czas ważności tokenu autoryzacyjnego JWT w milisekundach |
| `INTERNAL_API_KEY` | *(wartość domyślna w `application.properties`)* | Klucz autoryzacji dla wewnętrznych endpointów `/api/internal/**` |

---

## 4. Dane Dostępowe do Konta Administracyjnego

Podczas pierwszego uruchomienia systemu komponent `DataInitializer` automatycznie tworzy domyślne konto administratora (baza startuje bez predefiniowanych przetargów ani źródeł):

* **Adres aplikacji:** `http://localhost:5173`
* **Login:** `admin`
* **Hasło:** `admin123`
* **Rola:** `ROLE_ADMIN` (pełny dostęp do wszystkich zakładek, zarządzania uprawnieniami ról oraz Backupu JSON)

---

## 5. Instrukcja Uruchomienia Testowego

### Wymagania wstępne
* Zainstalowany i uruchomiony **Docker Desktop** (z obsługą `docker compose`).
* Wolne porty lokalne: `5173` (Frontend), `8080` (Backend Java), `8000` (Worker Python), `5432` (PostgreSQL).

### Krok 1: Uruchomienie środowiska
W głównym katalogu repozytorium wykonaj w terminalu:

```bash
docker compose up --build -d
```

*(Opcjonalnie: aby całkowicie wyczyścić wolumen bazy danych i wystartować od zera, wykonaj `docker compose down -v`, a następnie `docker compose up --build -d`).*

### Krok 2: Weryfikacja stanu kontenerów
Sprawdź, czy wszystkie 4 serwisy mają status `Up` / `Running`:

```bash
docker compose ps
```

### Krok 3: Scenariusz testowy w przeglądarce
1. Otwórz **`http://localhost:5173`** i zaloguj się na konto **`admin`** / **`admin123`**.
2. **Endpointy** – dodaj źródło danych (lub zaimportuj gotową konfigurację przez przycisk **Backup JSON** w panelu roli), np.:
   * **Nazwa:** `e-Zamówienia BZP`
   * **URL:** `https://ezamowienia.gov.pl/mo-board/api/v1/notice?NoticeType=ContractNotice&PublicationDateFrom={TODAY-1D_START}&PublicationDateTo={TODAY_END}&PageSize=50`
   * **Tryb:** `API GET`
   * **Szablon linku:** `https://ezamowienia.gov.pl/mo-client-board/bzp/notice-details/id/{objectId}`
   * Kliknij **Testuj** (żarówka), aby zweryfikować połączenie i podejrzeć wywołany adres po podstawieniu zmiennych daty.
3. **Keywordsy** – utwórz kategorię (np. `IT`) ze słowami kluczowymi (np. `oprogramowanie*, serwer*, chmur*, szkolenie`). Kliknij na poszczególne słowa, aby ustawić wagę (`1–100 pkt`), wildcard (`*`) lub oznaczyć wykluczenie.
4. **Wyszukiwarka** – zaznacz wybrane endpointy i kategorie, ustaw tryb dopasowania (`OR`/`AND`) i uruchom pobieranie. System zapisze wyłącznie ogłoszenia z wynikiem `> 0 pkt`.
5. **Przetargi i Obserwowane** – otwórz dowolny przetarg, aby zobaczyć podświetlone słowa kluczowe i klikalny link. Zmień status z `NEW` na `INTERESTED`, przejdź do zakładki **Obserwowane** i przetestuj licznik godzin do terminu, przycisk **Sprawdź aktualizacje**, porównanie wersji (**Diff**) oraz tworzenie raportu z wybranych kart.
6. **Automatyzacja, SMTP i Raporty** – w zakładce **SMTP** dodaj serwer pocztowy, w **Automatyzacji** skonfiguruj profil CRON, a w zakładce **Raporty** zaznacz wybrane pobrania, aby pobrać gotowy plik **`raport_przetargi_RRRR-MM-DD_GG-MM.xlsx`** lub wysłać go na wybrane adresy e-mail.

---

## 6. Testy Jednostkowe i Lokalny Build

### Backend (Java 21 / Maven)
```bash
cd backend/java-backend
./mvnw compile
./mvnw test "-Dtest=*ServiceTest"
```
*(Na Windows PowerShell użyj `.\mvnw.cmd` zamiast `./mvnw`).*

### Frontend (React / Vite)
```bash
cd frontend
npm install
npm run build
```

### Worker Python (`ingestion-worker`)
```bash
python -m py_compile ingestion-worker/main.py ingestion-worker/models.py ingestion-worker/scraper.py ingestion-worker/excel_export.py ingestion-worker/email_sender.py
```
