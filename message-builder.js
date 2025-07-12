// Global state
let currentUser = null;
let messages = [];
let currentMessageId = null;
let currentEmbedCount = 0;
let currentMessageType = null;
let serverProfile = null;
let communityMessages = [];
let communityPage = 0;
let isLoadingCommunity = false;
let lastValidJson = '';

// Placeholders for different message types
const placeholders = {
    welcome: [
        { code: '{user}', description: 'User mention' },
        { code: '{user.name}', description: 'Username' },
        { code: '{user.id}', description: 'User ID' },
        { code: '{user.avatar}', description: 'User avatar URL' },
        { code: '{server}', description: 'Server name' },
        { code: '{server.id}', description: 'Server ID' },
        { code: '{server.memberCount}', description: 'Total members' },
        { code: '{channel}', description: 'Channel mention' }
    ],
    leave: [
        { code: '{user}', description: 'User mention' },
        { code: '{user.name}', description: 'Username' },
        { code: '{user.id}', description: 'User ID' },
        { code: '{server}', description: 'Server name' },
        { code: '{server.memberCount}', description: 'Total members' }
    ],
    ban: [
        { code: '{user}', description: 'Banned user mention' },
        { code: '{user.name}', description: 'Banned username' },
        { code: '{user.id}', description: 'Banned user ID' },
        { code: '{reason}', description: 'Ban reason' },
        { code: '{moderator}', description: 'Moderator mention' },
        { code: '{server}', description: 'Server name' }
    ],
    announcement: [
        { code: '{user}', description: 'User mention' },
        { code: '{server}', description: 'Server name' },
        { code: '{date}', description: 'Current date' },
        { code: '{time}', description: 'Current time' }
    ],
    ticket: [
        { code: '{user}', description: 'User mention' },
        { code: '{user.name}', description: 'Username' },
        { code: '{ticket.id}', description: 'Ticket ID' },
        { code: '{category}', description: 'Ticket category' },
        { code: '{server}', description: 'Server name' }
    ],
    other: [
        { code: '{user}', description: 'User mention' },
        { code: '{user.name}', description: 'Username' },
        { code: '{server}', description: 'Server name' }
    ]
};

// Search animation texts
const searchAnimationTexts = [
    'welcome new members...',
    'goodbye messages...',
    'announcement templates...',
    'use #ABC123 to search by ID...',
    'ticket responses...',
    'ban notifications...'
];

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    setupSearchAnimation();
});

async function updateDashboardUserDisplay() {
    try {
        const res = await fetch('/api/auth/user');
        if (res.ok) {
            const { user } = await res.json();
            document.getElementById('user-avatar-dashboard').src = `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`;
            document.getElementById('user-username-dashboard').textContent = user.username;
        }
    } catch (error) {
        console.error('Error updating user display:', error);
    }
}

async function populateServerSwitcher() {
    try {
        const params = new URLSearchParams(window.location.search);
        const currentGuildId = params.get('guild');

        const res = await fetch('/api/guilds/mutual');
        const guilds = await res.json();

        const currentGuild = guilds.find(g => g.id === currentGuildId);
        const otherGuilds = guilds.filter(g => g.id !== currentGuildId);

        const switcherBtn = document.getElementById('server-switcher-btn');
        const dropdown = document.getElementById('server-switcher-dropdown');

        if (currentGuild) {
            switcherBtn.innerHTML = `
                ${currentGuild.icon ? `<img src="https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.png" />` : `<div class="server-icon-initial">${currentGuild.name.charAt(0)}</div>`}
                <span>${currentGuild.name}</span>
                <span class="chevron">▼</span>
            `;
            
            // Load server profile
            await loadServerProfile(currentGuildId);
        }

        if (otherGuilds.length > 0) {
            dropdown.innerHTML = `
                <div class="dropdown-header">Jump to</div>
                ${otherGuilds.map(g => `
                    <a href="/dashboard?guild=${g.id}" class="dropdown-item">
                        ${g.icon ? `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png" />` : `<div class="server-icon-initial">${g.name.charAt(0)}</div>`}
                        <span>${g.name}</span>
                    </a>
                `).join('')}
            `;
        } else {
            dropdown.innerHTML = `<div class="dropdown-header">No other servers</div>`;
        }

        switcherBtn.addEventListener('click', () => {
            dropdown.classList.toggle('show');
        });
    } catch (error) {
        console.error('Error populating server switcher:', error);
    }
}

async function loadServerProfile(guildId) {
    try {
        const response = await fetch(`/api/server-profile/${guildId}`);
        if (response.ok) {
            serverProfile = await response.json();
        } else {
            // Create new server profile
            serverProfile = await createServerProfile(guildId);
        }
        updateServerMessageCards();
    } catch (error) {
        console.error('Error loading server profile:', error);
    }
}

async function createServerProfile(guildId) {
    try {
        const response = await fetch('/api/server-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guildId })
        });
        
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Error creating server profile:', error);
    }
    return null;
}

function updateServerMessageCards() {
    if (!serverProfile) return;

    const welcomeCard = document.getElementById('welcome-card');
    const leaveCard = document.getElementById('leave-card');
    const banCard = document.getElementById('ban-card');

    updateMessageCard(welcomeCard, serverProfile.welcomeMessage, 'welcome');
    updateMessageCard(leaveCard, serverProfile.leaveMessage, 'leave');
    updateMessageCard(banCard, serverProfile.banMessage, 'ban');
}

function updateMessageCard(card, messageConfig, type) {
    const content = card.querySelector('.card-content');
    
    if (messageConfig && messageConfig.messageId) {
        // Message is configured
        const message = messages.find(m => m.messageId === messageConfig.messageId);
        if (message) {
            content.innerHTML = `
                <svg class="card-icon" width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <h3>${type.charAt(0).toUpperCase() + type.slice(1)} Message</h3>
                <p>Message: ${message.title || 'Untitled'}</p>
                ${type !== 'ban' ? `<p>Channel: #${messageConfig.channelId || 'Not set'}</p>` : ''}
                <div class="card-actions">
                    <button class="btn btn-outline btn-small change-message-btn" data-type="${type}">Change</button>
                    <button class="btn btn-secondary btn-small remove-message-btn" data-type="${type}">Remove</button>
                </div>
            `;
        }
    } else {
        // No message configured - show setup button
        const icons = {
            welcome: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
            leave: 'M9 3v2H7v14h2v2H5V3h4zm6 0h4v18h-4v-2h2V5h-2V3zm-4 6l4 3-4 3V9z',
            ban: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z'
        };
        
        content.innerHTML = `
            <svg class="card-icon" width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="${icons[type]}"/>
            </svg>
            <h3>${type.charAt(0).toUpperCase() + type.slice(1)} Message</h3>
            <p>Set up ${type} messages for your server</p>
            <button class="btn btn-primary setup-message-btn" data-type="${type}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Setup Message
            </button>
        `;
    }
}

async function initializeApp() {
    try {
        const response = await fetch('/api/auth/user');
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            hideAuthModal();
            await updateDashboardUserDisplay();
            await populateServerSwitcher();
            loadUserMessages();
        } else {
            showAuthModal();
        }
    } catch (error) {
        console.error('Authentication check failed:', error);
        showAuthModal();
    }
}

function setupEventListeners() {
    // Navigation
    setupNavigation();
    
    // Authentication
    setupAuthentication();
    
    // Message Builder
    setupMessageBuilder();
    
    // View Toggle
    setupViewToggle();
    
    // Community
    setupCommunity();
    
    // Publish Modal
    setupPublishModal();
    
    // Message Type Modal
    setupMessageTypeModal();
    
    // Server Message Setup
    setupServerMessageSetup();
    
    // Custom Dropdowns
    setupCustomDropdowns();
    
    // Other features
    setupOtherFeatures();
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.content-section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            navLinks.forEach(nav => nav.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));
            
            this.classList.add('active');
            
            const targetSection = this.getAttribute('data-section');
            document.getElementById(targetSection).classList.add('active');
            
            if (targetSection === 'message-builder') {
                loadMessageBuilderSection();
            } else if (targetSection === 'community') {
                loadCommunityMessages();
            }
        });
    });
}

function setupAuthentication() {
    const discordLoginBtn = document.getElementById('discord-login-btn');

    if (discordLoginBtn) {
        discordLoginBtn.addEventListener('click', () => {
            window.location.href = '/api/auth/discord';
        });
    }
}

function showAuthModal() {
    document.getElementById('auth-modal').style.display = 'flex';
}

function hideAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
}

function setupMessageBuilder() {
    const createNewBtn = document.getElementById('create-new-message');
    const createFirstBtn = document.getElementById('create-first-message');
    const backToListBtn = document.getElementById('back-to-list');
    const saveMessageBtn = document.getElementById('save-message');
    const addEmbedBtn = document.getElementById('add-embed-btn');
    const messageContentInput = document.getElementById('message-content');

    [createNewBtn, createFirstBtn].forEach(btn => {
        if (btn) btn.addEventListener('click', () => showMessageTypeModal());
    });

    if (backToListBtn) {
        backToListBtn.addEventListener('click', () => showMessageList());
    }

    if (saveMessageBtn) {
        saveMessageBtn.addEventListener('click', () => saveMessage());
    }

    if (addEmbedBtn) {
        addEmbedBtn.addEventListener('click', () => addEmbed());
    }

    if (messageContentInput) {
        messageContentInput.addEventListener('input', updatePreview);
    }
}

function setupViewToggle() {
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    const guiView = document.getElementById('gui-view');
    const jsonView = document.getElementById('json-view');
    const copyJsonBtn = document.getElementById('copy-json');
    const jsonContent = document.getElementById('json-content');

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.closest('.preview-toggle')) return; // Skip preview modal toggles
            
            toggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const view = btn.getAttribute('data-view');
            if (view === 'gui') {
                guiView.style.display = 'flex';
                jsonView.style.display = 'none';
            } else {
                guiView.style.display = 'none';
                jsonView.style.display = 'block';
                updateJsonView();
            }
        });
    });

    if (copyJsonBtn) {
        copyJsonBtn.addEventListener('click', () => {
            jsonContent.select();
            document.execCommand('copy');
            showNotification('JSON copied to clipboard!', 'success');
        });
    }

    if (jsonContent) {
        jsonContent.addEventListener('input', () => {
            validateAndUpdateFromJson();
        });
    }
}

function validateAndUpdateFromJson() {
    const jsonContent = document.getElementById('json-content');
    const jsonError = document.getElementById('json-error');
    
    try {
        const data = JSON.parse(jsonContent.value);
        jsonError.style.display = 'none';
        lastValidJson = jsonContent.value;
        
        // Update preview from JSON
        updatePreviewFromJson(data);
    } catch (error) {
        jsonError.style.display = 'block';
    }
}

function updatePreviewFromJson(data) {
    const previewContent = document.getElementById('preview-content');
    const previewEmbeds = document.getElementById('preview-embeds');
    
    // Update message content
    previewContent.textContent = data.content || 'Type your message here...';
    
    // Update embeds
    previewEmbeds.innerHTML = '';
    
    if (data.embeds && data.embeds.length > 0) {
        data.embeds.forEach(embedData => {
            previewEmbeds.appendChild(createEmbedPreview(embedData));
        });
    }
}

function setupMessageTypeModal() {
    const modal = document.getElementById('message-type-modal');
    const closeBtn = document.getElementById('close-type-modal');
    const typeCards = document.querySelectorAll('.message-type-card');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    typeCards.forEach(card => {
        card.addEventListener('click', () => {
            const type = card.getAttribute('data-type');
            currentMessageType = type;
            modal.style.display = 'none';
            showMessageBuilder();
        });
    });
}

function showMessageTypeModal() {
    document.getElementById('message-type-modal').style.display = 'flex';
}

function setupServerMessageSetup() {
    const modal = document.getElementById('server-message-modal');
    const closeBtn = document.getElementById('close-server-message-modal');
    const cancelBtn = document.getElementById('cancel-server-message');
    const saveBtn = document.getElementById('save-server-message');

    // Setup message buttons
    document.addEventListener('click', (e) => {
        if (e.target.closest('.setup-message-btn')) {
            const type = e.target.closest('.setup-message-btn').getAttribute('data-type');
            showServerMessageModal(type);
        }
        
        if (e.target.closest('.change-message-btn')) {
            const type = e.target.closest('.change-message-btn').getAttribute('data-type');
            showServerMessageModal(type);
        }
        
        if (e.target.closest('.remove-message-btn')) {
            const type = e.target.closest('.remove-message-btn').getAttribute('data-type');
            removeServerMessage(type);
        }
    });

    [closeBtn, cancelBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
    });

    if (saveBtn) {
        saveBtn.addEventListener('click', saveServerMessage);
    }
}

function showServerMessageModal(type) {
    const modal = document.getElementById('server-message-modal');
    const title = document.getElementById('server-message-title');
    const channelGroup = document.getElementById('channel-input-group');
    const messagesList = document.getElementById('server-messages-list');
    
    title.textContent = `Setup ${type.charAt(0).toUpperCase() + type.slice(1)} Message`;
    
    // Hide channel input for ban messages
    if (type === 'ban') {
        channelGroup.style.display = 'none';
    } else {
        channelGroup.style.display = 'block';
    }
    
    // Populate messages of this type
    const typeMessages = messages.filter(m => m.type === type);
    messagesList.innerHTML = typeMessages.map(message => `
        <div class="server-message-item" data-message-id="${message.messageId}">
            <div class="message-info">
                <h4>${message.title || 'Untitled Message'}</h4>
                <p>${message.content ? message.content.substring(0, 100) + '...' : 'No content'}</p>
            </div>
            <input type="radio" name="selected-message" value="${message.messageId}">
        </div>
    `).join('');
    
    if (typeMessages.length === 0) {
        messagesList.innerHTML = `
            <div class="no-messages-type">
                <p>No ${type} messages found. Create one first in Message Builder.</p>
            </div>
        `;
    }
    
    modal.setAttribute('data-type', type);
    modal.style.display = 'flex';
}

async function saveServerMessage() {
    const modal = document.getElementById('server-message-modal');
    const type = modal.getAttribute('data-type');
    const channelId = document.getElementById('channel-id').value;
    const selectedMessage = document.querySelector('input[name="selected-message"]:checked');
    
    if (!selectedMessage) {
        showNotification('Please select a message', 'error');
        return;
    }
    
    if (type !== 'ban' && !channelId) {
        showNotification('Please enter a channel ID', 'error');
        return;
    }
    
    const messageConfig = {
        messageId: selectedMessage.value,
        channelId: type !== 'ban' ? channelId : null
    };
    
    try {
        const params = new URLSearchParams(window.location.search);
        const guildId = params.get('guild');
        
        const response = await fetch(`/api/server-profile/${guildId}/${type}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageConfig)
        });
        
        if (response.ok) {
            serverProfile = await response.json();
            updateServerMessageCards();
            modal.style.display = 'none';
            showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} message configured!`, 'success');
        } else {
            showNotification('Failed to save message configuration', 'error');
        }
    } catch (error) {
        showNotification('Error saving message configuration', 'error');
    }
}

async function removeServerMessage(type) {
    if (!confirm(`Are you sure you want to remove the ${type} message configuration?`)) {
        return;
    }
    
    try {
        const params = new URLSearchParams(window.location.search);
        const guildId = params.get('guild');
        
        const response = await fetch(`/api/server-profile/${guildId}/${type}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            serverProfile = await response.json();
            updateServerMessageCards();
            showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} message removed!`, 'success');
        } else {
            showNotification('Failed to remove message configuration', 'error');
        }
    } catch (error) {
        showNotification('Error removing message configuration', 'error');
    }
}

function setupCustomDropdowns() {
    const dropdowns = document.querySelectorAll('.custom-dropdown');
    
    dropdowns.forEach(dropdown => {
        const btn = dropdown.querySelector('.dropdown-btn');
        const content = dropdown.querySelector('.dropdown-content');
        const items = dropdown.querySelectorAll('.dropdown-item');
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close other dropdowns
            dropdowns.forEach(d => {
                if (d !== dropdown) {
                    d.querySelector('.dropdown-content').classList.remove('show');
                }
            });
            content.classList.toggle('show');
        });
        
        items.forEach(item => {
            item.addEventListener('click', () => {
                const value = item.getAttribute('data-value');
                const text = item.textContent;
                
                btn.querySelector('span').textContent = text;
                btn.setAttribute('data-value', value);
                content.classList.remove('show');
                
                // Trigger search if this is a community filter
                if (dropdown.closest('.community-controls')) {
                    searchCommunityMessages();
                }
            });
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        dropdowns.forEach(dropdown => {
            dropdown.querySelector('.dropdown-content').classList.remove('show');
        });
    });
}

function setupSearchAnimation() {
    const searchInput = document.getElementById('community-search');
    const animationDiv = document.getElementById('search-animation');
    let currentTextIndex = 0;
    let currentCharIndex = 0;
    let isTyping = true;
    let isInputFocused = false;

    function animateSearch() {
        if (isInputFocused || searchInput.value.length > 0) {
            animationDiv.style.display = 'none';
            return;
        }

        animationDiv.style.display = 'block';
        const currentText = searchAnimationTexts[currentTextIndex];

        if (isTyping) {
            if (currentCharIndex < currentText.length) {
                animationDiv.textContent = currentText.substring(0, currentCharIndex + 1);
                currentCharIndex++;
                setTimeout(animateSearch, 100);
            } else {
                setTimeout(() => {
                    isTyping = false;
                    animateSearch();
                }, 2000);
            }
        } else {
            if (currentCharIndex > 0) {
                animationDiv.textContent = currentText.substring(0, currentCharIndex - 1);
                currentCharIndex--;
                setTimeout(animateSearch, 50);
            } else {
                currentTextIndex = (currentTextIndex + 1) % searchAnimationTexts.length;
                isTyping = true;
                setTimeout(animateSearch, 500);
            }
        }
    }

    searchInput.addEventListener('focus', () => {
        isInputFocused = true;
        animationDiv.style.display = 'none';
    });

    searchInput.addEventListener('blur', () => {
        isInputFocused = false;
        if (searchInput.value.length === 0) {
            setTimeout(animateSearch, 1000);
        }
    });

    searchInput.addEventListener('input', () => {
        if (searchInput.value.length === 0 && !isInputFocused) {
            setTimeout(animateSearch, 1000);
        } else {
            animationDiv.style.display = 'none';
        }
    });

    // Start animation
    setTimeout(animateSearch, 1000);
}

function loadMessageBuilderSection() {
    if (currentUser) {
        loadUserMessages();
    }
    showMessageList();
}

function loadUserMessages() {
    if (!currentUser) return;
    
    // Simulate loading messages from local storage or generate some sample data
    const savedMessages = localStorage.getItem('userMessages');
    if (savedMessages) {
        messages = JSON.parse(savedMessages);
    } else {
        messages = []; // Start with empty array
    }
    
    updateMessagesList();
    updateDashboardStats();
}

function updateMessagesList() {
    const messageCardsContainer = document.getElementById('message-cards-container');
    const noMessagesMessage = document.getElementById('no-messages-message');
    
    messageCardsContainer.innerHTML = '';

    if (!currentUser) {
        messageCardsContainer.style.display = 'none';
        noMessagesMessage.style.display = 'block';
        noMessagesMessage.querySelector('h3').textContent = "Please sign in to see your messages.";
        noMessagesMessage.querySelector('p').textContent = "Once you sign in, your created messages will appear here.";
        noMessagesMessage.querySelector('button').style.display = 'none';
        return;
    }

    if (messages.length === 0) {
        messageCardsContainer.style.display = 'none';
        noMessagesMessage.style.display = 'block';
        noMessagesMessage.querySelector('h3').textContent = "You haven't created any messages yet.";
        noMessagesMessage.querySelector('p').textContent = "Get started by creating your first message!";
        noMessagesMessage.querySelector('button').style.display = 'inline-block';
    } else {
        messageCardsContainer.style.display = 'grid';
        noMessagesMessage.style.display = 'none';
        
        messageCardsContainer.innerHTML = messages.map(message => createMessageCard(message)).join('');
        
        messageCardsContainer.querySelectorAll('.message-card-item').forEach(card => {
            card.addEventListener('click', function(e) {
                if (!e.target.closest('.message-menu')) {
                    const messageId = this.getAttribute('data-message-id');
                    editMessage(messageId);
                }
            });
        });
        
        messageCardsContainer.querySelectorAll('.message-menu-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const dropdown = this.nextElementSibling;
                closeAllDropdowns();
                dropdown.classList.toggle('show');
            });
        });
        
        messageCardsContainer.querySelectorAll('.message-menu-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                const action = this.getAttribute('data-action');
                const messageId = this.closest('.message-card-item').getAttribute('data-message-id');
                handleMessageAction(action, messageId);
                closeAllDropdowns();
            });
        });
    }
}

function createMessageCard(message) {
    const createdDate = new Date(message.createdAt).toLocaleDateString();
    const content = message.content || 'No content';
    const truncatedContent = content.length > 100 ? content.substring(0, 100) + '...' : content;
    const embedCount = message.embeds ? message.embeds.length : 0;
    const isPublic = message.is_public || false;

    return `
        <div class="message-card-item" data-message-id="${message.messageId}">
            <div class="message-card-header">
                <div class="message-card-info">
                    <h3 class="message-card-title">${message.title || 'Untitled Message'}</h3>
                    <p class="message-card-description">${truncatedContent}</p>
                    <div class="message-card-stats">
                        <span class="embed-count">${embedCount} embed${embedCount !== 1 ? 's' : ''}</span>
                        ${isPublic ? '<span class="public-badge">Public</span>' : ''}
                        ${message.type ? `<span class="type-badge">${message.type}</span>` : ''}
                    </div>
                </div>
                <div class="message-menu">
                    <button class="message-menu-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                        </svg>
                    </button>
                    <div class="message-menu-dropdown">
                        <button class="message-menu-item" data-action="copy-id">Copy ID</button>
                        <button class="message-menu-item" data-action="duplicate">Duplicate</button>
                        ${!isPublic ? '<button class="message-menu-item" data-action="publish">Publish</button>' : '<button class="message-menu-item" data-action="make-private">Make Private</button>'}
                        <button class="message-menu-item" data-action="delete">Delete</button>
                    </div>
                </div>
            </div>
            <div class="message-card-meta">
                <span class="message-card-id">${message.messageId}</span>
                <span class="message-card-date">${createdDate}</span>
            </div>
        </div>
    `;
}

function closeAllDropdowns() {
    document.querySelectorAll('.message-menu-dropdown').forEach(dropdown => {
        dropdown.classList.remove('show');
    });
}

function handleMessageAction(action, messageId) {
    const message = messages.find(m => m.messageId === messageId);
    if (!message) return;
    
    switch (action) {
        case 'copy-id':
            navigator.clipboard.writeText(message.messageId).then(() => {
                showNotification('Message ID copied to clipboard!', 'success');
            });
            break;
        case 'duplicate':
            duplicateMessage(messageId);
            break;
        case 'publish':
            showPublishModal(messageId);
            break;
        case 'make-private':
            makeMessagePrivate(messageId);
            break;
        case 'delete':
            if (confirm('Are you sure you want to delete this message?')) {
                deleteMessage(messageId);
            }
            break;
    }
}

function deleteMessage(messageId) {
    messages = messages.filter(m => m.messageId !== messageId);
    localStorage.setItem('userMessages', JSON.stringify(messages));
    updateMessagesList();
    updateDashboardStats();
    showNotification('Message deleted successfully!', 'success');
}

function duplicateMessage(messageId) {
    const message = messages.find(m => m.messageId === messageId);
    if (!message) return;
    
    const duplicatedMessage = {
        ...message,
        messageId: generateMessageId(),
        title: (message.title || 'Untitled Message') + ' (Copy)',
        createdAt: new Date().toISOString(),
        is_public: false
    };
    
    messages.unshift(duplicatedMessage);
    localStorage.setItem('userMessages', JSON.stringify(messages));
    updateMessagesList();
    updateDashboardStats();
    showNotification('Message duplicated successfully!', 'success');
}

function makeMessagePrivate(messageId) {
    const message = messages.find(m => m.messageId === messageId);
    if (!message) return;
    
    message.is_public = false;
    delete message.language;
    delete message.keywords;
    
    localStorage.setItem('userMessages', JSON.stringify(messages));
    updateMessagesList();
    showNotification('Message made private!', 'success');
}

function showMessageList() {
    document.getElementById('message-list-view').style.display = 'block';
    document.getElementById('message-builder-view').style.display = 'none';
    currentMessageId = null;
    currentMessageType = null;
}

function showMessageBuilder(messageId = null) {
    document.getElementById('message-list-view').style.display = 'none';
    document.getElementById('message-builder-view').style.display = 'block';
    
    currentMessageId = messageId;
    currentEmbedCount = 0;
    
    if (messageId) {
        document.getElementById('builder-title').textContent = 'Edit Message';
        loadMessageForEditing(messageId);
    } else {
        document.getElementById('builder-title').textContent = 'Create New Message';
        clearMessageForm();
        updatePlaceholders();
        updatePreview();
    }
}

function updatePlaceholders() {
    const placeholdersGrid = document.getElementById('placeholders-grid');
    const placeholdersSection = document.getElementById('placeholders-section');
    
    if (!currentMessageType || !placeholders[currentMessageType]) {
        placeholdersSection.style.display = 'none';
        return;
    }
    
    placeholdersSection.style.display = 'block';
    placeholdersGrid.innerHTML = placeholders[currentMessageType].map(placeholder => `
        <div class="placeholder-item" data-code="${placeholder.code}">
            <code>${placeholder.code}</code>
            <span>${placeholder.description}</span>
        </div>
    `).join('');
    
    // Add click handlers for placeholders
    placeholdersGrid.querySelectorAll('.placeholder-item').forEach(item => {
        item.addEventListener('click', () => {
            const code = item.getAttribute('data-code');
            const messageContent = document.getElementById('message-content');
            const cursorPos = messageContent.selectionStart;
            const textBefore = messageContent.value.substring(0, cursorPos);
            const textAfter = messageContent.value.substring(cursorPos);
            
            messageContent.value = textBefore + code + textAfter;
            messageContent.focus();
            messageContent.setSelectionRange(cursorPos + code.length, cursorPos + code.length);
            
            updatePreview();
        });
    });
}

function editMessage(messageId) {
    const message = messages.find(m => m.messageId === messageId);
    if (message) {
        currentMessageType = message.type;
    }
    showMessageBuilder(messageId);
}

function loadMessageForEditing(messageId) {
    const message = messages.find(m => m.messageId === messageId);
    if (!message) {
        showNotification('Message not found', 'error');
        return;
    }
    
    populateMessageForm(message);
    updatePlaceholders();
    updatePreview();
}

function populateMessageForm(message) {
    document.getElementById('message-content').value = message.content || '';
    
    // Clear existing embeds
    document.getElementById('embeds-container').innerHTML = '';
    currentEmbedCount = 0;
    
    // Add embeds
    if (message.embeds && message.embeds.length > 0) {
        message.embeds.forEach(embed => {
            addEmbed(embed);
        });
    }
}

function clearMessageForm() {
    document.getElementById('message-content').value = '';
    document.getElementById('embeds-container').innerHTML = '';
    currentEmbedCount = 0;
}

function addEmbed(embedData = null) {
    currentEmbedCount++;
    const embedId = `embed-${currentEmbedCount}`;
    
    const embedHtml = `
        <div class="embed-editor" data-embed-id="${embedId}">
            <div class="embed-header">
                <h4>Embed ${currentEmbedCount}</h4>
                <button class="btn btn-small btn-secondary remove-embed" onclick="removeEmbed('${embedId}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                    Remove
                </button>
            </div>
            <div class="embed-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" class="embed-title" placeholder="Embed title" maxlength="256" value="${embedData?.title || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Description</label>
                        <textarea class="embed-description" placeholder="Embed description" maxlength="4096">${embedData?.description || ''}</textarea>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>URL</label>
                        <input type="url" class="embed-url" placeholder="https://example.com" value="${embedData?.url || ''}">
                    </div>
                    <div class="form-group">
                        <label>Color</label>
                        <input type="color" class="embed-color" value="${embedData?.color ? '#' + embedData.color.toString(16).padStart(6, '0') : '#3b82f6'}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Author Name</label>
                        <input type="text" class="embed-author-name" placeholder="Author name" value="${embedData?.author?.name || ''}">
                    </div>
                    <div class="form-group">
                        <label>Author Icon URL</label>
                        <input type="url" class="embed-author-icon" placeholder="https://example.com/icon.png" value="${embedData?.author?.icon_url || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Author URL</label>
                        <input type="url" class="embed-author-url" placeholder="https://example.com" value="${embedData?.author?.url || ''}">
                    </div>
                    <div class="form-group">
                        <label>Thumbnail URL</label>
                        <input type="url" class="embed-thumbnail" placeholder="https://example.com/thumbnail.jpg" value="${embedData?.thumbnail?.url || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Image URL</label>
                        <input type="url" class="embed-image" placeholder="https://example.com/image.jpg" value="${embedData?.image?.url || ''}">
                    </div>
                    <div class="form-group">
                        <label>Footer Text</label>
                        <input type="text" class="embed-footer-text" placeholder="Footer text" value="${embedData?.footer?.text || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Footer Icon URL</label>
                        <input type="url" class="embed-footer-icon" placeholder="https://example.com/footer-icon.png" value="${embedData?.footer?.icon_url || ''}">
                    </div>
                    <div class="form-group checkbox-group">
                        <label class="custom-checkbox">
                            <input type="checkbox" class="embed-timestamp" ${embedData?.timestamp ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            Include Timestamp
                        </label>
                    </div>
                </div>
                <div class="fields-section">
                    <div class="fields-header">
                        <h4>Fields</h4>
                        <button type="button" class="btn btn-small btn-secondary add-field-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                            Add Field
                        </button>
                    </div>
                    <div class="fields-container">
                        ${embedData?.fields ? embedData.fields.map((field, index) => createFieldHtml(field, index)).join('') : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('embeds-container').insertAdjacentHTML('beforeend', embedHtml);
    
    // Add event listeners for real-time preview
    const embedElement = document.querySelector(`[data-embed-id="${embedId}"]`);
    embedElement.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('input', updatePreview);
    });
    
    // Add field button listener
    embedElement.querySelector('.add-field-btn').addEventListener('click', () => {
        addField(embedId);
    });
    
    updatePreview();
}

function createFieldHtml(field, index) {
    return `
        <div class="field-item" data-field-index="${index}">
            <div class="field-header">
                <span>Field ${index + 1}</span>
                <button type="button" class="btn btn-small btn-secondary remove-field-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                    Remove
                </button>
            </div>
            <div class="field-inputs">
                <div class="form-group">
                    <label>Field Name</label>
                    <input type="text" class="field-name" placeholder="Field name" maxlength="256" value="${field.name || ''}">
                </div>
                <div class="form-group">
                    <label>Field Value</label>
                    <textarea class="field-value" placeholder="Field value" maxlength="1024">${field.value || ''}</textarea>
                </div>
                <div class="form-group checkbox-group">
                    <label class="custom-checkbox">
                        <input type="checkbox" class="field-inline" ${field.inline ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        Inline
                    </label>
                </div>
            </div>
        </div>
    `;
}

function addField(embedId) {
    const embedElement = document.querySelector(`[data-embed-id="${embedId}"]`);
    const fieldsContainer = embedElement.querySelector('.fields-container');
    const fieldCount = fieldsContainer.children.length;
    
    const fieldHtml = createFieldHtml({}, fieldCount);
    fieldsContainer.insertAdjacentHTML('beforeend', fieldHtml);
    
    // Add event listeners
    const newField = fieldsContainer.lastElementChild;
    newField.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('input', updatePreview);
    });
    
    newField.querySelector('.remove-field-btn').addEventListener('click', () => {
        newField.remove();
        updatePreview();
    });
    
    updatePreview();
}

function removeEmbed(embedId) {
    const embedElement = document.querySelector(`[data-embed-id="${embedId}"]`);
    if (embedElement) {
        embedElement.remove();
        updatePreview();
    }
}

function updatePreview() {
    const messageContent = document.getElementById('message-content').value;
    const previewContent = document.getElementById('preview-content');
    const previewEmbeds = document.getElementById('preview-embeds');
    
    // Update message content
    previewContent.textContent = messageContent || 'Type your message here...';
    
    // Update embeds
    previewEmbeds.innerHTML = '';
    
    const embedElements = document.querySelectorAll('.embed-editor');
    embedElements.forEach(embedElement => {
        const embedData = getEmbedData(embedElement);
        if (embedData.title || embedData.description) {
            previewEmbeds.appendChild(createEmbedPreview(embedData));
        }
    });
    
    // Update JSON view if active
    if (document.getElementById('json-view').style.display !== 'none') {
        updateJsonView();
    }
}

function getEmbedData(embedElement) {
    const fields = [];
    embedElement.querySelectorAll('.field-item').forEach(fieldElement => {
        const name = fieldElement.querySelector('.field-name').value;
        const value = fieldElement.querySelector('.field-value').value;
        const inline = fieldElement.querySelector('.field-inline').checked;
        
        if (name || value) {
            fields.push({ name, value, inline });
        }
    });

    return {
        title: embedElement.querySelector('.embed-title').value,
        description: embedElement.querySelector('.embed-description').value,
        url: embedElement.querySelector('.embed-url').value,
        color: parseInt(embedElement.querySelector('.embed-color').value.replace('#', ''), 16),
        author: {
            name: embedElement.querySelector('.embed-author-name').value,
            icon_url: embedElement.querySelector('.embed-author-icon').value,
            url: embedElement.querySelector('.embed-author-url').value
        },
        thumbnail: {
            url: embedElement.querySelector('.embed-thumbnail').value
        },
        image: {
            url: embedElement.querySelector('.embed-image').value
        },
        footer: {
            text: embedElement.querySelector('.embed-footer-text').value,
            icon_url: embedElement.querySelector('.embed-footer-icon').value
        },
        fields: fields,
        timestamp: embedElement.querySelector('.embed-timestamp').checked ? new Date().toISOString() : null
    };
}

function createEmbedPreview(embedData) {
    const embedDiv = document.createElement('div');
    embedDiv.className = 'discord-embed';
    embedDiv.style.borderLeftColor = `#${embedData.color.toString(16).padStart(6, '0')}`;
    
    let embedHtml = '<div class="embed-content">';
    
    if (embedData.author.name) {
        embedHtml += `
            <div class="embed-author">
                ${embedData.author.icon_url ? `<img src="${embedData.author.icon_url}" alt="Author">` : ''}
                <span>${embedData.author.name}</span>
            </div>
        `;
    }
    
    if (embedData.title) {
        const titleTag = embedData.url ? `<a href="${embedData.url}" target="_blank">${embedData.title}</a>` : embedData.title;
        embedHtml += `<div class="embed-title">${titleTag}</div>`;
    }
    
    if (embedData.description) {
        embedHtml += `<div class="embed-description">${embedData.description}</div>`;
    }
    
    if (embedData.fields && embedData.fields.length > 0) {
        embedHtml += '<div class="embed-fields">';
        embedData.fields.forEach(field => {
            embedHtml += `
                <div class="embed-field ${field.inline ? 'inline' : ''}">
                    <div class="field-name">${field.name}</div>
                    <div class="field-value">${field.value}</div>
                </div>
            `;
        });
        embedHtml += '</div>';
    }
    
    if (embedData.thumbnail.url) {
        embedHtml += `<div class="embed-thumbnail"><img src="${embedData.thumbnail.url}" alt="Thumbnail"></div>`;
    }
    
    if (embedData.image.url) {
        embedHtml += `<div class="embed-image"><img src="${embedData.image.url}" alt="Image"></div>`;
    }
    
    if (embedData.footer.text || embedData.timestamp) {
        embedHtml += '<div class="embed-footer">';
        if (embedData.footer.icon_url) {
            embedHtml += `<img src="${embedData.footer.icon_url}" alt="Footer">`;
        }
        if (embedData.footer.text) {
            embedHtml += `<span>${embedData.footer.text}</span>`;
        }
        if (embedData.timestamp) {
            embedHtml += `<span class="timestamp">${embedData.footer.text ? ' • ' : ''}${new Date().toLocaleString()}</span>`;
        }
        embedHtml += '</div>';
    }
    
    embedHtml += '</div>';
    embedDiv.innerHTML = embedHtml;
    
    return embedDiv;
}

function updateJsonView() {
    const messageContent = document.getElementById('message-content').value;
    const embedElements = document.querySelectorAll('.embed-editor');
    
    const embeds = [];
    embedElements.forEach(embedElement => {
        const embedData = getEmbedData(embedElement);
        
        // Clean up empty fields
        const cleanEmbed = {};
        if (embedData.title) cleanEmbed.title = embedData.title;
        if (embedData.description) cleanEmbed.description = embedData.description;
        if (embedData.url) cleanEmbed.url = embedData.url;
        if (embedData.color) cleanEmbed.color = embedData.color;
        
        if (embedData.author.name) {
            cleanEmbed.author = { name: embedData.author.name };
            if (embedData.author.icon_url) cleanEmbed.author.icon_url = embedData.author.icon_url;
            if (embedData.author.url) cleanEmbed.author.url = embedData.author.url;
        }
        
        if (embedData.thumbnail.url) cleanEmbed.thumbnail = { url: embedData.thumbnail.url };
        if (embedData.image.url) cleanEmbed.image = { url: embedData.image.url };
        
        if (embedData.fields && embedData.fields.length > 0) {
            cleanEmbed.fields = embedData.fields;
        }
        
        if (embedData.footer.text || embedData.timestamp) {
            cleanEmbed.footer = {};
            if (embedData.footer.text) cleanEmbed.footer.text = embedData.footer.text;
            if (embedData.footer.icon_url) cleanEmbed.footer.icon_url = embedData.footer.icon_url;
        }
        
        if (embedData.timestamp) cleanEmbed.timestamp = embedData.timestamp;
        
        if (Object.keys(cleanEmbed).length > 0) {
            embeds.push(cleanEmbed);
        }
    });
    
    const messageData = {};
    if (messageContent) messageData.content = messageContent;
    if (embeds.length > 0) messageData.embeds = embeds;
    
    document.getElementById('json-content').value = JSON.stringify(messageData, null, 2);
    lastValidJson = document.getElementById('json-content').value;
}

function saveMessage() {
    // Check if we're in JSON mode and validate JSON
    if (document.getElementById('json-view').style.display !== 'none') {
        const jsonError = document.getElementById('json-error');
        if (jsonError.style.display !== 'none') {
            showNotification('Please fix JSON errors before saving', 'error');
            return;
        }
    }
    
    const messageContent = document.getElementById('message-content').value;
    const embedElements = document.querySelectorAll('.embed-editor');
    
    const embeds = [];
    embedElements.forEach(embedElement => {
        const embedData = getEmbedData(embedElement);
        if (embedData.title || embedData.description) {
            embeds.push(embedData);
        }
    });
    
    const messageData = {
        messageId: currentMessageId || generateMessageId(),
        content: messageContent,
        embeds: embeds,
        type: currentMessageType,
        is_public: false,
        createdAt: currentMessageId ? messages.find(m => m.messageId === currentMessageId)?.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (currentMessageId) {
        // Update existing message
        const index = messages.findIndex(m => m.messageId === currentMessageId);
        if (index !== -1) {
            messages[index] = { ...messages[index], ...messageData };
        }
    } else {
        // Create new message
        messages.unshift(messageData);
    }
    
    localStorage.setItem('userMessages', JSON.stringify(messages));
    showNotification(currentMessageId ? 'Message updated!' : 'Message created!', 'success');
    updateMessagesList();
    updateDashboardStats();
    showMessageList();
}

function generateMessageId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 7; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Publish Modal functionality
function setupPublishModal() {
    const modal = document.getElementById('publish-modal');
    const closeBtn = document.getElementById('close-publish-modal');
    const cancelBtn = document.getElementById('cancel-publish');
    const confirmBtn = document.getElementById('confirm-publish');
    const makePrivateBtn = document.getElementById('make-private');

    [closeBtn, cancelBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
    });

    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmPublish);
    }
    
    if (makePrivateBtn) {
        makePrivateBtn.addEventListener('click', () => {
            const messageId = modal.getAttribute('data-message-id');
            makeMessagePrivate(messageId);
            modal.style.display = 'none';
        });
    }
}

function showPublishModal(messageId) {
    const modal = document.getElementById('publish-modal');
    const message = messages.find(m => m.messageId === messageId);
    const makePrivateBtn = document.getElementById('make-private');
    
    modal.setAttribute('data-message-id', messageId);
    
    if (message && message.is_public) {
        // Show make private option
        makePrivateBtn.style.display = 'inline-block';
        document.getElementById('publish-title').value = message.title || '';
        
        // Set language dropdown
        const languageDropdown = document.getElementById('publish-language-dropdown');
        const languageBtn = languageDropdown.querySelector('.dropdown-btn span');
        if (message.language) {
            languageBtn.textContent = message.language.charAt(0).toUpperCase() + message.language.slice(1);
            languageDropdown.querySelector('.dropdown-btn').setAttribute('data-value', message.language);
        }
        
        document.getElementById('publish-keywords').value = message.keywords ? message.keywords.join(', ') : '';
    } else {
        makePrivateBtn.style.display = 'none';
        // Clear form
        document.getElementById('publish-title').value = '';
        document.getElementById('publish-keywords').value = '';
        
        const languageBtn = document.getElementById('publish-language-dropdown').querySelector('.dropdown-btn span');
        languageBtn.textContent = 'Select Language';
    }
    
    modal.style.display = 'flex';
}

function confirmPublish() {
    const modal = document.getElementById('publish-modal');
    const messageId = modal.getAttribute('data-message-id');
    
    const title = document.getElementById('publish-title').value;
    const languageDropdown = document.getElementById('publish-language-dropdown');
    const language = languageDropdown.querySelector('.dropdown-btn').getAttribute('data-value');
    const keywordsInput = document.getElementById('publish-keywords').value;
    
    if (!title) {
        showNotification('Please enter a title', 'error');
        return;
    }
    
    if (!language) {
        showNotification('Please select a language', 'error');
        return;
    }
    
    // Process keywords
    const keywords = keywordsInput
        .split(/[,\s]+/)
        .map(k => k.trim().toLowerCase())
        .filter(k => k && !['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'].includes(k));
    
    const message = messages.find(m => m.messageId === messageId);
    if (message) {
        message.is_public = true;
        message.title = title;
        message.language = language;
        message.keywords = keywords;
        
        localStorage.setItem('userMessages', JSON.stringify(messages));
        updateMessagesList();
        modal.style.display = 'none';
        showNotification('Message published successfully!', 'success');
        
        // Clear form
        document.getElementById('publish-title').value = '';
        document.getElementById('publish-keywords').value = '';
        const languageBtn = document.getElementById('publish-language-dropdown').querySelector('.dropdown-btn span');
        languageBtn.textContent = 'Select Language';
    }
}

// Community functionality
function setupCommunity() {
    const searchBtn = document.getElementById('search-community');
    const searchInput = document.getElementById('community-search');
    const loadMoreBtn = document.getElementById('load-more-btn');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', searchCommunityMessages);
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchCommunityMessages();
            }
        });
        
        searchInput.addEventListener('input', () => {
            if (searchInput.value.length === 0) {
                loadCommunityMessages();
            }
        });
    }
    
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreCommunityMessages);
    }
    
    // Setup preview modal
    setupPreviewModal();
}

function setupPreviewModal() {
    const modal = document.getElementById('preview-modal');
    const closeBtn = document.getElementById('close-preview-modal');
    const toggleBtns = modal.querySelectorAll('.toggle-btn');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const view = btn.getAttribute('data-view');
            const previewView = document.getElementById('modal-preview-view');
            const jsonView = document.getElementById('modal-json-view');
            
            if (view === 'preview') {
                previewView.style.display = 'block';
                jsonView.style.display = 'none';
            } else {
                previewView.style.display = 'none';
                jsonView.style.display = 'block';
            }
        });
    });
}

async function loadCommunityMessages() {
    const container = document.getElementById('community-messages');
    const loading = document.getElementById('community-loading');
    const loadMoreContainer = document.getElementById('load-more-container');
    
    loading.style.display = 'block';
    container.innerHTML = '';
    communityPage = 0;
    isLoadingCommunity = true;
    
    try {
        // Get public messages from localStorage (simulating API)
        const allMessages = JSON.parse(localStorage.getItem('userMessages') || '[]');
        const publicMessages = allMessages.filter(m => m.is_public);
        
        // Simulate random selection and pagination
        const shuffled = publicMessages.sort(() => 0.5 - Math.random());
        const pageSize = 20;
        const currentPageMessages = shuffled.slice(0, pageSize);
        
        communityMessages = shuffled;
        displayCommunityMessages(currentPageMessages);
        
        if (shuffled.length > pageSize) {
            loadMoreContainer.style.display = 'block';
        } else {
            loadMoreContainer.style.display = 'none';
        }
    } catch (error) {
        container.innerHTML = '<p>Error loading community messages</p>';
    } finally {
        loading.style.display = 'none';
        isLoadingCommunity = false;
    }
}

function loadMoreCommunityMessages() {
    if (isLoadingCommunity) return;
    
    const container = document.getElementById('community-messages');
    const loadMoreContainer = document.getElementById('load-more-container');
    const pageSize = 20;
    
    communityPage++;
    const startIndex = communityPage * pageSize;
    const endIndex = startIndex + pageSize;
    const nextMessages = communityMessages.slice(startIndex, endIndex);
    
    if (nextMessages.length > 0) {
        const newMessagesHtml = nextMessages.map(message => createCommunityMessageCard(message)).join('');
        container.insertAdjacentHTML('beforeend', newMessagesHtml);
        
        // Add event listeners to new cards
        addCommunityCardListeners();
    }
    
    if (endIndex >= communityMessages.length) {
        loadMoreContainer.style.display = 'none';
    }
}

async function searchCommunityMessages() {
    const search = document.getElementById('community-search').value;
    const categoryDropdown = document.getElementById('category-dropdown');
    const languageDropdown = document.getElementById('language-dropdown');
    
    const category = categoryDropdown.querySelector('.dropdown-btn').getAttribute('data-value') || '';
    const language = languageDropdown.querySelector('.dropdown-btn').getAttribute('data-value') || '';
    
    const container = document.getElementById('community-messages');
    const loading = document.getElementById('community-loading');
    const loadMoreContainer = document.getElementById('load-more-container');
    
    loading.style.display = 'block';
    container.innerHTML = '';
    isLoadingCommunity = true;
    
    try {
        // Get all public messages
        const allMessages = JSON.parse(localStorage.getItem('userMessages') || '[]');
        let filteredMessages = allMessages.filter(m => m.is_public);
        
        // Apply filters
        if (category) {
            filteredMessages = filteredMessages.filter(m => m.type === category);
        }
        
        if (language) {
            filteredMessages = filteredMessages.filter(m => m.language === language);
        }
        
        // Apply search
        if (search) {
            const searchTerms = search.toLowerCase().split(/[,\s]+/).filter(term => term);
            
            // Check for ID search (starts with #)
            const idSearch = searchTerms.find(term => term.startsWith('#'));
            if (idSearch) {
                const messageId = idSearch.substring(1);
                filteredMessages = filteredMessages.filter(m => m.messageId.toLowerCase().includes(messageId.toLowerCase()));
            } else {
                // Regular keyword search
                filteredMessages = filteredMessages.filter(message => {
                    const searchableText = [
                        message.title || '',
                        message.content || '',
                        ...(message.keywords || [])
                    ].join(' ').toLowerCase();
                    
                    return searchTerms.some(term => searchableText.includes(term));
                });
            }
        }
        
        communityMessages = filteredMessages;
        displayCommunityMessages(filteredMessages.slice(0, 20));
        
        if (filteredMessages.length > 20) {
            loadMoreContainer.style.display = 'block';
        } else {
            loadMoreContainer.style.display = 'none';
        }
    } catch (error) {
        container.innerHTML = '<p>Error searching messages</p>';
    } finally {
        loading.style.display = 'none';
        isLoadingCommunity = false;
    }
}

function displayCommunityMessages(messages) {
    const container = document.getElementById('community-messages');
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="no-results"><p>No messages found</p></div>';
        return;
    }
    
    container.innerHTML = messages.map(message => createCommunityMessageCard(message)).join('');
    addCommunityCardListeners();
}

function createCommunityMessageCard(message) {
    return `
        <div class="community-message-card">
            <div class="community-message-header">
                <h3>${message.title || 'Untitled Message'}</h3>
                <div class="community-message-meta">
                    <span class="category-badge">${message.type || 'other'}</span>
                    <span class="language-badge">${message.language || 'unknown'}</span>
                    <span class="author">ID: ${message.messageId}</span>
                </div>
            </div>
            <div class="community-message-content">
                <p>${message.content ? message.content.substring(0, 150) + (message.content.length > 150 ? '...' : '') : 'No content'}</p>
                ${message.embeds && message.embeds.length > 0 ? `<span class="embed-count">${message.embeds.length} embed${message.embeds.length !== 1 ? 's' : ''}</span>` : ''}
            </div>
            <div class="community-message-tags">
                ${message.keywords ? message.keywords.slice(0, 5).map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
            </div>
            <div class="community-message-actions">
                <button class="btn btn-secondary use-message-btn" data-message-id="${message.messageId}">Use Message</button>
                <button class="btn btn-outline preview-message-btn" data-message-id="${message.messageId}">Preview</button>
            </div>
        </div>
    `;
}

function addCommunityCardListeners() {
    document.querySelectorAll('.use-message-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const messageId = btn.getAttribute('data-message-id');
            useMessage(messageId);
        });
    });
    
    document.querySelectorAll('.preview-message-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const messageId = btn.getAttribute('data-message-id');
            previewMessage(messageId);
        });
    });
}

function useMessage(messageId) {
    const allMessages = JSON.parse(localStorage.getItem('userMessages') || '[]');
    const message = allMessages.find(m => m.messageId === messageId);
    
    if (!message) {
        showNotification('Message not found', 'error');
        return;
    }
    
    // Switch to message builder
    document.querySelector('[data-section="message-builder"]').click();
    currentMessageType = message.type;
    showMessageBuilder();
    
    // Populate form with message data
    populateMessageForm(message);
    
    showNotification('Message loaded for editing!', 'success');
}

function previewMessage(messageId) {
    const allMessages = JSON.parse(localStorage.getItem('userMessages') || '[]');
    const message = allMessages.find(m => m.messageId === messageId);
    
    if (!message) {
        showNotification('Message not found', 'error');
        return;
    }
    
    const modal = document.getElementById('preview-modal');
    const previewContent = document.getElementById('modal-preview-content');
    const previewEmbeds = document.getElementById('modal-preview-embeds');
    const jsonContent = document.getElementById('modal-json-content');
    
    // Update preview
    previewContent.textContent = message.content || 'No content';
    
    previewEmbeds.innerHTML = '';
    if (message.embeds && message.embeds.length > 0) {
        message.embeds.forEach(embedData => {
            previewEmbeds.appendChild(createEmbedPreview(embedData));
        });
    }
    
    // Update JSON
    const messageData = {
        content: message.content,
        embeds: message.embeds || []
    };
    jsonContent.textContent = JSON.stringify(messageData, null, 2);
    
    // Reset to preview mode
    const toggleBtns = modal.querySelectorAll('.toggle-btn');
    toggleBtns.forEach(btn => btn.classList.remove('active'));
    toggleBtns[0].classList.add('active');
    
    document.getElementById('modal-preview-view').style.display = 'block';
    document.getElementById('modal-json-view').style.display = 'none';
    
    modal.style.display = 'flex';
}

function updateDashboardStats() {
    const totalMessagesElement = document.getElementById('total-messages');
    const publicMessagesElement = document.getElementById('public-messages');
    
    if (totalMessagesElement) {
        totalMessagesElement.textContent = messages.length;
    }
    
    if (publicMessagesElement) {
        const publicCount = messages.filter(m => m.is_public).length;
        publicMessagesElement.textContent = publicCount;
    }
}

// Other features (stubs)
function setupOtherFeatures() {
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.message-menu') && !e.target.closest('.custom-dropdown')) {
            closeAllDropdowns();
        }
    });
    
    // Infinite scroll for community
    window.addEventListener('scroll', () => {
        if (document.getElementById('community').classList.contains('active')) {
            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            if (scrollTop + clientHeight >= scrollHeight - 5 && !isLoadingCommunity) {
                const loadMoreContainer = document.getElementById('load-more-container');
                if (loadMoreContainer.style.display !== 'none') {
                    loadMoreCommunityMessages();
                }
            }
        }
    });
}

// Notification system
function showNotification(message, type = 'success') {
    const container = document.getElementById('notification-container') || createNotifContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', () => {
            notification.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        });
    }, 3000);
}

function createNotifContainer() {
    let container = document.createElement('div');
    container.id = 'notification-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '2000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    document.body.appendChild(container);

    const style = document.createElement('style');
    style.textContent = `
        .notification {
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            transform: translateX(120%);
            transition: transform 0.3s ease-in-out;
        }
        .notification.show {
            transform: translateX(0);
        }
        .notification.success { background: linear-gradient(45deg, #10b981, #059669); }
        .notification.error { background: linear-gradient(45deg, #ef4444, #dc2626); }
        .notification.info { background: linear-gradient(45deg, #3b82f6, #2563eb); }
    `;
    document.head.appendChild(style);

    return container;
}