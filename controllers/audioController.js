const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

// Helper function to get duration
function getDuration(start, end) {
  const toSeconds = (t) => {
    const [h, m, s] = t.split(':');
    return (+h) * 3600 + (+m) * 60 + parseFloat(s);
  };
  return +(toSeconds(end) - toSeconds(start)).toFixed(2);
}

// GET /
exports.renderHomePage = (req, res) => {
  res.sendFile(path.join(__dirname, '../views/index.html'));
};

// POST /trim
exports.trimAudio = (req, res) => {
  const { start, end } = req.body;
  const file = req.file;

  if (!file || !start || !end) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

const originalPath = file.path;
  const convertedPath = path.join(__dirname, '../uploads', `converted-${Date.now()}.mp3`);
  const trimmedPath = path.join(__dirname, '../trimmed', `trimmed-${Date.now()}.mp3`);

  const duration = getDuration(start, end);
  if (duration <= 0) return res.json({ error: 'End time must be after start time.' });

  ffmpeg(originalPath)
    .audioCodec('libmp3lame')
    .audioBitrate('320k')
    .audioChannels(2)
    .audioFrequency(44100)
    .on('end', () => {
      ffmpeg(convertedPath)
        .setStartTime(start)
        .duration(duration)
        .on('end', () => {
          res.json({ trimmed: `/trimmed/${path.basename(trimmedPath)}` });

          // Clean up temp files
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
};
