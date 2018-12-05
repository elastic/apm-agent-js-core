var LoggingService = require('../../src/common/logging-service')
describe('LoggingService', function () {
  var loggingService
  beforeEach(function () {
    loggingService = new LoggingService({})
  })
  it('should log', function () {
    expect(loggingService.level).toBe('info')
    // eslint-disable-next-line
    var hasTrace = false
    if (typeof console.trace === 'function') {
      spyOn(console, 'trace')
      hasTrace = true
    }
    spyOn(console, 'info')
    spyOn(console, 'warn')
    spyOn(console, 'error')

    loggingService.info('info')
    expect(console.info).toHaveBeenCalledWith('info')
    console.info.calls.reset()

    loggingService.setLevel('trace')
    loggingService.trace('trace')
    expect(console.info).toHaveBeenCalledWith('trace')
    console.info.calls.reset()

    loggingService.setLevel('debug')
    loggingService.debug('debug')
    expect(console.info).toHaveBeenCalledWith('debug')
    console.info.calls.reset()

    loggingService.setLevel('warn')
    loggingService.warn('warn')
    loggingService.info('info')
    expect(console.warn).toHaveBeenCalledWith('warn')
    expect(console.info).not.toHaveBeenCalled()
    console.warn.calls.reset()

    loggingService.setLevel('error')
    loggingService.error('error')
    loggingService.info('info')
    expect(console.error).toHaveBeenCalledWith('error')
    expect(console.info).not.toHaveBeenCalled()
    console.error.calls.reset()

    loggingService.setLevel('blah')
    loggingService.trace('blah')
    expect(console.info).toHaveBeenCalledWith('blah')
  })

  it('should check if console is defined', function () {
    expect(loggingService.level).toBe('info')
    spyOn(console, 'log')
    var _info = console.info
    console.info = undefined
    loggingService.info('test')
    expect(console.log).toHaveBeenCalled()
    var _log = console.log
    console.log = undefined
    expect(console.log).toBe(undefined)
    loggingService.info('test')
    var _console = console
    window.console = undefined
    loggingService.info('test')

    _console.log = _log
    _console.info = _info
    window.console = _console
  })

  it('should set prefix for logs', function () {
    spyOn(console, 'info')
    loggingService = new LoggingService({
      prefix: 'APM: '
    })
    loggingService.info('info')
    expect(console.info).toHaveBeenCalledWith('APM: info')
  })
})
