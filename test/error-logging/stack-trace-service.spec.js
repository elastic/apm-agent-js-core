var StackTraceService = require('../../src/error-logging/stack-trace-service')
var createServiceFactory = require('..').createServiceFactory

describe('StackTraceService', function () {
  it('should produce correct number of frames', function (done) {
    var serviceFactory = createServiceFactory()
    var configService = serviceFactory.getService('ConfigService')
    var stackTraceService = new StackTraceService(configService)
    function generateError () {
      throw new Error('test error')
    }
    setTimeout(function () {
      try {
        generateError()
      } catch (error) {
        var stackTraces = stackTraceService.createStackTraces({ error })
        expect(stackTraces.length).toBeGreaterThan(1)
        done()
      }
    }, 1)
  })
})
