var request = require('request');
var helper = require('../helper.js');
var mapbox_polyline = require('@mapbox/polyline');
let logger = require('../../winstonConfig.js');
let keyHelper = require('../../keyHelper.js');

var googleRouting = {

  getDirections: function (from, to, via, routingOptionsMeansOfTransport, transitRoute,) {
    return new Promise(function (resolve, reject) {
      let apiKey = keyHelper.getGoogleAPIKey();
      var responseObject = [];
      if (routingOptionsMeansOfTransport.car === true) {
        responseObject.push(googleRouting.getRouteForSpecificMode(apiKey, from, to, via, "driving"));
      }
      if (routingOptionsMeansOfTransport.bicycle === true) {
        responseObject.push(googleRouting.getRouteForSpecificMode(apiKey, from, to, via, "bicycling"));
      }
      responseObject.push(googleRouting.getRouteForSpecificMode(apiKey, from, to, via, "walking"));
      if (transitRoute) {
        responseObject.push(googleRouting.getRouteForSpecificMode(apiKey, from, to, via, "transit"));
      }

      Promise.all(responseObject).then(results => {
        results = [].concat.apply([], results);
        resolve(results);
      }).catch(error => {
        console.log(error);
        resolve([]);
      })
    });
  },

  getRouteForSpecificMode: function (directionsKey, from, to, via, mode, departureTime, arrivalTime) {
    if (mode !== "driving" && mode !== "bicycling" && mode !== "walking" && mode !== "transit") {
      mode = "driving";       // default mode is driving;
    }
    return new Promise((resolve, reject) => {
      if (directionsKey === "" || directionsKey === null) {
        directionsKey = keyHelper.getGoogleAPIKey();
      }
      var responseObject = [];
      if (mode === "transit") {
        let requestURL;
        if (departureTime) {
          requestURL = "https://maps.googleapis.com/maps/api/directions/json?origin=" + encodeURIComponent(from) + "&destination=" + encodeURIComponent(to) + "&mode=transit&departure_time=" + encodeURIComponent(departureTime) + "&key=" + directionsKey;
        } else if (arrivalTime) {
          requestURL = "https://maps.googleapis.com/maps/api/directions/json?origin=" + encodeURIComponent(from) + "&destination=" + encodeURIComponent(to) + "&mode=transit&arrival_time=" + encodeURIComponent(arrivalTime) + "&key=" + directionsKey;
        } else {
          requestURL = "https://maps.googleapis.com/maps/api/directions/json?origin=" + encodeURIComponent(from) + "&destination=" + encodeURIComponent(to) + "&mode=transit&key=" + directionsKey;
        }
        logger.log("info", "googlemaps route request");      // log request
        request(requestURL, (error, response, body) => {
          if (error) {
            console.log("Error for google mode transit: " + error);
          } else {
            try {
              var results = googleRouting.parseTransitRoute(JSON.parse(body), from, to);
              for (var j = 0; j < results.length; j++) {
                responseObject.push(results[j]);
              }
            } catch (error) {
              conosle.log(error.message);
            }
          }
          resolve(responseObject);
        });
      } else {
        let requestURL = "https://maps.googleapis.com/maps/api/directions/json?origin=" + encodeURIComponent(from) + "&destination=" + encodeURIComponent(to) + "&mode=" + encodeURIComponent(mode);
        if (via) {
          requestURL += "&waypoints=via:" + via;
        }
        requestURL += "&key=" + directionsKey;
        logger.log("info", "googlemaps route request");      // log request
        request(requestURL, (error, response, body) => {
          if (error) {
            console.log("Error for google mode " + mode + ": " + error);
          } else {
            try {
              var results = googleRouting.parseToRoute(JSON.parse(body), mode);
              for (var j = 0; j < results.length; j++) {
                responseObject.push(results[j]);
              }
              resolve(responseObject);
            } catch (error) {
              conosle.log(error.message);
              resolve(responseObject);
            }
          }
        });
      }
    });
  },

  parseToRoute: function (object, type) {
    var routes = [];

    for (var r = 0; r < object.routes.length; r++) {
      var currentRoute = object.routes[r];

      if (currentRoute) {
        var route = {
          apiName: "googlemaps",
          routeType: type,
          sections: []
        };

        var routeLegs = currentRoute.legs;
        var routeDistance = 0;
        var routeDuration = 0;

        for (var i = 0; i < routeLegs.length; i++) {
          var currentLeg = routeLegs[i];
          routeDistance += (currentLeg.distance.value / 1000.0);
          routeDuration += (currentLeg.duration.value / 60.0);

          var section = {
            type: type,
            name: type,
            apiName: "googlemaps",
            from: {
              lat: currentLeg.start_location.lat,
              lng: currentLeg.start_location.lng,
              name: currentLeg.start_address
            },
            to: {
              lat: currentLeg.end_location.lat,
              lng: currentLeg.end_location.lng,
              name: currentLeg.end_address
            },
            duration: currentLeg.duration.value / 60.0,
            distance: currentLeg.distance.value / 1000.0
          };
          route.sections.push(section);

          var polyline = currentRoute.overview_polyline.points;
          var points = mapbox_polyline.decode(polyline);
          section.points = helper.decode(points);
          section.pointsString = polyline;
        }

        // define overview of route
        var overview = {
          from: routeLegs[0].start_location.lat + "," + routeLegs[0].start_location.lng,
          to: routeLegs[routeLegs.length - 1].end_location.lat + "," + routeLegs[routeLegs.length - 1].end_location.lng,
          distance: routeDistance,
          duration: routeDuration,
          crossBorder: helper.isRouteCrossBorderRoute(route.sections[0].from, route.sections[route.sections.length - 1].to)
        };
        route.overview = overview;  // add overview to route

        routes.push(route);
      }
    }

    return routes;
  },

  parseTransitRoute: function (body, originalFrom, originalTo) {
    var routes = [];
    var currentRoute = body.routes[0];
    if (currentRoute) {
      for (var i = 0; i < currentRoute.legs.length; i++) {
        var currentLeg = currentRoute.legs[i];
        var route = {
          apiName: "googlemaps",
          routeType: "publicTransit",
          sections: []
        };

        // define overview of route
        var origFromLatLng = originalFrom.split(',');
        var origToLatLng = originalTo.split(',');
        var overview = {
          distance: "",
          duration: "",
          departureTime: googleRouting.convertUTCEpochToDateTimeStandardFormat(currentLeg.departure_time.value),
          arrivalTime: googleRouting.convertUTCEpochToDateTimeStandardFormat(currentLeg.arrival_time.value),
          transfer: "",
          from: originalFrom,
          fromStation: {
            lat: currentLeg.start_location.lat,
            lng: currentLeg.start_location.lng,
            name: currentLeg.start_address,
            distanceToStart: helper.getDistanceFromLatLonInKm(currentLeg.start_location.lat, currentLeg.start_location.lng, origFromLatLng[0], origFromLatLng[1])
          },
          to: originalTo,
          toStation: {
            lat: currentLeg.end_location.lat,
            lng: currentLeg.end_location.lng,
            name: currentLeg.end_address,
            distanceToDestination: helper.getDistanceFromLatLonInKm(currentLeg.end_location.lat, currentLeg.end_location.lng, origToLatLng[0], origToLatLng[1])
          },
        };
        route.overview = overview;  // add overview to route

        for (var j = 0; j < currentLeg.steps.length; j++) {
          var currentStep = currentLeg.steps[j];
          var polylinePoints = currentStep.polyline.points;
          var points = mapbox_polyline.decode(polylinePoints);

          var section = {
            type: "",
            name: "",
            from: {
              lat: currentStep.start_location.lat,
              lng: currentStep.start_location.lng
            },
            to: {
              lat: currentStep.end_location.lat,
              lng: currentStep.end_location.lng
            },
            duration: (currentStep.duration.value / 60.0),
            distance: (currentStep.distance.value / 1000.0),
            points: helper.decode(points),
            pointsString: polylinePoints,
          };
          section.country = helper.determineCountry(section.to.lat, section.to.lng);
          if (currentStep.travel_mode === "TRANSIT") {
            var transitDetails = currentStep.transit_details;
            section.type = googleRouting.getPublicTransportType(transitDetails.line.vehicle.type, transitDetails.line.vehicle.name);
            section.name = transitDetails.line.short_name;
            section.departureTime = googleRouting.convertUTCEpochToDateTimeStandardFormat(transitDetails.departure_time.value);
            section.arrivalTime = googleRouting.convertUTCEpochToDateTimeStandardFormat(transitDetails.arrival_time.value);
            section.from.stationName = transitDetails.departure_stop.name;
            section.to.stationName = transitDetails.arrival_stop.name;
          } else {
            section.type = "walking";
            section.name = "walking";
          }
          route.sections.push(section);
        }
        route.overview.duration = currentLeg.duration.value / 60;
        route.overview.distance = currentLeg.distance.value / 1000;
        route.overview.transfer = helper.countTransfers(route);
        route.overview.crossborder = helper.isRouteCrossBorderRoute(route.overview.fromStation, route.overview.toStation);
        routes.push(route);
      }
    }
    return routes;
  },

  getPublicTransportType: function (vehicleType, vehicleName) {
    if (!vehicleType) {
      if (!vehicleName) {
        return "train"; // train is default
      }
      if (vehicleName.indexOf("train") !== -1) {
        return "train";
      } else if (vehicleName.indexOf("bus") !== -1) {
        return "bus";
      } else {
        return "tram";
      }
    }
    if (vehicleType.indexOf("BUS") !== -1) {
      return "bus";
    }
    if (vehicleType.indexOf("TRAIN") !== -1) {
      return "train";
    }
    if (vehicleType.indexOf("RAIL") !== -1) {
      return "train";
    }

    if (vehicleType.indexOf("TRAM") !== -1) {
      return "tram";
    }
    return "";
  },

  convertUTCEpochToDateTimeStandardFormat(utcSeconds) {
    var dateObject = new Date(0); // 0 sets the date to the epoch
    dateObject.setUTCSeconds(utcSeconds);

    var date = dateObject.toISOString().substring(0, 10);
    var time = dateObject.toTimeString().substring(0, 8);

    return date + " " + time;
  }
};
module.exports = googleRouting;
