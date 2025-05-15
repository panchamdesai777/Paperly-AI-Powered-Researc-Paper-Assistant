document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status');
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyButton = document.getElementById('saveApiKey');
  const changeApiKeyButton = document.getElementById('changeApiKey');
  const apiKeyInputContainer = document.getElementById('apiKeyInputContainer');
  const apiKeySavedContainer = document.getElementById('apiKeySavedContainer');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const notesList = document.getElementById('notesList');
  const modelSelect = document.getElementById('model-select');
  let hasInitialized = false;

  console.log('[Init] DOM Content Loaded');
  console.log('[Init] Status div element:', statusDiv);

  // Load saved API key and update UI
  chrome.storage.local.get(['groqapi'], function(result) {
    if (result.groqapi) {
      console.log('API key loaded:', result.groqapi);
      apiKeyInput.value = result.groqapi;
      toggleApiKeyUI(true);
    } else {
      console.log('No API key found');
      toggleApiKeyUI(false);
    }
  });

  // Load extension state
  chrome.storage.local.get(['enabled'], function(result) {
    console.log('Loading extension state from storage:', result);
    if (!hasInitialized) {
      if (result.enabled === undefined) {
        // Set default value in storage to true (enabled)
        chrome.storage.local.set({ enabled: true }, function() {
          console.log('Default enabled flag set to true in storage');
        });
      }
      hasInitialized = true;
    } else {
      console.log('Initialization already done, skipping overwrite.');
    }
  });

  // Load and display notes
  function loadNotes() {
    chrome.storage.local.get(['notes'], function(result) {
      const notes = result.notes || [];
      notesList.innerHTML = '';
      
      if (notes.length === 0) {
        notesList.innerHTML = '<p class="no-notes">No saved notes yet</p>';
        return;
      }

      notes.reverse().forEach((note, index) => {
        const noteElement = document.createElement('div');
        noteElement.className = 'note-item';
        
        const date = new Date(note.timestamp);
        const formattedDate = date.toLocaleString();
        
        noteElement.innerHTML = `
          <div class="note-header">
            <span class="note-date">${formattedDate}</span>
            <button class="delete-note" data-index="${notes.length - 1 - index}" title="Delete note">
              <img src="${chrome.runtime.getURL('icons/trash.png')}" alt="Delete" class="delete-icon">
            </button>
          </div>
          <div class="note-content">${note.text}</div>
          <div class="note-source">
            <a href="${note.url}" target="_blank">${note.title}</a>
          </div>
        `;
        
        notesList.appendChild(noteElement);
      });

      // Add delete functionality
      document.querySelectorAll('.delete-note').forEach(button => {
        button.addEventListener('click', function() {
          const index = parseInt(this.dataset.index);
          deleteNote(index);
        });
      });
    });
  }

  function deleteNote(index) {
    chrome.storage.local.get(['notes'], function(result) {
      const notes = result.notes || [];
      notes.splice(index, 1);
      chrome.storage.local.set({ notes: notes }, function() {
        loadNotes();
        showStatus('Note deleted', 'success');
      });
    });
  }

  // Tab switching functionality
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.dataset.tab;
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      
      // Show corresponding tab content
      tabContents.forEach(content => {
        content.style.display = content.id === `${tabName}-tab` ? 'block' : 'none';
      });

      // Load notes when notes tab is opened
      if (tabName === 'notes') {
        loadNotes();
      }
    });
  });

  // Load saved model and API key
  chrome.storage.local.get(['selectedModel', 'groqapi'], (result) => {
    if (result.selectedModel) {
      modelSelect.value = result.selectedModel;
    }
    if (result.groqapi) {
      apiKeyInput.value = result.groqapi;
    }
  });

  // Save model selection
  modelSelect.addEventListener('change', () => {
    chrome.storage.local.set({ selectedModel: modelSelect.value });
  });

  // Save API key button click handler
  saveApiKeyButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      // Add loading state
      saveApiKeyButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor"/>
          <path d="M12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18C15.31 18 18 15.31 18 12C18 8.69 15.31 6 12 6Z" fill="currentColor"/>
        </svg>
        Saving...
      `;
      saveApiKeyButton.disabled = true;

      // Save to local storage
      chrome.storage.local.set({ 'groqapi': apiKey }, function() {
        console.log('API key saved to local storage');
        
        // Show success state
        saveApiKeyButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="currentColor"/>
          </svg>
          Saved!
        `;
        saveApiKeyButton.style.backgroundColor = '#2e7d32';
        
        // Create and show notification
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="currentColor"/>
          </svg>
          API key saved successfully
        `;
        document.body.appendChild(notification);
        
        // Update UI
        toggleApiKeyUI(true);
        
        // Notify content script about API key update
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'apiKeyUpdated',
            apiKey: apiKey
          });
        });
        
        // Reset button after 2 seconds
        setTimeout(() => {
          saveApiKeyButton.innerHTML = 'Save API Key';
          saveApiKeyButton.style.backgroundColor = '';
          saveApiKeyButton.disabled = false;
          notification.remove();
        }, 2000);
      });
    } else {
      showNotification('Please enter a valid API key', 'error');
    }
  });

  // Change API key
  changeApiKeyButton.addEventListener('click', function() {
    toggleApiKeyUI(false);
    apiKeyInput.value = '';
    apiKeyInput.focus();
  });

  // Function to toggle between input and saved states
  function toggleApiKeyUI(isSaved) {
    if (isSaved) {
      apiKeyInputContainer.style.display = 'none';
      apiKeySavedContainer.style.display = 'block';
    } else {
      apiKeyInputContainer.style.display = 'block';
      apiKeySavedContainer.style.display = 'none';
    }
  }

  function showStatus(message, type) {
    const status = document.createElement('div');
    status.className = `status ${type}`;
    status.textContent = message;
    
    const apiKeySection = document.querySelector('.api-key-section');
    apiKeySection.appendChild(status);
    
    setTimeout(() => {
      status.remove();
    }, 3000);
  }

  // Enhanced notification system
  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${type === 'success' ? 
          '<path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="currentColor"/>' :
          '<path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>'
        }
      </svg>
      ${message}
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}); 