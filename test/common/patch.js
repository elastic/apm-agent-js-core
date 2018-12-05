var patchAll = require('../../src/common/patching/').patchAll

if (!window['__patchSubscription']) {
  var nativeFetch = window.fetch
  if (nativeFetch) {
    window.fetch = function () {
      var delegate = window['__fetchDelegate']
      if (typeof delegate === 'function') {
        return delegate.apply(this, arguments)
      } else {
        return nativeFetch.apply(this, arguments)
      }
    }
  }
  console.log('patchservice')
  window['__patchSubscription'] = patchAll()
}

module.exports = window['__patchSubscription']
