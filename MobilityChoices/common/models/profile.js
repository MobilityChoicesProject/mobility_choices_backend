'use strict';

module.exports = function (Profile) {
  //Custom methods
  Profile.disableRemoteMethodByName("create");
  Profile.disableRemoteMethodByName("patchOrCreate");
  Profile.disableRemoteMethodByName("replaceOrCreate");
  Profile.disableRemoteMethodByName("upsertWithWhere");
  Profile.disableRemoteMethodByName("exists");
  Profile.disableRemoteMethodByName("findById");
  Profile.disableRemoteMethodByName("replaceById");
  Profile.disableRemoteMethodByName("find");
  Profile.disableRemoteMethodByName("findOne");
  Profile.disableRemoteMethodByName("updateAll");
  Profile.disableRemoteMethodByName("deleteById");
  Profile.disableRemoteMethodByName("count");
  Profile.disableRemoteMethodByName("patchAttributes");
  Profile.disableRemoteMethodByName("createChangeStream");
};
