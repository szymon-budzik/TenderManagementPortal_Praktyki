import streamlit as st
import pandas as pd
from storage import (
    load_endpoints, add_endpoint, delete_endpoint, 
    update_endpoint, load_keywords, append_tenders_to_history
)
from api_client import test_connection, fetch_latest_items
from matcher import evaluate_items
from scheduler import scheduler_instance


@st.fragment(run_every="1s")
def render_scheduler_controls():
    """Fragment odświeżany co sekundę — zapewnia płynny live countdown bez przeładowania całej strony."""
    status = scheduler_instance.get_status()
    is_running = status["is_running"]

    col_btn, col_interval, col_timer, col_last = st.columns([1.5, 1.5, 1.5, 2])

    with col_btn:
        if not is_running:
            if st.button("▶️ Włącz automatyczne pobieranie", type="primary", use_container_width=True):
                interval = st.session_state.get("scheduler_interval_val", 5)
                scheduler_instance.start(interval)
                st.rerun()
        else:
            if st.button("⏹️ Zatrzymaj scheduler", type="secondary", use_container_width=True):
                scheduler_instance.stop()
                st.rerun()

    with col_interval:
        interval_val = st.number_input(
            "Częstotliwość (minuty)",
            min_value=1,
            max_value=120,
            value=status["interval_minutes"],
            step=1,
            disabled=is_running,
            key="scheduler_interval_input"
        )
        st.session_state["scheduler_interval_val"] = interval_val

    with col_timer:
        if is_running:
            st.metric("Następny skan za", f"⏱️ {status['countdown_formatted']}")
        else:
            st.metric("Status skanera", "⏸️ Wstrzymany")

    with col_last:
        st.write(f"**Ostatni cykl:** `{status['last_run']}`")
        if is_running:
            st.caption("🟢 Praca w tle aktywna")
        else:
            st.caption("🔴 Skaner wyłączony")


def render():
    st.header("Zarządzanie Endpointami API i Automatyzacja")

    # --- Sekcja Automatycznego Schedulera (Live) ---
    st.subheader("Harmonogram pobierania (Scheduler)")
    render_scheduler_controls()
    st.divider()

    endpoints = load_endpoints()

    # --- Sekcja: Dodawanie endpointu ---
    with st.expander("➕ Dodaj nowy endpoint", expanded=False):
        with st.form("add_endpoint_form"):
            new_name = st.text_input("Nazwa / Identyfikator")
            new_url = st.text_input("Adres URL API")
            submitted = st.form_submit_button("Zapisz")
            if submitted and new_name and new_url:
                add_endpoint(new_name, new_url)
                st.success(f"Dodano endpoint: {new_name}")
                st.rerun()

    if not endpoints:
        st.info("Brak zdefiniowanych endpointów. Dodaj pierwszy powyżej.")
        return

    # --- Sekcja: Lista i akcje na endpointach ---
    st.subheader("Skonfigurowane źródła")
    
    selected_name = st.selectbox(
        "Wybierz endpoint do testów ręcznych:",
        options=[e["name"] for e in endpoints]
    )
    current_ep = next(e for e in endpoints if e["name"] == selected_name)

    col1, col2, col3 = st.columns([1, 1, 1])

    with col1:
        if st.button("🔌 Testuj połączenie", key=f"test_btn_{current_ep['id']}"):
            success, msg = test_connection(current_ep["url"])
            if success:
                st.success(msg)
            else:
                st.error(msg)

    with col2:
        with st.popover("✏️ Edytuj"):
            # Klucze powiązane z ID endpointu wymuszają odświeżenie formularza po zmianie w selectboxie
            edit_name = st.text_input(
                "Nazwa", 
                value=current_ep["name"], 
                key=f"edit_name_{current_ep['id']}"
            )
            edit_url = st.text_input(
                "URL", 
                value=current_ep["url"], 
                key=f"edit_url_{current_ep['id']}"
            )
            if st.button("Zapisz zmiany", key=f"save_btn_{current_ep['id']}"):
                update_endpoint(current_ep["id"], edit_name, edit_url)
                st.success("Zapisano zmiany!")
                st.rerun()

    with col3:
        if st.button("🗑️ Usuń", type="primary", key=f"del_btn_{current_ep['id']}"):
            delete_endpoint(current_ep["id"])
            st.rerun()

    # --- Sekcja: Ręczny test matchera ---
    st.divider()
    st.subheader(f"Ręczny test na 10 rekordach: {current_ep['name']}")

    keywords = load_keywords()
    if not keywords:
        st.warning("Uwaga: Brak zdefiniowanych słów kluczowych. Przejdź do zakładki 'Słowa Kluczowe', aby dodać reguły.")

    if st.button("🚀 Pobierz 10 ogłoszeń i przetestuj dopasowanie", type="primary", key=f"eval_btn_{current_ep['id']}"):
        with st.spinner("Pobieranie i ewaluacja rekordów..."):
            success, raw_items, msg = fetch_latest_items(current_ep["url"], limit=10)
            
            if not success:
                st.error(msg)
                return
            if not raw_items:
                st.warning("API nie zwróciło żadnych rekordów do analizy.")
                return

            evaluated_items = evaluate_items(raw_items, keywords)
            new_saved = append_tenders_to_history(current_ep["name"], evaluated_items)
            if new_saved > 0:
                st.toast(f"Zapisano {new_saved} nowych rekordów do bazy statystyk!", icon="💾")

            matched_count = sum(1 for x in evaluated_items if x["evaluation"]["status"] == "MATCHED")
            neutral_count = sum(1 for x in evaluated_items if x["evaluation"]["status"] == "NEUTRAL")
            rejected_count = sum(1 for x in evaluated_items if x["evaluation"]["status"] == "REJECTED")

            m_col1, m_col2, m_col3 = st.columns(3)
            m_col1.metric("Dopasowane (Trafienia)", matched_count)
            m_col2.metric("Odrzucone (Wykluczone)", rejected_count)
            m_col3.metric("Neutralne (Brak słów)", neutral_count)

            st.write("---")

            for idx, item in enumerate(evaluated_items, 1):
                ev = item["evaluation"]
                status = ev["status"]
                score = ev["score"]
                data = item["data"]

                title = (
                    data.get("orderObject") or 
                    data.get("title") or 
                    data.get("nazwa") or 
                    data.get("przedmiot") or 
                    f"Ogłoszenie #{idx}"
                )

                if status == "MATCHED":
                    header_badge = f"🟢 **DOPASOWANY** (+{score} pkt)"
                elif status == "REJECTED":
                    header_badge = f"🔴 **ODRZUCONY** (wykluczenie: `{ev['rejected_by']}`)"
                else:
                    header_badge = "⚪ **NEUTRALNY** (0 pkt)"

                with st.expander(f"{header_badge} — {title}"):
                    info_col1, info_col2 = st.columns([1, 2])
                    with info_col1:
                        st.markdown("**Wynik matchera:**")
                        st.write(f"- Status: `{status}`")
                        st.write(f"- Scoring: `{score}`")
                        if ev["matched_keywords"]:
                            st.write(f"- Dopasowane słowa: {', '.join(ev['matched_keywords'])}")
                        if ev["matched_categories"]:
                            st.write(f"- Kategorie: {', '.join(ev['matched_categories'])}")
                        if ev["rejected_by"]:
                            st.write(f"- Powód odrzucenia: `{ev['rejected_by']}`")
                    
                    with info_col2:
                        st.markdown("**Surowe dane rekordu z API:**")
                        st.json(data)