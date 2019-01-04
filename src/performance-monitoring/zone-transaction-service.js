const TransactionService = require('./transaction-service')
const utils = require('../common/utils')
const { XMLHTTPREQUEST_SOURCE } = require('../common/constants')

class ZoneTransactionService extends TransactionService {
  constructor (zoneService, logger, config) {
    super(logger, config)

    var transactionService = this

    this._zoneService = zoneService
    function onBeforeInvokeTask (task) {
      if (task.source === XMLHTTPREQUEST_SOURCE && task.span && !task.span.ended) {
        task.span.end()
      }
    }
    zoneService.spec.onBeforeInvokeTask = onBeforeInvokeTask

    function onScheduleTask (task) {
      if (task.source === XMLHTTPREQUEST_SOURCE) {
        var url = task['XHR']['url']
        var spanName = task['XHR']['method'] + ' '
        if (transactionService._config.get('includeXHRQueryString')) {
          spanName = spanName + url
        } else {
          var parsed = utils.parseUrl(url)
          spanName = spanName + parsed.path
        }

        var span = transactionService.startSpan(spanName, 'external.http')
        task.span = span
      } else if (task.type === 'interaction') {
        if (typeof transactionService.interactionStarted === 'function') {
          transactionService.interactionStarted(task)
        }
      }
      transactionService.addTask(task.taskId)
    }
    zoneService.spec.onScheduleTask = onScheduleTask

    function onInvokeTask (task) {
      if (task.source === XMLHTTPREQUEST_SOURCE && task.span && !task.span.ended) {
        task.span.end()
      }
      transactionService.removeTask(task.taskId)
      transactionService.detectFinish()
    }
    zoneService.spec.onInvokeTask = onInvokeTask

    function onCancelTask (task) {
      transactionService.removeTask(task.taskId)
      transactionService.detectFinish()
    }
    zoneService.spec.onCancelTask = onCancelTask
    function onInvokeEnd (task) {
      logger.trace('onInvokeEnd', 'source:', task.source, 'type:', task.type)
      transactionService.detectFinish()
    }
    zoneService.spec.onInvokeEnd = onInvokeEnd

    function onInvokeStart (task) {
      logger.trace('onInvokeStart', 'source:', task.source, 'type:', task.type)
    }
    zoneService.spec.onInvokeStart = onInvokeStart
  }

  shouldCreateTransaction () {
    return this._config.isActive() && this._zoneService.isApmZone()
  }

  runOuter (fn, applyThis, applyArgs) {
    return this._zoneService.runOuter(fn, applyThis, applyArgs)
  }
}

module.exports = ZoneTransactionService
