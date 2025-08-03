// Content script for TradingView PiP extension

let isSelectingArea = false;
let selectionOverlay = null;
let selectedArea = null;

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  switch (message.action) {
    case 'ping':
      // Simple ping to check if content script is loaded
      console.log('Content script ping received');
      sendResponse({ status: 'ok' });
      return true; // Keep message channel open
      break;
    case 'showAreaSelector':
      showAreaSelector();
      break;
    case 'hideAreaSelector':
      hideAreaSelector();
      break;
    case 'showNotification':
      showNotification(message.message);
      break;
    case 'startCaptureForSettings':
      // This is now handled manually in settings page
      showNotification('Please use the settings page to start preview');
      break;
  }
});

function showAreaSelector() {
  if (isSelectingArea) {
    console.log('Area selector already active');
    return;
  }
  
  console.log('Starting area selector');
  isSelectingArea = true;
  createSelectionOverlay();
  addSelectionEvents();
}

function hideAreaSelector() {
  if (!isSelectingArea) return;
  
  isSelectingArea = false;
  removeSelectionOverlay();
  removeSelectionEvents();
}

function createSelectionOverlay() {
  console.log('Creating selection overlay');
  
  // Remove any existing overlay first
  const existingOverlay = document.getElementById('tvpip-selection-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Create overlay container
  selectionOverlay = document.createElement('div');
  selectionOverlay.id = 'tvpip-selection-overlay';
  selectionOverlay.innerHTML = `
    <div id="tvpip-selection-area"></div>
    <div id="tvpip-selection-instructions">
      Click and drag to select the content area you want to capture
      <div id="tvpip-selection-buttons">
        <button id="tvpip-confirm-selection">✓ Confirm</button>
        <button id="tvpip-cancel-selection">✕ Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(selectionOverlay);
  console.log('Selection overlay created and added to page');
  
  // Show instructions initially
  document.getElementById('tvpip-selection-instructions').style.display = 'block';
  
  // Add event listeners for buttons
  document.getElementById('tvpip-confirm-selection').addEventListener('click', confirmSelection);
  document.getElementById('tvpip-cancel-selection').addEventListener('click', cancelSelection);
}

function removeSelectionOverlay() {
  if (selectionOverlay) {
    selectionOverlay.remove();
    selectionOverlay = null;
  }
}

let isDrawing = false;
let startX, startY, endX, endY;

function addSelectionEvents() {
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);
}

function removeSelectionEvents() {
  document.removeEventListener('mousedown', onMouseDown);
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('keydown', onKeyDown);
}

function onMouseDown(e) {
  if (!isSelectingArea || e.target.closest('#tvpip-selection-instructions')) return;
  
  console.log('Mouse down for area selection at:', e.clientX, e.clientY);
  
  // Hide instructions when starting to draw
  document.getElementById('tvpip-selection-instructions').style.display = 'none';
  
  isDrawing = true;
  startX = e.clientX;
  startY = e.clientY;
  
  const selectionArea = document.getElementById('tvpip-selection-area');
  selectionArea.style.display = 'block';
  selectionArea.style.left = startX + 'px';
  selectionArea.style.top = startY + 'px';
  selectionArea.style.width = '0px';
  selectionArea.style.height = '0px';
  
  e.preventDefault();
  e.stopPropagation();
}

function onMouseMove(e) {
  if (!isDrawing) return;
  
  endX = e.clientX;
  endY = e.clientY;
  
  const selectionArea = document.getElementById('tvpip-selection-area');
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  
  selectionArea.style.left = left + 'px';
  selectionArea.style.top = top + 'px';
  selectionArea.style.width = width + 'px';
  selectionArea.style.height = height + 'px';
}

function onMouseUp(e) {
  if (!isDrawing) return;
  
  console.log('Mouse up for area selection');
  
  isDrawing = false;
  endX = e.clientX;
  endY = e.clientY;
  
  // Only show confirmation if we have a meaningful selection
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  
  if (width > 10 && height > 10) {
    // Show confirmation buttons
    const instructions = document.getElementById('tvpip-selection-instructions');
    instructions.style.display = 'block';
    console.log('Selection area created:', width, 'x', height);
  } else {
    console.log('Selection too small, ignoring');
  }
}

function confirmSelection() {
  if (!startX || !startY || !endX || !endY) {
    alert('Please select an area first');
    return;
  }
  
  console.log('Confirming selection:', startX, startY, endX, endY);
  
  // Calculate relative coordinates
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  
  selectedArea = {
    x: left,
    y: top,
    width: width,
    height: height,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight
  };
  
  console.log('Selected area:', selectedArea);
  
  // Save selected area and set flags for immediate PiP
  chrome.storage.local.set({ 
    selectedArea: selectedArea,
    autoStartPreview: true,
    autoStartPiP: true,  // New flag for immediate PiP
    isCapturing: true
  }, () => {
    console.log('Area saved to storage with auto-PiP flags');
  });
  
  // Notify popup that area is selected
  chrome.runtime.sendMessage({ action: 'areaSelected', area: selectedArea }, (response) => {
    console.log('Notified extension about area selection');
  });
  
  hideAreaSelector();
  
  // Show notification and auto-start PiP
  showNotification('Content area selected! Starting Picture-in-Picture...');
  
  // Open settings page which will auto-start preview and then PiP
  chrome.runtime.sendMessage({ action: 'openSettingsForPiP' });
}

function onKeyDown(e) {
  if (!isSelectingArea) return;
  
  switch (e.key) {
    case 'Escape':
      cancelSelection();
      break;
    case 'Enter':
      if (startX && startY && endX && endY) {
        confirmSelection();
      }
      break;
  }
}

function cancelSelection() {
  hideAreaSelector();
}

// Removed startCaptureForSettings function - now handled manually in settings

function showNotification(message) {
  const notification = document.createElement('div');
  notification.id = 'tvpip-notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}