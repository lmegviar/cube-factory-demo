var handlers = require('./handlers');
var express = require('express');

module.exports = function (app, express) {
  app.get('/api/config', handlers.buildApp);
};