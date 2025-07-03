const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const RESULT_DIR = path.join(__dirname, '../results');

exports.getForm = (req, res) => {
  res.sendFile(path.join(__dirname, '../views/image-to-video.html'));
};

exports.postImage = (req, res) => {
  const imageFile = req.file?.path;
  const duration = parseInt(req.body.duration);

  if (!imageFile || isNaN(duration) || duration <= 0) {
    return res.status(400).send('Image and valid duration are required.');
  }

  const outputFileName = `video-${Date.now()}.mp4`;
  const outputPath = path.join(RESULT_DIR, outputFileName);

  ffmpeg()
    .input(imageFile)
    .inputOptions(['-loop 1'])
    .outputOptions([
      `-t ${duration}`,
      '-c:v libx264',
      '-preset veryfast',
      '-tune stillimage',
      '-pix_fmt yuv420p',
      '-movflags +faststart'
    ])
    .save(outputPath)
    .on('end', () => {
      fs.unlink(imageFile, () => {});
      // Serve new HTML with video preview
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Image to Video - Result</title>
        </head>
        <body>
          <h1>Video Created!</h1>
          <video controls width="360">
            <source src="/results/${outputFileName}" type="video/mp4" />
            Your browser does not support the video tag.
          </video><br/><br/>
          <a href="/results/${outputFileName}" download>Download Video</a><br/><br/>
          <a href="/image-to-video">Convert Another</a>
        </body>
        </html>
      `);
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
      res.status(500).send('Error creating video.');
    });
};
