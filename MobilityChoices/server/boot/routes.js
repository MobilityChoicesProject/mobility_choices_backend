var directions = require('../custom/directions');
var tmd = require('../custom/tmd');
var anonymization = require('../custom/anonymization');
var tracksplitter = require('../custom/tracksplitter');
var requestCounter = require('../custom/api_requests_counter');
var trackEvaluation = require('../custom/evaluation/evaluateTrack');
var usergroups = require('../custom/usergroupsHandler');
var firebase = require('../custom/firebase');

module.exports = function (app) {
  var router = app.loopback.Router();
  router.get('/api/directions', function (req, res) {
    // Query routes
    directions.getDirection(req, res);
  });
  router.post('/api/tmd', function (req, res) {
    // Send Track to TMD
    tmd.getTMD(req, res);
  });
  router.get('/api/requestCounts', (req, res) => {
    requestCounter.getRequestCounts(req, res);
  });
  router.post('/api/tmd/merge', function (req, res) {
    tmd.merge(req, res);
  });
  //Added for TMD Queue
  router.post('/api/tmd/queueresponse', function (req, res) {
    tmd.processTMDResponse(req, res);
  });
  router.post('/api/tracksplitter', function (req, res) {
    tracksplitter.loadTrack(req, res);
  });
  router.get('/api/getUsergroups', function (req, res) {
    usergroups.getUsergroups(req, res);
  });
  router.post('/api/updateUsergroups', function (req, res) {
    usergroups.updateUsergroup(req, res);
  });
  router.post('/api/publish', function (req, res) {
    tmd.publish(req, res);
  });
  router.post('/api/editTrack', function (req, res) {
    tmd.saveChangesOnDB(req, res);
  });
  router.post('/api/deleteTrack', function (req, res) {
    tmd.deleteTrack(req, res);
  });
  router.post('/api/saveFirebaseToken', function (req,res) {
    firebase.saveFirebaseToken(req,res);
  });
  router.post('/api/sendFirebaseMessage', function (req, res) {
    firebase.sendFirebaseMessage(req,res);
  });
  router.post('/api/checkTracks', function (req, res) {
    tmd.checkTracks(req, res);
  });
  app.use(router);

  app.get('/verified', function (req, res) {
    res.render('verified.ejs');
  });
};
