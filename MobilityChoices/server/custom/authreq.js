var app = require('../server.js');

module.exports = {

  waitForAuth: function (req, res) {
    return new Promise(function (resolve, reject) {
      var token = req.query.access_token;
      var AccessToken = app.models.AccessToken;
      if (token) {
        AccessToken.findForRequest(req, {}, function (err, token) {
          if (err) {
            reject(err);
          } else {
            if (token) {
              var userID = token.userId;
              app.models.MobilityUser.findById(userID, {
                include: ['profile']
              }, function (err, user) {
                if (err) {
                  reject(err);
                } else {
                  resolve(user);
                }
              });
            } else {
              reject(err);
            }
          }
        });
      } else {
        reject({});
      }
    });
  }
};
