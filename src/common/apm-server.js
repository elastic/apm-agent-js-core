var Queue = require('./queue')
var throttle = require('./throttle')
var utils = require('./utils')

class ApmServer {
  constructor (configService, loggingService) {
    this._configService = configService
    this._loggingService = loggingService
    this.logMessages = {
      invalidConfig: { message: 'Configuration is invalid!', level: 'warn' }
    }

    this.errorQueue = undefined
    this.transactionQueue = undefined

    this.throttleAddError = undefined
    this.throttleAddTransaction = undefined

    this.initialized = false
  }

  init () {
    if (this.initialized) {
      return
    }
    this.initialized = true

    this.initErrorQueue()
    this.initTransactionQueue()
    this.initBeforeUnloadListener()
  }

  createServiceObject () {
    var cfg = this._configService
    var stringLimit = cfg.get('serverStringLimit')

    var serviceObject = {
      name: utils.sanitizeString(cfg.get('serviceName'), stringLimit, true),
      version: utils.sanitizeString(cfg.get('serviceVersion'), stringLimit, false),
      agent: {
        name: cfg.get('agentName'),
        version: cfg.get('agentVersion')
      },
      language: {
        name: 'javascript'
      }
    }
    return serviceObject
  }

  _postJson (endPoint, payload) {
    return this._makeHttpRequest('POST',
      endPoint,
      JSON.stringify(payload),
      {'Content-Type': 'application/json'})
  }

  _makeHttpRequest (method, url, payload, headers) {
    return new Promise(function (resolve, reject) {
      var xhr = new window.XMLHttpRequest()
      xhr.open(method, url, true)
      xhr.timeout = 10000

      if (headers) {
        for (var header in headers) {
          if (headers.hasOwnProperty(header)) {
            xhr.setRequestHeader(header, headers[header])
          }
        }
      }

      xhr.onreadystatechange = function (evt) {
        if (xhr.readyState === 4) {
          var status = xhr.status
          if (status === 0 || status > 399 && status < 600) {
            // An http 4xx or 5xx error. Signal an error.
            var err = new Error(url + ' HTTP status: ' + status)
            err.xhr = xhr
            reject(err)
          } else {
            resolve(xhr.responseText)
          }
        }
      }

      xhr.onerror = function (err) {
        reject(err)
      }

      xhr.send(payload)
    })
  }

  _createQueue (onFlush) {
    var queueLimit = this._configService.get('queueLimit')
    var flushInterval = this._configService.get('flushInterval')
    return new Queue(onFlush, {
      queueLimit: queueLimit,
      flushInterval: flushInterval
    })
  }

  initErrorQueue () {
    var apmServer = this
    if (this.errorQueue) {
      this.errorQueue.flush()
    }
    this.errorQueue = this._createQueue(function (errors) {
      var p = apmServer.sendErrors(errors)
      if (p) {
        p.then(undefined, function (reason) {
          apmServer._loggingService.warn('Failed sending errors!', reason)
        })
      }
    })

    var limit = apmServer._configService.get('errorThrottleLimit')
    var interval = apmServer._configService.get('errorThrottleInterval')

    this.throttleAddError = throttle(this.errorQueue.add.bind(this.errorQueue),
      function (method, url) {
        apmServer._loggingService.warn('Dropped error due to throttling!')
      }, {
        limit: limit,
        interval: interval
      })
  }

  initTransactionQueue () {
    var apmServer = this
    if (this.transactionQueue) {
      this.transactionQueue.flush()
    }
    this.transactionQueue = this._createQueue(function (transactions) {
      var p = apmServer.sendTransactions(transactions)
      if (p) {
        p.then(undefined, function (reason) {
          apmServer._loggingService.warn('Failed sending transactions!', reason)
        })
      }
    })

    var limit = apmServer._configService.get('transactionThrottleLimit')
    var interval = apmServer._configService.get('transactionThrottleInterval')

    this.throttleAddTransaction = throttle(this.transactionQueue.add.bind(this.transactionQueue),
      function () {
        apmServer._loggingService.warn('Dropped transaction due to throttling!')
      }, {
        limit: limit,
        interval: interval
      })
  }

  initBeforeUnloadListener () {
    var self = this

    window.addEventListener('beforeunload', function () {
      if (self._configService.isActive()) {
        if (self.transactionQueue) {
          self.transactionQueue.flush()
        }
        if (self.errorQueue) {
          self.errorQueue.flush()
        }
      }
    })
  }

  addError (error) {
    if (this._configService.isActive()) {
      if (!this.errorQueue) {
        this.initErrorQueue()
      }
      this.throttleAddError(error)
    }
  }

  addTransaction (transaction) {
    if (this._configService.isActive()) {
      if (!this.transactionQueue) {
        this.initTransactionQueue()
      }
      this.throttleAddTransaction(transaction)
    }
  }

  warnOnce (logObject) {
    if (logObject.level === 'warn') {
      logObject.level = 'debug'
      this._loggingService.warn(logObject.message)
    } else {
      this._loggingService.debug(logObject.message)
    }
  }

  sendErrors (errors) {
    if (this._configService.isValid() && this._configService.isActive()) {
      if (errors && errors.length > 0) {
        var payload = {
          service: this.createServiceObject(),
          errors: errors
        }
        payload = this._configService.applyFilters(payload)
        if (payload) {
          var endPoint = this._configService.getEndpointUrl('errors')
          return this._postJson(endPoint, payload)
        } else {
          this._loggingService.warn('Dropped payload due to filtering!')
        }
      }
    } else {
      this.warnOnce(this.logMessages.invalidConfig)
    }
  }

  sendTransactions (transactions) {
    if (this._configService.isValid() && this._configService.isActive()) {
      if (transactions && transactions.length > 0) {
        var payload = {
          service: this.createServiceObject(),
          transactions: transactions
        }
        payload = this._configService.applyFilters(payload)
        if (payload) {
          var endPoint = this._configService.getEndpointUrl('transactions')
          return this._postJson(endPoint, payload)
        } else {
          this._loggingService.warn('Dropped payload due to filtering!')
        }
      }
    } else {
      this.warnOnce(this.logMessages.invalidConfig)
    }
  }

}

module.exports = ApmServer
