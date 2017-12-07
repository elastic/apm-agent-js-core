var Transaction = require('../../src/performance-monitoring/transaction')
var Span = require('../../src/performance-monitoring/span')

describe('transaction.Transaction', function () {
  beforeEach(function () {})

  it('should contain correct number of spans in the end', function (done) {
    var firstSpan = new Span('first-span-signature', 'first-span')
    firstSpan.end()

    var transaction = new Transaction('/', 'transaction', {})

    firstSpan.transaction = transaction
    firstSpan.setParent(transaction._rootSpan)
    transaction.addEndedSpans([firstSpan])

    var lastSpan = transaction.startSpan('last-span-signature', 'last-span')
    lastSpan.end()
    transaction.end()

    expect(transaction.spans.length).toBe(3)
    done()
  })

  it('should adjust rootSpan to earliest span', function (done) {
    var firstSpan = new Span('first-span-signature', 'first-span')
    firstSpan.end()

    var transaction = new Transaction('/', 'transaction', {})
    transaction.doneCallback = function () {
      expect(transaction._rootSpan._start).toBe(firstSpan._start)
      expect(transaction._rootSpan._end >= lastSpan._end).toBeTruthy()
      done()
    }
    firstSpan.transaction = transaction
    firstSpan.setParent(transaction._rootSpan)
    transaction.addEndedSpans([firstSpan])

    var lastSpan = transaction.startSpan('last-span-signature', 'last-span')

    lastSpan.end()
    transaction.detectFinish()
  })

  it('should adjust rootSpan to latest span', function (done) {
    var transaction = new Transaction('/', 'transaction', {})
    var rootSpanStart = transaction._rootSpan._start

    var firstSpan = transaction.startSpan('first-span-signature', 'first-span')
    firstSpan.end()

    var longSpan = transaction.startSpan('long-span-signature', 'long-span')

    var lastSpan = transaction.startSpan('last-span-signature', 'last-span')
    lastSpan.end()

    setTimeout(function () {
      longSpan.end()
      transaction.detectFinish()

      setTimeout(function () {
        expect(transaction._rootSpan._start).toBe(rootSpanStart)
        expect(transaction._rootSpan._end).toEqual(longSpan._end)
        done()
      })
    }, 500)
  })

  xit('should not start any spans after transaction has been added to queue', function (done) {
    var transaction = new Transaction('/', 'transaction', {})
    transaction.end()
    var firstSpan = transaction.startSpan('first-span-signature', 'first-span')
    firstSpan.end()
    setTimeout(function () {
      // todo: transaction has already been added to the queue, shouldn't accept more spans

      var lastSpan = transaction.startSpan('last-span-signature', 'last-span')
      fail('done transaction should not accept more spans, now we simply ignore the newly stared span.')
      lastSpan.end()
    })
  })

  it('should generate stacktrace based on transaction options', function (done) {
    var tr = new Transaction('/', 'transaction', {'enableStackFrames': true})
    var trPromise = new Promise(function (resolve, reject) {
      tr.doneCallback = function () {
        // expect(firstSpan.frames).not.toBeUndefined()
        expect(secondSpan.frames).toBeUndefined()
        resolve()
      }
    })

    var firstSpan = tr.startSpan('first-span-signature', 'first-span')
    firstSpan.end()

    var secondSpan = tr.startSpan('second-span', 'second-span', {'enableStackFrames': false})
    secondSpan.end()

    var noStackTrace = new Transaction('/', 'transaction', {'enableStackFrames': false})
    var thirdSpan = noStackTrace.startSpan('third-span', 'third-span', {'enableStackFrames': true})
    thirdSpan.end()

    var noStackTracePromise = new Promise(function (resolve, reject) {
      noStackTrace.doneCallback = function () {
        expect(thirdSpan.frames).toBeUndefined()
        resolve()
      }
    })

    Promise.all([trPromise, noStackTracePromise]).then(function () {
      done()
    })

    tr.detectFinish()
    noStackTrace.detectFinish()
  })
  it('should not generate stacktrace if the option is not passed', function (done) {
    var tr = new Transaction('/', 'transaction')
    tr.doneCallback = function () {
      expect(firstSpan.frames).toBeUndefined()
      expect(secondSpan.frames).toBeUndefined()
      done()
    }
    var firstSpan = tr.startSpan('first-span-signature', 'first-span', {'enableStackFrames': true})
    firstSpan.end()

    var secondSpan = tr.startSpan('second-span', 'second-span')
    secondSpan.end()

    tr.end()
  })

  it('should store contextInfo.url.location', function () {
    var tr = new Transaction('/', 'transaction')
    tr.detectFinish()
    var location = tr.contextInfo.url.location
    expect(location).toBe(window.location.href)
  })

  it('should store debug.log in contextInfo', function () {
    var tr = new Transaction('/', 'transaction', {sendVerboseDebugInfo: true})
    expect(tr.contextInfo._debug.log.length).toBeGreaterThan(0)
  })

  it('should not create log on contextInfo._debug if sendVerboseDebugInfo is not true', function () {
    var tr = new Transaction('/', 'transaction')
    expect(tr.contextInfo._debug.log).toBeUndefined()
  })

  it('should redefine transaction', function () {
    var tr = new Transaction('/', 'transaction', {sendVerboseDebugInfo: true})
    tr.redefine('name', 'type', {test: 'test'})
    expect(tr.name).toBe('name')
    expect(tr.type).toBe('type')
    expect(tr._options).toEqual({test: 'test'})
  })

  it('should add and remove tasks', function () {
    var tr = new Transaction('/', 'transaction', {sendVerboseDebugInfo: true})
    expect(tr._scheduledTasks).toEqual({})
    tr.addTask('task1')
    expect(tr._scheduledTasks).toEqual({'task1': 'task1'})
    tr.removeTask('task1')
    expect(tr._scheduledTasks).toEqual({})
  })
})
