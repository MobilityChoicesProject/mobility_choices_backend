module.exports = {
  shortenLocation(track) {
    var sections = track.sections;

    for (var i in sections) {
      var section = sections[i];

      if (section.start) {
        section.start.name = this.__simplifyLocation(section.start.name);
      }

      if (section.end) {
        section.end.name = this.__simplifyLocation(section.end.name);
      }
    }
  },
  __simplifyLocation(location) {
    if (location) {
      var divider = ', ';
      var i = location.indexOf(divider);

      if (i >= 0) {
        // find the postal code and remove it
        for (var n = i + divider.length; n < location.length && this.__isNumeric(location.charAt(n)); n++) ;

        if (n > i + divider.length) {
          location = location.slice(0, i + divider.length) + location.slice(n + 1, location.length);
        }

        // find the country and remove it
        i = location.indexOf(divider, i + 1);

        if (i >= 0) {
          location = location.slice(0, i);
        }

        return location;
      }
    }

    return null;
  },
  __isNumeric(str) {
    return /^\d+$/.test(str);
  }
};
