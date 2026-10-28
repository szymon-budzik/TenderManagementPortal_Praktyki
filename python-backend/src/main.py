import scheduler  # startuje BackgroundScheduler i Trigger Webhook
import streamlit as st
from views import endpoints_view, keywords_view, analytics_view

st.set_page_config(
    page_title="System Zarządzania Ogłoszeniami",
    layout="wide"
)

# Menu boczne z przełączaniem sekcji
st.sidebar.title("Nawigacja")
view_selection = st.sidebar.radio(
    "Wybierz widok:",
    ["Endpointy API", "Słowa Kluczowe", "Statystyki i Analityka"]
)

if view_selection == "Endpointy API":
    endpoints_view.render()
elif view_selection == "Słowa Kluczowe":
    keywords_view.render()
elif view_selection == "Statystyki i Analityka":
    analytics_view.render()