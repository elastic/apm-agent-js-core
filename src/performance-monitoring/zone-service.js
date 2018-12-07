var Subscription = require('../common/subscription')
var patchUtils = require('../common/patching/patch-utils')
var apmTaskSymbol = patchUtils.apmSymbol('taskData')

var urlSympbol = patchUtils.apmSymbol('url')
var methodSymbol = patchUtils.apmSymbol('method')

var XMLHttpRequestSend = 'XMLHttpRequest.send'

var apmDataSymbol = patchUtils.apmSymbol('apmData')

var testTransactionAfterEvents = [
  'click',
  'contextmenu',
  'dblclick',
  'mousedown',
  'keydown',
  'keypress',
  'keyup'
] // leave these out for now: 'mouseenter', 'mouseleave', 'mousemove', 'mouseout', 'mouseover',
var testTransactionAfterEventsObj = {}
testTransactionAfterEvents.forEach(function (ev) {
  testTransactionAfterEventsObj[ev] = 1
})

function ZoneService (logger) {
  this.events = new Subscription()

  var nextId = 0

  // var zoneService = this
  function noop () {}
  var spec = (this.spec = {
    onScheduleTask: noop,
    onBeforeInvokeTask: noop,
    onInvokeTask: noop,
    onCancelTask: noop,
    onHandleError: noop,
    onInvokeStart: noop,
    onInvokeEnd: noop
  })

  this.zoneConfig = {
    name: 'apmRootZone',
    onScheduleTask: function (parentZoneDelegate, currentZone, targetZone, task) {
      logger.trace('zoneservice.onScheduleTask', task.source, ' type:', task.type)
      if (task.type === 'eventTask') {
        var target = task.data.taskData.target
        var eventName = task.data.taskData.eventName

        if (target && typeof target[apmDataSymbol] === 'undefined') {
          target[apmDataSymbol] = { registeredEventListeners: {} }
        }

        if (task.type === 'eventTask' && eventName === 'apmImmediatelyFiringEvent') {
          task.callback(task.data.taskData)
          return task
        }

        if (target && (eventName === 'readystatechange' || eventName === 'load')) {
          target[apmDataSymbol].registeredEventListeners[eventName] = {
            resolved: false
          }
        }
      } else if (task.type === 'macroTask') {
        logger.trace('Zone: ', targetZone.name)
        var taskId = nextId++
        var apmTask = {
          taskId: task.source + taskId,
          source: task.source,
          type: task.type
        }

        if (task.source === 'setTimeout') {
          if (task.data.args[1] === 0 || typeof task.data.args[1] === 'undefined') {
            task[apmTaskSymbol] = apmTask
            spec.onScheduleTask(apmTask)
          }
        } else if (task.source === XMLHttpRequestSend) {
          /*
                  "XMLHttpRequest.addEventListener:load"
                  "XMLHttpRequest.addEventListener:error"
                  "XMLHttpRequest.addEventListener:abort"
                  "XMLHttpRequest.send"
                  "XMLHttpRequest.addEventListener:readystatechange"
          */

          apmTask['XHR'] = {
            resolved: false,
            send: false,
            url: task.data.target[urlSympbol],
            method: task.data.target[methodSymbol]
          }

          // target for event tasks is different instance from the XMLHttpRequest, on mobile browsers
          // A hack to get the correct target for event tasks
          task.data.target.addEventListener('apmImmediatelyFiringEvent', function (event) {
            if (typeof event.target[apmDataSymbol] !== 'undefined') {
              task.data.target[apmDataSymbol] = event.target[apmDataSymbol]
            } else {
              task.data.target[apmDataSymbol] = event.target[apmDataSymbol] = {
                registeredEventListeners: {}
              }
            }
          })

          task.data.target[apmDataSymbol].task = apmTask
          task.data.target[apmDataSymbol].typeName = 'XMLHttpRequest'

          spec.onScheduleTask(apmTask)
        }
      } else if (task.type === 'microTask' && task.source === 'Promise.then') {
        taskId = nextId++
        apmTask = {
          taskId: task.source + taskId,
          source: task.source,
          type: task.type
        }

        task[apmTaskSymbol] = apmTask
        spec.onScheduleTask(apmTask)
      }

      var delegateTask = parentZoneDelegate.scheduleTask(targetZone, task)
      return delegateTask
    },
    onInvoke: function (
      parentZoneDelegate,
      currentZone,
      targetZone,
      delegate,
      applyThis,
      applyArgs,
      source
    ) {
      var taskId = nextId++
      var apmTask = {
        taskId: source + taskId,
        source: source,
        type: 'invoke'
      }
      spec.onInvokeStart(apmTask)
      var result = delegate.apply(applyThis, applyArgs)
      spec.onInvokeEnd(apmTask)
      return result
    },
    onInvokeTask: function (
      parentZoneDelegate,
      currentZone,
      targetZone,
      task,
      applyThis,
      applyArgs
    ) {
      spec.onInvokeStart({ source: task.source, type: task.type })
      logger.trace('zoneservice.onInvokeTask', task.source, ' type:', task.type)
      var target = task.target || (task.data && task.data.target)
      var eventName = task.eventName
      var result

      if (target && target[apmDataSymbol].typeName === 'XMLHttpRequest') {
        var apmData = target[apmDataSymbol]
        logger.trace('apmData', apmData)
        var apmTask = apmData.task
        if (apmTask && eventName === 'readystatechange' && target.readyState === target.DONE) {
          apmData.registeredEventListeners['readystatechange'].resolved = true
          spec.onBeforeInvokeTask(apmTask)
        } else if (apmTask && eventName === 'load' && 'load' in apmData.registeredEventListeners) {
          apmData.registeredEventListeners.load.resolved = true
        } else if (apmTask && task.source === XMLHttpRequestSend) {
          apmTask.XHR.resolved = true
        }

        result = parentZoneDelegate.invokeTask(targetZone, task, applyThis, applyArgs)
        if (
          apmTask &&
          (!apmData.registeredEventListeners['load'] ||
            apmData.registeredEventListeners['load'].resolved) &&
          (!apmData.registeredEventListeners['readystatechange'] ||
            apmData.registeredEventListeners['readystatechange'].resolved) &&
          apmTask.XHR.resolved
        ) {
          spec.onInvokeTask(apmTask)
        }
      } else if (
        task[apmTaskSymbol] &&
        (task.source === 'setTimeout' || task.source === 'Promise.then')
      ) {
        spec.onBeforeInvokeTask(task[apmTaskSymbol])
        result = parentZoneDelegate.invokeTask(targetZone, task, applyThis, applyArgs)
        spec.onInvokeTask(task[apmTaskSymbol])
      } else if (
        task.type === 'eventTask' &&
        target &&
        eventName in testTransactionAfterEventsObj
      ) {
        var taskId = nextId++
        apmTask = {
          taskId: task.source + taskId,
          source: task.source,
          type: 'interaction',
          applyArgs: applyArgs
        }

        spec.onScheduleTask(apmTask)

        // clear spans on the zone transaction
        result = parentZoneDelegate.invokeTask(targetZone, task, applyThis, applyArgs)
        spec.onInvokeTask(apmTask)
      } else {
        result = parentZoneDelegate.invokeTask(targetZone, task, applyThis, applyArgs)
      }
      spec.onInvokeEnd({ source: task.source, type: task.type })
      return result
    },
    onCancelTask: function (parentZoneDelegate, currentZone, targetZone, task) {
      // logger.trace('Zone: ', targetZone.name)
      var apmTask
      if (task.type === 'macroTask') {
        if (task.source === XMLHttpRequestSend) {
          apmTask = task.data.target[apmDataSymbol].task
          spec.onCancelTask(apmTask)
        } else if (task[apmTaskSymbol] && task.source === 'setTimeout') {
          apmTask = task[apmTaskSymbol]
          spec.onCancelTask(apmTask)
        }
      }
      return parentZoneDelegate.cancelTask(targetZone, task)
    }
    // onHandleError: function (parentZoneDelegate, currentZone, targetZone, error) {
    //   spec.onHandleError(error)
    //   parentZoneDelegate.handleError(targetZone, error)
    // }
  }
}

ZoneService.prototype.initialize = function (zone) {
  this.outer = zone
  this.zone = zone.fork(this.zoneConfig)
}

ZoneService.prototype.set = function (key, value) {
  window.Zone.current._properties[key] = value
}
ZoneService.prototype.get = function (key) {
  return window.Zone.current.get(key)
}

ZoneService.prototype.getFromApmZone = function (key) {
  return this.zone.get(key)
}
ZoneService.prototype.setOnApmZone = function (key, value) {
  this.zone._properties[key] = value
}

ZoneService.prototype.getCurrentZone = function () {
  return window.Zone.current
}

ZoneService.prototype.isApmZone = function () {
  return this.zone.name === window.Zone.current.name
}

ZoneService.prototype.runOuter = function (fn, applyThis, applyArgs) {
  if (this.outer) {
    return this.outer.run(fn, applyThis, applyArgs)
  } else {
    return fn.apply(applyThis, applyArgs)
  }
}

ZoneService.prototype.runInApmZone = function runInApmZone (fn, applyThis, applyArgs, source) {
  return this.zone.run(fn, applyThis, applyArgs, source || 'runInApmZone:' + fn.name)
}

module.exports = ZoneService
