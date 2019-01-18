const ErrorLogging = require('./error-logging')

module.exports = {
  ErrorLogging: ErrorLogging,
  registerServices: function registerServices (serviceFactory) {
    serviceFactory.registerServiceCreator('ErrorLogging', function () {
      const apmService = serviceFactory.getService('ApmServer')
      const configService = serviceFactory.getService('ConfigService')
      const loggingService = serviceFactory.getService('LoggingService')
      const transactionService = serviceFactory.getService('TransactionService')
      return new ErrorLogging(apmService, configService, loggingService, transactionService)
    })
  }
}
