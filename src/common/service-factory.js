var ApmServer = require('./apm-server')
var ConfigService = require('./config-service')
var LoggingService = require('./logging-service')

var patchUtils = require('./patching/patch-utils')
var utils = require('./utils')
class ServiceFactory {
  constructor () {
    this._serviceCreators = {}
    this._serviceInstances = {}
    this.initialized = false
  }

  registerCoreServices () {
    var serviceFactory = this

    this.registerServiceCreator('ConfigService', function () {
      return new ConfigService()
    })
    this.registerServiceCreator('LoggingService', function () {
      return new LoggingService()
    })
    this.registerServiceCreator('ApmServer', function () {
      return new ApmServer(
        serviceFactory.getService('ConfigService'),
        serviceFactory.getService('LoggingService')
      )
    })

    this.registerServiceInstance('PatchUtils', patchUtils)
    this.registerServiceInstance('Utils', utils)
  }
  init () {
    if (this.initialized) {
      return
    }
    this.initialized = true
    var serviceFactory = this

    var configService = serviceFactory.getService('ConfigService')
    configService.init()
    var loggingService = serviceFactory.getService('LoggingService')

    function setLogLevel (loggingService, configService) {
      if (configService.get('debug') === true && configService.config.logLevel !== 'trace') {
        loggingService.setLevel('debug', false)
      } else {
        loggingService.setLevel(configService.get('logLevel'), false)
      }
    }

    setLogLevel(loggingService, configService)
    configService.subscribeToChange(function () {
      setLogLevel(loggingService, configService)
    })

    var apmServer = serviceFactory.getService('ApmServer')
    apmServer.init()
  }

  registerServiceCreator (name, creator) {
    this._serviceCreators[name] = creator
  }

  registerServiceInstance (name, instance) {
    this._serviceInstances[name] = instance
  }

  getService (name) {
    if (!this._serviceInstances[name]) {
      if (typeof this._serviceCreators[name] === 'function') {
        this._serviceInstances[name] = this._serviceCreators[name](this)
      } else {
        throw new Error('Can not get service, No creator for: ' + name)
      }
    }
    return this._serviceInstances[name]
  }
}

module.exports = ServiceFactory
