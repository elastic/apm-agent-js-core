var utils = require('../common/utils')
class Span {
  constructor (signature, type, options) {
    var opts = options || {}
    if (typeof opts.onSpanEnd === 'function') {
      this.onSpanEnd = opts.onSpanEnd
    } else {
      this.onSpanEnd = function () {}
    }
    this.signature = signature
    this.type = type
    this.ended = false
    this._end = null
    this.context = null
    // Start timers
    this._start = window.performance.now()
  }
  end () {
    this._end = window.performance.now()

    this.ended = true
    this.onSpanEnd(this)
  }

  duration () {
    if (utils.isUndefined(this.ended) || utils.isUndefined(this._start)) {
      return null
    }

    var diff = this._end - this._start

    return parseFloat(diff)
  }

  setContext (context) {
    if (!context) return
    this.context = utils.merge(this.context || {}, context)
  }
}

module.exports = Span
