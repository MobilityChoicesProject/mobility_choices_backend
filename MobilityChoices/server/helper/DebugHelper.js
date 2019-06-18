module.exports = {
  isDebugMode: function () {
    let nodeEnv = process.env.NODE_ENV;

    if (nodeEnv == null || nodeEnv === 'production') {
      return false;
    }

    return true;
  }
};
