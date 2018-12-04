var createServiceFactory = require('..').createServiceFactory
var Transaction = require('../../src/performance-monitoring/transaction')
var Span = require('../../src/performance-monitoring/span')
var apmTestConfig = require('../apm-test-config')()

var resourceEntries = require('./resource-entries.js')
var utils = require('../../src/common/utils')
var patchUtils = require('../../src/common/patching/patch-utils')
var patchSub = require('../common/patch')

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
    var span1 = tr.startSpan('name', 'type')
    span1.end()
    var span2 = tr.startSpan('name', 'type')
    span2.end()
    var span3 = tr.startSpan('another-name', 'type')
    span3.end()
    var span4 = tr.startSpan('name', 'type')
    span4.end()
    var span5 = tr.startSpan('name', 'type')
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
    expect(grouped[0].name).toBe('2x name')
    expect(grouped[1].name).toBe('another-name')
    expect(grouped[2].name).toBe('2x name')
  })

  it('should group small continuously similar spans', function () {
    var tr = new Transaction('transaction', 'transaction')
    var span1 = tr.startSpan('name', 'type')
    span1.end()
    var span2 = tr.startSpan('name', 'type')
    span2.end()
    var span3 = tr.startSpan('name', 'type')
    span3.end()
    var span4 = tr.startSpan('name', 'type')
    span4.end()
    var span5 = tr.startSpan('another-name', 'type')
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
    expect(grouped[0].name).toBe('4x name')
    expect(grouped[1].name).toBe('another-name')
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
    var tr = new Transaction('test transaction', 'transaction', { transactionSampleRate: 1 }, logger)
    var span = tr.startSpan('test span', 'test span thype')
    span.end()
    span._end += 10
    tr.detectFinish()
    expect(tr._rootSpan._end).toBeDefined()
    if (tr._rootSpan._end === tr._rootSpan._start) {
      tr._rootSpan._end = tr._rootSpan._end + 100
    }
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
    var tr = new Transaction('transaction', 'transaction', { transactionSampleRate: 1 })
    var span = tr.startSpan('test span', 'test span type')
    span.end()
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
    var tr = new Transaction('transaction1', 'transaction1type', { transactionSampleRate: 1 })
    var span = tr.startSpan('span1', 'span1type')
    span.end()
    span._end += 10
    tr.detectFinish()

    expect(tr._rootSpan._end).toBeDefined()
    if (tr._rootSpan._end === tr._rootSpan._start) {
      tr._rootSpan._end = tr._rootSpan._end + 100
    }

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

  it('should filter out empty transactions', function () {
    var tr = new Transaction('test', 'test', { transactionSampleRate: 1 })
    var result = performanceMonitoring.filterTransaction(tr)
    expect(tr.spans.length).toBe(0)
    expect(tr.duration()).toBe(null)
    expect(result).toBe(false)
    var span = tr.startSpan('span1', 'span1type')
    span.end()

    expect(tr.spans.length).toBe(1)
    expect(tr.duration()).toBe(null)
    result = performanceMonitoring.filterTransaction(tr)
    expect(result).toBe(false)


    tr.end()
    if (tr._rootSpan._end && tr._rootSpan._end === tr._rootSpan._start) {
      tr._rootSpan._end += 100
    }
    expect(tr.duration()).toBeGreaterThan(0)
    result = performanceMonitoring.filterTransaction(tr)
    expect(result).toBe(true)

  })

  it('should filter the transactions with duration above threshold', function () {
    var threshold = configService.get('transactionDurationThreshold')
    var tr = new Transaction('/test/outlier', 'page-load-slow', configService.config, logger)
    var span1 = new Span('span 1', 'test-span')
    span1.end()
    tr.spans.push(span1)
    tr.end()
    tr._rootSpan._end += 60001
    expect(tr.duration()).toBeGreaterThanOrEqual(threshold)
    var payload = performanceMonitoring.createTransactionPayload(tr)
    expect(payload).toBeUndefined()
    var promise = apmServer.sendTransactions(payload)
    expect(promise).toBeUndefined()
  })

  it('should correctly use xhr patch', function (done) {
    var fn = performanceMonitoring.getXhrPatchSubFn()
    expect(typeof fn).toBe('function')
    var req = new window.XMLHttpRequest()
    req.open('GET', '/', true)
    spyOn(req, 'setRequestHeader').and.callThrough()
    var task = {
      source: 'XMLHttpRequest.send',
      data: {
        target: req
      }
    }
    req.addEventListener('readystatechange', function () {
      if (req.readyState === req.DONE) {
        fn('invoke', task)
        expect(task.data.span.ended).toBeTruthy()
        done()
      }
    })
    fn('schedule', task)
    req.send()
    expect(task.data.span).toBeDefined()
    expect(task.data.span.ended).toBeFalsy()
    var headerName = configService.get('distributedTracingHeaderName')
    var headerValue = utils.getDtHeaderValue(task.data.span)
    expect(req.setRequestHeader).toHaveBeenCalledWith(headerName, headerValue)

  })

  it('should consider fetchInProgress to avoid duplicate spans', function (done) {
    var fn = performanceMonitoring.getXhrPatchSubFn()
    expect(typeof fn).toBe('function')
    var req = new window.XMLHttpRequest()
    req.open('GET', '/', true)
    var task = {
      source: 'XMLHttpRequest.send',
      data: {
        target: req
      }
    }

    req.addEventListener('readystatechange', function () {
      if (req.readyState === req.DONE) {
        fn('invoke', task)
        expect(task.data.span.ended).toBeTruthy()
        done()
      }
    })

    patchUtils.globalState.fetchInProgress = true
    fn('schedule', task)
    expect(task.data.span).toBeUndefined()

    patchUtils.globalState.fetchInProgress = false
    fn('schedule', task)
    req.send()
    expect(task.data.span).toBeDefined()
    expect(task.data.span.ended).toBeFalsy()

  })

  if (window.fetch) {
    it('should create fetch spans', function (done) {
      var fn = performanceMonitoring.getXhrPatchSubFn()
      var dTHeaderValue
      performanceMonitoring.cancelPatchSub = patchSub.subscribe(function (event, task) {
        fn(event, task)
        if (event === patchUtils.SCHEDULE) {
          dTHeaderValue = task.data.target.headers.get(configService.get('distributedTracingHeaderName'))
        }
      })
      var transactionService = performanceMonitoring._transactionService
      var tr = transactionService.startTransaction('fetch transaction', 'custom')
      spyOn(transactionService, 'startSpan').and.callThrough()

      window.fetch('/')
        .then(function () {
          setTimeout(() => {
            expect(tr.spans.length).toBe(1)
            expect(tr.spans[0].name).toBe('GET /')
            expect(tr.spans[0].context).toEqual({
              http: {
                method: 'GET',
                url: '/',
                status_code: 200
              }
            })
            expect(dTHeaderValue).toBeDefined()
            performanceMonitoring.cancelPatchSub()
            done()
          });
        })
      expect(transactionService.startSpan).toHaveBeenCalledWith('GET /', 'external.http')
    })

    it('should not duplicate xhr spans if fetch is a polyfill', function (done) {
      var fn = performanceMonitoring.getXhrPatchSubFn()

      var events = []
      performanceMonitoring.cancelPatchSub = patchSub.subscribe(function (event, task) {
        events.push({ event, source: task.source })
        fn(event, task)
      })

      window['__fetchDelegate'] = function (url) {
        return new Promise(function (resolve, reject) {
          var req = new window.XMLHttpRequest()
          req.open('GET', url, true)
          req.addEventListener('readystatechange', function () {
            // to guarantee the order of event execution 
            setTimeout(() => {
              if (req.readyState === req.DONE) {
                resolve(req.responseText)
              }
            });
          })

          // Can't rely on the fetch-patch to set this flag because of the way karma executes tests
          patchUtils.globalState.fetchInProgress = true
          req.send()
          patchUtils.globalState.fetchInProgress = false
        })
      }
      var transactionService = performanceMonitoring._transactionService
      var tr = transactionService.startTransaction('fetch transaction', 'custom')


      var promise = window.fetch('/')
      expect(promise).toBeDefined()
      promise.then(function (response) {
        setTimeout(() => {
          expect(response).toBeDefined()
          expect(tr.spans.length).toBe(1)
          expect(events).toEqual([
            {
              "event": "schedule",
              "source": "fetch"
            },
            {
              "event": "schedule",
              "source": "XMLHttpRequest.send"
            },
            {
              "event": "invoke",
              "source": "XMLHttpRequest.send"
            },
            {
              "event": "invoke",
              "source": "fetch"
            }
          ])
          done()
        });
      })

      window['__fetchDelegate'] = undefined
    })
  }
})
