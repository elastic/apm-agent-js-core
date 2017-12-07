var Span = require('./span')

var eventPairs = [
  ['domainLookupStart', 'domainLookupEnd', 'DNS lookup'],
  ['connectStart', 'connectEnd', 'Connect'],
  ['requestStart', 'responseStart', 'Sending and waiting for first byte'],
  ['responseStart', 'responseEnd', 'Downloading'],
  ['domLoading', 'domInteractive', 'Fetching, parsing and sync. execution'],
  ['domContentLoadedEventStart', 'domContentLoadedEventEnd', '"DOMContentLoaded" event handling'],
  ['loadEventStart', 'loadEventEnd', '"load" event handling']
]

var navigationTimingKeys = [
  'navigationStart', 'unloadEventStart', 'unloadEventEnd', 'redirectStart', 'redirectEnd', 'fetchStart', 'domainLookupStart', 'domainLookupEnd', 'connectStart',
  'connectEnd', 'secureConnectionStart', 'requestStart', 'responseStart', 'responseEnd', 'domLoading', 'domInteractive', 'domContentLoadedEventStart', 'domContentLoadedEventEnd', 'domComplete', 'loadEventStart', 'loadEventEnd']

var spanThreshold = 5 * 60 * 1000 // 5 minutes
function isValidSpan (transaction, span) {
  var d = span.duration()
  return (d < spanThreshold && d > 0 && span._start <= transaction._rootSpan._end && span._end <= transaction._rootSpan._end)
}

module.exports = function captureHardNavigation (transaction) {
  if (transaction.isHardNavigation && window.performance && window.performance.timing) {
    var baseTime = window.performance.timing.fetchStart
    var timings = window.performance.timing

    transaction._rootSpan._start = transaction._start = 0
    transaction.type = 'page-load'
    for (var i = 0; i < eventPairs.length; i++) {
      // var transactionStart = eventPairs[0]
      var start = timings[eventPairs[i][0]]
      var end = timings[eventPairs[i][1]]
      if (start && end && end - start !== 0) {
        var span = new Span(eventPairs[i][2], 'hard-navigation.browser-timing')
        span._start = timings[eventPairs[i][0]] - baseTime
        span.ended = true
        span.setParent(transaction._rootSpan)
        span.end()
        span._end = timings[eventPairs[i][1]] - baseTime
        if (isValidSpan(transaction, span)) {
          transaction.spans.push(span)
        }
      }
    }

    if (window.performance.getEntriesByType) {
      var entries = window.performance.getEntriesByType('resource')

      var ajaxUrls = transaction.spans
        .filter(function (span) { return span.type.indexOf('ext.HttpRequest') > -1 })
        .map(function (span) { return span.signature.split(' ')[1] })

      for (i = 0; i < entries.length; i++) {
        var entry = entries[i]
        if (entry.initiatorType && entry.initiatorType === 'xmlhttprequest') {
          continue
        } else if (entry.initiatorType !== 'css' && entry.initiatorType !== 'img' && entry.initiatorType !== 'script' && entry.initiatorType !== 'link') {
          // is web request? test for css/img before the expensive operation
          var foundAjaxReq = false
          for (var j = 0; j < ajaxUrls.length; j++) {
            // entry.name.endsWith(ajaxUrls[j])
            var idx = entry.name.lastIndexOf(ajaxUrls[j])
            if (idx > -1 && idx === (entry.name.length - ajaxUrls[j].length)) {
              foundAjaxReq = true
              break
            }
          }
          if (foundAjaxReq) {
            continue
          }
        } else {
          var kind = 'resource'
          if (entry.initiatorType) {
            kind += '.' + entry.initiatorType
          }

          span = new Span(entry.name, kind)
          span._start = entry.startTime
          span.ended = true
          span.setParent(transaction._rootSpan)
          span.end()
          span._end = entry.responseEnd
          if (isValidSpan(transaction, span)) {
            transaction.spans.push(span)
          }
        }
      }
    }
    transaction._adjustStartToEarliestSpan()
    transaction._adjustEndToLatestSpan()

    var metrics = {
      timeToComplete: transaction._rootSpan._end
    }
    var navigationStart = window.performance.timing.navigationStart
    navigationTimingKeys.forEach(function (timingKey) {
      var m = timings[timingKey]
      if (m) {
        metrics[timingKey] = m - navigationStart
      }
    })
    transaction.addMetrics(metrics)
  }
  return 0
}
