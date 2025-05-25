(function () {
    let chatWidgetVisible = false;
    let apiBaseUrl = null;
    let currentSessionId = null;
    let typingIndicatorId = null;

    function fullyUnescapeHtmlEntities(encodedString) {
        let previousString = '';
        let currentString = encodedString;
        let iterations = 0;
        while (previousString !== currentString && iterations < 5) {
            previousString = currentString;
            const textarea = document.createElement('textarea');
            textarea.innerHTML = currentString;
            currentString = textarea.value;
            iterations++;
        }
        return currentString;
    }

    function addMessageToChatUI(text, sender, chatMessagesElement, quickReplies = [], isIndicator = false) {
        const messageContainer = document.createElement('div');
        messageContainer.classList.add('message-container', sender === 'user' ? 'user' : 'bot');

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');

        const messageContentDiv = document.createElement('div');
        messageContentDiv.classList.add('message-content');

        if (isIndicator) {
            // For the indicator, directly set the HTML
            messageContentDiv.innerHTML = text;
            messageContainer.classList.add('typing-indicator-message');
            typingIndicatorId = `typing-indicator-${Date.now()}`;
            messageContainer.id = typingIndicatorId;
        } else {
            // For regular messages, unescape and process Markdown
            const unescapedText = fullyUnescapeHtmlEntities(text);
            let htmlContent = unescapedText;
            htmlContent = htmlContent
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/__(.*?)__/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/_(.*?)_/g, '<em>$1</em>')
                .replace(/\\n/g, '<br>')
                .replace(/\"([^\"]+)\"/g, '<mark>"$1"</mark>');
            messageContentDiv.innerHTML = htmlContent;
        }

        messageDiv.appendChild(messageContentDiv);

        if (sender === 'bot' && quickReplies.length > 0 && !isIndicator) { // Also ensure not to add quick replies to indicator
            const quickRepliesContainerDiv = document.createElement('div');
            quickRepliesContainerDiv.classList.add('quick-replies-container');

            quickReplies.forEach(reply => {
                const button = document.createElement('button');
                button.classList.add('quick-reply-button');
                button.textContent = reply.text;
                button.addEventListener('click', async () => {
                    addMessageToChatUI(reply.text, 'user', chatMessagesElement);
                    quickRepliesContainerDiv.remove();
                    await sendBotRequest(reply.text, chatMessagesElement);
                });
                quickRepliesContainerDiv.appendChild(button);
            });
            messageDiv.appendChild(quickRepliesContainerDiv);
        }

        messageContainer.appendChild(messageDiv);
        chatMessagesElement.appendChild(messageContainer);
        chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
    }

    async function sendBotRequest(messageText, chatMessagesElement) {
        const chatInput = document.getElementById('anurag-chat-input');
        const sendButton = document.getElementById('anurag-chat-send');

        if (!currentSessionId) {
            addMessageToChatUI("Session not active. Please try reopening the chat.", "bot", chatMessagesElement);
            return;
        }

        if (chatInput) chatInput.disabled = true;
        if (sendButton) sendButton.disabled = true;

        const indicatorHtml = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
        addMessageToChatUI(indicatorHtml, "bot", chatMessagesElement, [], true);

        try {
            const queryParams = new URLSearchParams({
                session: currentSessionId,
                query: messageText
            });

            const response = await fetch(`${apiBaseUrl}/chatbot?${queryParams.toString()}`, {
                method: 'GET'
            });

            const indicatorElement = document.getElementById(typingIndicatorId);
            if (indicatorElement) {
                indicatorElement.remove();
                typingIndicatorId = null;
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            const botResponse = data.response || "Sorry, I couldn't get a proper response.";
            addMessageToChatUI(botResponse, 'bot', chatMessagesElement, data.quick_replies || []);
        } catch (error) {
            console.error('Error fetching from chatbot API:', error);
            const indicatorElement = document.getElementById(typingIndicatorId);
            if (indicatorElement) {
                indicatorElement.remove();
                typingIndicatorId = null;
            }
            addMessageToChatUI(`Error: ${error.message}`, 'bot', chatMessagesElement);
        } finally {
            if (chatInput) chatInput.disabled = false;
            if (sendButton) sendButton.disabled = false;
            if (chatInput) chatInput.focus();
        }
    }

    async function initializeChatSession(chatMessagesElement, chatInput, sendButton) {
        if (!apiBaseUrl) {
            console.error("API Base URL not configured.");
            addMessageToChatUI("Chatbot service not configured. Please set the API URL in extension options and refresh.", "bot", chatMessagesElement);
            if (chatInput) chatInput.disabled = true;
            if (sendButton) sendButton.disabled = true;
            return false;
        }

        try {
            if (chatInput) chatInput.disabled = true;
            if (sendButton) sendButton.disabled = true;

            const connectingIndicatorHtml = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
            addMessageToChatUI(connectingIndicatorHtml, "bot", chatMessagesElement, [], true);

            const response = await fetch(`${apiBaseUrl}/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const connIndicator = document.getElementById(typingIndicatorId);
            if (connIndicator) {
                connIndicator.remove();
                typingIndicatorId = null;
            }

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Failed to create session: ${response.status} - ${errorData}`);
            }

            const data = await response.json();
            if (!data.session) throw new Error("Session ID not received from backend.");

            currentSessionId = data.session;
            const welcomeMessage = data.welcome_message || "Hello! I'm the Anurag College assistant. How can I help you today?";
            const initialQuickReplies = data.quick_replies || [
                { text: "Course Information" },
                { text: "Admission Process" },
                { text: "Fee Structure" },
                { text: "Campus Location" }
            ];
            addMessageToChatUI(welcomeMessage, "bot", chatMessagesElement, initialQuickReplies);

            if (chatInput) chatInput.disabled = false;
            if (sendButton) sendButton.disabled = false;
            if (chatInput) chatInput.focus();

            return true;
        } catch (error) {
            console.error('Error initializing chat session:', error);
            const connIndicator = document.getElementById(typingIndicatorId);
            if (connIndicator) {
                connIndicator.remove();
                typingIndicatorId = null;
            }
            addMessageToChatUI(`Error starting chat: ${error.message}. Check console and API.`, 'bot', chatMessagesElement);
            if (chatInput) chatInput.disabled = true;
            if (sendButton) sendButton.disabled = true;
            return false;
        }
    }

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
                <span>Edubot</span>
                <button id="anurag-chat-close">X</button>
            </div>
            <div id="anurag-chat-messages"></div>
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

        async function openChat() {
            if (!chatWidgetVisible) {
                chatWidgetVisible = true;
                chatWidget.style.display = 'flex';
                chatIcon.style.display = 'none';
                if (!currentSessionId) {
                    await initializeChatSession(chatMessages, chatInput, sendButton);
                } else {
                    if (chatInput) chatInput.focus();
                }
            }
        }

        chatIcon.addEventListener('click', openChat);

        closeButton.addEventListener('click', () => {
            chatWidgetVisible = false;
            chatWidget.style.display = 'none';
            chatIcon.style.display = 'flex';
        });

        async function handleSendMessage() {
            const userMessage = chatInput.value.trim();
            if (!userMessage) return;
            addMessageToChatUI(userMessage, 'user', chatMessages);
            chatInput.value = '';
            await sendBotRequest(userMessage, chatMessages);
        }

        sendButton.addEventListener('click', handleSendMessage);
        chatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !sendButton.disabled) {
                handleSendMessage();
            }
        });

        chrome.storage.local.get('apiEndpoint', (data) => {
            if (data.apiEndpoint) {
                apiBaseUrl = data.apiEndpoint;
                console.log('API Endpoint loaded:', apiBaseUrl);
                if (!sessionStorage.getItem('anuragChatbotVisited')) {
                    sessionStorage.setItem('anuragChatbotVisited', 'true');
                    setTimeout(openChat, 1500);
                } else {
                    if (!chatWidgetVisible) {
                        chatIcon.style.display = 'flex';
                    }
                }
            } else {
                console.error('API Endpoint not found in storage.');
                chatIcon.style.display = 'flex';
            }
        });

        chatWidget.style.display = 'none';
    }

    createAndInjectUI();
})();
