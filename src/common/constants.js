/**
 * Task States
 */
const SCHEDULE = 'schedule'
const INVOKE = 'invoke'
const CLEAR = 'clear'

/**
 * Request Sources
 */
const FETCH_SOURCE = 'fetch'
const XMLHTTPREQUEST_SOURCE = 'XMLHttpRequest.send'

/**
 * Event listener methods
 */
const ADD_EVENT_LISTENER_STR = 'addEventListener'
const REMOVE_EVENT_LISTENER_STR = 'removeEventListener'

/**
 * Others
 */
const serverStringLimit = 1024

module.exports = {
  SCHEDULE,
  INVOKE,
  CLEAR,
  FETCH_SOURCE,
  XMLHTTPREQUEST_SOURCE,
  ADD_EVENT_LISTENER_STR,
  REMOVE_EVENT_LISTENER_STR,
  serverStringLimit
}
