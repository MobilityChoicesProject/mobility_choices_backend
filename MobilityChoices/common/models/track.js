'use strict';

module.exports = function (Track) {
  //Custom methods
  Track.disableRemoteMethodByName("create");
  Track.disableRemoteMethodByName("patchOrCreate");
  Track.disableRemoteMethodByName("replaceOrCreate");
  Track.disableRemoteMethodByName("upsertWithWhere");
  Track.disableRemoteMethodByName("exists");
  Track.disableRemoteMethodByName("findById");
  Track.disableRemoteMethodByName("replaceById");
  Track.disableRemoteMethodByName("find");
  Track.disableRemoteMethodByName("findOne");
  Track.disableRemoteMethodByName("updateAll");
  Track.disableRemoteMethodByName("deleteById");
  Track.disableRemoteMethodByName("count");
  Track.disableRemoteMethodByName("patchAttributes");
  Track.disableRemoteMethodByName("createChangeStream");
};
