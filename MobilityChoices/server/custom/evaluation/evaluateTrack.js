var app = require('../../server');
var authreq = require('../authreq');
var request = require('request');
var dateFormat = require('dateformat');
var constants = require('../constants');

var nodeIpAddress = constants.nodeIpAddress;

trackEvaluation = {
  static: {
    environment: {
      max: Number.MIN_VALUE,
      min: Number.MAX_VALUE,
      pointsPerType: {
        "BUS": 0.755,
        "TRAIN": 0.293,
        "CAR": 2.388,
        "DRIVING": 2.388,
        "WALKING": 0,
        "OTHER": 0,
        "NON_VEHICLE": 0,
        "NON-VEHICLE": 0,
        "BIKE": 0,
        "BICYCLING": 0
      }
    },
    health: {
      max: Number.MIN_VALUE,
      min: Number.MAX_VALUE,
      pointsPerType: {
        "BUS": 0,
        "TRAIN": 0,
        "CAR": 0,
        "DRIVING": 0,
        "WALKING": 1,
        "OTHER": 1,
        "NON_VEHICLE": 1,
        "NON-VEHICLE": 1,
        "BIKE": 2,
        "BICYCLING": 2
      }
    },
    costs: {
      max: Number.MIN_VALUE,
      min: Number.MAX_VALUE,
      pointsPerType: {
        default: {
          "BUS": 0.15,
          "TRAIN": 0.15,
          "CAR": 0.45,
          "DRIVING": 0.45,
          "WALKING": 0,
          "OTHER": 0,
          "NON_VEHICLE": 0,
          "NON-VEHICLE": 0,
          "BIKE": 0,
          "BICYCLING": 0
        }
      }
    },
    time: {
      max: Number.MIN_VALUE,
      min: Number.MAX_VALUE
    }
  },

  determineMinMaxValues: function (environment, health, time, costs) {
    //Environment
    if (environment > trackEvaluation.static.environment.max) {
      trackEvaluation.static.environment.max = environment;
    }
    if (environment < trackEvaluation.static.environment.min) {
      trackEvaluation.static.environment.min = environment;
    }

    // Health
    if (health > trackEvaluation.static.health.max) {
      trackEvaluation.static.health.max = health;
    }
    if (health < trackEvaluation.static.health.min) {
      trackEvaluation.static.health.min = health;
    }

    // Time
    if (time > trackEvaluation.static.time.max) {
      trackEvaluation.static.time.max = time;
    }
    if (time < trackEvaluation.static.time.min) {
      trackEvaluation.static.time.min = time;
    }

    // Costs
    if (costs > trackEvaluation.static.costs.max) {
      trackEvaluation.static.costs.max = costs;
    }
    if (costs < trackEvaluation.static.costs.min) {
      trackEvaluation.static.costs.min = costs;
    }
  },

  evaluateTrackValues: function (track) {
    if (track) {

      var trackEnvironmentValue = trackEvaluation.evaluateEnvironment(track);
      var trackHealthValue = trackEvaluation.evaluateHealth(track);
      var trackTimeValue = trackEvaluation.evaluateJourneyTime(track);
      var trackCostValue = trackEvaluation.evaluateCost(track);

      trackEvaluation.determineMinMaxValues(trackEnvironmentValue, trackHealthValue, trackTimeValue, trackCostValue);

      var eval = {
        values: {
          environment: trackEnvironmentValue,
          health: trackHealthValue,
          time: trackTimeValue,
          costs: trackCostValue
        }
      };
      return eval;
    }
    return {};
  },

  calculateRelativeTrackValues: function (track, userprefs) {
    var sum = userprefs.health + userprefs.costs + userprefs.time + userprefs.environment;


    var weightedUserPrefs = {
      environment: userprefs.environment / sum,
      health: userprefs.health / sum,
      costs: userprefs.costs / sum,
      time: userprefs.time / sum
    };


    var relativeEnvironmentValue = (trackEvaluation.static.environment.max - track.evaluation.values.environment)
      / (trackEvaluation.static.environment.max - trackEvaluation.static.environment.min);
    var relativeHealthValue = (track.evaluation.values.health - trackEvaluation.static.health.min)
      / (trackEvaluation.static.health.max - trackEvaluation.static.health.min);
    var relativeTimeValue = (trackEvaluation.static.time.max - track.evaluation.values.time)
      / (trackEvaluation.static.time.max - trackEvaluation.static.time.min);
    var relativeCostValue = (trackEvaluation.static.costs.max - track.evaluation.values.costs)
      / (trackEvaluation.static.costs.max - trackEvaluation.static.costs.min);

    var healthValue = track.evaluation.values.health;

    track.evaluation["totalscore"] = (weightedUserPrefs.environment * relativeEnvironmentValue)
      + (weightedUserPrefs.health * relativeHealthValue)
      + (weightedUserPrefs.time * relativeTimeValue)
      + (weightedUserPrefs.costs * relativeCostValue);

    track.evaluation["detailscore"] = {
      environment: relativeEnvironmentValue,
      health: relativeHealthValue,
      time: relativeTimeValue,
      costs: relativeCostValue
    };
    // determine iconColor
    track.evaluation["iconcolor"] = {
      environment: trackEvaluation.iconColor(relativeEnvironmentValue),
      health: trackEvaluation.iconColorHealth(healthValue),
      time: trackEvaluation.iconColor(relativeTimeValue),
      costs: trackEvaluation.iconColor(relativeCostValue)
    }
  },

//   Hellgrau bei 0-8 Punkten
//   Dunkelgrau bei >8 und <40 Punkten
// Rot ab 40 Punkten.

  iconColorHealth: function(score) {
    if (score > 39) {
      return 'colored';
    } else if (score > 8) {
      return 'darkGrey';
    } else {
      return 'lightGrey';
    }
  },

  iconColor: function (score) {
    if (score > 0.7) {
      return 'colored';
    } else if (score > 0.3) {
      return 'darkGrey'
    }
    return 'lightGrey';
  },


  evaluateEnvironment: function (track) {
    var environmentPoints = 0;
    for (var i = 0; i < track.sections.length; i++) {
      var section = track.sections[i];
      if (section.transportMode.toUpperCase() !== 'STATIONARY') {
        environmentPoints += section.distance * trackEvaluation.static.environment.pointsPerType[section.transportMode.toUpperCase()];
      }
    }
    return environmentPoints;
  },

  evaluateHealth: function (track) {
    var healthPoints = 0;
    for (var i = 0; i < track.sections.length; i++) {
      var section = track.sections[i];
      if (section.transportMode.toUpperCase() !== 'STATIONARY') {
        healthPoints += section.distance * trackEvaluation.static.health.pointsPerType[section.transportMode.toUpperCase()];
      }
    }
    return healthPoints;
  },

  evaluateJourneyTime: function (track) {
    var duration = 0;
    for (var i = 0; i < track.sections.length; i++) {
      duration = duration + track.sections[i].duration;
    }
    return duration;
  },

  evaluateCost: function (track) {
    var costsInEur = 0;
    for (var i = 0; i < track.sections.length; i++) {
      var section = track.sections[i];
      if (section.transportMode.toUpperCase() !== 'STATIONARY') {
        costsInEur += section.distance * trackEvaluation.static.costs.pointsPerType.default[section.transportMode.toUpperCase()];
      }
    }
    return costsInEur;
  },
  evaluateDuringPublish: function (id, token) {
    var promise = new Promise(function (resolve, reject) {
      trackEvaluation.static.environment.max = Number.MIN_VALUE;
      trackEvaluation.static.environment.min = Number.MAX_VALUE;
      trackEvaluation.static.health.max = Number.MIN_VALUE;
      trackEvaluation.static.health.min = Number.MAX_VALUE;
      trackEvaluation.static.costs.max = Number.MIN_VALUE;
      trackEvaluation.static.costs.min = Number.MAX_VALUE;
      trackEvaluation.static.time.max = Number.MIN_VALUE;
      trackEvaluation.static.time.min = Number.MAX_VALUE;
      app.models.Track.findById(id, function (error, data) {
        if (error) {
          console.log(error);
        } else {
          console.log("EvaluateTrack: Track sucessfully loaded from Database");
          var cleanedUser = data.mobilityUserId;

          app.models.MobilityUser.findById(cleanedUser, {
            include: ['profile']
          }, function (err, user) {
            if (err) {
              console.log(err);
            } else {

              cleanedUser = user;
              console.log("Starting evaluation of track");

              var track = data;
              var userProfile = cleanedUser.profile;
              var userprefs = {
                health: userProfile.healthValue,
                costs: userProfile.costValue,
                time: userProfile.timeValue,
                environment: userProfile.envValue
              };

              var from = track.sections[0].start.coordinates;
              var to = track.sections[track.sections.length - 1].end.coordinates;
              var date = track.date;
              var formattedDate = dateFormat(date, "yyyy-mm-dd HH:MM");

              //calculate track values
              if (track) {
                track["evaluation"] = trackEvaluation.evaluateTrackValues(track);
              }
              //get alternative routes
              var url = nodeIpAddress + '/api/directions?from='
                + encodeURIComponent(from.lat) + ',' + encodeURIComponent(from.lng) +
                '&to=' + encodeURIComponent(to.lat) + ',' + encodeURIComponent(to.lng) +
                '&depTime=' + encodeURIComponent(formattedDate) +
                '&' + 'access_token=' + encodeURIComponent(token);

              request({
                url: url,
                method: "GET",
                headers: {
                  'Content-Type': 'application/json'
                }
              }, function (error, response, body) {
                if (error) {
                  app.models.Track.replaceOrCreate(track, function (err) {
                    if (err) {
                      console.log("Track could not be stored in DB.");
                      console.log(err);
                      reject("Error during evaluation of the track.");
                    } else {
                      console.log("EvaluateTrack: Track updated in DB");
                      resolve(track);
                    }
                  });
                  console.log(error);
                  reject(error);
                } else {
                  var parsedBody = JSON.parse(body);
                  var routes = parsedBody.routes;

                  if (routes) {
                    for (var i = 0; i < routes.length; i++) {
                      var currentRoute = routes[i];
                      if (currentRoute) {
                        trackEvaluation.determineMinMaxValues(
                          currentRoute.evaluation.values.enviroment,
                          currentRoute.evaluation.values.health,
                          currentRoute.evaluation.values.time,
                          currentRoute.evaluation.values.costs
                        );
                      }
                    }
                  }

                  // calculate relative Values
                  if (track) {
                    trackEvaluation.calculateRelativeTrackValues(track, userprefs);
                  }

                  console.log("Finished evaluation of track.");

                  track.mobilityUserId = cleanedUser.id;

                  app.models.Track.replaceOrCreate(track, function (err) {
                    if (err) {
                      console.log("Track could not be stored in DB.");
                      console.log(err);
                      reject("Error during evaluation of the track.");
                    } else {
                      console.log("EvaluateTrack: Track updated in DB");
                      resolve(track);
                    }
                  });

                }
              });
            }
          });
        }
      });
    });
    return promise;
  }
};


module.exports = trackEvaluation;
