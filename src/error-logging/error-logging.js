const uuidv4 = require('uuid/v4')
var StackTraceService = require('./stack-trace-service')

var utils = require('../common/utils')

class ErrorLogging {
  constructor (apmServer, configService, loggingService) {
    this._apmServer = apmServer
    this._configService = configService
    this._loggingService = loggingService
    this._stackTraceService = new StackTraceService(configService, loggingService)
  }

  // errorEvent = {message, filename, lineno, colno, error}
  createErrorDataModel (errorEvent) {
    var filePath = this._stackTraceService.cleanFilePath(errorEvent.filename)
    var fileName = this._stackTraceService.filePathToFileName(filePath)
    var culprit
    var frames = this._stackTraceService.createStackTraces(errorEvent)
    frames = this._stackTraceService.filterInvalidFrames(frames)

    if (!fileName && frames.length) {
      var lastFrame = frames[frames.length - 1]
      if (lastFrame.filename) {
        fileName = lastFrame.filename
      } else {
        // If filename empty, assume inline script
        fileName = '(inline script)'
      }
    }

    if (this._stackTraceService.isFileInline(filePath)) {
      culprit = '(inline script)'
    } else {
      culprit = fileName
    }

    var message = errorEvent.message || errorEvent.error && errorEvent.error.message
    var errorType = errorEvent.error ? errorEvent.error.name : undefined
    if (!errorType) {
      // Try to extract type from message formatted like 'ReferenceError: Can't find variable: initHighlighting'
      if (message && message.indexOf(':') > -1) {
        errorType = message.split(':')[0]
      } else {
        errorType = ''
      }
    }

    var configContext = this._configService.get('context')
    var stringLimit = this._configService.get('serverStringLimit')
    var errorContext
    if (errorEvent.error && typeof errorEvent.error === 'object') {
      errorContext = this._getErrorProperties(errorEvent.error)
    }
    var browserMetadata = this._getBrowserSpecificMetadata()
    var context = utils.merge({}, browserMetadata, configContext, errorContext)

    var errorObject = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      culprit: utils.sanitizeString(culprit),
      exception: {
        message: utils.sanitizeString(message, undefined, true),
        stacktrace: frames,
        type: utils.sanitizeString(errorType, stringLimit, false)
      },
      context: context
    }
    return errorObject
  }

  logErrorEvent (errorEvent, sendImmediately) {
    if (this._configService.isActive()) {
      if (typeof errorEvent === 'undefined') {
        return
      }
      var errorObject = this.createErrorDataModel(errorEvent)
      if (typeof errorObject.exception.message === 'undefined') {
        return
      }
      if (sendImmediately) {
        return this._apmServer.sendErrors([errorObject])
      } else {
        return this._apmServer.addError(errorObject)
      }
    }
  }

  registerGlobalEventListener () {
    var errorLogging = this
    window.onerror = function (messageOrEvent, source, lineno, colno, error) {
      var errorEvent
      if (typeof messageOrEvent !== 'undefined' && typeof messageOrEvent !== 'string') {
        errorEvent = messageOrEvent
      } else {
        errorEvent = {
          message: messageOrEvent,
          filename: source,
          lineno: lineno,
          colno: colno,
          error: error
        }
      }
      errorLogging.logErrorEvent(errorEvent)
    }
  }

  logError (messageOrError) {
    var errorEvent = {}
    if (typeof messageOrError === 'string') {
      errorEvent.message = messageOrError
    } else {
      errorEvent.error = messageOrError
    }
    return this.logErrorEvent(errorEvent)
  }

  _getErrorProperties (error) {
    var properties = {}
    Object.keys(error).forEach(function (key) {
      if (key === 'stack') return
      var val = error[key]
      if (val === null) return // null is typeof object and well break the switch below
      switch (typeof val) {
        case 'function':
          return
        case 'object':
          // ignore all objects except Dates
          if (typeof val.toISOString !== 'function') return
          val = val.toISOString()
      }
      properties[key] = val
    })
    return properties
  }

  _getBrowserSpecificMetadata () {
    var viewportInfo = utils.getViewPortInfo()
    var metadata = {
      'environment': {
        'browserWidth': viewportInfo.width,
        'browserHeight': viewportInfo.height,
        'screenWidth': window.screen.width,
        'screenHeight': window.screen.height,
        'language': navigator.language,
        'userAgent': navigator.userAgent,
        'platform': navigator.platform
      },
      'page': {
        'referer': document.referrer,
        'host': document.domain,
        'location': window.location.href
      }
    }

    return metadata
  }

}

module.exports = ErrorLogging
