const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8000;

// Ensure upload/trimmed folders exist
['uploads', 'trimmed'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/trimmed', express.static(path.join(__dirname, 'trimmed')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Routes
const audioRoutes = require('./routes/audioRoutes');
const videoRoutes = require('./routes/videoRoutes'); // line 21
const mergeRoutes = require('./routes/mergeRoutes'); // <- Add this line
app.use('/', audioRoutes);
app.use('/image-to-video', videoRoutes); // line 22
app.use('/merge-audio-video', mergeRoutes); // <- Add this line


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
