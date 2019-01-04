const {
  getCurrentScript,
  arrayMap,
  arrayReduce,
  arraySome,
  sanitizeString,
  setTag,
  functionBind,
  arrayIndexOf,
  merge
} = require('./utils')
const Subscription = require('../common/subscription')
const constants = require('./constants')

function getConfigFromScript () {
  var script = getCurrentScript()
  var config = getDataAttributesFromNode(script)
  return config
}

function getDataAttributesFromNode (node) {
  if (!node) {
    return {}
  }
  var dataAttrs = {}
  var dataRegex = /^data-([\w-]+)$/
  var attrs = node.attributes
  for (var i = 0; i < attrs.length; i++) {
    var attr = attrs[i]
    if (dataRegex.test(attr.nodeName)) {
      var key = attr.nodeName.match(dataRegex)[1]

      // camelCase key
      key = arrayMap(key.split('-'), function (group, index) {
        return index > 0 ? group.charAt(0).toUpperCase() + group.substring(1) : group
      }).join('')

      dataAttrs[key] = attr.value || attr.nodeValue
    }
  }

  return dataAttrs
}

class Config {
  constructor () {
    this.config = {}
    this.defaults = {
      serviceName: '',
      serviceVersion: '',
      agentName: 'js-base',
      agentVersion: '%%agent-version%%',
      serverUrl: 'http://localhost:8200',
      serverUrlPrefix: '/intake/v2/rum/events',
      active: true,
      isInstalled: false,
      debug: false,
      logLevel: 'warn',
      // performance monitoring
      browserResponsivenessInterval: 500,
      browserResponsivenessBuffer: 3,
      checkBrowserResponsiveness: true,
      enable: true,
      groupSimilarSpans: true,
      similarSpanThreshold: 0.05,
      includeXHRQueryString: false,
      capturePageLoad: true,
      ignoreTransactions: [],
      // throttlingRequestLimit: 20,
      // throttlingInterval: 30000, // 30s
      errorThrottleLimit: 20,
      errorThrottleInterval: 30000,
      transactionThrottleLimit: 20,
      transactionThrottleInterval: 30000,
      transactionDurationThreshold: 60000,

      queueLimit: -1,
      flushInterval: 500,

      sendPageLoadTransaction: true,

      serverStringLimit: constants.serverStringLimit,

      distributedTracing: true,
      distributedTracingOrigins: [],
      distributedTracingHeaderValueCallback: undefined,
      distributedTracingHeaderName: 'elastic-apm-traceparent',

      pageLoadTraceId: undefined,
      pageLoadSpanId: undefined,
      pageLoadSampled: undefined,
      pageLoadTransactionName: undefined,

      transactionSampleRate: 1.0,

      context: {},
      platform: {}
    }

    this._changeSubscription = new Subscription()
    this.filters = []
  }

  isActive () {
    return this.get('active')
  }

  addFilter (cb) {
    if (typeof cb !== 'function') {
      throw new Error('Argument to must be function')
    }
    this.filters.push(cb)
  }

  applyFilters (data) {
    for (var i = 0; i < this.filters.length; i++) {
      data = this.filters[i](data)
      if (!data) {
        return
      }
    }
    return data
  }

  init () {
    var scriptData = getConfigFromScript()
    this.setConfig(scriptData)
  }

  get (key) {
    return arrayReduce(
      key.split('.'),
      function (obj, i) {
        return obj && obj[i]
      },
      this.config
    )
  }

  getEndpointUrl () {
    var url = this.get('serverUrl') + this.get('serverUrlPrefix')
    return url
  }
  set (key, value) {
    var levels = key.split('.')
    var maxLevel = levels.length - 1
    var target = this.config

    arraySome(levels, function (level, i) {
      if (typeof level === 'undefined') {
        return true
      }
      if (i === maxLevel) {
        target[level] = value
      } else {
        var obj = target[level] || {}
        target[level] = obj
        target = obj
      }
    })
  }

  setUserContext (userContext) {
    var context = {}
    if (typeof userContext.id === 'number') {
      context.id = userContext.id
    }
    if (typeof userContext.id === 'string') {
      context.id = sanitizeString(userContext.id, this.get('serverStringLimit'))
    }
    if (typeof userContext.username === 'string') {
      context.username = sanitizeString(userContext.username, this.get('serverStringLimit'))
    }
    if (typeof userContext.email === 'string') {
      context.email = sanitizeString(userContext.email, this.get('serverStringLimit'))
    }
    this.set('context.user', context)
  }

  setCustomContext (customContext) {
    if (customContext && typeof customContext === 'object') {
      this.set('context.custom', customContext)
    }
  }

  setTag (key, value) {
    if (!key) return
    if (!this.config.context.tags) {
      this.config.context.tags = {}
    }

    setTag(key, value, this.config.context.tags)
  }

  // deprecated
  setTags (tags) {
    console.log('APM: setTags is deprecated, please use addTags instead.')
    this.addTags(tags)
  }

  addTags (tags) {
    var configService = this
    var keys = Object.keys(tags)
    keys.forEach(function (k) {
      configService.setTag(k, tags[k])
    })
  }

  getAgentName () {
    var version = this.config['agentVersion']
    if (!version) {
      version = 'dev'
    }
    return this.get('agentName') + '/' + version
  }

  setConfig (properties) {
    properties = properties || {}
    this.config = merge({}, this.defaults, this.config, properties)

    this._changeSubscription.applyAll(this, [this.config])
  }

  subscribeToChange (fn) {
    return this._changeSubscription.subscribe(fn)
  }

  isValid () {
    var requiredKeys = ['serviceName', 'serverUrl']
    var values = arrayMap(
      requiredKeys,
      functionBind(function (key) {
        return (
          this.config[key] === null || this.config[key] === undefined || this.config[key] === ''
        )
      }, this)
    )

    return arrayIndexOf(values, true) === -1
  }
}

module.exports = Config
