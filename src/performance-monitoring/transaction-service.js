var Transaction = require('./transaction')
var utils = require('../common/utils')
var Subscription = require('../common/subscription')

var captureHardNavigation = require('./capture-hard-navigation').captureHardNavigation
class TransactionService {
  constructor (logger, config) {
    if (typeof config === 'undefined') {
      logger.debug('TransactionService: config is not provided')
    }

    this._config = config
    this._logger = logger
    this.marks = {}
    this.currentTransaction = undefined
    this._subscription = new Subscription()
    this._alreadyCapturedPageLoad = false
  }

  shouldCreateTransaction () {
    return this._config.isActive()
  }
  getOrCreateCurrentTransaction () {
    if (!this.shouldCreateTransaction()) {
      return
    }
    var tr = this.getCurrentTransaction()
    if (!utils.isUndefined(tr) && !tr.ended) {
      return tr
    }
    return this.createZoneTransaction()
  }
  getCurrentTransaction () {
    return this.currentTransaction
  }
  setCurrentTransaction (value) {
    this.currentTransaction = value
  }
  createTransaction (name, type, options) {
    var perfOptions = options
    if (utils.isUndefined(perfOptions)) {
      perfOptions = this._config.config
    }
    if (!this.shouldCreateTransaction()) {
      return
    }

    var tr = new Transaction(name, type, perfOptions, this._logger)
    this.setCurrentTransaction(tr)
    if (perfOptions.checkBrowserResponsiveness) {
      this.startCounter(tr)
    }
    return tr
  }
  createZoneTransaction () {
    return this.createTransaction('ZoneTransaction', 'transaction')
  }

  startCounter (transaction) {
    transaction.browserResponsivenessCounter = 0
    var interval = this._config.get('browserResponsivenessInterval')
    if (typeof interval === 'undefined') {
      this._logger.debug('browserResponsivenessInterval is undefined!')
      return
    }
    this.runOuter(function () {
      var id = setInterval(function () {
        if (transaction.ended) {
          window.clearInterval(id)
        } else {
          transaction.browserResponsivenessCounter++
        }
      }, interval)
    })
  }

  sendPageLoadMetrics (name) {
    var tr = this.startTransaction(name, 'page-load')
    tr.detectFinish()
    return tr
  }
  capturePageLoadMetrics (tr) {
    var self = this
    var capturePageLoad = self._config.get('capturePageLoad')
    if (capturePageLoad && !self._alreadyCapturedPageLoad && tr.isHardNavigation) {
      tr.addMarks(self.marks)
      captureHardNavigation(tr)
      self._alreadyCapturedPageLoad = true
      return true
    }
  }

  startTransaction (name, type) {
    var self = this
    var perfOptions = self._config.config

    if (!type) {
      type = 'custom'
    }

    if (!name) {
      name = 'Unknown'
    }

    // this will create a zone transaction if possible
    var tr = this.getOrCreateCurrentTransaction()

    if (tr) {
      if (tr.name === 'ZoneTransaction') {
        tr.redefine(name, type, perfOptions)
      } else {
        this.logInTransaction('ElasticEnding early to start a new transaction:', name, type)
        this._logger.debug('Ending old transaction', tr)
        tr.end()
        tr = this.createTransaction(name, type, perfOptions)
      }
    } else {
      return
    }

    if (type === 'page-load') {
      tr.isHardNavigation = true

      if (perfOptions.pageLoadTraceId) {
        tr.traceId = perfOptions.pageLoadTraceId
      }
      if (typeof perfOptions.pageLoadSampled !== 'undefined') {
        tr.sampled = perfOptions.pageLoadSampled
      }

      if (tr.name === 'Unknown' && self._config.config.pageLoadTransactionName) {
        tr.name = self._config.config.pageLoadTransactionName
      }
    }

    this._logger.debug('TransactionService.startTransaction', tr)
    tr.doneCallback = function () {
      self.applyAsync(function () {
        self._logger.debug('TransactionService transaction finished', tr)
        if (!self.shouldIgnoreTransaction(tr.name)) {
          if (type === 'page-load') {
            if (tr.name === 'Unknown' && self._config.config.pageLoadTransactionName) {
              tr.name = self._config.config.pageLoadTransactionName
            }
            var captured = self.capturePageLoadMetrics(tr)
            if (captured) {
              self.add(tr)
            }
          } else {
            self.add(tr)
          }
        }
      })
    }
    return tr
  }

  applyAsync (fn, applyThis, applyArgs) {
    return this.runOuter(function () {
      return Promise.resolve().then(
        function () {
          return fn.apply(applyThis, applyArgs)
        },
        function (reason) {
          console.log(reason)
        }
      )
    })
  }
  shouldIgnoreTransaction (transactionName) {
    var ignoreList = this._config.get('ignoreTransactions')

    for (var i = 0; i < ignoreList.length; i++) {
      var element = ignoreList[i]
      if (typeof element.test === 'function') {
        if (element.test(transactionName)) {
          return true
        }
      } else if (element === transactionName) {
        return true
      }
    }
    return false
  }
  startSpan (name, type) {
    var trans = this.getOrCreateCurrentTransaction()

    if (trans) {
      this._logger.debug('TransactionService.startSpan', name, type)
      var span = trans.startSpan(name, type)
      return span
    }
  }
  add (transaction) {
    if (!this._config.isActive()) {
      return
    }

    this._subscription.applyAll(this, [transaction])
    this._logger.debug('TransactionService.add', transaction)
  }
  subscribe (fn) {
    return this._subscription.subscribe(fn)
  }
  addTask (taskId) {
    var tr = this.getOrCreateCurrentTransaction()
    if (tr) {
      tr.addTask(taskId)
      this._logger.debug('TransactionService.addTask', taskId)
    }
    return taskId
  }
  removeTask (taskId) {
    var tr = this.getCurrentTransaction()
    if (!utils.isUndefined(tr) && !tr.ended) {
      tr.removeTask(taskId)
      this._logger.debug('TransactionService.removeTask', taskId)
    }
  }
  logInTransaction () {
    var tr = this.getCurrentTransaction()
    if (!utils.isUndefined(tr) && !tr.ended) {
      tr.debugLog.apply(tr, arguments)
    }
  }
  setDebugDataOnTransaction (key, value) {
    var tr = this.getCurrentTransaction()
    if (!utils.isUndefined(tr) && !tr.ended) {
      tr.setDebugData(key, value)
    }
  }
  detectFinish () {
    var tr = this.getCurrentTransaction()
    if (!utils.isUndefined(tr) && !tr.ended) {
      tr.detectFinish()
      this._logger.debug('TransactionService.detectFinish')
    }
  }
  runOuter (fn, applyThis, applyArgs) {
    return fn.apply(applyThis, applyArgs)
  }
}

module.exports = TransactionService
