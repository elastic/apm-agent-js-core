require('./patch')
var patchSubscription = window['__patchSubscription']
var patchUtils = require('../../src/common/patching/patch-utils')

describe('xhrPatch', function () {
  var events = []
  var cancelFn

  beforeAll(function () {
    cancelFn = patchSubscription.subscribe(function (event, task) {
      events.push({
        event,
        task
      })
    })
  })

  afterAll(function () {
    cancelFn()
  })

  beforeEach(function () {
    events = []
  })

  if (window.fetch) {
    it('should fetch correctly', function (done) {
      var promise = window.fetch('/')
      expect(promise).toBeDefined()
      expect(typeof promise.then).toBe('function')
      expect(events.map(e => e.event)).toEqual(['schedule'])
      promise.then(function (resp) {
        expect(resp).toBeDefined()
        expect(events.map(e => e.event)).toEqual(['schedule', 'invoke'])
        done()
      })
    })

    it('should handle fetch polyfill errors', function (done) {
      window['__fetchDelegate'] = function () {
        throw new Error('fetch error')
      }

      var promise = window.fetch('/')
      expect(promise).toBeDefined()
      promise.catch(function (error) {
        expect(error).toBeDefined()
        expect(error.message).toContain('fetch error')
        done()
      })
      window['__fetchDelegate'] = undefined
    })

    it('should support native fetch exception', function (done) {
      var promise = window.fetch()
      expect(promise).toBeDefined()
      promise.catch(function (error) {
        // can not check the native error message since it's different in browsers
        expect(error.message).toBeDefined()
        done()
      })
    })

    it('should support native fetch alternative call format', function (done) {
      var promise = window.fetch(new Request('/'))
      expect(promise).toBeDefined()
      promise
        .then(function () {
          done()
        })
        .catch(function (error) {
          fail(error)
        })
    })

    it('should produce task events when fetch fails', function (done) {
      var promise = window.fetch('http://localhost:54321/')
      promise.catch(function (error) {
        expect(error).toBeDefined()
        expect(events.map(e => e.event)).toEqual(['schedule', 'invoke'])
        done()
      })
    })
    it('should reset fetchInProgress global state', function () {
      expect(patchUtils.globalState.fetchInProgress).toBe(false)
      window.fetch('http://localhost:54321/')
      expect(patchUtils.globalState.fetchInProgress).toBe(false)
    })
  }
})
