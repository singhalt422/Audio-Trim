const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Multer setup
const upload = multer({
  dest: path.join(__dirname, '../uploads/'),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  }
});

const audioController = require('../controllers/audioController');

// Routes
router.get('/', audioController.renderHomePage);
router.post('/trim', upload.single('audio'), audioController.trimAudio);

module.exports = router;
