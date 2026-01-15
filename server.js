/* =============================================
   SAFARSORTED - BACKEND SERVER FOR RENDER
   Node.js + Express + JSON File Storage
   ============================================= */

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Data file for storage
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'inquiries.json');

// =============================================
// MIDDLEWARE
// =============================================

// CORS - Allow frontend from GitHub Pages
app.use(cors({
    origin: ['https://safarsorted.github.io', 'http://localhost:5500', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const rateLimitStore = new Map();
const apiLimiter = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const requests = rateLimitStore.get(ip) || [];
    const recentRequests = requests.filter(time => now - time < 60000);

    if (recentRequests.length >= 30) {
        return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }

    recentRequests.push(now);
    rateLimitStore.set(ip, recentRequests);
    next();
};

// =============================================
// DATABASE SETUP
// =============================================

function initDatabase() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ inquiries: [], lastId: 0 }, null, 2));
    }

    console.log('✅ JSON file storage initialized');
}

function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { inquiries: [], lastId: 0 };
    }
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// =============================================
// API ROUTES
// =============================================

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'SafarSorted API is running',
        version: '2.0'
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Submit inquiry
app.post('/api/inquiry', apiLimiter, (req, res) => {
    try {
        const { name, phone, travelers, destination, travelDate, travelerType, email, message } = req.body;

        // Validation
        if (!name || !phone || !travelers || !destination) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Phone validation
        const cleanPhone = phone.replace(/\s/g, '');
        if (!/^[\+]?[0-9]{10,15}$/.test(cleanPhone)) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        const data = readData();
        data.lastId++;

        const inquiry = {
            id: data.lastId,
            name,
            phone: cleanPhone,
            email: email || '',
            travelers: parseInt(travelers),
            destination,
            travel_date: travelDate || null,
            traveler_type: travelerType || null,
            message: message || '',
            status: 'new',
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        data.inquiries.push(inquiry);
        writeData(data);

        console.log(`📧 New inquiry received: ${name} - ${destination}`);

        res.status(201).json({
            success: true,
            message: 'Inquiry submitted successfully',
            id: inquiry.id
        });

    } catch (error) {
        console.error('Error submitting inquiry:', error);
        res.status(500).json({ error: 'Failed to submit inquiry' });
    }
});

// Get all inquiries (admin)
app.get('/api/admin/inquiries', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Basic ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Decode credentials
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(':');

        // Check credentials (use environment variables in production)
        const adminUser = process.env.ADMIN_USER || 'Mehul20020';
        const adminPass = process.env.ADMIN_PASS || 'Ninja2002@';

        if (username !== adminUser || password !== adminPass) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const data = readData();
        const inquiries = data.inquiries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json({ inquiries });

    } catch (error) {
        console.error('Error fetching inquiries:', error);
        res.status(500).json({ error: 'Failed to fetch inquiries' });
    }
});

// Update inquiry status (admin)
app.put('/api/admin/inquiries/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const data = readData();
        const inquiry = data.inquiries.find(i => i.id === parseInt(id));

        if (inquiry) {
            inquiry.status = status || inquiry.status;
            inquiry.notes = notes !== undefined ? notes : inquiry.notes;
            inquiry.updated_at = new Date().toISOString();
            writeData(data);
            res.json({ success: true, message: 'Inquiry updated', inquiry });
        } else {
            res.status(404).json({ error: 'Inquiry not found' });
        }

    } catch (error) {
        console.error('Error updating inquiry:', error);
        res.status(500).json({ error: 'Failed to update inquiry' });
    }
});

// Delete inquiry (admin)
app.delete('/api/admin/inquiries/:id', (req, res) => {
    try {
        const { id } = req.params;
        const data = readData();
        const initialLength = data.inquiries.length;
        data.inquiries = data.inquiries.filter(i => i.id !== parseInt(id));

        if (data.inquiries.length < initialLength) {
            writeData(data);
            res.json({ success: true, message: 'Inquiry deleted' });
        } else {
            res.status(404).json({ error: 'Inquiry not found' });
        }

    } catch (error) {
        console.error('Error deleting inquiry:', error);
        res.status(500).json({ error: 'Failed to delete inquiry' });
    }
});

// Get statistics (admin)
app.get('/api/admin/stats', (req, res) => {
    try {
        const data = readData();
        const now = new Date();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

        const stats = {
            total: data.inquiries.length,
            new: data.inquiries.filter(i => i.status === 'new').length,
            contacted: data.inquiries.filter(i => i.status === 'contacted').length,
            booked: data.inquiries.filter(i => i.status === 'booked').length,
            thisWeek: data.inquiries.filter(i => new Date(i.created_at) >= weekAgo).length
        };

        res.json(stats);

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// =============================================
// ERROR HANDLING
// =============================================

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// =============================================
// START SERVER
// =============================================

initDatabase();

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 SafarSorted API Server v2.0                          ║
║                                                            ║
║   🌐 Running on port: ${PORT}                                ║
║   📊 API Base: /api                                        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
