var karmaUtils = require('./dev-utils/karma.js')
var testUtils = require('./dev-utils/test.js')

module.exports = function (config) {
  config.set(karmaUtils.baseConfig)
  var env = testUtils.getTestEnvironmentVariables()
  var customConfig = {
    globalConfigs: {
      useMocks: false,
      agentConfig: {
        serverUrl: 'http://localhost:8200',
        serviceName: 'test',
        serviceVersion: 'test-version',
        agentName: 'apm-js-core',
        agentVersion: '0.0.1'
      }
    },
    testConfig: env
  }

  if (env.serverUrl) {
    customConfig.globalConfigs.agentConfig.serverUrl = env.serverUrl
  }

  console.log('customConfig:', JSON.stringify(customConfig, undefined, 2))
  config.set(customConfig)
  config.set({
    files: [
      'test/**/*.bench.js'
    ],
    frameworks: [
      'benchmark'
    ],
    reporters: [
      'benchmark',
      'benchmark-json'
    ],
    plugins: [
      'karma-webpack',
      'karma-sourcemap-loader',
      'karma-benchmark',
      'karma-benchmark-reporter',
      'karma-benchmark-json-reporter'
    ],
    preprocessors: {
      'test/**/*.bench.js': ['webpack', 'sourcemap']
    },
    benchmarkJsonReporter: {
      pathToJson: 'reports/benchmark-results.json',
      formatOutput: function (results) {
        var summary = results.map((r) => {
          return { name: `${r.suite}.${r.name}`, mean: r.mean, hz: r.hz }
        })
        console.log(JSON.stringify(summary, undefined, 2))
        return { results: results }
      }
    }
  })
  var cfg = karmaUtils.prepareConfig(config)
  cfg.preprocessors = {
    'test/**/*.bench.js': ['webpack', 'sourcemap']
  }
  cfg.browsers = ['ChromeHeadless']
  config.set(cfg)
}
