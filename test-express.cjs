const express = require('express');
const app = express();
const server = app.listen(3003, () => {
  console.log('started');
  const http = require('http');
  http.get('http://localhost:3003/', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Response:', res.statusCode, data);
        server.close();
    });
  });
});
