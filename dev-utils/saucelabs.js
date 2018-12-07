function launchSauceConnect (userConfig, done) {
  var sauceConnectLauncher = require('sauce-connect-launcher')

  var config = {
    username: userConfig && (userConfig.username || process.env.SAUCE_USERNAME),
    accessKey: userConfig && (userConfig.accessKey || process.env.SAUCE_ACCESS_KEY),
    logger: console.log,
    noSslBumpDomains: 'all'
  }

  var tryConnect = function (maxAttempts, currAttempts, done) {
    sauceConnectLauncher(config, function (err) {
      if (err) {
        console.error(err.message)
        if (currAttempts <= maxAttempts) {
          console.log('Retrying... (attempt ' + currAttempts + ' of ' + maxAttempts + ')')
          tryConnect(maxAttempts, ++currAttempts, done)
        } else {
          return process.exit(1)
        }
      } else {
        console.log('Sauce Connect ready')
        done()
      }
    })
  }

  tryConnect(3, 1, done)
}
module.exports = {
  launchSauceConnect}
