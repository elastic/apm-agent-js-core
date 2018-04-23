var Span = require('./span')
var utils = require('../common/utils')
const uuidv4 = require('uuid/v4')

class Transaction {
  constructor (name, type, options, logger) {
    this.id = uuidv4()
    this.timestamp = new Date().toISOString()
    this.name = name
    this.type = type
    this.ended = false
    this._isDone = false
    this._options = options
    this._logger = logger
    if (typeof options === 'undefined') {
      this._options = {}
    }

    this.contextInfo = {}

    this.marks
    if (this._options.sendVerboseDebugInfo) {
      this.debugLog('Transaction', name, type)
    }

    this.spans = []
    this._activeSpans = {}

    this._scheduledTasks = {}

    this.doneCallback = function noop () {}

    this._rootSpan = new Span('transaction', 'transaction')

    this.duration = this._rootSpan.duration.bind(this._rootSpan)
    this.nextSpanId = 0
    this.nextAutoTaskId = 0

    this.isHardNavigation = false
  }

  debugLog () {
    if (this._options.sendVerboseDebugInfo) {
      if (!this.contextInfo._debug) {
        this.contextInfo._debug = {log: []}
      }
      if (!this.contextInfo._debug.log) {
        this.contextInfo._debug.log = []
      }
      var messages = (arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments))
      messages.unshift(Date.now().toString())
      var textMessage = messages.join(' - ')
      this.contextInfo._debug.log.push(textMessage)
      if (this._logger) this._logger.debug(textMessage)
    }
  }

  addContextInfo (obj) {
    utils.merge(this.contextInfo, obj)
  }

  setDebugData (key, value) {
    if (!this.contextInfo._debug) {
      this.contextInfo._debug = {}
    }
    this.contextInfo._debug[key] = value
  }

  addNavigationTimingMarks () {
    var marks = utils.getNavigationTimingMarks()
    if (marks) {
      this.addMarks({navigationTiming: marks})
    }
  }

  addMarks (obj) {
    this.marks = utils.merge(this.marks || {}, obj)
  }

  redefine (name, type, options) {
    this.debugLog('redefine', name, type)
    this.name = name
    this.type = type
    this._options = options
  }

  startSpan (signature, type, options) {
    // todo: should not accept more spans if the transaction is alreadyFinished
    var transaction = this
    this.debugLog('startSpan', signature, type)
    var opts = typeof options === 'undefined' ? {} : options

    opts.onSpanEnd = function (trc) {
      transaction._onSpanEnd(trc)
    }

    var span = new Span(signature, type, opts)
    span.id = this.nextSpanId
    this.nextSpanId++
    this._activeSpans[span.id] = span

    return span
  }

  isFinished () {
    var scheduledTasks = Object.keys(this._scheduledTasks)
    return scheduledTasks.length === 0
  }

  detectFinish () {
    if (this.isFinished()) this.end()
  }

  end () {
    if (this.ended) {
      return
    }
    this.debugLog('end')
    this.ended = true

    this.addContextInfo({
      url: {
        location: window.location.href
      }
    })
    this._rootSpan.end()

    this._adjustStartToEarliestSpan()
    this._adjustEndToLatestSpan()
    this.doneCallback(this)
  }

  addTask (taskId) {
    // todo: should not accept more tasks if the transaction is alreadyFinished]
    if (typeof taskId === 'undefined') {
      taskId = 'autoId' + this.nextAutoTaskId++
    }
    this.debugLog('addTask', taskId)
    this._scheduledTasks[taskId] = taskId
  }

  removeTask (taskId) {
    this.debugLog('removeTask', taskId)
    this.setDebugData('lastRemovedTask', taskId)
    delete this._scheduledTasks[taskId]
    this.detectFinish()
  }

  addEndedSpans (existingSpans) {
    this.spans = this.spans.concat(existingSpans)
  }

  _onSpanEnd (span) {
    this.spans.push(span)
    span._scheduledTasks = Object.keys(this._scheduledTasks)
    // Remove span from _activeSpans
    delete this._activeSpans[span.id]
  }

  _adjustEndToLatestSpan () {
    var latestSpan = findLatestNonXHRSpan(this.spans)

    if (latestSpan) {
      this._rootSpan._end = latestSpan._end

      // set all spans that now are longer than the transaction to
      // be truncated spans
      for (var i = 0; i < this.spans.length; i++) {
        var span = this.spans[i]
        if (span._end > this._rootSpan._end) {
          span._end = this._rootSpan._end
          span.type = span.type + '.truncated'
        }
      }
    }
  }

  _adjustStartToEarliestSpan () {
    var span = getEarliestSpan(this.spans)

    if (span && span._start < this._rootSpan._start) {
      this._rootSpan._start = span._start
    }
  }
}

function findLatestNonXHRSpan (spans) {
  var latestSpan = null
  for (var i = 0; i < spans.length; i++) {
    var span = spans[i]
    if (span.type && span.type.indexOf('ext') === -1 &&
      span.type !== 'transaction' &&
      (!latestSpan || latestSpan._end < span._end)) {
      latestSpan = span
    }
  }
  return latestSpan
}

function getEarliestSpan (spans) {
  var earliestSpan = null

  spans.forEach(function (span) {
    if (!earliestSpan) {
      earliestSpan = span
    }
    if (earliestSpan && earliestSpan._start > span._start) {
      earliestSpan = span
    }
  })

  return earliestSpan
}

module.exports = Transaction
