'use strict';

module.exports = function (Analyseuser) {
//Custom methods
  Analyseuser.disableRemoteMethodByName("create");
  Analyseuser.disableRemoteMethodByName("patchOrCreate");
  Analyseuser.disableRemoteMethodByName("replaceOrCreate");
  Analyseuser.disableRemoteMethodByName("upsertWithWhere");
  Analyseuser.disableRemoteMethodByName("exists");
  Analyseuser.disableRemoteMethodByName("replaceById");
  Analyseuser.disableRemoteMethodByName("find");
  Analyseuser.disableRemoteMethodByName("findOne");
  Analyseuser.disableRemoteMethodByName("updateAll");
  Analyseuser.disableRemoteMethodByName("deleteById");
  Analyseuser.disableRemoteMethodByName("count");
  Analyseuser.disableRemoteMethodByName("patchAttributes");
  Analyseuser.disableRemoteMethodByName("createChangeStream");
};
