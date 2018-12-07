var Subscription = require('../../src/common/subscription')
class ApmServerMock {
  constructor (apmServer, useMocks) {
    var subscription = (this.subscription = new Subscription())
    var _apmServer = (this._apmServer = apmServer)
    var calls = (this.calls = {})

    function captureCall (methodName, call) {
      if (calls[methodName]) {
        calls[methodName].push(call)
      } else {
        calls[methodName] = [call]
      }
      subscription.applyAll(this, [call])
    }
    // eslint-disable-next-line
    function applyMock(methodName, captureFn, mockFn) {
      var args = Array.prototype.slice.call(arguments)
      args.splice(0, 3)
      var result
      var mocked = false
      if (!mockFn) {
        result = _apmServer[methodName].apply(_apmServer, args)
      } else {
        result = mockFn.apply(this, args)
        mocked = true
      }
      var call = { args: args, mocked: mocked }
      captureFn(methodName, call)
      return result
    }

    function spyOn (service, methodName, mockFn) {
      var _orig = service[methodName]
      return (service[methodName] = function () {
        var args = Array.prototype.slice.call(arguments).map(a => JSON.parse(JSON.stringify(a)))
        var call = { args: args, mocked: false }
        if (mockFn) {
          call.mocked = true
          call.returnValue = mockFn.apply(service, arguments)
          captureCall(methodName, call)
          return call.returnValue
        } else {
          call.returnValue = _orig.apply(service, arguments)
          captureCall(methodName, call)
          return call.returnValue
        }
      })
    }
    spyOn(
      _apmServer,
      'sendErrors',
      useMocks
        ? function () {
          return Promise.resolve()
        }
        : undefined
    )

    spyOn(
      _apmServer,
      'sendTransactions',
      useMocks
        ? function () {
          return Promise.resolve()
        }
        : undefined
    )

    this.addError = _apmServer.addError.bind(_apmServer)
    this.addTransaction = _apmServer.addTransaction.bind(_apmServer)
  }
  init () {}
}

module.exports = ApmServerMock
