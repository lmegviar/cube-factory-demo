var express = require('express');
var bodyParser = require('body-parser');
var app = express();

app.use(bodyParser.json());

require('./routes.js')(app, express);

app.listen(process.env.PORT || 3000, function () {
  console.log('Cube factory demo server connected.');
});

module.exports = app;