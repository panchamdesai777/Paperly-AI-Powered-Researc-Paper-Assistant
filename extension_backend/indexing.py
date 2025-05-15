
from langchain.schema import Document
from typing import List, Dict
from datetime import datetime
from sentence_transformers import SentenceTransformer

from pinecone import Pinecone


class Indexer:
    def __init__(self, embedder: SentenceTransformer, index: Pinecone):
        """
        Initialize the Indexer with required parameters.
        
        Args:
            embedder (SentenceTransformer): The embedding model to use
            index_name (str): Name of the Pinecone index
            cik (str): Company CIK number
            year (int): Year of the filing
            split (str): Dataset split (train/test/validate)
        """
        self.embedder = embedder
        self.index = index



    def get_index_stats(self) -> Dict:
        """
        Get statistics about the Pinecone index.
        
        Returns:
            Dict: Statistics about the index
        """
        try:
            stats = self.index.describe_index(self.index_name)
            return stats
        except Exception as e:
            print(f"Error getting index stats: {str(e)}")
            raise

    def index_documents(self, documents: List[Document], url: str) -> None:
        """
        Index documents into Pinecone.
        
        Args:
            documents (List[Document]): List of Document objects to index
            url (str): URL of the document being indexed
        """
        print("\nIndexing documents into Pinecone...")
        
        try:
            # Get embeddings for all documents
            texts = [doc.page_content for doc in documents]
            embeddings = self.embedder.embed_documents(texts)
            # Convert embeddings to list if they're numpy arrays
            embeddings = [emb.tolist() if hasattr(emb, 'tolist') else emb for emb in embeddings]

            # Prepare vectors for Pinecone
            vectors = []
            for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
                vector = {
                    "id": f"doc_{url}_{doc.metadata.get('chunkIndex', i)}",
                    "values": embedding,
                    "metadata": {
                        **doc.metadata,  # Include all original metadata
                        "content": doc.page_content,
                        "url": url
                    }
                }
                vectors.append(vector)

            # Batch upsert to Pinecone (in smaller batches)
            batch_size = 10
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                try:
                    self.index.upsert(vectors=batch, namespace="ns1")
                except Exception as e:
                    print(f"Error upserting batch: {str(e)}")
                
        except Exception as e:
            print(f"Error indexing documents: {str(e)}")
        print('✅  Completed indexing')
