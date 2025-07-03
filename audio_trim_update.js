const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

ffmpeg.setFfmpegPath(ffmpegPath);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/trimmed', express.static(path.join(__dirname, 'trimmed')));

// File upload configuration
const upload = multer({ dest: 'uploads/' });

// HTML UI
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Audio Trimmer</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      background: #f5f7fa;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
    }

    .container {
      background: #fff;
      padding: 30px 40px;
      margin-top: 50px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.1);
      border-radius: 8px;
      max-width: 500px;
      width: 100%;
    }

    h2 {
      text-align: center;
      color: #333;
    }

    label {
      display: block;
      margin: 15px 0 5px;
      color: #444;
    }

    input[type="text"],
    input[type="file"] {
      width: 100%;
      padding: 10px;
      margin-top: 3px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 1rem;
    }

    button {
      width: 100%;
      padding: 12px;
      margin-top: 20px;
      background-color: #007BFF;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
      transition: background-color 0.3s ease;
    }

    button:hover {
      background-color: #0056b3;
    }

    #playerSection {
      margin-top: 30px;
      text-align: center;
    }

    audio {
      width: 100%;
      margin-top: 10px;
    }

    a#downloadLink {
      display: inline-block;
      margin-top: 15px;
      padding: 10px 20px;
      background-color: #28a745;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      transition: background-color 0.3s ease;
    }

    a#downloadLink:hover {
      background-color: #218838;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>Upload and Trim Audio</h2>
    <form id="uploadForm" enctype="multipart/form-data">
      <label for="audioFile">Select Audio File:</label>
      <input type="file" name="audio" id="audioFile" accept="audio/*" required>

      <label for="start">Start Time (HH:MM:SS.s):</label>
      <input type="text" id="start" value="00:00:00.0" required>

      <label for="end">End Time (HH:MM:SS.s):</label>
      <input type="text" id="end" value="00:00:10.0" required>

      <button type="submit">Upload & Trim</button>
    </form>

    <div id="playerSection" style="display:none;">
      <h3>Trimmed Audio Preview:</h3>
      <audio id="audioPlayer" controls></audio>
      <a id="downloadLink" download style="display:none;">Download Trimmed Audio</a>
    </div>
  </div>

  <script>
    const form = document.getElementById('uploadForm');
    const playerSection = document.getElementById('playerSection');
    const audioPlayer = document.getElementById('audioPlayer');
    const downloadLink = document.getElementById('downloadLink');

    form.onsubmit = async (e) => {
      e.preventDefault();

      const fileInput = document.getElementById('audioFile');
      const start = document.getElementById('start').value;
      const end = document.getElementById('end').value;

      const formData = new FormData();
      formData.append('audio', fileInput.files[0]);
      formData.append('start', start);
      formData.append('end', end);

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
      downloadLink.style.display = 'inline-block';
      downloadLink.textContent = 'Download Trimmed Audio';
      playerSection.style.display = 'block';
    };
  </script>
</body>
</html>`;

// Serve HTML UI
app.get('/', (req, res) => {
  res.send(html);
});

// Trim audio route
app.post('/trim', upload.single('audio'), (req, res) => {
  const { start, end } = req.body;
  const file = req.file;

  if (!file || !start || !end) {
    return res.json({ error: 'Missing required data' });
  }

  const originalPath = path.join(__dirname, file.path);
  const convertedPath = path.join(__dirname, 'uploads', `converted-${Date.now()}.mp3`);
  const trimmedPath = path.join(__dirname, 'trimmed', `trimmed-${Date.now()}.mp3`);

  const duration = getDuration(start, end);
  if (duration <= 0) return res.json({ error: 'End time must be after start time' });

  // Step 1: Convert to high quality MP3
  ffmpeg(originalPath)
    .outputOptions([
      '-acodec libmp3lame',
      '-b:a 320k',
      '-ar 44100',
      '-ac 2'
    ])
    .on('end', () => {
      // Step 2: Trim the MP3
      ffmpeg(convertedPath)
        .inputOptions([`-ss ${start}`])
        .outputOptions([`-t ${duration}`])
        .on('end', () => {
          res.json({ trimmed: `/trimmed/${path.basename(trimmedPath)}` });

          fs.unlink(originalPath, () => {});
          fs.unlink(convertedPath, () => {});
        })
        .on('error', err => {
          console.error('Trimming error:', err.message);
          res.status(500).json({ error: 'Trimming failed' });
        })
        .save(trimmedPath);
    })
    .on('error', err => {
      console.error('Conversion error:', err.message);
      res.status(500).json({ error: 'Conversion failed' });
    })
    .save(convertedPath);
});

// Time string to duration in seconds
function getDuration(start, end) {
  const toSeconds = (time) => {
    const [h, m, s] = time.split(':');
    return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
  };
  return +(toSeconds(end) - toSeconds(start)).toFixed(2);
}

// Ensure upload folders exist
['uploads', 'trimmed'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
