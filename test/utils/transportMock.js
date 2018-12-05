var Subscription = require('../../src/common/subscription')

function TransportMock (transport) {
  this._transport = transport
  this.transactions = []
  this.subscription = new Subscription()
  this.errors = []
  this.transactionInterceptor = undefined
}

TransportMock.prototype.sendTransaction = function (data, headers) {
  var transactinData = { data: data, headers: headers }
  this.transactions.push(transactinData)
  var trMock = this
  if (typeof trMock.transactionInterceptor === 'function') {
    return trMock.transactionInterceptor(data, headers)
  } else if (this._transport) {
    return this._transport.sendTransaction(data, headers).then(
      function () {
        trMock.subscription.applyAll(this, ['sendTransaction', transactinData])
      },
      function (reason) {
        console.log('Failed to send to apm server: ', reason)
      }
    )
  } else {
    this.subscription.applyAll(this, ['sendTransaction', transactinData])
    return new Promise(function (resolve, reject) {
      resolve()
    })
  }
}

TransportMock.prototype.subscribe = function (fn) {
  return this.subscription.subscribe(fn)
}

TransportMock.prototype.sendError = function (data, headers) {
  var errorData = { data: data, headers: headers }
  this.errors.push(errorData)
  this.subscription.applyAll(this, ['sendError', errorData])
}

module.exports = TransportMock
