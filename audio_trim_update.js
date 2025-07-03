const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/trimmed', express.static(path.join(__dirname, 'trimmed')));

// Ensure folders exist
['uploads', 'trimmed'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// Multer config – accepts any audio type
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  }
});

// HTML UI
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Audio Trimmer</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f5f7fa;
      display: flex;
      justify-content: center;
      padding-top: 50px;
    }

    .container {
      background: #fff;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 500px;
    }

    h2 {
      text-align: center;
    }

    label {
      margin-top: 15px;
      display: block;
    }

    input, button {
      width: 100%;
      padding: 10px;
      margin-top: 5px;
    }

    button {
      background-color: #007bff;
      color: white;
      border: none;
      cursor: pointer;
    }

    button:hover {
      background-color: #0056b3;
    }

    audio {
      width: 100%;
      margin-top: 15px;
    }

    #downloadLink {
      display: inline-block;
      margin-top: 15px;
      background-color: #28a745;
      color: white;
      padding: 10px;
      text-decoration: none;
      border-radius: 5px;
    }

    #downloadLink:hover {
      background-color: #218838;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>Upload & Trim Audio</h2>
    <form id="uploadForm">
      <label>Select Audio File:</label>
      <input type="file" id="audioFile" name="audio" required>

      <label>Start Time (HH:MM:SS.s):</label>
      <input type="text" id="start" value="00:00:00.0" required>

      <label>End Time (HH:MM:SS.s):</label>
      <input type="text" id="end" value="00:00:10.0" required>

      <button type="submit">Upload & Trim</button>
    </form>

    <div id="playerSection" style="display:none;">
      <h3>Trimmed Audio Preview:</h3>
      <audio id="audioPlayer" controls></audio>
      <a id="downloadLink" download>Download Trimmed Audio</a>
    </div>
  </div>

  <script>
    const form = document.getElementById('uploadForm');
    const playerSection = document.getElementById('playerSection');
    const audioPlayer = document.getElementById('audioPlayer');
    const downloadLink = document.getElementById('downloadLink');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData();
      formData.append('audio', document.getElementById('audioFile').files[0]);
      formData.append('start', document.getElementById('start').value);
      formData.append('end', document.getElementById('end').value);

      const res = await fetch('/trim', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      audioPlayer.src = data.trimmed;
      downloadLink.href = data.trimmed;
      playerSection.style.display = 'block';
    };
  </script>
</body>
</html>`;

// Serve HTML UI
app.get('/', (req, res) => {
  res.send(html);
});

// POST /trim – handles audio trimming
app.post('/trim', upload.single('audio'), (req, res) => {
  const { start, end } = req.body;
  const file = req.file;

  if (!file || !start || !end) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const originalPath = path.join(__dirname, file.path);
  const convertedPath = path.join(__dirname, 'uploads', `converted-${Date.now()}.mp3`);
  const trimmedPath = path.join(__dirname, 'trimmed', `trimmed-${Date.now()}.mp3`);

  const duration = getDuration(start, end);
  if (duration <= 0) return res.json({ error: 'End time must be after start time.' });

  // Step 1: Convert input to high quality MP3
  ffmpeg(originalPath)
    .audioCodec('libmp3lame')
    .audioBitrate('320k')
    .audioChannels(2)
    .audioFrequency(44100)
    .on('end', () => {
      // Step 2: Trim MP3 using ffmpeg
      ffmpeg(convertedPath)
        .setStartTime(start)
        .duration(duration)
        .on('end', () => {
          res.json({ trimmed: `/trimmed/${path.basename(trimmedPath)}` });

          // Cleanup temp files
          fs.unlink(originalPath, () => {});
          fs.unlink(convertedPath, () => {});
        })
        .on('error', err => {
          console.error('Trimming error:', err.message);
          res.status(500).json({ error: 'Trimming failed.' });
        })
        .save(trimmedPath);
    })
    .on('error', err => {
      console.error('Conversion error:', err.message);
      res.status(500).json({ error: 'Conversion failed.' });
    })
    .save(convertedPath);
});

// Helper function: duration in seconds
function getDuration(start, end) {
  const toSeconds = (t) => {
    const [h, m, s] = t.split(':');
    return (+h) * 3600 + (+m) * 60 + parseFloat(s);
  };
  return +(toSeconds(end) - toSeconds(start)).toFixed(2);
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
