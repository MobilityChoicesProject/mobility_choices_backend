var polyline = require('@mapbox/polyline');
var whichCountry = require('which-country');
var request = require('request');
var logger = require('../winstonConfig.js');

module.exports = {

  decode: function (points) {
    var arrReturn = [];
    for (var i = 0; i < points.length; i++) {
      arrReturn.push({
        latitude: points[i][0],
        longitude: points[i][1]
      });
    }
    return arrReturn;
  },

  encode: function (wayPoints) {
    return polyline.encode(wayPoints);
  },

  convertRoutePointsToPolyline: function (routePoints) {
    let pointsForPolyline = [];
    for (var i = 0; i < routePoints.length; i++) {
      var currPoint = routePoints[i];
      pointsForPolyline.push([currPoint.latitude, currPoint.longitude]);
    }
    return polyline.encode(pointsForPolyline);
  },

  // calculates the distance in km between two coordinates
  getDistanceFromLatLonInKm: function (latFrom, lngFrom, latTo, lngTo) {
    var R = 6371; // Radius of the earth in km
    var dLat = this.deg2rad(latTo - latFrom);  // deg2rad below
    var dLon = this.deg2rad(lngTo - lngFrom);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(this.deg2rad(latFrom)) * Math.cos(this.deg2rad(latTo))
      * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
  },

  deg2rad: function (deg) {
    return deg * (Math.PI / 180)
  },

  determineCountry: function (lat, lng) {
    var country = whichCountry([lng, lat]);
    return country;
  },

  determineCountryWithGeonamesAPI: function (lat, lng, callback) {
    logger.log("info", "geonames countryCode request");      // log request
    request("http://api.geonames.org/countryCodeJSON?lat=" + lat + "&lng=" + lng + "&username=mobilitychoices", function (error, response, body) {
      if (error) {
        console.log(error);
        callback(error, response, "");
      }
      var countryCode;
      try {
        countryCode = JSON.parse(body).countryCode
      } catch (error) {
        console.log(error);
      }
      callback(error, response, countryCode);
    });
  },

  isRouteCrossBorderRoute: function (from, to) {
    var startCountry = this.determineCountry(from.lat, from.lng);
    var endCountry = this.determineCountry(to.lat, to.lng);
    return startCountry !== endCountry;
  },

  calculateRouteDistanceInKilometer: function (sections) {
    var distance = 0;
    sections.forEach(function (section) {
      distance += section.distance;
    });
    return distance;
  },

  countTransfers: function (route) {
    var transferCount = 0;
    var sections = route.sections;
    var lastTransportationSection = null;
    for (var i = 0; i < sections.length; i++) {
      var currSection = sections[i];
      if (currSection.type !== "walking") {
        if (lastTransportationSection == null
          || lastTransportationSection.name !== currSection.name) {   // different publi transport is used --> transfer is necessary
          transferCount++;
        }
        lastTransportationSection = currSection;
      }
    }
    if (transferCount > 0) {
      transferCount--;       // transfer between two public transport is one less, than the different used public transport
    }
    return transferCount;
  },

  calculateTimeDifference(arrival, departure) {  // "yyyy-mm-dd hh:mm:ss"
    var arrDateObject = new Date(arrival);
    var depDateObject = new Date(departure);

    var duration = (depDateObject.getTime() - arrDateObject.getTime()) / 1000;
    duration /= 60;     // to get duration in minutes
    return duration;
  },

  /**
   * converts a dateTimeObject to the needed timeformat for the request to VAO
   * @param {*} time timeobject
   * returns dateTime in the following format: "yyyymmdd hh:mm"
   */
  convertDateObjectToTimeformatForRequest: function (dateTime) {
    // needed format by VAO: "yyyy-mm-dd hh:mm"
    let localeDate = dateTime.toLocaleDateString();
    let localeTimeString = dateTime.toLocaleTimeString();
    let dateSplitted = localeDate.split('-');
    let day = dateSplitted[2];
    let month = dateSplitted[1];
    let year = dateSplitted[0];
    if (day < 10) {
      day = "0" + day;
    }
    if (month < 10) {
      month = "0" + month;
    }
    let date = year + "-" + month + "-" + day;
    let time = localeTimeString.slice(0, 5);

    return date + " " + time;        //format: "yyyy-mm-dd hh:mm:ss"
  },

  /**
   * converts a dateTime String to the needed timeformat for the request to google
   * @param {*} time time needs to be in the following format: "yyyy-mm-dd hh:mm"
   * returns time in unixTime
   */
  convertDateTimeStringToTimeFormatForGoogleRequest: function (dateTime) {
    var matches = dateTime.match(/^(\d{4})\-(\d{2})\-(\d{2}) (\d{2}):(\d{2})$/);
    if (matches !== null) {
      var date = new Date(dateTime);
      return date.getTime() / 1000;
    }
  },

  /**
   * combineRoutes combines route1 with route2. Route1 is the first part of the combined route and route2 the second part.
   */
  combineRoutes: function (route1, route2) {
    // update distance
    route1.overview.distance += route2.overview.distance;
    // update duration
    route1.overview.duration += route2.overview.duration;
    // update to
    route1.overview.to = route2.overview.to;

    if (route1.type !== "publicTransit" && route1.type !== "combined" && route1.type === route2.type) {
      //routetype of both routes is driving, bicycling or walking and therefore both routes have only one section
      var route1Section = route1.sections[0];
      var route2Section = route2.sections[0];
      // update distance
      route1Section.distance += route2Section.distance;
      // update duration
      route1Section.duration += route2Section.duration;
      // update to
      route1Section.to = route2Section.to;
      // update section points
      route1Section.points.push.apply(route1Section.points, route2Section.points);
      // update polyline
      route1Section.pointsString = this.convertRoutePointsToPolyline(route1Section.points);
    } else {
      // add sections of route2 to sections of route1
      var combinedRoutePoints = route1.sections.concat(route2.sections);
      route1Section.points = combinedRoutePoints;
    }

    return route1;
  }
};
