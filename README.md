# Paperly - AI Research Assistant

This project consists of three main components:
1. Chrome Browser Extension (UI)
2. FastAPI Backend
3. Streamlit Web Application

   <img width="1015" alt="image" src="https://github.com/user-attachments/assets/37865a2d-0bc0-4ca2-ac9f-deb61850f008" />
   <img width="1078" alt="image" src="https://github.com/user-attachments/assets/20983f77-4685-4551-8794-9fb6adefd5f4" />
   <img width="1031" alt="image" src="https://github.com/user-attachments/assets/4d76aea0-6982-4464-8817-e253de57bf1b" />
   <img width="1086" alt="image" src="https://github.com/user-attachments/assets/77aa0118-bedb-4edc-9ac2-b88a9dbd8fd7" />


## Project Structure

```
.
├── extension/          # Browser extension UI
├── extension_backend/  # FastAPI backend service
└── web_app/           # Streamlit web interface
```

## Setup Instructions

### Prerequisites
- Python 3.8+
- Pinecone account
- Groq API key

### Environment Variables
Create a `.env` file in the `extension_backend` directory with the following variables:

```env
PINECONE_API_KEY=your_pinecone_api_key
LANGSMITH_API_KEY=your_langsmith_api_key
LANGSMITH_PROJECT=your_project_name
LANGSMITH_ENDPOINT=your_langsmith_endpoint
```

### Backend Setup (extension_backend)

1. Navigate to the backend directory:
```bash
cd extension_backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the FastAPI server:
```bash
python main.py
```

The server will start on http://localhost:8000

### Browser Extension Setup (extension)

Load the extension in your browser:
   - Open Chrome/Edge
   - Go to Extensions (chrome://extensions/)
   - Enable Developer Mode
   - Click "Load unpacked"

### Web Application Setup (web_app)

1. Navigate to the web app directory:
```bash
cd web_app
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the Streamlit app:
```bash
streamlit run app.py
```

The web interface will be available at http://localhost:8501

## Features

- **Browser Extension**:
  - Direct integration with research paper websites
  - Quick access to AI-powered paper analysis
  - Context-aware querying

- **FastAPI Backend**:
  - Handles document processing and indexing
  - Integrates with Pinecone for vector storage
  - Provides RESTful API endpoints for queries and explanations

- **Streamlit Web Interface**:
  - User-friendly interface for paper analysis
  - Comprehensive research paper exploration
  - Detailed explanations and summaries

## API Endpoints

### POST /query
Process a research paper query with AI assistance.

### POST /explain
Get detailed explanations for specific parts of a research paper.

## Security Notes

- API keys should be kept secure and never committed to version control
- Use environment variables for sensitive information
- Implement proper authentication in production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
