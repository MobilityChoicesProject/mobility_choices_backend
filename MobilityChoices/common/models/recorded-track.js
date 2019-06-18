'use strict';

module.exports = function (Recordedtrack) {
  //Custom methods
  Recordedtrack.disableRemoteMethodByName("__get__mobilityUser");
  Recordedtrack.disableRemoteMethodByName("__findById__trackdata");
  Recordedtrack.disableRemoteMethodByName("__destroyById__trackdata");
  Recordedtrack.disableRemoteMethodByName("__updateById__trackdata");
  Recordedtrack.disableRemoteMethodByName("__get__trackdata");
  Recordedtrack.disableRemoteMethodByName("__create__trackdata");
  Recordedtrack.disableRemoteMethodByName("__delete__trackdata");
  Recordedtrack.disableRemoteMethodByName("__count__trackdata");
  Recordedtrack.disableRemoteMethodByName("create");
  Recordedtrack.disableRemoteMethodByName("patchOrCreate");
  Recordedtrack.disableRemoteMethodByName("replaceOrCreate");
  Recordedtrack.disableRemoteMethodByName("upsertWithWhere");
  Recordedtrack.disableRemoteMethodByName("exists");
  Recordedtrack.disableRemoteMethodByName("findById");
  Recordedtrack.disableRemoteMethodByName("replaceById");
  Recordedtrack.disableRemoteMethodByName("find");
  Recordedtrack.disableRemoteMethodByName("findOne");
  Recordedtrack.disableRemoteMethodByName("updateAll");
  Recordedtrack.disableRemoteMethodByName("deleteById");
  Recordedtrack.disableRemoteMethodByName("count");
  Recordedtrack.disableRemoteMethodByName("patchAttributes");
  Recordedtrack.disableRemoteMethodByName("createChangeStream");
};
