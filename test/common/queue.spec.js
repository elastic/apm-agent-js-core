var Queue = require('../../src/common/queue')

describe('Queue', function () {
  it('should work for default options', function (done) {
    var flushCounter = 0
    var items = []
    var queue = new Queue(function (qitems) {
      expect(qitems).toEqual(items)
      flushCounter++
    })
    for (var i = 0; i < 100; i++) {
      items.push(i)
      queue.add(i)
    }
    setTimeout(() => {
      expect(flushCounter).toBe(1)
      done()
    }, 100)
  })

  it('should flush when reaching queueLimit', function (done) {
    var flushCounter = 0
    var items = []
    var queue = new Queue(
      function (qitems) {
        flushCounter++
        if (flushCounter > 5) {
          expect(qitems.length).toBe(5)
        } else {
          expect(qitems.length).toBe(20)
        }
      },
      {
        queueLimit: 20
      }
    )

    for (var i = 0; i < 105; i++) {
      items.push(i)
      queue.add(i)
    }
    setTimeout(() => {
      expect(flushCounter).toBe(6)
      done()
    }, 100)
  })

  it('should flush according to the interval', function (done) {
    var flushCounter = 0
    var items = []
    var queue = new Queue(
      function (qitems) {
        expect(qitems).toEqual(items)
        flushCounter++
      },
      {
        flushInterval: 100
      }
    )

    for (var i = 0; i < 105; i++) {
      items.push(i)
      queue.add(i)
    }
    expect(flushCounter).toBe(0)
    setTimeout(() => {
      expect(flushCounter).toBe(1)
      done()
    }, 200)
  })
})
