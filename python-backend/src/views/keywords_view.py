import streamlit as st
import pandas as pd
from storage import load_keywords, add_keyword, delete_keyword, update_keyword

def render():
    st.header("Zarządzanie Słowami Kluczowymi i Wykluczeniami")
    st.caption("Definiuj frazy wyszukiwane oraz wykluczające (blacklista) do filtrowania ogłoszeń.")

    # --- Sekcja 1: Dodawanie nowego słowa ---
    with st.expander("➕ Dodaj nowe słowo / regułę", expanded=False):
        kw_type_input = st.radio(
            "Typ reguły",
            ["Pożądane", "Wykluczające"],
            horizontal=True,
            help="Słowo wykluczające odrzuca ogłoszenie bezwzględnie (priorytet nie ma zastosowania)."
        )

        is_excluded = (kw_type_input == "Wykluczające")

        with st.form("add_keyword_form", clear_on_submit=True):
            word_input = st.text_input(
                "Fraza",
                placeholder="np. serwery (dla pożądanych) lub złom, remont (dla wykluczających)"
            )

            col_c, col_p = st.columns([1, 1])
            with col_c:
                category_input = st.text_input("Kategoria", value="IT / Sprzęt")
            with col_p:
                priority_input = st.selectbox(
                    "Priorytet",
                    options=["Niski", "Średni", "Wysoki"] if not is_excluded else ["Brak (Wykluczenie)"],
                    disabled=is_excluded,
                    help="Dla słów wykluczających priorytet jest nieaktywny – reguła działa bezwzględnie."
                )

            submitted = st.form_submit_button("Zapisz regułę")
            if submitted:
                if not word_input.strip():
                    st.error("Pole frazy nie może być puste.")
                else:
                    final_priority = "Brak" if is_excluded else priority_input
                    new_id = add_keyword(word_input, category_input, final_priority, kw_type_input)
                    if new_id is not None:
                        # Automatycznie ustawiamy nowo dodane słowo jako aktywne w sekcji edycji
                        st.session_state["active_keyword_id"] = new_id
                        st.success(f"Dodano słowo [{kw_type_input}]: '{word_input}'")
                        st.rerun()
                    else:
                        st.warning(f"Słowo '{word_input}' tego typu już istnieje na liście.")

    keywords = load_keywords()

    if not keywords:
        st.info("Brak zdefiniowanych słów kluczowych i wykluczających.")
        return

    # Statystyki podręczne
    total_pos = sum(1 for k in keywords if k.get("type") == "Pożądane")
    total_neg = sum(1 for k in keywords if k.get("type") == "Wykluczające")

    col_m1, col_m2 = st.columns(2)
    col_m1.metric("Słowa pożądane (szukane)", total_pos)
    col_m2.metric("Słowa wykluczające (czarna lista)", total_neg)

    # --- Sekcja 2: Zakładki tabelaryczne ---
    tab_all, tab_pos, tab_neg = st.tabs(["Wszystkie", "Słowa Pożądane", "Słowa Wykluczające"])
    df = pd.DataFrame(keywords)

    def display_keyword_table(data_df: pd.DataFrame, tab_prefix: str):
        if data_df.empty:
            st.info("Brak wpisów w tej kategorii.")
            return

        c1, c2 = st.columns(2)
        with c1:
            cats = ["Wszystkie"] + sorted(list(data_df["category"].dropna().unique()))
            selected_cat = st.selectbox("Kategoria:", cats, key=f"{tab_prefix}_cat_select")
        with c2:
            search_query = st.text_input("Szukaj frazy:", key=f"{tab_prefix}_search_input")

        view_df = data_df.copy()
        if selected_cat != "Wszystkie":
            view_df = view_df[view_df["category"] == selected_cat]
        if search_query:
            view_df = view_df[view_df["word"].str.contains(search_query, case=False, na=False)]

        st.dataframe(
            view_df[["id", "type", "word", "category", "priority"]],
            column_config={
                "id": st.column_config.NumberColumn("ID", width="small"),
                "type": st.column_config.TextColumn("Typ"),
                "word": st.column_config.TextColumn("Fraza"),
                "category": st.column_config.TextColumn("Kategoria"),
                "priority": st.column_config.TextColumn("Priorytet")
            },
            use_container_width=True,
            hide_index=True
        )

    with tab_all:
        display_keyword_table(df, tab_prefix="all")

    with tab_pos:
        display_keyword_table(df[df["type"] == "Pożądane"], tab_prefix="pos")

    with tab_neg:
        display_keyword_table(df[df["type"] == "Wykluczające"], tab_prefix="neg")

    # --- Sekcja 3: Modyfikacja i usuwanie ---
    st.divider()
    st.subheader("Operacje na wpisach")

    keyword_options = {
        f"[{k.get('type', 'Pożądane')}] {k['word']} (ID: {k['id']})": k for k in keywords
    }
    options_labels = list(keyword_options.keys())

    # Wyliczamy indeks, aby domyślnie wybrać ostatnio dodaną/edytowaną pozycję
    active_id = st.session_state.get("active_keyword_id", keywords[0]["id"])
    default_idx = 0
    for idx, label in enumerate(options_labels):
        if keyword_options[label]["id"] == active_id:
            default_idx = idx
            break

    selected_label = st.selectbox(
        "Wybierz pozycję do modyfikacji lub usunięcia:",
        options=options_labels,
        index=default_idx
    )
    selected_item = keyword_options[selected_label]
    item_id = selected_item["id"]

    col_edit, col_del = st.columns([1, 1])

    with col_edit:
        with st.popover("✏️ Edytuj wybraną pozycję"):
            # Klucze widgetów są unikalne per ID, dzięki czemu pola nie blokują się na starych wartościach
            edit_type = st.radio(
                "Typ",
                ["Pożądane", "Wykluczające"],
                index=0 if selected_item.get("type") == "Pożądane" else 1,
                key=f"edit_type_{item_id}"
            )
            is_edit_excluded = (edit_type == "Wykluczające")

            e_word = st.text_input("Fraza", value=selected_item["word"], key=f"edit_word_{item_id}")
            e_cat = st.text_input("Kategoria", value=selected_item["category"], key=f"edit_cat_{item_id}")
            
            prio_default = selected_item.get("priority", "Średni")
            prio_idx = ["Niski", "Średni", "Wysoki"].index(prio_default) if prio_default in ["Niski", "Średni", "Wysoki"] else 1

            e_prio = st.selectbox(
                "Priorytet",
                options=["Niski", "Średni", "Wysoki"] if not is_edit_excluded else ["Brak (Wykluczenie)"],
                index=prio_idx if not is_edit_excluded else 0,
                disabled=is_edit_excluded,
                key=f"edit_prio_{item_id}"
            )

            if st.button("Zapisz zmiany", key=f"save_btn_{item_id}"):
                final_prio = "Brak" if is_edit_excluded else e_prio
                update_keyword(item_id, e_word, e_cat, final_prio, edit_type)
                st.session_state["active_keyword_id"] = item_id
                st.rerun()

    with col_del:
        if st.button(f"🗑️ Usuń '{selected_item['word']}'", type="primary", key=f"del_btn_{item_id}"):
            delete_keyword(item_id)
            if "active_keyword_id" in st.session_state:
                del st.session_state["active_keyword_id"]
            st.rerun()