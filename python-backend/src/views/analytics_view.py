import streamlit as st
import pandas as pd
from storage import load_tender_history, clear_tender_history

def render():
    st.header("Statystyki i Analityka Ogłoszeń")
    st.caption("Podsumowanie przeanalizowanych przetargów, skuteczności reguł i rozkładu scoringu.")

    history = load_tender_history()

    if not history:
        st.info("Baza danych statystyk jest pusta. Przejdź do zakładki 'Endpointy API' i przetestuj pobieranie ogłoszeń.")
        return

    df = pd.DataFrame(history)

    # --- Sekcja 1: Kluczowe metryki (KPIs) z poprawnymi kluczami MATCHED / REJECTED ---
    total_tenders = len(df)
    matched_df = df[df["status"] == "MATCHED"]
    rejected_df = df[df["status"] == "REJECTED"]
    neutral_df = df[df["status"] == "NEUTRAL"]

    match_rate = (len(matched_df) / total_tenders) * 100 if total_tenders > 0 else 0
    avg_score = matched_df["score"].mean() if not matched_df.empty else 0

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Wszystkie ogłoszenia", total_tenders)
    col2.metric("Dopasowane", len(matched_df), f"{match_rate:.1f}%")
    col3.metric("Odrzucone (Blacklist)", len(rejected_df))
    col4.metric("Średni score (dopasowane)", f"{avg_score:.1f} pkt")

    st.divider()

    # --- Sekcja 2: Wykresy analityczne ---
    ch_col1, ch_col2 = st.columns(2)

    with ch_col1:
        st.subheader("Rozkład statusów")
        # Mapowanie nazw statusów na polskie dla czytelności wykresu
        status_labels = {
            "MATCHED": "Dopasowane",
            "REJECTED": "Odrzucone",
            "NEUTRAL": "Neutralne"
        }
        status_counts = df["status"].map(status_labels).fillna(df["status"]).value_counts()
        st.bar_chart(status_counts, color="#29b5e8")

    with ch_col2:
        st.subheader("Najczęstsze powody odrzucenia")
        rejections = df[df["rejected_by"].notna() & (df["rejected_by"] != "")]["rejected_by"]
        if not rejections.empty:
            rejection_counts = rejections.value_counts().head(5)
            st.bar_chart(rejection_counts, color="#ff4b4b")
        else:
            st.info("Brak odrzuconych ogłoszeń.")

    st.subheader("Najskuteczniejsze słowa pożądane")
    all_matched_words = []
    for words in df["matched_keywords"]:
        if isinstance(words, list):
            all_matched_words.extend(words)

    if all_matched_words:
        kw_series = pd.Series(all_matched_words).value_counts().head(8)
        st.bar_chart(kw_series, color="#00c0f2")
    else:
        st.info("Brak trafień słów kluczowych do wyświetlenia.")

    st.divider()

    # --- Sekcja 3: Tabela z filtrami i eksportem ---
    st.subheader("Szczegółowy rejestr przeanalizowanych ogłoszeń")

    col_f1, col_f2 = st.columns(2)
    with col_f1:
        endpoint_filter = st.selectbox("Filtruj wg źródła API:", ["Wszystkie"] + list(df["endpoint"].unique()))
    with col_f2:
        status_options = {
            "Wszystkie": "Wszystkie",
            "Dopasowane": "MATCHED",
            "Odrzucone": "REJECTED",
            "Neutralne": "NEUTRAL"
        }
        selected_status_label = st.selectbox("Filtruj wg statusu:", list(status_options.keys()))
        status_filter = status_options[selected_status_label]

    view_df = df.copy()
    if endpoint_filter != "Wszystkie":
        view_df = view_df[view_df["endpoint"] == endpoint_filter]
    if status_filter != "Wszystkie":
        view_df = view_df[view_df["status"] == status_filter]

    # Mapowanie kolumny statusu w tabeli na język polski
    display_df = view_df.copy()
    display_df["status_display"] = display_df["status"].map({
        "MATCHED": "DOPASOWANY",
        "REJECTED": "ODRZUCONY",
        "NEUTRAL": "NEUTRALNY"
    }).fillna(display_df["status"])

    st.dataframe(
        display_df[["scanned_at", "endpoint", "title", "status_display", "score", "matched_keywords", "rejected_by"]],
        column_config={
            "scanned_at": "Data skanu",
            "endpoint": "API",
            "title": "Tytuł ogłoszenia",
            "status_display": "Status",
            "score": "Scoring",
            "matched_keywords": "Dopasowania",
            "rejected_by": "Wykluczone przez"
        },
        use_container_width=True,
        hide_index=True
    )

    # Eksport CSV i czyszczenie
    btn_col1, btn_col2 = st.columns([1, 1])
    with btn_col1:
        csv_data = view_df.to_csv(index=False).encode("utf-8")
        st.download_button(
            label="📥 Pobierz dane jako CSV",
            data=csv_data,
            file_name="analiza_przetargow.csv",
            mime="text/csv"
        )
    with btn_col2:
        if st.button("🗑️ Wyczyść całą historię skanów", type="secondary"):
            clear_tender_history()
            st.rerun()