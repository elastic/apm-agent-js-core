function ZoneServiceMock () {
  function noop () {}

  this.spec = {
    onScheduleTask: noop,
    onInvokeTask: noop,
    onCancelTask: noop
  }

  this.zone = { name: 'apmMockZone' }
  this.get = function (key) {
    return this.zone[key]
  }
  this.set = function (key, value) {
    this.zone[key] = value
  }
  this.getFromApmZone = function (key) {
    return this.get(key)
  }
  this.runOuter = function (fn) {
    return fn()
  }
  this.zone.run = function (callback, applyThis, applyArgs) {
    return callback.apply(applyThis, applyArgs)
  }

  this.runInApmZone = function (fn, applyThis, applyArgs) {
    return fn.apply(applyThis, applyArgs)
  }

  this.isApmZone = function () {
    return true
  }

  this.getCurrentZone = function () {
    return this.zone
  }

  this.initialize = noop
}
module.exports = ZoneServiceMock
