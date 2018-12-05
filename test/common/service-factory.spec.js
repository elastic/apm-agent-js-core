describe('ServiceFactory', function () {
  var ServiceFactory = require('../../src/common/service-factory')

  var configService
  var loggingService
  beforeEach(function () {
    var serviceFactory = new ServiceFactory()
    serviceFactory.registerCoreServices()
    serviceFactory.init()
    configService = serviceFactory.getService('ConfigService')

    loggingService = serviceFactory.getService('LoggingService')
    spyOn(loggingService, 'debug')
  })

  it('should set correct log level', function () {
    expect(configService.get('debug')).toBe(false)
    expect(configService.get('logLevel')).toBe('warn')
    expect(loggingService.level).toBe('warn')

    configService.setConfig({ debug: true })
    expect(configService.get('debug')).toBe(true)
    expect(loggingService.level).toBe('debug')

    configService.setConfig({ debug: false })
    expect(configService.get('debug')).toBe(false)
    expect(loggingService.level).toBe('warn')

    configService.setConfig({ logLevel: 'trace', debug: true })
    expect(loggingService.level).toBe('trace')

    configService.setConfig({ logLevel: 'warn', debug: false })
    expect(loggingService.level).toBe('warn')
  })
})
