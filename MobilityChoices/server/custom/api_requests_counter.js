let logger = require('../winstonConfig.js');

var requestsCounter = {

  getRequestCounts: async function (req, res) {
    var options = null;
    var requestDay = req.query.fromDay;
    var requestUntilDay = req.query.untilDay;
    if (requestDay) {
      var matches = requestDay.match(/^(\d{4})\-(\d{2})\-(\d{2})$/);
      if (matches === null) {
        requestDay = null;
        res.send({
          error: true,
          message: "False timeformat for fromDay. Time needs to be in the following format: yyyy-mm-dd"
        });
        return;
      }
      var fromDate = new Date(requestDay);
      fromDate.setHours(0, 0, 0, 0);
      var toDate;
      if (requestUntilDay) {
        var matches = requestUntilDay.match(/^(\d{4})\-(\d{2})\-(\d{2})$/);
        if (matches === null) {
          res.send({
            error: true,
            message: "False timeformat for untilDay. Time needs to be in the following format: yyyy-mm-dd"
          });
          return;
        } else {
          toDate = new Date(requestUntilDay);
        }
      } else {
        toDate = new Date(requestDay);
      }
      toDate.setHours(24, 0, 0, 0);
      options = {
        from: fromDate,        // today at 00:00 our time
        until: toDate,
        limit: 10000000000,
        fields: ['message', 'timestamp']
      }
    } else {
      var todayMorning = new Date();
      todayMorning.setHours(0, 0, 0, 0);
      var now = new Date();
      options = {
        from: todayMorning,        // today at 00:00 our time
        until: now,
        limit: 10000000000,
        fields: ['message', 'timestamp']
      };
    }

    // query all logs from specific day
    logger.query(options, function (err, result) {
      if (err) {
        console.log(err);
        res.send({
          error: true
        });
      }

      var countOverview = {
        googleGeocode: 0,
        googlemaps: 0,
        MapQuest: 0,
        VAO: 0,
        serachCH: 0,
        vmobil: 0,
        geonames: 0
      };

      var logs = result.file;
      countOverview.googleGeocode = logs.filter(log => log.message.includes("google geocode")).length;
      countOverview.googlemaps = logs.filter(log => log.message.includes("googlemaps")).length;
      countOverview.MapQuest = logs.filter(log => log.message.includes("MapQuest")).length;
      countOverview.VAO = logs.filter(log => log.message.includes("VAO")).length;
      countOverview.serachCH = logs.filter(log => log.message.includes("search.ch")).length;
      countOverview.vmobil = logs.filter(log => log.message.includes("vmobil")).length;
      countOverview.geonames = logs.filter(log => log.message.includes("geonames")).length;

      res.send({
        error: false,
        requestCounts: countOverview
      });
    });
  }
};

module.exports = requestsCounter;



