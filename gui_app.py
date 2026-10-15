import streamlit as st
import pandas as pd

# ==========================================
# KONFIGURACJA STRONY
# ==========================================
st.set_page_config(page_title="Portal Przetargowy", page_icon="📊", layout="wide")

st.sidebar.title("Menu Administratora")
st.sidebar.write("Wybierz moduł do zarządzania:")

zakladka = st.sidebar.radio(
    "Przejdź do:", 
    ["Panel Statystyk (Dashboard)", "Zarządzanie Słowami Kluczowymi", "Konfiguracja Endpointów"]
)

# ==========================================
# WIDOK 1: ZARZĄDZANIE SŁOWAMI KLUCZOWYMI
# ==========================================
if zakladka == "Zarządzanie Słowami Kluczowymi":
    st.header("Zarządzanie Słowami Kluczowymi")
    st.write("Dodawaj i kategoryzuj tagi, które sterują algorytmem dopasowania przetargów.")
    
    # Tworzymy formularz do wprowadzania danych
    with st.form("formularz_slow_kluczowych"):
        nowe_slowo = st.text_input("Wpisz słowo kluczowe (np. Java, Python, audyt, OTRS)")
        
        # Lista rozwijana do kategoryzowania tagów
        kategoria = st.selectbox(
            "Wybierz kategorię / wpływ na algorytm:", 
            ["Pożądane (zwiększa punktację)", "Wykluczające (automatycznie odrzuca)"]
        )
        
        # Przycisk zatwierdzający formularz
        zapisz_btn = st.form_submit_button("Dodaj słowo do bazy")
        
        # Akcja po kliknięciu przycisku
        if zapisz_btn:
            if nowe_slowo:
                st.success(f"Sukces! Dodano '{nowe_slowo}' do kategorii: {kategoria}.")
                # Tutaj w przyszłości dodasz kod zapisujący to słowo do bazy PostgreSQL
            else:
                st.error("Błąd: Pole ze słowem kluczowym nie może być puste!")

# ==========================================
# WIDOK 2: KONFIGURACJA ENDPOINTÓW API (ZAKTUALIZOWANY)
# ==========================================
elif zakladka == "Konfiguracja Endpointów":
    st.header("Zarządzanie Źródłami Danych (API)")
    st.write("Dodawaj i edytuj adresy, z których system automatycznie pobiera przetargi.")
    
    # Wyświetlamy symulowaną tabelę z już istniejącymi adresami
    st.subheader("Zapisane endpointy")
    aktualne_adresy = pd.DataFrame({
        "Nazwa źródła": ["dane.gov.pl", "Platforma e-Zamówienia"],
        "Adres URL": ["https://api.dane.gov.pl/1.4/datasets", "https://ezamowienia.gov.pl/mo-board/api/v1/Board/Search"],
        "Typ": ["API (JSON)", "API (JSON)"],
        "Status": ["Aktywny", "Aktywny"]
    })
    # Wbudowana tabela Streamlit
    st.dataframe(aktualne_adresy, use_container_width=True)
    
    st.divider()
    
    # Formularz do dodawania nowego źródła[cite: 2, 6]
    st.subheader("Dodaj nowe źródło")
    with st.form("formularz_endpointow"):
        nazwa = st.text_input("Nazwa źródła (np. Baza Konkurencyjności)")
        adres_url = st.text_input("Adres URL (Endpoint API lub link do strony)")
        typ_zrodla = st.selectbox(
            "Typ pobierania / Format danych", 
            ["API (struktura JSON)", "Web Scraping (struktura HTML)"]
        )
        
        # Przycisk zatwierdzający
        zapisz_btn = st.form_submit_button("Zapisz do bazy")
        
        if zapisz_btn:
            if nazwa and adres_url:
                st.success(f"Dodano źródło '{nazwa}'. Skrypt uwzględni je w kolejnym cyklu pobierania!")
                # Docelowo tu będzie kod zapisujący wiersz do bazy PostgreSQL
            else:
                st.error("Błąd: Nazwa i Adres URL są wymagane!")

# ==========================================
# WIDOK 3: DASHBOARD ANALITYCZNY (ZAKTUALIZOWANY)
# ==========================================
elif zakladka == "Panel Statystyk (Dashboard)":
    st.header("Dashboard Analityczny lejka przetargowego")
    st.write("Wizualizacja statystyk i skuteczności algorytmu klasyfikującego.")
    
    # 1. Kafelki ze statystykami liczbowymi (wymóg z dokumentacji)
    col1, col2, col3 = st.columns(3)
    col1.metric(label="Całkowita liczba znalezionych", value="1 204", delta="120 w tym tygodniu")
    col2.metric(label="Interesujące (Zakwalifikowane)", value="45", delta="5 nowych")
    col3.metric(label="Odrzucone automatycznie", value="1 159", delta="-10", delta_color="inverse")
    
    st.divider() # Wizualna linia oddzielająca
    
    # 2. Wykresy analityczne
    col_wykres1, col_wykres2 = st.columns(2)
    
    with col_wykres1:
        st.subheader("Skuteczność słów kluczowych")
        st.write("Liczba dopasowań dla aktywnych tagów w tym miesiącu:")
        
        # Tworzymy symulowaną strukturę danych (DataFrame) do wykresu
        dane_slowa = pd.DataFrame({
            "Słowo kluczowe": ["Java", "Python", "PostgreSQL", "Docker", "Audyt IT"],
            "Liczba dopasowań": [34, 28, 22, 15, 8]
        }).set_index("Słowo kluczowe")
        
        # Renderowanie natywnego wykresu słupkowego Streamlit
        st.bar_chart(dane_slowa)
        
    with col_wykres2:
        st.subheader("Proporcje statusów")
        st.write("Zestawienie przetargów odrzuconych do procesowanych:")
        
        dane_statusy = pd.DataFrame({
            "Status": ["Odrzucone", "Interesujące", "Do weryfikacji"],
            "Liczba przetargów": [1159, 45, 12]
        }).set_index("Status")
        
        st.bar_chart(dane_statusy, color="#ff4b4b") # Zmiana koloru słupków na czerwony