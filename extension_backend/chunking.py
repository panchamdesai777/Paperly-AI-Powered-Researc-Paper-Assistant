from langchain.schema import Document
from langchain_experimental.text_splitter import SemanticChunker
from typing import List, Dict, Any
from datetime import datetime
import json
import os

class DocumentChunker:
    def __init__(self, embeddings):
        """
        Initialize the DocumentChunker with the embedding model.
        """
        self.embeddings = embeddings
        self.text_splitter = SemanticChunker(
            embeddings=self.embeddings,
            breakpoint_threshold_type="percentile",
            breakpoint_threshold_amount=65
        )

    def save_chunks_to_file(self, documents: List[Document], output_file: str = "chunks.json"):
        """
        Saves the document chunks to a JSON file for review.
        
        Args:
            documents (List[Document]): List of Document objects to save
            output_file (str): Path to the output file
        """
        try:
            # Convert documents to a serializable format
            chunks_data = []
            for doc in documents:
                chunk_data = {
                    "content": doc.page_content,
                    "metadata": doc.metadata
                }
                chunks_data.append(chunk_data)
            
            # Create output directory if it doesn't exist
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            
            # Save to file
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(chunks_data, f, indent=2, ensure_ascii=False)
            
            print(f"Chunks saved to {output_file}")
            
        except Exception as e:
            print(f"Error saving chunks to file: {str(e)}")
            raise

    def split_text_into_chunks(self, text: str, metadata: Dict[str, Any] = None, save_to_file: bool = False, output_file: str = "chunks.json") -> List[Document]:
        """
        Splits text into semantic chunks using LangChain's SemanticChunker and adds metadata.
        
        Args:
            text (str): The text to split
            metadata (Dict[str, Any]): Metadata to add to each chunk
            save_to_file (bool): Whether to save chunks to a file
            output_file (str): Path to save chunks if save_to_file is True
            
        Returns:
            List[Document]: List of Document objects containing the text chunks with metadata
        """
        try:
            texts = self.text_splitter.split_text(text)
            documents = []
            
            for i, text_chunk in enumerate(texts):
                doc_metadata = {
                    "chunkIndex": i,
                    "timestamp": datetime.now().isoformat(),
                    **(metadata or {})
                }
                documents.append(Document(page_content=text_chunk, metadata=doc_metadata))
            
            if save_to_file:
                self.save_chunks_to_file(documents, output_file)
            
            return documents
            
        except Exception as e:
            print(f"Error splitting text: {str(e)}")
            raise 