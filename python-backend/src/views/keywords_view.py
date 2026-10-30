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
            help="Słowo wykluczające odrzuca ogłoszenie bezwzględnie (punktacja wynosi 0 pkt)."
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
                if is_excluded:
                    st.text_input("Punkty wagi", value="0 pkt (Wykluczenie)", disabled=True)
                    score_input = 0
                else:
                    score_input = st.slider(
                        "Waga punktowa (1–100):",
                        min_value=1,
                        max_value=100,
                        value=25,
                        step=1,
                        help="Większa wartość podnosi scoring przetargów zawierających tę frazę."
                    )

            submitted = st.form_submit_button("Zapisz regułę")
            if submitted:
                if not word_input.strip():
                    st.error("Pole frazy nie może być puste.")
                else:
                    final_score = 0 if is_excluded else int(score_input)
                    success = add_keyword(word_input, category_input, final_score, kw_type_input)
                    if success:
                        st.success(f"Dodano słowo [{kw_type_input}]: '{word_input}' ({final_score} pkt)")
                        st.rerun()
                    else:
                        st.warning(f"Słowo '{word_input}' tego typu już istnieje w bazie danych.")

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
            view_df[["id", "type", "word", "category", "score"]],
            column_config={
                "id": st.column_config.TextColumn("ID", width="small"),
                "type": st.column_config.TextColumn("Typ"),
                "word": st.column_config.TextColumn("Fraza"),
                "category": st.column_config.TextColumn("Kategoria"),
                "score": st.column_config.NumberColumn("Punkty (1–100)", format="%d pkt")
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
        f"[{k.get('type', 'Pożądane')}] {k['word']} ({k.get('score', 0)} pkt)": k for k in keywords
    }
    options_labels = list(keyword_options.keys())

    # Domyślny wybór pierwszej pozycji lub ostatnio wybranej
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
    item_id = str(selected_item["id"])

    col_edit, col_del = st.columns([1, 1])

    with col_edit:
        with st.popover("✏️ Edytuj wybraną pozycję"):
            edit_type = st.radio(
                "Typ",
                ["Pożądane", "Wykluczające"],
                index=0 if selected_item.get("type") == "Pożądane" else 1,
                key=f"edit_type_{item_id}"
            )
            is_edit_excluded = (edit_type == "Wykluczające")

            e_word = st.text_input("Fraza", value=selected_item["word"], key=f"edit_word_{item_id}")
            e_cat = st.text_input("Kategoria", value=selected_item.get("category") or "Ogólne", key=f"edit_cat_{item_id}")

            current_score = int(selected_item.get("score") or 10)
            if is_edit_excluded:
                st.text_input("Punkty wagi", value="0 pkt (Wykluczenie)", disabled=True, key=f"score_dis_{item_id}")
                e_score = 0
            else:
                e_score = st.slider(
                    "Punkty wagi (1–100)",
                    min_value=1,
                    max_value=100,
                    value=max(1, min(100, current_score)),
                    step=1,
                    key=f"edit_score_{item_id}"
                )

            if st.button("Zapisz zmiany", key=f"save_btn_{item_id}"):
                final_score = 0 if is_edit_excluded else int(e_score)
                success = update_keyword(item_id, e_word, e_cat, final_score, edit_type)
                if success:
                    st.session_state["active_keyword_id"] = item_id
                    st.success("Zaktualizowano regułę!")
                    st.rerun()
                else:
                    st.error("Błąd zapisu zmian w bazie danych.")

    with col_del:
        if st.button(f"🗑️ Usuń '{selected_item['word']}'", type="primary", key=f"del_btn_{item_id}"):
            delete_keyword(item_id)
            if "active_keyword_id" in st.session_state:
                del st.session_state["active_keyword_id"]
            st.rerun()