# Wewnętrzny Portal Monitoringu i Selekcji Przetargów

Portal służy do publikowania i obsługi przetargów, składania ofert oraz ich klasyfikowania według reguł i słów kluczowych. Interfejs użytkownika jest po polsku, a nazwy tabel i kolumn PostgreSQL są po angielsku.

## Architektura i uruchomienie

- Java 25 LTS, Spring Boot, Spring Security i Spring Data JPA.
- PostgreSQL 17; dane są przechowywane w wolumenie `postgres_data`.
- Docker Compose uruchamia bazę i aplikację Java. Moduł automatycznego pobierania danych oraz konfiguracja źródeł API zostały usunięte.

Skopiuj `.env.example` do `.env`, ustaw własne hasło bazy i dane administratora, a następnie uruchom:

```powershell
Copy-Item .env.example .env
notepad .env
docker compose up --build
```

Portal jest dostępny pod <http://localhost:8080>. Domyślny port PostgreSQL na hoście to `5433`; port aplikacji to `8080`. Można je zmienić przez `POSTGRES_PORT` i `APP_PORT`. `docker compose down` zatrzymuje usługi, ale zachowuje bazę. `docker compose down -v` usuwa również wolumen i wszystkie dane.

Wymagane zmienne:

- `DB_PASSWORD` — hasło PostgreSQL.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PHONE` — dane tworzonego przy pierwszym uruchomieniu administratora. Hasło musi mieć co najmniej 8 znaków, a telefon dokładnie 9 cyfr.

Hasła kont są zapisywane jako hash BCrypt. Inicjalizator nie zmienia hasła już istniejącego administratora po zmianie `ADMIN_PASSWORD`. Możesz zmienić hasło użytkownika w panelu administracyjnym. Nie zapisuj sekretów z `.env` w repozytorium.

## Konta i uprawnienia

Logowanie: <http://localhost:8080/Logowanie.html>. Użytkownik może zarejestrować konto wykonawcy albo organizatora. Pierwsze konto administratora tworzy się przez konfigurację środowiska; zalogowany administrator może następnie tworzyć konta i nadawać rolę administratora na stronie **Użytkownicy**.

Panel użytkowników jest dostępny pod `/UzytkownicyAdministratora.html`. Administrator może zmieniać role kont, resetować hasła i usuwać konta, które nie są powiązane z przetargami ani ofertami. Roli istniejącego administratora nie można zmienić w panelu.

Jeśli użytkownik nie może się zalogować, może użyć linku kontaktowego na stronie logowania. Administrator weryfikuje tożsamość poza aplikacją i resetuje hasło w panelu.

## Przetargi i klasyfikacja

Organizator publikuje przetarg w panelu **Przetargi i oferty**. Administrator również może publikować przetargi. Dodanie przetargu uruchamia klasyfikację według aktywnych reguł:

- dopasowane frazy poszukiwane sumują punkty;
- znalezienie aktywnej frazy wykluczającej oznacza status `ODRZUCONY`;
- brak dopasowanej frazy poszukiwanej również oznacza `ODRZUCONY`;
- dodatnia punktacja bez frazy wykluczającej oznacza `INTERESUJACY`.

Administrator zarządza regułami w panelu **Panel administratora**. Użytkownicy mogą filtrować przetargi po statusie, dacie utworzenia, punktacji, słowie kluczowym i tekście w tytule, opisie, kategorii lub lokalizacji. Ręczna zmiana statusu jest indywidualna dla zalogowanego użytkownika i nie zmienia statusu pozostałych osób. Historia zmian jest dostępna przy przetargu.

## Baza danych

Schemat PostgreSQL używa angielskich nazw tabel i kolumn: V1 tworzy m.in. `users`, `tenders`, `keywords`, `tender_matched_keywords`, `bids` i `tender_status_history`; V2 dodaje `user_tender_statuses`; V3 tworzy indeks dla filtrowania statusów użytkownika. Nazwy tabel i kolumn są angielskie, natomiast wartości statusów i role pozostają zgodne z aplikacją. Interfejs oraz zachowanie strony pozostają po polsku.

Migracje V1–V3 definiują schemat dla nowej bazy. Ich treść różni się od wcześniejszych wersji, dlatego baza z wcześniejszą historią Flyway może wymagać uzgodnienia sum kontrolnych przed ponownym uruchomieniem. Zrób kopię zapasową i nie usuwaj wolumenu PostgreSQL; nie uruchamiaj `flyway repair` bez sprawdzenia, że istniejący schemat odpowiada nowym migracjom. Nowa instalacja nie wymaga naprawy historii.

## Główne endpointy

| Endpoint | Dostęp | Opis |
|---|---|---|
| `POST /api/users/login` | publiczny | Logowanie |
| `POST /api/users/rejestracja` | publiczny | Rejestracja wykonawcy lub organizatora |
| `GET /api/przetargi` | zalogowany | Lista przetargów z filtrami |
| `POST /api/przetargi` | zalogowany właściciel lub administrator | Publikacja przetargu |
| `PATCH /api/przetargi/{id}/status` | zalogowany | Zmiana własnego statusu przetargu |
| `/api/slowa-kluczowe/**` | administrator | Zarządzanie regułami klasyfikacji |
| `/api/analytics/**` | administrator | Statystyki i skuteczność reguł |
| `/api/users/admin/**` | administrator | Zarządzanie kontami, rolami i hasłami |

Żądania zmieniające stan wymagają tokenu CSRF. API administracyjne wymaga zalogowania z rolą administratora, a inne prywatne endpointy — zalogowania.

## Testy

Testy Java można uruchomić poleceniem:

```powershell
.\mvnw.cmd -B test
```
