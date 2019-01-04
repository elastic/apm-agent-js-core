class Subscription {
  constructor () {
    this.subscriptions = []
  }

  subscribe (fn) {
    this.subscriptions.push(fn)

    return () => {
      var index = this.subscriptions.indexOf(fn)
      if (index > -1) {
        this.subscriptions.splice(index, 1)
      }
    }
  }

  applyAll (applyTo, applyWith) {
    this.subscriptions.forEach(fn => {
      try {
        fn.apply(applyTo, applyWith)
      } catch (error) {
        console.log(error, error.stack)
      }
    }, this)
  }
}

module.exports = Subscription
