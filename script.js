// Global state
let currentUser = null;
let embeds = [];

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Add this at the top of your script.js
document.addEventListener('DOMContentLoaded', () => {
    // ... your existing code ...
    populateServerSwitcher();
    updateDashboardUserDisplay();
});

// Add these new functions to your script.js
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
            updateUserDisplay();
            loadUserEmbeds();
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
    
    // Embed Builder
    setupEmbedBuilder();
    
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
            
            if (targetSection === 'embed-builder') {
                loadEmbedBuilderSection();
            }
        });
    });
}

// Authentication functionality
function setupAuthentication() {
    const discordLoginBtn = document.getElementById('discord-login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (discordLoginBtn) {
        discordLoginBtn.addEventListener('click', () => {
            window.location.href = '/api/auth/discord';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            logout();
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
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (currentUser) {
        usernameDisplay.textContent = currentUser.username;
        logoutBtn.style.display = 'block';
    } else {
        usernameDisplay.textContent = 'Guest';
        logoutBtn.style.display = 'none';
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        embeds = [];
        updateUserDisplay();
        updateEmbedsList();
        updateDashboardStats();
        showAuthModal();
        showNotification('Logged out successfully', 'info');
    } catch (error) {
        showNotification('Logout failed. Please try again.', 'error');
    }
}

// Embed Builder functionality
function setupEmbedBuilder() {
    const createNewBtn = document.getElementById('create-new-embed');
    const createFirstBtn = document.getElementById('create-first-embed');
    const backToListBtn = document.getElementById('back-to-list');
    const saveEmbedBtn = document.getElementById('save-embed');

    [createNewBtn, createFirstBtn].forEach(btn => {
        if (btn) btn.addEventListener('click', () => showEmbedBuilder());
    });

    if (backToListBtn) {
        backToListBtn.addEventListener('click', () => showEmbedList());
    }

    if (saveEmbedBtn) {
        saveEmbedBtn.addEventListener('click', () => saveEmbed());
    }
}

function loadEmbedBuilderSection() {
    if (currentUser) {
        loadUserEmbeds();
    }
    showEmbedList();
}

async function loadUserEmbeds() {
    if (!currentUser) return;
    try {
        const response = await fetch(`/api/embeds`);
        
        if (response.ok) {
            embeds = await response.json();
            updateEmbedsList();
            updateDashboardStats();
        } else {
            console.error('Failed to load embeds');
        }
    } catch (error) {
        console.error('Error loading embeds:', error);
    }
}

function updateEmbedsList() {
    const embedCardsContainer = document.getElementById('embed-cards-container');
    const noEmbedsMessage = document.getElementById('no-embeds-message');
    
    embedCardsContainer.innerHTML = ''; // Clear previous cards

    if (!currentUser) {
         embedCardsContainer.style.display = 'none';
         noEmbedsMessage.style.display = 'block';
         noEmbedsMessage.querySelector('h3').textContent = "Please sign in to see your embeds.";
         noEmbedsMessage.querySelector('p').textContent = "Once you sign in, your created embeds will appear here.";
         noEmbedsMessage.querySelector('button').style.display = 'none';
         return;
    }

    if (embeds.length === 0) {
        embedCardsContainer.style.display = 'none';
        noEmbedsMessage.style.display = 'block';
        noEmbedsMessage.querySelector('h3').textContent = "You haven't created any embeds yet.";
        noEmbedsMessage.querySelector('p').textContent = "Get started by creating your first embed!";
        noEmbedsMessage.querySelector('button').style.display = 'inline-block';

    } else {
        embedCardsContainer.style.display = 'grid';
        noEmbedsMessage.style.display = 'none';
        
        embedCardsContainer.innerHTML = embeds.map(embed => createEmbedCard(embed)).join('');
        
        embedCardsContainer.querySelectorAll('.embed-card-item').forEach(card => {
            card.addEventListener('click', function(e) {
                if (!e.target.closest('.embed-menu')) {
                    const embedId = this.getAttribute('data-embed-id');
                    editEmbed(embedId);
                }
            });
        });
        
        embedCardsContainer.querySelectorAll('.embed-menu-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const dropdown = this.nextElementSibling;
                closeAllDropdowns();
                dropdown.classList.toggle('show');
            });
        });
        
        embedCardsContainer.querySelectorAll('.embed-menu-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                const action = this.getAttribute('data-action');
                const embedId = this.closest('.embed-card-item').getAttribute('data-embed-id');
                handleEmbedAction(action, embedId);
                closeAllDropdowns();
            });
        });
    }
}

function createEmbedCard(embed) {
    const createdDate = new Date(embed.createdAt).toLocaleDateString();
    const truncatedDescription = embed.description ? 
        (embed.description.length > 100 ? embed.description.substring(0, 100) + '...' : embed.description) : 
        'No description';

    return `
        <div class="embed-card-item" data-embed-id="${embed._id}">
            <div class="embed-card-header">
                <div class="embed-card-info">
                    <h3 class="embed-card-title">${embed.title || 'Untitled Embed'}</h3>
                    <p class="embed-card-description">${truncatedDescription}</p>
                </div>
                <div class="embed-menu">
                    <button class="embed-menu-btn">⋮</button>
                    <div class="embed-menu-dropdown">
                        <button class="embed-menu-item" data-action="copy-id">Copy ID</button>
                        <button class="embed-menu-item" data-action="delete">Delete</button>
                        <button class="embed-menu-item" data-action="send">Send</button>
                    </div>
                </div>
            </div>
            <div class="embed-card-meta">
                <span class="embed-card-id">${embed.embedId}</span>
                <span class="embed-card-date">${createdDate}</span>
            </div>
        </div>
    `;
}

function closeAllDropdowns() {
    document.querySelectorAll('.embed-menu-dropdown').forEach(dropdown => {
        dropdown.classList.remove('show');
    });
}

function handleEmbedAction(action, embedId) {
    const embed = embeds.find(e => e._id === embedId);
    if (!embed) return;
    
    switch (action) {
        case 'copy-id':
            navigator.clipboard.writeText(embed.embedId).then(() => {
                showNotification('Embed ID copied to clipboard!', 'success');
            });
            break;
        case 'delete':
            if (confirm('Are you sure you want to delete this embed?')) {
                deleteEmbed(embedId);
            }
            break;
        case 'send':
            showNotification('Send functionality coming soon!', 'info');
            break;
    }
}

async function deleteEmbed(embedId) {
    try {
        const response = await fetch(`/api/embeds/${embedId}`, { method: 'DELETE' });
        
        if (response.ok) {
            embeds = embeds.filter(e => e._id !== embedId);
            updateEmbedsList();
            updateDashboardStats();
            showNotification('Embed deleted successfully!', 'success');
        } else {
            showNotification('Failed to delete embed', 'error');
        }
    } catch (error) {
        showNotification('Error deleting embed', 'error');
    }
}

function showEmbedList() {
    document.getElementById('embed-list-view').style.display = 'block';
    document.getElementById('embed-builder-view').style.display = 'none';
    currentEmbedId = null;
}

function showEmbedBuilder(embedId = null) {
    document.getElementById('embed-list-view').style.display = 'none';
    document.getElementById('embed-builder-view').style.display = 'block';
    
    currentEmbedId = embedId;
    
    if (embedId) {
        document.getElementById('builder-title').textContent = 'Edit Embed';
        loadEmbedForEditing(embedId);
    } else {
        document.getElementById('builder-title').textContent = 'Create New Embed';
        clearEmbedForm();
        updateEmbedPreview();
    }
}

function editEmbed(embedId) {
    showEmbedBuilder(embedId);
}

async function loadEmbedForEditing(embedId) {
    try {
        const response = await fetch(`/api/embeds/${embedId}`);
        
        if (response.ok) {
            const embed = await response.json();
            populateEmbedForm(embed);
            updateEmbedPreview();
        } else {
            showNotification('Failed to load embed', 'error');
        }
    } catch (error) {
        showNotification('Error loading embed', 'error');
    }
}

function populateEmbedForm(embed) {
    document.getElementById('embed-title').value = embed.title || '';
    document.getElementById('embed-description').value = embed.description || '';
    document.getElementById('embed-color').value = embed.color || '#3b82f6';
    document.getElementById('embed-url').value = embed.url || '';
    // This assumes your embed object in DB matches these field names.
    // You may need to adjust based on the data you save in the POST/PUT requests.
    document.getElementById('embed-author-name').value = embed.author?.name || '';
    document.getElementById('embed-author-icon').value = embed.author?.icon_url || '';
    document.getElementById('embed-author-url').value = embed.author?.url || '';
    document.getElementById('embed-thumbnail').value = embed.thumbnail?.url || '';
    document.getElementById('embed-image').value = embed.image?.url || '';
    document.getElementById('embed-footer-text').value = embed.footer?.text || '';
    document.getElementById('embed-footer-icon').value = embed.footer?.icon_url || '';
    document.getElementById('embed-timestamp').checked = embed.timestamp || false;
}

function clearEmbedForm() {
    document.getElementById('embed-form').reset();
    document.getElementById('embed-color').value = '#3b82f6';
}

async function saveEmbed() {
    const embedData = {
        title: document.getElementById('embed-title').value,
        description: document.getElementById('embed-description').value,
        color: document.getElementById('embed-color').value,
        url: document.getElementById('embed-url').value,
        authorName: document.getElementById('embed-author-name').value,
        authorIcon: document.getElementById('embed-author-icon').value,
        authorUrl: document.getElementById('embed-author-url').value,
        thumbnail: document.getElementById('embed-thumbnail').value,
        image: document.getElementById('embed-image').value,
        footerText: document.getElementById('embed-footer-text').value,
        footerIcon: document.getElementById('embed-footer-icon').value,
        timestamp: document.getElementById('embed-timestamp').checked
    };

    try {
        const url = currentEmbedId ? `/api/embeds/${currentEmbedId}` : '/api/embeds';
        const method = currentEmbedId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embedData),
        });
        
        if (response.ok) {
            showNotification(currentEmbedId ? 'Embed updated!' : 'Embed created!', 'success');
            loadUserEmbeds();
            showEmbedList();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to save embed', 'error');
        }
    } catch (error) {
        showNotification('Error saving embed', 'error');
    }
}


// Form auto-updates
function setupFormUpdates() {
    const embedForm = document.getElementById('embed-form');
    if (embedForm) {
        embedForm.addEventListener('input', updateEmbedPreview);
        embedForm.addEventListener('change', updateEmbedPreview);
    }
    
    const rankForm = document.querySelector('.rank-form');
    if (rankForm) {
        rankForm.addEventListener('input', updateRankPreview);
    }
}

function updateEmbedPreview() {
    const title = document.getElementById('embed-title').value || 'Sample Title';
    const description = document.getElementById('embed-description').value || 'Sample description text';
    const color = document.getElementById('embed-color').value;
    const url = document.getElementById('embed-url').value;
    const authorName = document.getElementById('embed-author-name').value;
    const authorIcon = document.getElementById('embed-author-icon').value;
    const thumbnail = document.getElementById('embed-thumbnail').value;
    const image = document.getElementById('embed-image').value;
    const footerText = document.getElementById('embed-footer-text').value;
    const footerIcon = document.getElementById('embed-footer-icon').value;
    const timestamp = document.getElementById('embed-timestamp').checked;
    
    document.getElementById('preview-color-bar').style.backgroundColor = color;
    
    const titleElement = document.getElementById('preview-title');
    titleElement.textContent = title;
    
    document.getElementById('preview-description').textContent = description;
    
    const authorElement = document.getElementById('preview-author');
    if (authorName) {
        authorElement.style.display = 'flex';
        document.getElementById('preview-author-name').textContent = authorName;
        const authorIconElement = document.getElementById('preview-author-icon');
        if (authorIcon) {
            authorIconElement.src = authorIcon;
            authorIconElement.style.display = 'block';
        } else {
            authorIconElement.style.display = 'none';
        }
    } else {
        authorElement.style.display = 'none';
    }
    
    const thumbnailElement = document.getElementById('preview-thumbnail');
    if (thumbnail) {
        thumbnailElement.style.display = 'block';
        thumbnailElement.style.backgroundImage = `url(${thumbnail})`;
    } else {
        thumbnailElement.style.display = 'none';
    }
    
    const imageElement = document.getElementById('preview-image');
    if (image) {
        imageElement.style.display = 'block';
        imageElement.style.backgroundImage = `url(${image})`;
    } else {
        imageElement.style.display = 'none';
    }
    
    const footerElement = document.getElementById('preview-footer');
    if (footerText || timestamp) {
        footerElement.style.display = 'flex';
        document.getElementById('preview-footer-text').textContent = footerText;
        
        const footerIconElement = document.getElementById('preview-footer-icon');
        if (footerIcon) {
            footerIconElement.src = footerIcon;
            footerIconElement.style.display = 'block';
        } else {
            footerIconElement.style.display = 'none';
        }
        
        const timestampElement = document.getElementById('preview-timestamp');
        if (timestamp) {
            timestampElement.textContent = ` • ${new Date().toLocaleString()}`;
        } else {
            timestampElement.textContent = '';
        }
    } else {
        footerElement.style.display = 'none';
    }
}

// Other features
function setupOtherFeatures() {
    setupSupportFormBuilder();
    setupRankCreation();
    setupTemplateSearch();
    setupAdminToggles();
    
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.embed-menu')) {
            closeAllDropdowns();
        }
    });
}

function updateDashboardStats() {
    const totalEmbedsElement = document.getElementById('total-embeds');
    if (totalEmbedsElement) {
        totalEmbedsElement.textContent = embeds.length;
    }
}

// Stubs for other features - no changes needed for them
function setupSupportFormBuilder() {}
function setupRankCreation() {}
function setupTemplateSearch() {}
function setupAdminToggles() {}
function addField(type) { console.log("Add field:", type); }
function createRank() { console.log("Create rank"); }
function updateRankPreview() {}

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