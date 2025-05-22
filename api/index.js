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

// Routes
app.get('/', async (req, res) => {
    try {
        // Fetch the list of music files from Cloudflare R2
        const params = {
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            Prefix: 'music/',
        };

        const data = await r2Client.send(new ListObjectsV2Command(params));
        // Try to match files with titles from musicSettings.files
        const musicFiles = (data.Contents || []).map(file => {
            const url = `https://pub-3cf28645129b480fa630d3772e9352fe.r2.dev/${file.Key}`;
            const found = (musicSettings.files || []).find(f => f.url === url);
            return {
                key: file.Key,
                url,
                title: found ? found.title : file.Key.split('/').pop(),
                artist: found ? found.artist : 'Unknown Artist',
            };
        });

        // Randomly select a starting music file
        const randomIndex = Math.floor(Math.random() * musicFiles.length);
        const selectedMusic = musicFiles[randomIndex];

        res.render('index', {
            title: process.env.SITE_TITLE || '',
            background: backgroundSettings,
            music: {
                files: musicFiles,
                selected: selectedMusic,
                autoplay: musicSettings.autoplay,
                showPlayer: musicSettings.showPlayer
            }
        });
    } catch (error) {
        console.error('Error fetching music files:', error);
        res.render('index', {
            title: process.env.SITE_TITLE || '',
            background: backgroundSettings,
            music: {
                files: [],
                selected: null,
                autoplay: musicSettings.autoplay,
                showPlayer: musicSettings.showPlayer
            }
        });
    }
});

// Admin routes
app.get('/admin', (req, res) => {
    res.render('admin/admin', { error: null });
});

app.post('/admin/login', (req, res) => {
    const { passkey } = req.body;
    if (passkey === process.env.ADMIN_PASSKEY) {
        req.session.isAuthenticated = true;
        res.redirect('/admin/dashboard');
    } else {
        res.render('admin/admin', { error: 'Invalid passkey' });
    }
});

function getDefaultRenderParams() {
    return {
        backgroundType: backgroundSettings.type,
        backgroundUrl: backgroundSettings.url,
        blur: backgroundSettings.blur,
        musicUrl: musicSettings.url,
        autoplay: musicSettings.autoplay,
        showPlayer: musicSettings.showPlayer,
        error: null,
        success: null,
        musicError: null,
        musicSuccess: null
    };
}

function getDashboardRenderObj(params = {}) {
    const defaults = getDefaultRenderParams();
    const merged = { ...defaults, ...params };
    return {
        title: 'Admin Dashboard',
        background: {
            type: merged.backgroundType,
            url: merged.backgroundUrl,
            blur: merged.blur
        },
        music: {
            url: merged.musicUrl,
            autoplay: merged.autoplay,
            showPlayer: merged.showPlayer
        },
        error: merged.error,
        success: merged.success,
        musicError: merged.musicError,
        musicSuccess: merged.musicSuccess
    };
}

app.get('/admin/dashboard', isAuthenticated, (req, res) => {
    res.render('admin/dashboard', {
        ...getDashboardRenderObj()
    });
});

app.post('/admin/update-background', isAuthenticated, (req, res) => {
    const { type, blur } = req.body;
    if (type === 'video' && !backgroundSettings.url) {
        return res.render('admin/dashboard', getDashboardRenderObj({
            error: 'Please upload a video before selecting it as the background.',
            success: null,
        }));
    }
    if (type === 'image' && !backgroundSettings.url) {
        return res.render('admin/dashboard', getDashboardRenderObj({
            error: 'Please upload an image before selecting it as the background.',
            success: null,
        }));
    }
    const blurValue = parseInt(blur) || 0;
    backgroundSettings.type = type;
    backgroundSettings.blur = blurValue;
    saveSettings();
    res.render('admin/dashboard', getDashboardRenderObj({
        error: null,
        success: 'Background updated successfully!',
    }));
});

app.post('/admin/upload-music', isAuthenticated, (req, res) => {
    const { musicUrl } = req.body;
    if (!musicUrl) {
        return res.render('admin/dashboard', {
            ...getDashboardRenderObj({ musicError: 'No file uploaded.' }),
        });
    }
    musicSettings.url = musicUrl;
    res.render('admin/dashboard', {
        ...getDashboardRenderObj({ musicSuccess: 'Music uploaded and set!', music: { ...musicSettings } }),
    });
});

app.post('/admin/update-music', isAuthenticated, (req, res) => {
    const { autoplay, showPlayer } = req.body;
    musicSettings.autoplay = autoplay === 'on';
    musicSettings.showPlayer = showPlayer === 'on';
    saveSettings();
    res.render('admin/dashboard', {
        ...getDashboardRenderObj({ musicSuccess: 'Music settings updated!' }),
    });
});

app.post('/admin/dashboard', isAuthenticated, (req, res) => {
    if (req.body.backgroundType) {
        backgroundSettings.type = req.body.backgroundType;
        if (req.body.backgroundUrl) {
            backgroundSettings.url = req.body.backgroundType === 'video' 
                ? req.body.backgroundUrl // or convertVideoUrl(req.body.backgroundUrl)
                : req.body.backgroundUrl;
        }
        if (req.body.blur !== undefined) {
            backgroundSettings.blur = parseInt(req.body.blur) || 0;
        }
    }
    if (req.body.musicUrl !== undefined) {
        musicSettings.url = req.body.musicUrl; // or convertMusicUrl(req.body.musicUrl)
        musicSettings.autoplay = req.body.musicAutoplay === 'on';
        musicSettings.showPlayer = req.body.showMusicPlayer === 'on';
    }
    res.redirect('/admin/dashboard');
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin');
});

// API endpoints for music, video, and image management
app.post('/api/upload-music', isAuthenticated, (req, res) => {
    if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const file = req.files.file;
    const title = req.body.title || file.name.split('.')[0];
    const artist = req.body.artist || 'Unknown Artist';
    const params = {
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: `music/${file.name}`,
        Body: file.data,
        ContentType: file.mimetype,
        ACL: 'public-read',
    };
    r2Client.send(new PutObjectCommand(params)).then(() => {
        const publicUrl = `https://pub-3cf28645129b480fa630d3772e9352fe.r2.dev/${params.Key}`;
        if (!musicSettings.files) musicSettings.files = [];
        musicSettings.files.push({ url: publicUrl, title, artist });
        saveSettings();
        res.status(200).json({ url: publicUrl, title, artist });
    }).catch(error => {
        console.error('Error uploading to Cloudflare R2:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    });
});

app.get('/api/list-music', isAuthenticated, async (req, res) => {
    try {
        const params = {
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            Prefix: 'music/',
        };
        const data = await r2Client.send(new ListObjectsV2Command(params));
        const files = (data.Contents || []).map(file => {
            const url = `https://pub-3cf28645129b480fa630d3772e9352fe.r2.dev/${file.Key}`;
            const found = (musicSettings.files || []).find(f => f.url === url);
            return {
                key: file.Key,
                url,
                title: found ? found.title : file.Key.split('/').pop(),
                artist: found ? found.artist : 'Unknown Artist',
            };
        });
        musicSettings.files = files.map(f => ({ url: f.url, title: f.title, artist: f.artist }));
        saveSettings();
        res.status(200).json(files);
    } catch (error) {
        console.error('Error listing music files:', error);
        res.status(500).json({ error: 'Failed to list music files' });
    }
});

app.post('/api/set-selected-music', (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Music URL is required' });
    }
    musicSettings.url = url;
    musicSettings.autoplay = true;
    musicSettings.showPlayer = true;
    res.status(200).json({ message: 'Music file selected successfully' });
});

app.post('/api/upload-video', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        const key = `videos/${file.originalname}`;
        const uploadParams = {
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        };
        await r2Client.send(new PutObjectCommand(uploadParams));
        res.status(200).json({ message: 'Video uploaded successfully!', url: `https://pub-3cf28645129b480fa630d3772e9352fe.r2.dev/${key}` });
    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).json({ message: 'Failed to upload video.' });
    }
});

app.get('/api/list-videos', isAuthenticated, async (req, res) => {
    try {
        const params = {
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            Prefix: 'videos/',
        };
        const data = await r2Client.send(new ListObjectsV2Command(params));
        const videos = (data.Contents || []).map(file => ({
            url: `https://pub-3cf28645129b480fa630d3772e9352fe.r2.dev/${file.Key}`,
            key: file.Key,
        }));
        res.status(200).json(videos);
    } catch (error) {
        console.error('Error listing videos:', error);
        res.status(500).json({ message: 'Failed to list videos.' });
    }
});

app.post('/api/set-selected-video', isAuthenticated, (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Video URL is required' });
    }
    backgroundSettings.url = url;
    backgroundSettings.type = 'video';
    saveSettings();
    res.status(200).json({ message: 'Video background set successfully' });
});

app.post('/api/upload-image', isAuthenticated, upload.single('file'), async (req, res) => {
    const file = req.file;
    const key = `background/${file.originalname}`;
    const uploadParams = {
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    };
    try {
        await r2Client.send(new PutObjectCommand(uploadParams));
        backgroundSettings.url = `https://pub-3cf28645129b480fa630d3772e9352fe.r2.dev/${key}`;
        backgroundSettings.type = 'image';
        saveSettings();
        res.status(200).json({ message: 'Image uploaded successfully!', url: backgroundSettings.url });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ message: 'Failed to upload image.' });
    }
});

// --- End migrated logic from app.js ---// Helper functions
const settingsFilePath = path.join(__dirname, '../settings.json');

function saveSettings() {
    const settings = { backgroundSettings, musicSettings };
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
}

function loadSettings() {
    if (fs.existsSync(settingsFilePath)) {
        const data = fs.readFileSync(settingsFilePath);
        const settings = JSON.parse(data);
        backgroundSettings = settings.backgroundSettings || backgroundSettings;
        musicSettings = settings.musicSettings || musicSettings;
    }
}

loadSettings();

// Static file routes
const staticRouter = require('./static');
app.use('/api/static', staticRouter);

module.exports = app;
module.exports.handler = serverless(app);