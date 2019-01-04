var globalState = {
  fetchInProgress: false
}

function apmSymbol (name) {
  return '__apm_symbol__' + name
}

function isPropertyWritable (propertyDesc) {
  if (!propertyDesc) {
    return true
  }

  if (propertyDesc.writable === false) {
    return false
  }

  return !(typeof propertyDesc.get === 'function' && typeof propertyDesc.set === 'undefined')
}

function attachOriginToPatched (patched, original) {
  patched[apmSymbol('OriginalDelegate')] = original
}

function patchMethod (target, name, patchFn) {
  var proto = target
  while (proto && !proto.hasOwnProperty(name)) {
    proto = Object.getPrototypeOf(proto)
  }
  if (!proto && target[name]) {
    // somehow we did not find it, but we can see it. This happens on IE for Window properties.
    proto = target
  }

  const delegateName = apmSymbol(name)
  var delegate
  if (proto && !(delegate = proto[delegateName])) {
    delegate = proto[delegateName] = proto[name]
    // check whether proto[name] is writable
    // some property is readonly in safari, such as HtmlCanvasElement.prototype.toBlob
    const desc = proto && Object.getOwnPropertyDescriptor(proto, name)
    if (isPropertyWritable(desc)) {
      const patchDelegate = patchFn(delegate, delegateName, name)
      proto[name] = function () {
        return patchDelegate(this, arguments)
      }
      attachOriginToPatched(proto[name], delegate)
    }
  }
  return delegate
}

module.exports = {
  apmSymbol,
  patchMethod,
  globalState,
  XHR_IGNORE: apmSymbol('xhrIgnore'),
  XHR_SYNC: apmSymbol('xhrSync'),
  XHR_URL: apmSymbol('xhrURL'),
  XHR_METHOD: apmSymbol('xhrMethod')
}
