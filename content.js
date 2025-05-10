(function() {
    let chatWidgetVisible = false;
    let apiBaseUrl = null; // Will be loaded from storage
    let currentSessionId = null; // To store the active session ID
  
    // Function to add message to chat (utility)
    function addMessageToChatUI(text, sender, chatMessagesElement) {
      const messageDiv = document.createElement('div');
      messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
      // Basic sanitization to prevent HTML injection from bot response
      const textNode = document.createTextNode(text);
      messageDiv.appendChild(textNode);
      chatMessagesElement.appendChild(messageDiv);
      chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
    }
  
    // Function to initialize a new chat session with the backend
    async function initializeChatSession(chatMessagesElement, chatInput, sendButton) {
      if (!apiBaseUrl) {
        console.error("API Base URL not configured.");
        addMessageToChatUI("Chatbot service not configured. Please set the API URL in extension options and refresh.", "bot", chatMessagesElement);
        if(chatInput) chatInput.disabled = true;
        if(sendButton) sendButton.disabled = true;
        return false;
      }
      try {
        if(chatInput) chatInput.disabled = true;
        if(sendButton) sendButton.disabled = true;
  
        addMessageToChatUI("Connecting to chatbot...", "bot", chatMessagesElement); // Connecting message
        console.log(`Initializing session with: ${apiBaseUrl}/session`);
        const response = await fetch(`${apiBaseUrl}/session`, { // Ensure /session endpoint
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
  
        // Clear "Connecting..." message (or you can leave it)
        // For simplicity, new messages will appear after.
  
        if (!response.ok) {
          const errorData = await response.text(); // Get text for more detailed error
          throw new Error(`Failed to create session: ${response.status} - ${errorData}`);
        }
        const data = await response.json();
        if (!data.session) {
            throw new Error("Session ID not received from backend.");
        }
        currentSessionId = data.session;
        console.log('Chat session initialized:', currentSessionId);
  
        addMessageToChatUI("Hello! I'm the Anurag College assistant. How can I help you today?", "bot", chatMessagesElement);
        if(chatInput) chatInput.disabled = false;
        if(sendButton) sendButton.disabled = false;
        if(chatInput) chatInput.focus();
        return true;
  
      } catch (error) {
        console.error('Error initializing chat session:', error);
        addMessageToChatUI(`Error starting chat: ${error.message}. Check console and API.`, 'bot', chatMessagesElement);
        if(chatInput) chatInput.disabled = true; // Keep disabled on error
        if(sendButton) sendButton.disabled = true;
        return false;
      }
    }
  
  
    // Function to create and inject UI
    function createAndInjectUI() {
      const chatIcon = document.createElement('div');
      chatIcon.id = 'anurag-chat-icon';
      chatIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="30px" height="30px">
          <path d="M0 0h24v24H0z" fill="none"/>
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
      `;
      document.body.appendChild(chatIcon);
  
      const chatWidget = document.createElement('div');
      chatWidget.id = 'anurag-chat-widget';
      chatWidget.innerHTML = `
        <div id="anurag-chat-header">
          <span>Anurag College Chatbot</span>
          <button id="anurag-chat-close">X</button>
        </div>
        <div id="anurag-chat-messages">
        </div>
        <div id="anurag-chat-input-area">
          <input type="text" id="anurag-chat-input" placeholder="Type your message..." disabled>
          <button id="anurag-chat-send" disabled>Send</button>
        </div>
      `;
      document.body.appendChild(chatWidget);
  
      const chatMessages = document.getElementById('anurag-chat-messages');
      const chatInput = document.getElementById('anurag-chat-input');
      const sendButton = document.getElementById('anurag-chat-send');
      const closeButton = document.getElementById('anurag-chat-close');
  
      chatIcon.addEventListener('click', async () => {
        chatWidgetVisible = !chatWidgetVisible;
        chatWidget.style.display = chatWidgetVisible ? 'flex' : 'none';
        chatIcon.style.display = chatWidgetVisible ? 'none' : 'flex';
        if (chatWidgetVisible && !currentSessionId) {
          await initializeChatSession(chatMessages, chatInput, sendButton);
        } else if (chatWidgetVisible && currentSessionId) {
          chatInput.focus();
        }
      });
  
      closeButton.addEventListener('click', () => {
        chatWidgetVisible = false;
        chatWidget.style.display = 'none';
        chatIcon.style.display = 'flex';
      });
  
      async function handleSendMessage() {
        const userMessage = chatInput.value.trim();
        if (userMessage === '') return;
  
        if (!currentSessionId) {
          addMessageToChatUI("Session not active. Reconnecting...", "bot", chatMessages);
          const success = await initializeChatSession(chatMessages, chatInput, sendButton);
          if (!success) {
              addMessageToChatUI("Failed to reconnect. Please check API or try again.", "bot", chatMessages);
              return;
          }
          // User might need to resend their original message after reconnection.
          // For now, let's just enable input for them to try again.
          addMessageToChatUI("Reconnected. Please try sending your message again.", "bot", chatMessages);
          return;
        }
  
        addMessageToChatUI(userMessage, 'user', chatMessages);
        chatInput.value = '';
        chatInput.disabled = true;
        sendButton.disabled = true;
        addMessageToChatUI("...", "bot", chatMessages); // Thinking indicator
  
        try {
          const queryParams = new URLSearchParams({
            session: currentSessionId,
            query: userMessage // Flask's request.args will handle URL decoding
          });
          console.log(`Sending query to: ${apiBaseUrl}/chatbot?${queryParams.toString()}`);
          const response = await fetch(`${apiBaseUrl}/chatbot?${queryParams.toString()}`, {
              method: 'GET'
          });
  
          // Remove "Thinking..." message
          const thinkingMessage = Array.from(chatMessages.children).find(el => el.textContent === "..." && el.classList.contains("bot-message"));
          if (thinkingMessage) thinkingMessage.remove();
  
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
          }
          const data = await response.json();
          const botResponse = data.response || "Sorry, I couldn't get a proper response.";
          addMessageToChatUI(botResponse, 'bot', chatMessages);
        } catch (error) {
          console.error('Error fetching from chatbot API:', error);
          const thinkingMessage = Array.from(chatMessages.children).find(el => el.textContent === "..." && el.classList.contains("bot-message"));
          if (thinkingMessage) thinkingMessage.remove(); // Also remove if error occurs
          addMessageToChatUI(`Error: ${error.message}`, 'bot', chatMessages);
        } finally {
          chatInput.disabled = false;
          sendButton.disabled = false;
          chatInput.focus();
        }
      }
  
      sendButton.addEventListener('click', handleSendMessage);
      chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !sendButton.disabled) { // Check if not disabled
          handleSendMessage();
        }
      });
  
      chatWidget.style.display = 'none';
      chatIcon.style.display = 'flex';
    }
  
  
    // Main Execution Flow
    chrome.storage.local.get(['apiEndpoint'], function(result) {
      if (result.apiEndpoint && result.apiEndpoint.trim() !== '') {
        try {
          let parsedUrl = new URL(result.apiEndpoint);
          if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
              throw new Error("Must be http or https");
          }
          apiBaseUrl = result.apiEndpoint.replace(/\/$/, "");
          console.log('Chatbot API Base URL loaded:', apiBaseUrl);
        } catch (e) {
          console.warn(`Invalid API Endpoint loaded: "${result.apiEndpoint}". Error: ${e.message}`);
          apiBaseUrl = null;
        }
      } else {
        console.warn('Chatbot API Base URL not configured in extension options.');
        apiBaseUrl = null;
      }
  
      createAndInjectUI(); // Always create UI
  
      // If API URL is not set, display a message in chat when it's first opened (handled by initializeChatSession)
      // You could also put an initial message in chatMessages if apiBaseUrl is null right after createAndInjectUI,
      // but initializeChatSession will also handle it if user tries to open.
      if (!apiBaseUrl) {
          const chatMessages = document.getElementById('anurag-chat-messages');
          if (chatMessages) { // Ensure element exists
              // This message will appear if chat is somehow opened before initializeChatSession runs
              // or if initializeChatSession itself fails to add its own specific error.
              // addMessageToChatUI("Chatbot API URL not configured. Please set it in the extension options and refresh.", "bot", chatMessages);
          }
      }
    });
  
  })();