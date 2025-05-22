const path = require('path');
const express = require('express');
const router = express.Router();

// Serve static CSS files
router.get('/css/:file', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/css', req.params.file));
});

// Serve static image files
router.get('/images/:file', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/images', req.params.file));
});

// Serve static script files
router.get('/scripts/:file', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/scripts', req.params.file));
});

module.exports = router;
