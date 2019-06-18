var request = require('request');
var app = require('../server.js');
var authreq = require('./authreq');
var FCM = require('fcm-push');
var Moment = require('moment');
var logger = require('../winstonConfig');
var keyHelper = require('../keyHelper.js');
var evaluation = require('./evaluation/evaluateTrack.js');
var anonymization = require('./anonymization.js');
var constants = require('./constants');
var objectHash = require('object-hash');

//we need this for https requests otherwise self signes certificates are rejected
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


var nodeIpAddress = constants.nodeIpAddress;
var tmdIpAddress = constants.tmdIpAddress;

tmd = {
  sendPushMessage(pushToken, title, message) {
    var serverKey = keyHelper.getFirebaseKey();
    var fcm = new FCM(serverKey);
    var message = {
      to: pushToken,
      data: {},
      notification: {
        title: title,
        body: message
      }
    };
    fcm.send(message).then(function (response) {
      console.log("Successfully sent with response: ", response);
    }).catch(function (err) {
      console.log("Something has gone wrong!");
      console.error(err);
    });
  },
  getTMD: function (req, res) {
    var pushToken = req.query.push_token;
    var token = req.query.access_token;
    console.log("called function getTMD");
    authreq.waitForAuth(req, res).then(function (user) {
      console.log("I got a push msg." + pushToken);
      var cleanedUser = JSON.parse(JSON.stringify(user));
      if (!cleanedUser.profile) {
        res.status(400).send({
          requestId: -1,
          status: "Error"
        });
      } else {
        var data = req.body;

        //Added for TMD-Queue
        data.pushToken = pushToken;
        data.accessToken = token;

        if (data) {
          data["UserId"] = cleanedUser.id;
        }
        var trajectory = req.body.trajectory;
        var trackName = "Neuer Track";
        if (req.body.name) {
          trackName = req.body.name;
        }

        // store in the meantime the raw data (tracks) that we received from the request
        // run that therefore asynchronously to speed up this operation
        new Promise(function (resolve, reject) {
          app.models.RecordedTrack.create({
            name: trackName,
            date: trajectory.length > 0 ? trajectory[0].time : new Date(),
            mobilityUserId: cleanedUser.id
          }, function (error, recordedTrack) {
            if (error) {
              reject(error);
            } else {
              var rawTrackData = new Array(trajectory.length);

              for (var n = 0; n < rawTrackData.length; n++) {
                var mySpeed = -1;
                if (trajectory[n].speed !== undefined) {
                  mySpeed = trajectory[n].speed;
                }
                rawTrackData[n] = {
                  accuracy: trajectory[n].accuracy,
                  latitude: trajectory[n].lat,
                  longitude: trajectory[n].lng,
                  timestamp: trajectory[n].time,
                  altitude: trajectory[n].altitude,
                  confidence: trajectory[n].confidence,
                  type: trajectory[n].type,
                  speed: mySpeed,
                  recordedTrackId: recordedTrack.id
                }
              }

              app.models.Trackdata.create(rawTrackData, function (error, trackData) {
                if (error) {
                  // mongodb does not support transactions
                  // https://docs.mongodb.com/manual/tutorial/perform-two-phase-commits/

                  // delete the recorded track due to an error
                  app.models.RecordedTrack.destroyById(recordedTrack, function (err) {
                    reject(error);
                  });
                } else {
                  resolve(recordedTrack);
                }
              });
            }
          });
        }).catch(function (error) {
          console.log('Could not save the raw data (tracks) in the DB\nStacktrace:');
          console.error(error);
        });
        request({
          url: tmdIpAddress + "/TMDService/rest/TMD_Service/classifyQueue",
          method: "POST",
          json: data
        }, function (error, response, body) {
          console.log("error", error);
          console.log("response", response);
          console.log("body", body);

          /*
          * Moved to processTMDResponse for TMD Queue
          * Status Accepted = Track added to queue on TMD
          */
          var message;
          if (body.status !== "Accepted") {
            if (body.status === "SHORT_DURATION_ERROR") {
              message = "Track konnte nicht ausgewertet werden, die Dauer des Tracks muss über 2 Minuten sein.";
            } else if (body.status === "NOT_ENOUGH_POINTS_ERROR") {
              message = "Track konnte nicht ausgewertet werden, es müssen mehr als 60 GPS-Punkte vorhanden sein.";
            } else if (body.status === "DATA_TOO_SPARE_ERROR") {
              message = "Track konnte nicht ausgewertet werden, der zeitliche Abstand zwischen den GPS-Punkten war zu groß. " +
                "Dies könnte möglicherweise daran liegen, dass der Energiesparmodus während der Aufzeichnung des Tracks aktiviert war."
            } else if (body.status === "NOT_IN_BOUNDING_BOX_ERROR") {
              message = "Track konnte nicht ausgewertet werden, die GPS-Punkte befinden sich nicht in dem gültigen geographischen Bereich."
            } else {
              message = "Track konnte nicht ausgewertet werden."
            }
            tmd.sendPushMessage(pushToken, "Upload fehlgeschlagen", message);
            res.send({
              error: message,
              status: "Error",
              notify: true
            });
          } else {
            message = 'Der Track wurde zur Analyse an den Server gesendet. Sobald die Analyse abgeschlossen ist, ' +
              'wird der Track automatisch unter den ausgewerteten Wegen erscheinen.';
            res.send({
              message: message,
              status: "ok",
              notify: true
            })
          }
        });
      }
    }).catch(function (error) {
      console.error(error);
    });
  },
  getReverseGeoCodingOptions: function (coords) {
    let googleKey = keyHelper.getGoogleAPIKey();
    logger.log("info", "google geocode request");      // log request
    return options = {
      method: 'GET',
      url: 'https://maps.googleapis.com/maps/api/geocode/json',
      qs: {
        latlng: '' + encodeURIComponent(coords.latitude) + ',' + encodeURIComponent(coords.longitude) + '',
        key: googleKey
      },
    };
  },
  merge: function (track) {
    var promise = new Promise(function (resolve, reject) {
      var id = track.id;

      app.models.Track.findById(id, function (error, serverData) {
        if (error) {
          res.status(400).send({
            error: true,
            status: "Error"
          });
          reject(error);
        } else {
          var databaseSections = serverData.sections;
          var clientSections = track.sections;
          for (var i = 0; i < clientSections.length; i++) {
            databaseSections[i].name = clientSections[i].name;
            databaseSections[i].waypoint = clientSections[i].waypoint;
            databaseSections[i].endpoint = clientSections[i].endpoint;
            databaseSections[i].transportMode = clientSections[i].transportMode;
          }
          var mergeSuccess = true;
          request({
            url: tmdIpAddress + "/TMDService/rest/TMD_Service/mergeSameSegments",
            method: "POST",
            json: databaseSections
          }, function (error, response, body) {
            if (error) {
              console.log(error);
              console.log("error at merge-request for tmd");
              mergeSuccess = false;
              reject(error);
            } else {
              track.sections = response.body;
              request({
                url: nodeIpAddress + "/api/tracks/" + track.id,
                method: "PATCH",
                json: {sections: response.body}
              }, function (error, response, body) {
                if (error) {
                  console.log(error);
                  mergeSuccess = false;
                  reject(error);
                } else {
                  resolve(id);
                }
              });
            }
          });
        }
      });
    });
    return promise;

  },
  processTMDResponse: function (req, res) {
    var body = req.body;
    var pushToken = body.pushToken;
    var token = body.accessToken;
    var user = body.UserId;
    var trackName = "Neuer Track";
    if (body.Status === "OK") {

      var tmdSections = body.segments;

      for (var i = 0; i < tmdSections.length; i++) {
        tmdSections[i]["transportMode"] = "NOTDETECTED";
        var coordinates = tmdSections[i].coordinates;
        var currentSection = tmdSections[i];

        var probabilities = currentSection.probabilities;
        var maxProbability = -1;
        for (var j = 0; j < probabilities.length; j++) {
          if (probabilities[j].probability > maxProbability) {
            maxProbability = probabilities[j].probability;
            tmdSections[i]["transportMode"] = probabilities[j].transportMode;
          }
          tmdSections[i]["probabilities"][j].probability = parseFloat(tmdSections[i]["probabilities"][j].probability);
        }
        var startTime = Moment(tmdSections[i].startTime, Moment.ISO_8601);

        var endTime = Moment(tmdSections[i].endtime, Moment.ISO_8601);
        tmdSections[i]["start"] = {
          coordinates: {
            lat: 0.0,
            lng: 0.0
          },
          timestamp: startTime.valueOf(),
          name: ""
        };

        tmdSections[i]["end"] = {
          coordinates: {
            lat: 0.0,
            lng: 0.0
          },
          timestamp: endTime.valueOf(),
          name: ""
        };
        var duration = (endTime.valueOf() - startTime.valueOf()) / 60000;
        if (coordinates.length >= 2) {
          var first = coordinates[0];
          var last = coordinates[coordinates.length - 1];
          tmdSections[i]["start"].coordinates.lat = first.lat;
          tmdSections[i]["start"].coordinates.lng = first.lng;
          tmdSections[i]["end"].coordinates.lat = last.lat;
          tmdSections[i]["end"].coordinates.lng = last.lng;
        }
        tmdSections[i]["duration"] = duration;
      }
      var getStartEndAddressesRec = function (x) {
        var sections = body.segments;
        if (x < sections.length) {
          var startCoords = {
            'latitude': sections[x]["start"].coordinates.lat,
            'longitude': sections[x]["start"].coordinates.lng
          };
          var endCoords = {
            'latitude': sections[x]["end"].coordinates.lat,
            'longitude': sections[x]["end"].coordinates.lng
          };
          var options = tmd.getReverseGeoCodingOptions(startCoords);
          request(options, function (err, response, body) {
            if (err) {
              console.error(err);
              console.log("Error when converting start-coordinates to location");
            } else {
              if (body) {
                var content = JSON.parse(body);
                sections[x]["start"].name = content.results[0].formatted_address;
                options = tmd.getReverseGeoCodingOptions(endCoords);
                request(options, function (err, response, body) {
                  if (err) {
                    console.error(err);
                    console.log("Error when converting end-coordinates to location");
                  } else {
                    if (body) {
                      var content = JSON.parse(body);
                      sections[x]["end"].name = content.results[0].formatted_address;
                      getStartEndAddressesRec(x + 1);
                    }
                  }
                });
              }
            }
          });
        } else {
          var date = body.date;
          var cleanedUser;
          app.models.MobilityUser.findById(user, function (error, data) {
            if (error) {
            } else {
              cleanedUser = data;
              tmd.saveToDatabase(tmdSections, cleanedUser, trackName, token, date, pushToken);
            }
          });
        }
      };
      getStartEndAddressesRec(0);
    } else {
      tmd.sendPushMessage(pushToken, "Auswertung fehlgeschlagen", "Ihre Daten konnten leider nicht erfolgreich ausgewertet werden.");
    }
    res.send({
      error: "",
      status: "ok"
    });
  },

  saveToDatabase: function (tmdSections, cleanedUser, trackName, token, date, pushToken) {
    var datatosend = {
      alreadySynced: true,
      approved: false,
      sections: tmdSections,
      type: "Track",
      date: date,
      email: cleanedUser.email,
      evaluation: {},
      mobilityUserId: cleanedUser.id,
      name: trackName
    };
    console.log("saving into database");
    request({
      url: nodeIpAddress + "/api/MobilityUsers/" + encodeURIComponent(cleanedUser.id) + "/tracks?access_token=" + encodeURIComponent(token),
      method: "POST",
      json: datatosend
    }, function (error, response, body) {
      if (error) {
        console.error(error);
      } else {
        tmd.sendPushMessage(pushToken, "Auswertung erfolgreich", "Ihre Daten wurden erfolgreich ausgewertet.");
      }
    });
  },
  saveChangesOnDB: function (req, res) {
    var clientTrack = req.body.track;
    app.models.Track.findById(clientTrack.id, function (error, serverTrack) {
      if (error) {
        console.log(error);
        res.send({
          error: error,
          status: "Error",
          notify: true
        });
      } else {
        for (var i = 0; i < clientTrack.sections.length; i++) {
          clientTrack.sections[i].coordinates = serverTrack.sections[i].coordinates;
        }
        app.models.Track.upsert(clientTrack, function (error, data) {
          if (error) {
            console.log(error);
            res.send({
              error: error,
              status: "Error",
              notify: true
            });
          } else {
            res.send({
              error: "",
              status: "ok",
              notify: true
            });
          }
        });
      }
    });
  },
  publish: function (req, res) {
    var track = req.body.track;
    track.approved = true;
    var pushToken = req.body.pushToken;
    app.models.Track.findById(track.id, function (error, data) {
      if (error) {
        console.log(error);
      } else {
        data.approved = true;
        var dataToSend = {
          name: data.name,
          email: data.email,
          date: data.date,
          reason: req.body.track.reason,
          type: data.type,
          duration: data.duration,
          alreadySynced: data.alreadySynced,
          approved: true,
          correctnessscore: data.correctnessscore,
          evaluation: data.evaluation,
          deletedByClient: data.deletedByClient,
          sections: data.sections
        };
        res.send({
          error: "",
          status: "ok",
          message: "Ihr Weg wurde erfolgreich hochgeladen. Der Weg wird in kürze freigegeben und unter 'Freigegebene Wege' zu finden sein.",
          notify: true
        });
        console.log("TMD: Attempting to save track");
        request({
          url: nodeIpAddress + "/api/Tracks/" + data.id,
          method: "PATCH",
          json: dataToSend
        }, function (error, response, body) {
          if (error) {
            tmd.sendPushMessage(pushToken, "Freigeben fehlgeschlagen", "Beim Freigeben Ihres Tracks ist ein Fehler aufgetreten.");
          } else {
            tmd.merge(data).then(function (result) {
              anonymization.makeAnonymization(result);
              evaluation.evaluateDuringPublish(result, req.body.accessToken).then(function (track) {
                tmd.sendPushMessage(pushToken, "Freigeben erfolgreich", "Ihr Track wurde erfolgreich freigegeben.");
              }).catch(function (error) {
                console.log(error);
                console.log("evaluation finished with errors!");
                tmd.sendPushMessage(pushToken, "Freigeben erfolgreich", "Ihr Track wurde erfolgreich freigegeben.");
              });
            });
          }
        });
        console.log("TMD: Track sucessfully loaded from Database");
      }
    });
  },
  deleteTrack: function (req, res) {
    app.models.Track.findById(req.body.trackId, function (error, serverData) {
      if (error) {
        console.log(error);
        res.send({
          error: error,
          status: "Error",
          notify: true
        });
      } else {
        serverData.deletedByClient = true;
        app.models.Track.upsert(serverData, function (error, data) {
          if (error) {
            console.log(error);
            res.send({
              error: error,
              status: "Error",
              notify: true
            });
          } else {
            res.send({
              error: "",
              status: "ok",
              notify: true
            });
            console.log("Track updated in DB");
          }
        });
      }
    });

  },
  checkTracks: function (req, res) {
    var email = req.body.email;
    var clientHashArray = req.body.hashArray;
    var missingTracks = [];
    app.models.Track.find({where: {'email': email, 'deletedByClient': false}}, function (error, data) {

      for (var i = 0; i < data.length; i++) {
        var track = JSON.parse(JSON.stringify(data[i], function (key, value) {
          if (key === "coordinates") return undefined;
          else if (key === "mobilityUserId") return undefined;
          else if (key === "waypoint") return undefined;
          else if (key === "endpoint") return undefined;
          else if (key === "probabilities") return undefined;
          else if (key === "correctnessscore") return undefined;
          else if (key === "evaluation") return undefined;
          else if (key === "endtime") return undefined;
          else if (key === "startTime") return undefined;
          else return value;
        }));
        var hash = objectHash(track, {
          respectFunctionProperties: false,
          respectFunctionNames: false,
          respectType: false
        });
        if (!clientHashArray.some(e => e.id === track.id && e.hash === hash)) {
          //track is missing or not up to date
          missingTracks.push(JSON.parse(JSON.stringify(data[i])));
        }
      }
      res.send({
        error: "",
        status: "ok",
        tracks: missingTracks
      });
    });
  }
};


module.exports = tmd;
