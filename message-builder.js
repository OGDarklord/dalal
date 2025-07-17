// Global state
let currentUser = null;
let messages = [];
let currentMessageId = null;
let currentMessageType = null;
let currentEmbedIndex = 0;
let lastValidJson = null;
let minecraftServers = [];
let currentMinecraftServer = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    populateServerSwitcher();
    updateDashboardUserDisplay();
    setupMinecraftSection();
});

async function initializeApp() {
    try {
        const response = await fetch('/api/auth/user');
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            hideAuthModal();
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
    
    // Form auto-updates
    setupFormUpdates();
    
    // Other features
    setupOtherFeatures();
}

// Navigation functionality
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
                loadCommunitySection();
            }
        });
    });
}

// Authentication functionality
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

async function updateDashboardUserDisplay() {
    try {
        const res = await fetch('/api/auth/user');
        if (res.ok) {
            const { user } = await res.json();
            const avatarEl = document.getElementById('user-avatar-dashboard');
            const usernameEl = document.getElementById('user-username-dashboard');
            if (avatarEl && usernameEl) {
                avatarEl.src = `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`;
                usernameEl.textContent = user.username;
            }
        }
    } catch (error) {
        console.error('Failed to update user display:', error);
    }
}

async function populateServerSwitcher() {
    try {
        const params = new URLSearchParams(window.location.search);
        const currentGuildId = params.get('guild');

        const res = await fetch('/api/guilds/mutual');
        const guilds = await res.json();

        const currentGuild = guilds.find(g => g.id === currentGuildId);
        const switcherBtn = document.getElementById('server-switcher-btn');
        
        if (currentGuild && switcherBtn) {
            switcherBtn.innerHTML = `
                ${currentGuild.icon ? `<img src="https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.png" />` : `<div class="server-icon-initial">${currentGuild.name.charAt(0)}</div>`}
                <span>${currentGuild.name}</span>
                <span class="chevron">▼</span>
            `;
        }
    } catch (error) {
        console.error('Failed to populate server switcher:', error);
    }
}

// Message Builder functionality
function setupMessageBuilder() {
    const createNewBtn = document.getElementById('create-new-message');
    const createFirstBtn = document.getElementById('create-first-message');
    const backToListBtn = document.getElementById('back-to-list');
    const saveMessageBtn = document.getElementById('save-message');
    const addEmbedBtn = document.getElementById('add-embed-btn');

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

    // View toggle
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            toggleView(view);
        });
    });

    // Message type modal
    setupMessageTypeModal();
    
    // Publish modal
    setupPublishModal();
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
        card.addEventListener('click', function() {
            const type = this.getAttribute('data-type');
            currentMessageType = type;
            modal.style.display = 'none';
            showMessageBuilder();
            setupPlaceholders(type);
        });
    });
}

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
        confirmBtn.addEventListener('click', () => publishMessage());
    }

    if (makePrivateBtn) {
        makePrivateBtn.addEventListener('click', () => makeMessagePrivate());
    }
}

function showMessageTypeModal() {
    document.getElementById('message-type-modal').style.display = 'flex';
}

function loadMessageBuilderSection() {
    if (currentUser) {
        loadUserMessages();
    }
    showMessageList();
}

function loadCommunitySection() {
    loadCommunityMessages();
}

async function loadUserMessages() {
    // For now, use local storage or mock data
    const storedMessages = localStorage.getItem('userMessages');
    if (storedMessages) {
        messages = JSON.parse(storedMessages);
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
        return;
    }

    if (messages.length === 0) {
        messageCardsContainer.style.display = 'none';
        noMessagesMessage.style.display = 'block';
    } else {
        messageCardsContainer.style.display = 'grid';
        noMessagesMessage.style.display = 'none';
        
        messageCardsContainer.innerHTML = messages.map(message => createMessageCard(message)).join('');
        
        // Add event listeners
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
    const truncatedDescription = message.content ? 
        (message.content.length > 100 ? message.content.substring(0, 100) + '...' : message.content) : 
        'No content';

    // Determine card class based on public status
    const cardClass = message.is_public ? 'message-card-item public' : 'message-card-item';
    
    // Show message type instead of public label
    const typeLabel = message.type ? getTypeLabel(message.type) : 'Other';
    const typeColor = getTypeColor(message.type);

    return `
        <div class="${cardClass}" data-message-id="${message.messageId}">
            <div class="message-card-header">
                <div class="message-card-info">
                    <h3 class="message-card-title">${message.title || 'Untitled Message'}</h3>
                    <p class="message-card-description">${truncatedDescription}</p>
                </div>
                <div class="message-menu">
                    <button class="message-menu-btn">⋮</button>
                    <div class="message-menu-dropdown">
                        <button class="message-menu-item" data-action="copy-id">Copy ID</button>
                        <button class="message-menu-item" data-action="publish">${message.is_public ? 'Make Private' : 'Publish'}</button>
                        <button class="message-menu-item" data-action="delete">Delete</button>
                    </div>
                </div>
            </div>
            <div class="message-card-meta">
                <div class="message-card-stats">
                    <span class="embed-count">${message.embeds ? message.embeds.length : 0} embed${message.embeds && message.embeds.length !== 1 ? 's' : ''}</span>
                    <span class="type-badge" style="background-color: ${typeColor}">${typeLabel}</span>
                </div>
                <div class="message-card-bottom">
                    <span class="message-card-id">${message.messageId}</span>
                    <span class="message-card-date">${createdDate}</span>
                </div>
            </div>
        </div>
    `;
}

function getTypeLabel(type) {
    const labels = {
        welcome: 'Welcome',
        leave: 'Leave',
        ban: 'Ban',
        announcement: 'Announcement',
        ticket: 'Ticket',
        other: 'Other'
    };
    return labels[type] || 'Other';
}

function getTypeColor(type) {
    const colors = {
        welcome: '#10b981',
        leave: '#ef4444',
        ban: '#dc2626',
        announcement: '#3b82f6',
        ticket: '#8b5cf6',
        other: '#6b7280'
    };
    return colors[type] || '#6b7280';
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
        case 'publish':
            if (message.is_public) {
                makeMessagePrivate(messageId);
            } else {
                showPublishModal(messageId);
            }
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

function showMessageList() {
    document.getElementById('message-list-view').style.display = 'block';
    document.getElementById('message-builder-view').style.display = 'none';
    currentMessageId = null;
}

function showMessageBuilder(messageId = null) {
    document.getElementById('message-list-view').style.display = 'none';
    document.getElementById('message-builder-view').style.display = 'block';
    
    currentMessageId = messageId;
    
    if (messageId) {
        document.getElementById('builder-title').textContent = 'Edit Message';
        loadMessageForEditing(messageId);
    } else {
        document.getElementById('builder-title').textContent = 'Create New Message';
        clearMessageForm();
        updateMessagePreview();
    }
}

function editMessage(messageId) {
    showMessageBuilder(messageId);
}

function loadMessageForEditing(messageId) {
    const message = messages.find(m => m.messageId === messageId);
    if (message) {
        populateMessageForm(message);
        currentMessageType = message.type;
        setupPlaceholders(message.type);
        updateMessagePreview();
    }
}

function populateMessageForm(message) {
    document.getElementById('message-content').value = message.content || '';
    
    // Clear existing embeds
    document.getElementById('embeds-container').innerHTML = '';
    
    // Add embeds
    if (message.embeds && message.embeds.length > 0) {
        message.embeds.forEach((embed, index) => {
            addEmbed(embed, index);
        });
    }
}

function clearMessageForm() {
    document.getElementById('message-content').value = '';
    document.getElementById('embeds-container').innerHTML = '';
    currentEmbedIndex = 0;
}

function setupPlaceholders(type) {
    const placeholdersGrid = document.getElementById('placeholders-grid');
    const placeholders = getPlaceholdersForType(type);
    
    placeholdersGrid.innerHTML = placeholders.map(placeholder => `
        <div class="placeholder-item" data-placeholder="${placeholder.value}">
            <span class="placeholder-name">${placeholder.name}</span>
            <span class="placeholder-value">${placeholder.value}</span>
        </div>
    `).join('');
    
    // Add click listeners
    placeholdersGrid.querySelectorAll('.placeholder-item').forEach(item => {
        item.addEventListener('click', function() {
            const placeholder = this.getAttribute('data-placeholder');
            insertPlaceholder(placeholder);
        });
    });
}

function getPlaceholdersForType(type) {
    const commonPlaceholders = [
        { name: 'User Mention', value: '{user}' },
        { name: 'Username', value: '{username}' },
        { name: 'User ID', value: '{userid}' },
        { name: 'Server Name', value: '{server}' },
        { name: 'Member Count', value: '{membercount}' }
    ];
    
    const typePlaceholders = {
        welcome: [
            ...commonPlaceholders,
            { name: 'Join Date', value: '{joindate}' },
            { name: 'Account Age', value: '{accountage}' }
        ],
        leave: [
            ...commonPlaceholders,
            { name: 'Leave Date', value: '{leavedate}' },
            { name: 'Time in Server', value: '{timeinserver}' }
        ],
        ban: [
            ...commonPlaceholders,
            { name: 'Ban Reason', value: '{banreason}' },
            { name: 'Banned By', value: '{bannedby}' }
        ],
        announcement: [
            ...commonPlaceholders,
            { name: 'Date', value: '{date}' },
            { name: 'Time', value: '{time}' }
        ],
        ticket: [
            ...commonPlaceholders,
            { name: 'Ticket ID', value: '{ticketid}' },
            { name: 'Category', value: '{category}' }
        ]
    };
    
    return typePlaceholders[type] || commonPlaceholders;
}

function insertPlaceholder(placeholder) {
    const messageContent = document.getElementById('message-content');
    const start = messageContent.selectionStart;
    const end = messageContent.selectionEnd;
    const text = messageContent.value;
    
    messageContent.value = text.substring(0, start) + placeholder + text.substring(end);
    messageContent.focus();
    messageContent.setSelectionRange(start + placeholder.length, start + placeholder.length);
    
    updateMessagePreview();
}

function addEmbed(embedData = null, index = null) {
    const embedsContainer = document.getElementById('embeds-container');
    const embedIndex = index !== null ? index : currentEmbedIndex++;
    
    const embedHtml = createEmbedEditor(embedData, embedIndex);
    embedsContainer.insertAdjacentHTML('beforeend', embedHtml);
    
    // Setup event listeners for the new embed
    setupEmbedEventListeners(embedIndex);
    
    updateMessagePreview();
}

function createEmbedEditor(embedData = null, index) {
    const embed = embedData || {};
    
    return `
        <div class="embed-editor" data-embed-index="${index}">
            <div class="embed-header">
                <h4>Embed ${index + 1}</h4>
                <button class="btn btn-small btn-secondary remove-embed-btn" data-embed-index="${index}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                    Remove
                </button>
            </div>
            
            <div class="embed-form">
                <!-- Color Picker -->
                <div class="form-group color-group">
                    <label>Color</label>
                    <div class="color-picker-container">
                        <button class="color-picker-btn" data-embed-index="${index}">
                            <div class="color-preview" style="background-color: ${embed.color || '#3b82f6'}"></div>
                            Toggle color picker
                        </button>
                        <div class="color-picker-dropdown" style="display: none;">
                            <div class="color-grid">
                                <div class="color-option" data-color="#3b82f6" style="background-color: #3b82f6"></div>
                                <div class="color-option" data-color="#10b981" style="background-color: #10b981"></div>
                                <div class="color-option" data-color="#f59e0b" style="background-color: #f59e0b"></div>
                                <div class="color-option" data-color="#ef4444" style="background-color: #ef4444"></div>
                                <div class="color-option" data-color="#8b5cf6" style="background-color: #8b5cf6"></div>
                                <div class="color-option" data-color="#06b6d4" style="background-color: #06b6d4"></div>
                                <div class="color-option" data-color="#84cc16" style="background-color: #84cc16"></div>
                                <div class="color-option" data-color="#f97316" style="background-color: #f97316"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Author Section -->
                <div class="form-group">
                    <label>Author Icon URL</label>
                    <input type="url" class="embed-input" data-field="author.icon_url" data-embed-index="${index}" value="${embed.author?.icon_url || ''}" placeholder="https://example.com/icon.png">
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Author Name</label>
                        <input type="text" class="embed-input" data-field="author.name" data-embed-index="${index}" value="${embed.author?.name || ''}" placeholder="Author name">
                    </div>
                    <div class="form-group">
                        <label>Author URL</label>
                        <input type="url" class="embed-input" data-field="author.url" data-embed-index="${index}" value="${embed.author?.url || ''}" placeholder="https://example.com">
                    </div>
                </div>
                
                <!-- Title Section -->
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" class="embed-input" data-field="title" data-embed-index="${index}" value="${embed.title || ''}" placeholder="Embed title" maxlength="256">
                    <div class="char-count">0/256</div>
                </div>
                
                <div class="form-group">
                    <label>Title URL</label>
                    <input type="url" class="embed-input" data-field="url" data-embed-index="${index}" value="${embed.url || ''}" placeholder="https://example.com">
                </div>
                
                <!-- Description -->
                <div class="form-group">
                    <label>Description</label>
                    <textarea class="embed-input" data-field="description" data-embed-index="${index}" placeholder="Embed description" maxlength="2048">${embed.description || ''}</textarea>
                    <div class="char-count">0/2048</div>
                </div>
                
                <!-- Fields -->
                <div class="form-group">
                    <label>Fields</label>
                    <div class="fields-container" data-embed-index="${index}">
                        ${embed.fields ? embed.fields.map((field, fieldIndex) => createFieldEditor(field, index, fieldIndex)).join('') : ''}
                    </div>
                    <button class="btn btn-secondary add-field-btn" data-embed-index="${index}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                        Add field
                    </button>
                    <div class="field-count">0/25 fields</div>
                </div>
                
                <!-- Images -->
                <div class="form-row">
                    <div class="form-group">
                        <label>Image URL (big at the bottom)</label>
                        <input type="url" class="embed-input" data-field="image.url" data-embed-index="${index}" value="${embed.image?.url || ''}" placeholder="https://example.com/image.png">
                    </div>
                    <div class="form-group">
                        <label>Thumbnail URL (small top right)</label>
                        <input type="url" class="embed-input" data-field="thumbnail.url" data-embed-index="${index}" value="${embed.thumbnail?.url || ''}" placeholder="https://example.com/thumbnail.png">
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="form-row">
                    <div class="form-group">
                        <label>Footer</label>
                        <input type="text" class="embed-input" data-field="footer.text" data-embed-index="${index}" value="${embed.footer?.text || ''}" placeholder="Footer text" maxlength="2048">
                        <div class="char-count">0/2048</div>
                    </div>
                    <div class="form-group">
                        <label>Footer Icon</label>
                        <input type="url" class="embed-input" data-field="footer.icon_url" data-embed-index="${index}" value="${embed.footer?.icon_url || ''}" placeholder="https://example.com/icon.png">
                    </div>
                </div>
                
                <!-- Timestamp and Color -->
                <div class="form-row">
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" class="embed-checkbox" data-field="timestamp" data-embed-index="${index}" ${embed.timestamp ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            Include timestamp
                        </label>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createFieldEditor(field = {}, embedIndex, fieldIndex) {
    return `
        <div class="field-editor" data-embed-index="${embedIndex}" data-field-index="${fieldIndex}">
            <div class="field-header">
                <span>Field ${fieldIndex + 1}</span>
                <button class="btn btn-small btn-secondary remove-field-btn" data-embed-index="${embedIndex}" data-field-index="${fieldIndex}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                    Remove
                </button>
            </div>
            <div class="field-inputs">
                <input type="text" class="field-input" data-field="name" placeholder="Field name" value="${field.name || ''}" maxlength="256">
                <textarea class="field-input" data-field="value" placeholder="Field value" maxlength="1024">${field.value || ''}</textarea>
                <label class="checkbox-label">
                    <input type="checkbox" class="field-checkbox" data-field="inline" ${field.inline ? 'checked' : ''}>
                    <span class="checkmark"></span>
                    Inline
                </label>
            </div>
        </div>
    `;
}

function setupEmbedEventListeners(embedIndex) {
    const embedEditor = document.querySelector(`[data-embed-index="${embedIndex}"]`);
    
    // Remove embed button
    const removeBtn = embedEditor.querySelector('.remove-embed-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => removeEmbed(embedIndex));
    }
    
    // Color picker
    const colorBtn = embedEditor.querySelector('.color-picker-btn');
    const colorDropdown = embedEditor.querySelector('.color-picker-dropdown');
    
    if (colorBtn && colorDropdown) {
        colorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            colorDropdown.style.display = colorDropdown.style.display === 'none' ? 'block' : 'none';
        });
        
        colorDropdown.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', function() {
                const color = this.getAttribute('data-color');
                setEmbedColor(embedIndex, color);
                colorDropdown.style.display = 'none';
            });
        });
    }
    
    // Input listeners
    embedEditor.querySelectorAll('.embed-input, .embed-checkbox').forEach(input => {
        input.addEventListener('input', () => updateMessagePreview());
        input.addEventListener('change', () => updateMessagePreview());
    });
    
    // Add field button
    const addFieldBtn = embedEditor.querySelector('.add-field-btn');
    if (addFieldBtn) {
        addFieldBtn.addEventListener('click', () => addField(embedIndex));
    }
    
    // Field listeners
    setupFieldListeners(embedIndex);
}

function setupFieldListeners(embedIndex) {
    const embedEditor = document.querySelector(`[data-embed-index="${embedIndex}"]`);
    const fieldsContainer = embedEditor.querySelector('.fields-container');
    
    fieldsContainer.querySelectorAll('.remove-field-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const fieldIndex = this.getAttribute('data-field-index');
            removeField(embedIndex, fieldIndex);
        });
    });
    
    fieldsContainer.querySelectorAll('.field-input, .field-checkbox').forEach(input => {
        input.addEventListener('input', () => updateMessagePreview());
        input.addEventListener('change', () => updateMessagePreview());
    });
}

function setEmbedColor(embedIndex, color) {
    const embedEditor = document.querySelector(`[data-embed-index="${embedIndex}"]`);
    const colorPreview = embedEditor.querySelector('.color-preview');
    colorPreview.style.backgroundColor = color;
    updateMessagePreview();
}

function addField(embedIndex) {
    const embedEditor = document.querySelector(`[data-embed-index="${embedIndex}"]`);
    const fieldsContainer = embedEditor.querySelector('.fields-container');
    const fieldCount = fieldsContainer.children.length;
    
    if (fieldCount >= 25) {
        showNotification('Maximum 25 fields allowed per embed', 'error');
        return;
    }
    
    const fieldHtml = createFieldEditor({}, embedIndex, fieldCount);
    fieldsContainer.insertAdjacentHTML('beforeend', fieldHtml);
    
    setupFieldListeners(embedIndex);
    updateFieldCount(embedIndex);
    updateMessagePreview();
}

function removeField(embedIndex, fieldIndex) {
    const fieldEditor = document.querySelector(`[data-embed-index="${embedIndex}"][data-field-index="${fieldIndex}"]`);
    if (fieldEditor) {
        fieldEditor.remove();
        updateFieldCount(embedIndex);
        updateMessagePreview();
    }
}

function updateFieldCount(embedIndex) {
    const embedEditor = document.querySelector(`[data-embed-index="${embedIndex}"]`);
    const fieldsContainer = embedEditor.querySelector('.fields-container');
    const fieldCount = fieldsContainer.children.length;
    const countDisplay = embedEditor.querySelector('.field-count');
    countDisplay.textContent = `${fieldCount}/25 fields`;
}

function removeEmbed(embedIndex) {
    const embedEditor = document.querySelector(`[data-embed-index="${embedIndex}"]`);
    if (embedEditor) {
        embedEditor.remove();
        updateMessagePreview();
    }
}

function toggleView(view) {
    const guiView = document.getElementById('gui-view');
    const jsonView = document.getElementById('json-view');
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    
    toggleBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    
    if (view === 'gui') {
        guiView.style.display = 'flex';
        jsonView.style.display = 'none';
    } else {
        guiView.style.display = 'none';
        jsonView.style.display = 'block';
        updateJsonView();
    }
}

function updateJsonView() {
    const jsonContent = document.getElementById('json-content');
    const messageData = getMessageData();
    
    try {
        jsonContent.value = JSON.stringify(messageData, null, 2);
        lastValidJson = messageData;
        hideJsonError();
    } catch (error) {
        showJsonError();
    }
}

function showJsonError() {
    document.getElementById('json-error').style.display = 'flex';
    document.getElementById('json-content').classList.add('error');
}

function hideJsonError() {
    document.getElementById('json-error').style.display = 'none';
    document.getElementById('json-content').classList.remove('error');
}

function getMessageData() {
    const content = document.getElementById('message-content').value;
    const embeds = [];
    
    document.querySelectorAll('.embed-editor').forEach(embedEditor => {
        const embed = {};
        
        // Get color
        const colorPreview = embedEditor.querySelector('.color-preview');
        if (colorPreview) {
            const color = colorPreview.style.backgroundColor;
            embed.color = hexToDecimal(rgbToHex(color));
        }
        
        // Get all embed fields
        embedEditor.querySelectorAll('.embed-input').forEach(input => {
            const field = input.getAttribute('data-field');
            const value = input.value.trim();
            
            if (value) {
                setNestedProperty(embed, field, value);
            }
        });
        
        // Get checkboxes
        embedEditor.querySelectorAll('.embed-checkbox').forEach(checkbox => {
            const field = checkbox.getAttribute('data-field');
            if (checkbox.checked) {
                if (field === 'timestamp') {
                    embed.timestamp = new Date().toISOString();
                }
            }
        });
        
        // Get fields
        const fieldsContainer = embedEditor.querySelector('.fields-container');
        if (fieldsContainer && fieldsContainer.children.length > 0) {
            embed.fields = [];
            
            Array.from(fieldsContainer.children).forEach(fieldEditor => {
                const field = {};
                const nameInput = fieldEditor.querySelector('[data-field="name"]');
                const valueInput = fieldEditor.querySelector('[data-field="value"]');
                const inlineCheckbox = fieldEditor.querySelector('[data-field="inline"]');
                
                if (nameInput && nameInput.value.trim()) {
                    field.name = nameInput.value.trim();
                }
                if (valueInput && valueInput.value.trim()) {
                    field.value = valueInput.value.trim();
                }
                if (inlineCheckbox && inlineCheckbox.checked) {
                    field.inline = true;
                }
                
                if (field.name && field.value) {
                    embed.fields.push(field);
                }
            });
        }
        
        // Only add embed if it has content
        if (Object.keys(embed).length > 0) {
            embeds.push(embed);
        }
    });
    
    return {
        content: content || null,
        embeds: embeds.length > 0 ? embeds : null
    };
}

function setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
            current[keys[i]] = {};
        }
        current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
}

function hexToDecimal(hex) {
    return parseInt(hex.replace('#', ''), 16);
}

function rgbToHex(rgb) {
    if (rgb.startsWith('#')) return rgb;
    
    const result = rgb.match(/\d+/g);
    if (!result || result.length < 3) return '#3b82f6';
    
    return '#' + ((1 << 24) + (parseInt(result[0]) << 16) + (parseInt(result[1]) << 8) + parseInt(result[2])).toString(16).slice(1);
}

function saveMessage() {
    try {
        const messageData = getMessageData();
        
        if (!messageData.content && (!messageData.embeds || messageData.embeds.length === 0)) {
            showNotification('Message must have content or at least one embed', 'error');
            return;
        }
        
        const messageId = currentMessageId || generateMessageId();
        const message = {
            messageId,
            ...messageData,
            type: currentMessageType,
            is_public: false,
            createdAt: currentMessageId ? messages.find(m => m.messageId === currentMessageId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        if (currentMessageId) {
            // Update existing message
            const index = messages.findIndex(m => m.messageId === currentMessageId);
            if (index !== -1) {
                messages[index] = { ...messages[index], ...message };
            }
        } else {
            // Create new message
            messages.push(message);
        }
        
        localStorage.setItem('userMessages', JSON.stringify(messages));
        
        showNotification(currentMessageId ? 'Message updated!' : 'Message created!', 'success');
        showMessageList();
        updateMessagesList();
        updateDashboardStats();
        
    } catch (error) {
        showNotification('Error saving message', 'error');
        console.error('Save error:', error);
    }
}

function generateMessageId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 7; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Minecraft Section Setup
function setupMinecraftSection() {
    const addServerBtn = document.getElementById('add-minecraft-server');
    const setupModal = document.getElementById('minecraft-setup-modal');
    const closeSetupBtn = document.getElementById('close-minecraft-setup');
    const cancelSetupBtn = document.getElementById('cancel-minecraft-setup');
    const saveServerBtn = document.getElementById('save-minecraft-server');
    const passwordToggle = document.getElementById('toggle-mc-password');
    const authModal = document.getElementById('minecraft-auth-modal');
    const closeAuthBtn = document.getElementById('close-minecraft-auth');
    const cancelAuthBtn = document.getElementById('cancel-minecraft-auth');
    const authenticateBtn = document.getElementById('authenticate-minecraft');
    const authPasswordToggle = document.getElementById('toggle-auth-password');
    const backToDashboardBtn = document.getElementById('back-to-main-dashboard');

    // Load existing servers
    loadMinecraftServers();

    // Add server button
    addServerBtn?.addEventListener('click', () => {
        setupModal.style.display = 'flex';
    });

    // Close setup modal
    [closeSetupBtn, cancelSetupBtn].forEach(btn => {
        btn?.addEventListener('click', () => {
            setupModal.style.display = 'none';
            document.getElementById('minecraft-server-form').reset();
        });
    });

    // Password toggle for setup
    passwordToggle?.addEventListener('click', () => {
        const passwordInput = document.getElementById('mc-password');
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        
        passwordToggle.innerHTML = isPassword ? 
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>' :
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';
    });

    // Save server
    saveServerBtn?.addEventListener('click', () => {
        saveMinecraftServer();
    });

    // Close auth modal
    [closeAuthBtn, cancelAuthBtn].forEach(btn => {
        btn?.addEventListener('click', () => {
            authModal.style.display = 'none';
            document.getElementById('auth-password').value = '';
        });
    });

    // Password toggle for auth
    authPasswordToggle?.addEventListener('click', () => {
        const passwordInput = document.getElementById('auth-password');
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        
        authPasswordToggle.innerHTML = isPassword ? 
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>' :
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';
    });

    // Authenticate server access
    authenticateBtn?.addEventListener('click', () => {
        authenticateMinecraftServer();
    });

    // Back to main dashboard
    backToDashboardBtn?.addEventListener('click', () => {
        document.getElementById('minecraft-dashboard').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        currentMinecraftServer = null;
    });

    // Setup minecraft navigation
    setupMinecraftNavigation();
    setupMinecraftConsole();
}

function loadMinecraftServers() {
    // Load from localStorage for now (in real app, load from database)
    const stored = localStorage.getItem('minecraftServers');
    if (stored) {
        minecraftServers = JSON.parse(stored);
        updateMinecraftDisplay();
    }
}

function saveMinecraftServer() {
    const form = document.getElementById('minecraft-server-form');
    const formData = new FormData(form);
    
    const serverData = {
        id: generateId(),
        name: document.getElementById('mc-server-name').value,
        description: document.getElementById('mc-description').value,
        ip: document.getElementById('mc-server-ip').value,
        port: document.getElementById('mc-port').value,
        rconIp: document.getElementById('mc-rcon-ip').value,
        rconPort: document.getElementById('mc-rcon-port').value,
        rconSecret: document.getElementById('mc-rcon-secret').value,
        password: document.getElementById('mc-password').value,
        createdAt: new Date().toISOString()
    };

    // Validate IP format
    const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipPattern.test(serverData.rconIp)) {
        showNotification('Invalid RCON IP format', 'error');
        return;
    }

    minecraftServers.push(serverData);
    localStorage.setItem('minecraftServers', JSON.stringify(minecraftServers));
    
    document.getElementById('minecraft-setup-modal').style.display = 'none';
    form.reset();
    updateMinecraftDisplay();
    showNotification('Minecraft server added successfully!', 'success');
}

function updateMinecraftDisplay() {
    const noSetup = document.getElementById('no-minecraft-setup');
    const serversContainer = document.getElementById('minecraft-servers');
    
    if (minecraftServers.length === 0) {
        noSetup.style.display = 'block';
        serversContainer.style.display = 'none';
    } else {
        noSetup.style.display = 'none';
        serversContainer.style.display = 'grid';
        serversContainer.innerHTML = minecraftServers.map(server => createMinecraftServerCard(server)).join('');
        
        // Add event listeners to server cards
        serversContainer.querySelectorAll('.minecraft-server-card').forEach(card => {
            card.addEventListener('click', function(e) {
                if (!e.target.closest('.server-menu')) {
                    const serverId = this.getAttribute('data-server-id');
                    showMinecraftAuth(serverId);
                }
            });
        });
        
        // Add menu event listeners
        serversContainer.querySelectorAll('.server-menu-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const dropdown = this.nextElementSibling;
                closeAllDropdowns();
                dropdown.classList.toggle('show');
            });
        });
        
        serversContainer.querySelectorAll('.server-menu-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                const action = this.getAttribute('data-action');
                const serverId = this.closest('.minecraft-server-card').getAttribute('data-server-id');
                handleMinecraftServerAction(action, serverId);
                closeAllDropdowns();
            });
        });
    }
}

function createMinecraftServerCard(server) {
    return `
        <div class="minecraft-server-card" data-server-id="${server.id}">
            <div class="server-card-header">
                <div class="server-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                </div>
                <div class="server-info">
                    <h3>${server.name}</h3>
                    <p>${server.description}</p>
                    <span class="server-ip">${server.ip}:${server.port}</span>
                </div>
                <div class="server-menu">
                    <button class="server-menu-btn">⋮</button>
                    <div class="server-menu-dropdown">
                        <button class="server-menu-item" data-action="update">Update</button>
                        <button class="server-menu-item" data-action="delete">Delete</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function showMinecraftAuth(serverId) {
    currentMinecraftServer = minecraftServers.find(s => s.id === serverId);
    if (currentMinecraftServer) {
        // Check if user has saved login for this IP
        const userIP = getUserIP(); // You'd implement this to get user's IP
        const savedLogin = localStorage.getItem(`minecraft_auth_${serverId}_${userIP}`);
        
        if (savedLogin) {
            // Auto login
            openMinecraftDashboard();
        } else {
            // Show auth modal
            document.getElementById('minecraft-auth-modal').style.display = 'flex';
        }
    }
}

function authenticateMinecraftServer() {
    const password = document.getElementById('auth-password').value;
    
    if (currentMinecraftServer && password === currentMinecraftServer.password) {
        // Save login for future use
        const userIP = getUserIP();
        localStorage.setItem(`minecraft_auth_${currentMinecraftServer.id}_${userIP}`, 'true');
        
        document.getElementById('minecraft-auth-modal').style.display = 'none';
        openMinecraftDashboard();
        showNotification('Authentication successful!', 'success');
    } else {
        showNotification('Invalid password', 'error');
    }
}

function openMinecraftDashboard() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('minecraft-dashboard').style.display = 'flex';
    
    // Update dashboard with server info
    document.getElementById('minecraft-server-title').textContent = currentMinecraftServer.name;
    document.getElementById('console-server-name').textContent = `${currentMinecraftServer.name} Console`;
    document.getElementById('display-server-ip').textContent = `${currentMinecraftServer.ip}:${currentMinecraftServer.port}`;
}

function handleMinecraftServerAction(action, serverId) {
    const server = minecraftServers.find(s => s.id === serverId);
    if (!server) return;
    
    switch (action) {
        case 'update':
            // Open update modal (similar to setup modal but pre-filled)
            showNotification('Update functionality coming soon!', 'info');
            break;
        case 'delete':
            if (confirm(`Are you sure you want to delete "${server.name}"?`)) {
                minecraftServers = minecraftServers.filter(s => s.id !== serverId);
                localStorage.setItem('minecraftServers', JSON.stringify(minecraftServers));
                updateMinecraftDisplay();
                showNotification('Server deleted successfully!', 'success');
            }
            break;
    }
}

function setupMinecraftNavigation() {
    const navLinks = document.querySelectorAll('.minecraft-nav-link');
    const sections = document.querySelectorAll('.minecraft-content-section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            navLinks.forEach(nav => nav.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));
            
            this.classList.add('active');
            
            const targetSection = this.getAttribute('data-section');
            document.getElementById(`minecraft-${targetSection}`).classList.add('active');
        });
    });
}

function setupMinecraftConsole() {
    const commandInput = document.getElementById('console-command');
    const sendCommandBtn = document.getElementById('send-command');
    const consoleOutput = document.getElementById('console-output');
    const announcementInput = document.getElementById('announcement-text');
    const sendAnnouncementBtn = document.getElementById('send-announcement');
    const editAnnouncementBtn = document.getElementById('edit-announcement');
    const copyServerIpBtn = document.getElementById('copy-server-ip');

    // Send command
    function sendCommand() {
        const command = commandInput.value.trim();
        if (command) {
            addConsoleMessage(`> ${command}`, 'command');
            // Simulate command response
            setTimeout(() => {
                addConsoleMessage(`[INFO] Command executed: ${command}`, 'info');
            }, 100);
            commandInput.value = '';
        }
    }

    sendCommandBtn?.addEventListener('click', sendCommand);
    commandInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendCommand();
        }
    });

    // Send announcement
    function sendAnnouncement() {
        const message = announcementInput.value.trim();
        if (message) {
            addConsoleMessage(`[ANNOUNCEMENT] ${message}`, 'announcement');
            announcementInput.value = '';
            showNotification('Announcement sent!', 'success');
        }
    }

    sendAnnouncementBtn?.addEventListener('click', sendAnnouncement);
    editAnnouncementBtn?.addEventListener('click', () => {
        // Edit functionality
        showNotification('Edit functionality coming soon!', 'info');
    });

    // Copy server IP
    copyServerIpBtn?.addEventListener('click', () => {
        const serverIp = document.getElementById('display-server-ip').textContent;
        navigator.clipboard.writeText(serverIp).then(() => {
            showNotification('Server IP copied to clipboard!', 'success');
        });
    });
}

function addConsoleMessage(message, type = 'info') {
    const consoleOutput = document.getElementById('console-output');
    const messageDiv = document.createElement('div');
    messageDiv.className = `console-line ${type}`;
    messageDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    consoleOutput.appendChild(messageDiv);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function getUserIP() {
    // In a real application, you'd get this from the server
    return '127.0.0.1';
}

// Utility functions
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Form auto-updates
function setupFormUpdates() {
    const messageContent = document.getElementById('message-content');
    if (messageContent) {
        messageContent.addEventListener('input', updateMessagePreview);
        messageContent.addEventListener('input', updateCharCount);
    }
    
    // JSON editor
    const jsonContent = document.getElementById('json-content');
    if (jsonContent) {
        jsonContent.addEventListener('input', handleJsonEdit);
    }
    
    // Copy JSON button
    const copyJsonBtn = document.getElementById('copy-json');
    if (copyJsonBtn) {
        copyJsonBtn.addEventListener('click', copyJsonToClipboard);
    }
}

function updateCharCount() {
    const messageContent = document.getElementById('message-content');
    const charCount = messageContent.parentElement.querySelector('.char-count');
    if (charCount) {
        charCount.textContent = `${messageContent.value.length}/2000`;
    }
}

function handleJsonEdit() {
    const jsonContent = document.getElementById('json-content');
    
    try {
        const data = JSON.parse(jsonContent.value);
        hideJsonError();
        
        // Update GUI from JSON
        updateGuiFromJson(data);
        updateMessagePreview();
        
    } catch (error) {
        showJsonError();
    }
}

function updateGuiFromJson(data) {
    // Update message content
    document.getElementById('message-content').value = data.content || '';
    
    // Clear existing embeds
    document.getElementById('embeds-container').innerHTML = '';
    currentEmbedIndex = 0;
    
    // Add embeds from JSON
    if (data.embeds && data.embeds.length > 0) {
        data.embeds.forEach(embed => {
            addEmbed(embed);
        });
    }
}

function copyJsonToClipboard() {
    const jsonContent = document.getElementById('json-content');
    jsonContent.select();
    document.execCommand('copy');
    showNotification('JSON copied to clipboard!', 'success');
}

function updateMessagePreview() {
    const messageData = getMessageData();
    
    // Update content preview
    const previewContent = document.getElementById('preview-content');
    previewContent.textContent = messageData.content || 'Type your message here...';
    
    // Update embeds preview
    const previewEmbeds = document.getElementById('preview-embeds');
    previewEmbeds.innerHTML = '';
    
    if (messageData.embeds && messageData.embeds.length > 0) {
        messageData.embeds.forEach(embed => {
            const embedHtml = createEmbedPreview(embed);
            previewEmbeds.insertAdjacentHTML('beforeend', embedHtml);
        });
    }
}

function createEmbedPreview(embed) {
    const color = embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#3b82f6';
    
    return `
        <div class="discord-embed" style="border-left-color: ${color}">
            ${embed.author ? `
                <div class="embed-author">
                    ${embed.author.icon_url ? `<img src="${embed.author.icon_url}" alt="Author">` : ''}
                    <span>${embed.author.name}</span>
                </div>
            ` : ''}
            
            ${embed.title ? `<div class="embed-title">${embed.title}</div>` : ''}
            ${embed.description ? `<div class="embed-description">${embed.description}</div>` : ''}
            
            ${embed.fields && embed.fields.length > 0 ? `
                <div class="embed-fields">
                    ${embed.fields.map(field => `
                        <div class="embed-field ${field.inline ? 'inline' : ''}">
                            <div class="field-name">${field.name}</div>
                            <div class="field-value">${field.value}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            ${embed.image ? `<div class="embed-image"><img src="${embed.image.url}" alt="Embed image"></div>` : ''}
            
            ${embed.thumbnail ? `<div class="embed-thumbnail"><img src="${embed.thumbnail.url}" alt="Thumbnail"></div>` : ''}
            
            ${embed.footer || embed.timestamp ? `
                <div class="embed-footer">
                    ${embed.footer?.icon_url ? `<img src="${embed.footer.icon_url}" alt="Footer">` : ''}
                    <span>${embed.footer?.text || ''}</span>
                    ${embed.timestamp ? `<span class="timestamp"> • ${new Date(embed.timestamp).toLocaleString()}</span>` : ''}
                </div>
            ` : ''}
        </div>
    `;
}

function showPublishModal(messageId) {
    currentMessageId = messageId;
    const modal = document.getElementById('publish-modal');
    const message = messages.find(m => m.messageId === messageId);
    
    if (message && message.is_public) {
        // Show make private option
        document.getElementById('make-private').style.display = 'inline-block';
        document.getElementById('confirm-publish').textContent = 'Update';
        
        // Populate existing data
        document.getElementById('publish-title').value = message.title || '';
        document.getElementById('publish-language').value = message.language || '';
        document.getElementById('publish-keywords').value = message.keywords ? message.keywords.join(', ') : '';
    } else {
        document.getElementById('make-private').style.display = 'none';
        document.getElementById('confirm-publish').textContent = 'Publish';
        
        // Clear form
        document.getElementById('publish-title').value = '';
        document.getElementById('publish-language').value = '';
        document.getElementById('publish-keywords').value = '';
    }
    
    modal.style.display = 'flex';
}

function publishMessage() {
    const messageId = currentMessageId;
    const message = messages.find(m => m.messageId === messageId);
    
    if (!message) return;
    
    const title = document.getElementById('publish-title').value.trim();
    const language = document.getElementById('publish-language').value;
    const keywordsText = document.getElementById('publish-keywords').value.trim();
    
    if (!title) {
        showNotification('Title is required', 'error');
        return;
    }
    
    if (!language) {
        showNotification('Language is required', 'error');
        return;
    }
    
    // Process keywords
    const keywords = processKeywords(keywordsText);
    
    // Update message
    const index = messages.findIndex(m => m.messageId === messageId);
    if (index !== -1) {
        messages[index] = {
            ...messages[index],
            title,
            language,
            keywords,
            is_public: true,
            publishedAt: new Date().toISOString()
        };
        
        localStorage.setItem('userMessages', JSON.stringify(messages));
        updateMessagesList();
        updateDashboardStats();
        
        document.getElementById('publish-modal').style.display = 'none';
        showNotification('Message published successfully!', 'success');
    }
}

function makeMessagePrivate(messageId = null) {
    const id = messageId || currentMessageId;
    const index = messages.findIndex(m => m.messageId === id);
    
    if (index !== -1) {
        messages[index].is_public = false;
        delete messages[index].title;
        delete messages[index].language;
        delete messages[index].keywords;
        delete messages[index].publishedAt;
        
        localStorage.setItem('userMessages', JSON.stringify(messages));
        updateMessagesList();
        updateDashboardStats();
        
        if (document.getElementById('publish-modal').style.display === 'flex') {
            document.getElementById('publish-modal').style.display = 'none';
        }
        
        showNotification('Message made private', 'success');
    }
}

function processKeywords(keywordsText) {
    if (!keywordsText) return [];
    
    const helpingVerbs = ['is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    
    return keywordsText
        .split(/[,\s]+/)
        .map(word => word.toLowerCase().trim())
        .filter(word => word.length > 0 && !helpingVerbs.includes(word))
        .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates
}

// Community functionality
function loadCommunityMessages() {
    const communityGrid = document.getElementById('community-messages');
    const loading = document.getElementById('community-loading');
    
    loading.style.display = 'block';
    
    // Get public messages
    const publicMessages = messages.filter(m => m.is_public);
    
    setTimeout(() => {
        loading.style.display = 'none';
        
        if (publicMessages.length === 0) {
            communityGrid.innerHTML = `
                <div class="empty-community">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                    <h3>No public messages yet</h3>
                    <p>Be the first to publish a message to the community!</p>
                </div>
            `;
        } else {
            communityGrid.innerHTML = publicMessages.map(message => createCommunityCard(message)).join('');
        }
    }, 500);
}

function createCommunityCard(message) {
    const typeColor = getTypeColor(message.type);
    const typeLabel = getTypeLabel(message.type);
    
    return `
        <div class="community-message-card">
            <div class="community-message-header">
                <h3>${message.title}</h3>
                <div class="community-message-meta">
                    <span class="category-badge" style="background-color: ${typeColor}">${typeLabel}</span>
                    <span class="language-badge">${message.language}</span>
                    <span class="author">by ${currentUser?.username || 'Anonymous'}</span>
                </div>
            </div>
            <div class="community-message-content">
                <p>${message.content ? (message.content.length > 150 ? message.content.substring(0, 150) + '...' : message.content) : 'No content'}</p>
                ${message.embeds && message.embeds.length > 0 ? `<span class="embed-count">${message.embeds.length} embed${message.embeds.length !== 1 ? 's' : ''}</span>` : ''}
            </div>
            <div class="community-message-tags">
                ${message.keywords ? message.keywords.slice(0, 5).map(keyword => `<span class="tag">${keyword}</span>`).join('') : ''}
            </div>
            <div class="community-message-actions">
                <button class="btn btn-secondary btn-small" onclick="previewCommunityMessage('${message.messageId}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                    Preview
                </button>
                <button class="btn btn-primary btn-small" onclick="useCommunityMessage('${message.messageId}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    Use Message
                </button>
            </div>
        </div>
    `;
}

function previewCommunityMessage(messageId) {
    const message = messages.find(m => m.messageId === messageId);
    if (!message) return;
    
    // Show preview modal
    const modal = document.getElementById('preview-modal');
    const previewContent = document.getElementById('modal-preview-content');
    const jsonContent = document.getElementById('modal-json-content');
    
    previewContent.textContent = message.content || 'No content';
    
    const previewEmbeds = document.getElementById('modal-preview-embeds');
    previewEmbeds.innerHTML = '';
    
    if (message.embeds && message.embeds.length > 0) {
        message.embeds.forEach(embed => {
            const embedHtml = createEmbedPreview(embed);
            previewEmbeds.insertAdjacentHTML('beforeend', embedHtml);
        });
    }
    
    jsonContent.textContent = JSON.stringify({
        content: message.content,
        embeds: message.embeds
    }, null, 2);
    
    modal.style.display = 'flex';
}

function useCommunityMessage(messageId) {
    const message = messages.find(m => m.messageId === messageId);
    if (!message) return;
    
    // Switch to message builder
    document.querySelector('[data-section="message-builder"]').click();
    
    // Load message data
    currentMessageType = message.type;
    showMessageBuilder();
    
    // Populate form
    document.getElementById('message-content').value = message.content || '';
    
    // Clear and add embeds
    document.getElementById('embeds-container').innerHTML = '';
    currentEmbedIndex = 0;
    
    if (message.embeds && message.embeds.length > 0) {
        message.embeds.forEach(embed => {
            addEmbed(embed);
        });
    }
    
    setupPlaceholders(message.type);
    updateMessagePreview();
    
    showNotification('Message loaded for editing!', 'success');
}

// Other features
function setupOtherFeatures() {
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.message-menu')) {
            closeAllDropdowns();
        }
        
        // Close color pickers
        if (!e.target.closest('.color-picker-container')) {
            document.querySelectorAll('.color-picker-dropdown').forEach(dropdown => {
                dropdown.style.display = 'none';
            });
        }
    });
    
    // Preview modal
    const previewModal = document.getElementById('preview-modal');
    const closePreviewBtn = document.getElementById('close-preview-modal');
    
    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', () => {
            previewModal.style.display = 'none';
        });
    }
    
    // Preview toggle
    const previewToggleBtns = document.querySelectorAll('.preview-toggle .toggle-btn');
    previewToggleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            
            previewToggleBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            if (view === 'preview') {
                document.getElementById('modal-preview-view').style.display = 'block';
                document.getElementById('modal-json-view').style.display = 'none';
            } else {
                document.getElementById('modal-preview-view').style.display = 'none';
                document.getElementById('modal-json-view').style.display = 'block';
            }
        });
    });
    
    // Community search
    const searchBtn = document.getElementById('search-community');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchCommunityMessages);
    }
    
    const searchInput = document.getElementById('community-search');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchCommunityMessages();
            }
        });
    }
}

function searchCommunityMessages() {
    const searchTerm = document.getElementById('community-search').value.trim().toLowerCase();
    const categoryFilter = document.getElementById('category-filter').value;
    const languageFilter = document.getElementById('language-filter').value;
    
    let filteredMessages = messages.filter(m => m.is_public);
    
    // Apply filters
    if (searchTerm) {
        const searchWords = searchTerm.split(/[,\s]+/).filter(word => word.length > 0);
        
        filteredMessages = filteredMessages.filter(message => {
            const searchableText = [
                message.title,
                message.content,
                ...(message.keywords || [])
            ].join(' ').toLowerCase();
            
            return searchWords.some(word => searchableText.includes(word));
        });
    }
    
    if (categoryFilter) {
        filteredMessages = filteredMessages.filter(m => m.type === categoryFilter);
    }
    
    if (languageFilter) {
        filteredMessages = filteredMessages.filter(m => m.language === languageFilter);
    }
    
    // Display results
    const communityGrid = document.getElementById('community-messages');
    
    if (filteredMessages.length === 0) {
        communityGrid.innerHTML = `
            <div class="empty-community">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <h3>No messages found</h3>
                <p>Try adjusting your search terms or filters</p>
            </div>
        `;
    } else {
        communityGrid.innerHTML = filteredMessages.map(message => createCommunityCard(message)).join('');
    }
}

function updateDashboardStats() {
    const totalMessagesEl = document.getElementById('total-messages');
    const publicMessagesEl = document.getElementById('public-messages');
    
    if (totalMessagesEl) {
        totalMessagesEl.textContent = messages.length;
    }
    
    if (publicMessagesEl) {
        const publicCount = messages.filter(m => m.is_public).length;
        publicMessagesEl.textContent = publicCount;
    }
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