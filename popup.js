document.addEventListener('DOMContentLoaded', function () {
    const apiEndpointInput = document.getElementById('apiEndpoint');
    const saveConfigButton = document.getElementById('saveConfig');
    const statusMessage = document.getElementById('statusMessage');
  
    // Load saved API endpoint
    chrome.storage.local.get(['apiEndpoint'], function (result) {
      if (result.apiEndpoint) {
        apiEndpointInput.value = result.apiEndpoint;
      }
    });
  
    // Save API endpoint
    saveConfigButton.addEventListener('click', function () {
      const endpoint = apiEndpointInput.value.trim();
      if (endpoint) {
        // Basic URL validation (optional, can be more robust)
        try {
          let parsedUrl = new URL(endpoint); // Check if it's a valid URL structure
          // Ensure it's http or https
          if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
              throw new Error("URL must start with http:// or https://");
          }
          chrome.storage.local.set({ apiEndpoint: endpoint }, function () {
            statusMessage.textContent = 'Configuration saved!';
            statusMessage.style.color = 'green';
            setTimeout(() => { statusMessage.textContent = ''; }, 3000);
          });
        } catch (e) {
          statusMessage.textContent = `Invalid URL: ${e.message}. Please enter a valid base URL (e.g., http://localhost:5000).`;
          statusMessage.style.color = 'red';
          setTimeout(() => { statusMessage.textContent = ''; }, 5000);
        }
      } else {
        // If clearing the endpoint
        chrome.storage.local.remove('apiEndpoint', function() {
          statusMessage.textContent = 'Configuration cleared.';
          statusMessage.style.color = 'orange';
          setTimeout(() => { statusMessage.textContent = ''; }, 3000);
        });
      }
    });
  });