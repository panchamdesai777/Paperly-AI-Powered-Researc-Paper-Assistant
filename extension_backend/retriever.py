from pinecone import Pinecone
from langchain.embeddings import HuggingFaceEmbeddings
import os
import re
from typing import List, Dict, Tuple

class PineconeRetriever:
    """
    A class for retrieving and reranking documents from a Pinecone vector database.
    Implements semantic search with cross-encoder reranking.
    """

    def __init__(self, embeddings, index_name: str, k: int = 7):
        """
        Initialize the Pinecone retriever with enhanced query processing.
        
        Args:
            index_name (str): Name of the Pinecone index
            k (int): Number of documents to retrieve
        """
        self.index_name = index_name
        self.pinecone_api_key = os.getenv("PINECONE_API_KEY")
        self.pc = Pinecone(api_key=self.pinecone_api_key)
        self.index = self.pc.Index(self.index_name)
        self.k = k

        # Initialize embeddings model with better configuration
        self.embeddings = embeddings

    def is_file_indexed_in_pinecone(self, url: str) -> bool:
        """
        Check if a file with given parameters exists in the Pinecone index.
        
        Args:
            url (str): URL of the file

        Returns:
            bool: True if file is indexed, False otherwise
        """
        try:
            query_response = self.index.query(
                vector=[0] * 768,
                filter={"url": url},
                top_k=1,
                include_metadata=True,
                namespace='ns1'
            )
            return len(query_response.matches) > 0
        except Exception as e:
            print(f"Error checking Pinecone index: {str(e)}")
            return False

    def pinecone_retriever_fn(self, query: str, url: str, k: int) -> str:
        """
        Retrieve relevant documents from Pinecone based on the query.
        """
        try:
            concatenated_text = self.get_relevant_documents(query, url, k)
            return concatenated_text if concatenated_text else "No relevant documents found."
        except Exception as e:
            return f"Error retrieving documents: {str(e)}"

    def get_relevant_documents(self, query: str, url: str, k: int) -> Tuple[List[str], str, List[str]]:
        """
        Get relevant documents with enhanced error handling and logging.
        
        Args:
            query (str): Search query
            url (Optional[str]): URL filter
            
        Returns:
            Tuple[List[str], str, List[str]]: Formatted documents, concatenated text, and chunk IDs
        """
        try:
            print(f"Retrieving top {self.k} documents for query: '{query}'")
            result = self.query_index(query, url, k)
            
            if not result.get('matches'):
                print("No relevant documents found")
                return [], "", []
                
            concatenated_text = self.format_docs(result['matches'])
            return concatenated_text
            
        except Exception as e:
            print(f"Error retrieving documents: {str(e)}")
            return [], "", []
        
    def clean_text(self, text: str) -> str:
        """
        Clean text by removing special characters and extra whitespace.
        
        Args:
            text (str): Text to clean
            
        Returns:
            str: Cleaned text
        """
        text = str(text)
        cleaned_text = re.sub(r"(\\)+n*|[\t\n\r]", '', text)
        cleaned_text = re.sub(r' {2,}', " ", cleaned_text)
        return cleaned_text

    def format_docs(self, documents: List[Dict]) -> Tuple[List[str], List[str]]:
        """
        Format retrieved documents into a clean text format.
        
        Args:
            documents (List[Dict]): List of document dictionaries from Pinecone
            
        Returns:
            Tuple[List[str], List[str]]: Tuple containing:
                - List of formatted document strings
                - List of chunk IDs
        """
        docs = []
        for doc in documents:
            if 'metadata' in doc:
                content = doc['metadata'].get('content', "No content Available")              
            else:
                content = "No content Available"

            cleaned_content = self.clean_text(content)
            docs.append(f"{cleaned_content}")
     

        return docs

    def get_query_vector(self, query: str) -> List[float]:
        """
        Enhanced query vectorization with query expansion.
        
        Args:
            query (str): The search query
            
        Returns:
            List[float]: The query vector
        """
        # Basic query preprocessing
        query = query.lower().strip()
        
        # Generate query vector
        query_vector = self.embeddings.embed_query(query)
        return query_vector

    def query_index(self, query: str, url: str, k: int) -> Dict:
        """
        Enhanced query processing with better filtering and scoring.
        
        Args:
            query (str): Search query
            url (Optional[str]): URL filter
            k (int): Number of documents to retrieve
        Returns:
            Dict: Pinecone query response
        """
        vector = self.get_query_vector(query)
        filter_dict = {}
        
        if url:
            filter_dict['url'] = url
            
        # Enhanced query with better parameters
        response = self.index.query(
            namespace="ns1",
            vector=vector,
            top_k=k,
            include_values=True,
            include_metadata=True,
            filter=filter_dict if filter_dict else None
        )
        return response


# retriever = PineconeRetriever(index_name="paperly", k=5)

# docs = (retriever.pinecone_retriever_fn("what is talked about the English-to-French translation task?",
#                                          "https://arxiv.org/html/1706.03762v7"))
# print(docs)
