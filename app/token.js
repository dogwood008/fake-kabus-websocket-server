const express = require('express');
const app = express();
const PORT = process.env.PORT;
app.get('/kabusapi/token', (req, res) => res.send('Hello'));
app.listen(PORT, '0.0.0.0');