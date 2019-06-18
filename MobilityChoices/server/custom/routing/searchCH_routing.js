let request = require('request');
let helper = require('../helper.js');
let logger = require('../../winstonConfig.js');

let searchCHRouting = {
  getDirections: function (from, to, departureTime, arrivalTime) {     // timeformat: hh:mm
    return new Promise((resolve, reject) => {
      var responseObject = [];
      try {
        // determine start station
        logger.log("info", "search.ch station request");      // log request
        request("https://fahrplan.search.ch/api/completion.json?latlon=" + encodeURIComponent(from) + "&show_ids=1&accuracy=10", function (error, response, body) {
          if (error) {
            console.log(error);
            resolve(responseObject);
            return;
          }
          var fromStations = JSON.parse(body);
          var nearestFromStation = searchCHRouting.determineNearestStation(fromStations);
          if (!nearestFromStation) {
            resolve(responseObject);
            return;
          }

          // determine end station
          logger.log("info", "search.ch station request");      // log request
          request("https://fahrplan.search.ch/api/completion.json?latlon=" + encodeURIComponent(to) + "&show_ids=1&accuracy=10", function (error, response, body) {
            if (error) {
              console.log(error);
              resolve(responseObject);
              return;
            }
            var toStations = JSON.parse(body);
            var nearestToStation = searchCHRouting.determineNearestStation(toStations);
            if (!nearestToStation) {
              resolve(responseObject);
              return;
            }

            // request route between start and end station
            var connectionRequestURL = "https://fahrplan.search.ch/api/route.json?from=" + encodeURIComponent(nearestFromStation.id) + "&to=" + encodeURIComponent(nearestToStation.id) + "&num=3";
            if (departureTime) {
              let depTimeSplitted = departureTime.split(' ');
              connectionRequestURL += "&date=" + encodeURIComponent(depTimeSplitted[0]) + "&time=" + encodeURIComponent(depTimeSplitted[1]) + "&time_type=depart";
            } else if (arrivalTime) {
              let arrTimeSplitted = arrivalTime.split(' ');
              connectionRequestURL += "&date=" + encodeURIComponent(arrTimeSplitted[0]) + "&time=" + encodeURIComponent(arrTimeSplitted[1]) + "&time_type=arrival";
            }
            logger.log("info", "search.ch route request");      // log request
            request(connectionRequestURL, function (error, response, body) {
              if (error) {
                console.log(error);
                resolve(responseObject);
                return;
              }
              try {
                var parsedBody = JSON.parse(body);
                var connections = parsedBody.connections;
                if (!connections) {
                  console.log(parsedBody.messages[0]);
                  resolve([]);
                  return;
                }
                var routes = searchCHRouting.parseRoutes(connections, parsedBody.points, from, to, departureTime);
                resolve(routes);
              } catch (error) {
                console.log(error);
                resolve([]);

              }
            });
          });
        });
      } catch (e) {
        console.log(e.message);
        resolve(responseObject);
      }
    });
  },

  determineNearestStation: function (stations) {  // stations are already sorted by distance
    if (stations) {
      for (var i = 0; i < stations.length; i++) {
        var station = stations[i];
        if (station.id) {   // a valid station has an id
          return station;
        }
      }
    }
    return null;
  },

  parseRoutes: function (connections, points, originalFrom, originalTo, departureTime) {
    var routes = [];
    for (var i = 0; i < connections.length; i++) {  // connection = route
      var actualRoute = connections[i];

      if (departureTime) {
        //check if requested departureTime is after the departureTime of this route
        var actualRouteDepartureTime = actualRoute.departure;
        var timeDifference = helper.calculateTimeDifference(departureTime, actualRouteDepartureTime);
        if (timeDifference < 0) {
          // requested departureTime is later than the departure time of this route --> do not add this route to the routes array
          continue;
        }
      }

      // create new Route
      var origFromLatLng = originalFrom.split(',');
      var origToLatLng = originalTo.split(',');
      var fromCoordinates = searchCHRouting.convertCH1903CoordinatesToWGS84Coordinates(points[0].x, points[0].y);
      var toCoordinates = searchCHRouting.convertCH1903CoordinatesToWGS84Coordinates(points[1].x, points[1].y);
      var route = {
        apiName: "search.ch",
        routeType: "publicTransit",
        sections: []
      };
      // create Route Overview
      var overview = {
        distance: "",
        duration: actualRoute.duration / 60,
        departureTime: actualRoute.departure,
        arrivalTime: actualRoute.arrival,
        transfer: "",
        from: originalFrom,
        fromStation: {
          lat: fromCoordinates.lat,
          lng: fromCoordinates.lng,
          stationName: actualRoute.from,
          distanceToStart: helper.getDistanceFromLatLonInKm(origFromLatLng[0], origFromLatLng[1], fromCoordinates.lat, fromCoordinates.lng)
        },
        to: originalTo,
        toStation: {
          lat: toCoordinates.lat,
          lng: toCoordinates.lng,
          stationName: actualRoute.to,
          distanceToDestination: helper.getDistanceFromLatLonInKm(toCoordinates.lat, toCoordinates.lng, origToLatLng[0], origToLatLng[1])
        }
      };
      route.overview = overview;  // add overview to route
      route.overview.crossborder = helper.isRouteCrossBorderRoute(route.overview.fromStation, route.overview.toStation);

      var legs = actualRoute.legs;    // legs = sections
      var routeContainsShipSection = false;
      for (var j = 0; (j < legs.length - 1); j++) {   // -1, because the last leg only contains information about the end station
        var section = searchCHRouting.processLegsToSection(legs[j]);
        if (section.type == "ship") {
          routeContainsShipSection = true;
        }
        route.sections.push(section);
      }
      route.overview.transfer = helper.countTransfers(route);
      route.overview.distance = helper.calculateRouteDistanceInKilometer(route.sections);

      if (!routeContainsShipSection) {
        // only add the route, if it does not contain a ship section
        routes.push(route);
      }
    }

    return routes;
  },

  processLegsToSection: function (leg) {
    var section = {
      apiName: "search.ch",
      type: searchCHRouting.getTravelType(leg.type),
      departureTime: leg.departure,
      arrivalTime: leg.exit.arrival,
    };

    if (section.type === "ship") {  // routes with ships are not wanted and will be sorted out later
      return section;
    }

    if (section.type === "walking") {
      section.name = "walking";
    } else {
      section.name = leg.line;
    }

    var fromCoordiantes = searchCHRouting.convertCH1903CoordinatesToWGS84Coordinates(leg.x, leg.y);
    section.from = {
      lat: fromCoordiantes.lat,
      lng: fromCoordiantes.lng,
      name: leg.name
    };
    var toCoordinates = searchCHRouting.convertCH1903CoordinatesToWGS84Coordinates(leg.exit.x, leg.exit.y);
    section.to = {
      lat: toCoordinates.lat,
      lng: toCoordinates.lng,
      name: leg.exit.name
    };
    section.distance = helper.getDistanceFromLatLonInKm(fromCoordiantes.lat, fromCoordiantes.lng, toCoordinates.lat, toCoordinates.lng);
    var duration = leg.runningtime;
    section.runningtime = leg.runningtime / 60;
    if (leg.waittime) {
      section.waittime = leg.waittime / 60;
      duration += leg.waittime;
    }
    section.duration = duration / 60;
    section.country = helper.determineCountry(section.to.lat, section.to.lng);

    var points = [];    // needed to display route on the map
    points.push([fromCoordiantes.lat, fromCoordiantes.lng]);
    // determine section stops
    if (leg.stops) {
      if (leg.stops.length > 0) {
        section.stops = searchCHRouting.determineSectionStops(leg.stops, points);
      }
    }
    points.push([toCoordinates.lat, toCoordinates.lng]);
    // add points to section
    section.points = helper.decode(points);
    section.pointsString = helper.encode(points);

    return section;
  },

  determineSectionStops: function (legStops, points) {
    var stops = [];
    for (var i = 0; i < legStops.length; i++) {
      var actualStop = legStops[i];
      var stopCoordinates = searchCHRouting.convertCH1903CoordinatesToWGS84Coordinates(actualStop.x, actualStop.y);
      var stop = {
        name: actualStop.name,
        lat: stopCoordinates.lat,
        lng: stopCoordinates.lng
      };
      points.push([stop.lat, stop.lng]);
      stops.push(stop);
    }
    return stops;
  },

  getTravelType: function (type) {
    if (type === "walk") {
      return "walking";
    }
    if (type === "strain") {
      return "train";
    }
    if (type === "bus") {
      return type;
    }
    if (type === "str") {
      return "train";
    }
    if (type === "express_train") {
      return "train";
    }
    if (type === "tram") {
      return "tram";
    }
    if (type === "post") {
      return "bus";
    }
    if (type == "night_strain") {
      return "train";
    }
    if (type == "ship") {
      return "ship";
    }
    console.log(type);
    return "train";  // default type = train
  },

  convertCH1903CoordinatesToWGS84Coordinates: function (x, y) {
    y = (y - 200000) / 1000000;   // - 200 km
    x = (x - 600000) / 1000000;
    var lat = 16.9023892
      + 3.238272 * y
      - 0.270978 * Math.pow(x, 2)
      - 0.002528 * Math.pow(y, 2)
      - 0.0447 * Math.pow(x, 2) * y
      - 0.0140 * Math.pow(y, 3);
    var lng = 2.6779094
      + 4.728982 * x
      + 0.791484 * x * y
      + 0.1306 * x * Math.pow(y, 2)
      - 0.0436 * Math.pow(x, 3);
    x = lat * 100 / 36;
    y = lng * 100 / 36;

    x = Math.round(x * 1000000) / 1000000;  // 6 digits
    y = Math.round(y * 1000000) / 1000000;
    var coordinates = {
      lat: x,
      lng: y
    };
    return coordinates;
  }

};
module.exports = searchCHRouting;
