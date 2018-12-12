var PerformanceMonitoring = require('./performance-monitoring')
var TransactionService = require('./transaction-service')

module.exports = {
  PerformanceMonitoring: PerformanceMonitoring,
  registerServices: function registerServices (serviceFactory) {
    serviceFactory.registerServiceCreator('TransactionService', function () {
      var configService = serviceFactory.getService('ConfigService')
      var loggingService = serviceFactory.getService('LoggingService')
      return new TransactionService(loggingService, configService)
    })

    serviceFactory.registerServiceCreator('PerformanceMonitoring', function () {
      var configService = serviceFactory.getService('ConfigService')
      var loggingService = serviceFactory.getService('LoggingService')
      var apmService = serviceFactory.getService('ApmServer')
      var zoneService
      var transactionService = serviceFactory.getService('TransactionService')
      return new PerformanceMonitoring(
        apmService,
        configService,
        loggingService,
        zoneService,
        transactionService
      )
    })
  }
}
