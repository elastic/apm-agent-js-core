var Transaction = require('./transaction')
var utils = require('../common/utils')
var Subscription = require('../common/subscription')

var captureHardNavigation = require('./capture-hard-navigation').captureHardNavigation
class TransactionService {
  constructor (logger, config) {
    this._config = config
    if (typeof config === 'undefined') {
      logger.debug('TransactionService: config is not provided')
    }
    this._logger = logger

    this.marks = {}

    this.initialPageLoadName = undefined
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
    var self = this
    var perfOptions = this._config.config
    var tr

    tr = this.getCurrentTransaction()

    var trName = name || this.initialPageLoadName
    var unknownName = false
    if (!trName) {
      trName = 'Unknown'
      unknownName = true
    }

    if (tr && tr.name === 'ZoneTransaction') {
      tr.redefine(trName, 'page-load', perfOptions)
    } else {
      tr = new Transaction(trName, 'page-load', perfOptions, this._logger)
    }
    tr.isHardNavigation = true
    tr.unknownName = unknownName

    tr.doneCallback = function () {
      self.applyAsync(function () {
        var captured = self.capturePageLoadMetrics(tr)
        if (captured) {
          self.add(tr)
        }
      })
    }
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
    var perfOptions = this._config.config

    if (!type) {
      type = 'custom'
    }

    if (type === 'interaction' && !perfOptions.captureInteractions) {
      return
    }

    // this will create a zone transaction if possible
    var tr = this.getOrCreateCurrentTransaction()

    if (tr) {
      if (tr.name !== 'ZoneTransaction') {
        // todo: need to handle cases in which the transaction has active spans and/or scheduled tasks
        this.logInTransaction('Ending early to start a new transaction:', name, type)
        this._logger.debug('Ending old transaction', tr)
        tr.end()
        tr = this.createTransaction(name, type)
      } else {
        tr.redefine(name, type, perfOptions)
      }
    } else {
      return
    }

    this._logger.debug('TransactionService.startTransaction', tr)
    tr.doneCallback = function () {
      self.applyAsync(function () {
        self._logger.debug('TransactionService transaction finished', tr)

        if (tr.spans.length > 0 && !self.shouldIgnoreTransaction(tr.name)) {
          self.capturePageLoadMetrics(tr)
          self.add(tr)
        }
      })
    }
    return tr
  }

  applyAsync (fn, applyThis, applyArgs) {
    return this.runOuter(function () {
      return Promise.resolve()
        .then(function () {
          return fn.apply(applyThis, applyArgs)
        }, function (reason) {
          console.log(reason)
        })
    })
  }
  shouldIgnoreTransaction (transaction_name) {
    var ignoreList = this._config.get('ignoreTransactions')

    for (var i = 0; i < ignoreList.length; i++) {
      var element = ignoreList[i]
      if (typeof element.test === 'function') {
        if (element.test(transaction_name)) {
          return true
        }
      } else if (element === transaction_name) {
        return true
      }
    }
    return false
  }
  startSpan (signature, type) {
    var trans = this.getOrCreateCurrentTransaction()

    if (trans) {
      this._logger.debug('TransactionService.startSpan', signature, type)
      var span = trans.startSpan(signature, type)
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
