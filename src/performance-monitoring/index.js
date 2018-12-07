var PerformanceMonitoring = require('./performance-monitoring')
var TransactionService = require('./transaction-service')

module.exports = {
  PerformanceMonitoring: PerformanceMonitoring,
  registerServices: function registerServices (serviceFactory) {
    var configService = serviceFactory.getService('ConfigService')
    var loggingService = serviceFactory.getService('LoggingService')

    serviceFactory.registerServiceCreator('TransactionService', function () {
      return new TransactionService(loggingService, configService)
    })

    serviceFactory.registerServiceCreator('PerformanceMonitoring', function () {
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
