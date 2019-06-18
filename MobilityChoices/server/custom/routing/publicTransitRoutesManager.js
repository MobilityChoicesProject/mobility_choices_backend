let helper = require('../helper.js');
let thresholdController = require('../evaluation/thresholdController.js');

// Routing services
let vaoDirections = require('./vao_routing.js');
let searchCHDirections = require('./searchCH_routing.js');
let googleDirections = require('./google_routing.js');

//crossborder Routing services
let crossBorder_AUT_CH_Routing = require('./crossBorder_AUT_CH.js');
let crossBorder_CH_AUT_Routing = require('./crossBorder_CH_AUT.js');

let publicTransitRouteCompletion = require('./publicTransitRouteCompletion.js');


var publicTransitRoutesManager = {

  getPublicTransitRoutesWithVIAPoint: async function (from, to, via, departureTime, allowBicycleSections, userThresholdsForSectionToStation) {
    if (via) {
      var viaRoutes = [];
      try {
        var routes1 = await publicTransitRoutesManager.getPublicTransitRoutes(from, via, departureTime, null, allowBicycleSections, userThresholdsForSectionToStation);

        for (let i = 0; i < routes1.length; i++) {
          var currentRoute = routes1[i];
          var arrTimeAtVIA = currentRoute.overview.arrivalTime;
          arrTimeAtVIA = arrTimeAtVIA.slice(0, 16);  // from "yyyy-mm-dd hh:mm:ss" to "yyyy-mm-dd hh:mm"
          var routesToCombine = await publicTransitRoutesManager.getPublicTransitRoutes(via, to, arrTimeAtVIA, null, false, userThresholdsForSectionToStation);

          viaRoutes.push(publicTransitRoutesManager.combineRouteWithRoutes(currentRoute, routesToCombine, userThresholdsForSectionToStation));
        }

        // dissolve nested array
        viaRoutes = [].concat.apply([], viaRoutes);
        var bestVIARoutes = publicTransitRoutesManager.determineBestPublicTransitRoutes(viaRoutes);
        for (let j = 0; j < bestVIARoutes.length; j++) {
          publicTransitRoutesManager.combineConsecutiveFootOrBicycleSectionsToOne(bestVIARoutes[j]);
        }
        return Promise.resolve(bestVIARoutes);
      } catch (error) {
        console.log(error);
        return Promise.resolve([]);
      }
    } else {
      return Promise.resolve([]);
    }
  },

  getPublicTransitRoutes: async function (from, to, departureTime, arrivalTime, allowBicycleSections, userThresholdsForSectionToStation) {
    return new Promise((resolve, reject) => {
      publicTransitRoutesManager.getRoutesFromRoutingServices(from, to, departureTime, arrivalTime, true, userThresholdsForSectionToStation).then((publicTransitRoutes) => {

        // dissovle nested arrays to one array
        var routes = [].concat.apply([], publicTransitRoutes);
        let firstAndLastTransferStops = publicTransitRoutesManager.analyzeRoutesForTransferStops(routes);
        let firstTransferStops = firstAndLastTransferStops.firstTransferStops;

        var possibleOptimizedRoutes = [];
        for (let i = 0; i < firstTransferStops.length; i++) {
          let newFrom = firstTransferStops[i].lat + "," + firstTransferStops[i].lng;
          possibleOptimizedRoutes.push(publicTransitRoutesManager.getPossibleOpimizedRoutes(from, to, newFrom, departureTime, arrivalTime, allowBicycleSections, userThresholdsForSectionToStation));
        }

        Promise.all(possibleOptimizedRoutes).then(results => {
          results = [].concat.apply([], results);
          for (let j = 0; j < results.length; j++) {
            routes.push(results[j]);
          }
          var bestRoutes = publicTransitRoutesManager.determineBestPublicTransitRoutes(routes);
          resolve(bestRoutes);
        }).catch(error => {
          console.log(error);
          var bestRoutes = publicTransitRoutesManager.determineBestPublicTransitRoutes(routes);
          resolve(bestRoutes);
        });
      }).catch((error) => {
        console.log(error);
      });
    });
  },

  getPossibleOpimizedRoutes: async function (from, to, newFrom, departureTime, arrivalTime, allowBicycleSections, userThresholdsForSectionToStation) {
    return new Promise(async (resolve, reject) => {
      var completedPublicTransportRoutes = [];
      publicTransitRouteCompletion.getSectionForCompletionIfNeeded(from, newFrom, allowBicycleSections).then(async sections => {
        let allowedSections = [];
        for (let j = 0; j < sections.length; j++) {
          let currSection = sections[j];
          let sectionDuration = currSection.duration;
          let newDepartureTime;
          if (thresholdController.checkSection(currSection, userThresholdsForSectionToStation)) {
            allowedSections.push(currSection);
            let depTime;
            if (departureTime) {
              depTime = new Date(departureTime);
            } else {
              depTime = new Date();
            }
            // add sectionDuration to departureTime
            depTime.setMinutes(depTime.getMinutes() + sectionDuration);
            newDepartureTime = helper.convertDateObjectToTimeformatForRequest(depTime);
            try {
              var routesForOptimizedRoutes = await publicTransitRoutesManager.getRoutesFromRoutingServices(newFrom, to, newDepartureTime, arrivalTime, false, userThresholdsForSectionToStation);
              for (let k = 0; k < routesForOptimizedRoutes.length; k++) {
                let currRoute = routesForOptimizedRoutes[k];
                let withSectionCombinedRoute = JSON.parse(JSON.stringify(currRoute));    // deep copy route
                withSectionCombinedRoute.sections.unshift(currSection);
                withSectionCombinedRoute.overview.duration += currSection.duration;
                withSectionCombinedRoute.overview.distance += currSection.distance;
                completedPublicTransportRoutes.push(withSectionCombinedRoute);
              }
            } catch (error) {
              console.log(error);
            }
          }
        }
        resolve(completedPublicTransportRoutes);
      }).catch(error => {
        console.log(error);
        resolve([]);
      });
    });
  },

    getRoutesFromRoutingServices: async function (from, to, departureTime, arrivalTime, requestToVmobil, userThresholdsForSectionToStation) {
        return new Promise(async (resolve, reject) => {
            var routingVariant = await publicTransitRoutesManager.determineNeededRoutingVariant(from, to);
            var routingResults = [];
            if (routingVariant == "AT") { // Routing for Austria and Liechtenstein
                routingResults.push(vaoDirections.getDirections(from, to, departureTime, arrivalTime));
            } else if (routingVariant === "CH") {    // Routing for Switzerland
                // convert departureTime to needed timeformat for request to searchCH and google
                let googleDepTtime;
                if (departureTime) {
                    googleDepTtime = helper.convertDateTimeStringToTimeFormatForGoogleRequest(departureTime);
                }
                let googleArrTime;
                if (arrivalTime) {
                    googleArrTtime = helper.convertDateTimeStringToTimeFormatForGoogleRequest(arrivalTime);
                }
                routingResults.push(searchCHDirections.getDirections(from, to, departureTime, arrivalTime));
                routingResults.push(googleDirections.getRouteForSpecificMode(null, from, to, "transit", googleDepTtime, googleArrTime));
            } else if (routingVariant === "AUT_CH") {
                routingResults.push(crossBorder_AUT_CH_Routing.getAustriaToSwitzerlandDirections(from, to, departureTime));
            } else if (routingVariant === "CH_AUT") {
                routingResults.push(crossBorder_CH_AUT_Routing.getSwitzerlandToAustriaDirections(from, to, departureTime));
            }

            else if (routingVariant === "DE") {
                if (await publicTransitRoutesManager.checkIfVAOFindsNearbyStationForGermanLocation(from, userThresholdsForSectionToStation) === true
                    && await publicTransitRoutesManager.checkIfVAOFindsNearbyStationForGermanLocation(to, userThresholdsForSectionToStation) === true) {
                    routingResults.push(vaoDirections.getDirections(from, to, departureTime, arrivalTime));
                }

      } else if (routingVariant === "DE_AUT" || routingVariant === "DE_CH") {
        if (await publicTransitRoutesManager.checkIfVAOFindsNearbyStationForGermanLocation(from, userThresholdsForSectionToStation) === true) {
          if (routingVariant === "DE_AUT") {
            routingResults.push(vaoDirections.getDirections(from, to, departureTime, arrivalTime));
          } else {
            routingResults.push(crossBorder_AUT_CH_Routing.getAustriaToSwitzerlandDirections(from, to, departureTime));
          }
        }

      } else if (routingVariant === "AUT_DE" || routingVariant === "CH_DE") {
        if (await publicTransitRoutesManager.checkIfVAOFindsNearbyStationForGermanLocation(to, userThresholdsForSectionToStation) === true) {
          if (routingVariant === "AUT_DE") {
            routingResults.push(vaoDirections.getDirections(from, to, departureTime, arrivalTime));
          } else {
            routingResults.push(crossBorder_CH_AUT_Routing.getSwitzerlandToAustriaDirections(from, to, departureTime));
          }
        }
      }

      Promise.all(routingResults).then(results => {
        resolve(results);
      }).catch((error) => {
        console.log(error);
        resolve([]);
      });
    });
  },

  determineNeededRoutingVariant: function (from, to) {
    // determine countries of startlocation and endlocation
    var fromxy = from.split(',');
    var toxy = to.split(',');
    return new Promise((resolve, reject) => {
      helper.determineCountryWithGeonamesAPI(fromxy[0], fromxy[1], (error, response, countryCode) => {
        if (error) {
          console.log(error);
          resolve("");
        } else {
          var fromCountry = countryCode;
          helper.determineCountryWithGeonamesAPI(toxy[0], toxy[1], (error, response, countryCode) => {
            if (error) {
              console.log(error);
              resolve("");
            } else {
              var toCountry = countryCode;
              if (fromCountry === toCountry) {
                if (fromCountry === "AT" || fromCountry === "LI") { // Routing for Austria and Liechtenstein
                  resolve("AT");
                } else if (fromCountry === "CH") {    // Routing for Switzerland
                  resolve("CH");
                } else if (fromCountry === "DE") {
                  resolve("DE");
                } else {
                  resolve("");
                }
              } else if ((fromCountry === "LI" && toCountry === "AT") || (fromCountry === "AT" && toCountry === "LI")) {
                resolve("AT");
              } else {
                //crossborder Routing
                if ((fromCountry === "AT" || fromCountry === "LI") && toCountry === "CH") {
                  resolve("AUT_CH");
                } else if (fromCountry === "CH" && (toCountry === "AT" || toCountry === "LI")) {
                  resolve("CH_AUT");
                } else if (fromCountry === "DE" && (toCountry === "AT" || toCountry === "LI")) {
                  resolve("DE_AUT");
                } else if ((fromCountry === "AT" || fromCountry === "LI") && toCountry === "DE") {
                  resolve("AUT_DE");
                } else if (fromCountry === "DE" && toCountry === "CH") {
                  resolve("DE_CH");
                } else if (fromCountry === "CH" && toCountry === "DE") {
                  resolve("CH_DE");
                } else {
                  resolve("");
                }
              }
            }
          });
        }
      });
    });
  },

  analyzeRoutesForTransferStops: function (routes) {
    let firstTransferStops = [];
    let lastTransferStops = [];
    for (let i = 0; i < routes.length; i++) {
      let currentRoute = routes[i];
      var result = publicTransitRoutesManager.findFirstAndLastTransferStop(currentRoute.sections);
      if (result.firstTransferStop) {
        if (result.firstTransferStop.name === result.lastTransferStop.name && result.firstTransferStop.lat === result.lastTransferStop.lat) {

          if (firstTransferStops.filter(firstTransferStop => (firstTransferStop.name === result.firstTransferStop.name)).length === 0) {
            firstTransferStops.push(result.firstTransferStop);
          }
        } else {

          if (firstTransferStops.filter(firstTransferStop => (firstTransferStop.name === result.firstTransferStop.name)).length === 0) {
            firstTransferStops.push(result.firstTransferStop);
          }
          if (lastTransferStops.filter(lastTransferStop => (lastTransferStop.name === result.lastTransferStop.name)).length === 0) {
            lastTransferStops.push(result.lastTransferStop);
          }
        }
      }
    }
    var result = {
      firstTransferStops: firstTransferStops,
      lastTransferStops: lastTransferStops
    };
    return result;
  },

  findFirstAndLastTransferStop: function (sections) {
    let lastTransportationSection = null;
    let firstStation = null;
    let firstTransferStop = null;
    let lastStation = null;
    let lastTransferStop = null;
    for (let i = 0; i < sections.length; i++) {
      let section = sections[i];
      if (firstStation === null) {
        if (section.type !== "walking") {
          firstStation = section.from;
          lastTransportationSection = section;
        }
      } else {
        if (section.type !== "walking") {
          if (firstTransferStop === null) {
            // found first transferStop
            firstTransferStop = section.from;
          }
          lastTransportationSection = section;
        }
      }
    }

    if (lastTransportationSection) {
      lastStation = lastTransportationSection.to;
      lastTransferStop = lastTransportationSection.from;
    }

    var result = {
      firstTransferStop: firstTransferStop,
      lastTransferStop: lastTransferStop,
      firstStation: firstStation,
      lastStation: lastStation
    };

    return result;
  },

  /**
   * returns the best 3 routes
   * @param {*} routes
   */
  determineBestPublicTransitRoutes: function (routes) {
    var bestThreeRoutes = [];

    if (routes && routes.constructor === Array) {
      var filteredRoutes = publicTransitRoutesManager.eliminateDuplicateRoutes(routes);
      // sort ascending by arrivalTime at the destination
      // then by duration and then by amount of transfers
      // arrivaltime -> duration -> transfer
      filteredRoutes.sort((r1, r2) => {
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

      if (filteredRoutes.length >= 3) {
        bestThreeRoutes = filteredRoutes.slice(0, 3);
      } else {
        bestThreeRoutes = filteredRoutes;
      }

      return bestThreeRoutes;
    }
    return routes;
  },

  combineRouteWithRoutes: function (route, routesToCombine, userThresholdsForSectionToStation) {
    var allCombinedRoutes = [];
    for (var i = 0; i < routesToCombine.length; i++) {
      var currRoute = routesToCombine[i];

      // check, if arrival time is before departure time of the second route
      // check waiting time between arrival at last section of route and departre of first section of the combining route
      if (this.checkTimeDiffereneceOfCombiningRoutes(route, currRoute, userThresholdsForSectionToStation)) {
        var newCombinedRoute = JSON.parse(JSON.stringify(route));    // deep copy route

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

  checkTimeDiffereneceOfCombiningRoutes(origRoute, combiningRoute, userThresholdsForSectionToStation) {
    var realArrTime = publicTransitRoutesManager.calculateArrTimeWithRegardToWalkBicycleSection(origRoute);
    var realDepTime = publicTransitRoutesManager.calculateDepTimeWithRegardToWalkBicyleSection(combiningRoute);
    var difference = helper.calculateTimeDifference(realArrTime, realDepTime);
    if (difference >= 0 && difference <= userThresholdsForSectionToStation.waitingTimeThreshold) {
      return true;
    }
    return false;
  },

  calculateDepTimeWithRegardToWalkBicyleSection: function (route) {
    let routeSections = route.sections;
    if (routeSections[0].departureTime) {
      return routeSections[0].departureTime;
    } else {
      let timeToStation = 0;
      for (let i = 0; i < routeSections.length; i++) {
        var currSection = routeSections[i];
        if (currSection.departureTime) {
          var dateTime = new Date(currSection.departureTime);
          dateTime.setMinutes(dateTime.getMinutes() - timeToStation);
          return helper.convertDateObjectToTimeformatForRequest(dateTime);
        } else {
          timeToStation += currSection.duration;
        }
      }
    }
  },

  calculateArrTimeWithRegardToWalkBicycleSection: function (route) {
    let routeSections = route.sections;
    let routeSectionsLength = route.sections.length;
    if (routeSections[routeSectionsLength - 1].arrivalTime) {
      return routeSections[routeSectionsLength - 1].arrivalTime;
    } else {
      let timeToDestination = 0;
      for (let i = routeSectionsLength - 1; i >= 0; i--) {
        var currSection = routeSections[i];
        if (currSection.arrivalTime) {
          var dateTime = new Date(currSection.departureTime);
          dateTime.setMinutes(dateTime.getMinutes() + timeToDestination);
          return helper.convertDateObjectToTimeformatForRequest(dateTime);
        } else {
          timeToDestination += currSection.duration;
        }
      }
    }
  },

  checkIfVAOFindsNearbyStationForGermanLocation: async function (locationCoordinates, userThresholdsForSectionToStation) {
    try {
      var station = await vaoDirections.getStationToCoordinates(locationCoordinates);
      if (station.distance < (userThresholdsForSectionToStation.footToStationThreshold * 1000)) {
        return true;
      }
    } catch (ex) {
      console.log(ex);
      return false;
    }
  },

  eliminateDuplicateRoutes: function (routes) {
    var filteredRoutes = [];
    var publicTransportRouteSections = [];
    routes.forEach(currRoute => {
      var currPublicTransportSections = publicTransitRoutesManager.extractAllPublicTransportSections(currRoute.sections);
      if (publicTransportRouteSections.length === 0 || !publicTransitRoutesManager.containsSamePublicTransportSections(publicTransportRouteSections, currPublicTransportSections)) {
        publicTransportRouteSections.push(currPublicTransportSections);
        filteredRoutes.push(currRoute);
      }
    });
    return filteredRoutes;
  },

  extractAllPublicTransportSections: function (sections) {
    onlyPublicTransportSections = sections.filter(currSection => currSection.type == "bus" || currSection.type == "train");
    return onlyPublicTransportSections;
  },

  containsSamePublicTransportSections: function (publicTransportSectionsArray, publicTransportSections) {
    for (var i = 0; i < publicTransportSectionsArray.length; i++) {
      var currPublicTransportSections = publicTransportSectionsArray[i];
      if (currPublicTransportSections.length != publicTransportSections.length) {
        return false;
      }
      // iterate over each public transport section and check if they are the same (same type (bus or train) and same arrival and departuer time)
      for (var j = 0; j < currPublicTransportSections.length; j++) {
        var currSection = currPublicTransportSections[j];
        var currSectionToCheck = publicTransportSections[j];
        if (currSection.type !== currSectionToCheck.type
          || currSection.departureTime !== currSectionToCheck.departureTime
          || currSection.arrivalTime !== currSectionToCheck.arrivalTime) {
          return false;
        }
      }
    }
    return true;
  },

  combineConsecutiveFootOrBicycleSectionsToOne: function (route) {
    var lastSectionType = "";
    let routeSections = route.sections;
    var revisedRouteSections = [];
    for (var i = 0; i < routeSections.length; i++) {
      var currentSection = routeSections[i];
      var sectionType = currentSection.type;
      if ((sectionType === "walking" || sectionType === "bicycling") && lastSectionType === currentSection.type) {
        var previousSection = routeSections[i - 1];
        previousSection.to = currentSection.to;
        previousSection.duration += currentSection.duration;
        previousSection.distance += currentSection.distance;
        if (previousSection.points) {
          previousSection.points.push.apply(previousSection.points, currentSection.points);
        } else {
          previousSection.points = currentSection.points;
        }
        previousSection.pointsString = helper.convertRoutePointsToPolyline(previousSection.points);
      } else {
        revisedRouteSections.push(currentSection);
      }
      lastSectionType = sectionType;
    }
    route.sections = revisedRouteSections;
  }

};
module.exports = publicTransitRoutesManager;
