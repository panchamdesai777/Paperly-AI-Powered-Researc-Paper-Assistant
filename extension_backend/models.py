from pydantic import BaseModel
from typing import Optional

class QueryRequest(BaseModel):
    level: Optional[str] = None        # "beginner", "intermediate", or "advanced"
    query: str           # The user's question or prompt
    title: Optional[str] = None   # Research paper title (optional)
    url: str     # URL of the paper (optional)

class ExplainRequest(BaseModel):
    query: str           # The user's question or prompt
    url: str     # URL of the paper (optional)
    level: Optional[str] = None         # "beginner", "intermediate", or "advanced"


class Settings(BaseModel):
    x_api_key: str      # Internal auth key
    groq_key: str       # Groq API key
    serpapi_key: str    # SerpAPI key 