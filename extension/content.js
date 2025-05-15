// Create and inject the explanation popup
const popup = document.createElement('div');
popup.id = 'explanation-popup';
popup.style.display = 'none';
document.body.appendChild(popup);

// Create and inject the Q&A bot icon
const botIcon = document.createElement('div');
botIcon.id = 'qa-bot-icon';
botIcon.innerHTML = `
  <img src="${chrome.runtime.getURL('icons/book_bot.png')}" alt="Book Bot"/>
`;
document.body.appendChild(botIcon);

// Create and inject the Q&A bot popup
const qaPopup = document.createElement('div');
qaPopup.id = 'qa-bot-popup';
qaPopup.style.display = 'none';
document.body.appendChild(qaPopup);

// Create and inject the explanation icon
const explanationIcon = document.createElement('div');
explanationIcon.id = 'explanation-icon';
explanationIcon.innerHTML = 'Explain';
explanationIcon.style.display = 'none';
document.body.appendChild(explanationIcon);

// Initialize extension state
let currentSelection = null;
let isExtensionEnabled = true;
let apiKey = null;

// Initialize extension state from storage
chrome.storage.local.get(['enabled', 'groqapi'], function(result) {
  console.log('Content script initializing with storage state:', result);
  isExtensionEnabled = result.enabled === undefined ? true : result.enabled;
  apiKey = result.groqapi || null;
  console.log('Extension initialized with state:', isExtensionEnabled);
  console.log('API key loaded:', apiKey ? 'Present' : 'Not set');
  
  // Verify the state is consistent
  chrome.storage.local.get(['enabled'], function(verifyResult) {
    console.log('Content script verifying storage state:', verifyResult);
    if (verifyResult.enabled !== isExtensionEnabled) {
      console.error('Content script state mismatch! Local:', isExtensionEnabled, 'Storage:', verifyResult.enabled);
    }
  });
  
  if (!isExtensionEnabled) {
    console.log('Extension is disabled, hiding UI elements');
    hideExplanationIcon();
    hideExplanationPopup();
    hideQAPopup();
  }
});

// Listen for extension state changes
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'extensionStateChanged') {
    console.log('Received extension state change:', request.enabled);
    isExtensionEnabled = request.enabled;
    
    // Verify the state was updated in storage
    chrome.storage.local.get(['enabled'], function(result) {
      console.log('Content script verifying state change in storage:', result);
      if (result.enabled !== isExtensionEnabled) {
        console.error('State change verification failed! Expected:', isExtensionEnabled, 'Got:', result.enabled);
      }
    });
    
    // Immediately update UI based on new state
    if (!isExtensionEnabled) {
      console.log('Extension disabled, hiding UI elements');
      hideExplanationIcon();
      hideExplanationPopup();
      hideQAPopup();
      
      // Clear any existing selection
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
      
      // Reset state
      currentSelection = null;
    } else {
      console.log('Extension enabled');
    }
  } else if (request.type === 'apiKeyUpdated') {
    console.log('API key updated:', request.apiKey ? 'Present' : 'Not set');
    apiKey = request.apiKey;
  }
});

// Listen for text selection
document.addEventListener('mouseup', function(e) {
  if (!isExtensionEnabled) {
    console.log('Extension is disabled, ignoring text selection');
    return; // Early return if extension is disabled
  }
  
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  console.log('Text selection event triggered');
  console.log('Selected text:', selectedText);
  
  if (selectedText && selectedText.length > 0) {
    currentSelection = {
      text: selectedText,
      range: selection.getRangeAt(0)
    };
    console.log('currentSelection updated:', currentSelection);
    showExplanationIcon(e.clientX, e.clientY);
  } else {
    console.log('No text selected or empty selection');
    hideExplanationIcon();
  }
});

// Handle clicks outside the icon
document.addEventListener('mousedown', function(e) {
  if (!explanationIcon.contains(e.target)) {
    hideExplanationIcon();
  }
});

// Handle icon click
explanationIcon.addEventListener('click', function(e) {
  console.log('Explanation icon clicked');
  console.log('Current selection:', currentSelection);
  e.stopPropagation();
  
  if (!isExtensionEnabled) {
    console.log('Extension is disabled');
    return;
  }
  
  // Get latest API key from storage
  chrome.storage.local.get(['groqapi'], function(result) {
    apiKey = result.groqapi || null;
    console.log('Current API key:', apiKey ? 'Present' : 'Not set');
    
    if (!apiKey) {
      console.log('API key is not set');
      return;
    }

    // Show the explanation popup and get the explanation
    const rect = explanationIcon.getBoundingClientRect();
    showExplanationPopup(rect.left, rect.top);
  });
});

function showExplanationIcon(x, y) {
  explanationIcon.style.left = `${x}px`;
  explanationIcon.style.top = `${y + 20}px`;
  explanationIcon.style.display = 'block';
}

function hideExplanationIcon() {
  explanationIcon.style.display = 'none';
}

// Handle bot icon click
botIcon.addEventListener('click', function(e) {
  e.stopPropagation();
  toggleQAPopup();
});

// Handle clicks outside the Q&A popup
document.addEventListener('mousedown', function(e) {
  if (!qaPopup.contains(e.target) && !botIcon.contains(e.target)) {
    hideQAPopup();
  }
});

function showExplanationPopup(x, y) {
  console.log('showExplanationPopup called with currentSelection:', currentSelection);
  if (!currentSelection || !currentSelection.text) {
    console.error('No text selected. currentSelection:', currentSelection);
    return;
  }

  // Get the selected text's position
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Position the popup relative to the selected text
  popup.style.left = `${rect.left}px`;
  popup.style.top = `${rect.bottom}px`;
  popup.style.display = 'block';
  popup.innerHTML = `
    <div class="explanation-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #f8f9fa; border-bottom: 1px solid rgba(0, 0, 0, 0.05);">
      <div class="drag-handle">Drag to move</div>
      <div class="header-buttons" style="display: flex; gap: 8px; align-items: center; margin-left: auto;">
        <button class="copy-button" title="Copy explanation" style="display: flex; visibility: visible; opacity: 1; background: transparent; border: none; width: 28px; height: 28px; border-radius: 50%; align-items: center; justify-content: center; cursor: pointer; padding: 0; position: static; font-size: 16px;">
          <img src="${chrome.runtime.getURL('icons/copy.png')}" alt="Copy" class="copy-icon">
        </button>
        <button class="close-button" style="background: none; border: none; width: 28px; height: 28px; border-radius: 50%; font-size: 16px; cursor: pointer; color: #666; padding: 0; display: flex; align-items: center; justify-content: center;">×</button>
      </div>
    </div>
    <div class="explanation-content">
      <div class="loading">Loading explanation...</div>
    </div>
  `;
  
  // Add close button functionality
  const closeButton = popup.querySelector('.close-button');
  closeButton.addEventListener('click', hideExplanationPopup);

  // Add copy button functionality
  const copyButton = popup.querySelector('.copy-button');
  copyButton.addEventListener('click', function() {
    navigator.clipboard.writeText(explanation).then(() => {
      copyButton.innerHTML = `<img src="${chrome.runtime.getURL('icons/check.png')}" alt="Copied" class="copy-icon">`;
      copyButton.classList.add('copied');
      
      setTimeout(() => {
        copyButton.innerHTML = `<img src="${chrome.runtime.getURL('icons/copy.png')}" alt="Copy" class="copy-icon">`;
        copyButton.classList.remove('copied');
      }, 2000);
    });
  });

  // Add drag functionality
  const dragHandle = popup.querySelector('.drag-handle');
  let isDragging = false;
  let offsetX, offsetY;

  dragHandle.addEventListener('mousedown', function(e) {
    isDragging = true;
    offsetX = e.clientX - popup.getBoundingClientRect().left;
    offsetY = e.clientY - popup.getBoundingClientRect().top;
    popup.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', function(e) {
    if (isDragging) {
      popup.style.left = `${e.clientX - offsetX}px`;
      popup.style.top = `${e.clientY - offsetY}px`;
    }
  });

  document.addEventListener('mouseup', function() {
    isDragging = false;
    popup.style.cursor = 'default';
  });

  // Get explanation from API
  getExplanation(currentSelection.text);
}

function hideExplanationPopup() {
  popup.style.display = 'none';
}

async function getExplanation(text) {
  try {
    console.log('Getting explanation for text:', text);
    console.log('Current API key:', apiKey);
    
    if (!apiKey) {
      console.error('API key is missing');
      throw new Error('API key not set. Please set your API key in the extension popup.');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('No text selected for explanation');
    }

    console.log('Making API request for text:', text);
    const response = await fetch('http://localhost:8000/explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Groq-Key': apiKey,
        'X-API-Key': '',
        'X-SerpAPI-Key': ''
      },
      body: JSON.stringify({
        level: 'intermediate',
        query: text,
        url: window.location.href
      })
    });

    console.log('API Response status:', response.status);
    const data = await response.json();
    console.log('API Response data:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      throw new Error(`API Error: ${data.error?.message || response.statusText}`);
    }

    if (!data.explanation) {
      throw new Error('No explanation received from API');
    }

    const explanation = data.explanation;
    popup.innerHTML = `
      <div class="explanation-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #f8f9fa; border-bottom: 1px solid rgba(0, 0, 0, 0.05);">
        <div class="drag-handle">Drag to move</div>
        <div class="header-buttons" style="display: flex; gap: 8px; align-items: center; margin-left: auto;">
          <button class="copy-button" title="Copy explanation" style="display: flex; visibility: visible; opacity: 1; background: transparent; border: none; width: 28px; height: 28px; border-radius: 50%; align-items: center; justify-content: center; cursor: pointer; padding: 0; position: static; font-size: 16px;">
            <img src="${chrome.runtime.getURL('icons/copy.png')}" alt="Copy" class="copy-icon">
          </button>
          <button class="close-button" style="background: none; border: none; width: 28px; height: 28px; border-radius: 50%; font-size: 16px; cursor: pointer; color: #666; padding: 0; display: flex; align-items: center; justify-content: center;">×</button>
        </div>
      </div>
      <div class="explanation-content">
        <div class="explanation-text-container">
          <div class="explanation-text">${explanation}</div>
          <button class="text-copy-button" title="Copy explanation">
            <img src="${chrome.runtime.getURL('icons/copy.png')}" alt="Copy" class="copy-icon">
          </button>
        </div>
      </div>
    `;
    
    // Add close button functionality
    const closeButton = popup.querySelector('.close-button');
    closeButton.addEventListener('click', hideExplanationPopup);

    // Add header copy button functionality
    const headerCopyButton = popup.querySelector('.copy-button');
    headerCopyButton.addEventListener('click', function() {
      copyText(explanation, headerCopyButton);
    });

    // Add text box copy button functionality
    const textCopyButton = popup.querySelector('.text-copy-button');
    textCopyButton.addEventListener('click', function() {
      copyText(explanation, textCopyButton);
    });

    // Add drag functionality
    const dragHandle = popup.querySelector('.drag-handle');
    let isDragging = false;
    let offsetX, offsetY;

    dragHandle.addEventListener('mousedown', function(e) {
      isDragging = true;
      offsetX = e.clientX - popup.getBoundingClientRect().left;
      offsetY = e.clientY - popup.getBoundingClientRect().top;
      popup.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', function(e) {
      if (isDragging) {
        popup.style.left = `${e.clientX - offsetX}px`;
        popup.style.top = `${e.clientY - offsetY}px`;
      }
    });

    document.addEventListener('mouseup', function() {
      isDragging = false;
      popup.style.cursor = 'default';
    });
  } catch (error) {
    console.error('Error getting explanation:', error);
    popup.innerHTML = `
      <div class="explanation-content">
        <div class="error-message">Failed to get explanation. Error: ${error.message}</div>
        <button class="close-button">×</button>
      </div>
    `;
  }
}

function copyText(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    button.innerHTML = `<img src="${chrome.runtime.getURL('icons/check.png')}" alt="Copied" class="copy-icon">`;
    button.classList.add('copied');
    
    setTimeout(() => {
      button.innerHTML = `<img src="${chrome.runtime.getURL('icons/copy.png')}" alt="Copy" class="copy-icon">`;
      button.classList.remove('copied');
    }, 2000);
  });
}

function toggleQAPopup() {
  if (qaPopup.style.display === 'none') {
    showQAPopup();
  } else {
    hideQAPopup();
  }
}

function showQAPopup() {
  qaPopup.style.display = 'block';
  qaPopup.innerHTML = `
    <div class="qa-content">
      <div class="qa-header">
        <h3>Research Paper Q&A Bot</h3>
        <button class="close-button">×</button>
      </div>
      <div class="qa-chat">
        <div class="qa-messages"></div>
        <div class="qa-input">
          <input type="text" placeholder="Ask a question about the paper..." />
          <button class="send-button">Send</button>
        </div>
      </div>
    </div>
  `;

  // Add close button functionality
  const closeButton = qaPopup.querySelector('.close-button');
  closeButton.addEventListener('click', hideQAPopup);

  // Add send button functionality
  const sendButton = qaPopup.querySelector('.send-button');
  const inputField = qaPopup.querySelector('input');
  
  function sendMessage() {
    const message = inputField.value.trim();
    if (message) {
      addMessage(message, 'user');
      inputField.value = '';
      getBotResponse(message);
    }
  }

  sendButton.addEventListener('click', sendMessage);
  inputField.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
}

function hideQAPopup() {
  qaPopup.style.display = 'none';
}

function addMessage(text, sender) {
  const messagesDiv = qaPopup.querySelector('.qa-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}-message`;
  
  if (sender === 'bot') {
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container';
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = text;
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'message-buttons';
    
    const saveButton = document.createElement('button');
    saveButton.className = 'save-button';
    saveButton.title = 'Save to notes';
    saveButton.innerHTML = `<img src="${chrome.runtime.getURL('icons/save.png')}" alt="Save" class="save-icon">`;

    saveButton.addEventListener('click', function() {
      saveToNotes(text);
      saveButton.innerHTML = `<img src="${chrome.runtime.getURL('icons/check.png')}" alt="Saved" class="save-icon">`;
      saveButton.classList.add('saved');
      
      setTimeout(() => {
        saveButton.innerHTML = `<img src="${chrome.runtime.getURL('icons/save.png')}" alt="Save" class="save-icon">`;
        saveButton.classList.remove('saved');
      }, 2000);
    });
    
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.title = 'Copy answer';
    copyButton.innerHTML = `<img src="${chrome.runtime.getURL('icons/copy.png')}" alt="Copy" class="copy-icon">`;
    
    copyButton.addEventListener('click', function() {
      navigator.clipboard.writeText(text).then(() => {
        copyButton.innerHTML = `<img src="${chrome.runtime.getURL('icons/check.png')}" alt="Copied" class="copy-icon">`;
        copyButton.classList.add('copied');
        
        setTimeout(() => {
          copyButton.innerHTML = `<img src="${chrome.runtime.getURL('icons/copy.png')}" alt="Copy" class="copy-icon">`;
          copyButton.classList.remove('copied');
        }, 2000);
      });
    });

    
    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(saveButton);
    messageContainer.appendChild(messageText);
    messageContainer.appendChild(buttonContainer);
    messageDiv.appendChild(messageContainer);
  } else {
    messageDiv.textContent = text;
  }
  
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function getBotResponse(question) {
  try {
    if (!apiKey) {
      throw new Error('API key not set. Please set your API key in the extension popup.');
    }

    addMessage('Thinking...', 'bot');
    
    const url = window.location.href;
    const title = document.title;

    console.log('Making API request to /query endpoint with:', {
      query: question,
      url: url,
      level: 'intermediate',
      title: title
    });

    const response = await fetch('http://localhost:8000/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Groq-Key': apiKey,
        'X-API-Key': '',
        'X-SerpAPI-Key': ''
      },
      body: JSON.stringify({
        query: question,
        url: url,
        level: 'intermediate',
        title: title
      })
    });

    console.log('API Response status:', response.status);
    const data = await response.json();
    console.log('API Response data:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      throw new Error(`API Error: ${data.error?.message || response.statusText}`);
    }

    // Remove "Thinking..." message
    const messagesDiv = qaPopup.querySelector('.qa-messages');
    messagesDiv.removeChild(messagesDiv.lastChild);
    
    // Add the response to the chat using the 'answer' key
    addMessage(data.answer || 'Sorry, I couldn\'t get a response. Please try again.', 'bot');
  } catch (error) {
    console.error('Error getting bot response:', error);
    const messagesDiv = qaPopup.querySelector('.qa-messages');
    messagesDiv.removeChild(messagesDiv.lastChild); // Remove "Thinking..." message
    addMessage('Sorry, I encountered an error while processing your question. Please try again.', 'bot');
  }
}

async function saveToNotes(text) {
  try {
    // Get existing notes from storage
    const result = await chrome.storage.local.get(['notes']);
    const notes = result.notes || [];
    
    // Add new note with timestamp
    const newNote = {
      text: text,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      title: document.title
    };
    
    notes.push(newNote);
    
    // Save updated notes
    await chrome.storage.local.set({ notes: notes });
    
    // Show success notification
    showStatus('Note saved successfully!', 'success');
  } catch (error) {
    console.error('Error saving note:', error);
    showStatus('Failed to save note', 'error');
  }
}

// Function to extract and log website text content
function extractAndLogWebsiteText() {
  // Get all text content from the body, excluding script and style elements
  const textContent = document.body.innerText;
}

// Call the function when the content script loads
extractAndLogWebsiteText(); 