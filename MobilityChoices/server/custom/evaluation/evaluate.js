evaluation = {

  static: {
    environment: {
      max: Number.MIN_VALUE,
      min: Number.MAX_VALUE,
      pointsPerType: {
        "ebike": 0.028,
        "bus": 0.755,
        "train": 0.293,
        "car": 2.388,
        "motorbike": 1.346,
        "ecar": 0.383,
        "walking": 0,
        "bicycling": 0
      }
    },
    health: {
      max: Number.MIN_VALUE,
      min: Number.MAX_VALUE,
      pointsPerType: {
        "ebike": 1.5,
        "bus": 0,
        "train": 0,
        "car": 0,
        "motorbike": 0,
        "ecar": 0,
        "walking": 1,
        "bicycling": 2
      }
    },
    costs: {
      max: Number.MIN_VALUE,
      min: Number.MAX_VALUE,
      pointsPerType: {
        default: {
          "ebike": 0,
          "bus": 0.15,
          "train": 0.15,
          "car": 0.45,
          "motorbike": 0.28,
          "ecar": 0.45,
          "walking": 0,
          "bicycling": 0
        },
        germany: {
          "ebike": 0,
          "bus": 0.15,
          "train": 0.15,
          "car": 0.3,
          "motorbike": 0.2,
          "ecar": 0.3,
          "walking": 0,
          "bicycling": 0
        },
        austria: {
          "ebike": 0,
          "bus": 0.1,
          "train": 0.1,
          "car": 0.42,
          "motorbike": 0.24,
          "ecar": 0.42,
          "walking": 0,
          "bicycling": 0
        },
        switzerland: {
          "ebike": 0,
          "bus": 0.2,
          "train": 0.2,
          "car": 0.64,
          "motorbike": 0.28,
          "ecar": 0.64,
          "walking": 0,
          "bicycling": 0
        }
      }
    },
    time: {
      max: Number.MIN_VALUE,
      min: Number.MAX_VALUE
    }
  },

  evaluate: function (routes, userprefs, country) {
    // refresch min and max values of the preference criterions
    evaluation.static.environment.max = Number.MIN_VALUE;
    evaluation.static.environment.min = Number.MAX_VALUE;
    evaluation.static.health.max = Number.MIN_VALUE;
    evaluation.static.health.min = Number.MAX_VALUE;
    evaluation.static.costs.max = Number.MIN_VALUE;
    evaluation.static.costs.min = Number.MAX_VALUE;
    evaluation.static.time.max = Number.MIN_VALUE;
    evaluation.static.time.min = Number.MAX_VALUE;

    var evaluatedRoutes = [];

    for (var i = 0; i < routes.length; i++) {
      var currentRoute = routes[i];
      if (currentRoute) {
        currentRoute["evaluation"] = evaluation.evaluateRoute(currentRoute, userprefs, country);
        evaluatedRoutes.push(currentRoute);
      }
    }

    // calculate relative Values
    for (var i = 0; i < routes.length; i++) {
      var currentRoute = routes[i];
      if (currentRoute) {
        evaluation.calculateRelativeRouteValues(currentRoute, userprefs);

      }
    }

    return evaluatedRoutes;
  },

  evaluateRoute: function (route, userprefs, country) {
    if (route) {
      // Environment
      var routeEnvironmentValue = evaluation.evaluateEnvironment(route);
      if (routeEnvironmentValue > evaluation.static.environment.max) {
        evaluation.static.environment.max = routeEnvironmentValue;
      }
      if (routeEnvironmentValue < evaluation.static.environment.min) {
        evaluation.static.environment.min = routeEnvironmentValue;
      }

      // Health
      var routeHealthValue = evaluation.evaluateHealth(route);
      if (routeHealthValue > evaluation.static.health.max) {
        evaluation.static.health.max = routeHealthValue;
      }
      if (routeHealthValue < evaluation.static.health.min) {
        evaluation.static.health.min = routeHealthValue;
      }

      // Time
      var routeTimeValue = evaluation.evaluateJourneyTime(route);
      if (routeTimeValue > evaluation.static.time.max) {
        evaluation.static.time.max = routeTimeValue;
      }
      if (routeTimeValue < evaluation.static.time.min) {
        evaluation.static.time.min = routeTimeValue;
      }

      // Costs
      var routeCostValue = evaluation.evaluateCost(route, country);
      if (routeCostValue > evaluation.static.costs.max) {
        var routeCostValue = evaluation.evaluateCost(route, country);
        evaluation.static.costs.max = routeCostValue;
      }
      if (routeCostValue < evaluation.static.costs.min) {
        evaluation.static.costs.min = routeCostValue;
      }

      var eval = {
        values: {
          enviroment: routeEnvironmentValue,
          health: routeHealthValue,
          time: routeTimeValue,
          costs: routeCostValue
        }
      };
      return eval;
    }
    return {};
  },

  calculateRelativeRouteValues: function (route, userprefs) {
    var sum = userprefs.health + userprefs.costs + userprefs.time + userprefs.enviroment;
    var weightedUserPrefs = {
      enviroment: userprefs.enviroment / sum,
      health: userprefs.health / sum,
      costs: userprefs.costs / sum,
      time: userprefs.time / sum
    };

    var relativeEnvironmentValue = (evaluation.static.environment.max - route.evaluation.values.enviroment)
      / (evaluation.static.environment.max - evaluation.static.environment.min);
    var relativeHealthValue = (route.evaluation.values.health - evaluation.static.health.min)
      / (evaluation.static.health.max - evaluation.static.health.min);
    var relativeTimeValue = (evaluation.static.time.max - route.evaluation.values.time)
      / (evaluation.static.time.max - evaluation.static.time.min);
    var relativeCostValue = (evaluation.static.costs.max - route.evaluation.values.costs)
      / (evaluation.static.costs.max - evaluation.static.costs.min);

    var routeTotal = (weightedUserPrefs.enviroment * relativeEnvironmentValue)
      + (weightedUserPrefs.health * relativeHealthValue)
      + (weightedUserPrefs.time * relativeTimeValue)
      + (weightedUserPrefs.costs * relativeCostValue);

    route.evaluation["totalscore"] = routeTotal;
    route.evaluation["detailscore"] = {
      enviroment: relativeEnvironmentValue,
      health: relativeHealthValue,
      time: relativeTimeValue,
      costs: relativeCostValue
    };
    // determine iconColor
    route.evaluation["iconcolor"] = {
      enviroment: evaluation.iconColor(relativeEnvironmentValue),
      health: evaluation.iconColor(relativeHealthValue),
      time: evaluation.iconColor(relativeTimeValue),
      costs: evaluation.iconColor(relativeCostValue)
    }
  },

  iconColor: function (score) {
    if (score > 0.7) {
      return 'green';
    } else if (score > 0.3) {
      return 'yellow'
    }
    return 'red';
  },

  evaluateEnvironment: function (route) {
    var environmentPoints = 0;
    for (var i = 0; i < route.sections.length; i++) {
      var section = route.sections[i];
      var sectionType = this.determineSectionTypeForEvaluation(section);
      environmentPoints += section.distance * evaluation.static.environment.pointsPerType[sectionType];
    }
    return environmentPoints;
  },

  evaluateHealth: function (route) {
    var healthPoints = 0;
    for (var i = 0; i < route.sections.length; i++) {
      var section = route.sections[i];
      var sectionType = this.determineSectionTypeForEvaluation(section);
      healthPoints += section.distance * evaluation.static.health.pointsPerType[sectionType];
    }
    return healthPoints;
  },

  evaluateJourneyTime: function (route) {
    return route.overview.duration;
  },

  evaluateCost: function (route, userCountry) {
    var costsInEur = 0;
    for (var i = 0; i < route.sections.length; i++) {
      var section = route.sections[i];
      var sectionType = this.determineSectionTypeForEvaluation(section);
      if (sectionType === "bus" || sectionType === "train") {
        var sectionCountry = section.country;
        if (sectionCountry) {
          if (sectionCountry == "AUT") {
            costsInEur += section.distance * evaluation.static.costs.pointsPerType.austria[sectionType];
          } else if (sectionCountry === "DE") {
            costsInEur += section.distance * evaluation.static.costs.pointsPerType.germany[sectionType];
          } else if (sectionCountry === "CHE" || sectionCountry === "FL") {
            costsInEur += section.distance * evaluation.static.costs.pointsPerType.switzerland[sectionType];
          } else {
            costsInEur += section.distance * evaluation.static.costs.pointsPerType.default[sectionType];
          }
        } else {
          costsInEur += section.distance * evaluation.static.costs.pointsPerType.default[sectionType];
        }
      } else if (userCountry) {
        if (userCountry === "AT") {
          costsInEur += section.distance * evaluation.static.costs.pointsPerType.austria[sectionType];
        } else if (userCountry === "CH" || userCountry === "FL") {
          costsInEur += section.distance * evaluation.static.costs.pointsPerType.germany[sectionType];
        } else if (userCountry === "DE") {
          costsInEur += section.distance * evaluation.static.costs.pointsPerType.germany[sectionType];
        } else {
          costsInEur += section.distance * evaluation.static.costs.pointsPerType.default[sectionType];
        }
      } else {
        costsInEur += section.distance * evaluation.static.costs.pointsPerType.default[sectionType];
      }
    }
    return costsInEur;
  },

  determineSectionTypeForEvaluation: function (section) {
    var sectionType = section.type;
    if (sectionType === "driving") {    // just type "driving" differs from needed designation for the evaluation
      return "car";
    } else {
      return sectionType;
    }
  }
};

module.exports = evaluation;
