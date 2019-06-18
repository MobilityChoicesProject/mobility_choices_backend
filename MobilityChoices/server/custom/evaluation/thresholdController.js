var helper = require('../helper.js');

module.exports = {

  // default thresholds
  thresholds: {
    distance: {
      foot: {
        maxSegment: 3, // km
        max: 5  // km
      },
      bicycle: {
        maxSegment: 7,  // km
        max: 12   // km
      },
      eBike: {
        maxSegment: 20, // km
        max: 28     // km
      },
      ecar: {
        maxSegment: 800,    // km
        max: 800  // km
      }
    },
    transfer: {
      max: 5,
      maxCrossborder: 10
    },
    waitingTimes: {
      max: 30, //minutes
      maxCrossborder: 70,
      minTransferTimeSameStation: 2
    }
  },

  /**
   * Checks whether the values of a route conform to the default thresholds.
   * If this is the case, true is returned, otherwise false.
   */
  checkRoute: function (route, userProfile) {
    if (route.routeType === "bicycling") {
      if (route.overview.distance < userProfile.bikeThreshold) {
        return true;
      }
    } else if (route.routeType === "driving") {
      return true;

    } else if (route.routeType === "walking") {
      if (route.overview.distance < userProfile.footThreshold) {
        return true;
      }

    } else if (route.routeType === "publicTransit" || route.routeType === "combined") {
      if (route.overview.crossborder === true || route.routeType === "combined") {
        if (route.overview.transfer < this.thresholds.transfer.maxCrossborder) {
          return this.checkRouteWaitingTimes(route, userProfile.waitingTimeThreshold);
        }
      } else if (route.overview.transfer <= userProfile.changeTrainThreshold) {
        return this.checkRouteWaitingTimes(route, userProfile.waitingTimeThreshold);
      }
    }
    return false;
  },

  /**
   * Checks whether the values of a section conform to the user thresholds.
   * If this is the case, true is returned, otherwise false.
   */
  checkSection: function (section, userThresholdsForSectionToStation) {
    if (section.type === "bicycling") {
      if (section.distance < userThresholdsForSectionToStation.bikeToStationThreshold) {
        return true;
      }
    } else if (section.type === "driving") {
      return true;

    } else if (section.type === "walking") {
      if (section.distance < userThresholdsForSectionToStation.footToStationThreshold) {
        return true;
      }

    } else if (section.type === "publicTransit" || section.type === "combined") {
      //there is nothing to check for a publicTransit section
      return true;
    }
    return false;
  },

  /**
   * Calculates for a route the time between switching between two means of transport and adds the calculated transfer time as "transferTime"
   * to the section of the first means of transport.
   * Checks whether the transfer time corresponds to the defined thresholds for the transfer time,
   * if not false is returned and the calculation of further transfer times of this route is aborted.
   * @param {*} route
   */
  checkRouteWaitingTimes(route, userWaitingTimeThreshold) {
    var sections = route.sections;
    var lastTransportationSection = null;
    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      if (section.type !== "walking" && section.type !== "bicycling") {
        if (lastTransportationSection != null) {
          var waitingTime = helper.calculateTimeDifference(lastTransportationSection.arrivalTime, section.departureTime);
          lastTransportationSection.transferTime = waitingTime;
          var sameBusOrTrain = false;
          if (waitingTime == 0) {
            // check if same stationname and same public transport name (=> same bus/ train is used)
            if (lastTransportationSection.to.name !== section.from.name &&
              lastTransportationSection.name !== section.name) {
              return false;
            } else {
              sameBusOrTrain = true;
            }
          }
          if (!sameBusOrTrain) {
            if (route.overview.crossborder === true) {
              if (waitingTime > this.thresholds.waitingTimes.maxCrossborder || waitingTime < this.thresholds.waitingTimes.minTransferTimeSameStation) {
                return false;
              }
            } else if (waitingTime > userWaitingTimeThreshold || waitingTime < this.thresholds.waitingTimes.minTransferTimeSameStation) {
              return false;
            }
          }
        }
        lastTransportationSection = section;
      }
    }
    return true;
  }
};
