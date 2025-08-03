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
      
      if (!tab.url.includes('tradingview.com')) {
        alert('Please navigate to TradingView first!');
        return;
      }
      
      // Check if content script is loaded by trying to send a test message
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      } catch (error) {
        // Content script not loaded, inject it
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        // Wait a moment for the script to load
        await new Promise(resolve => setTimeout(resolve, 100));
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
      
      // Check if we have a selected area
      const result = await chrome.storage.local.get(['selectedArea']);
      
      if (!result.selectedArea) {
        alert('Please select a chart area first!');
        return;
      }
      
      // Save the selected area for use in settings
      await chrome.storage.local.set({ 
        selectedArea: result.selectedArea,
        isCapturing: false // Reset to false since we're not auto-starting
      });
      
      // Set capturing state
      isCapturing = false; // Don't set to true since preview is manual
      updateUI();
      
      // Open settings page
      chrome.runtime.openOptionsPage();
      
      window.close();
    } catch (error) {
      console.error('Error opening settings:', error);
      alert('Failed to open settings. Please try again.');
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
      statusDiv.textContent = 'Capturing active';
      statusDiv.className = 'status active';
      startCaptureBtn.disabled = true;
      stopCaptureBtn.disabled = false;
      selectAreaBtn.disabled = true;
    } else {
      statusDiv.textContent = hasSelectedArea ? 'Area selected - ready to capture' : 'Not capturing';
      statusDiv.className = 'status inactive';
      startCaptureBtn.disabled = !hasSelectedArea;
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