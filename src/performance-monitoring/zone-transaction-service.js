var TransactionService = require('./transaction-service')
var utils = require('../common/utils')

class ZoneTransactionService extends TransactionService {

  constructor (zoneService, logger, config) {
    super(logger, config)

    var transactionService = this

    this._zoneService = zoneService
    function onBeforeInvokeTask (task) {
      if (task.source === 'XMLHttpRequest.send' && task.span && !task.span.ended) {
        task.span.end()
      }
      transactionService.logInTransaction('Executing', task.taskId)
    }
    zoneService.spec.onBeforeInvokeTask = onBeforeInvokeTask

    function onScheduleTask (task) {
      if (task.source === 'XMLHttpRequest.send') {
        var url = task['XHR']['url']
        var spanSignature = task['XHR']['method'] + ' '
        if (transactionService._config.get('includeXHRQueryString')) {
          spanSignature = spanSignature + url
        } else {
          var parsed = utils.parseUrl(url)
          spanSignature = spanSignature + parsed.path
        }

        var span = transactionService.startSpan(spanSignature, 'ext.HttpRequest')
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
      if (task.source === 'XMLHttpRequest.send' && task.span && !task.span.ended) {
        task.span.end()
        transactionService.logInTransaction('xhr late ending')
        transactionService.setDebugDataOnTransaction('xhrLateEnding', true)
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
