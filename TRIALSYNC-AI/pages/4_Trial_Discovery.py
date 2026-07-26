import streamlit as st
import pandas as pd
import requests
from utils import ui, auth

# Native project setup
ui.set_page("Trial Discovery")
auth.require_role("doctor")

ui.page_header(
    "search", 
    "Trial Discovery", 
    "Live clinical studies matched to this patient's condition via NIH ClinicalTrials.gov API.", 
    eyebrow="Step 3 · Discovery"
)

# 1. Retrieve patient details from session state across all possible key formats
selected_patient = st.session_state.get("selected_patient", {})
patient_name = selected_patient.get("name") or selected_patient.get("patient_name") or "Selected Patient"

# Dynamically extract condition, looking through all common key names
patient_condition = (
    selected_patient.get("condition") 
    or selected_patient.get("diagnosis")
    or selected_patient.get("disease")
    or selected_patient.get("primary_condition")
    or selected_patient.get("indication")
    or st.session_state.get("current_condition")
    or "Non-Small Cell Lung Cancer (NSCLC)"  # Corrected default requirement
)

# Update search query whenever a new patient is selected from the sidebar/app
if "last_loaded_patient" not in st.session_state or st.session_state.last_loaded_patient != patient_name:
    st.session_state.search_query = patient_condition
    st.session_state.last_loaded_patient = patient_name
    if "current_trials" in st.session_state:
        del st.session_state["current_trials"]

# Interactive search box that updates dynamically with the active patient
search_input = st.text_input(
    f"Search Condition for {patient_name}:", 
    value=st.session_state.search_query,
    key="condition_search_box"
)

# Helper function to fetch trials from the local Express bridge
def fetch_trials(condition_query):
    try:
        res = requests.post(
            "http://localhost:3001/search_clinical_trials",
            json={"condition": condition_query, "limit": 5},
            timeout=10
        )
        if res.status_code == 200:
            data = res.json()
            trials = data.get("trials") or data.get("data") or data.get("result")
            if isinstance(trials, list) and len(trials) > 0:
                return trials
    except Exception as e:
        st.error(f"Error fetching live trials: {e}")
    return []

# Re-fetch trials only if query changes or search state is empty
if "current_trials" not in st.session_state or search_input != st.session_state.search_query:
    st.session_state.search_query = search_input
    with st.spinner(f"Fetching live NIH clinical trials for {search_input}..."):
        st.session_state.current_trials = fetch_trials(search_input)

st.write(f"Showing live trials matching **{st.session_state.search_query}**")

# Display live trial data in table
if st.session_state.current_trials:
    df = pd.DataFrame(st.session_state.current_trials)
    display_cols = [c for c in ["NCT_ID", "Title", "Phase", "Status", "Location", "Eligibility"] if c in df.columns]
    st.dataframe(df[display_cols] if display_cols else df, use_container_width=True)
else:
    st.warning(f"No active live trials found for '{st.session_state.search_query}'. Try refining your search query.")

st.divider()

if st.button("Proceed to Eligibility Check →", type="primary"):
    st.switch_page("pages/5_Eligibility.py")