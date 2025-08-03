// Popup script for TradingView PiP extension

let isCapturing = false;
let hasSelectedArea = false;

document.addEventListener('DOMContentLoaded', async () => {
  const selectAreaBtn = document.getElementById('selectArea');
  const startCaptureBtn = document.getElementById('startCapture');
  const stopCaptureBtn = document.getElementById('stopCapture');
  const openSettingsBtn = document.getElementById('openSettings');
  const statusDiv = document.getElementById('status');
  
  // Load saved state
  const result = await chrome.storage.local.get(['isCapturing', 'selectedArea']);
  isCapturing = result.isCapturing || false;
  hasSelectedArea = !!result.selectedArea;
  
  updateUI();
  
  selectAreaBtn.addEventListener('click', async () => {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we're on a supported webpage
      if (!tab.url.startsWith('http')) {
        alert('Please navigate to a webpage first!');
        return;
      }
      
      // Check if content script is loaded by trying to send a test message
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      } catch (error) {
        // Content script not loaded, inject both script and CSS
        try {
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content.css']
          });
          
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          
          // Wait a moment for the script to load
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (injectionError) {
          console.error('Failed to inject content script:', injectionError);
          throw new Error('Failed to inject content script. Please refresh the page and try again.');
        }
      }
      
      // Inject area selection tool into the page
      await chrome.tabs.sendMessage(tab.id, { action: 'showAreaSelector' });
      
      // Close popup to let user select area
      window.close();
    } catch (error) {
      console.error('Error starting area selection:', error);
      alert('Please refresh the TradingView page and try again.');
    }
  });
  
  startCaptureBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we're on a supported webpage
      if (!tab.url.startsWith('http')) {
        alert('Please navigate to a webpage first!');
        return;
      }
      
      // Get selected area if available
      const result = await chrome.storage.local.get(['selectedArea']);
      
      // Set flag to auto-start preview when settings page opens
      await chrome.storage.local.set({ 
        selectedArea: result.selectedArea || null, // Use area if available, null for full window
        autoStartPreview: true,
        autoStartPiP: true, // Auto-start PiP for both flows
        isCapturing: true
      });
      
      // Update UI to show capturing state
      isCapturing = true;
      updateUI();
      
      // Open settings page which will auto-start preview
      chrome.runtime.openOptionsPage();
      
      window.close();
    } catch (error) {
      console.error('Error starting capture:', error);
      alert('Failed to start capture. Please try again.');
    }
  });
  
  stopCaptureBtn.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'stopCapture' });
      
      isCapturing = false;
      await chrome.storage.local.set({ isCapturing: false });
      updateUI();
    } catch (error) {
      console.error('Error stopping capture:', error);
    }
  });
  
  openSettingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  function updateUI() {
    if (isCapturing) {
      statusDiv.textContent = 'Picture-in-Picture active';
      statusDiv.className = 'status active';
      startCaptureBtn.disabled = true;
      stopCaptureBtn.disabled = false;
      selectAreaBtn.disabled = true;
    } else {
      statusDiv.textContent = hasSelectedArea ? 'Area selected - ready for PiP' : 'Ready to start PiP';
      statusDiv.className = 'status inactive';
      startCaptureBtn.disabled = false; // Always enabled now
      stopCaptureBtn.disabled = true;
      selectAreaBtn.disabled = false;
    }
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'areaSelected') {
    hasSelectedArea = true;
    updateUI();
  }
});

// Listen for storage changes to update UI when capture state changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.isCapturing) {
    isCapturing = changes.isCapturing.newValue || false;
    updateUI();
  }
});