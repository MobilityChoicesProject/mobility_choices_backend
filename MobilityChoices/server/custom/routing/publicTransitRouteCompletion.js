let helper = require('../helper.js');
let google_routing = require('./google_routing.js');

let publicTransitRouteCompletion = {

  completeRouteWithWalkSections: function (route) {
    return new Promise((resolve, reject) => {
      var routePromises = [];
      if (route.overview.fromStation.distanceToStart >= 200) {  // if startlocation is more than 200 meters away, add a walking route from start to station
        var from = route.overview.from;
        var stationFrom = route.overview.fromStation.lat + ',' + route.overview.fromStation.lng;
        routePromises.push(publicTransitRouteCompletion.completeFirst_LastRoutePart(route, from, stationFrom, "walking", true));
      }
      if (route.overview.toStation.distanceToDestination >= 200) {    // if endlocation is more than 200 meters away, add a walking route from station to end
        var to = route.overview.to;
        var stationTo = route.overview.toStation.lat + ',' + route.overview.toStation.lng;
        routePromises.push(publicTransitRouteCompletion.completeFirst_LastRoutePart(route, stationTo, to, "walking", false));
      }
      if (routePromises.length > 0) {
        Promise.all(routePromises).then((routes) => {
          resolve(routes[0]);
        }).catch((err) => {
          console.log(err);
          resolve(route); //original route gets resolved, it's better if a route without any changes gets resolved than no route
        });
      } else {
        // adding of walking sections was not necessary => original route is resolved
        resolve(route);
      }
    });
  },

  getSectionForCompletionIfNeeded: function (from, to, bicycleSectionAllowed) {
    return new Promise((resolve, reject) => {
      var fromSplitted = from.split(",");
      var toSplitted = to.split(",");
      var sectionPromises = [];
      let roughDistance = helper.getDistanceFromLatLonInKm(fromSplitted[0], fromSplitted[1], toSplitted[0], toSplitted[1]);
      if (roughDistance >= 0.2) {  // if from is more than 200 meters away, search for a walking route
        sectionPromises.push(publicTransitRouteCompletion.getSectionForMode(from, to, "walking"));
        if (roughDistance >= 0.8 && bicycleSectionAllowed) {
          // bicycle section
          sectionPromises.push(publicTransitRouteCompletion.getSectionForMode(from, to, "bicycling"));
        }
      }

      if (sectionPromises.length > 0) {
        Promise.all(sectionPromises).then((sections) => {
          resolve(sections);
        }).catch((err) => {
          console.log(err);
          resolve(null);
        });
      } else {
        resolve(null);  // no completion needed
      }
    });
  },

  /**
   * determines a walking section between from and to and adds this section to the route,
   * also updates the duration and distance of the route.
   * Used to add a walking section from the start point to the first station of the route
   * or to add a walking section from the last station of the route to the desired destination
   */
  completeFirst_LastRoutePart: function (route, from, to, mode, firstPart) {
    return new Promise(function (resolve, reject) {
      if (mode !== "walking" && mode !== "bicycling") {
        mode = "walking";   // default mode is walking
      }
      publicTransitRouteCompletion.getSectionForMode(from, to, mode).then((section) => {
        var routeSections = route.sections;
        if (firstPart) {    // received section is from start to first station
          if (routeSections[0].type === mode) {
            var revisedSection = publicTransitRouteCompletion.combineSectionsToOneSection(section, routeSections[0]);
            routeSections.shift();      // delete actual first section
            routeSections.unshift(revisedSection);      // replace it with new combined section
          } else {
            routeSections.unshift(section);    // add sections at the beginning of the sections array
          }
        } else {
          if (routeSections[routeSections.length - 1].type === mode) {
            var revisedSection = publicTransitRouteCompletion.combineSectionsToOneSection(routeSections.pop(), section);
            routeSections.push(revisedSection);
          } else {
            routeSections.push(section);
          }
        }
        route.overview.duration += section.duration;
        route.overview.distance += section.distance;
        route.complete = true;
        resolve(route);
      }).catch((error) => {
        console.log(error);
        resolve(route);
      });
    })
  },

  getSectionForMode: function (from, to, mode) {
    return new Promise((resolve, reject) => {
      google_routing.getRouteForSpecificMode(null, from, to, null, mode).then(route => {
        let routeSections = route[0].sections;
        if (routeSections.length !== 0) {
          let section = null;
          if (routeSections.length === 1) {
            section = routeSections[0];
          } else {
            section = {
              type: mode,
              name: mode,
              apiName: "googlemaps",
              from: routeSections[0],
              to: routeSections[routeSections.length - 1],
              duration: route.overview.duration,
              distance: route.overview.distance
            };

            var sectionPoints = [];
            var points = [];
            for (let i = 0; i < routeSections.length; i++) {
              let currSectionPoints = routeSections[i].points;
              for (let j = 0; j < currSectionPoints.length; j++) {
                let currentSectionPoint = currentSectionPoints[j];
                sectionPoints.push(currentSectionPoint);
                points.push([currentSectionPoint.latitude, currentSectionPoint.longitude]);
              }
            }

            section.points = sectionPoints;
            section.pointsString = helper.encode(points);
          }
          resolve(section);
        }
      }).catch(error => {
        console.log(error);
        reject(error.message);
      });
    });
  },

  combineSectionsToOneSection: function (section1, section2) {
    section1.to = section2.to;
    section1.duration += section2.duration;
    section1.distance += section2.distance;
    section1.points.concat(section2.points);
    section1.pointsString = helper.convertRoutePointsToPolyline(section1.points);
    return section1;
  }

};
module.exports = publicTransitRouteCompletion;
