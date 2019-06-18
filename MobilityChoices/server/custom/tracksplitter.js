var request = require('request');
var app = require('../server.js');
var constants = require('./constants');

var nodeIpAddress = constants.nodeIpAddress;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
tracksplitter = {
  loadTrack: function (req, res) {
    var id = req.body.track.id;

    app.models.Track.findById(id, function (error, data) {
      if (error) {
        res.status(400).send({
          error: true,
          status: "Error"
        });
      } else {
        tracksplitter.splittracks(req, res, data.sections);
      }
    });
  },
  splittracks: function (req, res, serverSections) {

    var data = req.body;
    var userId = data.mobilityUserId;
    var token = data.access_token;
    var originalSections = Object.values(data.track.sections);

    for (var i = 0; i < originalSections.length; i++) {
      var coords = Object.values(originalSections[i].coordinates);
      originalSections[i].coordinates = coords;

      var probs = Object.values(originalSections[i].probabilities);
      originalSections[i].probabilities = probs;
    }
    for (var i = 0; i < serverSections.length; i++) {
      var coords = Object.values(serverSections[i].coordinates);
      serverSections[i].coordinates = coords;

      var probs = Object.values(serverSections[i].probabilities);
      serverSections[i].probabilities = probs;
    }
    var tracks = [];
    var tempSections = [];

    if (Array.isArray(originalSections)) {
      for (var i = 0; i < originalSections.length; i++) {
        tempSections.push(serverSections[i]);
        if (originalSections[i].endpoint) {
          var newTrack = app.models.Track.create({
            name: data.track.name + " " + (tracks.length + 1),
            email: data.track.email,
            date: data.track.date,
            reason: data.track.reason,
            type: data.track.type,
            duration: data.track.duration,
            alreadySynced: data.track.alreadySynced,
            approved: data.track.approved,
            deletedByClient: data.track.deletedByClient,
            sections: tempSections,
            mobilityUserId: userId
          });
          tracks.push(newTrack);
          tempSections = [];
        }
      }
      var lastSplit = app.models.Track.create({
        name: data.track.name + " " + (tracks.length + 1),
        email: data.track.email,
        date: data.track.date,
        reason: data.track.reason,
        type: data.track.type,
        duration: data.track.duration,
        alreadySynced: data.track.alreadySynced,
        approved: data.track.approved,
        deletedByClient: data.track.deletedByClient,
        sections: tempSections,
        mobilityUserId: userId
      });
      tracks.push(lastSplit);

      for (var i = 0; i < tracks.length; i++) {
        request({
          url: nodeIpAddress + "/api/MobilityUsers/" + userId + "/tracks?access_token=" + token,
          method: "POST",
          json: tracks[i]
        }, function (error, response, body) {
          if (error) {
            reject(error);
          }
        });
      }
      var dataToSend = {
        name: data.track.name,
        email: data.track.email,
        date: data.track.date,
        reason: data.track.reason,
        type: data.track.type,
        duration: data.track.duration,
        alreadySynced: data.track.alreadySynced,
        approved: data.track.approved,
        correctnessscore: data.track.correctnessscore,
        evaluation: data.track.evaluation,
        deletedByClient: true,
        sections: data.sections
      };
      request({
        url: nodeIpAddress + "/api/Tracks/" + data.track.id,
        method: "PATCH",
        json: dataToSend
      }, function (error, response, body) {
        if (error) {
          console.error(error);
          reject(error);
        }
      });
      res.send({
        error: "",
        status: "ok",
        notify: true,
        success: true
      });
    } else {
      res.send({
        error: "Could not split the track",
        status: "error",
        notify: true,
        success: false
      });
    }
  }

};

module.exports = tracksplitter;
