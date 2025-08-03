// Content script for TradingView PiP extension

let isSelectingArea = false;
let selectionOverlay = null;
let selectedArea = null;

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'ping':
      // Simple ping to check if content script is loaded
      sendResponse({ status: 'ok' });
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
  if (isSelectingArea) return;
  
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
  // Create overlay container
  selectionOverlay = document.createElement('div');
  selectionOverlay.id = 'tvpip-selection-overlay';
  selectionOverlay.innerHTML = `
    <div id="tvpip-selection-area"></div>
    <div id="tvpip-selection-instructions">
      Click and drag to select the chart area you want to capture
      <div id="tvpip-selection-buttons">
        <button id="tvpip-confirm-selection">✓ Confirm</button>
        <button id="tvpip-cancel-selection">✕ Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(selectionOverlay);
  
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
  
  isDrawing = true;
  startX = e.clientX;
  startY = e.clientY;
  
  const selectionArea = document.getElementById('tvpip-selection-area');
  selectionArea.style.display = 'block';
  selectionArea.style.left = startX + 'px';
  selectionArea.style.top = startY + 'px';
  selectionArea.style.width = '0px';
  selectionArea.style.height = '0px';
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
  
  isDrawing = false;
  endX = e.clientX;
  endY = e.clientY;
  
  // Show confirmation buttons
  const instructions = document.getElementById('tvpip-selection-instructions');
  instructions.style.display = 'block';
}

function confirmSelection() {
  if (!startX || !startY || !endX || !endY) {
    alert('Please select an area first');
    return;
  }
  
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
  
  // Save selected area
  chrome.storage.local.set({ selectedArea: selectedArea });
  
  // Notify popup that area is selected
  chrome.runtime.sendMessage({ action: 'areaSelected', area: selectedArea });
  
  hideAreaSelector();
  
  // Show success message
  showNotification('Chart area selected! You can now start picture-in-picture capture.');
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