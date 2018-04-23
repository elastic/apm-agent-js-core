var createServiceFactory = require('..').createServiceFactory
var Transaction = require('../../src/performance-monitoring/transaction')
var Span = require('../../src/performance-monitoring/span')
var apmTestConfig = require('../apm-test-config')()

var resourceEntries = require('./resource-entries.js')

describe('PerformanceMonitoring', function () {
  var serviceFactory
  var apmServer
  var performanceMonitoring
  var configService
  var logger

  beforeEach(function () {
    serviceFactory = createServiceFactory()
    configService = serviceFactory.getService('ConfigService')
    logger = serviceFactory.getService('LoggingService')
    configService.setConfig(apmTestConfig)

    apmServer = serviceFactory.getService('ApmServer')
    performanceMonitoring = serviceFactory.getService('PerformanceMonitoring')
  })
  it('should send performance monitoring data to apm-server', function (done) {
    var tr = new Transaction('tr-name', 'tr-type', configService.config, logger)
    var span1 = new Span('span 1', 'test-span')
    span1.end()
    tr.spans.push(span1)
    tr.end()
    var payload = performanceMonitoring.convertTransactionsToServerModel([tr])
    var promise = apmServer.sendTransactions(payload)
    expect(promise).toBeDefined()
    promise.then(function () {
      done()
    }, function (reason) {
      fail('Failed sending transactions to the server, reason: ' + reason)
    })
  })

  it('should group small continuously similar spans up until the last one', function () {
    var tr = new Transaction('transaction', 'transaction')
    var span1 = tr.startSpan('signature', 'type')
    span1.end()
    var span2 = tr.startSpan('signature', 'type')
    span2.end()
    var span3 = tr.startSpan('another-signature', 'type')
    span3.end()
    var span4 = tr.startSpan('signature', 'type')
    span4.end()
    var span5 = tr.startSpan('signature', 'type')
    span5.end()

    tr.end()

    tr._rootSpan._start = 10
    tr._rootSpan._end = 1000

    span1._start = 20
    span1._end = 30

    span2._start = 31
    span2._end = 35

    span3._start = 35
    span3._end = 45

    span4._start = 50
    span4._end = 60

    span5._start = 61
    span5._end = 70

    tr.spans.sort(function (spanA, spanB) {
      return spanA._start - spanB._start
    })
    var grouped = performanceMonitoring.groupSmallContinuouslySimilarSpans(tr, 0.05)

    expect(grouped.length).toBe(3)
    expect(grouped[0].signature).toBe('2x signature')
    expect(grouped[1].signature).toBe('another-signature')
    expect(grouped[2].signature).toBe('2x signature')
  })

  it('should group small continuously similar spans', function () {
    var tr = new Transaction('transaction', 'transaction')
    var span1 = tr.startSpan('signature', 'type')
    span1.end()
    var span2 = tr.startSpan('signature', 'type')
    span2.end()
    var span3 = tr.startSpan('signature', 'type')
    span3.end()
    var span4 = tr.startSpan('signature', 'type')
    span4.end()
    var span5 = tr.startSpan('another-signature', 'type')
    span5.end()

    tr.end()

    tr._rootSpan._start = 10
    tr._rootSpan._end = 1000

    span1._start = 20
    span1._end = 30

    span2._start = 31
    span2._end = 35

    span3._start = 35
    span3._end = 45

    span4._start = 50
    span4._end = 60

    span5._start = 60
    span5._end = 70

    tr.spans.sort(function (spanA, spanB) {
      return spanA._start - spanB._start
    })

    var grouped = performanceMonitoring.groupSmallContinuouslySimilarSpans(tr, 0.05)

    expect(grouped.length).toBe(2)
    expect(grouped[0].signature).toBe('4x signature')
    expect(grouped[1].signature).toBe('another-signature')
  })

  it('should calculate browser responsiveness', function () {
    var tr = new Transaction('transaction', 'transaction', {})
    tr.end()

    tr._rootSpan._start = 1

    tr._rootSpan._end = 400
    tr.browserResponsivenessCounter = 0
    var resp = performanceMonitoring.checkBrowserResponsiveness(tr, 500, 2)
    expect(resp).toBe(true)

    tr._rootSpan._end = 1001
    tr.browserResponsivenessCounter = 2
    resp = performanceMonitoring.checkBrowserResponsiveness(tr, 500, 2)
    expect(resp).toBe(true)

    tr._rootSpan._end = 1601
    tr.browserResponsivenessCounter = 2
    resp = performanceMonitoring.checkBrowserResponsiveness(tr, 500, 2)
    expect(resp).toBe(true)

    tr._rootSpan._end = 3001
    tr.browserResponsivenessCounter = 3
    resp = performanceMonitoring.checkBrowserResponsiveness(tr, 500, 2)
    expect(resp).toBe(false)
  })

  it('should sendTransactionInterval', function () {
    var transactionService = serviceFactory.getService('TransactionService')
    expect(configService.isValid()).toBe(true)
    var tr = new Transaction('test transaction', 'transaction', {}, logger)
    var span = tr.startSpan('test span', 'test span thype')
    span.end()
    tr.detectFinish()
    var result = performanceMonitoring.sendTransactions([tr])
    expect(result).toBeDefined()
  })

  it('should filter transactions', function () {
    configService.setConfig({
      browserResponsivenessInterval: 500,
      checkBrowserResponsiveness: true,
      browserResponsivenessBuffer: 2
    })
    spyOn(logger, 'debug').and.callThrough()
    expect(logger.debug).not.toHaveBeenCalled()
    var tr = new Transaction('transaction', 'transaction')
    tr.end()
    tr._rootSpan._start = 1

    tr._rootSpan._end = 3001
    tr.browserResponsivenessCounter = 3
    var wasBrowserResponsive = performanceMonitoring.filterTransaction(tr)
    expect(wasBrowserResponsive).toBe(false)
    expect(logger.debug)
      .toHaveBeenCalledWith('Transaction was discarded! browser was not responsive enough during the transaction.',
        ' duration:', 3000, ' browserResponsivenessCounter:', 3, 'interval:', 500)
  })

  xit('should initialize', function (done) {
    var _fork = window.Zone.current.fork
    var zoneService = serviceFactory.getService('ZoneService')
    performanceMonitoring.init()
    spyOn(apmServer, 'addTransaction').and.callThrough()

    zoneService.runInApmZone(function () {
      var tr = performanceMonitoring._transactionService.startTransaction('transaction', 'transaction')
      var span = tr.startSpan('test span', 'test span type')
      span.end()
      span = tr.startSpan('test span 2', 'test span type')
      span.end()
      tr.detectFinish()
      setTimeout(() => {
        expect(apmServer.addTransaction).toHaveBeenCalledWith(jasmine.objectContaining({
          name: 'transaction',
          type: 'transaction'
        }))
        done()
      }, 10)
    })
  })

  it('should create correct payload', function () {
    var tr = new Transaction('transaction1', 'transaction1type')
    var span = tr.startSpan('span1', 'span1type')
    span.end()
    var payload = performanceMonitoring.createTransactionPayload(tr)
    expect(payload.name).toBe('transaction1')
    expect(payload.type).toBe('transaction1type')
    expect(payload.spans.length).toBe(1)
    expect(payload.spans[0].name).toBe('span1')
    expect(payload.spans[0].type).toBe('span1type')
    expect(payload.spans[0].start).toBe(span._start - tr._rootSpan._start)
    expect(payload.spans[0].duration).toBe(span._end - span._start)
  })

  it('should sendPageLoadMetrics', function (done) {
    var _getEntriesByType = window.performance.getEntriesByType

    window.performance.getEntriesByType = function (type) {
      expect(type).toBe('resource')
      return resourceEntries
    }

    var transactionService = serviceFactory.getService('TransactionService')

    transactionService.subscribe(function (tr) {
      expect(tr.isHardNavigation).toBe(true)
      var payload = performanceMonitoring.convertTransactionsToServerModel([tr])
      var promise = apmServer.sendTransactions(payload)
      expect(promise).toBeDefined()
      promise.then(function () {
        window.performance.getEntriesByType = _getEntriesByType
        done()
      }, function (reason) {
        fail('Failed sending transactions to the server, reason: ' + reason)
      })
    })
    var tr = transactionService.sendPageLoadMetrics('resource-test')
  })
})
