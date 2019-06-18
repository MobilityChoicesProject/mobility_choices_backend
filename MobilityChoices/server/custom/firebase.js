var keyHelper = require('../keyHelper.js');
var app = require('../server.js');
var authreq = require('./authreq');
var FCM = require('fcm-push');

firebase = {
  saveFirebaseToken: function (req, res) {
    authreq.waitForAuth(req, res).then(function (user) {
      var cleanedUser = JSON.parse(JSON.stringify(user));
      if (cleanedUser.firebaseToken == null || cleanedUser.firebaseToken != req.body.firebaseToken) {
        app.models.MobilityUser.findById(cleanedUser.id, function (err, user) {
          user.updateAttribute("firebaseToken", req.body.firebaseToken,
            function (error, data) {
              if (error) {
                console.error(error);
                res.send({
                  error: error,
                  status: "Error",
                  notify: true
                });
              } else {
                res.send({
                  error: "",
                  status: "ok",
                  notify: true
                });
              }
            });
        });
      } else {
        res.send({
          error: "",
          status: "ok",
          notify: true
        });
      }
    });
  },

  sendFirebaseMessage: function (req, res) {

    var userMails = req.body.userMails;
    var verifyToken = req.body.verifyToken;
    var title = req.body.title;
    var message = req.body.message;
    var serverKey = keyHelper.getFirebaseKey();
    var fcm = new FCM(serverKey);
    app.models.AnalyseUser.find({where: {id: verifyToken}}, function (err, user) {
      if (user[0].username != undefined) {
        userMails.forEach(function (entry) {
          app.models.MobilityUser.find({where: {email: entry}}, function (err, mobilityuser) {
            if (mobilityuser[0].firebaseToken != null) {
              var firebaseMessage = {
                to: mobilityuser[0].firebaseToken,
                data: {},
                notification: {
                  title: title,
                  body: message
                }
              };
              fcm.send(firebaseMessage).then(function (response) {
              }).catch(function (err) {
                console.error(err);
              });
            }
          });
        });
        res.send({
          error: false,
          status: "ok",
        });
      } else {
        res.status(400).send({
          error: true,
          errorMessage: "Es wurde kein User gefunden."
        })
      }
    });
  }
}
;
module.exports = firebase;

