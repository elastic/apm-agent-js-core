var NDJSON = require('../../src/common/ndjson')
describe('NDJSON', function () {
  it('should stringify', function () {
    var result = NDJSON.stringify({ test: 'passed' })
    expect(result).toBe('{"test":"passed"}\n')
  })
})
