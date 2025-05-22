const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const session = require('express-session');
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const multer = require('multer');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const serverless = require('serverless-http');
const app = express();
const upload = multer();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));
app.use(fileUpload());

// Configure Cloudflare R2 using AWS SDK v3
const r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY,
    },
});

// Global settings
let backgroundSettings = {
    type: 'video',
    url: '',
    blur: 0
};

let musicSettings = {
    files: [],
    autoplay: false,
    showPlayer: true
};

const isAuthenticated = (req, res, next) => {
    if (req.session.isAuthenticated) {
        return next();
    }
    res.redirect('/admin');
};

// --- Begin migrated logic from app.js ---

// Authentication middleware
// ...existing code from app.js...

// Routes
// ...existing code from app.js...

// Helper functions
// ...existing code from app.js...

// --- End migrated logic from app.js ---

// Define the settings file path
const settingsFilePath = path.join(__dirname, '../settings.json');

function loadSettings() {
    if (fs.existsSync(settingsFilePath)) {
        const data = fs.readFileSync(settingsFilePath);
        const settings = JSON.parse(data);
        backgroundSettings = settings.backgroundSettings || backgroundSettings;
        musicSettings = settings.musicSettings || musicSettings;
    }
}

function saveSettings() {
    const settings = { backgroundSettings, musicSettings };
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
}

loadSettings();

module.exports = app;
module.exports.handler = serverless(app);
