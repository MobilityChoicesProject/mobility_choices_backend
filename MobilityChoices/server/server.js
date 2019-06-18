'use strict';

var loopback = require('loopback');
var boot = require('loopback-boot');
var debugHelper = require('./helper/DebugHelper');
var loopbackSSL = require('loopback-ssl');
var config = require('./config.json');
var path = require("path");

// determine the base path of the project and add it to the global variable
// This requires that this file 'server.js' stays in this folder!!!
global.APP_ROOT_PATH = path.normalize(path.join(__dirname, '..'));
console.log('App Root Path: ' + '\'' + global.APP_ROOT_PATH + '\'');

// adjust the configuration
config.certConfig.path = path.normalize(path.join(global.APP_ROOT_PATH, 'certificate'));
console.log('Certificates are located at: ' + '\'' + config.certConfig.path + '\'');

var app = module.exports = loopback();

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function (err) {
  if (err) throw err;

  // print mode
  console.log("Development mode: " + debugHelper.isDebugMode());

  // configure the datasource
  var dataSource = app.dataSources.db;
  dataSource.autoupdate(null, function (err) {
    if (err) {
      console.log("Error.");
    } else {
      console.log("Updated database schema.");
    }
  });
});

// configure the datasource
var analyseDataSource = app.dataSources.analysedb;
analyseDataSource.autoupdate(null, function (err) {
  if (err) {
    console.log("Error.");
  } else {
    console.log("Updated database schema.");
  }
});

if (debugHelper.isDebugMode()) {
  console.log('\r\nactive remote methods:');
  console.log(JSON.stringify(getActiveRemoteMethods(app)));
  console.log("\r\n");
}

return loopbackSSL.startServer(app);

function getActiveRemoteMethods(app) {
  return app.remotes();
}

