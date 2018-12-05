var ZoneService = require('../../src/performance-monitoring/zone-service')
var patchCommon = require('../../src/common/patching/patch-common')

var LoggingService = require('../../src/common/logging-service')

var logger = new LoggingService()

xdescribe('ZoneService', function () {
  var zoneService
  var originalTimeout

  patchCommon()

  beforeEach(function () {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 50000
  })
  //  can't create a new ZoneService for each test since the old one is also using the global zone
  zoneService = new ZoneService(logger)
  zoneService.initialize(window.Zone.current)
  var noop = function () {}
  function resetZoneCallbacks (zoneService) {
    zoneService.spec.onScheduleTask = noop
    zoneService.spec.onBeforeInvokeTask = noop
    zoneService.spec.onInvokeTask = noop
    zoneService.spec.onCancelTask = noop
    zoneService.spec.onHandleError = noop
  }

  it('should call registered event listeners for XHR', function (done) {
    var response
    var readyStateChangeSpy = jasmine.createSpy('readyStateChangeSpy')
    zoneService.spec.onScheduleTask = function (task) {
      expect(response).toBeUndefined()
      expect(task.XHR.url).toBe('/')
      expect(task.XHR.method).toBe('GET')
    }
    zoneService.spec.onBeforeInvokeTask = function (task) {
      expect(zoneService.spec.onScheduleTask).toHaveBeenCalled()
    }
    zoneService.spec.onInvokeTask = function (task) {
      expect(response).toBeDefined()
      expect(zoneService.spec.onBeforeInvokeTask).toHaveBeenCalled()
      expect(readyStateChangeSpy).toHaveBeenCalled()

      // should call done asynchronously since we're spying in this function in multiple tests
      zoneService.runOuter(function () {
        setTimeout(function () {
          done()
        })
      })
    }

    spyOn(zoneService.spec, 'onScheduleTask').and.callThrough()
    spyOn(zoneService.spec, 'onBeforeInvokeTask').and.callThrough()
    spyOn(zoneService.spec, 'onInvokeTask').and.callThrough()

    zoneService.zone.run(function () {
      function reqListener () {
        response = this.responseText
      }

      var oReq = new window.XMLHttpRequest()
      // In zone.js@0.8.12-prm readystatechange is not registered by default on every request
      oReq.addEventListener('readystatechange', readyStateChangeSpy)
      oReq.addEventListener('load', reqListener)
      oReq.addEventListener('error', function (event) {
        console.log('failed')
      })

      oReq.open('GET', '/', true)
      oReq.send(null)
    })
  })

  it('should keep track of task for XHR if the event listeners are registered after send', function (done) {
    var response
    var readyStateChangeSpy = jasmine.createSpy('readyStateChangeSpy')

    zoneService.spec.onScheduleTask = function (task) {
      expect(response).toBeUndefined()
    }
    zoneService.spec.onBeforeInvokeTask = function (task) {
      expect(zoneService.spec.onScheduleTask).toHaveBeenCalled()
    }
    zoneService.spec.onInvokeTask = function (task) {
      expect(response).toBeDefined()
      expect(zoneService.spec.onBeforeInvokeTask).toHaveBeenCalled()
      expect(readyStateChangeSpy).toHaveBeenCalled()

      // should call done asynchronously since we're spying in this function in multiple tests
      zoneService.runOuter(function () {
        setTimeout(function () {
          done()
        })
      })
    }

    spyOn(zoneService.spec, 'onScheduleTask').and.callThrough()
    spyOn(zoneService.spec, 'onBeforeInvokeTask').and.callThrough()
    spyOn(zoneService.spec, 'onInvokeTask').and.callThrough()

    zoneService.zone.run(function () {
      function reqListener () {
        response = this.responseText
      }

      var oReq = new window.XMLHttpRequest()

      oReq.open('GET', '/', true)
      oReq.send(null)
      oReq.addEventListener('readystatechange', readyStateChangeSpy)
      oReq.addEventListener('load', reqListener)
      oReq.addEventListener('error', function (event) {
        console.log('failed')
      })
    })
  })

  it('should keep track of tasks even if no event listeners are registered', function (done) {
    resetZoneCallbacks(zoneService)

    zoneService.spec.onInvokeTask = function (task) {
      expect(zoneService.spec.onScheduleTask).toHaveBeenCalled()

      // should call done asynchronously since we're spying in this function in multiple tests
      zoneService.runOuter(function () {
        setTimeout(function () {
          done()
        })
      })
    }

    spyOn(zoneService.spec, 'onScheduleTask').and.callThrough()
    spyOn(zoneService.spec, 'onInvokeTask').and.callThrough()

    zoneService.zone.run(function () {
      var oReq = new window.XMLHttpRequest()

      oReq.open('GET', '/', true)
      oReq.send(null)
    })
  })

  it('should call registered event listeners for XHR even if load event is not registered', function (done) {
    var response

    resetZoneCallbacks(zoneService)

    zoneService.spec.onScheduleTask = function (task) {
      expect(response).toBeUndefined()
    }
    zoneService.spec.onBeforeInvokeTask = function (task) {
      expect(zoneService.spec.onScheduleTask).toHaveBeenCalled()
    }
    zoneService.spec.onInvokeTask = function (task) {
      expect(response).toBeDefined()
      expect(zoneService.spec.onBeforeInvokeTask).toHaveBeenCalled()

      // should call done asynchronously since we're spying in this function in multiple tests
      zoneService.runOuter(function () {
        setTimeout(function () {
          done()
        })
      })
    }

    spyOn(zoneService.spec, 'onScheduleTask').and.callThrough()
    spyOn(zoneService.spec, 'onBeforeInvokeTask').and.callThrough()
    spyOn(zoneService.spec, 'onInvokeTask').and.callThrough()

    zoneService.zone.run(function () {
      function reqListener () {
        if (this.readyState === window.XMLHttpRequest.DONE) {
          response = this.responseText
        }
      }

      var oReq = new window.XMLHttpRequest()
      oReq.addEventListener('readystatechange', reqListener)
      oReq.addEventListener('error', function (event) {
        console.log('failed')
      })

      oReq.open('GET', '/', true)
      oReq.send(null)
    })
  })

  it('should not call registered event listeners for setTimeout if timeout > 0', function (done) {
    var callbackFlag = false
    // zoneService = new ZoneService(window.Zone.current.parent, logger)
    resetZoneCallbacks(zoneService)

    spyOn(zoneService.spec, 'onScheduleTask').and.callThrough()
    spyOn(zoneService.spec, 'onInvokeTask').and.callThrough()

    zoneService.spec.onInvokeTask.calls.reset()
    zoneService.spec.onScheduleTask.calls.reset()

    zoneService.zone.run(function () {
      setTimeout(function () {
        callbackFlag = true
      }, 1)

      setTimeout(function () {
        expect(callbackFlag).toBe(true)
        expect(zoneService.spec.onInvokeTask).not.toHaveBeenCalled()
        expect(zoneService.spec.onScheduleTask).not.toHaveBeenCalled()
        done()
      }, 10)
    })
  })

  it('should call registered event listeners for setTimeout if timeout == 0', function (done) {
    var callbackFlag = false
    // zoneService = new ZoneService(window.Zone.current.parent, logger)
    resetZoneCallbacks(zoneService)

    zoneService.spec.onInvokeTask = function (task) {
      expect(callbackFlag).toBe(true)
      expect(zoneService.spec.onScheduleTask).toHaveBeenCalled()
      done()
    }

    spyOn(zoneService.spec, 'onScheduleTask').and.callThrough()
    spyOn(zoneService.spec, 'onInvokeTask').and.callThrough()

    zoneService.zone.run(function () {
      setTimeout(function () {
        callbackFlag = true
      }, 0)
    })
  })

  it('should call registered event listeners for setTimeout if timeout is undefined', function (done) {
    var callbackFlag = false
    resetZoneCallbacks(zoneService)

    zoneService.spec.onInvokeTask = function (task) {
      expect(callbackFlag).toBe(true)
      expect(zoneService.spec.onScheduleTask).toHaveBeenCalled()
      done()
    }

    spyOn(zoneService.spec, 'onScheduleTask').and.callThrough()
    spyOn(zoneService.spec, 'onInvokeTask').and.callThrough()

    zoneService.zone.run(function () {
      setTimeout(function () {
        callbackFlag = true
      })
    })
  })

  it('should not throw if the setTimeout callbackFn is undefined', function (done) {
    resetZoneCallbacks(zoneService)
    zoneService.zone.run(function () {
      setTimeout(undefined, 0)
      done()
    })
  })

  xit('should call registered event listeners for requestAnimationFrame', function (done) {
    var callbackFlag = false
    // zoneService = new ZoneService(window.Zone.current.parent, logger)
    resetZoneCallbacks(zoneService)

    zoneService.spec.onInvokeTask = function (task) {
      expect(callbackFlag).toBe(true)
      expect(zoneService.spec.onScheduleTask).toHaveBeenCalled()
      done()
    }

    spyOn(zoneService.spec, 'onScheduleTask').and.callThrough()
    spyOn(zoneService.spec, 'onInvokeTask').and.callThrough()

    zoneService.zone.run(function () {
      window.requestAnimationFrame(function () {
        callbackFlag = true
      })
    })
  })

  it('should run in the outer zone', function () {
    resetZoneCallbacks(zoneService)
    zoneService.zone.run(function () {
      expect(window.Zone.current.name).toBe('apmRootZone')
      zoneService.runOuter(function () {
        expect(window.Zone.current.name).toBe('<root>')
      })
    })
  })

  it('should work with synchronous XMLHttpRequest', function () {
    window.Zone.current.fork({}).run(function () {
      var req = new window.XMLHttpRequest()
      req.open('get', '/', false)
      req.send()
    })
  })

  it('should work when aborting XMLHttpRequest', function () {
    window.Zone.current.fork({}).run(function () {
      var req = new window.XMLHttpRequest()
      req.open('get', '/')
      req.send()
      req.abort()
    })
  })

  it('should work when canceling setTimeout', function () {
    zoneService.runInApmZone(function () {
      var id = setTimeout(function () {}, 0)
      clearTimeout(id)
    })
  })

  it('should getCurrentZone', function () {
    window.Zone.current.fork({ name: 'testZone' }).run(function () {
      var zone = zoneService.getCurrentZone()
      expect(zone.name).toBe('testZone')
    })
  })

  it('should get and set values on the zone', function () {
    window.Zone.current.fork({ name: 'testZone' }).run(function () {
      zoneService.set('testKey', 'testValue')
      expect(zoneService.get('testKey')).toBe('testValue')
      expect(window.Zone.current.get('testKey')).toBe('testValue')
    })

    zoneService.setOnApmZone('apmKey', 'apmValue')
    var apmValue = zoneService.getFromApmZone('apmKey')
    expect(apmValue).toBe('apmValue')
  })

  it('should test for apm zone', function () {
    zoneService.runOuter(function () {
      expect(zoneService.isApmZone()).toBe(false)
    })
    var result = zoneService.runInApmZone(function () {
      expect(zoneService.isApmZone()).toBe(true)
      return zoneService.runInApmZone(function () {
        expect(zoneService.isApmZone()).toBe(true)
        return 'hamid'
      })
    })
    expect(result).toBe('hamid')
    zoneService.runOuter(function () {
      expect(zoneService.isApmZone()).toBe(false)
      zoneService.runInApmZone(function () {
        expect(zoneService.isApmZone()).toBe(true)
      })
    })
  })
  it('should runOuter even if ZoneService is not initialized', function (done) {
    zoneService = new ZoneService(logger)
    zoneService.runOuter(function () {
      done()
    })
  })

  afterEach(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout
  })
})
