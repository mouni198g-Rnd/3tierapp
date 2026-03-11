const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// Serve static assets
app.use(express.static(__dirname));

// Inject API_URL env var into HTML at request time
app.get('/', (req, res) => {
  let html   = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const apiUrl = process.env.REACT_APP_API_URL || 'https://3tierapp-be.azurewebsites.net';
  // Inject before </head>
  html = html.replace(
    '</head>',
    `<script>window.API_URL = "${apiUrl}";</script>\n</head>`
  );
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`✅ Frontend running on port ${PORT}`);
});
