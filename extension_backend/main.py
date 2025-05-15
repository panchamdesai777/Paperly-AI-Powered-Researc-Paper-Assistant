# main.py
from fastapi import FastAPI, Header, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Pinecone
from langchain_groq import ChatGroq
from pinecone import Pinecone
from dotenv import load_dotenv
import os
import uvicorn
from models import QueryRequest, Settings
from html_extractor import fetch_html_content
from indexing import Indexer
from agent import ResearchAgent
from chunking import DocumentChunker
from retriever import PineconeRetriever

# Load environment variables
load_dotenv()

# Create FastAPI app instance
title = "FastAPI LLM Agent"
description = (
    "An AI agent using Groq's Gemma model with tools for math solving, summarization, Q&A, "
    "and research paper recommendations via SerpAPI."
)
app = FastAPI(title=title, description=description)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://arxiv.org"],  # Add your frontend origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



os.environ["LANGSMITH_TRACING"] = "true"
os.environ["LANGSMITH_ENDPOINT"] = str(os.getenv("LANGSMITH_ENDPOINT"))  
os.environ["LANGSMITH_API_KEY"] = str(os.getenv("LANGSMITH_API_KEY"))
os.environ["LANGSMITH_PROJECT"] = str(os.getenv("LANGSMITH_PROJECT"))

# Pinecone configuration
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY environment variable is not set")

PINECONE_INDEX_NAME = 'paperly'

# Initialize Pinecone
pc = Pinecone(api_key=PINECONE_API_KEY)

# Initialize embeddings model
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-mpnet-base-v2",
    model_kwargs={"device": "cpu"}
)

# Initialize Pinecone vectorstore
index = pc.Index(PINECONE_INDEX_NAME)
indexer = Indexer(embeddings, index)
chunker = DocumentChunker(embeddings)
retriever = PineconeRetriever(embeddings=embeddings, index_name=PINECONE_INDEX_NAME)

# Print all collection names
print("Available Pinecone collections:")
for index in pc.list_indexes():
    print('Index name:',index.name)



# Dependency to extract all keys from headers
def get_service_keys(
    x_api_key: str = Header(..., alias="X-API-Key"),
    x_groq_key: str = Header(..., alias="X-Groq-Key"),
    x_serpapi_key: str = Header(..., alias="X-SerpAPI-Key"),
) -> Settings:
    return Settings(
        x_api_key=x_api_key,
        groq_key=x_groq_key,
        serpapi_key=x_serpapi_key,
    )



@app.post("/query", summary="Run the AI agent against a user query")
async def query_endpoint(
    body: QueryRequest,
    keys: Settings = Depends(get_service_keys),
):
    """
    Handle user queries at a specified difficulty level, with optional paper context.
    """
    try:
        if body.url:
            if not retriever.is_file_indexed_in_pinecone(body.url):
                print("File is not indexed in Pinecone")
                # Check if URL already exists in the index

                print(f"Fetching content from URL: {body.url}")
                text = fetch_html_content(body.url, body.title)
                print(f"URL {body.url} not found in index, proceeding with indexing...")
                documents = chunker.split_text_into_chunks(text, {
                    "url": body.url,
                    "title": body.title
                })

                indexer.index_documents(documents, body.url)
                print("✅ File indexed in Pinecone")
                
            else:
                print("✅ File already indexed in Pinecone")
            
            research_agent = ResearchAgent(embeddings=embeddings, groq_key=keys.groq_key,retriever=retriever)
                
            # Process the question using the agent
            answer = research_agent.process_question(body.query, body.url, body.title, body.level)
            
            return {"status": "success", "message": "URL processed successfully", "answer": answer}
    except Exception as e:
        print(f"Error in query endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/explain", summary="Get detailed explanation for a query")
async def explain_endpoint(
    body: QueryRequest,
    keys: Settings = Depends(get_service_keys),
):
    """
    Provide a detailed explanation for a user query using RAG (Retrieval-Augmented Generation).
    """
    try:
        print(f"Explaining query: {body.query}")
        if body.url:
            if not retriever.is_file_indexed_in_pinecone(body.url):
                print("File is not indexed in Pinecone")
                # Check if URL already exists in the index

                print(f"Fetching content from URL: {body.url}")
                text = fetch_html_content(body.url, body.title)
                print(f"URL {body.url} not found in index, proceeding with indexing...")
                documents = chunker.split_text_into_chunks(text, {
                    "url": body.url,
                    "title": body.title
                })

                indexer.index_documents(documents, body.url)
                
            else:
                print("✅ File already indexed in Pinecone")
                
        # Retrieve relevant documents from Pinecone
        context = retriever.pinecone_retriever_fn(body.query, body.url, 5)
        
        # Create a prompt template for explanation
        prompt = f"""Based on the following context from the research paper, provide an explanation for this part of the paper: {body.query}

Context:
{context}

Please provide a comprehensive explanation that:
1. Directly addresses the query
2. Uses relevant information from the context
3. Is clear and well-structured
4. Includes examples or analogies where appropriate

Explanation:"""
        
        # Use the research agent to generate the explanation
        llm = ChatGroq(
            groq_api_key=keys.groq_key,
            model_name="llama3-8b-8192"
        )
        explanation = llm.invoke(prompt)
        
        return {
            "status": "success", 
            "message": "Explanation generated successfully", 
            "explanation": explanation.content
        }
    except Exception as e:
        print(f"Error in explain endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Entry point: run via Uvicorn on specified port
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=bool(os.getenv("RELOAD", True)),
        log_level="info"
    )
