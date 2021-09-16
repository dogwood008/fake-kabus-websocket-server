const express = require('express');
const app = express();
const PORT = process.env.PORT;
const resp = {
  'ResultCode': 0,
  'Token': 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
};
app.get('/kabusapi/token', (req, res) => res.send(JSON.stringify(resp)));
app.listen(PORT, '0.0.0.0');