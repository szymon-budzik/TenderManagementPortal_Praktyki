import streamlit as st
import pandas as pd
from sqlalchemy import create_engine, text

# Konfiguracja strony
st.set_page_config(page_title="Panel Przetargowy", layout="wide")

# Połączenie z bazą danych
DB_URL = "postgresql+psycopg2://admin:rootpassword@db:5432/przetargi_db"
engine = create_engine(DB_URL)

# --- INICJALIZACJA TABEL (Zapobiega błędom po restarcie bazy) ---
def inicjalizuj_tabele_gui():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS keywords (
                id SERIAL PRIMARY KEY,
                word TEXT NOT NULL,
                category TEXT NOT NULL
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS endpoints (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT NOT NULL
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tenders (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                source_name TEXT NOT NULL
            )
        """))
        conn.commit()

inicjalizuj_tabele_gui()
# ---------------------------------------------------------------

def run_query(query, params=None):
    """Funkcja pomocnicza do wykonywania zapytań modyfikujących dane"""
    with engine.connect() as conn:
        conn.execute(text(query), params or {})
        conn.commit()

def fetch_data(query):
    """Funkcja pomocnicza do pobierania danych z bazy jako DataFrame"""
    with engine.connect() as conn:
        return pd.read_sql(text(query), conn)

st.title("📊 Panel Zarządzania Przetargami")

# Tworzenie zakładek
tab1, tab2, tab3, tab4 = st.tabs(["🔑 Słowa kluczowe", "📡 Źródła i API", "📂 Znalezione przetargi", "⚙️ Sterowanie i Logi"])

# ==========================================
# ZAKŁADKA 1: SŁOWA KLUCZOWE
# ==========================================
with tab1:
    st.header("Zarządzanie Słowami Kluczowymi")
    
    # 1. Wyświetlanie aktualnych słów
    df_keywords = fetch_data("SELECT id, word, category FROM keywords ORDER BY id")
    st.dataframe(df_keywords, use_container_width=True, hide_index=True)
    
    col1, col2, col3 = st.columns(3)
    
    # 2. Dodawanie słowa
    with col1:
        st.subheader("Dodaj nowe")
        with st.form("add_keyword_form"):
            new_word = st.text_input("Słowo kluczowe")
            new_category = st.selectbox("Kategoria", ["Pożądane", "Odrzucane", "Inne"])
            if st.form_submit_button("Dodaj"):
                if new_word:
                    run_query("INSERT INTO keywords (word, category) VALUES (:w, :c)", {"w": new_word, "c": new_category})
                    st.success("Dodano!")
                    st.rerun()
                else:
                    st.error("Podaj słowo!")

    # 3. Edycja słowa
    with col2:
        st.subheader("Edytuj istniejące")
        if not df_keywords.empty:
            edit_id = st.selectbox("Wybierz ID do edycji", df_keywords['id'].tolist(), key="edit_kw_id")
            selected_row = df_keywords[df_keywords['id'] == edit_id].iloc[0]
            
            with st.form("edit_keyword_form"):
                edit_word = st.text_input("Słowo kluczowe", value=selected_row['word'])
                categories = ["Pożądane", "Odrzucane", "Inne"]
                idx = categories.index(selected_row['category']) if selected_row['category'] in categories else 0
                edit_category = st.selectbox("Kategoria", categories, index=idx)
                
                if st.form_submit_button("Zapisz zmiany"):
                    run_query("UPDATE keywords SET word = :w, category = :c WHERE id = :id", {"w": edit_word, "c": edit_category, "id": edit_id})
                    st.success("Zaktualizowano!")
                    st.rerun()
        else:
            st.info("Brak danych do edycji.")

    # 4. Usuwanie słowa
    with col3:
        st.subheader("Usuń słowo")
        if not df_keywords.empty:
            with st.form("delete_keyword_form"):
                del_id = st.selectbox("Wybierz ID do usunięcia", df_keywords['id'].tolist(), key="del_kw_id")
                if st.form_submit_button("Usuń", type="primary"):
                    run_query("DELETE FROM keywords WHERE id = :id", {"id": del_id})
                    st.warning("Usunięto!")
                    st.rerun()

# ==========================================
# ZAKŁADKA 2: ŹRÓDŁA I API
# ==========================================
with tab2:
    st.header("Zarządzanie Źródłami")
    
    df_endpoints = fetch_data("SELECT id, name, url, type, status FROM endpoints ORDER BY id")
    st.dataframe(df_endpoints, use_container_width=True, hide_index=True)
    
    col1, col2 = st.columns(2)
    
    # 1. Dodawanie źródła
    with col1:
        st.subheader("Dodaj nowe źródło")
        with st.form("add_endpoint_form"):
            new_name = st.text_input("Nazwa (np. e-Zamówienia)")
            new_url = st.text_input("Adres URL API/Strony")
            new_type = st.selectbox("Typ", ["REST API", "Strona HTML"])
            new_status = st.selectbox("Status", ["Aktywny", "Nieaktywny"])
            
            if st.form_submit_button("Dodaj źródło"):
                if new_name and new_url:
                    run_query(
                        "INSERT INTO endpoints (name, url, type, status) VALUES (:n, :u, :t, :s)", 
                        {"n": new_name, "u": new_url, "t": new_type, "s": new_status}
                    )
                    st.success("Dodano!")
                    st.rerun()
                else:
                    st.error("Uzupełnij nazwę i URL!")

    # 2. Edycja / Usuwanie źródła
    with col2:
        st.subheader("Zarządzaj istniejącym")
        if not df_endpoints.empty:
            action = st.radio("Wybierz akcję:", ["Edytuj", "Usuń"])
            selected_end_id = st.selectbox("Wybierz źródło", df_endpoints['id'].tolist(), format_func=lambda x: f"ID: {x} - {df_endpoints[df_endpoints['id']==x]['name'].iloc[0]}")
            
            if action == "Edytuj":
                row = df_endpoints[df_endpoints['id'] == selected_end_id].iloc[0]
                with st.form("edit_endpoint_form"):
                    edit_name = st.text_input("Nazwa", value=row['name'])
                    edit_url = st.text_input("Adres URL", value=row['url'])
                    types = ["REST API", "Strona HTML"]
                    edit_type = st.selectbox("Typ", types, index=types.index(row['type']) if row['type'] in types else 0)
                    statuses = ["Aktywny", "Nieaktywny"]
                    edit_status = st.selectbox("Status", statuses, index=statuses.index(row['status']) if row['status'] in statuses else 0)
                    
                    if st.form_submit_button("Zapisz zmiany"):
                        run_query(
                            "UPDATE endpoints SET name=:n, url=:u, type=:t, status=:s WHERE id=:id",
                            {"n": edit_name, "u": edit_url, "t": edit_type, "s": edit_status, "id": selected_end_id}
                        )
                        st.success("Zaktualizowano!")
                        st.rerun()
            else:
                with st.form("delete_endpoint_form"):
                    st.write("Czy na pewno chcesz usunąć to źródło?")
                    if st.form_submit_button("Usuń", type="primary"):
                        run_query("DELETE FROM endpoints WHERE id = :id", {"id": selected_end_id})
                        st.warning("Usunięto!")
                        st.rerun()

# ==========================================
# ZAKŁADKA 3: ZNALEZIONE PRZETARGI
# ==========================================
with tab3:
    st.header("Baza Zapisanych Przetargów")
    
    df_tenders = fetch_data("SELECT * FROM tenders ORDER BY id DESC")
    
    if not df_tenders.empty:
        st.metric(label="Łączna liczba znalezionych przetargów", value=len(df_tenders))
        st.dataframe(df_tenders, use_container_width=True, hide_index=True)
        
        with st.expander("Opcje zaawansowane"):
            if st.button("Wyczyść całą historię przetargów", type="primary"):
                run_query("TRUNCATE TABLE tenders")
                st.success("Wyczyszczono historię.")
                st.rerun()
    else:
        st.info("Brak zapisanych przetargów w bazie.")

# ==========================================
# ZAKŁADKA 4: STEROWANIE I LOGI
# ==========================================
with tab4:
    st.header("Sterowanie Silnikiem (Ingestion Worker)")
    
    # Pobieranie aktualnego statusu workera
    try:
        df_settings = fetch_data("SELECT * FROM app_settings WHERE id = 1")
        if not df_settings.empty:
            obecny_status = df_settings.iloc[0]['worker_status']
            obecny_interwal = df_settings.iloc[0]['run_interval']
            ostatni_run = df_settings.iloc[0]['last_run']
        else:
            obecny_status, obecny_interwal, ostatni_run = "stopped", 60, None
    except:
        obecny_status, obecny_interwal, ostatni_run = "Brak bazy", 60, None

    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Ustawienia cyklu")
        st.write(f"**Ostatnie sprawdzenie API:** {ostatni_run if ostatni_run else 'Nigdy'}")
        
        if obecny_status == 'running':
            st.success("🟢 SKRYPT JEST AKTYWNY I PRACUJE W TLE")
        else:
            st.error("🔴 SKRYPT JEST ZATRZYMANY")
            
        c1, c2 = st.columns(2)
        with c1:
            if st.button("▶️ START", use_container_width=True):
                run_query("UPDATE app_settings SET worker_status = 'running' WHERE id = 1")
                run_query("UPDATE app_settings SET last_run = NULL WHERE id = 1")
                st.rerun()
        with c2:
            if st.button("⏹️ STOP", use_container_width=True):
                run_query("UPDATE app_settings SET worker_status = 'stopped' WHERE id = 1")
                st.rerun()

        st.markdown("---")
        with st.form("interval_form"):
            nowy_interwal = st.number_input("Częstotliwość sprawdzania (w minutach)", min_value=1, max_value=1440, value=int(obecny_interwal))
            if st.form_submit_button("Zapisz interwał"):
                run_query("UPDATE app_settings SET run_interval = :i WHERE id = 1", {"i": nowy_interwal})
                st.success("Zapisano częstotliwość!")
                st.rerun()

    with col2:
        st.subheader("Mini-Konsola (Ostatnie zdarzenia)")
        col_konsola_btn, _ = st.columns([1, 2])
        with col_konsola_btn:
            if st.button("🗑️ Wyczyść konsolę"):
                run_query("TRUNCATE TABLE worker_logs")
                st.rerun()
                
        # Pobieranie logów z bazy
        try:
            df_logs = fetch_data("SELECT timestamp, message FROM worker_logs ORDER BY id DESC LIMIT 50")
            if not df_logs.empty:
                log_text = ""
                for index, row in df_logs.iterrows():
                    log_text += f"[{row['timestamp'].strftime('%H:%M:%S')}] {row['message']}\n"
                
                st.text_area("Logi na żywo:", value=log_text, height=300, disabled=True)
                if st.button("🔄 Odśwież logi"):
                    st.rerun()
            else:
                st.info("Brak wpisów w konsoli.")
        except:
             st.warning("Oczekiwanie na uruchomienie Workera...")