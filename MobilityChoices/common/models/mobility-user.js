'use strict';

var trackHelper = require('../../server/helper/TrackHelper');
var constants = require('../../server/custom/constants');

module.exports = function (Mobilityuser) {
  const randomstring = require("randomstring");

  // set the ttl automatically for every request
  Mobilityuser.beforeRemote('login', function (ctx, user, next) {
    ctx.args.credentials.ttl = 31536000; // = 60×60×24×365×1 // this is nearly 1 year
    next();
  });

  //send verification email after registration
  Mobilityuser.afterRemote('create', function (context, userInstance, next) {
    console.log('> user.afterRemote triggered');
    console.log(__dirname);

    var options = {
      type: 'email',
      to: userInstance.email,
      from: constants.email,
      subject: 'Danke für Ihre Registrierung bei Mobility Choices',
      template: __dirname + '/../../server/views/verify.ejs',
      redirect: '/verified',
      host: constants.host,
      port: '443',
      protocol: 'https',
      restApiRoot: '/mobility/api',
      user: Mobilityuser
    };

    userInstance.verify(options, function (err, response, next) {
      if (err) return console.log(err);
      console.log('> verification email sent:', response);
    });

    next();
  });

  let generatePassword = function (length) {
    if (length < 5) {
      length = 6;
    }
    return randomstring.generate(length);
  };

  Mobilityuser.on('resetPasswordRequest', function (info) {
    var newPassword = generatePassword(6);
    Mobilityuser.findById(info.accessToken.userId, function (err, user) {
      if (err) {
        console.log(err)
      } else {
        user.setPassword(newPassword);
      }
    });


    Mobilityuser.app.models.Email.send({
      to: info.email,
      from: constants.email,
      subject: 'Passwort zurücksetzten',
      html: 'Ihr neues Passwort lautet: ' + newPassword + '' +
        ' Sie können dieses Passwort in Ihrem Profil wieder ändern.'
    }, function (err) {
      if (err) return console.log('> error sending password reset email', err);
      console.log('> sending password reset email to:', info.email);
    });
  });

  Mobilityuser.afterRemote('*.__get__tracks', function (ctx, track, next) {
    var tracks = ctx.result;

    for (var i in tracks) {
      trackHelper.shortenLocation(tracks[i]);
    }

    next();
  });

  Mobilityuser.afterRemote('*.__findById__tracks', function (ctx, track, next) {
    trackHelper.shortenLocation(ctx.result);

    next();
  });


  Mobilityuser.disableRemoteMethodByName("upsert");
  Mobilityuser.disableRemoteMethodByName("updateAll");
  Mobilityuser.disableRemoteMethodByName("updateAttributes");
  Mobilityuser.disableRemoteMethodByName("find");
  Mobilityuser.disableRemoteMethodByName("findById");
  Mobilityuser.disableRemoteMethodByName("findOne");
  Mobilityuser.disableRemoteMethodByName("deleteById");
  Mobilityuser.disableRemoteMethodByName("count");
  Mobilityuser.disableRemoteMethodByName("exists");
  Mobilityuser.disableRemoteMethodByName('__count__accessTokens');
  Mobilityuser.disableRemoteMethodByName('__create__accessTokens');
  Mobilityuser.disableRemoteMethodByName('__delete__accessTokens');
  Mobilityuser.disableRemoteMethodByName('__destroyById__accessTokens');
  Mobilityuser.disableRemoteMethodByName('__findById__accessTokens');
  Mobilityuser.disableRemoteMethodByName('__get__accessTokens');
  Mobilityuser.disableRemoteMethodByName('__updateById__accessTokens');

  //Custom methods
  Mobilityuser.disableRemoteMethodByName("__findById__accessTokens");
  Mobilityuser.disableRemoteMethodByName("__destroyById__accessTokens");
  Mobilityuser.disableRemoteMethodByName("__updateById__accessTokens");
  Mobilityuser.disableRemoteMethodByName("__get__profile");
  Mobilityuser.disableRemoteMethodByName("__create__profile");
  Mobilityuser.disableRemoteMethodByName("__update__profile");
  Mobilityuser.disableRemoteMethodByName("__destroy__profile");
  Mobilityuser.disableRemoteMethodByName("__findById__tracks");
  Mobilityuser.disableRemoteMethodByName("__destroyById__tracks");
  Mobilityuser.disableRemoteMethodByName("__updateById__tracks");
  Mobilityuser.disableRemoteMethodByName("__findById__devices");
  Mobilityuser.disableRemoteMethodByName("__destroyById__devices");
  Mobilityuser.disableRemoteMethodByName("__updateById__devices");
  Mobilityuser.disableRemoteMethodByName("__findById__recordedTracks");
  Mobilityuser.disableRemoteMethodByName("__destroyById__recordedTracks");
  Mobilityuser.disableRemoteMethodByName("__updateById__recordedTracks");
  Mobilityuser.disableRemoteMethodByName("__get__accessTokens");
  Mobilityuser.disableRemoteMethodByName("__create__accessTokens");
  Mobilityuser.disableRemoteMethodByName("__delete__accessTokens");
  Mobilityuser.disableRemoteMethodByName("__count__accessTokens");
  Mobilityuser.disableRemoteMethodByName("__get__tracks");
  Mobilityuser.disableRemoteMethodByName("__create__tracks");
  Mobilityuser.disableRemoteMethodByName("__delete__tracks");
  Mobilityuser.disableRemoteMethodByName("__count__tracks");
  Mobilityuser.disableRemoteMethodByName("__get__devices");
  Mobilityuser.disableRemoteMethodByName("__create__devices");
  Mobilityuser.disableRemoteMethodByName("__delete__devices");
  Mobilityuser.disableRemoteMethodByName("__count__devices");
  Mobilityuser.disableRemoteMethodByName("__get__recordedTracks");
  Mobilityuser.disableRemoteMethodByName("__create__recordedTracks");
  Mobilityuser.disableRemoteMethodByName("__delete__recordedTracks");
  Mobilityuser.disableRemoteMethodByName("__count__recordedTracks");
  Mobilityuser.disableRemoteMethodByName("replaceOrCreate");
  Mobilityuser.disableRemoteMethodByName("upsertWithWhere");
  Mobilityuser.disableRemoteMethodByName("replaceById");
  Mobilityuser.disableRemoteMethodByName("patchAttributes");
  Mobilityuser.disableRemoteMethodByName("createChangeStream");

};
