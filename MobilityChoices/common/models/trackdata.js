'use strict';

module.exports = function (Trackdata) {

  //Custom methods
  Trackdata.disableRemoteMethodByName("__get__recordedTrack");
  Trackdata.disableRemoteMethodByName("create");
  Trackdata.disableRemoteMethodByName("patchOrCreate");
  Trackdata.disableRemoteMethodByName("replaceOrCreate");
  Trackdata.disableRemoteMethodByName("upsertWithWhere");
  Trackdata.disableRemoteMethodByName("exists");
  Trackdata.disableRemoteMethodByName("findById");
  Trackdata.disableRemoteMethodByName("replaceById");
  Trackdata.disableRemoteMethodByName("find");
  Trackdata.disableRemoteMethodByName("findOne");
  Trackdata.disableRemoteMethodByName("updateAll");
  Trackdata.disableRemoteMethodByName("deleteById");
  Trackdata.disableRemoteMethodByName("count");
  Trackdata.disableRemoteMethodByName("patchAttributes");
  Trackdata.disableRemoteMethodByName("createChangeStream");
};
