let authreq = require('./authreq');

let evaluationService = require('./evaluation/evaluate.js');
let thresholdController = require('./evaluation/thresholdController.js');
// Routing services
let googleDirections = require('./routing/google_routing.js');
let mapQuestDirections = require('./routing/mapQuest_routing.js');
let publicTransitRoutesManager = require('./routing/publicTransitRoutesManager.js');
let publicTransitRouteCompletion = require('./routing/publicTransitRouteCompletion.js');

module.exports = {
  getDirection: function (req, res) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Content-type", "application/json");

    authreq.waitForAuth(req, res).then(function (user) {
      var cleanedUser = JSON.parse(JSON.stringify(user));
      if (!cleanedUser.profile) {
        res.send({
          error: true,
          message: "no profile created yet."
        });
      } else {
        var from = req.query.from;
        var to = req.query.to;
        var departureTime = req.query.depTime;
        var via = req.query.via;

        var userProfile = cleanedUser.profile;
        var userprefs = {
          health: userProfile.healthValue,
          costs: userProfile.costValue,
          time: userProfile.timeValue,
          enviroment: userProfile.envValue
        };

        var userThresholdsForSectionToStation = {
          footToStationThreshold: userProfile.footToStationThreshold,
          bikeToStationThreshold: userProfile.bikeToStationThreshold,
          waitingTimeThreshold: userProfile.waitingTimeThreshold
        };

        var country = userProfile.country;

        if (from && to) {
          if (departureTime) {
            if (departureTime === "null") {
              departureTime = null;
            } else {
              var matches = departureTime.match(/^(\d{4})\-(\d{2})\-(\d{2}) (\d{2}):(\d{2})$/);
              if (matches === null) {
                departureTime = null;
                res.send({
                  error: true,
                  message: "False timeformat. Time needs to be in the following format: yyyy-mm-dd hh:mm"
                });
                return;
              }
            }
          }

          var routingResults = [];
          var bicycleSectionsAllowed = false;
          // read from profile, if user owns a bike or an ebike
          if (userProfile.bike || userProfile.ebike) {
            bicycleSectionsAllowed = true;
          }

          var routingOptionsMeansOfTransport = {
            bicycle: bicycleSectionsAllowed,
            car: true,
            publicTransport: true
          };
          if (userProfile.car === false && userProfile.ecar === false) {
            routingOptionsMeansOfTransport.car = false;
          }
          if (userProfile.train === false && userProfile.bus === false) {
            routingOptionsMeansOfTransport.publicTransport = false;
          }

          if (routingOptionsMeansOfTransport.publicTransport === true) {
            if (via && via !== "") {
              routingResults.push(publicTransitRoutesManager.getPublicTransitRoutesWithVIAPoint(from, to, via, departureTime, bicycleSectionsAllowed, userThresholdsForSectionToStation));
            } else {
              routingResults.push(publicTransitRoutesManager.getPublicTransitRoutes(from, to, departureTime, null, true, userThresholdsForSectionToStation));
            }
          }

          routingResults.push(googleDirections.getDirections(from, to, via, routingOptionsMeansOfTransport, false));
          routingResults.push(mapQuestDirections.getDirections(from, to, via, routingOptionsMeansOfTransport));

          Promise.all(routingResults).then(results => {
            var possibleRoutes = [];
            var completedPublicTransportRoutes = [];
            for (var i = 0; i < results.length; i++) {
              for (var j = 0; j < results[i].length; j++) {
                var currentRoute = results[i][j];
                if (thresholdController.checkRoute(currentRoute, userProfile)) {
                  if ((currentRoute.routeType === "publicTransit" || currentRoute.routeType === "combined") && !currentRoute.complete) {
                    completedPublicTransportRoutes.push(publicTransitRouteCompletion.completeRouteWithWalkSections(currentRoute));
                  } else {
                    possibleRoutes.push(currentRoute);
                  }
                }
              }
            }

            Promise.all(completedPublicTransportRoutes).then(completedRoutes => {
              for (var k = 0; k < completedRoutes.length; k++) {
                possibleRoutes.push(completedRoutes[k]);
              }
              var evaluatedRoutes = evaluationService.evaluate(possibleRoutes, userprefs, country);
              evaluatedRoutes.sort(function (a, b) {
                return parseFloat(b.evaluation.totalscore) - parseFloat(a.evaluation.totalscore);
              });
              res.send({
                error: false,
                routes: evaluatedRoutes
              });
            }).catch(error => {
              var evaluatedRoutes = evaluationService.evaluate(possibleRoutes, userprefs);
              evaluatedRoutes.sort(function (a, b) {
                return parseFloat(b.evaluation.totalscore) - parseFloat(a.evaluation.totalscore);
              });
              res.send({
                error: false,
                routes: evaluatedRoutes
              });
            });
          }).catch(error => {
            res.send({
              error: true,
              message: "Calculating routes was not successful."
            });
          });
        } else {
          res.send({
            error: true,
            message: "From and/or to are not specified."
          });
        }

      }
    });
  }
};
