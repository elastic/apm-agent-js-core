var utils = require('../../src/common/utils')
var Span = require('../../src/performance-monitoring/span')

describe('lib/utils', function () {
  it('should merge objects', function () {
    var result = utils.merge({ a: 'a' }, { b: 'b', a: 'b' })
    expect(result).toEqual(Object({ a: 'b', b: 'b' }))

    var deepMerged = utils.merge({ a: { c: 'c' } }, { b: 'b', a: { d: 'd' } })
    expect(deepMerged).toEqual(Object({ a: Object({ c: 'c', d: 'd' }), b: 'b' }))

    var a = { a: { c: 'c' } }
    deepMerged = utils.merge({}, a, { b: 'b', a: { d: 'd' } })
    expect(deepMerged).toEqual(Object({ a: Object({ c: 'c', d: 'd' }), b: 'b' }))
    expect(a).toEqual(Object({ a: Object({ c: 'c' }) }))

    deepMerged = utils.merge({ a: { c: 'c' } }, { b: 'b', a: 'b' })
    expect(deepMerged).toEqual(Object({ a: 'b', b: 'b' }))

    deepMerged = utils.merge({ a: { c: 'c' } }, { b: 'b', a: null })
    expect(deepMerged).toEqual(Object({ a: null, b: 'b' }))

    deepMerged = utils.merge({ a: null }, { b: 'b', a: null })
    expect(deepMerged).toEqual(Object({ a: null, b: 'b' }))
  })

  it('should get elastic script', function () {
    var script = window.document.createElement('script')
    script.src = './elastic-hamid.js'
    script.setAttribute('data-service-name', 'serviceName')
    var html = document.getElementsByTagName('html')[0]
    // html.appendChild(script)
    var theFirstChild = html.firstChild
    html.insertBefore(script, theFirstChild)

    var result = utils.getElasticScript()
    expect(result).toBe(script)
    expect(result.getAttribute('data-service-name')).toBe('serviceName')

    html.removeChild(script)
  })

  describe('parseUrl', function () {
    it('should parse relative url', function () {
      var result = utils.parseUrl(
        '/path?param=value&param2=value2&0=zero&foo&empty=&key=double=double&undefined'
      )
      var expected = {
        protocol: '',
        path: '/path',
        queryString: 'param=value&param2=value2&0=zero&foo&empty=&key=double=double&undefined',
        queryStringParsed: {
          param: 'value',
          param2: 'value2',
          0: 'zero',
          foo: '',
          empty: '',
          key: 'double=double',
          undefined: ''
        },
        hash: ''
      }
      expect(result).toEqual(expected)
    })

    it('should parse absolute url', function () {
      var result = utils.parseUrl('http://test.com/path.js?param=value')
      expect(result).toEqual({
        protocol: 'http:',
        path: 'http://test.com/path.js',
        queryString: 'param=value',
        queryStringParsed: { param: 'value' },
        hash: ''
      })
    })

    it('should parse url with fragment part', function () {
      var result = utils.parseUrl('http://test.com/path?param=value#fragment')
      expect(result).toEqual(
        jasmine.objectContaining({
          path: 'http://test.com/path',
          queryString: 'param=value',
          queryStringParsed: { param: 'value' },
          hash: '#fragment'
        })
      )
    })

    it('should parse url with fragment before query string', function () {
      var result = utils.parseUrl('http://test.com/path#fragment?param=value')
      expect(result).toEqual(
        jasmine.objectContaining({
          path: 'http://test.com/path',
          queryString: '',
          queryStringParsed: {},
          hash: '#fragment?param=value'
        })
      )
    })

    it('should parse url with leading &', function () {
      var result = utils.parseUrl('/path/?&param=value')
      expect(result).toEqual({
        protocol: '',
        path: '/path/',
        queryString: '&param=value',
        queryStringParsed: { param: 'value' },
        hash: ''
      })
    })

    it('should parse url with not querystring', function () {
      var result = utils.parseUrl('/path')
      expect(result).toEqual(
        jasmine.objectContaining({ path: '/path', queryString: '', queryStringParsed: {} })
      )
    })

    it('should parse url with only the querystring', function () {
      var result = utils.parseUrl('?param=value')
      expect(result).toEqual(
        jasmine.objectContaining({
          path: '',
          queryString: 'param=value',
          queryStringParsed: { param: 'value' }
        })
      )
    })
  })

  describe('sanitizeString', function () {
    it('should sanitize', function () {
      expect(utils.sanitizeString()).toBe(undefined)
      expect(utils.sanitizeString(null, 10)).toBe(null)
      expect(utils.sanitizeString(null, 10, true)).toBe('NA')
      expect(utils.sanitizeString(undefined, 10, true)).toBe('NA')
      expect(utils.sanitizeString(undefined, 5, true, 'no string')).toBe('no st')
      expect(utils.sanitizeString('justlong', 5, true, 'no string')).toBe('justl')
      expect(utils.sanitizeString('justlong', undefined, true, 'no string')).toBe('justlong')
      expect(utils.sanitizeString('just', 5, true, 'no string')).toBe('just')
      expect(utils.sanitizeString({ what: 'This is an object' }, 5, true, 'no string')).toBe(
        '[obje'
      )
      expect(utils.sanitizeString(0, 5, true, 'no string')).toBe('0')
      expect(utils.sanitizeString(1, 5, true, 'no string')).toBe('1')
    })

    it('should sanitize objects', function () {
      var result = utils.sanitizeObjectStrings(
        {
          string: 'string',
          null: null,
          undefined: undefined,
          number: 1,
          object: {
            string: 'string'
          }
        },
        3
      )

      expect(result).toEqual({
        string: 'str',
        null: null,
        undefined: undefined,
        number: 1,
        object: {
          string: 'str'
        }
      })

      expect(utils.sanitizeObjectStrings('test', 3)).toBe('tes')
    })
  })

  it('should getNavigationTimingMarks', function () {
    var marks = utils.getNavigationTimingMarks()
    expect(marks.fetchStart).toBeGreaterThanOrEqual(0)
    expect(marks.domInteractive).toBeGreaterThanOrEqual(0)
    expect(marks.domComplete).toBeGreaterThanOrEqual(0)
    expect(marks.loadEventEnd).toBeGreaterThanOrEqual(0)
  })
  it('should generate random ids', function () {
    var result = utils.bytesToHex(utils.rng())
    expect(result.length).toBe(32)

    result = utils.generateRandomId()
    expect(result.length).toBe(32)
    result = utils.generateRandomId(16)
    expect(result.length).toBe(16)

    var array = [252, 192, 107, 62, 0, 43, 190, 201, 129, 49, 251, 159, 243, 81, 153, 192]
    result = utils.bytesToHex(array)
    expect(result).toBe('fcc06b3e002bbec98131fb9ff35199c0')
  })

  it('should identify same origin urls', function () {
    var result = utils.isSameOrigin('/test/new', window.location.href)
    expect(result).toBe(true)
    result = utils.isSameOrigin('http:test.com/test/new', window.location.href)
    expect(result).toBe(false)
    result = utils.isSameOrigin('http://test.com/test/new', [
      window.location.href,
      'http://test.com'
    ])
    expect(result).toBe(true)
    result = utils.isSameOrigin('http://test.com/test/new', [
      window.location.href,
      'http://test1.com',
      'not-url:3000',
      {},
      undefined
    ])
    expect(result).toBe(false)
    result = utils.isSameOrigin('http://test.com/test/new', undefined)
    expect(result).toBe(false)
    result = utils.isSameOrigin(undefined, 'http://test.com/test/new')
    expect(result).toBe(false)
    result = utils.isSameOrigin({}, 'http://test.com/')
    expect(result).toBe(false)
    result = utils.isSameOrigin('test test', 'http://test.com/')
    expect(result).toBe(false)
    result = utils.isSameOrigin('/test', 'http://test.com/')
    expect(result).toBe(false)
    result = utils.isSameOrigin('', 'http://test.com/')
    expect(result).toBe(false)
  })

  it('should generate correct DT headers', function () {
    var span = new Span('test', 'test', { sampled: true, traceId: 'traceId' })
    span.id = 'spanId'
    var headerValue = utils.getDtHeaderValue(span)
    expect(headerValue).toBe('00-traceId-spanId-01')
    span.sampled = false
    headerValue = utils.getDtHeaderValue(span)
    expect(headerValue).toBe('00-traceId-spanId-00')
  })

  it('should validate DT header', function () {
    var result = utils.isDtHeaderValid('00-a1bc6db567095621cdc01dd11359217b-0b5a9e8b3c8fd252-01')
    expect(result).toBe(true)

    result = utils.isDtHeaderValid('00-a1bc6db567095621cdc01dd11359217b-null-01')
    expect(result).toBe(false)

    result = utils.isDtHeaderValid('00-null-0b5a9e8b3c8fd252-01')
    expect(result).toBe(false)

    result = utils.isDtHeaderValid('00-00000000000000000000000000000000-0b5a9e8b3c8fd252-00')
    expect(result).toBe(false)

    result = utils.isDtHeaderValid('00-a1bc6db567095621cdc01dd11359217b-0000000000000000-00')
    expect(result).toBe(false)

    result = utils.isDtHeaderValid('00-12345678901234567890123456789012-.234567890123456-01')
    expect(result).toBe(false)

    result = utils.isDtHeaderValid(
      '00-12345678901234567890123456789012-1234567890123456-01-what-the-future-will-be-like'
    )
    expect(result).toBe(false)
  })
})
