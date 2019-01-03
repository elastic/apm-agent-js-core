const Span = require('./span')
const SpanBase = require('./span-base')

var utils = require('../common/utils')

class Transaction extends SpanBase {
  constructor (name, type, options) {
    super(name, type, options)
    this.traceId = utils.generateRandomId()
    this.marks = undefined

    this.spans = []
    this._activeSpans = {}

    this._scheduledTasks = {}

    this.nextAutoTaskId = 0

    this.isHardNavigation = false

    this.sampled = Math.random() <= this.options.transactionSampleRate
  }

  addNavigationTimingMarks () {
    var marks = utils.getNavigationTimingMarks()
    var paintMarks = utils.getPaintTimingMarks()
    if (marks) {
      var agent = {
        timeToFirstByte: marks.responseStart,
        domInteractive: marks.domInteractive,
        domComplete: marks.domComplete
      }
      if (paintMarks['first-contentful-paint']) {
        agent.firstContentfulPaint = paintMarks['first-contentful-paint']
      }
      this.addMarks({ navigationTiming: marks, agent })
    }
  }

  addMarks (obj) {
    this.marks = utils.merge(this.marks || {}, obj)
  }

  mark (key) {
    var skey = key.replace(/[.*]/g, '_')
    var now = window.performance.now() - this._start
    var custom = {}
    custom[skey] = now
    this.addMarks({ custom: custom })
  }

  redefine (name, type, options) {
    this.name = name
    this.type = type
    this.options = options
  }

  startSpan (name, type, options) {
    if (this.ended) {
      return
    }
    var transaction = this
    var opts = utils.extend({}, options)

    opts.onEnd = function (trc) {
      transaction._onSpanEnd(trc)
    }
    opts.traceId = this.traceId
    opts.sampled = this.sampled

    if (!opts.parentId) {
      opts.parentId = this.id
    }

    var span = new Span(name, type, opts)
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
    this.ended = true
    this._end = window.performance.now()
    // truncate active spans
    for (var sid in this._activeSpans) {
      var span = this._activeSpans[sid]
      span.type = span.type + '.truncated'
      span.end()
    }

    var metadata = utils.getPageMetadata()
    this.addContext(metadata)

    this._adjustStartToEarliestSpan()
    this._adjustEndToLatestSpan()
    this.callOnEnd()
  }

  addTask (taskId) {
    // todo: should not accept more tasks if the transaction is alreadyFinished]
    if (typeof taskId === 'undefined') {
      taskId = 'autoId' + this.nextAutoTaskId++
    }
    this._scheduledTasks[taskId] = taskId
    return taskId
  }

  removeTask (taskId) {
    delete this._scheduledTasks[taskId]
    this.detectFinish()
  }

  addEndedSpans (existingSpans) {
    this.spans = this.spans.concat(existingSpans)
  }

  _onSpanEnd (span) {
    this.spans.push(span)
    // Remove span from _activeSpans
    delete this._activeSpans[span.id]
  }

  _adjustEndToLatestSpan () {
    var latestSpan = findLatestNonXHRSpan(this.spans)

    if (latestSpan) {
      this._end = latestSpan._end

      // set all spans that now are longer than the transaction to
      // be truncated spans
      for (var i = 0; i < this.spans.length; i++) {
        var span = this.spans[i]
        if (span._end > this._end) {
          span._end = this._end
          span.type = span.type + '.truncated'
        }
        if (span._start > this._end) {
          span._start = this._end
        }
      }
    }
  }

  _adjustStartToEarliestSpan () {
    var span = getEarliestSpan(this.spans)

    if (span && span._start < this._start) {
      this._start = span._start
    }
  }
}

function findLatestNonXHRSpan (spans) {
  var latestSpan = null
  for (var i = 0; i < spans.length; i++) {
    var span = spans[i]
    if (
      span.type &&
      span.type.indexOf('ext') === -1 &&
      span.type !== 'transaction' &&
      (!latestSpan || latestSpan._end < span._end)
    ) {
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
