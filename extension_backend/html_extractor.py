import requests
from bs4 import BeautifulSoup
from typing import Optional

def extract_html_text(url: str) -> str:
    """
    Extracts and cleans text content from a webpage.
    
    Args:
        url (str): The URL of the webpage to extract content from
        
    Returns:
        str: Cleaned text content from the webpage
    """
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
            
        # Remove bibliography sections
        for bib in soup.find_all(class_="ltx_bibliography"):
            bib.decompose()
            
        # Get text content
        text = soup.get_text()
        # Break into lines and remove leading and trailing space
        lines = (line.strip() for line in text.splitlines())
        # Break multi-headlines into a line each
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        # Drop blank lines
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        return text
    except Exception as e:
        raise Exception(f"Error extracting content from URL: {str(e)}")

def fetch_html_content(url: str, title: Optional[str] = None) -> str:
    """
    Fetches HTML content from a URL and returns the extracted text.
    
    Args:
        url (str): The URL to fetch content from
        title (Optional[str]): Title of the document
        
    Returns:
        str: Extracted text content
    """
    try:
        text = extract_html_text(url)
        return text
    except Exception as e:
        print(f"Error processing URL: {str(e)}")
        raise 