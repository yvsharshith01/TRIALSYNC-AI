import streamlit as st
import requests
from utils import ui, auth

# Native project setup: renders dark sidebar, logo, user profile, and patient viewer
ui.set_page("Doctor Copilot")
auth.require_role("doctor")

ui.page_header(
    "message-square", 
    "Doctor AI Copilot", 
    "Ask questions about trial eligibility, patient metrics, or protocol details.", 
    eyebrow="Step 10 · Copilot"
)

selected_patient = st.session_state.get("selected_patient", {})
patient_name = selected_patient.get("name", "Jane Doe")
patient_id = selected_patient.get("id", "P-101")

if "copilot_messages" not in st.session_state or st.session_state.get("copilot_patient_id") != patient_id:
    st.session_state.copilot_patient_id = patient_id
    st.session_state.copilot_messages = [
        {
            "role": "assistant",
            "content": f"Hello Doctor! I am your AI Copilot for **{patient_name}** (`{patient_id}`). How can I assist you with this trial today?"
        }
    ]

for msg in st.session_state.copilot_messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

if prompt := st.chat_input("Ask about eligibility, protocols, or adherence..."):
    st.session_state.copilot_messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Analyzing protocol & patient record..."):
            try:
                res = requests.post(
                    "http://localhost:3001/ask_copilot",
                    json={"prompt": prompt, "patientId": patient_id},
                    timeout=15
                )
                if res.status_code == 200:
                    data = res.json()
                    reply = data.get("response") or data.get("text") or "Analysis complete."
                else:
                    reply = " Server error while generating response."
            except Exception as e:
                reply = f" Connection error: {e}"

            st.markdown(reply)
            st.session_state.copilot_messages.append({"role": "assistant", "content": reply})

st.divider()

if st.button("Generate Final Clinical Report →", type="primary"):
    st.switch_page("pages/13_Reports.py")