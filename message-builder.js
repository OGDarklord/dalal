// Global state
let currentUser = null;
let messages = [];
let currentMessageId = null;
let currentEmbedCount = 0;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Add these new functions
document.addEventListener('DOMContentLoaded', () => {
    populateServerSwitcher();
    updateDashboardUserDisplay();
});

async function updateDashboardUserDisplay() {
    const res = await fetch('/api/auth/user');
    if (res.ok) {
        const { user } = await res.json();
        document.getElementById('user-avatar-dashboard').src = `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`;
        document.getElementById('user-username-dashboard').textContent = user.username;
    }
}

async function populateServerSwitcher() {
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
}

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
    
    // View Toggle
    setupViewToggle();
    
    // Community
    setupCommunity();
    
    // Make Public Modal
    setupMakePublicModal();
    
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
                loadCommunityMessages();
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

// Message Builder functionality
function setupMessageBuilder() {
    const createNewBtn = document.getElementById('create-new-message');
    const createFirstBtn = document.getElementById('create-first-message');
    const backToListBtn = document.getElementById('back-to-list');
    const saveMessageBtn = document.getElementById('save-message');
    const addEmbedBtn = document.getElementById('add-embed-btn');
    const messageContentInput = document.getElementById('message-content');

    [createNewBtn, createFirstBtn].forEach(btn => {
        if (btn) btn.addEventListener('click', () => showMessageBuilder());
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

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
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
            const jsonContent = document.getElementById('json-content');
            jsonContent.select();
            document.execCommand('copy');
            showNotification('JSON copied to clipboard!', 'success');
        });
    }
}

function loadMessageBuilderSection() {
    if (currentUser) {
        loadUserMessages();
    }
    showMessageList();
}

async function loadUserMessages() {
    if (!currentUser) return;
    try {
        const response = await fetch(`/api/messages`);
        
        if (response.ok) {
            messages = await response.json();
            updateMessagesList();
            updateDashboardStats();
        } else {
            console.error('Failed to load messages');
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
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
        <div class="message-card-item" data-message-id="${message._id}">
            <div class="message-card-header">
                <div class="message-card-info">
                    <h3 class="message-card-title">${message.title || 'Untitled Message'}</h3>
                    <p class="message-card-description">${truncatedContent}</p>
                    <div class="message-card-stats">
                        <span class="embed-count">${embedCount} embed${embedCount !== 1 ? 's' : ''}</span>
                        ${isPublic ? '<span class="public-badge">Public</span>' : ''}
                    </div>
                </div>
                <div class="message-menu">
                    <button class="message-menu-btn">⋮</button>
                    <div class="message-menu-dropdown">
                        <button class="message-menu-item" data-action="copy-id">Copy ID</button>
                        <button class="message-menu-item" data-action="duplicate">Duplicate</button>
                        ${!isPublic ? '<button class="message-menu-item" data-action="make-public">Make Public</button>' : ''}
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
    const message = messages.find(m => m._id === messageId);
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
        case 'make-public':
            showMakePublicModal(messageId);
            break;
        case 'delete':
            if (confirm('Are you sure you want to delete this message?')) {
                deleteMessage(messageId);
            }
            break;
    }
}

async function deleteMessage(messageId) {
    try {
        const response = await fetch(`/api/messages/${messageId}`, { method: 'DELETE' });
        
        if (response.ok) {
            messages = messages.filter(m => m._id !== messageId);
            updateMessagesList();
            updateDashboardStats();
            showNotification('Message deleted successfully!', 'success');
        } else {
            showNotification('Failed to delete message', 'error');
        }
    } catch (error) {
        showNotification('Error deleting message', 'error');
    }
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
    currentEmbedCount = 0;
    
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

async function loadMessageForEditing(messageId) {
    try {
        const response = await fetch(`/api/messages/${messageId}`);
        
        if (response.ok) {
            const message = await response.json();
            populateMessageForm(message);
            updatePreview();
        } else {
            showNotification('Failed to load message', 'error');
        }
    } catch (error) {
        showNotification('Error loading message', 'error');
    }
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
                <button class="btn btn-small btn-secondary remove-embed" onclick="removeEmbed('${embedId}')">Remove</button>
            </div>
            <div class="embed-form">
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" class="embed-title" placeholder="Embed title" maxlength="256" value="${embedData?.title || ''}">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea class="embed-description" placeholder="Embed description" maxlength="4096">${embedData?.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Color</label>
                    <input type="color" class="embed-color" value="${embedData?.color || '#3b82f6'}">
                </div>
                <div class="form-group">
                    <label>Author Name</label>
                    <input type="text" class="embed-author-name" placeholder="Author name" value="${embedData?.author?.name || ''}">
                </div>
                <div class="form-group">
                    <label>Author Icon URL</label>
                    <input type="url" class="embed-author-icon" placeholder="https://example.com/icon.png" value="${embedData?.author?.icon_url || ''}">
                </div>
                <div class="form-group">
                    <label>Thumbnail URL</label>
                    <input type="url" class="embed-thumbnail" placeholder="https://example.com/thumbnail.jpg" value="${embedData?.thumbnail?.url || ''}">
                </div>
                <div class="form-group">
                    <label>Image URL</label>
                    <input type="url" class="embed-image" placeholder="https://example.com/image.jpg" value="${embedData?.image?.url || ''}">
                </div>
                <div class="form-group">
                    <label>Footer Text</label>
                    <input type="text" class="embed-footer-text" placeholder="Footer text" value="${embedData?.footer?.text || ''}">
                </div>
                <div class="form-group">
                    <label>Footer Icon URL</label>
                    <input type="url" class="embed-footer-icon" placeholder="https://example.com/footer-icon.png" value="${embedData?.footer?.icon_url || ''}">
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" class="embed-timestamp" ${embedData?.timestamp ? 'checked' : ''}> Include Timestamp
                    </label>
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
    return {
        title: embedElement.querySelector('.embed-title').value,
        description: embedElement.querySelector('.embed-description').value,
        color: parseInt(embedElement.querySelector('.embed-color').value.replace('#', ''), 16),
        author: {
            name: embedElement.querySelector('.embed-author-name').value,
            icon_url: embedElement.querySelector('.embed-author-icon').value
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
        embedHtml += `<div class="embed-title">${embedData.title}</div>`;
    }
    
    if (embedData.description) {
        embedHtml += `<div class="embed-description">${embedData.description}</div>`;
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
        if (embedData.color) cleanEmbed.color = embedData.color;
        
        if (embedData.author.name) {
            cleanEmbed.author = { name: embedData.author.name };
            if (embedData.author.icon_url) cleanEmbed.author.icon_url = embedData.author.icon_url;
        }
        
        if (embedData.thumbnail.url) cleanEmbed.thumbnail = { url: embedData.thumbnail.url };
        if (embedData.image.url) cleanEmbed.image = { url: embedData.image.url };
        
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
}

async function saveMessage() {
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
        content: messageContent,
        embeds: embeds,
        is_public: false
    };

    try {
        const url = currentMessageId ? `/api/messages/${currentMessageId}` : '/api/messages';
        const method = currentMessageId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData),
        });
        
        if (response.ok) {
            showNotification(currentMessageId ? 'Message updated!' : 'Message created!', 'success');
            loadUserMessages();
            showMessageList();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to save message', 'error');
        }
    } catch (error) {
        showNotification('Error saving message', 'error');
    }
}

// Make Public Modal functionality
function setupMakePublicModal() {
    const modal = document.getElementById('make-public-modal');
    const closeBtn = document.getElementById('close-public-modal');
    const cancelBtn = document.getElementById('cancel-public');
    const confirmBtn = document.getElementById('confirm-public');

    [closeBtn, cancelBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
    });

    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmMakePublic);
    }
}

function showMakePublicModal(messageId) {
    const modal = document.getElementById('make-public-modal');
    modal.setAttribute('data-message-id', messageId);
    modal.style.display = 'flex';
}

async function confirmMakePublic() {
    const modal = document.getElementById('make-public-modal');
    const messageId = modal.getAttribute('data-message-id');
    
    const title = document.getElementById('public-title').value;
    const category = document.getElementById('public-category').value;
    const keywords = document.getElementById('public-keywords').value;
    
    const selectedTags = [];
    document.querySelectorAll('.tag-option input:checked').forEach(checkbox => {
        selectedTags.push(checkbox.value);
    });
    
    if (!title || !category) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    const publicData = {
        title,
        category,
        tags: selectedTags,
        keywords: keywords.split(',').map(k => k.trim()).filter(k => k),
        is_public: true
    };
    
    try {
        const response = await fetch(`/api/messages/${messageId}/public`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(publicData)
        });
        
        if (response.ok) {
            showNotification('Message made public successfully!', 'success');
            modal.style.display = 'none';
            loadUserMessages();
            
            // Clear form
            document.getElementById('public-title').value = '';
            document.getElementById('public-category').value = '';
            document.getElementById('public-keywords').value = '';
            document.querySelectorAll('.tag-option input').forEach(cb => cb.checked = false);
        } else {
            showNotification('Failed to make message public', 'error');
        }
    } catch (error) {
        showNotification('Error making message public', 'error');
    }
}

// Community functionality
function setupCommunity() {
    const searchBtn = document.getElementById('search-community');
    const searchInput = document.getElementById('community-search');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', searchCommunityMessages);
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchCommunityMessages();
            }
        });
    }
}

async function loadCommunityMessages() {
    const container = document.getElementById('community-messages');
    const loading = document.getElementById('community-loading');
    
    loading.style.display = 'block';
    container.innerHTML = '';
    
    try {
        const response = await fetch('/api/messages/public');
        if (response.ok) {
            const messages = await response.json();
            displayCommunityMessages(messages);
        } else {
            container.innerHTML = '<p>Failed to load community messages</p>';
        }
    } catch (error) {
        container.innerHTML = '<p>Error loading community messages</p>';
    } finally {
        loading.style.display = 'none';
    }
}

async function searchCommunityMessages() {
    const search = document.getElementById('community-search').value;
    const category = document.getElementById('community-category').value;
    const tags = Array.from(document.getElementById('community-tags').selectedOptions).map(option => option.value);
    
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (tags.length > 0) params.append('tags', tags.join(','));
    
    const container = document.getElementById('community-messages');
    const loading = document.getElementById('community-loading');
    
    loading.style.display = 'block';
    container.innerHTML = '';
    
    try {
        const response = await fetch(`/api/messages/public/search?${params}`);
        if (response.ok) {
            const messages = await response.json();
            displayCommunityMessages(messages);
        } else {
            container.innerHTML = '<p>No messages found</p>';
        }
    } catch (error) {
        container.innerHTML = '<p>Error searching messages</p>';
    } finally {
        loading.style.display = 'none';
    }
}

function displayCommunityMessages(messages) {
    const container = document.getElementById('community-messages');
    
    if (messages.length === 0) {
        container.innerHTML = '<p>No public messages found</p>';
        return;
    }
    
    container.innerHTML = messages.map(message => `
        <div class="community-message-card">
            <div class="community-message-header">
                <h3>${message.title}</h3>
                <div class="community-message-meta">
                    <span class="category-badge">${message.category}</span>
                    <span class="author">by ${message.author?.username || 'Anonymous'}</span>
                </div>
            </div>
            <div class="community-message-content">
                <p>${message.content ? message.content.substring(0, 150) + '...' : 'No content'}</p>
                ${message.embeds && message.embeds.length > 0 ? `<span class="embed-count">${message.embeds.length} embed${message.embeds.length !== 1 ? 's' : ''}</span>` : ''}
            </div>
            <div class="community-message-tags">
                ${message.tags ? message.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
            </div>
            <div class="community-message-actions">
                <button class="btn btn-secondary" onclick="useMessage('${message._id}')">Use Message</button>
                <button class="btn btn-outline" onclick="previewMessage('${message._id}')">Preview</button>
            </div>
        </div>
    `).join('');
}

async function useMessage(messageId) {
    try {
        const response = await fetch(`/api/messages/${messageId}`);
        if (response.ok) {
            const message = await response.json();
            
            // Switch to message builder
            document.querySelector('[data-section="message-builder"]').click();
            showMessageBuilder();
            
            // Populate form with message data
            populateMessageForm(message);
            
            showNotification('Message loaded for editing!', 'success');
        } else {
            showNotification('Failed to load message', 'error');
        }
    } catch (error) {
        showNotification('Error loading message', 'error');
    }
}

function previewMessage(messageId) {
    // This would open a preview modal - simplified for now
    showNotification('Preview functionality coming soon!', 'info');
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
        if (!e.target.closest('.message-menu')) {
            closeAllDropdowns();
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

// Utility functions for other features
function addField(type) { console.log("Add field:", type); }
function createRank() { console.log("Create rank"); }
function duplicateMessage(messageId) { console.log("Duplicate message:", messageId); }