var app = require('../server.js');

module.exports = {

  getUsergroups: function (req, res) {
    var userid = req.query.userid;

    app.models.Usergroup.find({}, function (error, data) {
      if (error) {
        res.status(400).send({
          error: true,
          status: "Error while loading usergroups from database"
        });
      } else {
        var list_of_usergroups = [];

        data.forEach(function (usergroup) {
          var memberslist = usergroup["members"];
          if (memberslist.includes(userid)) {
            var current = {"name": usergroup["name"], "joined": true}
          } else {
            var current = {"name": usergroup["name"], "joined": false}
          }
          list_of_usergroups.push(current)
        });

        res.status(200).send({
          error: false,
          data: list_of_usergroups
        });
      }
    })
  },

  updateUsergroup: function (req, res) {
    var userid = req.query.userid;
    var data = req.body.data;
    data.forEach(function (usergroup) {
      if (usergroup["joined"] == true) {
        app.models.Usergroup.findOne({where: {name: usergroup["name"]}}, function (error, data) {
          var currentUsergroup = data;
          if (!currentUsergroup.members.includes(userid)) {
            currentUsergroup.members.push(userid);
            app.models.Usergroup.updateAll({name: usergroup["name"]}, {members: currentUsergroup.members}, function (err) {
              if (err) {
                res.status(400).send({
                  error: true,
                  status: "failed first"
                });
              }
            });
          }
        });
      } else {
        app.models.Usergroup.findOne({where: {name: usergroup["name"]}}, function (error, data) {
          var currentUsergroup = data;
          if (currentUsergroup.members.includes(userid)) {
            var index = currentUsergroup.members.indexOf(userid);
            currentUsergroup.members.splice(index, 1);
            app.models.Usergroup.updateAll({name: usergroup["name"]}, {members: currentUsergroup.members}, function (err) {
              if (err) {
                res.status(400).send({
                  error: true,
                  status: "failed second"
                });
              }
            });
          }
        });
      }
    });

    res.status(200).send({
      error: false,
      status: "successful"
    });
  }
};
