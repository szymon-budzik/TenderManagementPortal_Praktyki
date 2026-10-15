# 1. Pobieramy gotowego, czystego Pythona 3.12 (wersja slim jest "lżejsza")
FROM python:3.12-slim

# 2. Ustawiamy główny folder wewnątrz kontenera na /app
WORKDIR /app

# 3. Kopiujemy plik requirements.txt z Twojego komputera do kontenera
COPY requirements.txt .

# 4. Instalujemy biblioteki w kontenerze
RUN pip install --no-cache-dir -r requirements.txt

# 5. Kopiujemy wszystkie pozostałe pliki (Twoje skrypty .py) do kontenera
COPY . .

# 6. Komenda domyślna po uruchomieniu kontenera - np. odpalenie GUI
CMD ["streamlit", "run", "gui_app.py", "--server.port=8501", "--server.address=0.0.0.0"]