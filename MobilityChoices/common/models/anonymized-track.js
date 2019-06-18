'use strict';

module.exports = function(AnonymizedTrack) {

  AnonymizedTrack.disableRemoteMethodByName("create");
  AnonymizedTrack.disableRemoteMethodByName("patchOrCreate");
  AnonymizedTrack.disableRemoteMethodByName("replaceOrCreate");
  AnonymizedTrack.disableRemoteMethodByName("upsertWithWhere");
  AnonymizedTrack.disableRemoteMethodByName("exists");
  AnonymizedTrack.disableRemoteMethodByName("findById");
  AnonymizedTrack.disableRemoteMethodByName("find");
  AnonymizedTrack.disableRemoteMethodByName("replaceById");
  AnonymizedTrack.disableRemoteMethodByName("findOne");
  AnonymizedTrack.disableRemoteMethodByName("updateAll");
  AnonymizedTrack.disableRemoteMethodByName("deleteById");
  AnonymizedTrack.disableRemoteMethodByName("count");
  AnonymizedTrack.disableRemoteMethodByName("patchAttributes");
  AnonymizedTrack.disableRemoteMethodByName("createChangeStream");
};
