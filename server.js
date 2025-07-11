import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import fetch from 'node-fetch';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// MongoDB connection
let db;
const client = new MongoClient(process.env.MONGODB_URI);

async function connectDB() {
    try {
        await client.connect();
        db = client.db('embedbuilder');
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
    }
}

// Session setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'a-secret-key-for-sessions',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(id) });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

passport.use(new DiscordStrategy({
    clientID: '1391762416940875816',
    clientSecret: 'fV8pZMnGaKCAHm8wV6wO-X7nN2wUI_1N',
    callbackURL: 'http://localhost:3000/api/auth/discord/callback',
    scope: ['identify', 'email', 'guilds']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const { id: discordId, username, email, avatar } = profile;
        let user = await db.collection('users').findOne({ discordId });

        const userData = {
            username,
            email,
            avatar,
            accessToken,
            lastLogin: new Date()
        };

        if (user) {
            await db.collection('users').updateOne({ discordId }, { $set: userData });
        } else {
            const newUser = { discordId, ...userData, createdAt: new Date() };
            const result = await db.collection('users').insertOne(newUser);
            user = { ...newUser, _id: result.insertedId };
        }
        
        return done(null, { ...user, ...userData });
    } catch (error) {
        return done(error, null);
    }
}));

// --- Auth Routes ---
app.get('/api/auth/discord', passport.authenticate('discord'));

app.get('/api/auth/discord/callback', passport.authenticate('discord', {
    failureRedirect: '/'
}), (req, res) => {
    res.redirect('/servers'); 
});

app.get('/api/auth/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ user: req.user });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

app.post('/api/auth/logout', (req, res, next) => {
    req.logout(err => {
        if (err) { return next(err); }
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.json({ message: 'Logged out successfully' });
        });
    });
});

// --- Stat & Rating Routes ---

app.get('/api/stats', async (req, res) => {
    try {
        // Fetch bot's guilds
        const botGuildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` }
        });
        const botGuilds = await botGuildsResponse.json();

        if (!Array.isArray(botGuilds)) {
            return res.status(500).json({ error: 'Failed to fetch bot guilds.' });
        }

        // Calculate total members
        // NOTE: This is an approximation. For large bots, you'd fetch each guild individually.
        const totalMembers = botGuilds.reduce((sum, guild) => sum + (guild.approximate_member_count || 0), 0);
        const onlineUsers = botGuilds.reduce((sum, guild) => sum + (guild.approximate_presence_count || 0), 0);
        
        // Calculate average rating
        const ratingData = await db.collection('ratings').aggregate([
            { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } }
        ]).toArray();
        
        const avgRating = ratingData.length > 0 ? ratingData[0].avgRating.toFixed(1) : "N/A";

        res.json({
            totalServers: botGuilds.length,
            totalMembers: totalMembers,
            onlineUsers: onlineUsers,
            avgRating: avgRating
        });
    } catch (error) {
        console.error('Error fetching bot stats:', error);
        res.status(500).json({ error: 'Failed to fetch bot stats' });
    }
});

app.post('/api/rating/submit', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        const { rating } = req.body;
        const discordId = req.user.discordId;

        await db.collection('ratings').updateOne(
            { discordId },
            { $set: { rating: Number(rating), createdAt: new Date() } },
            { upsert: true }
        );
        res.status(200).json({ message: 'Rating submitted' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/rating/check/:discordId', async (req, res) => {
     try {
        const { discordId } = req.params;
        const rating = await db.collection('ratings').findOne({ discordId });
        res.json({ hasRated: !!rating });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});


// --- Guild (Server) Routes ---
app.get('/api/guilds/mutual', async (req, res) => {
    // Test mode bypass
    if (process.env.TEST_MODE === 'true') {
        const testGuilds = [
            {
                id: '123456789',
                name: 'Test Server',
                icon: null,
                banner: null,
                description: 'A test server for development',
                approximate_member_count: 100,
                approximate_presence_count: 50,
                permissions: '8'
            }
        ];
        return res.json(testGuilds);
    }
    
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userGuildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${req.user.accessToken}` }
        });
        const userGuilds = await userGuildsResponse.json();

        const botGuildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` }
        });
        const botGuilds = await botGuildsResponse.json();
        
        if (!Array.isArray(userGuilds) || !Array.isArray(botGuilds)) {
            console.error("Failed to fetch guilds from Discord API", {userGuilds, botGuilds});
            return res.status(500).json({ error: 'Could not retrieve guilds from Discord.' });
        }

        const botGuildIds = new Set(botGuilds.map(g => g.id));
        
        const mutualGuildsPromises = userGuilds
            .filter(guild => {
                const isAdmin = (BigInt(guild.permissions) & BigInt(0x8)) === BigInt(0x8);
                return botGuildIds.has(guild.id) && isAdmin;
            })
            .map(async (guild) => {
                // Fetch detailed guild info for banner, description, etc.
                const guildDetailsResponse = await fetch(`https://discord.com/api/guilds/${guild.id}?with_counts=true`, {
                    headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` }
                });
                const details = await guildDetailsResponse.json();
                return {
                    ...guild,
                    banner: details.banner,
                    description: details.description,
                    approximate_member_count: details.approximate_member_count,
                    approximate_presence_count: details.approximate_presence_count,
                };
            });
            
        const mutualGuilds = await Promise.all(mutualGuildsPromises);

        res.json(mutualGuilds);

    } catch (error) {
        console.error('Error fetching mutual guilds:', error);
        res.status(500).json({ error: 'Failed to fetch guilds' });
    }
});

// --- Message Routes ---

// Generate unique 7-character ID
function generateMessageId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 7; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Create Message
app.post('/api/messages', async (req, res) => {
    try {
        const { content, embeds, is_public } = req.body;
        
        let messageId;
        let isUnique = false;
        
        while (!isUnique) {
            messageId = generateMessageId();
            const existing = await db.collection('messages').findOne({ messageId });
            if (!existing) isUnique = true;
        }
        
        const message = {
            messageId,
            content,
            embeds: embeds || [],
            is_public: is_public || false,
            userId: req.isAuthenticated() ? req.user._id : null,
            ipAddress: req.isAuthenticated() ? null : getClientIP(req),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await db.collection('messages').insertOne(message);
        
        res.status(201).json({ 
            message: 'Message created successfully',
            messageId,
            id: result.insertedId 
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get User Messages
app.get('/api/messages', async (req, res) => {
    try {
        let query = {};
        if (req.isAuthenticated()) {
            query.userId = req.user._id;
        } else {
            return res.json([]); 
        }
        
        const messages = await db.collection('messages').find(query).toArray();
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Single Message
app.get('/api/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        let message;
        if (id.length === 7) {
            message = await db.collection('messages').findOne({ messageId: id });
        } else {
            message = await db.collection('messages').findOne({ _id: new ObjectId(id) });
        }
        
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        res.json(message);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update Message
app.put('/api/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { content, embeds, is_public } = req.body;
        
        const updateData = { 
            content, 
            embeds: embeds || [], 
            is_public: is_public || false, 
            updatedAt: new Date() 
        };
        
        let result;
        if (id.length === 7) {
            result = await db.collection('messages').updateOne({ messageId: id }, { $set: updateData });
        } else {
            result = await db.collection('messages').updateOne({ _id: new ObjectId(id) }, { $set: updateData });
        }
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        res.json({ message: 'Message updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete Message
app.delete('/api/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        let result;
        if (id.length === 7) {
            result = await db.collection('messages').deleteOne({ messageId: id });
        } else {
            result = await db.collection('messages').deleteOne({ _id: new ObjectId(id) });
        }
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Make Message Public
app.put('/api/messages/:id/public', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, category, tags, keywords, is_public } = req.body;
        
        const updateData = {
            title,
            category,
            tags: tags || [],
            keywords: keywords || [],
            is_public: is_public || true,
            updatedAt: new Date()
        };
        
        let result;
        if (id.length === 7) {
            result = await db.collection('messages').updateOne({ messageId: id }, { $set: updateData });
        } else {
            result = await db.collection('messages').updateOne({ _id: new ObjectId(id) }, { $set: updateData });
        }
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        res.json({ message: 'Message made public successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Public Messages
app.get('/api/messages/public', async (req, res) => {
    try {
        const messages = await db.collection('messages')
            .find({ is_public: true })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
            
        // Add author information
        const messagesWithAuthors = await Promise.all(messages.map(async (message) => {
            if (message.userId) {
                const author = await db.collection('users').findOne({ _id: message.userId });
                return { ...message, author: { username: author?.username || 'Anonymous' } };
            }
            return { ...message, author: { username: 'Anonymous' } };
        }));
        
        res.json(messagesWithAuthors);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Search Public Messages
app.get('/api/messages/public/search', async (req, res) => {
    try {
        const { search, category, tags } = req.query;
        
        let query = { is_public: true };
        
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { keywords: { $in: [new RegExp(search, 'i')] } }
            ];
        }
        
        if (category) {
            query.category = category;
        }
        
        if (tags) {
            const tagArray = tags.split(',');
            query.tags = { $in: tagArray };
        }
        
        const messages = await db.collection('messages')
            .find(query)
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
            
        // Add author information
        const messagesWithAuthors = await Promise.all(messages.map(async (message) => {
            if (message.userId) {
                const author = await db.collection('users').findOne({ _id: message.userId });
                return { ...message, author: { username: author?.username || 'Anonymous' } };
            }
            return { ...message, author: { username: 'Anonymous' } };
        }));
        
        res.json(messagesWithAuthors);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});


// --- Page Serving Routes ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/servers', (req, res) => {
    res.sendFile(path.join(__dirname, 'servers.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});


// Start server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});