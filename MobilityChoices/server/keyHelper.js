let fs = require('fs');

module.exports = {

    readKeys() {
        let rawdata = fs.readFileSync('MobilityChoice/server/keys.json');
        var keys = "";
        try {
            keys = JSON.parse(rawdata);
        } catch (error) {
            keys = null;
        }
        return keys;
    },

    getSpecificKey: function(keyname) {
        var keys = this.readKeys();
        if (keys !== null) {
            return keys[keyname];
        } else {
            return keys;
        }      
    },

    getGoogleAPIKey() {
        return this.getSpecificKey('googleKey');
    },

    getMapQuestKey() {
        return this.getSpecificKey('mapQuestKey');
    },

    getVAOKey() {
        return this.getSpecificKey('VAOKey');
    },

    getFirebaseKey() {
        return this.getSpecificKey('fireBase');
    }
};
