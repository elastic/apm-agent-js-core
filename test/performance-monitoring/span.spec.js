var Span = require('../../src/performance-monitoring/span')
describe('Span', function () {
    it('should return null for duration if not ended', function () {
        var s = new Span('test', 'test')
        expect(s.duration()).toBe(null)
    })

    it('should support dot delimiter in span types', function () {
        var s1 = new Span('test1', 'db.mysql.query')
        expect(s1.type).toBe('db');
        expect(s1.subType).toBe('mysql');
        expect(s1.action).toBe('query');

        var s2 = new Span('test2', 'db-query');
        expect(s2.type).toBe('db-query');
        expect(s2.subType).toBe(undefined);
        expect(s2.action).toBe(undefined);
    })
})