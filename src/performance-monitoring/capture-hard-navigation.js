var Span = require('./span')
var utils = require('../common/utils')

var eventPairs = [
  ['domainLookupStart', 'domainLookupEnd', 'Domain lookup'],
  ['connectStart', 'connectEnd', 'Making a connection to the server'],
  ['requestStart', 'responseEnd', 'Requesting and receiving the document'],
  ['domLoading', 'domInteractive', 'Parsing the document, executing sync. scripts'],
  ['domContentLoadedEventStart', 'domContentLoadedEventEnd', 'Fire "DOMContentLoaded" event'],
  ['loadEventStart', 'loadEventEnd', 'Fire "load" event']
]

var spanThreshold = 5 * 60 * 1000
function isValidSpan (transaction, span) {
  var d = span.duration()
  return (
    d < spanThreshold &&
    d > 0 &&
    span._start <= transaction._rootSpan._end &&
    span._end <= transaction._rootSpan._end
  )
}

function createNavigationTimingSpans (timings, baseTime) {
  var spans = []
  for (var i = 0; i < eventPairs.length; i++) {
    var start = timings[eventPairs[i][0]]
    var end = timings[eventPairs[i][1]]
    if (
      baseTime &&
      start &&
      end &&
      end > start &&
      start >= baseTime &&
      end - start < spanThreshold &&
      start - baseTime < spanThreshold &&
      end - baseTime < spanThreshold
    ) {
      var span = new Span(eventPairs[i][2], 'hard-navigation.browser-timing')
      if (eventPairs[i][0] === 'requestStart') {
        span.pageResponse = true
      }
      span._start = start - baseTime
      span.ended = true
      span._end = end - baseTime
      spans.push(span)
    }
  }
  return spans
}

function createResourceTimingSpans (entries, filterUrls) {
  var spans = []
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i]
    if ((entry.initiatorType && entry.initiatorType === 'xmlhttprequest') || !entry.name) {
      continue
    } else if (
      entry.initiatorType !== 'css' &&
      entry.initiatorType !== 'img' &&
      entry.initiatorType !== 'script' &&
      entry.initiatorType !== 'link'
    ) {
      // is web request? test for css/img before the expensive operation
      var foundAjaxReq = false
      for (var j = 0; j < filterUrls.length; j++) {
        // entry.name.endsWith(ajaxUrls[j])
        var idx = entry.name.lastIndexOf(filterUrls[j])
        if (idx > -1 && idx === entry.name.length - filterUrls[j].length) {
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
      var start = entry.startTime
      var end = entry.responseEnd
      if (
        typeof start === 'number' &&
        typeof end === 'number' &&
        start >= 0 &&
        end > start &&
        end - start < spanThreshold &&
        start < spanThreshold &&
        end < spanThreshold
      ) {
        var parsedUrl = utils.parseUrl(entry.name)
        var span = new Span(parsedUrl.path || entry.name, kind)
        span.setContext({
          http: {
            url: entry.name
          }
        })
        span._start = start
        span.ended = true
        span._end = end
        spans.push(span)
      }
    }
  }
  return spans
}

function captureHardNavigation (transaction) {
  if (transaction.isHardNavigation && window.performance && window.performance.timing) {
    var timings = window.performance.timing
    var baseTime = timings.fetchStart
    // must be zero otherwise the calculated relative _start time would be wrong
    transaction._rootSpan._start = 0
    transaction.type = 'page-load'

    createNavigationTimingSpans(timings, baseTime).forEach(function (span) {
      if (isValidSpan(transaction, span)) {
        span.traceId = transaction.traceId
        span.sampled = transaction.sampled
        if (transaction._options.pageLoadSpanId && span.pageResponse) {
          span.id = transaction._options.pageLoadSpanId
        }
        transaction.spans.push(span)
      }
    })

    if (window.performance.getEntriesByType) {
      var entries = window.performance.getEntriesByType('resource')

      var ajaxUrls = transaction.spans
        .filter(function (span) {
          return span.type === 'external' && span.subType === 'http'
        })
        .map(function (span) {
          return span.name.split(' ')[1]
        })

      createResourceTimingSpans(entries, ajaxUrls).forEach(function (span) {
        if (isValidSpan(transaction, span)) {
          transaction.spans.push(span)
        }
      })
    }
    transaction._adjustStartToEarliestSpan()
    transaction._adjustEndToLatestSpan()
    transaction.addNavigationTimingMarks()
  }
}

module.exports = {
  captureHardNavigation: captureHardNavigation,
  createNavigationTimingSpans: createNavigationTimingSpans,
  createResourceTimingSpans: createResourceTimingSpans
}
