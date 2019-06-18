var helper = require('../helper.js');
var vaoRouting = require('./vao_routing.js');
var searchCHRouting = require('./searchCH_routing.js');
var crossBorderRouting = require('./crossBorder_routing.js');

var crossborderAUT_CH = {

  getAustriaToSwitzerlandDirections: function (from, to, departureTime) {
    return new Promise((resolve, reject) => {
      var crossborderRoutes = [];
      var nearestTrainStationAT = crossBorderRouting.determineNearestTrainStationAT(from, "AT");
      var nearestBorderStationCH = crossBorderRouting.determineNearestTrainStationAT(from, "CH");
      crossborderRoutes.push(this.getRoutesAT_CH_BorderStation(from, to, nearestTrainStationAT.geoCoordinates, departureTime));
      crossborderRoutes.push(this.getRoutesAT_CH_BorderStation(from, to, nearestBorderStationCH.geoCoordinates, departureTime));

      crossborderRoutes.push(this.getRoutesAT_CH_onlyWithVAO(from, to, departureTime));
      let searchCHDepTime = departureTime;
      crossborderRoutes.push(this.getRoutesAT_CH_onlyWithSearchCH(from, to, searchCHDepTime));

      Promise.all(crossborderRoutes)
        .then((results) => {
          // dissovle nested arrays to one array
          var routes = [].concat.apply([], results);
          var allCrossborderRoutes = [];
          for (var i = 0; i < routes.length; i++) {
            var currentRoutes = routes[i];
            if (currentRoutes.constructor === Array) {
              for (var j = 0; j < currentRoutes.length; j++) {
                allCrossborderRoutes.push(currentRoutes[j]);
              }
            } else {
              allCrossborderRoutes.push(currentRoutes);
            }
          }
          var bestTransitRoutes = crossBorderRouting.determineBestRoutes(allCrossborderRoutes);
          resolve(bestTransitRoutes);
        }).catch((error) => {
        console.log(error);
        resolve([]);
      });
    });
  },

  getRoutesAT_CH_BorderStation: function (from, to, nearestTrainStationCoordinates, departureTime) {
    return new Promise((resolve, reject) => {
      vaoRouting.getDirections(from, nearestTrainStationCoordinates, departureTime)
        .then((routes) => {
          var completeCombinedRoutes = [];
          for (var i = 0; i < routes.length; i++) {
            var currentVAORoute = routes[i];
            // routes for second route part
            completeCombinedRoutes.push(this.completeVAORouteWithSearchCHAndGoogle(currentVAORoute, nearestTrainStationCoordinates, to));
          }
          Promise
            .all(completeCombinedRoutes)
            .then((combinedRoutes) => {
              // dissovle nested arrays to one array
              var routes = [].concat.apply([], combinedRoutes);
              resolve(routes);
            }).catch((error) => {
              console.log(error);
              resolve([]);
            }
          );
        }).catch((err) => {
        console.log(err);
        reject(error);
      });
    });
  },

  getRoutesAT_CH_onlyWithVAO(from, to, departureTime) {
    return new Promise((resolve, reject) => {
      vaoRouting.getDirections(from, to, departureTime)
        .then((routes) => {
          var resultRoutes = [];
          var toSplitted = to.split(',');
          for (var i = 0; i < routes.length; i++) {
            var currentRoute = routes[i];

            // check if destination from retrieved route is near the desired destination
            var distance = helper.getDistanceFromLatLonInKm(toSplitted[0], toSplitted[1], currentRoute.overview.toStation.lat, currentRoute.overview.toStation.lng);
            if (distance > 0.3) {       // further than 300 meters away
              resultRoutes.push(this.completeVAORouteWithSearchCHAndGoogle(currentRoute, currentRoute.overview.toStation.lat + ',' + currentRoute.overview.toStation.lng, to));
            } else {    // destination is near the desired destination
              // add route to routes
              resultRoutes.push(new Promise((resolve, reject) => {
                resolve(currentRoute);
              }));
            }
          }
          Promise.all(resultRoutes).then((results) => {
            // dissovle nested arrays to one array
            var routes = [].concat.apply([], results);
            resolve(routes);
          }).catch((error) => {
            console.log(error);
          });
        }).catch((err) => {
        console.log(err);
        reject(error);
      });

    });
  },

  getRoutesAT_CH_onlyWithSearchCH(from, to, departureTime) {
    var fromSplitted = from.split(',');
    return new Promise((resolve, reject) => {
      crossBorderRouting.checkIfSearchChKnowsStation(fromSplitted[0], fromSplitted[1], departureTime).then((result) => {
        if (result === false) {    // it's not possible to get a route with searchCH between from and to
          resolve([]);
        } else {
          searchCHRouting.getDirections(from, to, departureTime)
            .then((routes) => {
              resolve(routes);
            }).catch((error) => {
            console.log(error);
            resolve([]);
          });

        }
      }).catch((err) => {
        console.log(err);
        resolve([]);
      });
    });

  },

  completeVAORouteWithSearchCHAndGoogle(route, from, to) {
    return new Promise((resolve, reject) => {
      var routesToCombine = [];
      var depTime = route.overview.arrivalTime;

      // depTime has the following format: "yyyy-mm-dd hh:mm:ss"
      // for searchCH following format is needed: "yyyy-mm-dd hh:mm";
      var depTimeForSearchCH = depTime.slice(0, 16);
      routesToCombine.push(searchCHRouting.getDirections(from, to, depTimeForSearchCH, null));

      Promise
        .all(routesToCombine)
        .then((results) => {
          var combinedRoutes = [];
          for (var i = 0; i < results.length; i++) {
            combinedRoutes.push(crossBorderRouting.combineRouteWithRoutes(route, results[i]));
          }
          resolve(combinedRoutes);
        }).catch((error) => {
        console.log(error);
        resolve([]);
      });
    });

  }

};
module.exports = crossborderAUT_CH;
