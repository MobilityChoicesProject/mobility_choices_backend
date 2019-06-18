var XMLHttpRequest = require('xhr2');
var parseString = require('xml2js').parseString;
var vaoRouting = require('./vao_routing.js');
var searchCHRouting = require('./searchCH_routing.js');
var crossBorderRouting = require('./crossBorder_routing.js');

let logger = require('../../winstonConfig.js');

var crossborderCH_AUT = {

  getSwitzerlandToAustriaDirections: function (from, to, departureTime) {
    return new Promise((resolve, reject) => {
      var crossborderRoutes = [];
      var nearestTrainStationAT = crossBorderRouting.determineNearestTrainStationAT(from, "AT");
      var nearestBorderStationCH = crossBorderRouting.determineNearestTrainStationAT(from, "CH");

      crossborderRoutes.push(this.getRoutesCH_AUT_BorderStation(from, to, nearestTrainStationAT.geoCoordinates, departureTime));
      crossborderRoutes.push(this.getRoutesCH_AUT_BorderStation(from, to, nearestBorderStationCH.geoCoordinates, departureTime));

      crossborderRoutes.push(this.getRoutesCH_AUT_onlyWithVAO(from, to, departureTime));
      crossborderRoutes.push(this.getRoutesCH_AUT_onlyWithSearchCH(from, to, departureTime));

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

  getRoutesCH_AUT_BorderStation: function (from, to, nearestTrainStationCoordinates, departureTime) {
    return new Promise((resolve, reject) => {
      searchCHRouting.getDirections(from, nearestTrainStationCoordinates, departureTime)
        .then((routes) => {
          var completeCombinedRoutes = [];
          for (var i = 0; i < routes.length; i++) {
            var currentSearchCHRoute = routes[i];
            // routes for second route part
            completeCombinedRoutes.push(this.completeSearchCHRouteWithVAOAndGoogle(currentSearchCHRoute, nearestTrainStationCoordinates, to));
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
        }).catch((error) => {
        console.log(error);
        reject(error);
      });
    });
  },

  /**
   * getRoutesCH_AUT_onlyWithVAO first checks whether the starting stop is close enough to the start. If this is not the case,
   * then routes are first determined by search.CH from the start to the start stop and then completed with VAO routes from
   * the start stop to the destination.
   * @param {*} from
   * @param {*} to
   */
  getRoutesCH_AUT_onlyWithVAO(from, to, departureTime) {
    return new Promise((resolve, reject) => {
      var fromSplitted = from.split(',');
      this.getPossibleVAOStation(fromSplitted[0], fromSplitted[1])
        .then(station => {
          var resultRoutes = [];
          var stationDistanceFromStart = station.distance;
          if (stationDistanceFromStart > 300) {       // further than 300 meter away
            var stationLat = station.y / 1000000;
            var stationLng = station.x / 1000000;
            var stationCoordinates = stationLat + ',' + stationLng;
            resultRoutes.push(this.getRoutesCH_AUT_BorderStation(from, to, stationCoordinates, departureTime));
          } else {
            resultRoutes.push(vaoRouting.getDirections(from, to, departureTime));
          }
          Promise.all(resultRoutes).then((results) => {
            // dissovle nested arrays to one array
            var routes = [].concat.apply([], results);
            routes = [].concat.apply([], routes);
            resolve(routes);
          }).catch((error) => {
            console.log(error);
          });
        }).catch((err) => {
        console.log(err);
        resolve([]);
      });
    });
  },

  getRoutesCH_AUT_onlyWithSearchCH(from, to, departureTime) {
    var fromSplitted = from.split(',');
    return new Promise((resolve, reject) => {
      crossBorderRouting.checkIfSearchChKnowsStation(fromSplitted[0], fromSplitted[1]).then((result) => {
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

  completeSearchCHRouteWithVAOAndGoogle(route, from, to) {
    return new Promise((resolve, reject) => {
      var routesToCombine = [];
      var depTime = route.overview.arrivalTime;

      var depTimeForVAO = depTime.slice(11, 16);
      var date = depTime.split(' ')[0];
      var dateSplitted = date.split('-');
      var depDateForVAO = "" + dateSplitted[0] + dateSplitted[1] + dateSplitted[2];
      var depDateTimeVAO = depDateForVAO + " " + depTimeForVAO;
      routesToCombine.push(vaoRouting.getDirections(from, to, depDateTimeVAO, null));

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
  },

  getPossibleVAOStation: function (lat, lng) {
    var x = lng * 1000000;
    var y = lat * 1000000;
    var locValReqXML = '<?xml version="1.0" encoding="utf-8"?>'
      + '<ReqC accessId="FHVorarlberg4u9302jPIHJjnhfpw4epj423ß9juß9?Uhdfpiq3329)03olmelA">'
      + '<LocValReq id="1" maxNr="5">'
      + '<Coord  x="' + x + '" y="' + y + '" locType="ST" />'
      + '</LocValReq>'
      + '</ReqC>';
    return new Promise((resolve, reject) => {
      var xmlhttp = new XMLHttpRequest();
      logger.log("info", "VAO station request");      // log request
      xmlhttp.open("POST", "http://projektplattform.verkehrsauskunft.at/bin/extxml.exe", true);
      xmlhttp.setRequestHeader('Content-Type', 'text/xml');
      xmlhttp.send(locValReqXML);

      xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
          var response = xmlhttp.response;

          parseString(response, {
              explicitArray: false,
              mergeAttrs: true
            }, (err, result) => {
              if (err) {
                console.log(err);
                reject(err);    //  parsing wasn't possibe
                return;
              }
              var locValRes = result.ResC.LocValRes;
              var stationFrom = locValRes.Station[0];
              resolve(stationFrom);
            }
          );
        }
      };
    });
  }

};
module.exports = crossborderCH_AUT;
