import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
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
    secret: 'a-secret-key-for-sessions', // Replace with a real secret in your .env file
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
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
    scope: ['identify', 'email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const { id: discordId, username, email, avatar } = profile;
        
        let user = await db.collection('users').findOne({ discordId });
        
        if (user) {
            // User exists, update their info
            await db.collection('users').updateOne({ discordId }, {
                $set: {
                    username,
                    email,
                    avatar,
                    lastLogin: new Date()
                }
            });
        } else {
            // New user, create them
            const newUser = {
                discordId,
                username,
                email,
                avatar,
                createdAt: new Date(),
                lastLogin: new Date()
            };
            const result = await db.collection('users').insertOne(newUser);
            user = { ...newUser, _id: result.insertedId };
        }
        
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Generate unique 7-character ID
function generateEmbedId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 7; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Get client IP
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
}

// Routes

// --- Auth Routes ---
app.get('/api/auth/discord', passport.authenticate('discord'));

app.get('/api/auth/discord/callback', passport.authenticate('discord', {
    failureRedirect: '/'
}), (req, res) => {
    res.redirect('/'); // Redirect to the homepage after successful login
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

// --- Embed Routes ---

// Create Embed
app.post('/api/embeds', async (req, res) => {
    try {
        const { title, description, color, thumbnail, url } = req.body;
        
        let embedId;
        let isUnique = false;
        
        while (!isUnique) {
            embedId = generateEmbedId();
            const existing = await db.collection('embeds').findOne({ embedId });
            if (!existing) isUnique = true;
        }
        
        const embed = {
            embedId,
            title,
            description,
            color,
            thumbnail,
            url,
            userId: req.isAuthenticated() ? req.user._id : null,
            ipAddress: req.isAuthenticated() ? null : getClientIP(req),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await db.collection('embeds').insertOne(embed);
        
        res.status(201).json({ 
            message: 'Embed created successfully',
            embedId,
            id: result.insertedId 
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get User Embeds
app.get('/api/embeds', async (req, res) => {
    try {
        let query = {};
        if (req.isAuthenticated()) {
            query.userId = req.user._id;
        } else {
            // For unauthenticated users, you might want to prevent access
            // or handle guest embeds differently if you still want that feature.
            // For now, it will return an empty array for logged-out users.
            return res.json([]); 
        }
        
        const embeds = await db.collection('embeds').find(query).toArray();
        res.json(embeds);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Single Embed
app.get('/api/embeds/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        let embed;
        if (id.length === 7) {
            embed = await db.collection('embeds').findOne({ embedId: id });
        } else {
            embed = await db.collection('embeds').findOne({ _id: new ObjectId(id) });
        }
        
        if (!embed) {
            return res.status(404).json({ error: 'Embed not found' });
        }
        
        res.json(embed);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update Embed
app.put('/api/embeds/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, color, thumbnail, url } = req.body;
        
        const updateData = { title, description, color, thumbnail, url, updatedAt: new Date() };
        
        let result;
        if (id.length === 7) {
            result = await db.collection('embeds').updateOne({ embedId: id }, { $set: updateData });
        } else {
            result = await db.collection('embeds').updateOne({ _id: new ObjectId(id) }, { $set: updateData });
        }
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Embed not found' });
        }
        
        res.json({ message: 'Embed updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete Embed
app.delete('/api/embeds/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        let result;
        if (id.length === 7) {
            result = await db.collection('embeds').deleteOne({ embedId: id });
        } else {
            result = await db.collection('embeds').deleteOne({ _id: new ObjectId(id) });
        }
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Embed not found' });
        }
        
        res.json({ message: 'Embed deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});


// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});