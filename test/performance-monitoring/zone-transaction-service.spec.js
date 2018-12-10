var ZoneTransactionService = require('../../src/performance-monitoring/zone-transaction-service')
var Transaction = require('../../src/performance-monitoring/transaction')
var Span = require('../../src/performance-monitoring/span')

var ZoneServiceMock = require('./zoneServiceMock.js')
var LoggingService = require('../../src/common/logging-service')

var Config = require('../../src/common/config-service')
var resourceEntries = require('../fixtures/resource-entries')
var paintEntries = require('../fixtures/paint-entries')

describe('ZoneTransactionService', function () {
  var transactionService
  var zoneServiceMock
  var config
  var logger
  beforeEach(function () {
    zoneServiceMock = new ZoneServiceMock()

    spyOn(zoneServiceMock, 'get').and.callThrough()
    logger = new LoggingService()
    spyOn(logger, 'debug')

    config = new Config()
    config.init()
    transactionService = new ZoneTransactionService(zoneServiceMock, logger, config)
  })

  it('should not start span when there is no current transaction', function () {
    transactionService.startSpan('test-span', 'test-span')
    expect(logger.debug).toHaveBeenCalled()
  })

  it('should call startSpan on current Transaction', function () {
    var tr = new Transaction('transaction', 'transaction')
    spyOn(tr, 'startSpan').and.callThrough()
    transactionService.setCurrentTransaction(tr)
    transactionService.startSpan('test-span', 'test-span')
    expect(transactionService.getCurrentTransaction().startSpan).toHaveBeenCalledWith(
      'test-span',
      'test-span'
    )
  })

  it('should not start span when performance monitoring is disabled', function () {
    config.set('active', false)
    transactionService = new ZoneTransactionService(zoneServiceMock, logger, config)
    var tr = new Transaction('transaction', 'transaction')
    spyOn(tr, 'startSpan').and.callThrough()
    transactionService.setCurrentTransaction(tr)
    transactionService.startSpan('test-span', 'test-span')
    expect(transactionService.getCurrentTransaction().startSpan).not.toHaveBeenCalled()
  })

  it('should not start transaction when performance monitoring is disabled', function () {
    config.set('active', false)
    transactionService = new ZoneTransactionService(zoneServiceMock, logger, config)

    var result = transactionService.startTransaction('transaction', 'transaction')

    expect(result).toBeUndefined()
  })

  it('should not start transaction when not in apm zone', function () {
    zoneServiceMock.isApmZone = function () {
      return false
    }
    transactionService = new ZoneTransactionService(zoneServiceMock, logger, config)

    var result = transactionService.startTransaction('transaction', 'transaction')

    expect(result).toBeUndefined()
  })

  it('should start transaction', function () {
    config.set('active', true)
    config.set('browserResponsivenessInterval', true)
    transactionService = new ZoneTransactionService(zoneServiceMock, logger, config)

    var result = transactionService.startTransaction('transaction1', 'transaction')
    expect(result).toBeDefined()
    result = transactionService.startTransaction('transaction2', 'transaction')
    expect(result.name).toBe('transaction2')
  })

  it('should create a zone transaction on the first span', function () {
    config.set('active', true)
    transactionService = new ZoneTransactionService(zoneServiceMock, logger, config)

    transactionService.startSpan('testSpan', 'testtype')
    var trans = transactionService.getCurrentTransaction()
    expect(trans.name).toBe('ZoneTransaction')
    transactionService.startTransaction('transaction', 'transaction')
    expect(trans.name).toBe('transaction')
  })

  it('should not create transaction if performance is not enabled', function () {
    config.set('active', false)
    transactionService = new ZoneTransactionService(zoneServiceMock, logger, config)
    var result = transactionService.createTransaction('test', 'test', config.get('performance'))
    expect(result).toBeUndefined()
  })

  it('should call startSpan on current Transaction', function () {
    var tr = new Transaction('transaction', 'transaction')
    transactionService.setCurrentTransaction(tr)
    expect(tr._scheduledTasks).toEqual({})
    zoneServiceMock.spec.onScheduleTask({ source: 'setTimeout', taskId: 'setTimeout1' })
    zoneServiceMock.spec.onScheduleTask({
      source: 'XMLHttpRequest.send',
      taskId: 'XMLHttpRequest.send1',
      XHR: { method: 'GET', url: 'url' }
    })
    expect(tr._scheduledTasks).toEqual({
      setTimeout1: 'setTimeout1',
      'XMLHttpRequest.send1': 'XMLHttpRequest.send1'
    })
    zoneServiceMock.spec.onBeforeInvokeTask({
      source: 'XMLHttpRequest.send',
      taskId: 'XMLHttpRequest.send1',
      span: new Span('span', 'span')
    })
    expect(tr._scheduledTasks).toEqual({
      setTimeout1: 'setTimeout1',
      'XMLHttpRequest.send1': 'XMLHttpRequest.send1'
    })
    zoneServiceMock.spec.onInvokeTask({ source: 'setTimeout', taskId: 'setTimeout1' })
    expect(tr._scheduledTasks).toEqual({ 'XMLHttpRequest.send1': 'XMLHttpRequest.send1' })
    zoneServiceMock.spec.onCancelTask({
      source: 'XMLHttpRequest.send',
      taskId: 'XMLHttpRequest.send1'
    })
    expect(tr._scheduledTasks).toEqual({})
  })

  it('should remove XHR query string by default', function () {
    expect(config.get('includeXHRQueryString')).toBe(false)
    var tr = new Transaction('transaction', 'transaction')
    transactionService.setCurrentTransaction(tr)
    spyOn(transactionService, 'startSpan').and.callThrough()

    zoneServiceMock.spec.onScheduleTask({
      source: 'XMLHttpRequest.send',
      taskId: 'XMLHttpRequest.send1',
      XHR: { method: 'GET', url: 'http://test.com/path?key=value' }
    })
    expect(transactionService.startSpan).toHaveBeenCalledWith(
      'GET http://test.com/path',
      'external.http'
    )
  })

  it('should check includeXHRQueryString config', function () {
    config.set('includeXHRQueryString', true)
    expect(config.get('includeXHRQueryString')).toBe(true)
    var tr = new Transaction('transaction', 'transaction')
    transactionService.setCurrentTransaction(tr)
    spyOn(transactionService, 'startSpan').and.callThrough()

    zoneServiceMock.spec.onScheduleTask({
      source: 'XMLHttpRequest.send',
      taskId: 'XMLHttpRequest.send1',
      XHR: { method: 'GET', url: 'http://test.com/path?key=value' }
    })
    expect(transactionService.startSpan).toHaveBeenCalledWith(
      'GET http://test.com/path?key=value',
      'external.http'
    )
  })

  it('should call detectFinish onInvokeEnd', function () {
    config.set('active', true)
    transactionService = new ZoneTransactionService(zoneServiceMock, logger, config)

    var trans = transactionService.startTransaction('transaction', 'transaction')
    spyOn(trans, 'detectFinish')
    zoneServiceMock.spec.onInvokeStart({ source: 'source', type: 'type' })
    zoneServiceMock.spec.onInvokeEnd({ source: 'source', type: 'type' })
    expect(trans.detectFinish).toHaveBeenCalled()
  })

  it('should end the span if onInvokeTask is called first', function () {
    var tr = new Transaction('transaction', 'transaction')
    transactionService.setCurrentTransaction(tr)
    var task = {
      source: 'XMLHttpRequest.send',
      taskId: 'XMLHttpRequest.send1',
      XHR: { method: 'GET', url: 'http://test.com/path?key=value' }
    }
    zoneServiceMock.spec.onScheduleTask(task)
    expect(task.span).toBeDefined()
    expect(task.span.ended).toBe(false)
    zoneServiceMock.spec.onInvokeTask(task)
    expect(task.span.ended).toBe(true)
  })

  it('should capture page load on first transaction', function (done) {
    // todo: can't test hard navigation metrics since karma runs tests inside an iframe
    config.set('active', true)
    config.set('capturePageLoad', true)
    transactionService = new ZoneTransactionService(zoneServiceMock, logger, config)

    var tr1 = transactionService.startTransaction('transaction1', 'transaction')
    var tr1DoneFn = tr1.doneCallback
    tr1.doneCallback = function () {
      tr1DoneFn()
      expect(tr1.isHardNavigation).toBe(true)
      tr1.spans.forEach(function (t) {
        expect(t.duration()).toBeLessThan(5 * 60 * 1000)
        expect(t.duration()).toBeGreaterThan(-1)
      })
    }
    expect(tr1.isHardNavigation).toBe(false)
    tr1.isHardNavigation = true
    tr1.detectFinish()

    var tr2 = transactionService.startTransaction('transaction2', 'transaction')
    expect(tr2.isHardNavigation).toBe(false)
    var tr2DoneFn = tr2.doneCallback
    tr2.doneCallback = function () {
      tr2DoneFn()
      expect(tr2.isHardNavigation).toBe(false)
      done()
    }
    tr2.detectFinish()
  })

  it('should sendPageLoadMetrics', function (done) {
    config.set('active', true)
    config.set('capturePageLoad', true)

    transactionService = new ZoneTransactionService(zoneServiceMock, logger, config)

    transactionService.subscribe(function () {
      expect(tr.isHardNavigation).toBe(true)
      done()
    })
    var tr = transactionService.sendPageLoadMetrics('test')

    transactionService = new ZoneTransactionService(zoneServiceMock, logger, config)
    var zoneTr = new Transaction('ZoneTransaction', 'zone-transaction')
    transactionService.setCurrentTransaction(zoneTr)

    var pageLoadTr = transactionService.sendPageLoadMetrics('new tr')

    expect(pageLoadTr).toBe(zoneTr)
  })

  xit('should not add duplicate resource spans', function (done) {
    config.set('active', true)
    config.set('capturePageLoad', true)
    transactionService = new ZoneTransactionService(zoneServiceMock, logger, config)

    var tr = transactionService.startTransaction('transaction', 'transaction')
    tr.isHardNavigation = true
    var queryString = '?' + Date.now()
    var testUrl = '/base/test/performance/transactionService.spec.js'

    if (window.performance.getEntriesByType) {
      if (window.fetch) {
        window.fetch(testUrl + queryString).then(function () {
          var entries = window.performance.getEntriesByType('resource').filter(function (entry) {
            return entry.name.indexOf(testUrl + queryString) > -1
          })
          expect(entries.length).toBe(1)

          tr.donePromise.then(function () {
            var filtered = tr.spans.filter(function (span) {
              return span.name.indexOf(testUrl) > -1
            })
            expect(filtered.length).toBe(1)
            console.log(filtered[0])
            fail()
          })

          var xhrTask = { source: 'XMLHttpRequest.send', XHR: { url: testUrl, method: 'GET' } }
          zoneServiceMock.spec.onScheduleTask(xhrTask)
          zoneServiceMock.spec.onInvokeTask(xhrTask)
        })
      }
    }
  })

  it('should capture resources from navigation timing', function (done) {
    var _getEntriesByType = window.performance.getEntriesByType

    window.performance.getEntriesByType = function (type) {
      expect(['resource', 'paint']).toContain(type)
      if (type === 'resource') {
        return resourceEntries
      }
      return paintEntries
    }

    config.set('active', true)
    config.set('capturePageLoad', true)

    var transactionService = new ZoneTransactionService(zoneServiceMock, logger, config)
    transactionService.subscribe(function () {
      expect(tr.isHardNavigation).toBe(true)
      window.performance.getEntriesByType = _getEntriesByType
      done()
    })

    var zoneTr = new Transaction('ZoneTransaction', 'zone-transaction')
    transactionService.setCurrentTransaction(zoneTr)
    var span = zoneTr.startSpan('GET http://example.com', 'external.http')
    span.end()
    var tr = transactionService.sendPageLoadMetrics('resource-test')
  })

  it('should ignore transactions that match the list', function () {
    config.set('ignoreTransactions', ['transaction1', /transaction2/])
    transactionService = new ZoneTransactionService(zoneServiceMock, logger, config)

    expect(transactionService.shouldIgnoreTransaction('dont-ignore')).toBeFalsy()
    expect(transactionService.shouldIgnoreTransaction('transaction1')).toBeTruthy()
    expect(
      transactionService.shouldIgnoreTransaction('something-transaction2-something')
    ).toBeTruthy()

    config.set('ignoreTransactions', [])
  })
})
