
var navigationTiming = require('../../src/performance-monitoring/capture-hard-navigation')

var resourceEntries = require('./resource-entries.js')

var spanSnapshot = require('./navigation-timing-span-snapshot').map(mapSpan)

function mapSpan(s) { return { signature: s.signature, _end: s._end, _start: s._start } }

describe('navigationTiming', function () {
    it('should createNavigationTimingSpans', function () {
        var timings = {
            "navigationStart": 1528373292350,
            "unloadEventStart": 1528373293147,
            "unloadEventEnd": 1528373293147,
            "redirectStart": 0,
            "redirectEnd": 0,
            "fetchStart": 1528373292356,
            "domainLookupStart": 1528373292356,
            "domainLookupEnd": 1528373292356,
            "connectStart": 1528373292356,
            "connectEnd": 1528373292356,
            "secureConnectionStart": 0,
            "requestStart": 1528373292363,
            "responseStart": 1528373293142,
            "responseEnd": 1528373293303,
            "domLoading": 1528373293176,
            "domInteractive": 1528373293820,
            "domContentLoadedEventStart": 1528373293820,
            "domContentLoadedEventEnd": 1528373293854,
            "domComplete": 1528373295207,
            "loadEventStart": 1528373295208,
            "loadEventEnd": 1528373295230
        }


        var spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Requesting the document, waiting for the first byte", "_end": 786, "_start": 7 },
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Parsing the document, executing sync. scripts", "_end": 1464, "_start": 820 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])

        spans = navigationTiming.createNavigationTimingSpans(timings, null)
        expect(spans).toEqual([])
        spans = navigationTiming.createNavigationTimingSpans(timings, undefined)
        expect(spans).toEqual([])
        spans = navigationTiming.createNavigationTimingSpans(timings, 0)
        expect(spans).toEqual([])
        spans = navigationTiming.createNavigationTimingSpans(timings, 1)
        expect(spans).toEqual([])
        spans = navigationTiming.createNavigationTimingSpans(timings, Number(new Date()))
        expect(spans).toEqual([])

        timings.requestStart = null
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Parsing the document, executing sync. scripts", "_end": 1464, "_start": 820 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])

        timings.requestStart = undefined
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Parsing the document, executing sync. scripts", "_end": 1464, "_start": 820 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])

        timings.requestStart = 0
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Parsing the document, executing sync. scripts", "_end": 1464, "_start": 820 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])

        timings.requestStart = 1
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Parsing the document, executing sync. scripts", "_end": 1464, "_start": 820 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])

        timings.requestStart = Number(new Date())
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Parsing the document, executing sync. scripts", "_end": 1464, "_start": 820 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])


        // testing the end 
        timings.domInteractive = null
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])

        timings.domInteractive = undefined
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])

        timings.domInteractive = 0
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])

        timings.domInteractive = 1
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])

        timings.domInteractive = Number(new Date())
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])

        timings.domLoading = null
        timings.domInteractive = null
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])

        timings.domLoading = undefined
        timings.domInteractive = undefined
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])

        timings.domLoading = 0
        timings.domInteractive = 0
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])


        timings.domLoading = 1
        timings.domInteractive = 1
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])


        timings.domLoading = Number(new Date())
        timings.domInteractive = Number(new Date())
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Fire \"DOMContentLoaded\" event", "_end": 1498, "_start": 1464 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])


        timings.domContentLoadedEventStart = 'testing'
        timings.domContentLoadedEventEnd = 'testings'
        spans = navigationTiming.createNavigationTimingSpans(timings, timings.fetchStart)
        expect(spans.map(mapSpan))
            .toEqual([
                { "signature": "Receiving the document", "_end": 947, "_start": 786 },
                { "signature": "Fire \"load\" event", "_end": 2874, "_start": 2852 }
            ])
        // console.log(spans.map(s => `${s._start}, ${s._end}, ${s.duration()}, ${s.signature}`).join('\n'))
    })


    it('should createResourceTimingSpans', function () {
        var spans = navigationTiming.createResourceTimingSpans(resourceEntries, [])
        expect(spans.map(mapSpan)).toEqual(spanSnapshot)
    })
})



