var handlers = require('./handlers');
var express = require('express');

module.exports = function (app, express) {
  app.get('/api/config', handlers.buildApp);
  //Sample config json object with res: {users: [1, 2, 3]}
};