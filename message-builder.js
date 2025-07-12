// Global state
let currentUser = null;
let messages = [];
let currentMessageId = null;
let currentMessageType = null;
let currentEmbedIndex = 0;
let lastValidJson = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    try {
        const response = await fetch('/api/auth/user');
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            hideAuthModal();
            updateUserDisplay();
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
    
    // Community
    setupCommunity();
    
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

function updateUserDisplay() {
    if (currentUser) {
        document.getElementById('user-avatar-dashboard').src = `https://cdn.discordapp.com/avatars/${currentUser.discordId}/${currentUser.avatar}.png`;
        document.getElementById('user-username-dashboard').textContent = currentUser.username;
    }
}

// Message Builder functionality
function setupMessageBuilder() {
    const createNewBtn = document.getElementById('create-new-message');
    const createFirstBtn = document.getElementById('create-first-message');
    const backToListBtn = document.getElementById('back-to-list');
    const saveMessageBtn = document.getElementById('save-message');

    [createNewBtn, createFirstBtn].forEach(btn => {
        if (btn) btn.addEventListener('click', () => showMessageTypeModal());
    });

    if (backToListBtn) {
        backToListBtn.addEventListener('click', () => showMessageList());
    }

    if (saveMessageBtn) {
        saveMessageBtn.addEventListener('click', () => saveMessage());
    }

    // Message type modal
    setupMessageTypeModal();
    
    // View toggle
    setupViewToggle();
    
    // Embed functionality
    setupEmbedFunctionality();
    
    // Publish modal
    setupPublishModal();
}

function setupMessageTypeModal() {
    const modal = document.getElementById('message-type-modal');
    const closeBtn = document.getElementById('close-type-modal');
    const typeCards = document.querySelectorAll('.message-type-card');

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    typeCards.forEach(card => {
        card.addEventListener('click', () => {
            const type = card.getAttribute('data-type');
            currentMessageType = type;
            modal.style.display = 'none';
            showMessageBuilder();
            showPlaceholders(type);
        });
    });
}

function showMessageTypeModal() {
    document.getElementById('message-type-modal').style.display = 'flex';
}

function showPlaceholders(type) {
    const placeholdersSection = document.getElementById('placeholders-section');
    const placeholdersGrid = document.getElementById('placeholders-grid');
    
    const placeholders = {
        welcome: ['@username', '@userid', '@userprofile', '@servername', '@membercount'],
        leave: ['@username', '@userid', '@servername', '@membercount'],
        ban: ['@username', '@userid', '@reason', '@moderator'],
        announcement: ['@everyone', '@here', '@servername', '@date'],
        ticket: ['@username', '@userid', '@ticketid', '@category'],
        other: ['@username', '@userid', '@servername']
    };

    placeholdersGrid.innerHTML = placeholders[type].map(placeholder => 
        `<span class="placeholder-tag" onclick="insertPlaceholder('${placeholder}')">${placeholder}</span>`
    ).join('');
    
    placeholdersSection.style.display = 'block';
}

function insertPlaceholder(placeholder) {
    const textarea = document.getElementById('message-content');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    textarea.value = text.substring(0, start) + placeholder + text.substring(end);
    textarea.focus();
    textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    
    updatePreview();
}

function setupViewToggle() {
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    const guiView = document.getElementById('gui-view');
    const jsonView = document.getElementById('json-view');

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            
            toggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (view === 'gui') {
                guiView.style.display = 'flex';
                jsonView.style.display = 'none';
                updatePreview();
            } else {
                guiView.style.display = 'none';
                jsonView.style.display = 'block';
                updateJsonView();
            }
        });
    });
}

function setupEmbedFunctionality() {
    const addEmbedBtn = document.getElementById('add-embed-btn');
    
    addEmbedBtn.addEventListener('click', () => {
        addEmbed();
    });
}

function addEmbed() {
    const embedsContainer = document.getElementById('embeds-container');
    const embedIndex = currentEmbedIndex++;
    
    const embedHtml = `
        <div class="embed-editor" data-embed-index="${embedIndex}">
            <div class="embed-header">
                <h4>Embed ${embedIndex + 1}</h4>
                <button class="btn btn-small btn-secondary remove-embed-btn" onclick="removeEmbed(${embedIndex})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                    Remove
                </button>
            </div>
            <div class="embed-form">
                <div class="form-group">
                    <label>Author Name</label>
                    <input type="text" class="embed-author-name" placeholder="Author name">
                </div>
                <div class="form-group">
                    <label>Author Icon URL</label>
                    <input type="url" class="embed-author-icon" placeholder="https://example.com/icon.png">
                </div>
                <div class="form-group">
                    <label>Author URL</label>
                    <input type="url" class="embed-author-url" placeholder="https://example.com">
                </div>
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" class="embed-title" placeholder="Embed title">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea class="embed-description" placeholder="Embed description" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label>Embed URL</label>
                    <input type="url" class="embed-url" placeholder="https://example.com">
                </div>
                <div class="form-group">
                    <label>Thumbnail URL</label>
                    <input type="url" class="embed-thumbnail" placeholder="https://example.com/thumbnail.png">
                </div>
                <div class="form-group">
                    <label>Image URL</label>
                    <input type="url" class="embed-image" placeholder="https://example.com/image.png">
                </div>
                <div class="form-group">
                    <label>Footer Text</label>
                    <input type="text" class="embed-footer-text" placeholder="Footer text">
                </div>
                <div class="form-group">
                    <label>Footer Icon URL</label>
                    <input type="url" class="embed-footer-icon" placeholder="https://example.com/footer-icon.png">
                </div>
                <div class="form-group">
                    <label>Color</label>
                    <input type="color" class="embed-color" value="#3b82f6">
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" class="embed-timestamp">
                        <span class="checkmark"></span>
                        Include Timestamp
                    </label>
                </div>
                <div class="fields-section">
                    <div class="fields-header">
                        <h4>Fields</h4>
                        <button type="button" class="btn btn-small btn-secondary add-field-btn" onclick="addField(${embedIndex})">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                            Add Field
                        </button>
                    </div>
                    <div class="fields-container" id="fields-container-${embedIndex}">
                        <!-- Fields will be added here -->
                    </div>
                </div>
            </div>
        </div>
    `;
    
    embedsContainer.insertAdjacentHTML('beforeend', embedHtml);
    
    // Add event listeners for the new embed
    const newEmbed = embedsContainer.lastElementChild;
    const inputs = newEmbed.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', updatePreview);
    });
    
    updatePreview();
}

function removeEmbed(embedIndex) {
    const embed = document.querySelector(`[data-embed-index="${embedIndex}"]`);
    if (embed) {
        embed.remove();
        updatePreview();
    }
}

function addField(embedIndex) {
    const fieldsContainer = document.getElementById(`fields-container-${embedIndex}`);
    const fieldIndex = fieldsContainer.children.length;
    
    const fieldHtml = `
        <div class="field-item" data-field-index="${fieldIndex}">
            <div class="field-header">
                <span>Field ${fieldIndex + 1}</span>
                <button type="button" class="btn btn-small btn-secondary remove-field-btn" onclick="removeField(${embedIndex}, ${fieldIndex})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                    Remove
                </button>
            </div>
            <div class="field-inputs">
                <div class="form-group">
                    <label>Field Name</label>
                    <input type="text" class="field-name" placeholder="Field name">
                </div>
                <div class="form-group">
                    <label>Field Value</label>
                    <textarea class="field-value" placeholder="Field value" rows="2"></textarea>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" class="field-inline">
                        <span class="checkmark"></span>
                        Inline
                    </label>
                </div>
            </div>
        </div>
    `;
    
    fieldsContainer.insertAdjacentHTML('beforeend', fieldHtml);
    
    // Add event listeners for the new field
    const newField = fieldsContainer.lastElementChild;
    const inputs = newField.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', updatePreview);
    });
    
    updatePreview();
}

function removeField(embedIndex, fieldIndex) {
    const field = document.querySelector(`#fields-container-${embedIndex} [data-field-index="${fieldIndex}"]`);
    if (field) {
        field.remove();
        updatePreview();
    }
}

function loadMessageBuilderSection() {
    if (currentUser) {
        loadUserMessages();
    }
    showMessageList();
}

async function loadUserMessages() {
    // For now, use local storage or mock data
    // In production, this would fetch from the database
    const storedMessages = localStorage.getItem('userMessages');
    if (storedMessages) {
        messages = JSON.parse(storedMessages);
    } else {
        messages = [];
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

    const isPublic = message.is_public;
    const cardClass = isPublic ? 'message-card-item public' : 'message-card-item';
    const publicBadge = isPublic ? '<span class="public-badge">Public</span>' : '';

    return `
        <div class="${cardClass}" data-message-id="${message.messageId}">
            <div class="message-card-header">
                <div class="message-card-info">
                    <h3 class="message-card-title">${message.title || 'Untitled Message'}</h3>
                    <p class="message-card-description">${truncatedDescription}</p>
                    <div class="message-card-stats">
                        <span class="embed-count">${message.embeds ? message.embeds.length : 0} embed${message.embeds && message.embeds.length !== 1 ? 's' : ''}</span>
                        ${publicBadge}
                    </div>
                </div>
                <div class="message-menu">
                    <button class="message-menu-btn">⋮</button>
                    <div class="message-menu-dropdown">
                        <button class="message-menu-item" data-action="copy-id">Copy ID</button>
                        <button class="message-menu-item" data-action="delete">Delete</button>
                        ${!isPublic ? '<button class="message-menu-item" data-action="publish">Publish</button>' : '<button class="message-menu-item" data-action="make-private">Make Private</button>'}
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
        case 'delete':
            if (confirm('Are you sure you want to delete this message?')) {
                deleteMessage(messageId);
            }
            break;
        case 'publish':
            showPublishModal(messageId);
            break;
        case 'make-private':
            makeMessagePrivate(messageId);
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
        updatePreview();
    }
}

function editMessage(messageId) {
    showMessageBuilder(messageId);
}

function loadMessageForEditing(messageId) {
    const message = messages.find(m => m.messageId === messageId);
    if (message) {
        populateMessageForm(message);
        updatePreview();
    }
}

function populateMessageForm(message) {
    document.getElementById('message-content').value = message.content || '';
    
    // Clear existing embeds
    document.getElementById('embeds-container').innerHTML = '';
    currentEmbedIndex = 0;
    
    // Add embeds
    if (message.embeds && message.embeds.length > 0) {
        message.embeds.forEach(embed => {
            addEmbed();
            const embedEditor = document.querySelector(`[data-embed-index="${currentEmbedIndex - 1}"]`);
            
            embedEditor.querySelector('.embed-author-name').value = embed.author?.name || '';
            embedEditor.querySelector('.embed-author-icon').value = embed.author?.icon_url || '';
            embedEditor.querySelector('.embed-author-url').value = embed.author?.url || '';
            embedEditor.querySelector('.embed-title').value = embed.title || '';
            embedEditor.querySelector('.embed-description').value = embed.description || '';
            embedEditor.querySelector('.embed-url').value = embed.url || '';
            embedEditor.querySelector('.embed-thumbnail').value = embed.thumbnail?.url || '';
            embedEditor.querySelector('.embed-image').value = embed.image?.url || '';
            embedEditor.querySelector('.embed-footer-text').value = embed.footer?.text || '';
            embedEditor.querySelector('.embed-footer-icon').value = embed.footer?.icon_url || '';
            embedEditor.querySelector('.embed-color').value = embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#3b82f6';
            embedEditor.querySelector('.embed-timestamp').checked = !!embed.timestamp;
            
            // Add fields
            if (embed.fields && embed.fields.length > 0) {
                embed.fields.forEach(field => {
                    addField(currentEmbedIndex - 1);
                    const fieldsContainer = document.getElementById(`fields-container-${currentEmbedIndex - 1}`);
                    const lastField = fieldsContainer.lastElementChild;
                    
                    lastField.querySelector('.field-name').value = field.name || '';
                    lastField.querySelector('.field-value').value = field.value || '';
                    lastField.querySelector('.field-inline').checked = !!field.inline;
                });
            }
        });
    }
}

function clearMessageForm() {
    document.getElementById('message-content').value = '';
    document.getElementById('embeds-container').innerHTML = '';
    currentEmbedIndex = 0;
    document.getElementById('placeholders-section').style.display = 'none';
}

function generateMessageId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 7; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function saveMessage() {
    const messageData = {
        messageId: currentMessageId || generateMessageId(),
        content: document.getElementById('message-content').value,
        embeds: getEmbedsData(),
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
        messages.push(messageData);
    }

    localStorage.setItem('userMessages', JSON.stringify(messages));
    showNotification(currentMessageId ? 'Message updated!' : 'Message created!', 'success');
    loadUserMessages();
    showMessageList();
}

function getEmbedsData() {
    const embeds = [];
    const embedEditors = document.querySelectorAll('.embed-editor');
    
    embedEditors.forEach(editor => {
        const embed = {
            author: {
                name: editor.querySelector('.embed-author-name').value,
                icon_url: editor.querySelector('.embed-author-icon').value,
                url: editor.querySelector('.embed-author-url').value
            },
            title: editor.querySelector('.embed-title').value,
            description: editor.querySelector('.embed-description').value,
            url: editor.querySelector('.embed-url').value,
            color: parseInt(editor.querySelector('.embed-color').value.replace('#', ''), 16),
            thumbnail: {
                url: editor.querySelector('.embed-thumbnail').value
            },
            image: {
                url: editor.querySelector('.embed-image').value
            },
            footer: {
                text: editor.querySelector('.embed-footer-text').value,
                icon_url: editor.querySelector('.embed-footer-icon').value
            },
            timestamp: editor.querySelector('.embed-timestamp').checked ? new Date().toISOString() : null,
            fields: []
        };
        
        // Get fields
        const embedIndex = editor.getAttribute('data-embed-index');
        const fieldsContainer = document.getElementById(`fields-container-${embedIndex}`);
        if (fieldsContainer) {
            const fieldItems = fieldsContainer.querySelectorAll('.field-item');
            fieldItems.forEach(fieldItem => {
                const field = {
                    name: fieldItem.querySelector('.field-name').value,
                    value: fieldItem.querySelector('.field-value').value,
                    inline: fieldItem.querySelector('.field-inline').checked
                };
                if (field.name && field.value) {
                    embed.fields.push(field);
                }
            });
        }
        
        // Clean up empty properties
        if (!embed.author.name && !embed.author.icon_url && !embed.author.url) {
            delete embed.author;
        }
        if (!embed.thumbnail.url) {
            delete embed.thumbnail;
        }
        if (!embed.image.url) {
            delete embed.image;
        }
        if (!embed.footer.text && !embed.footer.icon_url) {
            delete embed.footer;
        }
        
        embeds.push(embed);
    });
    
    return embeds;
}

// Form auto-updates
function setupFormUpdates() {
    const messageContent = document.getElementById('message-content');
    if (messageContent) {
        messageContent.addEventListener('input', updatePreview);
    }
}

function updatePreview() {
    const content = document.getElementById('message-content').value || 'Type your message here...';
    const embeds = getEmbedsData();
    
    // Update message content
    document.getElementById('preview-content').textContent = content;
    
    // Update embeds
    const previewEmbeds = document.getElementById('preview-embeds');
    previewEmbeds.innerHTML = '';
    
    embeds.forEach(embed => {
        const embedElement = createEmbedPreview(embed);
        previewEmbeds.appendChild(embedElement);
    });
    
    // Update JSON view if active
    if (document.getElementById('json-view').style.display !== 'none') {
        updateJsonView();
    }
}

function createEmbedPreview(embed) {
    const embedDiv = document.createElement('div');
    embedDiv.className = 'discord-embed';
    embedDiv.style.borderLeftColor = embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#3b82f6';
    
    let embedHtml = '<div class="embed-content">';
    
    // Author
    if (embed.author && embed.author.name) {
        embedHtml += '<div class="embed-author">';
        if (embed.author.icon_url) {
            embedHtml += `<img src="${embed.author.icon_url}" alt="Author icon">`;
        }
        embedHtml += `<span>${embed.author.name}</span>`;
        embedHtml += '</div>';
    }
    
    // Title
    if (embed.title) {
        embedHtml += `<div class="embed-title">${embed.title}</div>`;
    }
    
    // Description
    if (embed.description) {
        embedHtml += `<div class="embed-description">${embed.description}</div>`;
    }
    
    // Fields
    if (embed.fields && embed.fields.length > 0) {
        embedHtml += '<div class="embed-fields">';
        embed.fields.forEach(field => {
            const fieldClass = field.inline ? 'embed-field inline' : 'embed-field';
            embedHtml += `
                <div class="${fieldClass}">
                    <div class="field-name">${field.name}</div>
                    <div class="field-value">${field.value}</div>
                </div>
            `;
        });
        embedHtml += '</div>';
    }
    
    // Thumbnail
    if (embed.thumbnail && embed.thumbnail.url) {
        embedHtml += `<div class="embed-thumbnail"><img src="${embed.thumbnail.url}" alt="Thumbnail"></div>`;
    }
    
    // Image
    if (embed.image && embed.image.url) {
        embedHtml += `<div class="embed-image"><img src="${embed.image.url}" alt="Image"></div>`;
    }
    
    // Footer
    if (embed.footer && (embed.footer.text || embed.timestamp)) {
        embedHtml += '<div class="embed-footer">';
        if (embed.footer.icon_url) {
            embedHtml += `<img src="${embed.footer.icon_url}" alt="Footer icon">`;
        }
        if (embed.footer.text) {
            embedHtml += `<span>${embed.footer.text}</span>`;
        }
        if (embed.timestamp) {
            const timestamp = new Date().toLocaleString();
            embedHtml += `<span class="timestamp"> • ${timestamp}</span>`;
        }
        embedHtml += '</div>';
    }
    
    embedHtml += '</div>';
    embedDiv.innerHTML = embedHtml;
    
    return embedDiv;
}

function updateJsonView() {
    const content = document.getElementById('message-content').value;
    const embeds = getEmbedsData();
    
    const messageJson = {
        content: content || null,
        embeds: embeds.length > 0 ? embeds : null
    };
    
    // Clean up null values
    Object.keys(messageJson).forEach(key => {
        if (messageJson[key] === null || messageJson[key] === '') {
            delete messageJson[key];
        }
    });
    
    const jsonContent = document.getElementById('json-content');
    jsonContent.value = JSON.stringify(messageJson, null, 2);
    lastValidJson = jsonContent.value;
    
    // Add JSON editing functionality
    jsonContent.removeEventListener('input', handleJsonEdit);
    jsonContent.addEventListener('input', handleJsonEdit);
}

function handleJsonEdit() {
    const jsonContent = document.getElementById('json-content');
    const jsonError = document.getElementById('json-error');
    
    try {
        const parsed = JSON.parse(jsonContent.value);
        jsonError.style.display = 'none';
        jsonContent.style.borderColor = '#333';
        lastValidJson = jsonContent.value;
        
        // Update GUI from JSON
        updateGuiFromJson(parsed);
    } catch (error) {
        jsonError.style.display = 'block';
        jsonContent.style.borderColor = '#ef4444';
    }
}

function updateGuiFromJson(messageData) {
    // Update message content
    document.getElementById('message-content').value = messageData.content || '';
    
    // Clear and rebuild embeds
    document.getElementById('embeds-container').innerHTML = '';
    currentEmbedIndex = 0;
    
    if (messageData.embeds && messageData.embeds.length > 0) {
        messageData.embeds.forEach(embedData => {
            addEmbed();
            const embedEditor = document.querySelector(`[data-embed-index="${currentEmbedIndex - 1}"]`);
            
            // Populate embed fields
            if (embedData.author) {
                embedEditor.querySelector('.embed-author-name').value = embedData.author.name || '';
                embedEditor.querySelector('.embed-author-icon').value = embedData.author.icon_url || '';
                embedEditor.querySelector('.embed-author-url').value = embedData.author.url || '';
            }
            
            embedEditor.querySelector('.embed-title').value = embedData.title || '';
            embedEditor.querySelector('.embed-description').value = embedData.description || '';
            embedEditor.querySelector('.embed-url').value = embedData.url || '';
            
            if (embedData.thumbnail) {
                embedEditor.querySelector('.embed-thumbnail').value = embedData.thumbnail.url || '';
            }
            
            if (embedData.image) {
                embedEditor.querySelector('.embed-image').value = embedData.image.url || '';
            }
            
            if (embedData.footer) {
                embedEditor.querySelector('.embed-footer-text').value = embedData.footer.text || '';
                embedEditor.querySelector('.embed-footer-icon').value = embedData.footer.icon_url || '';
            }
            
            if (embedData.color) {
                embedEditor.querySelector('.embed-color').value = `#${embedData.color.toString(16).padStart(6, '0')}`;
            }
            
            embedEditor.querySelector('.embed-timestamp').checked = !!embedData.timestamp;
            
            // Add fields
            if (embedData.fields && embedData.fields.length > 0) {
                embedData.fields.forEach(fieldData => {
                    addField(currentEmbedIndex - 1);
                    const fieldsContainer = document.getElementById(`fields-container-${currentEmbedIndex - 1}`);
                    const lastField = fieldsContainer.lastElementChild;
                    
                    lastField.querySelector('.field-name').value = fieldData.name || '';
                    lastField.querySelector('.field-value').value = fieldData.value || '';
                    lastField.querySelector('.field-inline').checked = !!fieldData.inline;
                });
            }
        });
    }
    
    // Update preview
    updatePreview();
}

// Publish Modal
function setupPublishModal() {
    const modal = document.getElementById('publish-modal');
    const closeBtn = document.getElementById('close-publish-modal');
    const cancelBtn = document.getElementById('cancel-publish');
    const confirmBtn = document.getElementById('confirm-publish');
    const makePrivateBtn = document.getElementById('make-private');

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    confirmBtn.addEventListener('click', () => {
        publishMessage();
    });

    makePrivateBtn.addEventListener('click', () => {
        makeMessagePrivate(currentMessageId);
        modal.style.display = 'none';
    });
}

function showPublishModal(messageId) {
    currentMessageId = messageId;
    const message = messages.find(m => m.messageId === messageId);
    
    if (message && message.is_public) {
        // Show make private option
        document.getElementById('make-private').style.display = 'inline-block';
        document.getElementById('confirm-publish').textContent = 'Update';
        
        // Pre-fill form
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
    
    document.getElementById('publish-modal').style.display = 'flex';
}

function publishMessage() {
    const messageId = currentMessageId;
    const title = document.getElementById('publish-title').value;
    const language = document.getElementById('publish-language').value;
    const keywordsText = document.getElementById('publish-keywords').value;
    
    if (!title || !language) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    // Process keywords
    const keywords = processKeywords(keywordsText);
    
    // Update message
    const messageIndex = messages.findIndex(m => m.messageId === messageId);
    if (messageIndex !== -1) {
        messages[messageIndex] = {
            ...messages[messageIndex],
            title,
            language,
            keywords,
            is_public: true,
            publishedAt: new Date().toISOString()
        };
        
        localStorage.setItem('userMessages', JSON.stringify(messages));
        updateMessagesList();
        updateDashboardStats();
        showNotification('Message published successfully!', 'success');
    }
    
    document.getElementById('publish-modal').style.display = 'none';
}

function makeMessagePrivate(messageId) {
    const messageIndex = messages.findIndex(m => m.messageId === messageId);
    if (messageIndex !== -1) {
        messages[messageIndex].is_public = false;
        delete messages[messageIndex].title;
        delete messages[messageIndex].language;
        delete messages[messageIndex].keywords;
        delete messages[messageIndex].publishedAt;
        
        localStorage.setItem('userMessages', JSON.stringify(messages));
        updateMessagesList();
        updateDashboardStats();
        showNotification('Message made private successfully!', 'success');
    }
}

function processKeywords(keywordsText) {
    const helpingVerbs = ['is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall', 'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    
    return keywordsText
        .split(/[,\s]+/)
        .map(word => word.toLowerCase().trim())
        .filter(word => word.length > 0 && !helpingVerbs.includes(word));
}

// Community functionality
function setupCommunity() {
    const searchBtn = document.getElementById('search-community');
    const searchInput = document.getElementById('community-search');
    const categoryFilter = document.getElementById('category-filter');
    const languageFilter = document.getElementById('language-filter');

    searchBtn.addEventListener('click', () => {
        searchCommunityMessages();
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchCommunityMessages();
        }
    });

    categoryFilter.addEventListener('change', () => {
        searchCommunityMessages();
    });

    languageFilter.addEventListener('change', () => {
        searchCommunityMessages();
    });
}

function loadCommunitySection() {
    loadRandomCommunityMessages();
}

function loadRandomCommunityMessages() {
    // Get all public messages
    const publicMessages = messages.filter(m => m.is_public);
    
    // Shuffle and take first 20
    const shuffled = publicMessages.sort(() => 0.5 - Math.random());
    const randomMessages = shuffled.slice(0, 20);
    
    displayCommunityMessages(randomMessages);
}

function searchCommunityMessages() {
    const searchTerm = document.getElementById('community-search').value.toLowerCase();
    const category = document.getElementById('category-filter').value;
    const language = document.getElementById('language-filter').value;
    
    let filteredMessages = messages.filter(m => m.is_public);
    
    // Search by ID if starts with #
    if (searchTerm.startsWith('#')) {
        const id = searchTerm.substring(1);
        filteredMessages = filteredMessages.filter(m => m.messageId.toLowerCase().includes(id));
    } else if (searchTerm) {
        // Search by keywords and content
        const searchWords = searchTerm.split(/[,\s]+/).filter(word => word.length > 0);
        filteredMessages = filteredMessages.filter(m => {
            const content = (m.content || '').toLowerCase();
            const title = (m.title || '').toLowerCase();
            const keywords = (m.keywords || []).join(' ').toLowerCase();
            
            return searchWords.some(word => 
                content.includes(word) || 
                title.includes(word) || 
                keywords.includes(word)
            );
        });
    }
    
    // Filter by category
    if (category) {
        filteredMessages = filteredMessages.filter(m => m.type === category);
    }
    
    // Filter by language
    if (language) {
        filteredMessages = filteredMessages.filter(m => m.language === language);
    }
    
    displayCommunityMessages(filteredMessages);
}

function displayCommunityMessages(messages) {
    const container = document.getElementById('community-messages');
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="no-results">No messages found matching your criteria.</div>';
        return;
    }
    
    container.innerHTML = messages.map(message => createCommunityMessageCard(message)).join('');
    
    // Add event listeners
    container.querySelectorAll('.use-message-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const messageId = btn.getAttribute('data-message-id');
            useMessage(messageId);
        });
    });
}

function createCommunityMessageCard(message) {
    const createdDate = new Date(message.publishedAt || message.createdAt).toLocaleDateString();
    
    return `
        <div class="community-message-card">
            <div class="community-message-header">
                <h3>${message.title}</h3>
                <div class="community-message-meta">
                    <span class="category-badge">${message.type}</span>
                    <span class="language-badge">${message.language}</span>
                    <span class="author">by ${currentUser?.username || 'Anonymous'}</span>
                </div>
            </div>
            <div class="community-message-content">
                <p>${message.content ? (message.content.length > 150 ? message.content.substring(0, 150) + '...' : message.content) : 'No content'}</p>
                <div class="community-message-stats">
                    <span>${message.embeds ? message.embeds.length : 0} embed${message.embeds && message.embeds.length !== 1 ? 's' : ''}</span>
                </div>
            </div>
            <div class="community-message-tags">
                ${(message.keywords || []).slice(0, 5).map(keyword => `<span class="tag">${keyword}</span>`).join('')}
            </div>
            <div class="community-message-actions">
                <button class="btn btn-primary btn-small use-message-btn" data-message-id="${message.messageId}">Use Message</button>
                <span class="message-date">${createdDate}</span>
            </div>
        </div>
    `;
}

function useMessage(messageId) {
    const message = messages.find(m => m.messageId === messageId);
    if (message) {
        // Switch to message builder
        document.querySelector('[data-section="message-builder"]').click();
        
        // Load the message for editing (as a new message)
        currentMessageId = null; // Create as new message
        currentMessageType = message.type;
        showMessageBuilder();
        populateMessageForm(message);
        showNotification('Message loaded for editing!', 'success');
    }
}

// Other features
function setupOtherFeatures() {
    // Copy JSON functionality
    const copyJsonBtn = document.getElementById('copy-json');
    if (copyJsonBtn) {
        copyJsonBtn.addEventListener('click', () => {
            const jsonContent = document.getElementById('json-content').value;
            navigator.clipboard.writeText(jsonContent).then(() => {
                showNotification('JSON copied to clipboard!', 'success');
            });
        });
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.message-menu')) {
            closeAllDropdowns();
        }
    });
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