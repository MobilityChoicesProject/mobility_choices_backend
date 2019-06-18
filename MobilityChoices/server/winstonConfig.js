var appRoot = require('app-root-path');
var winston = require('winston');

// define the custom settings for each transport (file, console)
var options = {
  file: {
    level: 'info',
    filename: `${appRoot}/server/logs/api_requests.log`,
    handleExceptions: true,
    json: true,
    maxsize: 5242880, // 5MB
    colorize: false
  }
};

// instantiate a new Winston Logger with the settings defined above
var logger = new winston.Logger({
  transports: [
    new winston.transports.File(options.file),
  ],
  exitOnError: false, // do not exit on handled exceptions
});

module.exports = logger;