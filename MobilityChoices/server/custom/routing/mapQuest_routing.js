var request = require('request');
var helper = require('../helper.js');
var keyHelper = require('../../keyHelper.js');
let logger = require('../../winstonConfig.js');

var mapQuestRouting = {

  getDirections: async function (from, to, via, routingOptionsMeansOfTransport) {
    let mapQuestKey = keyHelper.getMapQuestKey();
    if (via) {
      var viaRoutes = [];

      try {
        if (routingOptionsMeansOfTransport.car) {
          var promises = [];
          promises.push(mapQuestRouting.getSpecificRouteForRouteType(mapQuestKey, from, via, "fastest"));
          promises.push(mapQuestRouting.getSpecificRouteForRouteType(mapQuestKey, via, to, "fastest"));

          promises.push(mapQuestRouting.getSpecificRouteForRouteType(mapQuestKey, from, via, "shortest"));
          promises.push(mapQuestRouting.getSpecificRouteForRouteType(mapQuestKey, via, to, "shortest"));

          promises = await Promise.all(promises);

          var fastestRoutePart1 = promises[0];
          var fastestRoutePart2 = promises[1];
          let fastestRoute = helper.combineRoutes(fastestRoutePart1, fastestRoutePart2);
          viaRoutes.push(fastestRoute);

          var shortestRoutePart1 = promises[2];
          var shortestRoutePart2 = promises[3];
          let shortestRoute = helper.combineRoutes(shortestRoutePart1, shortestRoutePart2);
          viaRoutes.push(shortestRoute);
        }

        if (routingOptionsMeansOfTransport.bicycle) {
          var bicycleRoutePromises = [];
          bicycleRoutePromises.push(mapQuestRouting.getSpecificRouteForRouteType(mapQuestKey, from, via, "bicycle"));
          bicycleRoutePromises.push(mapQuestRouting.getSpecificRouteForRouteType(mapQuestKey, via, to, "bicycle"));

          bicycleRoutePromises = await Promise.all(bicycleRoutePromises);
          var bicycleRoutePart1 = bicycleRoutePromises[0];
          var bicycleRoutePart2 = bicycleRoutePromises[1];
          let bicycleRoute = helper.combineRoutes(bicycleRoutePart1, bicycleRoutePart2);
          viaRoutes.push(bicycleRoute);
        }

        var pedestrianPromises = [];
        pedestrianPromises.push(mapQuestRouting.getSpecificRouteForRouteType(mapQuestKey, via, to, "pedestrian"));
        pedestrianPromises.push(mapQuestRouting.getSpecificRouteForRouteType(mapQuestKey, from, via, "pedestrian"));
        pedestrianPromises.push(mapQuestRouting.getSpecificRouteForRouteType(mapQuestKey, via, to, "pedestrian"));

        pedestrianPromises = await Promise.all(pedestrianPromises);
        var pedestrianRoutePart1 = pedestrianPromises[0];
        var pedestrianRoutePart2 = pedestrianPromises[1];
        let pedestrianRoute = helper.combineRoutes(pedestrianRoutePart1, pedestrianRoutePart2);
        viaRoutes.push(pedestrianRoute);

        return viaRoutes;
      } catch (error) {
        console.log(error);
        return [];
      }
    } else {
      var routes = [];

      try {
        var promises = [];
        if (routingOptionsMeansOfTransport.car) {
          promises.push(mapQuestRouting.getSpecificRouteForRouteType(mapQuestKey, from, to, "fastest"));
          promises.push(mapQuestRouting.getSpecificRouteForRouteType(mapQuestKey, from, to, "shortest"));
        }
        if (routingOptionsMeansOfTransport.bicycle) {
          promises.push(mapQuestRouting.getSpecificRouteForRouteType(mapQuestKey, from, to, "bicycle"));
        }
        promises.push(mapQuestRouting.getSpecificRouteForRouteType(mapQuestKey, from, to, "pedestrian"));

        promises = await Promise.all(promises);

        for (var i = 0; i < promises.length; i++) {
          routes.push(promises[i]);
        }

        return routes;
      } catch (error) {
        console.log(error);
        return [];
      }
    }
  },

  /**
   * routeType has to be: pedestrian, bicycle, fastest or shortest
   */
  getSpecificRouteForRouteType: function (mapQuestKey, from, to, routeType) {
    return new Promise((resolve, reject) => {
      logger.log("info", "MapQuest route request");      // log request
      var requestURL = "http://open.mapquestapi.com/directions/v2/route?key=" + mapQuestKey + "&unit=k&narrativeType=none&fullShape=true&routeType=" + encodeURI(routeType) +
        "&from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to);
      request(requestURL, function (error, response, body) {
        if (error) {
          console.log("Error for MapQuest fastest driving route: " + error);
          resolve([]);
        } else {
          var typeForReturnRoute = mapQuestRouting.determineReturnRouteTypeFromRouteType(routeType);
          if (typeForReturnRoute !== "") {
            try {
              let parsedResponse = JSON.parse(body);
              resolve(mapQuestRouting.getRouteFromResponse(parsedResponse, typeForReturnRoute));
            } catch (e) {
              console.log(e.message);
              resolve([]);
            }
          } else {
            resolve([]);
          }
        }
      });
    });
  },

  getRouteFromResponse: function (response, routeType) {
    var mapQuestRoute = response.route;
    // define Route
    var route = {
      apiName: "MapQuest",
      routeType: routeType,
      sections: []
    };

    // define overview of route
    var overview = {
      distance: mapQuestRoute.distance,
      duration: mapQuestRoute.time / 60,     // time in minutes
      crossBorder: mapQuestRoute.hasCountryCross
    };
    route.overview = overview;  // add overview to route

    var locations = mapQuestRoute.locations;
    var startLocation = locations[0];
    var endLocation = locations[locations.length - 1];

    var sections = [];
    for (var i = 0; i < mapQuestRoute.legs.length; i++) {
      var currentLeg = mapQuestRoute.legs[i];
      var section = {
        type: routeType,
        name: routeType,
        apiName: "MapQuest",
        from: {
          lat: startLocation.latLng.lat,
          lng: startLocation.latLng.lng,
          name: startLocation.street + ", " + startLocation.postalCode + " " + startLocation.adminArea5 + ", " + startLocation.adminArea1,
        },
        to: {
          lat: endLocation.latLng.lat,
          lng: endLocation.latLng.lng,
          name: endLocation.street + ", " + endLocation.postalCode + " " + endLocation.adminArea5 + ", " + endLocation.adminArea1,
        },
        duration: currentLeg.time / 60,
        distance: currentLeg.distance,
        points: []
      };
      sections.push(section);
    }
    route.sections = sections;

    var shape = mapQuestRoute.shape;
    var shapePoints = shape.shapePoints;

    var routePoints = [];
    var routePolylinePoints = [];

    for (var j = 0; j < shapePoints.length; j++) {
      routePoints.push({
        latitude: shapePoints[j],
        longitude: shapePoints[j + 1]
      });
      routePolylinePoints.push([shapePoints[j], shapePoints[j + 1]]);
      j++;
    }

    mapQuestRouting.addRoutePointsToCorrectSection(routePoints, routePolylinePoints, sections);

    route.overview.from = sections[0].from.lat + "," + sections[0].from.lng;
    route.overview.to = sections[sections.length - 1].to.lat + "," + sections[sections.length - 1].to.lng;

    return route;
  },

  addRoutePointsToCorrectSection: function (routePoints, routePolylinePoints, sections) {
    if (sections.length === 1) {
      sections[0].points = routePoints;
      var polyline = helper.encode(routePolylinePoints);
      sections[0].pointsString = polyline;
    } else {
      var currentSection = sections[0];
      var j = 0;
      for (var i = 1; i < sections.length; i++) {
        var nextSection = sections[i];
        var nextSectionNeeded = false;
        var pointsForPolyline = [];
        while ((j < routePoints.length) && !nextSectionNeeded) {
          var point = routePoints[j];
          var latDifference = Math.abs(nextSection.from.lat - routePoints[j].latitude);
          var lngDifference = Math.abs(nextSection.from.lng - routePoints[j].longitude);
          if (latDifference <= 0.0000011 && lngDifference <= 0.0000011) {
            currentSection.points.push(point);
            nextSection.points.push(point);
            pointsForPolyline.push(([point.latitude, point.longitude]));
            currentSection.pointsString = helper.encode(pointsForPolyline);
            nextSectionNeeded = true;
            currentSection = nextSection;
          } else {
            currentSection.points.push(point);
            pointsForPolyline.push(([point.latitude, point.longitude]));
          }
          j++;
        }
      }
      j++;
      if (j < routePoints.length) {
        while (j < routePoints.length) {
          var point = routePoints[j];
          currentSection.points.push(point);
          pointsForPolyline.push(([point.latitude, point.longitude]));
          j++;
        }
        currentSection.pointsString = helper.encode(pointsForPolyline);
      }

    }
  },

  determineReturnRouteTypeFromRouteType: function (routeType) {
    if (routeType) {
      if (routeType === "fastest" || routeType === "shortest") {
        return "driving";
      } else if (routeType === "pedestrian") {
        return "walking";
      } else if (routeType === "bicycle") {
        return "bicycling";
      } else {
        return "";
      }
    } else {
      return "";
    }
  }
};
module.exports = mapQuestRouting;
