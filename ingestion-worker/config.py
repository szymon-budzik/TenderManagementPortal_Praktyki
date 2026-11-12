import os

# Adres backendu w sieci Dockera (lub localhost przy odpalaniu z palca)
BACKEND_URL = os.getenv("BACKEND_URL", "http://java-backend:8080")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "super_tajny_klucz_python_ingestion_2026")

# Częstotliwość odpytywania w sekundach (domyślnie co 60 sekund)
SYNC_INTERVAL_SECONDS = int(os.getenv("SYNC_INTERVAL_SECONDS", "60"))

# Oficjalny endpoint Biuletynu Zamówień Publicznych (ezamowienia.gov.pl)
EZAMOWIENIA_API_URL = "https://ezamowienia.gov.pl/mo-board/api/v1/board/search"