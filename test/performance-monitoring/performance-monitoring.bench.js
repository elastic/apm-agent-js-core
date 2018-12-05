var createServiceFactory = require('..').createServiceFactory
var Transaction = require('../../src/performance-monitoring/transaction')

function generateTransaction () {
  var tr = new Transaction('transaction1', 'transaction1type')
  var span = tr.startSpan('span1', 'span1type')
  span.end()
  tr.detectFinish()

  if (tr._rootSpan._end === tr._rootSpan._start) {
    tr._rootSpan._end = tr._rootSpan._end + 100
  }
  return tr
}

suite('PerformanceMonitoring', function () {
  var serviceFactory = createServiceFactory()
  var performanceMonitoring = serviceFactory.getService('PerformanceMonitoring')
  var apmServer = serviceFactory.getService('ApmServer')
  var _postJson = apmServer._postJson
  var configService = serviceFactory.getService('ConfigService')
  configService.setConfig({ serviceName: 'benchmark-send-transactions' })
  var apmTestConfig = require('../apm-test-config')()
  configService.setConfig(apmTestConfig)

  benchmark('createTransactionPayload', function () {
    var tr = generateTransaction()
    performanceMonitoring.createTransactionPayload(tr)
  })

  function ResolvedPromise () {
    return Promise.resolve()
  }

  benchmark('sendTransactions-no-json', function () {
    apmServer._postJson = ResolvedPromise
    var tr = generateTransaction()
    performanceMonitoring.sendTransactions([tr])
  })

  benchmark(
    'sendTransactions',
    function () {
      apmServer._postJson = _postJson
      var tr = generateTransaction()
      performanceMonitoring.sendTransactions([tr])
    },
    { delay: 1 }
  )
})

suite.skip('PerformanceMonitoring - Defered', function () {
  var serviceFactory = createServiceFactory()
  var performanceMonitoring = serviceFactory.getService('PerformanceMonitoring')
  var configService = serviceFactory.getService('ConfigService')
  configService.setConfig({ serviceName: 'benchmark-send-transactions-defered' })
  benchmark(
    'sendTransactions - Defered',
    function (deferred) {
      var tr = generateTransaction()

      performanceMonitoring.sendTransactions([tr]).then(() => {
        deferred.resolve()
      })
    },
    { defer: true }
  )
})
