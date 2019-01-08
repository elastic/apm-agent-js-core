const apiCompatibilityChecks = require('./api_compatibility').default
const ElasticTracer = require('../../src/opentracing/tracer')
const createServiceFactory = require('..').createServiceFactory

function createTracer (config) {
  var serviceFactory = createServiceFactory()
  var performanceMonitoring = serviceFactory.getService('PerformanceMonitoring')
  var transactionService = serviceFactory.getService('TransactionService')
  var errorLogging = serviceFactory.getService('ErrorLogging')
  var loggingService = serviceFactory.getService('LoggingService')
  var configService = serviceFactory.getService('ConfigService')
  configService.setConfig(config)
  return new ElasticTracer(performanceMonitoring, transactionService, loggingService, errorLogging)
}

apiCompatibilityChecks(
  () => {
    return createTracer({
      active: true
    })
  },
  { skipBaggageChecks: true }
)

apiCompatibilityChecks(
  () => {
    return createTracer({
      active: false
    })
  },
  { skipBaggageChecks: true }
)

describe('OpenTracing API', function () {
  it('should create spans', function () {
    var tracer = createTracer({
      active: true
    })
    var span = tracer.startSpan('test-name', { tags: { type: 'test-type' }, startTime: Date.now() })

    expect(span.span.name).toBe('test-name')
    expect(span.span.type).toBe('test-type')
    expect(span.tracer()).toBe(tracer)
    span.setOperationName('new-name')
    expect(span.span.name).toBe('new-name')

    span.addTags({
      'user.id': 'test-id',
      'user.username': 'test-username',
      'user.email': 'test-email',
      'another.tag': 'test-tag',
      type: 'new-type'
    })

    expect(span.span.type).toBe('new-type')
    expect(span.span.context).toEqual({
      user: {
        id: 'test-id',
        username: 'test-username',
        email: 'test-email'
      },
      tags: { another_tag: 'test-tag' }
    })

    var testError = new Error('OpenTracing test error')
    spyOn(tracer.errorLogging, 'logError')
    span.log({ event: 'error', 'error.object': testError })
    expect(tracer.errorLogging.logError).toHaveBeenCalledWith(testError)

    tracer.errorLogging.logError.calls.reset()
    span.log({ event: 'error', message: 'OpenTracing error test message' })
    expect(tracer.errorLogging.logError).toHaveBeenCalledWith('OpenTracing error test message')
  })
})
