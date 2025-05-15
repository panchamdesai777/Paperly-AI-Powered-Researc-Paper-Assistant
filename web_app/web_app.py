import os
import base64
import streamlit as st
import fitz  # PyMuPDF
import re
from groq import Groq
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from huggingface_hub import login

@st.cache_resource
def load_embedding_model():
    return SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

embedding_model = load_embedding_model()
embedding_dim = 384  # dimension for 'all-MiniLM-L6-v2'

# --- Streamlit App ---
st.set_page_config(page_title="Paperly - Research Paper Assistant", page_icon="🧠")
st.title("📚 Paperly - Research Paper Assistant")
st.write("Upload a research paper in PDF format, store chunks in FAISS, and interact intelligently with Paperly!")

# -------------- USER INPUT SECTION --------------
st.subheader("🔑 Enter your API Keys to proceed")

# Text input for Groq API Key
user_groq_api_key = st.text_input("Enter your GROQ API Key:", type="password")

# Text input for HuggingFace Token
user_hf_token = st.text_input("Enter your HuggingFace Token:", type="password")

# Check if both API keys entered
if not user_groq_api_key or not user_hf_token:
    st.warning("⚠️ Please enter both GROQ API Key and HuggingFace Token above to unlock functionality.")
    st.stop()

# Initialize clients
client = Groq(api_key=user_groq_api_key)

# Initialize session state
if "index" not in st.session_state:
    st.session_state.index = faiss.IndexFlatL2(embedding_dim)

if "stored_chunks" not in st.session_state:
    st.session_state.stored_chunks = []

if "paper_text" not in st.session_state:
    st.session_state.paper_text = ""

if "messages" not in st.session_state:
    st.session_state.messages = []

if "uploaded_filename" not in st.session_state:
    st.session_state.uploaded_filename = None

# Huggingface login
try:
    login(token=user_hf_token)
except Exception as e:
    st.error(f"Error logging into HuggingFace: {e}")
    st.stop()

uploaded_file = st.file_uploader("Upload your Research Paper (PDF)", type=["pdf"])

# Initialize session state for FAISS index, stored chunks, and paper text
if "index" not in st.session_state:
    st.session_state.index = faiss.IndexFlatL2(embedding_dim)

if "stored_chunks" not in st.session_state:
    st.session_state.stored_chunks = []

if "paper_text" not in st.session_state:
    st.session_state.paper_text = ""


def embed_text(texts):
    """Embeds a list of texts using SentenceTransformer."""
    return embedding_model.encode(texts)

def chunk_text(text, chunk_size=500, overlap=50):
    """Splits text into chunks of fixed size with some overlap."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
    return chunks

def clean_extracted_text(text):
    text = re.sub(r'\n\s*\n', '\n\n', text)
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    text = re.sub(r'-\s+', '', text)
    text = re.sub(r' {2,}', ' ', text)
    return text.strip()

def extract_clean_text_from_pdf(uploaded_file):
    text = ""
    try:
        uploaded_file.seek(0)
        pdf_document = fitz.open(stream=uploaded_file.read(), filetype="pdf")
        for page in pdf_document:
            page_text = page.get_text()
            text += page_text + "\n"
        text = clean_extracted_text(text)
    except Exception as e:
        st.error(f"Error extracting text: {e}")
    return text

def build_faiss_index(paper_text):
    chunks = chunk_text(paper_text)
    embeddings = embed_text(chunks)
    st.session_state.index.add(np.array(embeddings))
    st.session_state.stored_chunks = chunks

def retrieve_top_chunks(user_query, top_k=3):
    query_embedding = embed_text([user_query])
    distances, indices = st.session_state.index.search(np.array(query_embedding), top_k)
    retrieved = [st.session_state.stored_chunks[idx] for idx in indices[0] if idx < len(st.session_state.stored_chunks)]
    return "\n\n".join(retrieved)

def answer_question(user_question):
    context = retrieve_top_chunks(user_question)
    try:
        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[
                {"role": "system", "content": "You are a research assistant. Answer questions based ONLY on the retrieved paper chunks."},
                {"role": "user", "content": f"Relevant Context:\n{context}\n\nQuestion:\n{user_question}"}
            ],
            temperature=0.3,
            max_tokens=300
        )
        return response.choices[0].message.content
    except Exception as e:
        st.error(f"Error during answering: {e}")
        return None

def summarize_paper():
    context = retrieve_top_chunks("Summarize the paper")  # using RAG for summarization too!
    try:
        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[
                {"role": "system", "content": "You are an expert research assistant. Summarize research papers based ONLY on the retrieved chunks."},
                {"role": "user", "content": f"Summarize this research paper:\n{context}"}
            ],
            temperature=0.2,
            max_tokens=500
        )
        return response.choices[0].message.content
    except Exception as e:
        st.error(f"Error during summarization: {e}")
        return None

import tempfile

if uploaded_file is not None:
    # Detect if a new paper was uploaded
    if uploaded_file.name != st.session_state.uploaded_filename:
        st.info("New paper detected! Resetting system...")

        # Reset everything for new paper
        st.session_state.index = faiss.IndexFlatL2(embedding_dim)
        st.session_state.stored_chunks = []
        st.session_state.paper_text = ""
        st.session_state.messages = []
        st.session_state.uploaded_filename = uploaded_file.name

    if st.button("Process Paper"):
        with st.spinner("Extracting and building FAISS index..."):
            paper_text = extract_clean_text_from_pdf(uploaded_file)
            st.session_state.paper_text = paper_text
            build_faiss_index(paper_text)

        st.success("Paper processed and stored successfully!")

if st.session_state.index.ntotal > 0:
    if st.button("Summarize Paper ✨"):
        with st.spinner("Summarizing using Retrieval + Groq..."):
            summary = summarize_paper()
        if summary:
            st.subheader("Summary 📑")
            st.success(summary)


if st.session_state.index.ntotal > 0:
    st.subheader("💬 Chat with the Research Paper")

    # Initialize chat history if not exist
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # Chat input FIRST
    user_question = st.chat_input("Ask a question about the paper...")

    if user_question:
        # Immediately store user's message
        st.session_state.messages.append({"role": "user", "content": user_question})

        with st.spinner("Thinking with Retrieval + Groq..."):
            answer = answer_question(user_question)

        if answer:
            st.session_state.messages.append({"role": "assistant", "content": answer})

    # THEN display all chat history (including new user input)
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])