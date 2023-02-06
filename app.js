
const express = require('express');
const app = express();
const path = require('path');

// set static directories
app.use(express.static(path.join(__dirname, '/')));

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname+ '/gsAIViewer-DZI.html'));
});

var port = process.env.PORT || 5003;
app.listen(port);
console.log('Listening on port ',  port);