# Portal Przetargowy - Moduł Python & Ingestion Engine

W tym repozytorium znajduje się moduł pobierający (Ingestion Engine) oraz panel konfiguracyjny (Streamlit), połączone z bazą PostgreSQL.

## Wymagania
* Zainstalowany i uruchomiony **Docker** oraz **Docker Compose**.

## Jak uruchomić projekt lokalnie
1. Pobierz repozytorium na swój komputer.
2. Otwórz terminal w folderze z projektem.
3. Wpisz komendę:
   `docker compose up -d --build`
4. Środowisko uruchomi 3 kontenery:
   * `db` (PostgreSQL na porcie 5432)
   * `python-app` (Panel Streamlit na porcie 8501)
   * `ingestion-worker` (Skrypt pobierający działający w tle)

## Dostęp do usług
* **Panel Administratora (GUI):** http://localhost:8501
* **Baza danych (np. w DBeaver):** 
  * Host: `localhost`
  * Port: `5432`
  * Baza: `przetargi_db`
  * User: `admin`
  * Hasło: `rootpassword`

## Uwaga dotycząca pierwszego uruchomienia
Po pierwszym odpaleniu kontenerów za pomocą Dockera, należy wejść na stronę `http://localhost:8501`, co automatycznie zainicjuje puste tabele w bazie danych. Następnie należy dodać przez formularz przynajmniej jedno słowo kluczowe oraz źródło API, po czym zrestartować workera komendą:
`docker compose restart ingestion-worker`
