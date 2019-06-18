'use strict';

module.exports = function (Device) {
  //Custom methods
  Device.disableRemoteMethodByName("__get__mobilityUser");
  Device.disableRemoteMethodByName("create");
  Device.disableRemoteMethodByName("patchOrCreate");
  Device.disableRemoteMethodByName("replaceOrCreate");
  Device.disableRemoteMethodByName("upsertWithWhere");
  Device.disableRemoteMethodByName("exists");
  Device.disableRemoteMethodByName("findById");
  Device.disableRemoteMethodByName("replaceById");
  Device.disableRemoteMethodByName("find");
  Device.disableRemoteMethodByName("findOne");
  Device.disableRemoteMethodByName("updateAll");
  Device.disableRemoteMethodByName("deleteById");
  Device.disableRemoteMethodByName("count");
  Device.disableRemoteMethodByName("patchAttributes");
  Device.disableRemoteMethodByName("createChangeStream");
};
