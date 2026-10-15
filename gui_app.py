import streamlit as st
import pandas as pd
from sqlalchemy import create_engine, text

# ==========================================
# POŁĄCZENIE Z BAZĄ DANYCH
# ==========================================
DB_URL = "postgresql+psycopg2://admin:rootpassword@db:5432/przetargi_db"
engine = create_engine(DB_URL)

# Szybka funkcja do utworzenia tabel, jeśli jeszcze nie istnieją
def init_db():
    with engine.connect() as conn:
        # Tabela 1: Słowa kluczowe
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS keywords (
                id SERIAL PRIMARY KEY,
                word VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL
            )
        """))
        
        # Tabela 2: Endpointy (NOWOŚĆ)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS endpoints (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                url TEXT NOT NULL,
                type VARCHAR(100) NOT NULL,
                status VARCHAR(50) DEFAULT 'Aktywny'
            )
        """))
        conn.commit()

init_db()

# ==========================================
# KONFIGURACJA STRONY I NAWIGACJA
# ==========================================
st.set_page_config(page_title="Portal Przetargowy", page_icon="📊", layout="wide")

st.sidebar.title("Menu Administratora")
st.sidebar.write("Wybierz moduł:")
zakladka = st.sidebar.radio(
    "Przejdź do:", 
    ["Panel Statystyk (Dashboard)", "Zarządzanie Słowami Kluczowymi", "Konfiguracja Endpointów"]
)

# ==========================================
# WIDOK 1: ZARZĄDZANIE SŁOWAMI KLUCZOWYMI
# ==========================================
if zakladka == "Zarządzanie Słowami Kluczowymi":
    st.header("Zarządzanie Słowami Kluczowymi")
    
    with st.form("formularz_slow_kluczowych"):
        nowe_slowo = st.text_input("Wpisz słowo kluczowe (np. Python, audyt)")
        kategoria = st.selectbox("Wybierz kategorię:", ["Pożądane", "Wykluczające"])
        zapisz_btn = st.form_submit_button("Dodaj słowo do bazy")
        
        if zapisz_btn:
            if nowe_slowo:
                with engine.connect() as conn:
                    conn.execute(
                        text("INSERT INTO keywords (word, category) VALUES (:w, :c)"), 
                        {"w": nowe_slowo, "c": kategoria}
                    )
                    conn.commit()
                st.success(f"Sukces! Zapisano '{nowe_slowo}' w bazie danych.")
            else:
                st.error("Błąd: Pole nie może być puste!")
                
    st.divider()
    
    st.subheader("Zapisane słowa kluczowe w bazie")
    with engine.connect() as conn:
        dane_z_bazy = pd.read_sql("SELECT * FROM keywords", conn)
        if not dane_z_bazy.empty:
            st.dataframe(dane_z_bazy, hide_index=True, use_container_width=True)
        else:
            st.info("Baza jest na razie pusta.")

# ==========================================
# WIDOK 2: KONFIGURACJA ENDPOINTÓW API (TERAZ Z BAZĄ)
# ==========================================
elif zakladka == "Konfiguracja Endpointów":
    st.header("Zarządzanie Źródłami Danych (API)")
    st.write("Dodawaj i edytuj adresy, z których system automatycznie pobiera przetargi.")
    
    with st.form("formularz_endpointow"):
        nazwa = st.text_input("Nazwa źródła (np. Baza Konkurencyjności)")
        adres_url = st.text_input("Adres URL (Endpoint API lub link do strony)")
        typ_zrodla = st.selectbox(
            "Typ pobierania / Format danych", 
            ["API (struktura JSON)", "Web Scraping (struktura HTML)"]
        )
        
        zapisz_btn = st.form_submit_button("Zapisz do bazy")
        
        if zapisz_btn:
            if nazwa and adres_url:
                # Zapis do PostgreSQL
                with engine.connect() as conn:
                    conn.execute(
                        text("INSERT INTO endpoints (name, url, type) VALUES (:n, :u, :t)"), 
                        {"n": nazwa, "u": adres_url, "t": typ_zrodla}
                    )
                    conn.commit()
                st.success(f"Dodano źródło '{nazwa}'. Skrypt uwzględni je w kolejnym cyklu pobierania!")
            else:
                st.error("Błąd: Nazwa i Adres URL są wymagane!")
                
    st.divider()
    
    # Odczyt endpointów z bazy
    st.subheader("Zapisane endpointy w bazie")
    with engine.connect() as conn:
        dane_endpointy = pd.read_sql("SELECT * FROM endpoints", conn)
        if not dane_endpointy.empty:
            st.dataframe(dane_endpointy, hide_index=True, use_container_width=True)
        else:
            st.info("Brak zapisanych źródeł danych. Dodaj pierwsze używając formularza wyżej.")

# ==========================================
# WIDOK 3: DASHBOARD ANALITYCZNY
# ==========================================
elif zakladka == "Panel Statystyk (Dashboard)":
    st.header("Dashboard Analityczny lejka przetargowego")
    st.write("Wizualizacja skuteczności algorytmu klasyfikującego.")
    # Tutaj możesz wkleić swój kod z wykresami analitycznymi (col1, col2 itd.), który zrobiliśmy wczoraj!