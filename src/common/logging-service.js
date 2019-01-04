const { noop } = require('./utils')

class LoggingService {
  constructor (spec) {
    if (!spec) spec = {}
    this.levels = ['trace', 'debug', 'info', 'warn', 'error']
    this.level = spec.level || 'info'
    this.prefix = spec.prefix || ''

    this.resetLogMethods()
  }

  shouldLog (level) {
    return this.levels.indexOf(level) >= this.levels.indexOf(this.level)
  }

  setLevel (level) {
    this.level = level
    this.resetLogMethods()
  }

  resetLogMethods () {
    var loggingService = this
    this.levels.forEach(function (level) {
      loggingService[level] = loggingService.shouldLog(level) ? log : noop

      function log () {
        var prefix = loggingService.prefix
        var normalizedLevel

        switch (level) {
          case 'trace':
            normalizedLevel = 'info'
            break
          case 'debug':
            normalizedLevel = 'info'
            break
          default:
            normalizedLevel = level
        }
        var args = arguments
        if (prefix) {
          if (typeof prefix === 'function') prefix = prefix(level)
          args[0] = prefix + args[0]
        }
        if (console) {
          var realMethod = console[normalizedLevel] ? console[normalizedLevel] : console.log
          if (typeof realMethod === 'function') {
            realMethod.apply(console, args)
          }
        }
      }
    })
  }
}

module.exports = LoggingService
