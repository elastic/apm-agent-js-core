const constants = require('./constants')
const slice = [].slice
const URL = require('url-parse/dist/url-parse')
const rng = require('uuid/lib/rng-browser')

function isCORSSupported () {
  var xhr = new window.XMLHttpRequest()
  return 'withCredentials' in xhr
}

var byteToHex = []
for (var i = 0; i < 256; ++i) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1)
}

function bytesToHex (buf, offset) {
  var i = offset || 0
  var bth = byteToHex
  // join used to fix memory issue caused by concatenation: https://bugs.chromium.org/p/v8/issues/detail?id=3175#c4
  return [
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]]
  ].join('')
}

function parseUrl (url) {
  // source: angular.js/$LocationProvider
  var PATH_MATCH = /^([^?#]*)(\?([^#]*))?(#(.*))?$/
  var match = PATH_MATCH.exec(url)
  var path = match[1] || ''
  var queryString = match[3] || ''
  var hash = match[5] ? '#' + match[5] : ''

  var protocol = ''
  if (url.indexOf('://') > -1) {
    protocol = url.split('://')[0] + ':'
  }

  var params = {}
  var queries = queryString.split('&')
  for (var i = 0, l = queries.length; i < l; i++) {
    var query = queries[i]
    if (query === '' || typeof query === 'undefined' || query === null) {
      continue
    }
    var keyvalue = queries[i].split('=')
    var key = keyvalue.shift()
    params[key] = keyvalue.join('=')
  }
  return {
    protocol: protocol,
    path: path,
    queryString: queryString,
    queryStringParsed: params,
    hash: hash
  }
}

const dtVersion = '00'
const dtUnSampledFlags = '00'
// 00000001 ->  '01' -> recorded
const dtSampledFlags = '01'
function getDtHeaderValue (span) {
  if (span && span.traceId && span.id) {
    var flags = span.sampled ? dtSampledFlags : dtUnSampledFlags
    return dtVersion + '-' + span.traceId + '-' + span.id + '-' + flags
  }
}

function parseDtHeaderValue (value) {
  var parsed = /^([\da-f]{2})-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$/.exec(value)
  if (parsed) {
    var flags = parsed[4]
    var sampled = flags !== '00'
    return {
      traceId: parsed[2],
      id: parsed[3],
      sampled
    }
  }
}

function isDtHeaderValid (header) {
  return (
    /^[\da-f]{2}-[\da-f]{32}-[\da-f]{16}-[\da-f]{2}$/.test(header) &&
    header.slice(3, 35) !== '00000000000000000000000000000000' &&
    header.slice(36, 52) !== '0000000000000000'
  )
}

function checkSameOrigin (source, target) {
  var isSame = false
  if (typeof target === 'string') {
    var src = new URL(source)
    var tar = new URL(target)
    isSame = src.origin === tar.origin
  } else if (Array.isArray(target)) {
    target.forEach(function (t) {
      if (!isSame) {
        isSame = checkSameOrigin(source, t)
      }
    })
  }
  return isSame
}

function generateRandomId (length) {
  var id = bytesToHex(rng())
  return id.substr(0, length)
}

function isPlatformSupported () {
  return (
    typeof window !== 'undefined' &&
    typeof Array.prototype.forEach === 'function' &&
    typeof JSON.stringify === 'function' &&
    typeof Function.bind === 'function' &&
    window.performance &&
    typeof window.performance.now === 'function' &&
    isCORSSupported()
  )
}

function sanitizeString (value, limit, required, placeholder) {
  if (typeof value === 'number') {
    value = String(value)
  }
  if (required && !value) {
    value = placeholder || 'NA'
  }
  if (value) {
    return String(value).substr(0, limit)
  } else {
    return value
  }
}

function setTag (key, value, obj) {
  if (!obj || !key) return
  var skey = key.replace(/[.*]/g, '_')
  obj[skey] = sanitizeString(value, constants.serverStringLimit)
  return obj
}

function sanitizeObjectStrings (obj, limit, required, placeholder) {
  if (!obj) return obj
  if (typeof obj === 'string') {
    return sanitizeString(obj, limit, required, placeholder)
  }
  var keys = Object.keys(obj)
  keys.forEach(function (k) {
    var value = obj[k]
    if (typeof value === 'string') {
      value = sanitizeString(obj[k], limit, required, placeholder)
    } else if (typeof value === 'object') {
      value = sanitizeObjectStrings(value, limit, required, placeholder)
    }
    obj[k] = value
  })
  return obj
}

const navigationTimingKeys = [
  'fetchStart',
  'domainLookupStart',
  'domainLookupEnd',
  'connectStart',
  'connectEnd',
  'secureConnectionStart',
  'requestStart',
  'responseStart',
  'responseEnd',
  'domLoading',
  'domInteractive',
  'domContentLoadedEventStart',
  'domContentLoadedEventEnd',
  'domComplete',
  'loadEventStart',
  'loadEventEnd'
]

function getNavigationTimingMarks () {
  var timing = window.performance.timing
  var fetchStart = timing.fetchStart
  var marks = {}
  navigationTimingKeys.forEach(function (timingKey) {
    var m = timing[timingKey]
    if (m && m >= fetchStart) {
      marks[timingKey] = m - fetchStart
    }
  })
  return marks
}

/**
 * Paint Timing Metrics that is available during page load
 * https://www.w3.org/TR/paint-timing/
 */
function getPaintTimingMarks () {
  var paints = {}
  var perf = window.performance
  if (perf.getEntriesByType) {
    var entries = perf.getEntriesByType('paint')
    if (entries.length > 0) {
      var timings = perf.timing
      /**
       * To avoid capturing the unload event handler effect in paint timings
       */
      var unloadDiff = timings.fetchStart - timings.navigationStart
      for (var i = 0; i < entries.length; i++) {
        var data = entries[i]
        var calcPaintTime = unloadDiff >= 0 ? data.startTime - unloadDiff : data.startTime
        paints[data.name] = calcPaintTime
      }
    }
  }
  return paints
}

function getTimeOrigin () {
  return window.performance.timing.fetchStart
}

function getPageMetadata () {
  return {
    page: {
      referer: document.referrer,
      url: window.location.href
    }
  }
}

function stripQueryStringFromUrl (url) {
  return url && url.split('?')[0]
}

function isObject (value) {
  // http://jsperf.com/isobject4
  return value !== null && typeof value === 'object'
}

function isFunction (value) {
  return typeof value === 'function'
}

function baseExtend (dst, objs, deep) {
  for (var i = 0, ii = objs.length; i < ii; ++i) {
    var obj = objs[i]
    if (!isObject(obj) && !isFunction(obj)) continue
    var keys = Object.keys(obj)
    for (var j = 0, jj = keys.length; j < jj; j++) {
      var key = keys[j]
      var src = obj[key]

      if (deep && isObject(src)) {
        if (!isObject(dst[key])) dst[key] = Array.isArray(src) ? [] : {}
        baseExtend(dst[key], [src], false) // only one level of deep merge
      } else {
        dst[key] = src
      }
    }
  }

  return dst
}

function getElasticScript () {
  if (typeof document !== 'undefined') {
    var scripts = document.getElementsByTagName('script')
    for (var i = 0, l = scripts.length; i < l; i++) {
      var sc = scripts[i]
      if (sc.src.indexOf('elastic') > 0) {
        return sc
      }
    }
  }
}

function getCurrentScript () {
  if (typeof document !== 'undefined') {
    // Source http://www.2ality.com/2014/05/current-script.html
    var currentScript = document.currentScript
    if (!currentScript) {
      return getElasticScript()
    }
    return currentScript
  }
}

module.exports = {
  extend: function extend (dst) {
    return baseExtend(dst, slice.call(arguments, 1), false)
  },

  merge: function merge (dst) {
    return baseExtend(dst, slice.call(arguments, 1), true)
  },

  arrayReduce: function (arrayValue, callback, value) {
    // Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce
    if (arrayValue == null) {
      throw new TypeError('Array.prototype.reduce called on null or undefined')
    }
    if (typeof callback !== 'function') {
      throw new TypeError(callback + ' is not a function')
    }
    var t = Object(arrayValue)
    var len = t.length >>> 0
    var k = 0

    if (!value) {
      while (k < len && !(k in t)) {
        k++
      }
      if (k >= len) {
        throw new TypeError('Reduce of empty array with no initial value')
      }
      value = t[k++]
    }

    for (; k < len; k++) {
      if (k in t) {
        value = callback(value, t[k], k, t)
      }
    }
    return value
  },

  arraySome: function (value, callback, thisArg) {
    // Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some
    if (value == null) {
      throw new TypeError('Array.prototype.some called on null or undefined')
    }

    if (typeof callback !== 'function') {
      throw new TypeError()
    }

    var t = Object(value)
    var len = t.length >>> 0

    if (!thisArg) {
      thisArg = void 0
    }

    for (var i = 0; i < len; i++) {
      if (i in t && callback.call(thisArg, t[i], i, t)) {
        return true
      }
    }
    return false
  },

  arrayMap: function (arrayValue, callback, thisArg) {
    // Source https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Map
    var T, A, k

    if (this == null) {
      throw new TypeError(' this is null or not defined')
    }
    var O = Object(arrayValue)
    var len = O.length >>> 0

    if (typeof callback !== 'function') {
      throw new TypeError(callback + ' is not a function')
    }
    if (arguments.length > 1) {
      T = thisArg
    }
    A = new Array(len)
    k = 0
    while (k < len) {
      var kValue, mappedValue
      if (k in O) {
        kValue = O[k]
        mappedValue = callback.call(T, kValue, k, O)
        A[k] = mappedValue
      }
      k++
    }
    return A
  },

  isUndefined: function (obj) {
    return typeof obj === 'undefined'
  },

  noop: function () {},
  baseExtend,
  bytesToHex,
  isCORSSupported,
  isObject,
  isFunction,
  isPlatformSupported,
  isDtHeaderValid,
  parseUrl,
  parseDtHeaderValue,
  getNavigationTimingMarks,
  getPaintTimingMarks,
  getDtHeaderValue,
  getPageMetadata,
  getCurrentScript,
  getElasticScript,
  getTimeOrigin,
  generateRandomId,
  rng,
  checkSameOrigin,
  sanitizeString,
  sanitizeObjectStrings,
  setTag,
  stripQueryStringFromUrl
}
