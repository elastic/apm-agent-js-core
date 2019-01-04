var patchXMLHttpRequest = require('./xhr-patch').patchXMLHttpRequest
var patchFetch = require('./fetch-patch').patchFetch
var Subscription = require('../subscription')
var subscription = new Subscription()
var alreadyPatched = false
function patchAll () {
  if (!alreadyPatched) {
    alreadyPatched = true
    patchXMLHttpRequest(function (event, task) {
      subscription.applyAll(this, [event, task])
    })
    patchFetch(function (event, task) {
      subscription.applyAll(this, [event, task])
    })
  }
  return subscription
}

module.exports = {
  patchAll,
  subscription
}
