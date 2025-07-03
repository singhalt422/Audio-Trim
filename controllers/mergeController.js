const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const RESULT_DIR = path.join(__dirname, '../results');

exports.getForm = (req, res) => {
  res.sendFile(path.join(__dirname, '../views/merge-audio-video.html'));
};

exports.mergeAudioVideo = (req, res) => {
  const videoFile = req.files?.video?.[0]?.path;
  const audioFile = req.files?.audio?.[0]?.path;

  if (!videoFile || !audioFile) {
    return res.status(400).send('Both video and audio files are required.');
  }

  const outputFileName = `replaced-${Date.now()}.mp4`;
  const outputPath = path.join(RESULT_DIR, outputFileName);

  ffmpeg()
    .input(videoFile)
    .input(audioFile)
    .outputOptions([
      '-map 0:v:0',
      '-map 1:a:0',
      '-c:v copy',
      '-shortest'
    ])
    .save(outputPath)
    .on('end', () => {
      fs.unlink(videoFile, () => {});
      fs.unlink(audioFile, () => {});
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Video with New Audio</title></head>
        <body>
          <h2>Video Created with New Audio!</h2>
          <video controls width="480">
            <source src="/results/${outputFileName}" type="video/mp4" />
            Your browser does not support the video tag.
          </video><br/>
          <a href="/results/${outputFileName}" download>Download Video</a><br/>
          <a href="/merge-audio-video">Merge Another</a>
        </body>
        </html>
      `);
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
      res.status(500).send('Error processing video.');
    });
};
