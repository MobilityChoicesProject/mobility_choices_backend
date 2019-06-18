var app = require('../server.js');

anonymization = {
  makeAnonymization: function (id) {
    app.models.Track.findById(id, function (error, data) {
      if (error) {

      } else {
        anonymizeTrack(data);
        console.log("Anonymization: Track sucessfully loaded from Database");
      }
    });
  }
};

function anonymizeTrack(track) {
  var serverSections = track.sections;
  var reachedMinimumDistance = hasMinimumDistance(serverSections);

  if (reachedMinimumDistance) {
    var rndMetersStart = getRndInteger(50, 100);
    var index = 0;
    var metersStart = 0;
    var firstSectionCoordinates;
    var latStart = serverSections[0].coordinates[0].lat;
    var lngStart = serverSections[0].coordinates[0].lng;

    //remove coordinates from start
    for (var k = 0; k < serverSections.length && metersStart < rndMetersStart; k++) {
      firstSectionCoordinates = serverSections[k].coordinates;
      for (var i = 1; i < firstSectionCoordinates.length && metersStart < rndMetersStart; i++) {
        metersStart = distanceInKmBetweenEarthCoordinates(latStart, lngStart, firstSectionCoordinates[i].lat, firstSectionCoordinates[i].lng) * 1000;
        index = i;
      }
      firstSectionCoordinates.splice(0, index + 1);
      serverSections[k].coordinates = firstSectionCoordinates;
    }

    //remove coordinates from end
    var rndMetersEnd = getRndInteger(50, 100);
    index = 0;
    var metersEnd = 0;
    var lastSectionCoordinates;
    var coordEnd = serverSections[serverSections.length - 1].coordinates;
    var latEnd = coordEnd[coordEnd.length - 1].lat;
    var lngEnd = coordEnd[coordEnd.length - 1].lng;

    for (var l = serverSections.length - 1; l >= 0 && metersEnd < rndMetersEnd; l--) {
      lastSectionCoordinates = serverSections[l].coordinates;
      for (var j = lastSectionCoordinates.length - 2; j >= 0 && metersEnd < rndMetersEnd; j--) {
        metersEnd = distanceInKmBetweenEarthCoordinates(latEnd, lngEnd, lastSectionCoordinates[j].lat, lastSectionCoordinates[j].lng) * 1000;
        index = j;
      }
      lastSectionCoordinates.splice(index, lastSectionCoordinates.length);
      serverSections[l].coordinates = lastSectionCoordinates;
    }

    console.log("Finished anonymization");

    // reformat coordinates for geo-indexing
    Array.prototype.unique = function () {
      return this.filter(function (value, index, self) {
        return self.indexOf(value) === index;
      })
    };
    var serverSectionsNew = [];
    // for each section
    for (i = 0; i < serverSections.length; i++) {
      var currentSection = serverSections[i];
      var newCoordinates = {
        type: "",
        coordinates: []
      };
      var timestamps = [];
      var transportMode = currentSection.transportMode;
      if (transportMode == "STATIONARY") {
        newCoordinates.type = "Point";
        newCoordinates.coordinates = [currentSection.start.coordinates.lng, currentSection.start.coordinates.lat];
        newCoordinates.json_dump = JSON.stringify(newCoordinates);
      } else {
        newCoordinates.type = "LineString";
        var newCoordsArray = [];
        var coordinates = currentSection.coordinates;
        //for each pair of coordinates
        for (j = 0; j < coordinates.length; j++) {
          var currentPair = [coordinates[j].lng, coordinates[j].lat];
          newCoordsArray[j] = currentPair;
          if (typeof coordinates[j].time !== 'undefined') {
            timestamps[j] = coordinates[j].time;
          }
        }
        // check if there are at least two vertices in linestring
        if (newCoordsArray.unique().length < 2) {
          newCoordinates.type = "Point";
          newCoordinates.coordinates = [currentSection.start.coordinates.lng, currentSection.start.coordinates.lat];
          newCoordinates.json_dump = JSON.stringify(newCoordinates);
        } else {
          newCoordinates.coordinates = newCoordsArray;
          newCoordinates.json_dump = JSON.stringify(newCoordinates);
        }
      }
      //overwrite coordinates & timestamps
      currentSection.coordinates = newCoordinates;
      currentSection.timestamps = timestamps;
      //add current section to new sections
      serverSectionsNew[i] = currentSection;
    }
    console.log("Finished restructuring");


    //store anonymized sections in db
    var anonymizedTrack = {
      sections: serverSectionsNew,
      trackId: track.id,
      reason: track.reason,
      date: track.date.toISOString(),
      mobilityUserId: track.mobilityUserId
    };

    app.models.AnonymizedTrack.create(anonymizedTrack, function (err) {
      if (err) {
        console.log("Failed to store anonymized track to DB.");
      } else {
        console.log("Anonymization: Track successfully stored in DB.")
      }
    });
  } else {
    console.log("Track is too short. Track must be longer than 200m");
  }
}

function hasMinimumDistance(sections) {
  return hasMinDistEnd(sections) && hasMinDistStart(sections);
}

function hasMinDistStart(sections) {
  var latStart = sections[0].coordinates[0].lat;
  var lngStart = sections[0].coordinates[0].lng;
  var coords;
  var metersStart = 0;

  for (var i = 0; i < sections.length; i++) {
    coords = sections[i].coordinates;
    for (var j = 1; j < coords.length; j++) {
      metersStart = distanceInKmBetweenEarthCoordinates(latStart, lngStart, coords[j].lat, coords[j].lng) * 1000;
      if (metersStart > 100) {
        return true;
      }
    }
  }
}

function hasMinDistEnd(sections) {
  var coordEnd = sections[sections.length - 1].coordinates;
  var latEnd = coordEnd[coordEnd.length - 1].lat;
  var lngEnd = coordEnd[coordEnd.length - 1].lng;
  var lastSectionCoordinates;
  var metersEnd;

  for (var l = sections.length - 1; l >= 0; l--) {
    lastSectionCoordinates = sections[l].coordinates;
    for (var j = lastSectionCoordinates.length - 2; j >= 0; j--) {
      metersEnd = distanceInKmBetweenEarthCoordinates(latEnd, lngEnd, lastSectionCoordinates[j].lat, lastSectionCoordinates[j].lng) * 1000;
      if (metersEnd > 100) {
        return true;
      }
    }
  }

  return false;
}

function getRndInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}

function distanceInKmBetweenEarthCoordinates(lat1, lon1, lat2, lon2) {
  var earthRadiusKm = 6371;

  var dLat = degreesToRadians(lat2 - lat1);
  var dLon = degreesToRadians(lon2 - lon1);

  lat1 = degreesToRadians(lat1);
  lat2 = degreesToRadians(lat2);

  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

module.exports = anonymization;
