var request = require('request');
var helper = require('../helper.js');
var searchCHRouting = require('./searchCH_routing.js');
let logger = require('../../winstonConfig.js');

// contains methods which are needed for finding routes from austria to switzerland and from switzerland to austria
var crossborderRouting = {

  combineRouteWithRoutes: function (origRoute, routesToCombine) {
    var allCombinedRoutes = [];
    for (var i = 0; i < routesToCombine.length; i++) {
      var currRoute = routesToCombine[i];

      // check, if arrival time is before departure time of the second route
      // check waiting time between arrival at last section of origRoute and departre of first section of the combining route
      if (this.checkTimeDiffereneceOfCombiningRoutes(origRoute, currRoute)) {
        var newCombinedRoute = JSON.parse(JSON.stringify(origRoute));    // deep copy origRoute
        newCombinedRoute.routeType = "combined";

        // add sections of currRoute to sections from newCombinedRoute
        var s = 0;
        for (s = 0; s < currRoute.sections.length; s++) {
          newCombinedRoute.sections.push(currRoute.sections[s]);
        }
        // update distance of newCombinedRoute
        newCombinedRoute.overview.distance += currRoute.overview.distance;
        // update arrivalTime
        newCombinedRoute.overview.arrivalTime = currRoute.sections[s - 1].arrivalTime;
        // update destination of route
        newCombinedRoute.overview.toStation = currRoute.sections[s - 1].to;
        // update duration of newCombinedRoute
        newCombinedRoute.overview.duration = helper.calculateTimeDifference(newCombinedRoute.overview.departureTime, newCombinedRoute.overview.arrivalTime);
        // update transfer
        newCombinedRoute.overview.transfer = helper.countTransfers(newCombinedRoute);

        allCombinedRoutes.push(newCombinedRoute);
      }
    }
    return allCombinedRoutes;
  },

  checkTimeDiffereneceOfCombiningRoutes(origRoute, combiningRoute) {
    var origLastSection = origRoute.sections[origRoute.sections.length - 1];
    var combiningRouteFirstSection = combiningRoute.sections[0];
    var difference = helper.calculateTimeDifference(origLastSection.arrivalTime, combiningRouteFirstSection.departureTime);
    if (difference > 0 && difference < 70) {
      return true;
    } else if (difference == 0) {
      // check if it is the same bus or train
      if (origLastSection.name === combiningRouteFirstSection.name) {
        return true;
      } else {
        return false;
      }
    }
    return false;
  },

  determineNearestTrainStationAT: function (from, country) {
    var borderStations = null;
    if (country === "AT") {
      borderStations = borderStationsVorarlberg;
    } else {
      borderStations = borderStationsSwitzerland;
    }
    var minDistance = Number.MAX_VALUE;
    var fromSplitted = from.split(',');
    var nearestTrainStation = null;
    for (var i = 0; i < borderStations.length; i++) {
      var currStation = borderStations[i];
      var distance = helper.getDistanceFromLatLonInKm(currStation.lat, currStation.lng, fromSplitted[0], fromSplitted[1]);
      if (distance < minDistance) {
        minDistance = distance;
        nearestTrainStation = currStation;
      }
    }
    return nearestTrainStation;
  },

  checkIfSearchChKnowsStation: function (lat, lng) {
    return new Promise((resolve, reject) => {
      logger.log("info", "search.ch station request");      // log request
      request("https://fahrplan.search.ch/api/completion.json?latlon=" + encodeURIComponent(lat) + "," + encodeURIComponent(lng) + "&show_ids=1&accuracy=10", function (error, response, body) {
        if (error) {
          console.log(error);
          reject(error);
          return false;
        }
        try {
          var stations = JSON.parse(body);
          var nearestFromStation = searchCHRouting.determineNearestStation(stations);
          if (!nearestFromStation) {
            resolve(false);
          } else {
            resolve(true);
          }
        } catch (e) {
          resolve(false);
        }
      });
    });
  },

  /**
   * returns the best 3 routes
   * @param {*} crossborderRoutes
   */
  determineBestRoutes: function (crossborderRoutes) {
    var bestThreeRoutes = [];

    // sort ascencing by arrivalTime at the destination
    // then by duration and then by amount of transfers
    // arrivaltime -> duration -> transfer
    crossborderRoutes.sort((r1, r2) => {
      if (r1.overview.arrivalTime < r2.overview.arrivalTime) {
        return -1;
      } else if (r1.overview.arrivalTime === r2.overview.arrivalTime) {
        if (r1.overview.duration === r2.overview.duration) {
          if (r1.overview.transfer === r2.overview.transfer) {
            return 0;
          } else {
            return r1.overview.transfer - r2.overview.transfer;
          }
        } else {
          return r1.overview.duration - r2.overview.duration;
        }
        return 0;
      }
      return 1;
    });

    if (crossborderRoutes.length >= 3) {
      bestThreeRoutes = crossborderRoutes.slice(0, 3);
    } else {
      bestThreeRoutes = crossborderRoutes;
    }

    return bestThreeRoutes;
  }

};
module.exports = crossborderRouting;

var borderStationsVorarlberg = [
  {
    name: "BregenzHbf",
    geoCoordinates: "47.502313,9.739421",
    lat: 47.502313,
    lng: 9.739421
  },
  {
    name: "Dornbirn",
    geoCoordinates: "47.417501,9.738858",
    lat: 47.417501,
    lng: 9.738858
  },
  {
    name: "Feldkirch",
    geoCoordinates: "47.241102,9.603895",
    lat: 47.241102,
    lng: 9.603895
  }
];

var borderStationsSwitzerland = [
  {
    name: "St. Margrethen",
    geoCoordinates: "47.453147,9.638235",
    lat: 47.453147,
    lng: 9.638235
  },
  {
    name: "Heerbrugg",
    geoCoordinates: "47.410935,9.627861",
    lat: 47.410935,
    lng: 9.627861
  },
  {
    name: "Buchs SG Bahnhof",
    geoCoordinates: "47.168104,9.478210",
    lat: 47.168104,
    lng: 9.478210
  }
];
