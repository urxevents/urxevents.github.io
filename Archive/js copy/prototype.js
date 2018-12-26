/*  Prototype JavaScript framework, version 1.7
 *  (c) 2005-2010 Sam Stephenson
 *
 *  Prototype is freely distributable under the terms of an MIT-style license.
 *  For details, see the Prototype web site: http://www.prototypejs.org/
 *
 *--------------------------------------------------------------------------*/


var Prototype = {

  Version: '1.7',

  Browser: (function(){
    var ua = navigator.userAgent;
    var isOpera = Object.prototype.toString.call(window.opera) == '[object Opera]';
    return {
      IE:             !!window.attachEvent && !isOpera,
      Opera:          isOpera,
      WebKit:         ua.indexOf('AppleWebKit/') > -1,
      Gecko:          ua.indexOf('Gecko') > -1 && ua.indexOf('KHTML') === -1,
      MobileSafari:   /Apple.*Mobile/.test(ua)
    }
  })(),

  BrowserFeatures: {
    XPath: !!document.evaluate,

    SelectorsAPI: !!document.querySelector,

    ElementExtensions: (function() {
      var constructor = window.Element || window.HTMLElement;
      return !!(constructor && constructor.prototype);
    })(),
    SpecificElementExtensions: (function() {
      if (typeof window.HTMLDivElement !== 'undefined')
        return true;

      var div = document.createElement('div'),
          form = document.createElement('form'),
          isSupported = false;

      if (div['__proto__'] && (div['__proto__'] !== form['__proto__'])) {
        isSupported = true;
      }

      div = form = null;

      return isSupported;
    })()
  },

  ScriptFragment: '<script[^>]*>([\\S\\s]*?)<\/script>',
  JSONFilter: /^\/\*-secure-([\s\S]*)\*\/\s*$/,

  emptyFunction: function() { },

  K: function(x) { return x }
};

if (Prototype.Browser.MobileSafari)
  Prototype.BrowserFeatures.SpecificElementExtensions = false;


var Abstract = { };


var Try = {
  these: function() {
    var returnValue;

    for (var i = 0, length = arguments.length; i < length; i++) {
      var lambda = arguments[i];
      try {
        returnValue = lambda();
        break;
      } catch (e) { }
    }

    return returnValue;
  }
};

/* Based on Alex Arnell's inheritance implementation. */

var Class = (function() {

  var IS_DONTENUM_BUGGY = (function(){
    for (var p in { toString: 1 }) {
      if (p === 'toString') return false;
    }
    return true;
  })();

  function subclass() {};
  function create() {
    var parent = null, properties = $A(arguments);
    if (Object.isFunction(properties[0]))
      parent = properties.shift();

    function klass() {
      this.initialize.apply(this, arguments);
    }

    Object.extend(klass, Class.Methods);
    klass.superclass = parent;
    klass.subclasses = [];

    if (parent) {
      subclass.prototype = parent.prototype;
      klass.prototype = new subclass;
      parent.subclasses.push(klass);
    }

    for (var i = 0, length = properties.length; i < length; i++)
      klass.addMethods(properties[i]);

    if (!klass.prototype.initialize)
      klass.prototype.initialize = Prototype.emptyFunction;

    klass.prototype.constructor = klass;
    return klass;
  }

  function addMethods(source) {
    var ancestor   = this.superclass && this.superclass.prototype,
        properties = Object.keys(source);

    if (IS_DONTENUM_BUGGY) {
      if (source.toString != Object.prototype.toString)
        properties.push("toString");
      if (source.valueOf != Object.prototype.valueOf)
        properties.push("valueOf");
    }

    for (var i = 0, length = properties.length; i < length; i++) {
      var property = properties[i], value = source[property];
      if (ancestor && Object.isFunction(value) &&
          value.argumentNames()[0] == "$super") {
        var method = value;
        value = (function(m) {
          return function() { return ancestor[m].apply(this, arguments); };
        })(property).wrap(method);

        value.valueOf = method.valueOf.bind(method);
        value.toString = method.toString.bind(method);
      }
      this.prototype[property] = value;
    }

    return this;
  }

  return {
    create: create,
    Methods: {
      addMethods: addMethods
    }
  };
})();
(function() {

  var _toString = Object.prototype.toString,
      NULL_TYPE = 'Null',
      UNDEFINED_TYPE = 'Undefined',
      BOOLEAN_TYPE = 'Boolean',
      NUMBER_TYPE = 'Number',
      STRING_TYPE = 'String',
      OBJECT_TYPE = 'Object',
      FUNCTION_CLASS = '[object Function]',
      BOOLEAN_CLASS = '[object Boolean]',
      NUMBER_CLASS = '[object Number]',
      STRING_CLASS = '[object String]',
      ARRAY_CLASS = '[object Array]',
      DATE_CLASS = '[object Date]',
      NATIVE_JSON_STRINGIFY_SUPPORT = window.JSON &&
        typeof JSON.stringify === 'function' &&
        JSON.stringify(0) === '0' &&
        typeof JSON.stringify(Prototype.K) === 'undefined';

  function Type(o) {
    switch(o) {
      case null: return NULL_TYPE;
      case (void 0): return UNDEFINED_TYPE;
    }
    var type = typeof o;
    switch(type) {
      case 'boolean': return BOOLEAN_TYPE;
      case 'number':  return NUMBER_TYPE;
      case 'string':  return STRING_TYPE;
    }
    return OBJECT_TYPE;
  }

  function extend(destination, source) {
    for (var property in source)
      destination[property] = source[property];
    return destination;
  }

  function inspect(object) {
    try {
      if (isUndefined(object)) return 'undefined';
      if (object === null) return 'null';
      return object.inspect ? object.inspect() : String(object);
    } catch (e) {
      if (e instanceof RangeError) return '...';
      throw e;
    }
  }

  function toJSON(value) {
    return Str('', { '': value }, []);
  }

  function Str(key, holder, stack) {
    var value = holder[key],
        type = typeof value;

    if (Type(value) === OBJECT_TYPE && typeof value.toJSON === 'function') {
      value = value.toJSON(key);
    }

    var _class = _toString.call(value);

    switch (_class) {
      case NUMBER_CLASS:
      case BOOLEAN_CLASS:
      case STRING_CLASS:
        value = value.valueOf();
    }

    switch (value) {
      case null: return 'null';
      case true: return 'true';
      case false: return 'false';
    }

    type = typeof value;
    switch (type) {
      case 'string':
        return value.inspect(true);
      case 'number':
        return isFinite(value) ? String(value) : 'null';
      case 'object':

        for (var i = 0, length = stack.length; i < length; i++) {
          if (stack[i] === value) { throw new TypeError(); }
        }
        stack.push(value);

        var partial = [];
        if (_class === ARRAY_CLASS) {
          for (var i = 0, length = value.length; i < length; i++) {
            var str = Str(i, value, stack);
            partial.push(typeof str === 'undefined' ? 'null' : str);
          }
          partial = '[' + partial.join(',') + ']';
        } else {
          var keys = Object.keys(value);
          for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i], str = Str(key, value, stack);
            if (typeof str !== "undefined") {
               partial.push(key.inspect(true)+ ':' + str);
             }
          }
          partial = '{' + partial.join(',') + '}';
        }
        stack.pop();
        return partial;
    }
  }

  function stringify(object) {
    return JSON.stringify(object);
  }

  function toQueryString(object) {
    return $H(object).toQueryString();
  }

  function toHTML(object) {
    return object && object.toHTML ? object.toHTML() : String.interpret(object);
  }

  function keys(object) {
    if (Type(object) !== OBJECT_TYPE) { throw new TypeError(); }
    var results = [];
    for (var property in object) {
      if (object.hasOwnProperty(property)) {
        results.push(property);
      }
    }
    return results;
  }

  function values(object) {
    var results = [];
    for (var property in object)
      results.push(object[property]);
    return results;
  }

  function clone(object) {
    return extend({ }, object);
  }

  function isElement(object) {
    return !!(object && object.nodeType == 1);
  }

  function isArray(object) {
    return _toString.call(object) === ARRAY_CLASS;
  }

  var hasNativeIsArray = (typeof Array.isArray == 'function')
    && Array.isArray([]) && !Array.isArray({});

  if (hasNativeIsArray) {
    isArray = Array.isArray;
  }

  function isHash(object) {
    return object instanceof Hash;
  }

  function isFunction(object) {
    return _toString.call(object) === FUNCTION_CLASS;
  }

  function isString(object) {
    return _toString.call(object) === STRING_CLASS;
  }

  function isNumber(object) {
    return _toString.call(object) === NUMBER_CLASS;
  }

  function isDate(object) {
    return _toString.call(object) === DATE_CLASS;
  }

  function isUndefined(object) {
    return typeof object === "undefined";
  }

  extend(Object, {
    extend:        extend,
    inspect:       inspect,
    toJSON:        NATIVE_JSON_STRINGIFY_SUPPORT ? stringify : toJSON,
    toQueryString: toQueryString,
    toHTML:        toHTML,
    keys:          Object.keys || keys,
    values:        values,
    clone:         clone,
    isElement:     isElement,
    isArray:       isArray,
    isHash:        isHash,
    isFunction:    isFunction,
    isString:      isString,
    isNumber:      isNumber,
    isDate:        isDate,
    isUndefined:   isUndefined
  });
})();
Object.extend(Function.prototype, (function() {
  var slice = Array.prototype.slice;

  function update(array, args) {
    var arrayLength = array.length, length = args.length;
    while (length--) array[arrayLength + length] = args[length];
    return array;
  }

  function merge(array, args) {
    array = slice.call(array, 0);
    return update(array, args);
  }

  function argumentNames() {
    var names = this.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1]
      .replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
      .replace(/\s+/g, '').split(',');
    return names.length == 1 && !names[0] ? [] : names;
  }

  function bind(context) {
    if (arguments.length < 2 && Object.isUndefined(arguments[0])) return this;
    var __method = this, args = slice.call(arguments, 1);
    return function() {
      var a = merge(args, arguments);
      return __method.apply(context, a);
    }
  }

  function bindAsEventListener(context) {
    var __method = this, args = slice.call(arguments, 1);
    return function(event) {
      var a = update([event || window.event], args);
      return __method.apply(context, a);
    }
  }

  function curry() {
    if (!arguments.length) return this;
    var __method = this, args = slice.call(arguments, 0);
    return function() {
      var a = merge(args, arguments);
      return __method.apply(this, a);
    }
  }

  function delay(timeout) {
    var __method = this, args = slice.call(arguments, 1);
    timeout = timeout * 1000;
    return window.setTimeout(function() {
      return __method.apply(__method, args);
    }, timeout);
  }

  function defer() {
    var args = update([0.01], arguments);
    return this.delay.apply(this, args);
  }

  function wrap(wrapper) {
    var __method = this;
    return function() {
      var a = update([__method.bind(this)], arguments);
      return wrapper.apply(this, a);
    }
  }

  function methodize() {
    if (this._methodized) return this._methodized;
    var __method = this;
    return this._methodized = function() {
      var a = update([this], arguments);
      return __method.apply(null, a);
    };
  }

  return {
    argumentNames:       argumentNames,
    bind:                bind,
    bindAsEventListener: bindAsEventListener,
    curry:               curry,
    delay:               delay,
    defer:               defer,
    wrap:                wrap,
    methodize:           methodize
  }
})());



(function(proto) {


  function toISOString() {
    return this.getUTCFullYear() + '-' +
      (this.getUTCMonth() + 1).toPaddedString(2) + '-' +
      this.getUTCDate().toPaddedString(2) + 'T' +
      this.getUTCHours().toPaddedString(2) + ':' +
      this.getUTCMinutes().toPaddedString(2) + ':' +
      this.getUTCSeconds().toPaddedString(2) + 'Z';
  }


  function toJSON() {
    return this.toISOString();
  }

  if (!proto.toISOString) proto.toISOString = toISOString;
  if (!proto.toJSON) proto.toJSON = toJSON;

})(Date.prototype);


RegExp.prototype.match = RegExp.prototype.test;

RegExp.escape = function(str) {
  return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
};
var PeriodicalExecuter = Class.create({
  initialize: function(callback, frequency) {
    this.callback = callback;
    this.frequency = frequency;
    this.currentlyExecuting = false;

    this.registerCallback();
  },

  registerCallback: function() {
    this.timer = setInterval(this.onTimerEvent.bind(this), this.frequency * 1000);
  },

  execute: function() {
    this.callback(this);
  },

  stop: function() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  },

  onTimerEvent: function() {
    if (!this.currentlyExecuting) {
      try {
        this.currentlyExecuting = true;
        this.execute();
        this.currentlyExecuting = false;
      } catch(e) {
        this.currentlyExecuting = false;
        throw e;
      }
    }
  }
});
Object.extend(String, {
  interpret: function(value) {
    return value == null ? '' : String(value);
  },
  specialChar: {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '\\': '\\\\'
  }
});

Object.extend(String.prototype, (function() {
  var NATIVE_JSON_PARSE_SUPPORT = window.JSON &&
    typeof JSON.parse === 'function' &&
    JSON.parse('{"test": true}').test;

  function prepareReplacement(replacement) {
    if (Object.isFunction(replacement)) return replacement;
    var template = new Template(replacement);
    return function(match) { return template.evaluate(match) };
  }

  function gsub(pattern, replacement) {
    var result = '', source = this, match;
    replacement = prepareReplacement(replacement);

    if (Object.isString(pattern))
      pattern = RegExp.escape(pattern);

    if (!(pattern.length || pattern.source)) {
      replacement = replacement('');
      return replacement + source.split('').join(replacement) + replacement;
    }

    while (source.length > 0) {
      if (match = source.match(pattern)) {
        result += source.slice(0, match.index);
        result += String.interpret(replacement(match));
        source  = source.slice(match.index + match[0].length);
      } else {
        result += source, source = '';
      }
    }
    return result;
  }

  function sub(pattern, replacement, count) {
    replacement = prepareReplacement(replacement);
    count = Object.isUndefined(count) ? 1 : count;

    return this.gsub(pattern, function(match) {
      if (--count < 0) return match[0];
      return replacement(match);
    });
  }

  function scan(pattern, iterator) {
    this.gsub(pattern, iterator);
    return String(this);
  }

  function truncate(length, truncation) {
    length = length || 30;
    truncation = Object.isUndefined(truncation) ? '...' : truncation;
    return this.length > length ?
      this.slice(0, length - truncation.length) + truncation : String(this);
  }

  function strip() {
    return this.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function stripTags() {
    return this.replace(/<\w+(\s+("[^"]*"|'[^']*'|[^>])+)?>|<\/\w+>/gi, '');
  }

  function stripScripts() {
    return this.replace(new RegExp(Prototype.ScriptFragment, 'img'), '');
  }

  function extractScripts() {
    var matchAll = new RegExp(Prototype.ScriptFragment, 'img'),
        matchOne = new RegExp(Prototype.ScriptFragment, 'im');
    return (this.match(matchAll) || []).map(function(scriptTag) {
      return (scriptTag.match(matchOne) || ['', ''])[1];
    });
  }

  function evalScripts() {
    return this.extractScripts().map(function(script) { return eval(script) });
  }

  function escapeHTML() {
    return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function unescapeHTML() {
    return this.stripTags().replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  }


  function toQueryParams(separator) {
    var match = this.strip().match(/([^?#]*)(#.*)?$/);
    if (!match) return { };

    return match[1].split(separator || '&').inject({ }, function(hash, pair) {
      if ((pair = pair.split('='))[0]) {
        var key = decodeURIComponent(pair.shift()),
            value = pair.length > 1 ? pair.join('=') : pair[0];

        if (value != undefined) value = decodeURIComponent(value);

        if (key in hash) {
          if (!Object.isArray(hash[key])) hash[key] = [hash[key]];
          hash[key].push(value);
        }
        else hash[key] = value;
      }
      return hash;
    });
  }

  function toArray() {
    return this.split('');
  }

  function succ() {
    return this.slice(0, this.length - 1) +
      String.fromCharCode(this.charCodeAt(this.length - 1) + 1);
  }

  function times(count) {
    return count < 1 ? '' : new Array(count + 1).join(this);
  }

  function camelize() {
    return this.replace(/-+(.)?/g, function(match, chr) {
      return chr ? chr.toUpperCase() : '';
    });
  }

  function capitalize() {
    return this.charAt(0).toUpperCase() + this.substring(1).toLowerCase();
  }

  function underscore() {
    return this.replace(/::/g, '/')
               .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
               .replace(/([a-z\d])([A-Z])/g, '$1_$2')
               .replace(/-/g, '_')
               .toLowerCase();
  }

  function dasherize() {
    return this.replace(/_/g, '-');
  }

  function inspect(useDoubleQuotes) {
    var escapedString = this.replace(/[\x00-\x1f\\]/g, function(character) {
      if (character in String.specialChar) {
        return String.specialChar[character];
      }
      return '\\u00' + character.charCodeAt().toPaddedString(2, 16);
    });
    if (useDoubleQuotes) return '"' + escapedString.replace(/"/g, '\\"') + '"';
    return "'" + escapedString.replace(/'/g, '\\\'') + "'";
  }

  function unfilterJSON(filter) {
    return this.replace(filter || Prototype.JSONFilter, '$1');
  }

  function isJSON() {
    var str = this;
    if (str.blank()) return false;
    str = str.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@');
    str = str.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']');
    str = str.replace(/(?:^|:|,)(?:\s*\[)+/g, '');
    return (/^[\],:{}\s]*$/).test(str);
  }

  function evalJSON(sanitize) {
    var json = this.unfilterJSON(),
        cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    if (cx.test(json)) {
      json = json.replace(cx, function (a) {
        return '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
      });
    }
    try {
      if (!sanitize || json.isJSON()) return eval('(' + json + ')');
    } catch (e) { }
    throw new SyntaxError('Badly formed JSON string: ' + this.inspect());
  }

  function parseJSON() {
    var json = this.unfilterJSON();
    return JSON.parse(json);
  }

  function include(pattern) {
    return this.indexOf(pattern) > -1;
  }

  function startsWith(pattern) {
    return this.lastIndexOf(pattern, 0) === 0;
  }

  function endsWith(pattern) {
    var d = this.length - pattern.length;
    return d >= 0 && this.indexOf(pattern, d) === d;
  }

  function empty() {
    return this == '';
  }

  function blank() {
    return /^\s*$/.test(this);
  }

  function interpolate(object, pattern) {
    return new Template(this, pattern).evaluate(object);
  }

  return {
    gsub:           gsub,
    sub:            sub,
    scan:           scan,
    truncate:       truncate,
    strip:          String.prototype.trim || strip,
    stripTags:      stripTags,
    stripScripts:   stripScripts,
    extractScripts: extractScripts,
    evalScripts:    evalScripts,
    escapeHTML:     escapeHTML,
    unescapeHTML:   unescapeHTML,
    toQueryParams:  toQueryParams,
    parseQuery:     toQueryParams,
    toArray:        toArray,
    succ:           succ,
    times:          times,
    camelize:       camelize,
    capitalize:     capitalize,
    underscore:     underscore,
    dasherize:      dasherize,
    inspect:        inspect,
    unfilterJSON:   unfilterJSON,
    isJSON:         isJSON,
    evalJSON:       NATIVE_JSON_PARSE_SUPPORT ? parseJSON : evalJSON,
    include:        include,
    startsWith:     startsWith,
    endsWith:       endsWith,
    empty:          empty,
    blank:          blank,
    interpolate:    interpolate
  };
})());

var Template = Class.create({
  initialize: function(template, pattern) {
    this.template = template.toString();
    this.pattern = pattern || Template.Pattern;
  },

  evaluate: function(object) {
    if (object && Object.isFunction(object.toTemplateReplacements))
      object = object.toTemplateReplacements();

    return this.template.gsub(this.pattern, function(match) {
      if (object == null) return (match[1] + '');

      var before = match[1] || '';
      if (before == '\\') return match[2];

      var ctx = object, expr = match[3],
          pattern = /^([^.[]+|\[((?:.*?[^\\])?)\])(\.|\[|$)/;

      match = pattern.exec(expr);
      if (match == null) return before;

      while (match != null) {
        var comp = match[1].startsWith('[') ? match[2].replace(/\\\\]/g, ']') : match[1];
        ctx = ctx[comp];
        if (null == ctx || '' == match[3]) break;
        expr = expr.substring('[' == match[3] ? match[1].length : match[0].length);
        match = pattern.exec(expr);
      }

      return before + String.interpret(ctx);
    });
  }
});
Template.Pattern = /(^|.|\r|\n)(#\{(.*?)\})/;

var $break = { };

var Enumerable = (function() {
  function each(iterator, context) {
    var index = 0;
    try {
      this._each(function(value) {
        iterator.call(context, value, index++);
      });
    } catch (e) {
      if (e != $break) throw e;
    }
    return this;
  }

  function eachSlice(number, iterator, context) {
    var index = -number, slices = [], array = this.toArray();
    if (number < 1) return array;
    while ((index += number) < array.length)
      slices.push(array.slice(index, index+number));
    return slices.collect(iterator, context);
  }

  function all(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = true;
    this.each(function(value, index) {
      result = result && !!iterator.call(context, value, index);
      if (!result) throw $break;
    });
    return result;
  }

  function any(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = false;
    this.each(function(value, index) {
      if (result = !!iterator.call(context, value, index))
        throw $break;
    });
    return result;
  }

  function collect(iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];
    this.each(function(value, index) {
      results.push(iterator.call(context, value, index));
    });
    return results;
  }

  function detect(iterator, context) {
    var result;
    this.each(function(value, index) {
      if (iterator.call(context, value, index)) {
        result = value;
        throw $break;
      }
    });
    return result;
  }

  function findAll(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  }

  function grep(filter, iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];

    if (Object.isString(filter))
      filter = new RegExp(RegExp.escape(filter));

    this.each(function(value, index) {
      if (filter.match(value))
        results.push(iterator.call(context, value, index));
    });
    return results;
  }

  function include(object) {
    if (Object.isFunction(this.indexOf))
      if (this.indexOf(object) != -1) return true;

    var found = false;
    this.each(function(value) {
      if (value == object) {
        found = true;
        throw $break;
      }
    });
    return found;
  }

  function inGroupsOf(number, fillWith) {
    fillWith = Object.isUndefined(fillWith) ? null : fillWith;
    return this.eachSlice(number, function(slice) {
      while(slice.length < number) slice.push(fillWith);
      return slice;
    });
  }

  function inject(memo, iterator, context) {
    this.each(function(value, index) {
      memo = iterator.call(context, memo, value, index);
    });
    return memo;
  }

  function invoke(method) {
    var args = $A(arguments).slice(1);
    return this.map(function(value) {
      return value[method].apply(value, args);
    });
  }

  function max(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value >= result)
        result = value;
    });
    return result;
  }

  function min(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value < result)
        result = value;
    });
    return result;
  }

  function partition(iterator, context) {
    iterator = iterator || Prototype.K;
    var trues = [], falses = [];
    this.each(function(value, index) {
      (iterator.call(context, value, index) ?
        trues : falses).push(value);
    });
    return [trues, falses];
  }

  function pluck(property) {
    var results = [];
    this.each(function(value) {
      results.push(value[property]);
    });
    return results;
  }

  function reject(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (!iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  }

  function sortBy(iterator, context) {
    return this.map(function(value, index) {
      return {
        value: value,
        criteria: iterator.call(context, value, index)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }).pluck('value');
  }

  function toArray() {
    return this.map();
  }

  function zip() {
    var iterator = Prototype.K, args = $A(arguments);
    if (Object.isFunction(args.last()))
      iterator = args.pop();

    var collections = [this].concat(args).map($A);
    return this.map(function(value, index) {
      return iterator(collections.pluck(index));
    });
  }

  function size() {
    return this.toArray().length;
  }

  function inspect() {
    return '#<Enumerable:' + this.toArray().inspect() + '>';
  }









  return {
    each:       each,
    eachSlice:  eachSlice,
    all:        all,
    every:      all,
    any:        any,
    some:       any,
    collect:    collect,
    map:        collect,
    detect:     detect,
    findAll:    findAll,
    select:     findAll,
    filter:     findAll,
    grep:       grep,
    include:    include,
    member:     include,
    inGroupsOf: inGroupsOf,
    inject:     inject,
    invoke:     invoke,
    max:        max,
    min:        min,
    partition:  partition,
    pluck:      pluck,
    reject:     reject,
    sortBy:     sortBy,
    toArray:    toArray,
    entries:    toArray,
    zip:        zip,
    size:       size,
    inspect:    inspect,
    find:       detect
  };
})();

function $A(iterable) {
  if (!iterable) return [];
  if ('toArray' in Object(iterable)) return iterable.toArray();
  var length = iterable.length || 0, results = new Array(length);
  while (length--) results[length] = iterable[length];
  return results;
}


function $w(string) {
  if (!Object.isString(string)) return [];
  string = string.strip();
  return string ? string.split(/\s+/) : [];
}

Array.from = $A;


(function() {
  var arrayProto = Array.prototype,
      slice = arrayProto.slice,
      _each = arrayProto.forEach; // use native browser JS 1.6 implementation if available

  function each(iterator, context) {
    for (var i = 0, length = this.length >>> 0; i < length; i++) {
      if (i in this) iterator.call(context, this[i], i, this);
    }
  }
  if (!_each) _each = each;

  function clear() {
    this.length = 0;
    return this;
  }

  function first() {
    return this[0];
  }

  function last() {
    return this[this.length - 1];
  }

  function compact() {
    return this.select(function(value) {
      return value != null;
    });
  }

  function flatten() {
    return this.inject([], function(array, value) {
      if (Object.isArray(value))
        return array.concat(value.flatten());
      array.push(value);
      return array;
    });
  }

  function without() {
    var values = slice.call(arguments, 0);
    return this.select(function(value) {
      return !values.include(value);
    });
  }

  function reverse(inline) {
    return (inline === false ? this.toArray() : this)._reverse();
  }

  function uniq(sorted) {
    return this.inject([], function(array, value, index) {
      if (0 == index || (sorted ? array.last() != value : !array.include(value)))
        array.push(value);
      return array;
    });
  }

  function intersect(array) {
    return this.uniq().findAll(function(item) {
      return array.detect(function(value) { return item === value });
    });
  }


  function clone() {
    return slice.call(this, 0);
  }

  function size() {
    return this.length;
  }

  function inspect() {
    return '[' + this.map(Object.inspect).join(', ') + ']';
  }

  function indexOf(item, i) {
    i || (i = 0);
    var length = this.length;
    if (i < 0) i = length + i;
    for (; i < length; i++)
      if (this[i] === item) return i;
    return -1;
  }

  function lastIndexOf(item, i) {
    i = isNaN(i) ? this.length : (i < 0 ? this.length + i : i) + 1;
    var n = this.slice(0, i).reverse().indexOf(item);
    return (n < 0) ? n : i - n - 1;
  }

  function concat() {
    var array = slice.call(this, 0), item;
    for (var i = 0, length = arguments.length; i < length; i++) {
      item = arguments[i];
      if (Object.isArray(item) && !('callee' in item)) {
        for (var j = 0, arrayLength = item.length; j < arrayLength; j++)
          array.push(item[j]);
      } else {
        array.push(item);
      }
    }
    return array;
  }

  Object.extend(arrayProto, Enumerable);

  if (!arrayProto._reverse)
    arrayProto._reverse = arrayProto.reverse;

  Object.extend(arrayProto, {
    _each:     _each,
    clear:     clear,
    first:     first,
    last:      last,
    compact:   compact,
    flatten:   flatten,
    without:   without,
    reverse:   reverse,
    uniq:      uniq,
    intersect: intersect,
    clone:     clone,
    toArray:   clone,
    size:      size,
    inspect:   inspect
  });

  var CONCAT_ARGUMENTS_BUGGY = (function() {
    return [].concat(arguments)[0][0] !== 1;
  })(1,2)

  if (CONCAT_ARGUMENTS_BUGGY) arrayProto.concat = concat;

  if (!arrayProto.indexOf) arrayProto.indexOf = indexOf;
  if (!arrayProto.lastIndexOf) arrayProto.lastIndexOf = lastIndexOf;
})();
function $H(object) {
  return new Hash(object);
};

var Hash = Class.create(Enumerable, (function() {
  function initialize(object) {
    this._object = Object.isHash(object) ? object.toObject() : Object.clone(object);
  }


  function _each(iterator) {
    for (var key in this._object) {
      var value = this._object[key], pair = [key, value];
      pair.key = key;
      pair.value = value;
      iterator(pair);
    }
  }

  function set(key, value) {
    return this._object[key] = value;
  }

  function get(key) {
    if (this._object[key] !== Object.prototype[key])
      return this._object[key];
  }

  function unset(key) {
    var value = this._object[key];
    delete this._object[key];
    return value;
  }

  function toObject() {
    return Object.clone(this._object);
  }



  function keys() {
    return this.pluck('key');
  }

  function values() {
    return this.pluck('value');
  }

  function index(value) {
    var match = this.detect(function(pair) {
      return pair.value === value;
    });
    return match && match.key;
  }

  function merge(object) {
    return this.clone().update(object);
  }

  function update(object) {
    return new Hash(object).inject(this, function(result, pair) {
      result.set(pair.key, pair.value);
      return result;
    });
  }

  function toQueryPair(key, value) {
    if (Object.isUndefined(value)) return key;
    return key + '=' + encodeURIComponent(String.interpret(value));
  }

  function toQueryString() {
    return this.inject([], function(results, pair) {
      var key = encodeURIComponent(pair.key), values = pair.value;

      if (values && typeof values == 'object') {
        if (Object.isArray(values)) {
          var queryValues = [];
          for (var i = 0, len = values.length, value; i < len; i++) {
            value = values[i];
            queryValues.push(toQueryPair(key, value));
          }
          return results.concat(queryValues);
        }
      } else results.push(toQueryPair(key, values));
      return results;
    }).join('&');
  }

  function inspect() {
    return '#<Hash:{' + this.map(function(pair) {
      return pair.map(Object.inspect).join(': ');
    }).join(', ') + '}>';
  }

  function clone() {
    return new Hash(this);
  }

  return {
    initialize:             initialize,
    _each:                  _each,
    set:                    set,
    get:                    get,
    unset:                  unset,
    toObject:               toObject,
    toTemplateReplacements: toObject,
    keys:                   keys,
    values:                 values,
    index:                  index,
    merge:                  merge,
    update:                 update,
    toQueryString:          toQueryString,
    inspect:                inspect,
    toJSON:                 toObject,
    clone:                  clone
  };
})());

Hash.from = $H;
Object.extend(Number.prototype, (function() {
  function toColorPart() {
    return this.toPaddedString(2, 16);
  }

  function succ() {
    return this + 1;
  }

  function times(iterator, context) {
    $R(0, this, true).each(iterator, context);
    return this;
  }

  function toPaddedString(length, radix) {
    var string = this.toString(radix || 10);
    return '0'.times(length - string.length) + string;
  }

  function abs() {
    return Math.abs(this);
  }

  function round() {
    return Math.round(this);
  }

  function ceil() {
    return Math.ceil(this);
  }

  function floor() {
    return Math.floor(this);
  }

  return {
    toColorPart:    toColorPart,
    succ:           succ,
    times:          times,
    toPaddedString: toPaddedString,
    abs:            abs,
    round:          round,
    ceil:           ceil,
    floor:          floor
  };
})());

function $R(start, end, exclusive) {
  return new ObjectRange(start, end, exclusive);
}

var ObjectRange = Class.create(Enumerable, (function() {
  function initialize(start, end, exclusive) {
    this.start = start;
    this.end = end;
    this.exclusive = exclusive;
  }

  function _each(iterator) {
    var value = this.start;
    while (this.include(value)) {
      iterator(value);
      value = value.succ();
    }
  }

  function include(value) {
    if (value < this.start)
      return false;
    if (this.exclusive)
      return value < this.end;
    return value <= this.end;
  }

  return {
    initialize: initialize,
    _each:      _each,
    include:    include
  };
})());



var Ajax = {
  getTransport: function() {
    return Try.these(
      function() {return new XMLHttpRequest()},
      function() {return new ActiveXObject('Msxml2.XMLHTTP')},
      function() {return new ActiveXObject('Microsoft.XMLHTTP')}
    ) || false;
  },

  activeRequestCount: 0
};

Ajax.Responders = {
  responders: [],

  _each: function(iterator) {
    this.responders._each(iterator);
  },

  register: function(responder) {
    if (!this.include(responder))
      this.responders.push(responder);
  },

  unregister: function(responder) {
    this.responders = this.responders.without(responder);
  },

  dispatch: function(callback, request, transport, json) {
    this.each(function(responder) {
      if (Object.isFunction(responder[callback])) {
        try {
          responder[callback].apply(responder, [request, transport, json]);
        } catch (e) { }
      }
    });
  }
};

Object.extend(Ajax.Responders, Enumerable);

Ajax.Responders.register({
  onCreate:   function() { Ajax.activeRequestCount++ },
  onComplete: function() { Ajax.activeRequestCount-- }
});
Ajax.Base = Class.create({
  initialize: function(options) {
    this.options = {
      method:       'post',
      asynchronous: true,
      contentType:  'application/x-www-form-urlencoded',
      encoding:     'UTF-8',
      parameters:   '',
      evalJSON:     true,
      evalJS:       true
    };
    Object.extend(this.options, options || { });

    this.options.method = this.options.method.toLowerCase();

    if (Object.isHash(this.options.parameters))
      this.options.parameters = this.options.parameters.toObject();
  }
});
Ajax.Request = Class.create(Ajax.Base, {
  _complete: false,

  initialize: function($super, url, options) {
    $super(options);
    this.transport = Ajax.getTransport();
    this.request(url);
  },

  request: function(url) {
    this.url = url;
    this.method = this.options.method;
    var params = Object.isString(this.options.parameters) ?
          this.options.parameters :
          Object.toQueryString(this.options.parameters);

    if (!['get', 'post'].include(this.method)) {
      params += (params ? '&' : '') + "_method=" + this.method;
      this.method = 'post';
    }

    if (params && this.method === 'get') {
      this.url += (this.url.include('?') ? '&' : '?') + params;
    }

    this.parameters = params.toQueryParams();

    try {
      var response = new Ajax.Response(this);
      if (this.options.onCreate) this.options.onCreate(response);
      Ajax.Responders.dispatch('onCreate', this, response);

      this.transport.open(this.method.toUpperCase(), this.url,
        this.options.asynchronous);

      if (this.options.asynchronous) this.respondToReadyState.bind(this).defer(1);

      this.transport.onreadystatechange = this.onStateChange.bind(this);
      this.setRequestHeaders();

      this.body = this.method == 'post' ? (this.options.postBody || params) : null;
      this.transport.send(this.body);

      /* Force Firefox to handle ready state 4 for synchronous requests */
      if (!this.options.asynchronous && this.transport.overrideMimeType)
        this.onStateChange();

    }
    catch (e) {
      this.dispatchException(e);
    }
  },

  onStateChange: function() {
    var readyState = this.transport.readyState;
    if (readyState > 1 && !((readyState == 4) && this._complete))
      this.respondToReadyState(this.transport.readyState);
  },

  setRequestHeaders: function() {
    var headers = {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Prototype-Version': Prototype.Version,
      'Accept': 'text/javascript, text/html, application/xml, text/xml, */*'
    };

    if (this.method == 'post') {
      headers['Content-type'] = this.options.contentType +
        (this.options.encoding ? '; charset=' + this.options.encoding : '');

      /* Force "Connection: close" for older Mozilla browsers to work
       * around a bug where XMLHttpRequest sends an incorrect
       * Content-length header. See Mozilla Bugzilla #246651.
       */
      if (this.transport.overrideMimeType &&
          (navigator.userAgent.match(/Gecko\/(\d{4})/) || [0,2005])[1] < 2005)
            headers['Connection'] = 'close';
    }

    if (typeof this.options.requestHeaders == 'object') {
      var extras = this.options.requestHeaders;

      if (Object.isFunction(extras.push))
        for (var i = 0, length = extras.length; i < length; i += 2)
          headers[extras[i]] = extras[i+1];
      else
        $H(extras).each(function(pair) { headers[pair.key] = pair.value });
    }

    for (var name in headers)
      this.transport.setRequestHeader(name, headers[name]);
  },

  success: function() {
    var status = this.getStatus();
    return !status || (status >= 200 && status < 300) || status == 304;
  },

  getStatus: function() {
    try {
      if (this.transport.status === 1223) return 204;
      return this.transport.status || 0;
    } catch (e) { return 0 }
  },

  respondToReadyState: function(readyState) {
    var state = Ajax.Request.Events[readyState], response = new Ajax.Response(this);

    if (state == 'Complete') {
      try {
        this._complete = true;
        (this.options['on' + response.status]
         || this.options['on' + (this.success() ? 'Success' : 'Failure')]
         || Prototype.emptyFunction)(response, response.headerJSON);
      } catch (e) {
        this.dispatchException(e);
      }

      var contentType = response.getHeader('Content-type');
      if (this.options.evalJS == 'force'
          || (this.options.evalJS && this.isSameOrigin() && contentType
          && contentType.match(/^\s*(text|application)\/(x-)?(java|ecma)script(;.*)?\s*$/i)))
        this.evalResponse();
    }

    try {
      (this.options['on' + state] || Prototype.emptyFunction)(response, response.headerJSON);
      Ajax.Responders.dispatch('on' + state, this, response, response.headerJSON);
    } catch (e) {
      this.dispatchException(e);
    }

    if (state == 'Complete') {
      this.transport.onreadystatechange = Prototype.emptyFunction;
    }
  },

  isSameOrigin: function() {
    var m = this.url.match(/^\s*https?:\/\/[^\/]*/);
    return !m || (m[0] == '#{protocol}//#{domain}#{port}'.interpolate({
      protocol: location.protocol,
      domain: document.domain,
      port: location.port ? ':' + location.port : ''
    }));
  },

  getHeader: function(name) {
    try {
      return this.transport.getResponseHeader(name) || null;
    } catch (e) { return null; }
  },

  evalResponse: function() {
    try {
      return eval((this.transport.responseText || '').unfilterJSON());
    } catch (e) {
      this.dispatchException(e);
    }
  },

  dispatchException: function(exception) {
    (this.options.onException || Prototype.emptyFunction)(this, exception);
    Ajax.Responders.dispatch('onException', this, exception);
  }
});

Ajax.Request.Events =
  ['Uninitialized', 'Loading', 'Loaded', 'Interactive', 'Complete'];








Ajax.Response = Class.create({
  initialize: function(request){
    this.request = request;
    var transport  = this.transport  = request.transport,
        readyState = this.readyState = transport.readyState;

    if ((readyState > 2 && !Prototype.Browser.IE) || readyState == 4) {
      this.status       = this.getStatus();
      this.statusText   = this.getStatusText();
      this.responseText = String.interpret(transport.responseText);
      this.headerJSON   = this._getHeaderJSON();
    }

    if (readyState == 4) {
      var xml = transport.responseXML;
      this.responseXML  = Object.isUndefined(xml) ? null : xml;
      this.responseJSON = this._getResponseJSON();
    }
  },

  status:      0,

  statusText: '',

  getStatus: Ajax.Request.prototype.getStatus,

  getStatusText: function() {
    try {
      return this.transport.statusText || '';
    } catch (e) { return '' }
  },

  getHeader: Ajax.Request.prototype.getHeader,

  getAllHeaders: function() {
    try {
      return this.getAllResponseHeaders();
    } catch (e) { return null }
  },

  getResponseHeader: function(name) {
    return this.transport.getResponseHeader(name);
  },

  getAllResponseHeaders: function() {
    return this.transport.getAllResponseHeaders();
  },

  _getHeaderJSON: function() {
    var json = this.getHeader('X-JSON');
    if (!json) return null;
    json = decodeURIComponent(escape(json));
    try {
      return json.evalJSON(this.request.options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  },

  _getResponseJSON: function() {
    var options = this.request.options;
    if (!options.evalJSON || (options.evalJSON != 'force' &&
      !(this.getHeader('Content-type') || '').include('application/json')) ||
        this.responseText.blank())
          return null;
    try {
      return this.responseText.evalJSON(options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  }
});

Ajax.Updater = Class.create(Ajax.Request, {
  initialize: function($super, container, url, options) {
    this.container = {
      success: (container.success || container),
      failure: (container.failure || (container.success ? null : container))
    };

    options = Object.clone(options);
    var onComplete = options.onComplete;
    options.onComplete = (function(response, json) {
      this.updateContent(response.responseText);
      if (Object.isFunction(onComplete)) onComplete(response, json);
    }).bind(this);

    $super(url, options);
  },

  updateContent: function(responseText) {
    var receiver = this.container[this.success() ? 'success' : 'failure'],
        options = this.options;

    if (!options.evalScripts) responseText = responseText.stripScripts();

    if (receiver = $(receiver)) {
      if (options.insertion) {
        if (Object.isString(options.insertion)) {
          var insertion = { }; insertion[options.insertion] = responseText;
          receiver.insert(insertion);
        }
        else options.insertion(receiver, responseText);
      }
      else receiver.update(responseText);
    }
  }
});

Ajax.PeriodicalUpdater = Class.create(Ajax.Base, {
  initialize: function($super, container, url, options) {
    $super(options);
    this.onComplete = this.options.onComplete;

    this.frequency = (this.options.frequency || 2);
    this.decay = (this.options.decay || 1);

    this.updater = { };
    this.container = container;
    this.url = url;

    this.start();
  },

  start: function() {
    this.options.onComplete = this.updateComplete.bind(this);
    this.onTimerEvent();
  },

  stop: function() {
    this.updater.options.onComplete = undefined;
    clearTimeout(this.timer);
    (this.onComplete || Prototype.emptyFunction).apply(this, arguments);
  },

  updateComplete: function(response) {
    if (this.options.decay) {
      this.decay = (response.responseText == this.lastText ?
        this.decay * this.options.decay : 1);

      this.lastText = response.responseText;
    }
    this.timer = this.onTimerEvent.bind(this).delay(this.decay * this.frequency);
  },

  onTimerEvent: function() {
    this.updater = new Ajax.Updater(this.container, this.url, this.options);
  }
});


function $(element) {
  if (arguments.length > 1) {
    for (var i = 0, elements = [], length = arguments.length; i < length; i++)
      elements.push($(arguments[i]));
    return elements;
  }
  if (Object.isString(element))
    element = document.getElementById(element);
  return Element.extend(element);
}

if (Prototype.BrowserFeatures.XPath) {
  document._getElementsByXPath = function(expression, parentElement) {
    var results = [];
    var query = document.evaluate(expression, $(parentElement) || document,
      null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var i = 0, length = query.snapshotLength; i < length; i++)
      results.push(Element.extend(query.snapshotItem(i)));
    return results;
  };
}

/*--------------------------------------------------------------------------*/

if (!Node) var Node = { };

if (!Node.ELEMENT_NODE) {
  Object.extend(Node, {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    ENTITY_REFERENCE_NODE: 5,
    ENTITY_NODE: 6,
    PROCESSING_INSTRUCTION_NODE: 7,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_TYPE_NODE: 10,
    DOCUMENT_FRAGMENT_NODE: 11,
    NOTATION_NODE: 12
  });
}



(function(global) {
  function shouldUseCache(tagName, attributes) {
    if (tagName === 'select') return false;
    if ('type' in attributes) return false;
    return true;
  }

  var HAS_EXTENDED_CREATE_ELEMENT_SYNTAX = (function(){
    try {
      var el = document.createElement('<input name="x">');
      return el.tagName.toLowerCase() === 'input' && el.name === 'x';
    }
    catch(err) {
      return false;
    }
  })();

  var element = global.Element;

  global.Element = function(tagName, attributes) {
    attributes = attributes || { };
    tagName = tagName.toLowerCase();
    var cache = Element.cache;

    if (HAS_EXTENDED_CREATE_ELEMENT_SYNTAX && attributes.name) {
      tagName = '<' + tagName + ' name="' + attributes.name + '">';
      delete attributes.name;
      return Element.writeAttribute(document.createElement(tagName), attributes);
    }

    if (!cache[tagName]) cache[tagName] = Element.extend(document.createElement(tagName));

    var node = shouldUseCache(tagName, attributes) ?
     cache[tagName].cloneNode(false) : document.createElement(tagName);

    return Element.writeAttribute(node, attributes);
  };

  Object.extend(global.Element, element || { });
  if (element) global.Element.prototype = element.prototype;

})(this);

Element.idCounter = 1;
Element.cache = { };

Element._purgeElement = function(element) {
  var uid = element._prototypeUID;
  if (uid) {
    Element.stopObserving(element);
    element._prototypeUID = void 0;
    delete Element.Storage[uid];
  }
}

Element.Methods = {
  visible: function(element) {
    return $(element).style.display != 'none';
  },

  toggle: function(element) {
    element = $(element);
    Element[Element.visible(element) ? 'hide' : 'show'](element);
    return element;
  },

  hide: function(element) {
    element = $(element);
    element.style.display = 'none';
    return element;
  },

  show: function(element) {
    element = $(element);
    element.style.display = '';
    return element;
  },

  remove: function(element) {
    element = $(element);
    element.parentNode.removeChild(element);
    return element;
  },

  update: (function(){

    var SELECT_ELEMENT_INNERHTML_BUGGY = (function(){
      var el = document.createElement("select"),
          isBuggy = true;
      el.innerHTML = "<option value=\"test\">test</option>";
      if (el.options && el.options[0]) {
        isBuggy = el.options[0].nodeName.toUpperCase() !== "OPTION";
      }
      el = null;
      return isBuggy;
    })();

    var TABLE_ELEMENT_INNERHTML_BUGGY = (function(){
      try {
        var el = document.createElement("table");
        if (el && el.tBodies) {
          el.innerHTML = "<tbody><tr><td>test</td></tr></tbody>";
          var isBuggy = typeof el.tBodies[0] == "undefined";
          el = null;
          return isBuggy;
        }
      } catch (e) {
        return true;
      }
    })();

    var LINK_ELEMENT_INNERHTML_BUGGY = (function() {
      try {
        var el = document.createElement('div');
        el.innerHTML = "<link>";
        var isBuggy = (el.childNodes.length === 0);
        el = null;
        return isBuggy;
      } catch(e) {
        return true;
      }
    })();

    var ANY_INNERHTML_BUGGY = SELECT_ELEMENT_INNERHTML_BUGGY ||
     TABLE_ELEMENT_INNERHTML_BUGGY || LINK_ELEMENT_INNERHTML_BUGGY;

    var SCRIPT_ELEMENT_REJECTS_TEXTNODE_APPENDING = (function () {
      var s = document.createElement("script"),
          isBuggy = false;
      try {
        s.appendChild(document.createTextNode(""));
        isBuggy = !s.firstChild ||
          s.firstChild && s.firstChild.nodeType !== 3;
      } catch (e) {
        isBuggy = true;
      }
      s = null;
      return isBuggy;
    })();


    function update(element, content) {
      element = $(element);
      var purgeElement = Element._purgeElement;

      var descendants = element.getElementsByTagName('*'),
       i = descendants.length;
      while (i--) purgeElement(descendants[i]);

      if (content && content.toElement)
        content = content.toElement();

      if (Object.isElement(content))
        return element.update().insert(content);

      content = Object.toHTML(content);

      var tagName = element.tagName.toUpperCase();

      if (tagName === 'SCRIPT' && SCRIPT_ELEMENT_REJECTS_TEXTNODE_APPENDING) {
        element.text = content;
        return element;
      }

      if (ANY_INNERHTML_BUGGY) {
        if (tagName in Element._insertionTranslations.tags) {
          while (element.firstChild) {
            element.removeChild(element.firstChild);
          }
          Element._getContentFromAnonymousElement(tagName, content.stripScripts())
            .each(function(node) {
              element.appendChild(node)
            });
        } else if (LINK_ELEMENT_INNERHTML_BUGGY && Object.isString(content) && content.indexOf('<link') > -1) {
          while (element.firstChild) {
            element.removeChild(element.firstChild);
          }
          var nodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts(), true);
          nodes.each(function(node) { element.appendChild(node) });
        }
        else {
          element.innerHTML = content.stripScripts();
        }
      }
      else {
        element.innerHTML = content.stripScripts();
      }

      content.evalScripts.bind(content).defer();
      return element;
    }

    return update;
  })(),

  replace: function(element, content) {
    element = $(element);
    if (content && content.toElement) content = content.toElement();
    else if (!Object.isElement(content)) {
      content = Object.toHTML(content);
      var range = element.ownerDocument.createRange();
      range.selectNode(element);
      content.evalScripts.bind(content).defer();
      content = range.createContextualFragment(content.stripScripts());
    }
    element.parentNode.replaceChild(content, element);
    return element;
  },

  insert: function(element, insertions) {
    element = $(element);

    if (Object.isString(insertions) || Object.isNumber(insertions) ||
        Object.isElement(insertions) || (insertions && (insertions.toElement || insertions.toHTML)))
          insertions = {bottom:insertions};

    var content, insert, tagName, childNodes;

    for (var position in insertions) {
      content  = insertions[position];
      position = position.toLowerCase();
      insert = Element._insertionTranslations[position];

      if (content && content.toElement) content = content.toElement();
      if (Object.isElement(content)) {
        insert(element, content);
        continue;
      }

      content = Object.toHTML(content);

      tagName = ((position == 'before' || position == 'after')
        ? element.parentNode : element).tagName.toUpperCase();

      childNodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts());

      if (position == 'top' || position == 'after') childNodes.reverse();
      childNodes.each(insert.curry(element));

      content.evalScripts.bind(content).defer();
    }

    return element;
  },

  wrap: function(element, wrapper, attributes) {
    element = $(element);
    if (Object.isElement(wrapper))
      $(wrapper).writeAttribute(attributes || { });
    else if (Object.isString(wrapper)) wrapper = new Element(wrapper, attributes);
    else wrapper = new Element('div', wrapper);
    if (element.parentNode)
      element.parentNode.replaceChild(wrapper, element);
    wrapper.appendChild(element);
    return wrapper;
  },

  inspect: function(element) {
    element = $(element);
    var result = '<' + element.tagName.toLowerCase();
    $H({'id': 'id', 'className': 'class'}).each(function(pair) {
      var property = pair.first(),
          attribute = pair.last(),
          value = (element[property] || '').toString();
      if (value) result += ' ' + attribute + '=' + value.inspect(true);
    });
    return result + '>';
  },

  recursivelyCollect: function(element, property, maximumLength) {
    element = $(element);
    maximumLength = maximumLength || -1;
    var elements = [];

    while (element = element[property]) {
      if (element.nodeType == 1)
        elements.push(Element.extend(element));
      if (elements.length == maximumLength)
        break;
    }

    return elements;
  },

  ancestors: function(element) {
    return Element.recursivelyCollect(element, 'parentNode');
  },

  descendants: function(element) {
    return Element.select(element, "*");
  },

  firstDescendant: function(element) {
    element = $(element).firstChild;
    while (element && element.nodeType != 1) element = element.nextSibling;
    return $(element);
  },

  immediateDescendants: function(element) {
    var results = [], child = $(element).firstChild;
    while (child) {
      if (child.nodeType === 1) {
        results.push(Element.extend(child));
      }
      child = child.nextSibling;
    }
    return results;
  },

  previousSiblings: function(element, maximumLength) {
    return Element.recursivelyCollect(element, 'previousSibling');
  },

  nextSiblings: function(element) {
    return Element.recursivelyCollect(element, 'nextSibling');
  },

  siblings: function(element) {
    element = $(element);
    return Element.previousSiblings(element).reverse()
      .concat(Element.nextSiblings(element));
  },

  match: function(element, selector) {
    element = $(element);
    if (Object.isString(selector))
      return Prototype.Selector.match(element, selector);
    return selector.match(element);
  },

  up: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(element.parentNode);
    var ancestors = Element.ancestors(element);
    return Object.isNumber(expression) ? ancestors[expression] :
      Prototype.Selector.find(ancestors, expression, index);
  },

  down: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return Element.firstDescendant(element);
    return Object.isNumber(expression) ? Element.descendants(element)[expression] :
      Element.select(element, expression)[index || 0];
  },

  previous: function(element, expression, index) {
    element = $(element);
    if (Object.isNumber(expression)) index = expression, expression = false;
    if (!Object.isNumber(index)) index = 0;

    if (expression) {
      return Prototype.Selector.find(element.previousSiblings(), expression, index);
    } else {
      return element.recursivelyCollect("previousSibling", index + 1)[index];
    }
  },

  next: function(element, expression, index) {
    element = $(element);
    if (Object.isNumber(expression)) index = expression, expression = false;
    if (!Object.isNumber(index)) index = 0;

    if (expression) {
      return Prototype.Selector.find(element.nextSiblings(), expression, index);
    } else {
      var maximumLength = Object.isNumber(index) ? index + 1 : 1;
      return element.recursivelyCollect("nextSibling", index + 1)[index];
    }
  },


  select: function(element) {
    element = $(element);
    var expressions = Array.prototype.slice.call(arguments, 1).join(', ');
    return Prototype.Selector.select(expressions, element);
  },

  adjacent: function(element) {
    element = $(element);
    var expressions = Array.prototype.slice.call(arguments, 1).join(', ');
    return Prototype.Selector.select(expressions, element.parentNode).without(element);
  },

  identify: function(element) {
    element = $(element);
    var id = Element.readAttribute(element, 'id');
    if (id) return id;
    do { id = 'anonymous_element_' + Element.idCounter++ } while ($(id));
    Element.writeAttribute(element, 'id', id);
    return id;
  },

  readAttribute: function(element, name) {
    element = $(element);
    if (Prototype.Browser.IE) {
      var t = Element._attributeTranslations.read;
      if (t.values[name]) return t.values[name](element, name);
      if (t.names[name]) name = t.names[name];
      if (name.include(':')) {
        return (!element.attributes || !element.attributes[name]) ? null :
         element.attributes[name].value;
      }
    }
    return element.getAttribute(name);
  },

  writeAttribute: function(element, name, value) {
    element = $(element);
    var attributes = { }, t = Element._attributeTranslations.write;

    if (typeof name == 'object') attributes = name;
    else attributes[name] = Object.isUndefined(value) ? true : value;

    for (var attr in attributes) {
      name = t.names[attr] || attr;
      value = attributes[attr];
      if (t.values[attr]) name = t.values[attr](element, value);
      if (value === false || value === null)
        element.removeAttribute(name);
      else if (value === true)
        element.setAttribute(name, name);
      else element.setAttribute(name, value);
    }
    return element;
  },

  getHeight: function(element) {
    return Element.getDimensions(element).height;
  },

  getWidth: function(element) {
    return Element.getDimensions(element).width;
  },

  classNames: function(element) {
    return new Element.ClassNames(element);
  },

  hasClassName: function(element, className) {
    if (!(element = $(element))) return;
    var elementClassName = element.className;
    return (elementClassName.length > 0 && (elementClassName == className ||
      new RegExp("(^|\\s)" + className + "(\\s|$)").test(elementClassName)));
  },

  addClassName: function(element, className) {
    if (!(element = $(element))) return;
    if (!Element.hasClassName(element, className))
      element.className += (element.className ? ' ' : '') + className;
    return element;
  },

  removeClassName: function(element, className) {
    if (!(element = $(element))) return;
    element.className = element.className.replace(
      new RegExp("(^|\\s+)" + className + "(\\s+|$)"), ' ').strip();
    return element;
  },

  toggleClassName: function(element, className) {
    if (!(element = $(element))) return;
    return Element[Element.hasClassName(element, className) ?
      'removeClassName' : 'addClassName'](element, className);
  },

  cleanWhitespace: function(element) {
    element = $(element);
    var node = element.firstChild;
    while (node) {
      var nextNode = node.nextSibling;
      if (node.nodeType == 3 && !/\S/.test(node.nodeValue))
        element.removeChild(node);
      node = nextNode;
    }
    return element;
  },

  empty: function(element) {
    return $(element).innerHTML.blank();
  },

  descendantOf: function(element, ancestor) {
    element = $(element), ancestor = $(ancestor);

    if (element.compareDocumentPosition)
      return (element.compareDocumentPosition(ancestor) & 8) === 8;

    if (ancestor.contains)
      return ancestor.contains(element) && ancestor !== element;

    while (element = element.parentNode)
      if (element == ancestor) return true;

    return false;
  },

  scrollTo: function(element) {
    element = $(element);
    var pos = Element.cumulativeOffset(element);
    window.scrollTo(pos[0], pos[1]);
    return element;
  },

  getStyle: function(element, style) {
    element = $(element);
    style = style == 'float' ? 'cssFloat' : style.camelize();
    var value = element.style[style];
    if (!value || value == 'auto') {
      var css = document.defaultView.getComputedStyle(element, null);
      value = css ? css[style] : null;
    }
    if (style == 'opacity') return value ? parseFloat(value) : 1.0;
    return value == 'auto' ? null : value;
  },

  getOpacity: function(element) {
    return $(element).getStyle('opacity');
  },

  setStyle: function(element, styles) {
    element = $(element);
    var elementStyle = element.style, match;
    if (Object.isString(styles)) {
      element.style.cssText += ';' + styles;
      return styles.include('opacity') ?
        element.setOpacity(styles.match(/opacity:\s*(\d?\.?\d*)/)[1]) : element;
    }
    for (var property in styles)
      if (property == 'opacity') element.setOpacity(styles[property]);
      else
        elementStyle[(property == 'float' || property == 'cssFloat') ?
          (Object.isUndefined(elementStyle.styleFloat) ? 'cssFloat' : 'styleFloat') :
            property] = styles[property];

    return element;
  },

  setOpacity: function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;
    return element;
  },

  makePositioned: function(element) {
    element = $(element);
    var pos = Element.getStyle(element, 'position');
    if (pos == 'static' || !pos) {
      element._madePositioned = true;
      element.style.position = 'relative';
      if (Prototype.Browser.Opera) {
        element.style.top = 0;
        element.style.left = 0;
      }
    }
    return element;
  },

  undoPositioned: function(element) {
    element = $(element);
    if (element._madePositioned) {
      element._madePositioned = undefined;
      element.style.position =
        element.style.top =
        element.style.left =
        element.style.bottom =
        element.style.right = '';
    }
    return element;
  },

  makeClipping: function(element) {
    element = $(element);
    if (element._overflow) return element;
    element._overflow = Element.getStyle(element, 'overflow') || 'auto';
    if (element._overflow !== 'hidden')
      element.style.overflow = 'hidden';
    return element;
  },

  undoClipping: function(element) {
    element = $(element);
    if (!element._overflow) return element;
    element.style.overflow = element._overflow == 'auto' ? '' : element._overflow;
    element._overflow = null;
    return element;
  },

  clonePosition: function(element, source) {
    var options = Object.extend({
      setLeft:    true,
      setTop:     true,
      setWidth:   true,
      setHeight:  true,
      offsetTop:  0,
      offsetLeft: 0
    }, arguments[2] || { });

    source = $(source);
    var p = Element.viewportOffset(source), delta = [0, 0], parent = null;

    element = $(element);

    if (Element.getStyle(element, 'position') == 'absolute') {
      parent = Element.getOffsetParent(element);
      delta = Element.viewportOffset(parent);
    }

    if (parent == document.body) {
      delta[0] -= document.body.offsetLeft;
      delta[1] -= document.body.offsetTop;
    }

    if (options.setLeft)   element.style.left  = (p[0] - delta[0] + options.offsetLeft) + 'px';
    if (options.setTop)    element.style.top   = (p[1] - delta[1] + options.offsetTop) + 'px';
    if (options.setWidth)  element.style.width = source.offsetWidth + 'px';
    if (options.setHeight) element.style.height = source.offsetHeight + 'px';
    return element;
  }
};

Object.extend(Element.Methods, {
  getElementsBySelector: Element.Methods.select,

  childElements: Element.Methods.immediateDescendants
});

Element._attributeTranslations = {
  write: {
    names: {
      className: 'class',
      htmlFor:   'for'
    },
    values: { }
  }
};

if (Prototype.Browser.Opera) {
  Element.Methods.getStyle = Element.Methods.getStyle.wrap(
    function(proceed, element, style) {
      switch (style) {
        case 'height': case 'width':
          if (!Element.visible(element)) return null;

          var dim = parseInt(proceed(element, style), 10);

          if (dim !== element['offset' + style.capitalize()])
            return dim + 'px';

          var properties;
          if (style === 'height') {
            properties = ['border-top-width', 'padding-top',
             'padding-bottom', 'border-bottom-width'];
          }
          else {
            properties = ['border-left-width', 'padding-left',
             'padding-right', 'border-right-width'];
          }
          return properties.inject(dim, function(memo, property) {
            var val = proceed(element, property);
            return val === null ? memo : memo - parseInt(val, 10);
          }) + 'px';
        default: return proceed(element, style);
      }
    }
  );

  Element.Methods.readAttribute = Element.Methods.readAttribute.wrap(
    function(proceed, element, attribute) {
      if (attribute === 'title') return element.title;
      return proceed(element, attribute);
    }
  );
}

else if (Prototype.Browser.IE) {
  Element.Methods.getStyle = function(element, style) {
    element = $(element);
    style = (style == 'float' || style == 'cssFloat') ? 'styleFloat' : style.camelize();
    var value = element.style[style];
    if (!value && element.currentStyle) value = element.currentStyle[style];

    if (style == 'opacity') {
      if (value = (element.getStyle('filter') || '').match(/alpha\(opacity=(.*)\)/))
        if (value[1]) return parseFloat(value[1]) / 100;
      return 1.0;
    }

    if (value == 'auto') {
      if ((style == 'width' || style == 'height') && (element.getStyle('display') != 'none'))
        return element['offset' + style.capitalize()] + 'px';
      return null;
    }
    return value;
  };

  Element.Methods.setOpacity = function(element, value) {
    function stripAlpha(filter){
      return filter.replace(/alpha\([^\)]*\)/gi,'');
    }
    element = $(element);
    var currentStyle = element.currentStyle;
    if ((currentStyle && !currentStyle.hasLayout) ||
      (!currentStyle && element.style.zoom == 'normal'))
        element.style.zoom = 1;

    var filter = element.getStyle('filter'), style = element.style;
    if (value == 1 || value === '') {
      (filter = stripAlpha(filter)) ?
        style.filter = filter : style.removeAttribute('filter');
      return element;
    } else if (value < 0.00001) value = 0;
    style.filter = stripAlpha(filter) +
      'alpha(opacity=' + (value * 100) + ')';
    return element;
  };

  Element._attributeTranslations = (function(){

    var classProp = 'className',
        forProp = 'for',
        el = document.createElement('div');

    el.setAttribute(classProp, 'x');

    if (el.className !== 'x') {
      el.setAttribute('class', 'x');
      if (el.className === 'x') {
        classProp = 'class';
      }
    }
    el = null;

    el = document.createElement('label');
    el.setAttribute(forProp, 'x');
    if (el.htmlFor !== 'x') {
      el.setAttribute('htmlFor', 'x');
      if (el.htmlFor === 'x') {
        forProp = 'htmlFor';
      }
    }
    el = null;

    return {
      read: {
        names: {
          'class':      classProp,
          'className':  classProp,
          'for':        forProp,
          'htmlFor':    forProp
        },
        values: {
          _getAttr: function(element, attribute) {
            return element.getAttribute(attribute);
          },
          _getAttr2: function(element, attribute) {
            return element.getAttribute(attribute, 2);
          },
          _getAttrNode: function(element, attribute) {
            var node = element.getAttributeNode(attribute);
            return node ? node.value : "";
          },
          _getEv: (function(){

            var el = document.createElement('div'), f;
            el.onclick = Prototype.emptyFunction;
            var value = el.getAttribute('onclick');

            if (String(value).indexOf('{') > -1) {
              f = function(element, attribute) {
                attribute = element.getAttribute(attribute);
                if (!attribute) return null;
                attribute = attribute.toString();
                attribute = attribute.split('{')[1];
                attribute = attribute.split('}')[0];
                return attribute.strip();
              };
            }
            else if (value === '') {
              f = function(element, attribute) {
                attribute = element.getAttribute(attribute);
                if (!attribute) return null;
                return attribute.strip();
              };
            }
            el = null;
            return f;
          })(),
          _flag: function(element, attribute) {
            return $(element).hasAttribute(attribute) ? attribute : null;
          },
          style: function(element) {
            return element.style.cssText.toLowerCase();
          },
          title: function(element) {
            return element.title;
          }
        }
      }
    }
  })();

  Element._attributeTranslations.write = {
    names: Object.extend({
      cellpadding: 'cellPadding',
      cellspacing: 'cellSpacing'
    }, Element._attributeTranslations.read.names),
    values: {
      checked: function(element, value) {
        element.checked = !!value;
      },

      style: function(element, value) {
        element.style.cssText = value ? value : '';
      }
    }
  };

  Element._attributeTranslations.has = {};

  $w('colSpan rowSpan vAlign dateTime accessKey tabIndex ' +
      'encType maxLength readOnly longDesc frameBorder').each(function(attr) {
    Element._attributeTranslations.write.names[attr.toLowerCase()] = attr;
    Element._attributeTranslations.has[attr.toLowerCase()] = attr;
  });

  (function(v) {
    Object.extend(v, {
      href:        v._getAttr2,
      src:         v._getAttr2,
      type:        v._getAttr,
      action:      v._getAttrNode,
      disabled:    v._flag,
      checked:     v._flag,
      readonly:    v._flag,
      multiple:    v._flag,
      onload:      v._getEv,
      onunload:    v._getEv,
      onclick:     v._getEv,
      ondblclick:  v._getEv,
      onmousedown: v._getEv,
      onmouseup:   v._getEv,
      onmouseover: v._getEv,
      onmousemove: v._getEv,
      onmouseout:  v._getEv,
      onfocus:     v._getEv,
      onblur:      v._getEv,
      onkeypress:  v._getEv,
      onkeydown:   v._getEv,
      onkeyup:     v._getEv,
      onsubmit:    v._getEv,
      onreset:     v._getEv,
      onselect:    v._getEv,
      onchange:    v._getEv
    });
  })(Element._attributeTranslations.read.values);

  if (Prototype.BrowserFeatures.ElementExtensions) {
    (function() {
      function _descendants(element) {
        var nodes = element.getElementsByTagName('*'), results = [];
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.tagName !== "!") // Filter out comment nodes.
            results.push(node);
        return results;
      }

      Element.Methods.down = function(element, expression, index) {
        element = $(element);
        if (arguments.length == 1) return element.firstDescendant();
        return Object.isNumber(expression) ? _descendants(element)[expression] :
          Element.select(element, expression)[index || 0];
      }
    })();
  }

}

else if (Prototype.Browser.Gecko && /rv:1\.8\.0/.test(navigator.userAgent)) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1) ? 0.999999 :
      (value === '') ? '' : (value < 0.00001) ? 0 : value;
    return element;
  };
}

else if (Prototype.Browser.WebKit) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;

    if (value == 1)
      if (element.tagName.toUpperCase() == 'IMG' && element.width) {
        element.width++; element.width--;
      } else try {
        var n = document.createTextNode(' ');
        element.appendChild(n);
        element.removeChild(n);
      } catch (e) { }

    return element;
  };
}

if ('outerHTML' in document.documentElement) {
  Element.Methods.replace = function(element, content) {
    element = $(element);

    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) {
      element.parentNode.replaceChild(content, element);
      return element;
    }

    content = Object.toHTML(content);
    var parent = element.parentNode, tagName = parent.tagName.toUpperCase();

    if (Element._insertionTranslations.tags[tagName]) {
      var nextSibling = element.next(),
          fragments = Element._getContentFromAnonymousElement(tagName, content.stripScripts());
      parent.removeChild(element);
      if (nextSibling)
        fragments.each(function(node) { parent.insertBefore(node, nextSibling) });
      else
        fragments.each(function(node) { parent.appendChild(node) });
    }
    else element.outerHTML = content.stripScripts();

    content.evalScripts.bind(content).defer();
    return element;
  };
}

Element._returnOffset = function(l, t) {
  var result = [l, t];
  result.left = l;
  result.top = t;
  return result;
};

Element._getContentFromAnonymousElement = function(tagName, html, force) {
  var div = new Element('div'),
      t = Element._insertionTranslations.tags[tagName];

  var workaround = false;
  if (t) workaround = true;
  else if (force) {
    workaround = true;
    t = ['', '', 0];
  }

  if (workaround) {
    div.innerHTML = '&nbsp;' + t[0] + html + t[1];
    div.removeChild(div.firstChild);
    for (var i = t[2]; i--; ) {
      div = div.firstChild;
    }
  }
  else {
    div.innerHTML = html;
  }
  return $A(div.childNodes);
};

Element._insertionTranslations = {
  before: function(element, node) {
    element.parentNode.insertBefore(node, element);
  },
  top: function(element, node) {
    element.insertBefore(node, element.firstChild);
  },
  bottom: function(element, node) {
    element.appendChild(node);
  },
  after: function(element, node) {
    element.parentNode.insertBefore(node, element.nextSibling);
  },
  tags: {
    TABLE:  ['<table>',                '</table>',                   1],
    TBODY:  ['<table><tbody>',         '</tbody></table>',           2],
    TR:     ['<table><tbody><tr>',     '</tr></tbody></table>',      3],
    TD:     ['<table><tbody><tr><td>', '</td></tr></tbody></table>', 4],
    SELECT: ['<select>',               '</select>',                  1]
  }
};

(function() {
  var tags = Element._insertionTranslations.tags;
  Object.extend(tags, {
    THEAD: tags.TBODY,
    TFOOT: tags.TBODY,
    TH:    tags.TD
  });
})();

Element.Methods.Simulated = {
  hasAttribute: function(element, attribute) {
    attribute = Element._attributeTranslations.has[attribute] || attribute;
    var node = $(element).getAttributeNode(attribute);
    return !!(node && node.specified);
  }
};

Element.Methods.ByTag = { };

Object.extend(Element, Element.Methods);

(function(div) {

  if (!Prototype.BrowserFeatures.ElementExtensions && div['__proto__']) {
    window.HTMLElement = { };
    window.HTMLElement.prototype = div['__proto__'];
    Prototype.BrowserFeatures.ElementExtensions = true;
  }

  div = null;

})(document.createElement('div'));

Element.extend = (function() {

  function checkDeficiency(tagName) {
    if (typeof window.Element != 'undefined') {
      var proto = window.Element.prototype;
      if (proto) {
        var id = '_' + (Math.random()+'').slice(2),
            el = document.createElement(tagName);
        proto[id] = 'x';
        var isBuggy = (el[id] !== 'x');
        delete proto[id];
        el = null;
        return isBuggy;
      }
    }
    return false;
  }

  function extendElementWith(element, methods) {
    for (var property in methods) {
      var value = methods[property];
      if (Object.isFunction(value) && !(property in element))
        element[property] = value.methodize();
    }
  }

  var HTMLOBJECTELEMENT_PROTOTYPE_BUGGY = checkDeficiency('object');

  if (Prototype.BrowserFeatures.SpecificElementExtensions) {
    if (HTMLOBJECTELEMENT_PROTOTYPE_BUGGY) {
      return function(element) {
        if (element && typeof element._extendedByPrototype == 'undefined') {
          var t = element.tagName;
          if (t && (/^(?:object|applet|embed)$/i.test(t))) {
            extendElementWith(element, Element.Methods);
            extendElementWith(element, Element.Methods.Simulated);
            extendElementWith(element, Element.Methods.ByTag[t.toUpperCase()]);
          }
        }
        return element;
      }
    }
    return Prototype.K;
  }

  var Methods = { }, ByTag = Element.Methods.ByTag;

  var extend = Object.extend(function(element) {
    if (!element || typeof element._extendedByPrototype != 'undefined' ||
        element.nodeType != 1 || element == window) return element;

    var methods = Object.clone(Methods),
        tagName = element.tagName.toUpperCase();

    if (ByTag[tagName]) Object.extend(methods, ByTag[tagName]);

    extendElementWith(element, methods);

    element._extendedByPrototype = Prototype.emptyFunction;
    return element;

  }, {
    refresh: function() {
      if (!Prototype.BrowserFeatures.ElementExtensions) {
        Object.extend(Methods, Element.Methods);
        Object.extend(Methods, Element.Methods.Simulated);
      }
    }
  });

  extend.refresh();
  return extend;
})();

if (document.documentElement.hasAttribute) {
  Element.hasAttribute = function(element, attribute) {
    return element.hasAttribute(attribute);
  };
}
else {
  Element.hasAttribute = Element.Methods.Simulated.hasAttribute;
}

Element.addMethods = function(methods) {
  var F = Prototype.BrowserFeatures, T = Element.Methods.ByTag;

  if (!methods) {
    Object.extend(Form, Form.Methods);
    Object.extend(Form.Element, Form.Element.Methods);
    Object.extend(Element.Methods.ByTag, {
      "FORM":     Object.clone(Form.Methods),
      "INPUT":    Object.clone(Form.Element.Methods),
      "SELECT":   Object.clone(Form.Element.Methods),
      "TEXTAREA": Object.clone(Form.Element.Methods),
      "BUTTON":   Object.clone(Form.Element.Methods)
    });
  }

  if (arguments.length == 2) {
    var tagName = methods;
    methods = arguments[1];
  }

  if (!tagName) Object.extend(Element.Methods, methods || { });
  else {
    if (Object.isArray(tagName)) tagName.each(extend);
    else extend(tagName);
  }

  function extend(tagName) {
    tagName = tagName.toUpperCase();
    if (!Element.Methods.ByTag[tagName])
      Element.Methods.ByTag[tagName] = { };
    Object.extend(Element.Methods.ByTag[tagName], methods);
  }

  function copy(methods, destination, onlyIfAbsent) {
    onlyIfAbsent = onlyIfAbsent || false;
    for (var property in methods) {
      var value = methods[property];
      if (!Object.isFunction(value)) continue;
      if (!onlyIfAbsent || !(property in destination))
        destination[property] = value.methodize();
    }
  }

  function findDOMClass(tagName) {
    var klass;
    var trans = {
      "OPTGROUP": "OptGroup", "TEXTAREA": "TextArea", "P": "Paragraph",
      "FIELDSET": "FieldSet", "UL": "UList", "OL": "OList", "DL": "DList",
      "DIR": "Directory", "H1": "Heading", "H2": "Heading", "H3": "Heading",
      "H4": "Heading", "H5": "Heading", "H6": "Heading", "Q": "Quote",
      "INS": "Mod", "DEL": "Mod", "A": "Anchor", "IMG": "Image", "CAPTION":
      "TableCaption", "COL": "TableCol", "COLGROUP": "TableCol", "THEAD":
      "TableSection", "TFOOT": "TableSection", "TBODY": "TableSection", "TR":
      "TableRow", "TH": "TableCell", "TD": "TableCell", "FRAMESET":
      "FrameSet", "IFRAME": "IFrame"
    };
    if (trans[tagName]) klass = 'HTML' + trans[tagName] + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName.capitalize() + 'Element';
    if (window[klass]) return window[klass];

    var element = document.createElement(tagName),
        proto = element['__proto__'] || element.constructor.prototype;

    element = null;
    return proto;
  }

  var elementPrototype = window.HTMLElement ? HTMLElement.prototype :
   Element.prototype;

  if (F.ElementExtensions) {
    copy(Element.Methods, elementPrototype);
    copy(Element.Methods.Simulated, elementPrototype, true);
  }

  if (F.SpecificElementExtensions) {
    for (var tag in Element.Methods.ByTag) {
      var klass = findDOMClass(tag);
      if (Object.isUndefined(klass)) continue;
      copy(T[tag], klass.prototype);
    }
  }

  Object.extend(Element, Element.Methods);
  delete Element.ByTag;

  if (Element.extend.refresh) Element.extend.refresh();
  Element.cache = { };
};


document.viewport = {

  getDimensions: function() {
    return { width: this.getWidth(), height: this.getHeight() };
  },

  getScrollOffsets: function() {
    return Element._returnOffset(
      window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft,
      window.pageYOffset || document.documentElement.scrollTop  || document.body.scrollTop);
  }
};

(function(viewport) {
  var B = Prototype.Browser, doc = document, element, property = {};

  function getRootElement() {
    if (B.WebKit && !doc.evaluate)
      return document;

    if (B.Opera && window.parseFloat(window.opera.version()) < 9.5)
      return document.body;

    return document.documentElement;
  }

  function define(D) {
    if (!element) element = getRootElement();

    property[D] = 'client' + D;

    viewport['get' + D] = function() { return element[property[D]] };
    return viewport['get' + D]();
  }

  viewport.getWidth  = define.curry('Width');

  viewport.getHeight = define.curry('Height');
})(document.viewport);


Element.Storage = {
  UID: 1
};

Element.addMethods({
  getStorage: function(element) {
    if (!(element = $(element))) return;

    var uid;
    if (element === window) {
      uid = 0;
    } else {
      if (typeof element._prototypeUID === "undefined")
        element._prototypeUID = Element.Storage.UID++;
      uid = element._prototypeUID;
    }

    if (!Element.Storage[uid])
      Element.Storage[uid] = $H();

    return Element.Storage[uid];
  },

  store: function(element, key, value) {
    if (!(element = $(element))) return;

    if (arguments.length === 2) {
      Element.getStorage(element).update(key);
    } else {
      Element.getStorage(element).set(key, value);
    }

    return element;
  },

  retrieve: function(element, key, defaultValue) {
    if (!(element = $(element))) return;
    var hash = Element.getStorage(element), value = hash.get(key);

    if (Object.isUndefined(value)) {
      hash.set(key, defaultValue);
      value = defaultValue;
    }

    return value;
  },

  clone: function(element, deep) {
    if (!(element = $(element))) return;
    var clone = element.cloneNode(deep);
    clone._prototypeUID = void 0;
    if (deep) {
      var descendants = Element.select(clone, '*'),
          i = descendants.length;
      while (i--) {
        descendants[i]._prototypeUID = void 0;
      }
    }
    return Element.extend(clone);
  },

  purge: function(element) {
    if (!(element = $(element))) return;
    var purgeElement = Element._purgeElement;

    purgeElement(element);

    var descendants = element.getElementsByTagName('*'),
     i = descendants.length;

    while (i--) purgeElement(descendants[i]);

    return null;
  }
});

(function() {

  function toDecimal(pctString) {
    var match = pctString.match(/^(\d+)%?$/i);
    if (!match) return null;
    return (Number(match[1]) / 100);
  }

  function getPixelValue(value, property, context) {
    var element = null;
    if (Object.isElement(value)) {
      element = value;
      value = element.getStyle(property);
    }

    if (value === null) {
      return null;
    }

    if ((/^(?:-)?\d+(\.\d+)?(px)?$/i).test(value)) {
      return window.parseFloat(value);
    }

    var isPercentage = value.include('%'), isViewport = (context === document.viewport);

    if (/\d/.test(value) && element && element.runtimeStyle && !(isPercentage && isViewport)) {
      var style = element.style.left, rStyle = element.runtimeStyle.left;
      element.runtimeStyle.left = element.currentStyle.left;
      element.style.left = value || 0;
      value = element.style.pixelLeft;
      element.style.left = style;
      element.runtimeStyle.left = rStyle;

      return value;
    }

    if (element && isPercentage) {
      context = context || element.parentNode;
      var decimal = toDecimal(value);
      var whole = null;
      var position = element.getStyle('position');

      var isHorizontal = property.include('left') || property.include('right') ||
       property.include('width');

      var isVertical =  property.include('top') || property.include('bottom') ||
        property.include('height');

      if (context === document.viewport) {
        if (isHorizontal) {
          whole = document.viewport.getWidth();
        } else if (isVertical) {
          whole = document.viewport.getHeight();
        }
      } else {
        if (isHorizontal) {
          whole = $(context).measure('width');
        } else if (isVertical) {
          whole = $(context).measure('height');
        }
      }

      return (whole === null) ? 0 : whole * decimal;
    }

    return 0;
  }

  function toCSSPixels(number) {
    if (Object.isString(number) && number.endsWith('px')) {
      return number;
    }
    return number + 'px';
  }

  function isDisplayed(element) {
    var originalElement = element;
    while (element && element.parentNode) {
      var display = element.getStyle('display');
      if (display === 'none') {
        return false;
      }
      element = $(element.parentNode);
    }
    return true;
  }

  var hasLayout = Prototype.K;
  if ('currentStyle' in document.documentElement) {
    hasLayout = function(element) {
      if (!element.currentStyle.hasLayout) {
        element.style.zoom = 1;
      }
      return element;
    };
  }

  function cssNameFor(key) {
    if (key.include('border')) key = key + '-width';
    return key.camelize();
  }

  Element.Layout = Class.create(Hash, {
    initialize: function($super, element, preCompute) {
      $super();
      this.element = $(element);

      Element.Layout.PROPERTIES.each( function(property) {
        this._set(property, null);
      }, this);

      if (preCompute) {
        this._preComputing = true;
        this._begin();
        Element.Layout.PROPERTIES.each( this._compute, this );
        this._end();
        this._preComputing = false;
      }
    },

    _set: function(property, value) {
      return Hash.prototype.set.call(this, property, value);
    },

    set: function(property, value) {
      throw "Properties of Element.Layout are read-only.";
    },

    get: function($super, property) {
      var value = $super(property);
      return value === null ? this._compute(property) : value;
    },

    _begin: function() {
      if (this._prepared) return;

      var element = this.element;
      if (isDisplayed(element)) {
        this._prepared = true;
        return;
      }

      var originalStyles = {
        position:   element.style.position   || '',
        width:      element.style.width      || '',
        visibility: element.style.visibility || '',
        display:    element.style.display    || ''
      };

      element.store('prototype_original_styles', originalStyles);

      var position = element.getStyle('position'),
       width = element.getStyle('width');

      if (width === "0px" || width === null) {
        element.style.display = 'block';
        width = element.getStyle('width');
      }

      var context = (position === 'fixed') ? document.viewport :
       element.parentNode;

      element.setStyle({
        position:   'absolute',
        visibility: 'hidden',
        display:    'block'
      });

      var positionedWidth = element.getStyle('width');

      var newWidth;
      if (width && (positionedWidth === width)) {
        newWidth = getPixelValue(element, 'width', context);
      } else if (position === 'absolute' || position === 'fixed') {
        newWidth = getPixelValue(element, 'width', context);
      } else {
        var parent = element.parentNode, pLayout = $(parent).getLayout();

        newWidth = pLayout.get('width') -
         this.get('margin-left') -
         this.get('border-left') -
         this.get('padding-left') -
         this.get('padding-right') -
         this.get('border-right') -
         this.get('margin-right');
      }

      element.setStyle({ width: newWidth + 'px' });

      this._prepared = true;
    },

    _end: function() {
      var element = this.element;
      var originalStyles = element.retrieve('prototype_original_styles');
      element.store('prototype_original_styles', null);
      element.setStyle(originalStyles);
      this._prepared = false;
    },

    _compute: function(property) {
      var COMPUTATIONS = Element.Layout.COMPUTATIONS;
      if (!(property in COMPUTATIONS)) {
        throw "Property not found.";
      }

      return this._set(property, COMPUTATIONS[property].call(this, this.element));
    },

    toObject: function() {
      var args = $A(arguments);
      var keys = (args.length === 0) ? Element.Layout.PROPERTIES :
       args.join(' ').split(' ');
      var obj = {};
      keys.each( function(key) {
        if (!Element.Layout.PROPERTIES.include(key)) return;
        var value = this.get(key);
        if (value != null) obj[key] = value;
      }, this);
      return obj;
    },

    toHash: function() {
      var obj = this.toObject.apply(this, arguments);
      return new Hash(obj);
    },

    toCSS: function() {
      var args = $A(arguments);
      var keys = (args.length === 0) ? Element.Layout.PROPERTIES :
       args.join(' ').split(' ');
      var css = {};

      keys.each( function(key) {
        if (!Element.Layout.PROPERTIES.include(key)) return;
        if (Element.Layout.COMPOSITE_PROPERTIES.include(key)) return;

        var value = this.get(key);
        if (value != null) css[cssNameFor(key)] = value + 'px';
      }, this);
      return css;
    },

    inspect: function() {
      return "#<Element.Layout>";
    }
  });

  Object.extend(Element.Layout, {
    PROPERTIES: $w('height width top left right bottom border-left border-right border-top border-bottom padding-left padding-right padding-top padding-bottom margin-top margin-bottom margin-left margin-right padding-box-width padding-box-height border-box-width border-box-height margin-box-width margin-box-height'),

    COMPOSITE_PROPERTIES: $w('padding-box-width padding-box-height margin-box-width margin-box-height border-box-width border-box-height'),

    COMPUTATIONS: {
      'height': function(element) {
        if (!this._preComputing) this._begin();

        var bHeight = this.get('border-box-height');
        if (bHeight <= 0) {
          if (!this._preComputing) this._end();
          return 0;
        }

        var bTop = this.get('border-top'),
         bBottom = this.get('border-bottom');

        var pTop = this.get('padding-top'),
         pBottom = this.get('padding-bottom');

        if (!this._preComputing) this._end();

        return bHeight - bTop - bBottom - pTop - pBottom;
      },

      'width': function(element) {
        if (!this._preComputing) this._begin();

        var bWidth = this.get('border-box-width');
        if (bWidth <= 0) {
          if (!this._preComputing) this._end();
          return 0;
        }

        var bLeft = this.get('border-left'),
         bRight = this.get('border-right');

        var pLeft = this.get('padding-left'),
         pRight = this.get('padding-right');

        if (!this._preComputing) this._end();

        return bWidth - bLeft - bRight - pLeft - pRight;
      },

      'padding-box-height': function(element) {
        var height = this.get('height'),
         pTop = this.get('padding-top'),
         pBottom = this.get('padding-bottom');

        return height + pTop + pBottom;
      },

      'padding-box-width': function(element) {
        var width = this.get('width'),
         pLeft = this.get('padding-left'),
         pRight = this.get('padding-right');

        return width + pLeft + pRight;
      },

      'border-box-height': function(element) {
        if (!this._preComputing) this._begin();
        var height = element.offsetHeight;
        if (!this._preComputing) this._end();
        return height;
      },

      'border-box-width': function(element) {
        if (!this._preComputing) this._begin();
        var width = element.offsetWidth;
        if (!this._preComputing) this._end();
        return width;
      },

      'margin-box-height': function(element) {
        var bHeight = this.get('border-box-height'),
         mTop = this.get('margin-top'),
         mBottom = this.get('margin-bottom');

        if (bHeight <= 0) return 0;

        return bHeight + mTop + mBottom;
      },

      'margin-box-width': function(element) {
        var bWidth = this.get('border-box-width'),
         mLeft = this.get('margin-left'),
         mRight = this.get('margin-right');

        if (bWidth <= 0) return 0;

        return bWidth + mLeft + mRight;
      },

      'top': function(element) {
        var offset = element.positionedOffset();
        return offset.top;
      },

      'bottom': function(element) {
        var offset = element.positionedOffset(),
         parent = element.getOffsetParent(),
         pHeight = parent.measure('height');

        var mHeight = this.get('border-box-height');

        return pHeight - mHeight - offset.top;
      },

      'left': function(element) {
        var offset = element.positionedOffset();
        return offset.left;
      },

      'right': function(element) {
        var offset = element.positionedOffset(),
         parent = element.getOffsetParent(),
         pWidth = parent.measure('width');

        var mWidth = this.get('border-box-width');

        return pWidth - mWidth - offset.left;
      },

      'padding-top': function(element) {
        return getPixelValue(element, 'paddingTop');
      },

      'padding-bottom': function(element) {
        return getPixelValue(element, 'paddingBottom');
      },

      'padding-left': function(element) {
        return getPixelValue(element, 'paddingLeft');
      },

      'padding-right': function(element) {
        return getPixelValue(element, 'paddingRight');
      },

      'border-top': function(element) {
        return getPixelValue(element, 'borderTopWidth');
      },

      'border-bottom': function(element) {
        return getPixelValue(element, 'borderBottomWidth');
      },

      'border-left': function(element) {
        return getPixelValue(element, 'borderLeftWidth');
      },

      'border-right': function(element) {
        return getPixelValue(element, 'borderRightWidth');
      },

      'margin-top': function(element) {
        return getPixelValue(element, 'marginTop');
      },

      'margin-bottom': function(element) {
        return getPixelValue(element, 'marginBottom');
      },

      'margin-left': function(element) {
        return getPixelValue(element, 'marginLeft');
      },

      'margin-right': function(element) {
        return getPixelValue(element, 'marginRight');
      }
    }
  });

  if ('getBoundingClientRect' in document.documentElement) {
    Object.extend(Element.Layout.COMPUTATIONS, {
      'right': function(element) {
        var parent = hasLayout(element.getOffsetParent());
        var rect = element.getBoundingClientRect(),
         pRect = parent.getBoundingClientRect();

        return (pRect.right - rect.right).round();
      },

      'bottom': function(element) {
        var parent = hasLayout(element.getOffsetParent());
        var rect = element.getBoundingClientRect(),
         pRect = parent.getBoundingClientRect();

        return (pRect.bottom - rect.bottom).round();
      }
    });
  }

  Element.Offset = Class.create({
    initialize: function(left, top) {
      this.left = left.round();
      this.top  = top.round();

      this[0] = this.left;
      this[1] = this.top;
    },

    relativeTo: function(offset) {
      return new Element.Offset(
        this.left - offset.left,
        this.top  - offset.top
      );
    },

    inspect: function() {
      return "#<Element.Offset left: #{left} top: #{top}>".interpolate(this);
    },

    toString: function() {
      return "[#{left}, #{top}]".interpolate(this);
    },

    toArray: function() {
      return [this.left, this.top];
    }
  });

  function getLayout(element, preCompute) {
    return new Element.Layout(element, preCompute);
  }

  function measure(element, property) {
    return $(element).getLayout().get(property);
  }

  function getDimensions(element) {
    element = $(element);
    var display = Element.getStyle(element, 'display');

    if (display && display !== 'none') {
      return { width: element.offsetWidth, height: element.offsetHeight };
    }

    var style = element.style;
    var originalStyles = {
      visibility: style.visibility,
      position:   style.position,
      display:    style.display
    };

    var newStyles = {
      visibility: 'hidden',
      display:    'block'
    };

    if (originalStyles.position !== 'fixed')
      newStyles.position = 'absolute';

    Element.setStyle(element, newStyles);

    var dimensions = {
      width:  element.offsetWidth,
      height: element.offsetHeight
    };

    Element.setStyle(element, originalStyles);

    return dimensions;
  }

  function getOffsetParent(element) {
    element = $(element);

    if (isDocument(element) || isDetached(element) || isBody(element) || isHtml(element))
      return $(document.body);

    var isInline = (Element.getStyle(element, 'display') === 'inline');
    if (!isInline && element.offsetParent) return $(element.offsetParent);

    while ((element = element.parentNode) && element !== document.body) {
      if (Element.getStyle(element, 'position') !== 'static') {
        return isHtml(element) ? $(document.body) : $(element);
      }
    }

    return $(document.body);
  }


  function cumulativeOffset(element) {
    element = $(element);
    var valueT = 0, valueL = 0;
    if (element.parentNode) {
      do {
        valueT += element.offsetTop  || 0;
        valueL += element.offsetLeft || 0;
        element = element.offsetParent;
      } while (element);
    }
    return new Element.Offset(valueL, valueT);
  }

  function positionedOffset(element) {
    element = $(element);

    var layout = element.getLayout();

    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
      if (element) {
        if (isBody(element)) break;
        var p = Element.getStyle(element, 'position');
        if (p !== 'static') break;
      }
    } while (element);

    valueL -= layout.get('margin-top');
    valueT -= layout.get('margin-left');

    return new Element.Offset(valueL, valueT);
  }

  function cumulativeScrollOffset(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.scrollTop  || 0;
      valueL += element.scrollLeft || 0;
      element = element.parentNode;
    } while (element);
    return new Element.Offset(valueL, valueT);
  }

  function viewportOffset(forElement) {
    element = $(element);
    var valueT = 0, valueL = 0, docBody = document.body;

    var element = forElement;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      if (element.offsetParent == docBody &&
        Element.getStyle(element, 'position') == 'absolute') break;
    } while (element = element.offsetParent);

    element = forElement;
    do {
      if (element != docBody) {
        valueT -= element.scrollTop  || 0;
        valueL -= element.scrollLeft || 0;
      }
    } while (element = element.parentNode);
    return new Element.Offset(valueL, valueT);
  }

  function absolutize(element) {
    element = $(element);

    if (Element.getStyle(element, 'position') === 'absolute') {
      return element;
    }

    var offsetParent = getOffsetParent(element);
    var eOffset = element.viewportOffset(),
     pOffset = offsetParent.viewportOffset();

    var offset = eOffset.relativeTo(pOffset);
    var layout = element.getLayout();

    element.store('prototype_absolutize_original_styles', {
      left:   element.getStyle('left'),
      top:    element.getStyle('top'),
      width:  element.getStyle('width'),
      height: element.getStyle('height')
    });

    element.setStyle({
      position: 'absolute',
      top:    offset.top + 'px',
      left:   offset.left + 'px',
      width:  layout.get('width') + 'px',
      height: layout.get('height') + 'px'
    });

    return element;
  }

  function relativize(element) {
    element = $(element);
    if (Element.getStyle(element, 'position') === 'relative') {
      return element;
    }

    var originalStyles =
     element.retrieve('prototype_absolutize_original_styles');

    if (originalStyles) element.setStyle(originalStyles);
    return element;
  }

  if (Prototype.Browser.IE) {
    getOffsetParent = getOffsetParent.wrap(
      function(proceed, element) {
        element = $(element);

        if (isDocument(element) || isDetached(element) || isBody(element) || isHtml(element))
          return $(document.body);

        var position = element.getStyle('position');
        if (position !== 'static') return proceed(element);

        element.setStyle({ position: 'relative' });
        var value = proceed(element);
        element.setStyle({ position: position });
        return value;
      }
    );

    positionedOffset = positionedOffset.wrap(function(proceed, element) {
      element = $(element);
      if (!element.parentNode) return new Element.Offset(0, 0);
      var position = element.getStyle('position');
      if (position !== 'static') return proceed(element);

      var offsetParent = element.getOffsetParent();
      if (offsetParent && offsetParent.getStyle('position') === 'fixed')
        hasLayout(offsetParent);

      element.setStyle({ position: 'relative' });
      var value = proceed(element);
      element.setStyle({ position: position });
      return value;
    });
  } else if (Prototype.Browser.Webkit) {
    cumulativeOffset = function(element) {
      element = $(element);
      var valueT = 0, valueL = 0;
      do {
        valueT += element.offsetTop  || 0;
        valueL += element.offsetLeft || 0;
        if (element.offsetParent == document.body)
          if (Element.getStyle(element, 'position') == 'absolute') break;

        element = element.offsetParent;
      } while (element);

      return new Element.Offset(valueL, valueT);
    };
  }


  Element.addMethods({
    getLayout:              getLayout,
    measure:                measure,
    getDimensions:          getDimensions,
    getOffsetParent:        getOffsetParent,
    cumulativeOffset:       cumulativeOffset,
    positionedOffset:       positionedOffset,
    cumulativeScrollOffset: cumulativeScrollOffset,
    viewportOffset:         viewportOffset,
    absolutize:             absolutize,
    relativize:             relativize
  });

  function isBody(element) {
    return element.nodeName.toUpperCase() === 'BODY';
  }

  function isHtml(element) {
    return element.nodeName.toUpperCase() === 'HTML';
  }

  function isDocument(element) {
    return element.nodeType === Node.DOCUMENT_NODE;
  }

  function isDetached(element) {
    return element !== document.body &&
     !Element.descendantOf(element, document.body);
  }

  if ('getBoundingClientRect' in document.documentElement) {
    Element.addMethods({
      viewportOffset: function(element) {
        element = $(element);
        if (isDetached(element)) return new Element.Offset(0, 0);

        var rect = element.getBoundingClientRect(),
         docEl = document.documentElement;
        return new Element.Offset(rect.left - docEl.clientLeft,
         rect.top - docEl.clientTop);
      }
    });
  }
})();
window.$$ = function() {
  var expression = $A(arguments).join(', ');
  return Prototype.Selector.select(expression, document);
};

Prototype.Selector = (function() {

  function select() {
    throw new Error('Method "Prototype.Selector.select" must be defined.');
  }

  function match() {
    throw new Error('Method "Prototype.Selector.match" must be defined.');
  }

  function find(elements, expression, index) {
    index = index || 0;
    var match = Prototype.Selector.match, length = elements.length, matchIndex = 0, i;

    for (i = 0; i < length; i++) {
      if (match(elements[i], expression) && index == matchIndex++) {
        return Element.extend(elements[i]);
      }
    }
  }

  function extendElements(elements) {
    for (var i = 0, length = elements.length; i < length; i++) {
      Element.extend(elements[i]);
    }
    return elements;
  }


  var K = Prototype.K;

  return {
    select: select,
    match: match,
    find: find,
    extendElements: (Element.extend === K) ? K : extendElements,
    extendElement: Element.extend
  };
})();
Prototype._original_property = window.Sizzle;
/*!
 * Sizzle CSS Selector Engine - v1.0
 *  Copyright 2009, The Dojo Foundation
 *  Released under the MIT, BSD, and GPL Licenses.
 *  More information: http://sizzlejs.com/
 */
(function(){

var chunker = /((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?((?:.|\r|\n)*)/g,
  done = 0,
  toString = Object.prototype.toString,
  hasDuplicate = false,
  baseHasDuplicate = true;

[0, 0].sort(function(){
  baseHasDuplicate = false;
  return 0;
});

var Sizzle = function(selector, context, results, seed) {
  results = results || [];
  var origContext = context = context || document;

  if ( context.nodeType !== 1 && context.nodeType !== 9 ) {
    return [];
  }

  if ( !selector || typeof selector !== "string" ) {
    return results;
  }

  var parts = [], m, set, checkSet, check, mode, extra, prune = true, contextXML = isXML(context),
    soFar = selector;

  while ( (chunker.exec(""), m = chunker.exec(soFar)) !== null ) {
    soFar = m[3];

    parts.push( m[1] );

    if ( m[2] ) {
      extra = m[3];
      break;
    }
  }

  if ( parts.length > 1 && origPOS.exec( selector ) ) {
    if ( parts.length === 2 && Expr.relative[ parts[0] ] ) {
      set = posProcess( parts[0] + parts[1], context );
    } else {
      set = Expr.relative[ parts[0] ] ?
        [ context ] :
        Sizzle( parts.shift(), context );

      while ( parts.length ) {
        selector = parts.shift();

        if ( Expr.relative[ selector ] )
          selector += parts.shift();

        set = posProcess( selector, set );
      }
    }
  } else {
    if ( !seed && parts.length > 1 && context.nodeType === 9 && !contextXML &&
        Expr.match.ID.test(parts[0]) && !Expr.match.ID.test(parts[parts.length - 1]) ) {
      var ret = Sizzle.find( parts.shift(), context, contextXML );
      context = ret.expr ? Sizzle.filter( ret.expr, ret.set )[0] : ret.set[0];
    }

    if ( context ) {
      var ret = seed ?
        { expr: parts.pop(), set: makeArray(seed) } :
        Sizzle.find( parts.pop(), parts.length === 1 && (parts[0] === "~" || parts[0] === "+") && context.parentNode ? context.parentNode : context, contextXML );
      set = ret.expr ? Sizzle.filter( ret.expr, ret.set ) : ret.set;

      if ( parts.length > 0 ) {
        checkSet = makeArray(set);
      } else {
        prune = false;
      }

      while ( parts.length ) {
        var cur = parts.pop(), pop = cur;

        if ( !Expr.relative[ cur ] ) {
          cur = "";
        } else {
          pop = parts.pop();
        }

        if ( pop == null ) {
          pop = context;
        }

        Expr.relative[ cur ]( checkSet, pop, contextXML );
      }
    } else {
      checkSet = parts = [];
    }
  }

  if ( !checkSet ) {
    checkSet = set;
  }

  if ( !checkSet ) {
    throw "Syntax error, unrecognized expression: " + (cur || selector);
  }

  if ( toString.call(checkSet) === "[object Array]" ) {
    if ( !prune ) {
      results.push.apply( results, checkSet );
    } else if ( context && context.nodeType === 1 ) {
      for ( var i = 0; checkSet[i] != null; i++ ) {
        if ( checkSet[i] && (checkSet[i] === true || checkSet[i].nodeType === 1 && contains(context, checkSet[i])) ) {
          results.push( set[i] );
        }
      }
    } else {
      for ( var i = 0; checkSet[i] != null; i++ ) {
        if ( checkSet[i] && checkSet[i].nodeType === 1 ) {
          results.push( set[i] );
        }
      }
    }
  } else {
    makeArray( checkSet, results );
  }

  if ( extra ) {
    Sizzle( extra, origContext, results, seed );
    Sizzle.uniqueSort( results );
  }

  return results;
};

Sizzle.uniqueSort = function(results){
  if ( sortOrder ) {
    hasDuplicate = baseHasDuplicate;
    results.sort(sortOrder);

    if ( hasDuplicate ) {
      for ( var i = 1; i < results.length; i++ ) {
        if ( results[i] === results[i-1] ) {
          results.splice(i--, 1);
        }
      }
    }
  }

  return results;
};

Sizzle.matches = function(expr, set){
  return Sizzle(expr, null, null, set);
};

Sizzle.find = function(expr, context, isXML){
  var set, match;

  if ( !expr ) {
    return [];
  }

  for ( var i = 0, l = Expr.order.length; i < l; i++ ) {
    var type = Expr.order[i], match;

    if ( (match = Expr.leftMatch[ type ].exec( expr )) ) {
      var left = match[1];
      match.splice(1,1);

      if ( left.substr( left.length - 1 ) !== "\\" ) {
        match[1] = (match[1] || "").replace(/\\/g, "");
        set = Expr.find[ type ]( match, context, isXML );
        if ( set != null ) {
          expr = expr.replace( Expr.match[ type ], "" );
          break;
        }
      }
    }
  }

  if ( !set ) {
    set = context.getElementsByTagName("*");
  }

  return {set: set, expr: expr};
};

Sizzle.filter = function(expr, set, inplace, not){
  var old = expr, result = [], curLoop = set, match, anyFound,
    isXMLFilter = set && set[0] && isXML(set[0]);

  while ( expr && set.length ) {
    for ( var type in Expr.filter ) {
      if ( (match = Expr.match[ type ].exec( expr )) != null ) {
        var filter = Expr.filter[ type ], found, item;
        anyFound = false;

        if ( curLoop == result ) {
          result = [];
        }

        if ( Expr.preFilter[ type ] ) {
          match = Expr.preFilter[ type ]( match, curLoop, inplace, result, not, isXMLFilter );

          if ( !match ) {
            anyFound = found = true;
          } else if ( match === true ) {
            continue;
          }
        }

        if ( match ) {
          for ( var i = 0; (item = curLoop[i]) != null; i++ ) {
            if ( item ) {
              found = filter( item, match, i, curLoop );
              var pass = not ^ !!found;

              if ( inplace && found != null ) {
                if ( pass ) {
                  anyFound = true;
                } else {
                  curLoop[i] = false;
                }
              } else if ( pass ) {
                result.push( item );
                anyFound = true;
              }
            }
          }
        }

        if ( found !== undefined ) {
          if ( !inplace ) {
            curLoop = result;
          }

          expr = expr.replace( Expr.match[ type ], "" );

          if ( !anyFound ) {
            return [];
          }

          break;
        }
      }
    }

    if ( expr == old ) {
      if ( anyFound == null ) {
        throw "Syntax error, unrecognized expression: " + expr;
      } else {
        break;
      }
    }

    old = expr;
  }

  return curLoop;
};

var Expr = Sizzle.selectors = {
  order: [ "ID", "NAME", "TAG" ],
  match: {
    ID: /#((?:[\w\u00c0-\uFFFF-]|\\.)+)/,
    CLASS: /\.((?:[\w\u00c0-\uFFFF-]|\\.)+)/,
    NAME: /\[name=['"]*((?:[\w\u00c0-\uFFFF-]|\\.)+)['"]*\]/,
    ATTR: /\[\s*((?:[\w\u00c0-\uFFFF-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,
    TAG: /^((?:[\w\u00c0-\uFFFF\*-]|\\.)+)/,
    CHILD: /:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,
    POS: /:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,
    PSEUDO: /:((?:[\w\u00c0-\uFFFF-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/
  },
  leftMatch: {},
  attrMap: {
    "class": "className",
    "for": "htmlFor"
  },
  attrHandle: {
    href: function(elem){
      return elem.getAttribute("href");
    }
  },
  relative: {
    "+": function(checkSet, part, isXML){
      var isPartStr = typeof part === "string",
        isTag = isPartStr && !/\W/.test(part),
        isPartStrNotTag = isPartStr && !isTag;

      if ( isTag && !isXML ) {
        part = part.toUpperCase();
      }

      for ( var i = 0, l = checkSet.length, elem; i < l; i++ ) {
        if ( (elem = checkSet[i]) ) {
          while ( (elem = elem.previousSibling) && elem.nodeType !== 1 ) {}

          checkSet[i] = isPartStrNotTag || elem && elem.nodeName === part ?
            elem || false :
            elem === part;
        }
      }

      if ( isPartStrNotTag ) {
        Sizzle.filter( part, checkSet, true );
      }
    },
    ">": function(checkSet, part, isXML){
      var isPartStr = typeof part === "string";

      if ( isPartStr && !/\W/.test(part) ) {
        part = isXML ? part : part.toUpperCase();

        for ( var i = 0, l = checkSet.length; i < l; i++ ) {
          var elem = checkSet[i];
          if ( elem ) {
            var parent = elem.parentNode;
            checkSet[i] = parent.nodeName === part ? parent : false;
          }
        }
      } else {
        for ( var i = 0, l = checkSet.length; i < l; i++ ) {
          var elem = checkSet[i];
          if ( elem ) {
            checkSet[i] = isPartStr ?
              elem.parentNode :
              elem.parentNode === part;
          }
        }

        if ( isPartStr ) {
          Sizzle.filter( part, checkSet, true );
        }
      }
    },
    "": function(checkSet, part, isXML){
      var doneName = done++, checkFn = dirCheck;

      if ( !/\W/.test(part) ) {
        var nodeCheck = part = isXML ? part : part.toUpperCase();
        checkFn = dirNodeCheck;
      }

      checkFn("parentNode", part, doneName, checkSet, nodeCheck, isXML);
    },
    "~": function(checkSet, part, isXML){
      var doneName = done++, checkFn = dirCheck;

      if ( typeof part === "string" && !/\W/.test(part) ) {
        var nodeCheck = part = isXML ? part : part.toUpperCase();
        checkFn = dirNodeCheck;
      }

      checkFn("previousSibling", part, doneName, checkSet, nodeCheck, isXML);
    }
  },
  find: {
    ID: function(match, context, isXML){
      if ( typeof context.getElementById !== "undefined" && !isXML ) {
        var m = context.getElementById(match[1]);
        return m ? [m] : [];
      }
    },
    NAME: function(match, context, isXML){
      if ( typeof context.getElementsByName !== "undefined" ) {
        var ret = [], results = context.getElementsByName(match[1]);

        for ( var i = 0, l = results.length; i < l; i++ ) {
          if ( results[i].getAttribute("name") === match[1] ) {
            ret.push( results[i] );
          }
        }

        return ret.length === 0 ? null : ret;
      }
    },
    TAG: function(match, context){
      return context.getElementsByTagName(match[1]);
    }
  },
  preFilter: {
    CLASS: function(match, curLoop, inplace, result, not, isXML){
      match = " " + match[1].replace(/\\/g, "") + " ";

      if ( isXML ) {
        return match;
      }

      for ( var i = 0, elem; (elem = curLoop[i]) != null; i++ ) {
        if ( elem ) {
          if ( not ^ (elem.className && (" " + elem.className + " ").indexOf(match) >= 0) ) {
            if ( !inplace )
              result.push( elem );
          } else if ( inplace ) {
            curLoop[i] = false;
          }
        }
      }

      return false;
    },
    ID: function(match){
      return match[1].replace(/\\/g, "");
    },
    TAG: function(match, curLoop){
      for ( var i = 0; curLoop[i] === false; i++ ){}
      return curLoop[i] && isXML(curLoop[i]) ? match[1] : match[1].toUpperCase();
    },
    CHILD: function(match){
      if ( match[1] == "nth" ) {
        var test = /(-?)(\d*)n((?:\+|-)?\d*)/.exec(
          match[2] == "even" && "2n" || match[2] == "odd" && "2n+1" ||
          !/\D/.test( match[2] ) && "0n+" + match[2] || match[2]);

        match[2] = (test[1] + (test[2] || 1)) - 0;
        match[3] = test[3] - 0;
      }

      match[0] = done++;

      return match;
    },
    ATTR: function(match, curLoop, inplace, result, not, isXML){
      var name = match[1].replace(/\\/g, "");

      if ( !isXML && Expr.attrMap[name] ) {
        match[1] = Expr.attrMap[name];
      }

      if ( match[2] === "~=" ) {
        match[4] = " " + match[4] + " ";
      }

      return match;
    },
    PSEUDO: function(match, curLoop, inplace, result, not){
      if ( match[1] === "not" ) {
        if ( ( chunker.exec(match[3]) || "" ).length > 1 || /^\w/.test(match[3]) ) {
          match[3] = Sizzle(match[3], null, null, curLoop);
        } else {
          var ret = Sizzle.filter(match[3], curLoop, inplace, true ^ not);
          if ( !inplace ) {
            result.push.apply( result, ret );
          }
          return false;
        }
      } else if ( Expr.match.POS.test( match[0] ) || Expr.match.CHILD.test( match[0] ) ) {
        return true;
      }

      return match;
    },
    POS: function(match){
      match.unshift( true );
      return match;
    }
  },
  filters: {
    enabled: function(elem){
      return elem.disabled === false && elem.type !== "hidden";
    },
    disabled: function(elem){
      return elem.disabled === true;
    },
    checked: function(elem){
      return elem.checked === true;
    },
    selected: function(elem){
      elem.parentNode.selectedIndex;
      return elem.selected === true;
    },
    parent: function(elem){
      return !!elem.firstChild;
    },
    empty: function(elem){
      return !elem.firstChild;
    },
    has: function(elem, i, match){
      return !!Sizzle( match[3], elem ).length;
    },
    header: function(elem){
      return /h\d/i.test( elem.nodeName );
    },
    text: function(elem){
      return "text" === elem.type;
    },
    radio: function(elem){
      return "radio" === elem.type;
    },
    checkbox: function(elem){
      return "checkbox" === elem.type;
    },
    file: function(elem){
      return "file" === elem.type;
    },
    password: function(elem){
      return "password" === elem.type;
    },
    submit: function(elem){
      return "submit" === elem.type;
    },
    image: function(elem){
      return "image" === elem.type;
    },
    reset: function(elem){
      return "reset" === elem.type;
    },
    button: function(elem){
      return "button" === elem.type || elem.nodeName.toUpperCase() === "BUTTON";
    },
    input: function(elem){
      return /input|select|textarea|button/i.test(elem.nodeName);
    }
  },
  setFilters: {
    first: function(elem, i){
      return i === 0;
    },
    last: function(elem, i, match, array){
      return i === array.length - 1;
    },
    even: function(elem, i){
      return i % 2 === 0;
    },
    odd: function(elem, i){
      return i % 2 === 1;
    },
    lt: function(elem, i, match){
      return i < match[3] - 0;
    },
    gt: function(elem, i, match){
      return i > match[3] - 0;
    },
    nth: function(elem, i, match){
      return match[3] - 0 == i;
    },
    eq: function(elem, i, match){
      return match[3] - 0 == i;
    }
  },
  filter: {
    PSEUDO: function(elem, match, i, array){
      var name = match[1], filter = Expr.filters[ name ];

      if ( filter ) {
        return filter( elem, i, match, array );
      } else if ( name === "contains" ) {
        return (elem.textContent || elem.innerText || "").indexOf(match[3]) >= 0;
      } else if ( name === "not" ) {
        var not = match[3];

        for ( var i = 0, l = not.length; i < l; i++ ) {
          if ( not[i] === elem ) {
            return false;
          }
        }

        return true;
      }
    },
    CHILD: function(elem, match){
      var type = match[1], node = elem;
      switch (type) {
        case 'only':
        case 'first':
          while ( (node = node.previousSibling) )  {
            if ( node.nodeType === 1 ) return false;
          }
          if ( type == 'first') return true;
          node = elem;
        case 'last':
          while ( (node = node.nextSibling) )  {
            if ( node.nodeType === 1 ) return false;
          }
          return true;
        case 'nth':
          var first = match[2], last = match[3];

          if ( first == 1 && last == 0 ) {
            return true;
          }

          var doneName = match[0],
            parent = elem.parentNode;

          if ( parent && (parent.sizcache !== doneName || !elem.nodeIndex) ) {
            var count = 0;
            for ( node = parent.firstChild; node; node = node.nextSibling ) {
              if ( node.nodeType === 1 ) {
                node.nodeIndex = ++count;
              }
            }
            parent.sizcache = doneName;
          }

          var diff = elem.nodeIndex - last;
          if ( first == 0 ) {
            return diff == 0;
          } else {
            return ( diff % first == 0 && diff / first >= 0 );
          }
      }
    },
    ID: function(elem, match){
      return elem.nodeType === 1 && elem.getAttribute("id") === match;
    },
    TAG: function(elem, match){
      return (match === "*" && elem.nodeType === 1) || elem.nodeName === match;
    },
    CLASS: function(elem, match){
      return (" " + (elem.className || elem.getAttribute("class")) + " ")
        .indexOf( match ) > -1;
    },
    ATTR: function(elem, match){
      var name = match[1],
        result = Expr.attrHandle[ name ] ?
          Expr.attrHandle[ name ]( elem ) :
          elem[ name ] != null ?
            elem[ name ] :
            elem.getAttribute( name ),
        value = result + "",
        type = match[2],
        check = match[4];

      return result == null ?
        type === "!=" :
        type === "=" ?
        value === check :
        type === "*=" ?
        value.indexOf(check) >= 0 :
        type === "~=" ?
        (" " + value + " ").indexOf(check) >= 0 :
        !check ?
        value && result !== false :
        type === "!=" ?
        value != check :
        type === "^=" ?
        value.indexOf(check) === 0 :
        type === "$=" ?
        value.substr(value.length - check.length) === check :
        type === "|=" ?
        value === check || value.substr(0, check.length + 1) === check + "-" :
        false;
    },
    POS: function(elem, match, i, array){
      var name = match[2], filter = Expr.setFilters[ name ];

      if ( filter ) {
        return filter( elem, i, match, array );
      }
    }
  }
};

var origPOS = Expr.match.POS;

for ( var type in Expr.match ) {
  Expr.match[ type ] = new RegExp( Expr.match[ type ].source + /(?![^\[]*\])(?![^\(]*\))/.source );
  Expr.leftMatch[ type ] = new RegExp( /(^(?:.|\r|\n)*?)/.source + Expr.match[ type ].source );
}

var makeArray = function(array, results) {
  array = Array.prototype.slice.call( array, 0 );

  if ( results ) {
    results.push.apply( results, array );
    return results;
  }

  return array;
};

try {
  Array.prototype.slice.call( document.documentElement.childNodes, 0 );

} catch(e){
  makeArray = function(array, results) {
    var ret = results || [];

    if ( toString.call(array) === "[object Array]" ) {
      Array.prototype.push.apply( ret, array );
    } else {
      if ( typeof array.length === "number" ) {
        for ( var i = 0, l = array.length; i < l; i++ ) {
          ret.push( array[i] );
        }
      } else {
        for ( var i = 0; array[i]; i++ ) {
          ret.push( array[i] );
        }
      }
    }

    return ret;
  };
}

var sortOrder;

if ( document.documentElement.compareDocumentPosition ) {
  sortOrder = function( a, b ) {
    if ( !a.compareDocumentPosition || !b.compareDocumentPosition ) {
      if ( a == b ) {
        hasDuplicate = true;
      }
      return 0;
    }

    var ret = a.compareDocumentPosition(b) & 4 ? -1 : a === b ? 0 : 1;
    if ( ret === 0 ) {
      hasDuplicate = true;
    }
    return ret;
  };
} else if ( "sourceIndex" in document.documentElement ) {
  sortOrder = function( a, b ) {
    if ( !a.sourceIndex || !b.sourceIndex ) {
      if ( a == b ) {
        hasDuplicate = true;
      }
      return 0;
    }

    var ret = a.sourceIndex - b.sourceIndex;
    if ( ret === 0 ) {
      hasDuplicate = true;
    }
    return ret;
  };
} else if ( document.createRange ) {
  sortOrder = function( a, b ) {
    if ( !a.ownerDocument || !b.ownerDocument ) {
      if ( a == b ) {
        hasDuplicate = true;
      }
      return 0;
    }

    var aRange = a.ownerDocument.createRange(), bRange = b.ownerDocument.createRange();
    aRange.setStart(a, 0);
    aRange.setEnd(a, 0);
    bRange.setStart(b, 0);
    bRange.setEnd(b, 0);
    var ret = aRange.compareBoundaryPoints(Range.START_TO_END, bRange);
    if ( ret === 0 ) {
      hasDuplicate = true;
    }
    return ret;
  };
}

(function(){
  var form = document.createElement("div"),
    id = "script" + (new Date).getTime();
  form.innerHTML = "<a name='" + id + "'/>";

  var root = document.documentElement;
  root.insertBefore( form, root.firstChild );

  if ( !!document.getElementById( id ) ) {
    Expr.find.ID = function(match, context, isXML){
      if ( typeof context.getElementById !== "undefined" && !isXML ) {
        var m = context.getElementById(match[1]);
        return m ? m.id === match[1] || typeof m.getAttributeNode !== "undefined" && m.getAttributeNode("id").nodeValue === match[1] ? [m] : undefined : [];
      }
    };

    Expr.filter.ID = function(elem, match){
      var node = typeof elem.getAttributeNode !== "undefined" && elem.getAttributeNode("id");
      return elem.nodeType === 1 && node && node.nodeValue === match;
    };
  }

  root.removeChild( form );
  root = form = null; // release memory in IE
})();

(function(){

  var div = document.createElement("div");
  div.appendChild( document.createComment("") );

  if ( div.getElementsByTagName("*").length > 0 ) {
    Expr.find.TAG = function(match, context){
      var results = context.getElementsByTagName(match[1]);

      if ( match[1] === "*" ) {
        var tmp = [];

        for ( var i = 0; results[i]; i++ ) {
          if ( results[i].nodeType === 1 ) {
            tmp.push( results[i] );
          }
        }

        results = tmp;
      }

      return results;
    };
  }

  div.innerHTML = "<a href='#'></a>";
  if ( div.firstChild && typeof div.firstChild.getAttribute !== "undefined" &&
      div.firstChild.getAttribute("href") !== "#" ) {
    Expr.attrHandle.href = function(elem){
      return elem.getAttribute("href", 2);
    };
  }

  div = null; // release memory in IE
})();

if ( document.querySelectorAll ) (function(){
  var oldSizzle = Sizzle, div = document.createElement("div");
  div.innerHTML = "<p class='TEST'></p>";

  if ( div.querySelectorAll && div.querySelectorAll(".TEST").length === 0 ) {
    return;
  }

  Sizzle = function(query, context, extra, seed){
    context = context || document;

    if ( !seed && context.nodeType === 9 && !isXML(context) ) {
      try {
        return makeArray( context.querySelectorAll(query), extra );
      } catch(e){}
    }

    return oldSizzle(query, context, extra, seed);
  };

  for ( var prop in oldSizzle ) {
    Sizzle[ prop ] = oldSizzle[ prop ];
  }

  div = null; // release memory in IE
})();

if ( document.getElementsByClassName && document.documentElement.getElementsByClassName ) (function(){
  var div = document.createElement("div");
  div.innerHTML = "<div class='test e'></div><div class='test'></div>";

  if ( div.getElementsByClassName("e").length === 0 )
    return;

  div.lastChild.className = "e";

  if ( div.getElementsByClassName("e").length === 1 )
    return;

  Expr.order.splice(1, 0, "CLASS");
  Expr.find.CLASS = function(match, context, isXML) {
    if ( typeof context.getElementsByClassName !== "undefined" && !isXML ) {
      return context.getElementsByClassName(match[1]);
    }
  };

  div = null; // release memory in IE
})();

function dirNodeCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
  var sibDir = dir == "previousSibling" && !isXML;
  for ( var i = 0, l = checkSet.length; i < l; i++ ) {
    var elem = checkSet[i];
    if ( elem ) {
      if ( sibDir && elem.nodeType === 1 ){
        elem.sizcache = doneName;
        elem.sizset = i;
      }
      elem = elem[dir];
      var match = false;

      while ( elem ) {
        if ( elem.sizcache === doneName ) {
          match = checkSet[elem.sizset];
          break;
        }

        if ( elem.nodeType === 1 && !isXML ){
          elem.sizcache = doneName;
          elem.sizset = i;
        }

        if ( elem.nodeName === cur ) {
          match = elem;
          break;
        }

        elem = elem[dir];
      }

      checkSet[i] = match;
    }
  }
}

function dirCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
  var sibDir = dir == "previousSibling" && !isXML;
  for ( var i = 0, l = checkSet.length; i < l; i++ ) {
    var elem = checkSet[i];
    if ( elem ) {
      if ( sibDir && elem.nodeType === 1 ) {
        elem.sizcache = doneName;
        elem.sizset = i;
      }
      elem = elem[dir];
      var match = false;

      while ( elem ) {
        if ( elem.sizcache === doneName ) {
          match = checkSet[elem.sizset];
          break;
        }

        if ( elem.nodeType === 1 ) {
          if ( !isXML ) {
            elem.sizcache = doneName;
            elem.sizset = i;
          }
          if ( typeof cur !== "string" ) {
            if ( elem === cur ) {
              match = true;
              break;
            }

          } else if ( Sizzle.filter( cur, [elem] ).length > 0 ) {
            match = elem;
            break;
          }
        }

        elem = elem[dir];
      }

      checkSet[i] = match;
    }
  }
}

var contains = document.compareDocumentPosition ?  function(a, b){
  return a.compareDocumentPosition(b) & 16;
} : function(a, b){
  return a !== b && (a.contains ? a.contains(b) : true);
};

var isXML = function(elem){
  return elem.nodeType === 9 && elem.documentElement.nodeName !== "HTML" ||
    !!elem.ownerDocument && elem.ownerDocument.documentElement.nodeName !== "HTML";
};

var posProcess = function(selector, context){
  var tmpSet = [], later = "", match,
    root = context.nodeType ? [context] : context;

  while ( (match = Expr.match.PSEUDO.exec( selector )) ) {
    later += match[0];
    selector = selector.replace( Expr.match.PSEUDO, "" );
  }

  selector = Expr.relative[selector] ? selector + "*" : selector;

  for ( var i = 0, l = root.length; i < l; i++ ) {
    Sizzle( selector, root[i], tmpSet );
  }

  return Sizzle.filter( later, tmpSet );
};


window.Sizzle = Sizzle;

})();

;(function(engine) {
  var extendElements = Prototype.Selector.extendElements;

  function select(selector, scope) {
    return extendElements(engine(selector, scope || document));
  }

  function match(element, selector) {
    return engine.matches(selector, [element]).length == 1;
  }

  Prototype.Selector.engine = engine;
  Prototype.Selector.select = select;
  Prototype.Selector.match = match;
})(Sizzle);

window.Sizzle = Prototype._original_property;
delete Prototype._original_property;

var Form = {
  reset: function(form) {
    form = $(form);
    form.reset();
    return form;
  },

  serializeElements: function(elements, options) {
    if (typeof options != 'object') options = { hash: !!options };
    else if (Object.isUndefined(options.hash)) options.hash = true;
    var key, value, submitted = false, submit = options.submit, accumulator, initial;

    if (options.hash) {
      initial = {};
      accumulator = function(result, key, value) {
        if (key in result) {
          if (!Object.isArray(result[key])) result[key] = [result[key]];
          result[key].push(value);
        } else result[key] = value;
        return result;
      };
    } else {
      initial = '';
      accumulator = function(result, key, value) {
        return result + (result ? '&' : '') + encodeURIComponent(key) + '=' + encodeURIComponent(value);
      }
    }

    return elements.inject(initial, function(result, element) {
      if (!element.disabled && element.name) {
        key = element.name; value = $(element).getValue();
        if (value != null && element.type != 'file' && (element.type != 'submit' || (!submitted &&
            submit !== false && (!submit || key == submit) && (submitted = true)))) {
          result = accumulator(result, key, value);
        }
      }
      return result;
    });
  }
};

Form.Methods = {
  serialize: function(form, options) {
    return Form.serializeElements(Form.getElements(form), options);
  },

  getElements: function(form) {
    var elements = $(form).getElementsByTagName('*'),
        element,
        arr = [ ],
        serializers = Form.Element.Serializers;
    for (var i = 0; element = elements[i]; i++) {
      arr.push(element);
    }
    return arr.inject([], function(elements, child) {
      if (serializers[child.tagName.toLowerCase()])
        elements.push(Element.extend(child));
      return elements;
    })
  },

  getInputs: function(form, typeName, name) {
    form = $(form);
    var inputs = form.getElementsByTagName('input');

    if (!typeName && !name) return $A(inputs).map(Element.extend);

    for (var i = 0, matchingInputs = [], length = inputs.length; i < length; i++) {
      var input = inputs[i];
      if ((typeName && input.type != typeName) || (name && input.name != name))
        continue;
      matchingInputs.push(Element.extend(input));
    }

    return matchingInputs;
  },

  disable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('disable');
    return form;
  },

  enable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('enable');
    return form;
  },

  findFirstElement: function(form) {
    var elements = $(form).getElements().findAll(function(element) {
      return 'hidden' != element.type && !element.disabled;
    });
    var firstByIndex = elements.findAll(function(element) {
      return element.hasAttribute('tabIndex') && element.tabIndex >= 0;
    }).sortBy(function(element) { return element.tabIndex }).first();

    return firstByIndex ? firstByIndex : elements.find(function(element) {
      return /^(?:input|select|textarea)$/i.test(element.tagName);
    });
  },

  focusFirstElement: function(form) {
    form = $(form);
    var element = form.findFirstElement();
    if (element) element.activate();
    return form;
  },

  request: function(form, options) {
    form = $(form), options = Object.clone(options || { });

    var params = options.parameters, action = form.readAttribute('action') || '';
    if (action.blank()) action = window.location.href;
    options.parameters = form.serialize(true);

    if (params) {
      if (Object.isString(params)) params = params.toQueryParams();
      Object.extend(options.parameters, params);
    }

    if (form.hasAttribute('method') && !options.method)
      options.method = form.method;

    return new Ajax.Request(action, options);
  }
};

/*--------------------------------------------------------------------------*/


Form.Element = {
  focus: function(element) {
    $(element).focus();
    return element;
  },

  select: function(element) {
    $(element).select();
    return element;
  }
};

Form.Element.Methods = {

  serialize: function(element) {
    element = $(element);
    if (!element.disabled && element.name) {
      var value = element.getValue();
      if (value != undefined) {
        var pair = { };
        pair[element.name] = value;
        return Object.toQueryString(pair);
      }
    }
    return '';
  },

  getValue: function(element) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    return Form.Element.Serializers[method](element);
  },

  setValue: function(element, value) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    Form.Element.Serializers[method](element, value);
    return element;
  },

  clear: function(element) {
    $(element).value = '';
    return element;
  },

  present: function(element) {
    return $(element).value != '';
  },

  activate: function(element) {
    element = $(element);
    try {
      element.focus();
      if (element.select && (element.tagName.toLowerCase() != 'input' ||
          !(/^(?:button|reset|submit)$/i.test(element.type))))
        element.select();
    } catch (e) { }
    return element;
  },

  disable: function(element) {
    element = $(element);
    element.disabled = true;
    return element;
  },

  enable: function(element) {
    element = $(element);
    element.disabled = false;
    return element;
  }
};

/*--------------------------------------------------------------------------*/

var Field = Form.Element;

var $F = Form.Element.Methods.getValue;

/*--------------------------------------------------------------------------*/

Form.Element.Serializers = (function() {
  function input(element, value) {
    switch (element.type.toLowerCase()) {
      case 'checkbox':
      case 'radio':
        return inputSelector(element, value);
      default:
        return valueSelector(element, value);
    }
  }

  function inputSelector(element, value) {
    if (Object.isUndefined(value))
      return element.checked ? element.value : null;
    else element.checked = !!value;
  }

  function valueSelector(element, value) {
    if (Object.isUndefined(value)) return element.value;
    else element.value = value;
  }

  function select(element, value) {
    if (Object.isUndefined(value))
      return (element.type === 'select-one' ? selectOne : selectMany)(element);

    var opt, currentValue, single = !Object.isArray(value);
    for (var i = 0, length = element.length; i < length; i++) {
      opt = element.options[i];
      currentValue = this.optionValue(opt);
      if (single) {
        if (currentValue == value) {
          opt.selected = true;
          return;
        }
      }
      else opt.selected = value.include(currentValue);
    }
  }

  function selectOne(element) {
    var index = element.selectedIndex;
    return index >= 0 ? optionValue(element.options[index]) : null;
  }

  function selectMany(element) {
    var values, length = element.length;
    if (!length) return null;

    for (var i = 0, values = []; i < length; i++) {
      var opt = element.options[i];
      if (opt.selected) values.push(optionValue(opt));
    }
    return values;
  }

  function optionValue(opt) {
    return Element.hasAttribute(opt, 'value') ? opt.value : opt.text;
  }

  return {
    input:         input,
    inputSelector: inputSelector,
    textarea:      valueSelector,
    select:        select,
    selectOne:     selectOne,
    selectMany:    selectMany,
    optionValue:   optionValue,
    button:        valueSelector
  };
})();

/*--------------------------------------------------------------------------*/


Abstract.TimedObserver = Class.create(PeriodicalExecuter, {
  initialize: function($super, element, frequency, callback) {
    $super(callback, frequency);
    this.element   = $(element);
    this.lastValue = this.getValue();
  },

  execute: function() {
    var value = this.getValue();
    if (Object.isString(this.lastValue) && Object.isString(value) ?
        this.lastValue != value : String(this.lastValue) != String(value)) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  }
});

Form.Element.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});

/*--------------------------------------------------------------------------*/

Abstract.EventObserver = Class.create({
  initialize: function(element, callback) {
    this.element  = $(element);
    this.callback = callback;

    this.lastValue = this.getValue();
    if (this.element.tagName.toLowerCase() == 'form')
      this.registerFormCallbacks();
    else
      this.registerCallback(this.element);
  },

  onElementEvent: function() {
    var value = this.getValue();
    if (this.lastValue != value) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  },

  registerFormCallbacks: function() {
    Form.getElements(this.element).each(this.registerCallback, this);
  },

  registerCallback: function(element) {
    if (element.type) {
      switch (element.type.toLowerCase()) {
        case 'checkbox':
        case 'radio':
          Event.observe(element, 'click', this.onElementEvent.bind(this));
          break;
        default:
          Event.observe(element, 'change', this.onElementEvent.bind(this));
          break;
      }
    }
  }
});

Form.Element.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});
(function() {

  var Event = {
    KEY_BACKSPACE: 8,
    KEY_TAB:       9,
    KEY_RETURN:   13,
    KEY_ESC:      27,
    KEY_LEFT:     37,
    KEY_UP:       38,
    KEY_RIGHT:    39,
    KEY_DOWN:     40,
    KEY_DELETE:   46,
    KEY_HOME:     36,
    KEY_END:      35,
    KEY_PAGEUP:   33,
    KEY_PAGEDOWN: 34,
    KEY_INSERT:   45,

    cache: {}
  };

  var docEl = document.documentElement;
  var MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED = 'onmouseenter' in docEl
    && 'onmouseleave' in docEl;



  var isIELegacyEvent = function(event) { return false; };

  if (window.attachEvent) {
    if (window.addEventListener) {
      isIELegacyEvent = function(event) {
        return !(event instanceof window.Event);
      };
    } else {
      isIELegacyEvent = function(event) { return true; };
    }
  }

  var _isButton;

  function _isButtonForDOMEvents(event, code) {
    return event.which ? (event.which === code + 1) : (event.button === code);
  }

  var legacyButtonMap = { 0: 1, 1: 4, 2: 2 };
  function _isButtonForLegacyEvents(event, code) {
    return event.button === legacyButtonMap[code];
  }

  function _isButtonForWebKit(event, code) {
    switch (code) {
      case 0: return event.which == 1 && !event.metaKey;
      case 1: return event.which == 2 || (event.which == 1 && event.metaKey);
      case 2: return event.which == 3;
      default: return false;
    }
  }

  if (window.attachEvent) {
    if (!window.addEventListener) {
      _isButton = _isButtonForLegacyEvents;
    } else {
      _isButton = function(event, code) {
        return isIELegacyEvent(event) ? _isButtonForLegacyEvents(event, code) :
         _isButtonForDOMEvents(event, code);
      }
    }
  } else if (Prototype.Browser.WebKit) {
    _isButton = _isButtonForWebKit;
  } else {
    _isButton = _isButtonForDOMEvents;
  }

  function isLeftClick(event)   { return _isButton(event, 0) }

  function isMiddleClick(event) { return _isButton(event, 1) }

  function isRightClick(event)  { return _isButton(event, 2) }

  function element(event) {
    event = Event.extend(event);

    var node = event.target, type = event.type,
     currentTarget = event.currentTarget;

    if (currentTarget && currentTarget.tagName) {
      if (type === 'load' || type === 'error' ||
        (type === 'click' && currentTarget.tagName.toLowerCase() === 'input'
          && currentTarget.type === 'radio'))
            node = currentTarget;
    }

    if (node.nodeType == Node.TEXT_NODE)
      node = node.parentNode;

    return Element.extend(node);
  }

  function findElement(event, expression) {
    var element = Event.element(event);

    if (!expression) return element;
    while (element) {
      if (Object.isElement(element) && Prototype.Selector.match(element, expression)) {
        return Element.extend(element);
      }
      element = element.parentNode;
    }
  }

  function pointer(event) {
    return { x: pointerX(event), y: pointerY(event) };
  }

  function pointerX(event) {
    var docElement = document.documentElement,
     body = document.body || { scrollLeft: 0 };

    return event.pageX || (event.clientX +
      (docElement.scrollLeft || body.scrollLeft) -
      (docElement.clientLeft || 0));
  }

  function pointerY(event) {
    var docElement = document.documentElement,
     body = document.body || { scrollTop: 0 };

    return  event.pageY || (event.clientY +
       (docElement.scrollTop || body.scrollTop) -
       (docElement.clientTop || 0));
  }


  function stop(event) {
    Event.extend(event);
    event.preventDefault();
    event.stopPropagation();

    event.stopped = true;
  }


  Event.Methods = {
    isLeftClick:   isLeftClick,
    isMiddleClick: isMiddleClick,
    isRightClick:  isRightClick,

    element:     element,
    findElement: findElement,

    pointer:  pointer,
    pointerX: pointerX,
    pointerY: pointerY,

    stop: stop
  };

  var methods = Object.keys(Event.Methods).inject({ }, function(m, name) {
    m[name] = Event.Methods[name].methodize();
    return m;
  });

  if (window.attachEvent) {
    function _relatedTarget(event) {
      var element;
      switch (event.type) {
        case 'mouseover':
        case 'mouseenter':
          element = event.fromElement;
          break;
        case 'mouseout':
        case 'mouseleave':
          element = event.toElement;
          break;
        default:
          return null;
      }
      return Element.extend(element);
    }

    var additionalMethods = {
      stopPropagation: function() { this.cancelBubble = true },
      preventDefault:  function() { this.returnValue = false },
      inspect: function() { return '[object Event]' }
    };

    Event.extend = function(event, element) {
      if (!event) return false;

      if (!isIELegacyEvent(event)) return event;

      if (event._extendedByPrototype) return event;
      event._extendedByPrototype = Prototype.emptyFunction;

      var pointer = Event.pointer(event);

      Object.extend(event, {
        target: event.srcElement || element,
        relatedTarget: _relatedTarget(event),
        pageX:  pointer.x,
        pageY:  pointer.y
      });

      Object.extend(event, methods);
      Object.extend(event, additionalMethods);

      return event;
    };
  } else {
    Event.extend = Prototype.K;
  }

  if (window.addEventListener) {
    Event.prototype = window.Event.prototype || document.createEvent('HTMLEvents').__proto__;
    Object.extend(Event.prototype, methods);
  }

  function _createResponder(element, eventName, handler) {
    var registry = Element.retrieve(element, 'prototype_event_registry');

    if (Object.isUndefined(registry)) {
      CACHE.push(element);
      registry = Element.retrieve(element, 'prototype_event_registry', $H());
    }

    var respondersForEvent = registry.get(eventName);
    if (Object.isUndefined(respondersForEvent)) {
      respondersForEvent = [];
      registry.set(eventName, respondersForEvent);
    }

    if (respondersForEvent.pluck('handler').include(handler)) return false;

    var responder;
    if (eventName.include(":")) {
      responder = function(event) {
        if (Object.isUndefined(event.eventName))
          return false;

        if (event.eventName !== eventName)
          return false;

        Event.extend(event, element);
        handler.call(element, event);
      };
    } else {
      if (!MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED &&
       (eventName === "mouseenter" || eventName === "mouseleave")) {
        if (eventName === "mouseenter" || eventName === "mouseleave") {
          responder = function(event) {
            Event.extend(event, element);

            var parent = event.relatedTarget;
            while (parent && parent !== element) {
              try { parent = parent.parentNode; }
              catch(e) { parent = element; }
            }

            if (parent === element) return;

            handler.call(element, event);
          };
        }
      } else {
        responder = function(event) {
          Event.extend(event, element);
          handler.call(element, event);
        };
      }
    }

    responder.handler = handler;
    respondersForEvent.push(responder);
    return responder;
  }

  function _destroyCache() {
    for (var i = 0, length = CACHE.length; i < length; i++) {
      Event.stopObserving(CACHE[i]);
      CACHE[i] = null;
    }
  }

  var CACHE = [];

  if (Prototype.Browser.IE)
    window.attachEvent('onunload', _destroyCache);

  if (Prototype.Browser.WebKit)
    window.addEventListener('unload', Prototype.emptyFunction, false);


  var _getDOMEventName = Prototype.K,
      translations = { mouseenter: "mouseover", mouseleave: "mouseout" };

  if (!MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED) {
    _getDOMEventName = function(eventName) {
      return (translations[eventName] || eventName);
    };
  }

  function observe(element, eventName, handler) {
    element = $(element);

    var responder = _createResponder(element, eventName, handler);

    if (!responder) return element;

    if (eventName.include(':')) {
      if (element.addEventListener)
        element.addEventListener("dataavailable", responder, false);
      else {
        element.attachEvent("ondataavailable", responder);
        element.attachEvent("onlosecapture", responder);
      }
    } else {
      var actualEventName = _getDOMEventName(eventName);

      if (element.addEventListener)
        element.addEventListener(actualEventName, responder, false);
      else
        element.attachEvent("on" + actualEventName, responder);
    }

    return element;
  }

  function stopObserving(element, eventName, handler) {
    element = $(element);

    var registry = Element.retrieve(element, 'prototype_event_registry');
    if (!registry) return element;

    if (!eventName) {
      registry.each( function(pair) {
        var eventName = pair.key;
        stopObserving(element, eventName);
      });
      return element;
    }

    var responders = registry.get(eventName);
    if (!responders) return element;

    if (!handler) {
      responders.each(function(r) {
        stopObserving(element, eventName, r.handler);
      });
      return element;
    }

    var i = responders.length, responder;
    while (i--) {
      if (responders[i].handler === handler) {
        responder = responders[i];
        break;
      }
    }
    if (!responder) return element;

    if (eventName.include(':')) {
      if (element.removeEventListener)
        element.removeEventListener("dataavailable", responder, false);
      else {
        element.detachEvent("ondataavailable", responder);
        element.detachEvent("onlosecapture", responder);
      }
    } else {
      var actualEventName = _getDOMEventName(eventName);
      if (element.removeEventListener)
        element.removeEventListener(actualEventName, responder, false);
      else
        element.detachEvent('on' + actualEventName, responder);
    }

    registry.set(eventName, responders.without(responder));

    return element;
  }

  function fire(element, eventName, memo, bubble) {
    element = $(element);

    if (Object.isUndefined(bubble))
      bubble = true;

    if (element == document && document.createEvent && !element.dispatchEvent)
      element = document.documentElement;

    var event;
    if (document.createEvent) {
      event = document.createEvent('HTMLEvents');
      event.initEvent('dataavailable', bubble, true);
    } else {
      event = document.createEventObject();
      event.eventType = bubble ? 'ondataavailable' : 'onlosecapture';
    }

    event.eventName = eventName;
    event.memo = memo || { };

    if (document.createEvent)
      element.dispatchEvent(event);
    else
      element.fireEvent(event.eventType, event);

    return Event.extend(event);
  }

  Event.Handler = Class.create({
    initialize: function(element, eventName, selector, callback) {
      this.element   = $(element);
      this.eventName = eventName;
      this.selector  = selector;
      this.callback  = callback;
      this.handler   = this.handleEvent.bind(this);
    },

    start: function() {
      Event.observe(this.element, this.eventName, this.handler);
      return this;
    },

    stop: function() {
      Event.stopObserving(this.element, this.eventName, this.handler);
      return this;
    },

    handleEvent: function(event) {
      var element = Event.findElement(event, this.selector);
      if (element) this.callback.call(this.element, event, element);
    }
  });

  function on(element, eventName, selector, callback) {
    element = $(element);
    if (Object.isFunction(selector) && Object.isUndefined(callback)) {
      callback = selector, selector = null;
    }

    return new Event.Handler(element, eventName, selector, callback).start();
  }

  Object.extend(Event, Event.Methods);

  Object.extend(Event, {
    fire:          fire,
    observe:       observe,
    stopObserving: stopObserving,
    on:            on
  });

  Element.addMethods({
    fire:          fire,

    observe:       observe,

    stopObserving: stopObserving,

    on:            on
  });

  Object.extend(document, {
    fire:          fire.methodize(),

    observe:       observe.methodize(),

    stopObserving: stopObserving.methodize(),

    on:            on.methodize(),

    loaded:        false
  });

  if (window.Event) Object.extend(window.Event, Event);
  else window.Event = Event;
})();

(function() {
  /* Support for the DOMContentLoaded event is based on work by Dan Webb,
     Matthias Miller, Dean Edwards, John Resig, and Diego Perini. */

  var timer;

  function fireContentLoadedEvent() {
    if (document.loaded) return;
    if (timer) window.clearTimeout(timer);
    document.loaded = true;
    document.fire('dom:loaded');
  }

  function checkReadyState() {
    if (document.readyState === 'complete') {
      document.stopObserving('readystatechange', checkReadyState);
      fireContentLoadedEvent();
    }
  }

  function pollDoScroll() {
    try { document.documentElement.doScroll('left'); }
    catch(e) {
      timer = pollDoScroll.defer();
      return;
    }
    fireContentLoadedEvent();
  }

  if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', fireContentLoadedEvent, false);
  } else {
    document.observe('readystatechange', checkReadyState);
    if (window == top)
      timer = pollDoScroll.defer();
  }

  Event.observe(window, 'load', fireContentLoadedEvent);
})();

Element.addMethods();

/*------------------------------- DEPRECATED -------------------------------*/

Hash.toQueryString = Object.toQueryString;

var Toggle = { display: Element.toggle };

Element.Methods.childOf = Element.Methods.descendantOf;

var Insertion = {
  Before: function(element, content) {
    return Element.insert(element, {before:content});
  },

  Top: function(element, content) {
    return Element.insert(element, {top:content});
  },

  Bottom: function(element, content) {
    return Element.insert(element, {bottom:content});
  },

  After: function(element, content) {
    return Element.insert(element, {after:content});
  }
};

var $continue = new Error('"throw $continue" is deprecated, use "return" instead');

var Position = {
  includeScrollOffsets: false,

  prepare: function() {
    this.deltaX =  window.pageXOffset
                || document.documentElement.scrollLeft
                || document.body.scrollLeft
                || 0;
    this.deltaY =  window.pageYOffset
                || document.documentElement.scrollTop
                || document.body.scrollTop
                || 0;
  },

  within: function(element, x, y) {
    if (this.includeScrollOffsets)
      return this.withinIncludingScrolloffsets(element, x, y);
    this.xcomp = x;
    this.ycomp = y;
    this.offset = Element.cumulativeOffset(element);

    return (y >= this.offset[1] &&
            y <  this.offset[1] + element.offsetHeight &&
            x >= this.offset[0] &&
            x <  this.offset[0] + element.offsetWidth);
  },

  withinIncludingScrolloffsets: function(element, x, y) {
    var offsetcache = Element.cumulativeScrollOffset(element);

    this.xcomp = x + offsetcache[0] - this.deltaX;
    this.ycomp = y + offsetcache[1] - this.deltaY;
    this.offset = Element.cumulativeOffset(element);

    return (this.ycomp >= this.offset[1] &&
            this.ycomp <  this.offset[1] + element.offsetHeight &&
            this.xcomp >= this.offset[0] &&
            this.xcomp <  this.offset[0] + element.offsetWidth);
  },

  overlap: function(mode, element) {
    if (!mode) return 0;
    if (mode == 'vertical')
      return ((this.offset[1] + element.offsetHeight) - this.ycomp) /
        element.offsetHeight;
    if (mode == 'horizontal')
      return ((this.offset[0] + element.offsetWidth) - this.xcomp) /
        element.offsetWidth;
  },


  cumulativeOffset: Element.Methods.cumulativeOffset,

  positionedOffset: Element.Methods.positionedOffset,

  absolutize: function(element) {
    Position.prepare();
    return Element.absolutize(element);
  },

  relativize: function(element) {
    Position.prepare();
    return Element.relativize(element);
  },

  realOffset: Element.Methods.cumulativeScrollOffset,

  offsetParent: Element.Methods.getOffsetParent,

  page: Element.Methods.viewportOffset,

  clone: function(source, target, options) {
    options = options || { };
    return Element.clonePosition(target, source, options);
  }
};

/*--------------------------------------------------------------------------*/

if (!document.getElementsByClassName) document.getElementsByClassName = function(instanceMethods){
  function iter(name) {
    return name.blank() ? null : "[contains(concat(' ', @class, ' '), ' " + name + " ')]";
  }

  instanceMethods.getElementsByClassName = Prototype.BrowserFeatures.XPath ?
  function(element, className) {
    className = className.toString().strip();
    var cond = /\s/.test(className) ? $w(className).map(iter).join('') : iter(className);
    return cond ? document._getElementsByXPath('.//*' + cond, element) : [];
  } : function(element, className) {
    className = className.toString().strip();
    var elements = [], classNames = (/\s/.test(className) ? $w(className) : null);
    if (!classNames && !className) return elements;

    var nodes = $(element).getElementsByTagName('*');
    className = ' ' + className + ' ';

    for (var i = 0, child, cn; child = nodes[i]; i++) {
      if (child.className && (cn = ' ' + child.className + ' ') && (cn.include(className) ||
          (classNames && classNames.all(function(name) {
            return !name.toString().blank() && cn.include(' ' + name + ' ');
          }))))
        elements.push(Element.extend(child));
    }
    return elements;
  };

  return function(className, parentElement) {
    return $(parentElement || document.body).getElementsByClassName(className);
  };
}(Element.Methods);

/*--------------------------------------------------------------------------*/

Element.ClassNames = Class.create();
Element.ClassNames.prototype = {
  initialize: function(element) {
    this.element = $(element);
  },

  _each: function(iterator) {
    this.element.className.split(/\s+/).select(function(name) {
      return name.length > 0;
    })._each(iterator);
  },

  set: function(className) {
    this.element.className = className;
  },

  add: function(classNameToAdd) {
    if (this.include(classNameToAdd)) return;
    this.set($A(this).concat(classNameToAdd).join(' '));
  },

  remove: function(classNameToRemove) {
    if (!this.include(classNameToRemove)) return;
    this.set($A(this).without(classNameToRemove).join(' '));
  },

  toString: function() {
    return $A(this).join(' ');
  }
};

Object.extend(Element.ClassNames.prototype, Enumerable);

/*--------------------------------------------------------------------------*/

(function() {
  window.Selector = Class.create({
    initialize: function(expression) {
      this.expression = expression.strip();
    },

    findElements: function(rootElement) {
      return Prototype.Selector.select(this.expression, rootElement);
    },

    match: function(element) {
      return Prototype.Selector.match(element, this.expression);
    },

    toString: function() {
      return this.expression;
    },

    inspect: function() {
      return "#<Selector: " + this.expression + ">";
    }
  });

  Object.extend(Selector, {
    matchElements: function(elements, expression) {
      var match = Prototype.Selector.match,
          results = [];

      for (var i = 0, length = elements.length; i < length; i++) {
        var element = elements[i];
        if (match(element, expression)) {
          results.push(Element.extend(element));
        }
      }
      return results;
    },

    findElement: function(elements, expression, index) {
      index = index || 0;
      var matchIndex = 0, element;
      for (var i = 0, length = elements.length; i < length; i++) {
        element = elements[i];
        if (Prototype.Selector.match(element, expression) && index === matchIndex++) {
          return Element.extend(element);
        }
      }
    },

    findChildElements: function(element, expressions) {
      var selector = expressions.toArray().join(', ');
      return Prototype.Selector.select(selector, element || document);
    }
  });
})();
// Copyright (c) 2005-2009 Thomas Fuchs (http://script.aculo.us, http://mir.aculo.us)
// Contributors:
//  Justin Palmer (http://encytemedia.com/)
//  Mark Pilgrim (http://diveintomark.org/)
//  Martin Bialasinki
//
// script.aculo.us is freely distributable under the terms of an MIT-style license.
// For details, see the script.aculo.us web site: http://script.aculo.us/

// converts rgb() and #xxx to #xxxxxx format,
// returns self (or first argument) if not convertable
String.prototype.parseColor = function() {
  var color = '#';
  if (this.slice(0,4) == 'rgb(') {
    var cols = this.slice(4,this.length-1).split(',');
    var i=0; do { color += parseInt(cols[i]).toColorPart() } while (++i<3);
  } else {
    if (this.slice(0,1) == '#') {
      if (this.length==4) for(var i=1;i<4;i++) color += (this.charAt(i) + this.charAt(i)).toLowerCase();
      if (this.length==7) color = this.toLowerCase();
    }
  }
  return (color.length==7 ? color : (arguments[0] || this));
};

/*--------------------------------------------------------------------------*/

Element.collectTextNodes = function(element) {
  return $A($(element).childNodes).collect( function(node) {
    return (node.nodeType==3 ? node.nodeValue :
      (node.hasChildNodes() ? Element.collectTextNodes(node) : ''));
  }).flatten().join('');
};

Element.collectTextNodesIgnoreClass = function(element, className) {
  return $A($(element).childNodes).collect( function(node) {
    return (node.nodeType==3 ? node.nodeValue :
      ((node.hasChildNodes() && !Element.hasClassName(node,className)) ?
        Element.collectTextNodesIgnoreClass(node, className) : ''));
  }).flatten().join('');
};

Element.setContentZoom = function(element, percent) {
  element = $(element);
  element.setStyle({fontSize: (percent/100) + 'em'});
  if (Prototype.Browser.WebKit) window.scrollBy(0,0);
  return element;
};

Element.getInlineOpacity = function(element){
  return $(element).style.opacity || '';
};

Element.forceRerendering = function(element) {
  try {
    element = $(element);
    var n = document.createTextNode(' ');
    element.appendChild(n);
    element.removeChild(n);
  } catch(e) { }
};

/*--------------------------------------------------------------------------*/

var Effect = {
  _elementDoesNotExistError: {
    name: 'ElementDoesNotExistError',
    message: 'The specified DOM element does not exist, but is required for this effect to operate'
  },
  Transitions: {
    linear: Prototype.K,
    sinoidal: function(pos) {
      return (-Math.cos(pos*Math.PI)/2) + .5;
    },
    reverse: function(pos) {
      return 1-pos;
    },
    flicker: function(pos) {
      var pos = ((-Math.cos(pos*Math.PI)/4) + .75) + Math.random()/4;
      return pos > 1 ? 1 : pos;
    },
    wobble: function(pos) {
      return (-Math.cos(pos*Math.PI*(9*pos))/2) + .5;
    },
    pulse: function(pos, pulses) {
      return (-Math.cos((pos*((pulses||5)-.5)*2)*Math.PI)/2) + .5;
    },
    spring: function(pos) {
      return 1 - (Math.cos(pos * 4.5 * Math.PI) * Math.exp(-pos * 6));
    },
    none: function(pos) {
      return 0;
    },
    full: function(pos) {
      return 1;
    }
  },
  DefaultOptions: {
    duration:   1.0,   // seconds
    fps:        100,   // 100= assume 66fps max.
    sync:       false, // true for combining
    from:       0.0,
    to:         1.0,
    delay:      0.0,
    queue:      'parallel'
  },
  tagifyText: function(element) {
    var tagifyStyle = 'position:relative';
    if (Prototype.Browser.IE) tagifyStyle += ';zoom:1';

    element = $(element);
    $A(element.childNodes).each( function(child) {
      if (child.nodeType==3) {
        child.nodeValue.toArray().each( function(character) {
          element.insertBefore(
            new Element('span', {style: tagifyStyle}).update(
              character == ' ' ? String.fromCharCode(160) : character),
              child);
        });
        Element.remove(child);
      }
    });
  },
  multiple: function(element, effect) {
    var elements;
    if (((typeof element == 'object') ||
        Object.isFunction(element)) &&
       (element.length))
      elements = element;
    else
      elements = $(element).childNodes;

    var options = Object.extend({
      speed: 0.1,
      delay: 0.0
    }, arguments[2] || { });
    var masterDelay = options.delay;

    $A(elements).each( function(element, index) {
      new effect(element, Object.extend(options, { delay: index * options.speed + masterDelay }));
    });
  },
  PAIRS: {
    'slide':  ['SlideDown','SlideUp'],
    'blind':  ['BlindDown','BlindUp'],
    'appear': ['Appear','Fade']
  },
  toggle: function(element, effect, options) {
    element = $(element);
    effect  = (effect || 'appear').toLowerCase();
    
    return Effect[ Effect.PAIRS[ effect ][ element.visible() ? 1 : 0 ] ](element, Object.extend({
      queue: { position:'end', scope:(element.id || 'global'), limit: 1 }
    }, options || {}));
  }
};

Effect.DefaultOptions.transition = Effect.Transitions.sinoidal;

/* ------------- core effects ------------- */

Effect.ScopedQueue = Class.create(Enumerable, {
  initialize: function() {
    this.effects  = [];
    this.interval = null;
  },
  _each: function(iterator) {
    this.effects._each(iterator);
  },
  add: function(effect) {
    var timestamp = new Date().getTime();

    var position = Object.isString(effect.options.queue) ?
      effect.options.queue : effect.options.queue.position;

    switch(position) {
      case 'front':
        // move unstarted effects after this effect
        this.effects.findAll(function(e){ return e.state=='idle' }).each( function(e) {
            e.startOn  += effect.finishOn;
            e.finishOn += effect.finishOn;
          });
        break;
      case 'with-last':
        timestamp = this.effects.pluck('startOn').max() || timestamp;
        break;
      case 'end':
        // start effect after last queued effect has finished
        timestamp = this.effects.pluck('finishOn').max() || timestamp;
        break;
    }

    effect.startOn  += timestamp;
    effect.finishOn += timestamp;

    if (!effect.options.queue.limit || (this.effects.length < effect.options.queue.limit))
      this.effects.push(effect);

    if (!this.interval)
      this.interval = setInterval(this.loop.bind(this), 15);
  },
  remove: function(effect) {
    this.effects = this.effects.reject(function(e) { return e==effect });
    if (this.effects.length == 0) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },
  loop: function() {
    var timePos = new Date().getTime();
    for(var i=0, len=this.effects.length;i<len;i++)
      this.effects[i] && this.effects[i].loop(timePos);
  }
});

Effect.Queues = {
  instances: $H(),
  get: function(queueName) {
    if (!Object.isString(queueName)) return queueName;

    return this.instances.get(queueName) ||
      this.instances.set(queueName, new Effect.ScopedQueue());
  }
};
Effect.Queue = Effect.Queues.get('global');

Effect.Base = Class.create({
  position: null,
  start: function(options) {
    if (options && options.transition === false) options.transition = Effect.Transitions.linear;
    this.options      = Object.extend(Object.extend({ },Effect.DefaultOptions), options || { });
    this.currentFrame = 0;
    this.state        = 'idle';
    this.startOn      = this.options.delay*1000;
    this.finishOn     = this.startOn+(this.options.duration*1000);
    this.fromToDelta  = this.options.to-this.options.from;
    this.totalTime    = this.finishOn-this.startOn;
    this.totalFrames  = this.options.fps*this.options.duration;

    this.render = (function() {
      function dispatch(effect, eventName) {
        if (effect.options[eventName + 'Internal'])
          effect.options[eventName + 'Internal'](effect);
        if (effect.options[eventName])
          effect.options[eventName](effect);
      }

      return function(pos) {
        if (this.state === "idle") {
          this.state = "running";
          dispatch(this, 'beforeSetup');
          if (this.setup) this.setup();
          dispatch(this, 'afterSetup');
        }
        if (this.state === "running") {
          pos = (this.options.transition(pos) * this.fromToDelta) + this.options.from;
          this.position = pos;
          dispatch(this, 'beforeUpdate');
          if (this.update) this.update(pos);
          dispatch(this, 'afterUpdate');
        }
      };
    })();

    this.event('beforeStart');
    if (!this.options.sync)
      Effect.Queues.get(Object.isString(this.options.queue) ?
        'global' : this.options.queue.scope).add(this);
  },
  loop: function(timePos) {
    if (timePos >= this.startOn) {
      if (timePos >= this.finishOn) {
        this.render(1.0);
        this.cancel();
        this.event('beforeFinish');
        if (this.finish) this.finish();
        this.event('afterFinish');
        return;
      }
      var pos   = (timePos - this.startOn) / this.totalTime,
          frame = (pos * this.totalFrames).round();
      if (frame > this.currentFrame) {
        this.render(pos);
        this.currentFrame = frame;
      }
    }
  },
  cancel: function() {
    if (!this.options.sync)
      Effect.Queues.get(Object.isString(this.options.queue) ?
        'global' : this.options.queue.scope).remove(this);
    this.state = 'finished';
  },
  event: function(eventName) {
    if (this.options[eventName + 'Internal']) this.options[eventName + 'Internal'](this);
    if (this.options[eventName]) this.options[eventName](this);
  },
  inspect: function() {
    var data = $H();
    for(property in this)
      if (!Object.isFunction(this[property])) data.set(property, this[property]);
    return '#<Effect:' + data.inspect() + ',options:' + $H(this.options).inspect() + '>';
  }
});

Effect.Parallel = Class.create(Effect.Base, {
  initialize: function(effects) {
    this.effects = effects || [];
    this.start(arguments[1]);
  },
  update: function(position) {
    this.effects.invoke('render', position);
  },
  finish: function(position) {
    this.effects.each( function(effect) {
      effect.render(1.0);
      effect.cancel();
      effect.event('beforeFinish');
      if (effect.finish) effect.finish(position);
      effect.event('afterFinish');
    });
  }
});

Effect.Tween = Class.create(Effect.Base, {
  initialize: function(object, from, to) {
    object = Object.isString(object) ? $(object) : object;
    var args = $A(arguments), method = args.last(),
      options = args.length == 5 ? args[3] : null;
    this.method = Object.isFunction(method) ? method.bind(object) :
      Object.isFunction(object[method]) ? object[method].bind(object) :
      function(value) { object[method] = value };
    this.start(Object.extend({ from: from, to: to }, options || { }));
  },
  update: function(position) {
    this.method(position);
  }
});

Effect.Event = Class.create(Effect.Base, {
  initialize: function() {
    this.start(Object.extend({ duration: 0 }, arguments[0] || { }));
  },
  update: Prototype.emptyFunction
});

Effect.Opacity = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    // make this work on IE on elements without 'layout'
    if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
      this.element.setStyle({zoom: 1});
    var options = Object.extend({
      from: this.element.getOpacity() || 0.0,
      to:   1.0
    }, arguments[1] || { });
    this.start(options);
  },
  update: function(position) {
    this.element.setOpacity(position);
  }
});

Effect.Move = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      x:    0,
      y:    0,
      mode: 'relative'
    }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    this.element.makePositioned();
    this.originalLeft = parseFloat(this.element.getStyle('left') || '0');
    this.originalTop  = parseFloat(this.element.getStyle('top')  || '0');
    if (this.options.mode == 'absolute') {
      this.options.x = this.options.x - this.originalLeft;
      this.options.y = this.options.y - this.originalTop;
    }
  },
  update: function(position) {
    this.element.setStyle({
      left: (this.options.x  * position + this.originalLeft).round() + 'px',
      top:  (this.options.y  * position + this.originalTop).round()  + 'px'
    });
  }
});

// for backwards compatibility
Effect.MoveBy = function(element, toTop, toLeft) {
  return new Effect.Move(element,
    Object.extend({ x: toLeft, y: toTop }, arguments[3] || { }));
};

Effect.Scale = Class.create(Effect.Base, {
  initialize: function(element, percent) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      scaleX: true,
      scaleY: true,
      scaleContent: true,
      scaleFromCenter: false,
      scaleMode: 'box',        // 'box' or 'contents' or { } with provided values
      scaleFrom: 100.0,
      scaleTo:   percent
    }, arguments[2] || { });
    this.start(options);
  },
  setup: function() {
    this.restoreAfterFinish = this.options.restoreAfterFinish || false;
    this.elementPositioning = this.element.getStyle('position');

    this.originalStyle = { };
    ['top','left','width','height','fontSize'].each( function(k) {
      this.originalStyle[k] = this.element.style[k];
    }.bind(this));

    this.originalTop  = this.element.offsetTop;
    this.originalLeft = this.element.offsetLeft;

    var fontSize = this.element.getStyle('font-size') || '100%';
    ['em','px','%','pt'].each( function(fontSizeType) {
      if (fontSize.indexOf(fontSizeType)>0) {
        this.fontSize     = parseFloat(fontSize);
        this.fontSizeType = fontSizeType;
      }
    }.bind(this));

    this.factor = (this.options.scaleTo - this.options.scaleFrom)/100;

    this.dims = null;
    if (this.options.scaleMode=='box')
      this.dims = [this.element.offsetHeight, this.element.offsetWidth];
    if (/^content/.test(this.options.scaleMode))
      this.dims = [this.element.scrollHeight, this.element.scrollWidth];
    if (!this.dims)
      this.dims = [this.options.scaleMode.originalHeight,
                   this.options.scaleMode.originalWidth];
  },
  update: function(position) {
    var currentScale = (this.options.scaleFrom/100.0) + (this.factor * position);
    if (this.options.scaleContent && this.fontSize)
      this.element.setStyle({fontSize: this.fontSize * currentScale + this.fontSizeType });
    this.setDimensions(this.dims[0] * currentScale, this.dims[1] * currentScale);
  },
  finish: function(position) {
    if (this.restoreAfterFinish) this.element.setStyle(this.originalStyle);
  },
  setDimensions: function(height, width) {
    var d = { };
    if (this.options.scaleX) d.width = width.round() + 'px';
    if (this.options.scaleY) d.height = height.round() + 'px';
    if (this.options.scaleFromCenter) {
      var topd  = (height - this.dims[0])/2;
      var leftd = (width  - this.dims[1])/2;
      if (this.elementPositioning == 'absolute') {
        if (this.options.scaleY) d.top = this.originalTop-topd + 'px';
        if (this.options.scaleX) d.left = this.originalLeft-leftd + 'px';
      } else {
        if (this.options.scaleY) d.top = -topd + 'px';
        if (this.options.scaleX) d.left = -leftd + 'px';
      }
    }
    this.element.setStyle(d);
  }
});

Effect.Highlight = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({ startcolor: '#ffff99' }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    // Prevent executing on elements not in the layout flow
    if (this.element.getStyle('display')=='none') { this.cancel(); return; }
    // Disable background image during the effect
    this.oldStyle = { };
    if (!this.options.keepBackgroundImage) {
      this.oldStyle.backgroundImage = this.element.getStyle('background-image');
      this.element.setStyle({backgroundImage: 'none'});
    }
    if (!this.options.endcolor)
      this.options.endcolor = this.element.getStyle('background-color').parseColor('#ffffff');
    if (!this.options.restorecolor)
      this.options.restorecolor = this.element.getStyle('background-color');
    // init color calculations
    this._base  = $R(0,2).map(function(i){ return parseInt(this.options.startcolor.slice(i*2+1,i*2+3),16) }.bind(this));
    this._delta = $R(0,2).map(function(i){ return parseInt(this.options.endcolor.slice(i*2+1,i*2+3),16)-this._base[i] }.bind(this));
  },
  update: function(position) {
    this.element.setStyle({backgroundColor: $R(0,2).inject('#',function(m,v,i){
      return m+((this._base[i]+(this._delta[i]*position)).round().toColorPart()); }.bind(this)) });
  },
  finish: function() {
    this.element.setStyle(Object.extend(this.oldStyle, {
      backgroundColor: this.options.restorecolor
    }));
  }
});

Effect.ScrollTo = function(element) {
  var options = arguments[1] || { },
  scrollOffsets = document.viewport.getScrollOffsets(),
  elementOffsets = $(element).cumulativeOffset();

  if (options.offset) elementOffsets[1] += options.offset;

  return new Effect.Tween(null,
    scrollOffsets.top,
    elementOffsets[1],
    options,
    function(p){ scrollTo(scrollOffsets.left, p.round()); }
  );
};

/* ------------- combination effects ------------- */

Effect.Fade = function(element) {
  element = $(element);
  var oldOpacity = element.getInlineOpacity();
  var options = Object.extend({
    from: element.getOpacity() || 1.0,
    to:   0.0,
    afterFinishInternal: function(effect) {
      if (effect.options.to!=0) return;
      effect.element.hide().setStyle({opacity: oldOpacity});
    }
  }, arguments[1] || { });
  return new Effect.Opacity(element,options);
};

Effect.Appear = function(element) {
  element = $(element);
  var options = Object.extend({
  from: (element.getStyle('display') == 'none' ? 0.0 : element.getOpacity() || 0.0),
  to:   1.0,
  // force Safari to render floated elements properly
  afterFinishInternal: function(effect) {
    effect.element.forceRerendering();
  },
  beforeSetup: function(effect) {
    effect.element.setOpacity(effect.options.from).show();
  }}, arguments[1] || { });
  return new Effect.Opacity(element,options);
};

Effect.Puff = function(element) {
  element = $(element);
  var oldStyle = {
    opacity: element.getInlineOpacity(),
    position: element.getStyle('position'),
    top:  element.style.top,
    left: element.style.left,
    width: element.style.width,
    height: element.style.height
  };
  return new Effect.Parallel(
   [ new Effect.Scale(element, 200,
      { sync: true, scaleFromCenter: true, scaleContent: true, restoreAfterFinish: true }),
     new Effect.Opacity(element, { sync: true, to: 0.0 } ) ],
     Object.extend({ duration: 1.0,
      beforeSetupInternal: function(effect) {
        Position.absolutize(effect.effects[0].element);
      },
      afterFinishInternal: function(effect) {
         effect.effects[0].element.hide().setStyle(oldStyle); }
     }, arguments[1] || { })
   );
};

Effect.BlindUp = function(element) {
  element = $(element);
  element.makeClipping();
  return new Effect.Scale(element, 0,
    Object.extend({ scaleContent: false,
      scaleX: false,
      restoreAfterFinish: true,
      afterFinishInternal: function(effect) {
        effect.element.hide().undoClipping();
      }
    }, arguments[1] || { })
  );
};

Effect.BlindDown = function(element) {
  element = $(element);
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, 100, Object.extend({
    scaleContent: false,
    scaleX: false,
    scaleFrom: 0,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makeClipping().setStyle({height: '0px'}).show();
    },
    afterFinishInternal: function(effect) {
      effect.element.undoClipping();
    }
  }, arguments[1] || { }));
};

Effect.SwitchOff = function(element) {
  element = $(element);
  var oldOpacity = element.getInlineOpacity();
  return new Effect.Appear(element, Object.extend({
    duration: 0.4,
    from: 0,
    transition: Effect.Transitions.flicker,
    afterFinishInternal: function(effect) {
      new Effect.Scale(effect.element, 1, {
        duration: 0.3, scaleFromCenter: true,
        scaleX: false, scaleContent: false, restoreAfterFinish: true,
        beforeSetup: function(effect) {
          effect.element.makePositioned().makeClipping();
        },
        afterFinishInternal: function(effect) {
          effect.element.hide().undoClipping().undoPositioned().setStyle({opacity: oldOpacity});
        }
      });
    }
  }, arguments[1] || { }));
};

Effect.DropOut = function(element) {
  element = $(element);
  var oldStyle = {
    top: element.getStyle('top'),
    left: element.getStyle('left'),
    opacity: element.getInlineOpacity() };
  return new Effect.Parallel(
    [ new Effect.Move(element, {x: 0, y: 100, sync: true }),
      new Effect.Opacity(element, { sync: true, to: 0.0 }) ],
    Object.extend(
      { duration: 0.5,
        beforeSetup: function(effect) {
          effect.effects[0].element.makePositioned();
        },
        afterFinishInternal: function(effect) {
          effect.effects[0].element.hide().undoPositioned().setStyle(oldStyle);
        }
      }, arguments[1] || { }));
};

Effect.Shake = function(element) {
  element = $(element);
  var options = Object.extend({
    distance: 20,
    duration: 0.5
  }, arguments[1] || {});
  var distance = parseFloat(options.distance);
  var split = parseFloat(options.duration) / 10.0;
  var oldStyle = {
    top: element.getStyle('top'),
    left: element.getStyle('left') };
    return new Effect.Move(element,
      { x:  distance, y: 0, duration: split, afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x:  distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x:  distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance, y: 0, duration: split, afterFinishInternal: function(effect) {
        effect.element.undoPositioned().setStyle(oldStyle);
  }}); }}); }}); }}); }}); }});
};

Effect.SlideDown = function(element) {
  element = $(element).cleanWhitespace();
  // SlideDown need to have the content of the element wrapped in a container element with fixed height!
  var oldInnerBottom = element.down().getStyle('bottom');
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, 100, Object.extend({
    scaleContent: false,
    scaleX: false,
    scaleFrom: window.opera ? 0 : 1,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makePositioned();
      effect.element.down().makePositioned();
      if (window.opera) effect.element.setStyle({top: ''});
      effect.element.makeClipping().setStyle({height: '0px'}).show();
    },
    afterUpdateInternal: function(effect) {
      effect.element.down().setStyle({bottom:
        (effect.dims[0] - effect.element.clientHeight) + 'px' });
    },
    afterFinishInternal: function(effect) {
      effect.element.undoClipping().undoPositioned();
      effect.element.down().undoPositioned().setStyle({bottom: oldInnerBottom}); }
    }, arguments[1] || { })
  );
};

Effect.SlideUp = function(element) {
  element = $(element).cleanWhitespace();
  var oldInnerBottom = element.down().getStyle('bottom');
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, window.opera ? 0 : 1,
   Object.extend({ scaleContent: false,
    scaleX: false,
    scaleMode: 'box',
    scaleFrom: 100,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makePositioned();
      effect.element.down().makePositioned();
      if (window.opera) effect.element.setStyle({top: ''});
      effect.element.makeClipping().show();
    },
    afterUpdateInternal: function(effect) {
      effect.element.down().setStyle({bottom:
        (effect.dims[0] - effect.element.clientHeight) + 'px' });
    },
    afterFinishInternal: function(effect) {
      effect.element.hide().undoClipping().undoPositioned();
      effect.element.down().undoPositioned().setStyle({bottom: oldInnerBottom});
    }
   }, arguments[1] || { })
  );
};

// Bug in opera makes the TD containing this element expand for a instance after finish
Effect.Squish = function(element) {
  return new Effect.Scale(element, window.opera ? 1 : 0, {
    restoreAfterFinish: true,
    beforeSetup: function(effect) {
      effect.element.makeClipping();
    },
    afterFinishInternal: function(effect) {
      effect.element.hide().undoClipping();
    }
  });
};

Effect.Grow = function(element) {
  element = $(element);
  var options = Object.extend({
    direction: 'center',
    moveTransition: Effect.Transitions.sinoidal,
    scaleTransition: Effect.Transitions.sinoidal,
    opacityTransition: Effect.Transitions.full
  }, arguments[1] || { });
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    width: element.style.width,
    opacity: element.getInlineOpacity() };

  var dims = element.getDimensions();
  var initialMoveX, initialMoveY;
  var moveX, moveY;

  switch (options.direction) {
    case 'top-left':
      initialMoveX = initialMoveY = moveX = moveY = 0;
      break;
    case 'top-right':
      initialMoveX = dims.width;
      initialMoveY = moveY = 0;
      moveX = -dims.width;
      break;
    case 'bottom-left':
      initialMoveX = moveX = 0;
      initialMoveY = dims.height;
      moveY = -dims.height;
      break;
    case 'bottom-right':
      initialMoveX = dims.width;
      initialMoveY = dims.height;
      moveX = -dims.width;
      moveY = -dims.height;
      break;
    case 'center':
      initialMoveX = dims.width / 2;
      initialMoveY = dims.height / 2;
      moveX = -dims.width / 2;
      moveY = -dims.height / 2;
      break;
  }

  return new Effect.Move(element, {
    x: initialMoveX,
    y: initialMoveY,
    duration: 0.01,
    beforeSetup: function(effect) {
      effect.element.hide().makeClipping().makePositioned();
    },
    afterFinishInternal: function(effect) {
      new Effect.Parallel(
        [ new Effect.Opacity(effect.element, { sync: true, to: 1.0, from: 0.0, transition: options.opacityTransition }),
          new Effect.Move(effect.element, { x: moveX, y: moveY, sync: true, transition: options.moveTransition }),
          new Effect.Scale(effect.element, 100, {
            scaleMode: { originalHeight: dims.height, originalWidth: dims.width },
            sync: true, scaleFrom: window.opera ? 1 : 0, transition: options.scaleTransition, restoreAfterFinish: true})
        ], Object.extend({
             beforeSetup: function(effect) {
               effect.effects[0].element.setStyle({height: '0px'}).show();
             },
             afterFinishInternal: function(effect) {
               effect.effects[0].element.undoClipping().undoPositioned().setStyle(oldStyle);
             }
           }, options)
      );
    }
  });
};

Effect.Shrink = function(element) {
  element = $(element);
  var options = Object.extend({
    direction: 'center',
    moveTransition: Effect.Transitions.sinoidal,
    scaleTransition: Effect.Transitions.sinoidal,
    opacityTransition: Effect.Transitions.none
  }, arguments[1] || { });
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    width: element.style.width,
    opacity: element.getInlineOpacity() };

  var dims = element.getDimensions();
  var moveX, moveY;

  switch (options.direction) {
    case 'top-left':
      moveX = moveY = 0;
      break;
    case 'top-right':
      moveX = dims.width;
      moveY = 0;
      break;
    case 'bottom-left':
      moveX = 0;
      moveY = dims.height;
      break;
    case 'bottom-right':
      moveX = dims.width;
      moveY = dims.height;
      break;
    case 'center':
      moveX = dims.width / 2;
      moveY = dims.height / 2;
      break;
  }

  return new Effect.Parallel(
    [ new Effect.Opacity(element, { sync: true, to: 0.0, from: 1.0, transition: options.opacityTransition }),
      new Effect.Scale(element, window.opera ? 1 : 0, { sync: true, transition: options.scaleTransition, restoreAfterFinish: true}),
      new Effect.Move(element, { x: moveX, y: moveY, sync: true, transition: options.moveTransition })
    ], Object.extend({
         beforeStartInternal: function(effect) {
           effect.effects[0].element.makePositioned().makeClipping();
         },
         afterFinishInternal: function(effect) {
           effect.effects[0].element.hide().undoClipping().undoPositioned().setStyle(oldStyle); }
       }, options)
  );
};

Effect.Pulsate = function(element) {
  element = $(element);
  var options    = arguments[1] || { },
    oldOpacity = element.getInlineOpacity(),
    transition = options.transition || Effect.Transitions.linear,
    reverser   = function(pos){
      return 1 - transition((-Math.cos((pos*(options.pulses||5)*2)*Math.PI)/2) + .5);
    };

  return new Effect.Opacity(element,
    Object.extend(Object.extend({  duration: 2.0, from: 0,
      afterFinishInternal: function(effect) { effect.element.setStyle({opacity: oldOpacity}); }
    }, options), {transition: reverser}));
};

Effect.Fold = function(element) {
  element = $(element);
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    width: element.style.width,
    height: element.style.height };
  element.makeClipping();
  return new Effect.Scale(element, 5, Object.extend({
    scaleContent: false,
    scaleX: false,
    afterFinishInternal: function(effect) {
    new Effect.Scale(element, 1, {
      scaleContent: false,
      scaleY: false,
      afterFinishInternal: function(effect) {
        effect.element.hide().undoClipping().setStyle(oldStyle);
      } });
  }}, arguments[1] || { }));
};

Effect.Morph = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      style: { }
    }, arguments[1] || { });

    if (!Object.isString(options.style)) this.style = $H(options.style);
    else {
      if (options.style.include(':'))
        this.style = options.style.parseStyle();
      else {
        this.element.addClassName(options.style);
        this.style = $H(this.element.getStyles());
        this.element.removeClassName(options.style);
        var css = this.element.getStyles();
        this.style = this.style.reject(function(style) {
          return style.value == css[style.key];
        });
        options.afterFinishInternal = function(effect) {
          effect.element.addClassName(effect.options.style);
          effect.transforms.each(function(transform) {
            effect.element.style[transform.style] = '';
          });
        };
      }
    }
    this.start(options);
  },

  setup: function(){
    function parseColor(color){
      if (!color || ['rgba(0, 0, 0, 0)','transparent'].include(color)) color = '#ffffff';
      color = color.parseColor();
      return $R(0,2).map(function(i){
        return parseInt( color.slice(i*2+1,i*2+3), 16 );
      });
    }
    this.transforms = this.style.map(function(pair){
      var property = pair[0], value = pair[1], unit = null;

      if (value.parseColor('#zzzzzz') != '#zzzzzz') {
        value = value.parseColor();
        unit  = 'color';
      } else if (property == 'opacity') {
        value = parseFloat(value);
        if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
          this.element.setStyle({zoom: 1});
      } else if (Element.CSS_LENGTH.test(value)) {
          var components = value.match(/^([\+\-]?[0-9\.]+)(.*)$/);
          value = parseFloat(components[1]);
          unit = (components.length == 3) ? components[2] : null;
      }

      var originalValue = this.element.getStyle(property);
      return {
        style: property.camelize(),
        originalValue: unit=='color' ? parseColor(originalValue) : parseFloat(originalValue || 0),
        targetValue: unit=='color' ? parseColor(value) : value,
        unit: unit
      };
    }.bind(this)).reject(function(transform){
      return (
        (transform.originalValue == transform.targetValue) ||
        (
          transform.unit != 'color' &&
          (isNaN(transform.originalValue) || isNaN(transform.targetValue))
        )
      );
    });
  },
  update: function(position) {
    var style = { }, transform, i = this.transforms.length;
    while(i--)
      style[(transform = this.transforms[i]).style] =
        transform.unit=='color' ? '#'+
          (Math.round(transform.originalValue[0]+
            (transform.targetValue[0]-transform.originalValue[0])*position)).toColorPart() +
          (Math.round(transform.originalValue[1]+
            (transform.targetValue[1]-transform.originalValue[1])*position)).toColorPart() +
          (Math.round(transform.originalValue[2]+
            (transform.targetValue[2]-transform.originalValue[2])*position)).toColorPart() :
        (transform.originalValue +
          (transform.targetValue - transform.originalValue) * position).toFixed(3) +
            (transform.unit === null ? '' : transform.unit);
    this.element.setStyle(style, true);
  }
});

Effect.Transform = Class.create({
  initialize: function(tracks){
    this.tracks  = [];
    this.options = arguments[1] || { };
    this.addTracks(tracks);
  },
  addTracks: function(tracks){
    tracks.each(function(track){
      track = $H(track);
      var data = track.values().first();
      this.tracks.push($H({
        ids:     track.keys().first(),
        effect:  Effect.Morph,
        options: { style: data }
      }));
    }.bind(this));
    return this;
  },
  play: function(){
    return new Effect.Parallel(
      this.tracks.map(function(track){
        var ids = track.get('ids'), effect = track.get('effect'), options = track.get('options');
        var elements = [$(ids) || $$(ids)].flatten();
        return elements.map(function(e){ return new effect(e, Object.extend({ sync:true }, options)) });
      }).flatten(),
      this.options
    );
  }
});

Element.CSS_PROPERTIES = $w(
  'backgroundColor backgroundPosition borderBottomColor borderBottomStyle ' +
  'borderBottomWidth borderLeftColor borderLeftStyle borderLeftWidth ' +
  'borderRightColor borderRightStyle borderRightWidth borderSpacing ' +
  'borderTopColor borderTopStyle borderTopWidth bottom clip color ' +
  'fontSize fontWeight height left letterSpacing lineHeight ' +
  'marginBottom marginLeft marginRight marginTop markerOffset maxHeight '+
  'maxWidth minHeight minWidth opacity outlineColor outlineOffset ' +
  'outlineWidth paddingBottom paddingLeft paddingRight paddingTop ' +
  'right textIndent top width wordSpacing zIndex');

Element.CSS_LENGTH = /^(([\+\-]?[0-9\.]+)(em|ex|px|in|cm|mm|pt|pc|\%))|0$/;

String.__parseStyleElement = document.createElement('div');
String.prototype.parseStyle = function(){
  var style, styleRules = $H();
  if (Prototype.Browser.WebKit)
    style = new Element('div',{style:this}).style;
  else {
    String.__parseStyleElement.innerHTML = '<div style="' + this + '"></div>';
    style = String.__parseStyleElement.childNodes[0].style;
  }

  Element.CSS_PROPERTIES.each(function(property){
    if (style[property]) styleRules.set(property, style[property]);
  });

  if (Prototype.Browser.IE && this.include('opacity'))
    styleRules.set('opacity', this.match(/opacity:\s*((?:0|1)?(?:\.\d*)?)/)[1]);

  return styleRules;
};

if (document.defaultView && document.defaultView.getComputedStyle) {
  Element.getStyles = function(element) {
    var css = document.defaultView.getComputedStyle($(element), null);
    return Element.CSS_PROPERTIES.inject({ }, function(styles, property) {
      styles[property] = css[property];
      return styles;
    });
  };
} else {
  Element.getStyles = function(element) {
    element = $(element);
    var css = element.currentStyle, styles;
    styles = Element.CSS_PROPERTIES.inject({ }, function(results, property) {
      results[property] = css[property];
      return results;
    });
    if (!styles.opacity) styles.opacity = element.getOpacity();
    return styles;
  };
}

Effect.Methods = {
  morph: function(element, style) {
    element = $(element);
    new Effect.Morph(element, Object.extend({ style: style }, arguments[2] || { }));
    return element;
  },
  visualEffect: function(element, effect, options) {
    element = $(element);
    var s = effect.dasherize().camelize(), klass = s.charAt(0).toUpperCase() + s.substring(1);
    new Effect[klass](element, options);
    return element;
  },
  highlight: function(element, options) {
    element = $(element);
    new Effect.Highlight(element, options);
    return element;
  }
};

$w('fade appear grow shrink fold blindUp blindDown slideUp slideDown '+
  'pulsate shake puff squish switchOff dropOut').each(
  function(effect) {
    Effect.Methods[effect] = function(element, options){
      element = $(element);
      Effect[effect.charAt(0).toUpperCase() + effect.substring(1)](element, options);
      return element;
    };
  }
);

$w('getInlineOpacity forceRerendering setContentZoom collectTextNodes collectTextNodesIgnoreClass getStyles').each(
  function(f) { Effect.Methods[f] = Element[f]; }
);

Element.addMethods(Effect.Methods);
Object.extend(Array.prototype, {
  swap: function(i, j) {
    var value = this[i];
    this[i] = this[j], this[j] = value;
    return this;
  }
});
var AnchorObserver = {
  enabled:  true,
  interval: 0.1
};

document.observe("dom:loaded", function() {
  var lastAnchor = "";
  
  function poll() {
    var anchor = (window.location.hash || "").slice(1);
    if (anchor != lastAnchor) {
      document.fire("anchor:changed", { to: anchor, from: lastAnchor });
      lastAnchor = anchor;
    }
  }

  if (AnchorObserver.enabled) {
    setInterval(poll, AnchorObserver.interval * 1000);
  }
});
var DragObserver = Class.create({
  initialize: function() {
    document.observe("mousedown", this.onMouseDown.bind(this));
    document.observe("mousemove", this.onMouseMove.bind(this));
    document.observe("mouseup", this.onMouseUp.bind(this));
    document.observe("click", this.onClick.bind(this));
    this.start();
  },
  
  start: function() {
    this.stopped = false;
  },
  
  stop: function() {
    this.stopped = true;
  },
  
  onMouseDown: function(event) {
    if (this.stopped) return;
    var pointer = event.pointer(), element = event.findElement();
    
    var target = this.findTargetForElement(element);
    if (target) {
      if (target.fire("drag:requested", { mouseEvent: event }).stopped) return;

      if (this.prepareForDrag(target, pointer)) {
       this.mouseDownTimeout = this.onMouseDownTimeout.bind(this, pointer).delay(0.35);
      }
      event.stop();
    }
    
    this.justDropped = false;
  },
  
  onMouseDownTimeout: function(pointer) {
    this.mouseDownTimeout = false;
    if (this.stopped) return;

    if (this.target && !this.dragging) {
      this.startDrag(pointer);
    }
  },
  
  onMouseMove: function(event) {
    if (this.stopped) return;
    if (this.mouseDownTimeout) {
      window.clearTimeout(this.mouseDownTimeout);
      this.mouseDownTimeout = false;
    }
    
    var pointer = event.pointer();

    if (this.target && !this.dragging) {
      this.startDrag(pointer);
    }
    
    if (this.dragging) {
      this.updateDrag(pointer);
      event.stop();
    }
  },
  
  onMouseUp: function(event) {
    if (this.stopped) return;
    if (this.mouseDownTimeout) {
      window.clearTimeout(this.mouseDownTimeout);
      this.mouseDownTimeout = false;
    }
    
    if (this.dragging) {
      this.justDropped = event.findElement();
      this.stopDrag();
      event.stop();
    }
    
    this.reset();
  },
  
  onClick: function(event) {
    if (this.stopped) return;

    if (event.findElement() == this.justDropped) {
      event.stop();
      this.reset();
    }
  },
  
  prepareForDrag: function(target, pointer) {
    var container = this.findContainerForTarget(target);
    var region = this.findRegionForContainer(container);

    this.target = target;
    this.container = container;
    this.region = region;

    var event = this.fireEvent("drag:prepared");
    
    if (event.stopped) {
      this.reset();
      return false;
      
    } else if (event.startDragging) {
      this.startDrag(pointer);
      return false;
    }
    
    return true;
  },
  
  startDrag: function(pointer) {
    if (this.fire("drag:started", { pointer: pointer })) {
      this.layer = new Element.Layer([this.container], this.container, pointer);
      this.layer.freeze();
    }
    
    this.dragging = true;
  },
  
  updateDrag: function(pointer) {
    if (this.fire("drag:moved", { pointer: pointer }) && this.layer) {
      this.container.setStyle(this.layer.translate(pointer));
    }
  },
  
  stopDrag: function(pointer) {
    if (this.fire("drag:stopped") && this.layer) {
      this.layer.thaw();
    }
    
    this.reset();
  },

  fireEvent: function(eventName, memo) {
    return this.container.fire(eventName, Object.extend({
      target:    this.target,
      container: this.container,
      region:    this.region
    }, memo));
  },

  fire: function(eventName, memo) {
    var event = this.fireEvent(eventName, memo);
    return !event.stopped;
  },

  findTargetForElement: function(element) {
    return element.trace(".drag_target");
  },
  
  findContainerForTarget: function(target) {
    return target.trace(".drag_container");
  },
  
  findRegionForContainer: function(container) {
    return container.trace(".drag_region");
  },
  
  reset: function() {
    this.target =
    this.container =
    this.region =
    this.pointer =
    this.dragging = false;
  }
});
var DragScrollObserver = Class.create({
  initialize: function(options) {
    options = options || {};
    this.sensitivity  = options.sensitivity  || 0.35;
    this.scrollMargin = options.scrollMargin || 20;
    
    document.observe("drag:started", this.onDragStarted.bind(this));
    document.observe("drag:moved",   this.onDragMoved.bind(this));
    document.observe("drag:stopped", this.onDragStopped.bind(this));
  },
  
  onDragStarted: function(event) {
    if (!this.interval) {
      this.interval = window.setInterval(this.performScroll.bind(this), 25);
    }
  },
  
  onDragMoved: function(event) {
    this.measureViewport();
    this.pointer = event.memo.pointer;
    this.leftScrollOffset = this.getLeftScrollOffset();
    this.topScrollOffset = this.getTopScrollOffset();
  },
  
  onDragStopped: function(event) {
    if (this.interval) {
      window.clearInterval(this.interval);
      this.interval = this.pointer = null;
    }
  },
  
  performScroll: function() {
    if (this.pointer) {
      this.measureViewport();
      window.scrollTo(
        this.viewportOffsets.left + (this.leftScrollOffset * this.sensitivity),
        this.viewportOffsets.top  + (this.topScrollOffset * this.sensitivity)
      );
    }
  },
  
  getLeftScrollOffset: function() {
    var x = this.pointer.x - this.viewportOffsets.left;

    if (x < this.scrollMargin) {
      return x - this.scrollMargin;
    } else if (x > (this.viewportDimensions.width - this.scrollMargin)) {
      return x - (this.viewportDimensions.width - this.scrollMargin);
    } else {
      return 0;
    }
  },
  
  getTopScrollOffset: function() {
    var y = this.pointer.y - this.viewportOffsets.top;
    
    if (y < this.scrollMargin) {
      return y - this.scrollMargin;
    } else if (y > (this.viewportDimensions.height - this.scrollMargin)) {
      return y - (this.viewportDimensions.height - this.scrollMargin);
    } else {
      return 0;
    }
  },
  
  measureViewport: function() {
    this.viewportDimensions = document.viewport.getDimensions();
    this.viewportOffsets = document.viewport.getScrollOffsets();
  }
});
(function() {
  var emptyAnchorHandler;
  function getEmptyAnchorHandler() {
    return emptyAnchorHandler = emptyAnchorHandler || 
      new Element("a").writeAttribute({ 
        name:       "/" 
      }).setStyle({
        position:   "absolute",
        visibility: "hidden"
      });
  }

  document.observe("click", function(event) {
    var element = event.findElement("a[href=\\#]");
    if (element) {
      var offsets = document.viewport.getScrollOffsets();
      $(document.body).insert(getEmptyAnchorHandler().setStyle({
        left: offsets.left + "px",
        top:  offsets.top + "px"
      }));
    }
  });
})();
var HoverObserver = Class.create({
  initialize: function(element, options) {
    this.element = $(element);
    this.options = Object.extend(Object.clone(HoverObserver.Options), options || {});
    this.start();
  },
  
  start: function() {
    if (!this.observers) {
      var events = $w(this.options.clickToHover ? "click" : "mouseover mouseout");
      this.observers = events.map(function(name) {
        var handler = this["on" + name.capitalize()].bind(this);
        this.element.observe(name, handler);
        return { name: name, handler: handler };
      }.bind(this));
    }
  },
  
  stop: function() {
    if (this.observers) {
      this.observers.each(function(info) {
        this.element.stopObserving(info.name, info.handler);
      }.bind(this));
      delete this.observers;
    }
  },
  
  onClick: function(event) {
    var element   = this.activeHoverElement = event.findElement();
    var container = this.getContainerForElement(element);
    
    if (container) {
      if (this.activeContainer && container == this.activeContainer) 
        return this.deactivateContainer();
      this.activateContainer(container);
    }
  },
  
  onMouseover: function(event) {
    var element   = this.activeHoverElement = event.findElement();
    var container = this.getContainerForElement(element);
    
    if (container) {
      if (this.activeContainer) {
        this.activateContainer(container);
      } else {
        this.startDelayedActivation(container);
      }
    } else {
      this.startDelayedDeactivation();
    }
  },
  
  onMouseout: function(event) {
    delete this.activeHoverElement;
    this.startDelayedDeactivation();
  },
  
  activateContainer: function(container) {
    var memo = { toElement: container };
    this.stopDelayedDeactivation();
    
    if (this.activeContainer) {
      if (this.activeContainer == container) return;
      memo.fromElement = this.activeContainer;
      this.deactivateContainer(memo);
    }
    
    this.activeContainer = container;
    this.activeContainer.fire(this.options.activationEvent, memo);
    this.activeContainer.addClassName(this.options.activeClassName);
  },
  
  deactivateContainer: function(memo) {
    if (this.activeContainer) {
      try {
        this.activeContainer.removeClassName(this.options.activeClassName);
        this.activeContainer.fire(this.options.deactivationEvent, memo);
      } catch (e) {
      }
      
      delete this.activeContainer;
    }
  },
  
  startDelayedActivation: function(container) {
    if (this.options.activationDelay) {
      (function() {
        if (container == this.getContainerForElement(this.activeHoverElement))
          this.activateContainer(container);
        
      }).bind(this).delay(this.options.activationDelay);
    } else {
      this.activateContainer(container);
    }
  },
  
  startDelayedDeactivation: function() {
    if (this.options.deactivationDelay) {
      this.deactivationTimeout = this.deactivationTimeout || function() {
        var container = this.getContainerForElement(this.activeHoverElement);
        if (!container || container != this.activeContainer)
          this.deactivateContainer();
        
      }.bind(this).delay(this.options.deactivationDelay);
    } else {
      this.deactivateContainer();
    }
  },
  
  stopDelayedDeactivation: function() {
    if (this.deactivationTimeout) {
      window.clearTimeout(this.deactivationTimeout);
      delete this.deactivationTimeout;
    }
  },
  
  getContainerForElement: function(element) {
    if (!element) return;
    if (element.hasAttribute && !element.hasAttribute(this.options.containerAttribute)) {
      var target    = this.getTargetForElement(element);
      var container = this.getContainerForTarget(target);
      this.cacheContainerFromElementToTarget(container, element, target);
    }
    
    return $(element.readAttribute(this.options.containerAttribute));
  },
  
  getTargetForElement: function(element) {
    if (!element) return;
    return element.trace("." + this.options.targetClassName);
  },
  
  getContainerForTarget: function(element) {
    if (!element) return;
    var containerClassName = this.options.containerClassName,
        containerAttribute = this.options.containerAttribute,
        expression = "[" + containerAttribute + "], ." + containerClassName;
    
    // Check if element is a hover container to avoid a bug in Chrome where trace 
    // doesnâ€™t match when the target element is also the hover container.
    var container = (element.hasClassName(containerClassName)) ? element : element.trace(expression);

    if (container && container.hasAttribute(containerAttribute)) {
      return $(container.readAttribute(containerAttribute));
    } else {
      return container;
    }
  },
  
  cacheContainerFromElementToTarget: function(container, element, target) {
    if (container && target) {
      element.upwards(function(e) {
        e.writeAttribute(this.options.containerAttribute, container.identify());
        if (e == target) return true;
      }.bind(this));
    }
  }
});

Object.extend(HoverObserver, {
  Options: {
    activationDelay:    0,
    deactivationDelay:  0.5,
    targetClassName:    "hover_target",
    containerClassName: "hover_container",
    containerAttribute: "hover_container",
    activeClassName:    "hover",
    activationEvent:    "hover:activated",
    deactivationEvent:  "hover:deactivated", 
    clickToHover:       false
  }
});

var MenuObserver = Class.create({
  initialize: function(region, options) {
    this.region  = $(region);
    this.options = options;
    this.registerObservers();
    this.start();
  },

  registerObservers: function() {
    document.observe("mousedown", this.onDocumentMouseDown.bind(this));
    this.region.observe("mousedown", this.onRegionMouseDown.bind(this));
    this.region.observe("mouseup", this.onRegionMouseUp.bind(this));
    this.region.observe("mouseover", this.onRegionMouseOver.bind(this));
    this.region.observe("mouseout", this.onRegionMouseOut.bind(this));
    this.region.observe("keydown", this.onRegionKeyDown.bind(this));
    this.region.observe("menu:deactivate", this.deactivate.bind(this));
  },

  start: function() {
    this.started = true;
  },

  stop: function() {
    this.started = false;
  },

  onDocumentMouseDown: function(event) {
    if (!this.started || !this.activeContainer) return;

    // if there's an active container, and the click didn't come from within, deactivate it
    var element = event.findElement();
    if (!this.elementBelongsToActiveContainer(element)) {
      this.deactivate();
    }
  },

  onRegionMouseDown: function(event) {
    if (!this.started) return;

    // if the click doesn't come from inside the active container, deactivate it
    var element = event.findElement();
    if (!this.elementBelongsToActiveContainer(element)) {
      this.deactivate();
    }

    var target = this.findTargetForElement(element);
    if (target) {
      // if the click is inside a target,
      var container = this.findContainerForElement(target);
      if (container == this.activeContainer) {
        // and the target belongs to the active container, deactivate it
        this.deactivate();
      } else {
        // otherwise activate the target's container
        this.activate(container);
      }
      event.stop();
    }
  },

  onRegionMouseUp: function(event) {
    if (!this.started || !this.activeContainer || this.isIgnorable(event)) return;

    var element = event.findElement();
    if (this.elementBelongsToActiveContainer(element)) {
      // if the click is inside an action, perform the action and deactivate
      var action = this.findActionForElement(element);
      if (action) {
        this.select(action);
        this.deactivate();
        event.stop();
      } else if (this.findProvisionForElement(element)) {
        event.stop();
      }
    }
  },

  onRegionMouseOver: function(event) {
    var element = event.findElement("[data-menuaction]");
    if (element) element.addClassName("hover");
  },

  onRegionMouseOut: function(event) {
    var element = event.findElement("[data-menuaction]");
    if (element) element.removeClassName("hover");
  },

  onRegionKeyDown: function(event) {
    if (!this.started) return;

    if (event.keyCode == Event.KEY_ESC) {
      this.deactivate();
      event.stop();
    }
  },

  activate: function(container) {
    if (container) {
      var event = container.fire("menu:prepared", {
        container: this.activeContainer
      });

      if (!event.stopped) {
        this.finishDeactivation();
        this.activeContainer = container;
        this.activeContainer.addClassName("active_menu");
        this.activeContainer.fire("menu:activated");
      }
    }
  },

  deactivate: function() {
    if (this.activeContainer) {
      var container = this.activeContainer;
      var content = container.down('.menu_content');
      this.activeContainer = false;

      this.deactivation = {
        container: container,
        content:   content,
        effect:    new Effect.Fade(content, {
          duration: 0.2,
          afterFinish: this.finishDeactivation.bind(this)
        })
      };
    }
  },

  finishDeactivation: function() {
    if (this.deactivation) {
      this.deactivation.effect.cancel();
      this.deactivation.container.removeClassName("active_menu");
      // Canceling a effect can leave the menu_content at a partial opacity
      this.deactivation.container.down('.menu_content').setStyle({opacity: ''});

      this.deactivation.content.show();
      this.deactivation.container.fire("menu:deactivated");
      this.deactivation = false;
    }
  },

  select: function(action) {
    if (this.activeContainer) {
      var actionName  = action.readAttribute("data-menuaction");
      var actionValue = action.readAttribute("data-menuvalue");

      action.fire("menu:selected", {
        container: this.activeContainer,
        action:    actionName,
        value:     actionValue
      });
    }
  },

  isIgnorable: function(event) {
    return event.button > 1 || event.ctrlKey || event.metaKey;
  },

  elementBelongsToActiveContainer: function(element) {
    if (this.activeContainer) {
      return this.findContainerForElement(element) == this.activeContainer;
    }
  },

  elementsBelongToSameContainer: function(first, second) {
    var firstContainer  = this.findContainerForElement(first);
    var secondContainer = this.findContainerForElement(second);
    return firstContainer == secondContainer;
  },

  findTargetForElement: function(element) {
    var target = element.trace(".menu_target");
    if (this.elementsBelongToSameContainer(element, target)) return target;
  },

  findActionForElement: function(element) {
    var action = element.trace("[data-menuaction]");
    if (this.elementsBelongToSameContainer(element, action)) return action;
  },

  findProvisionForElement: function(element) {
    var provision = element.trace(".menu_target, .menu_content, [data-menuaction]");
    if (this.elementsBelongToSameContainer(element, provision)) return provision;
  },

  findContainerForElement: function(element) {
    if (element) return element.trace(".menu_container");
  }
});
var ReorderObserver = Class.create({
  initialize: function() {
    document.observe("drag:prepared", this.onDragPrepared.bind(this));
    document.observe("drag:started",  this.onDragStarted.bind(this));
    document.observe("drag:moved",    this.onDragMoved.bind(this));
    document.observe("drag:stopped",  this.onDragStopped.bind(this));
  },
  
  start: function() {
    this.stopped = false;
  },
  
  stop: function() {
    this.stopped = true;
  },
  
  onDragPrepared: function(event) {
    if (this.stopped) return;

    if (!this.container) {
      var element = event.findElement();
    
      var container = this.findContainerForElement(element);
      if (container) {
        this.prepareForReorder(container);
        container.fire("order:prepared");
      }
    }
  },
  
  onDragStarted: function(event) {
    if (this.stopped) return;

    if (!this.layer) {
      if (this.containers && this.containers.length > 1) {
        this.layer = new Element.ReorderLayer(
          this.containers, this.container, event.memo.pointer
        );
        this.layer.freeze();
        this.container.addClassName("reordering");
        this.container.fire("order:started");

      } else {
        this.reset();
      }
    }
    
    event.stop();
  },
  
  onDragMoved: function(event) {
    if (this.stopped) return;

    if (this.layer && !this.stopping) {
      var offset = this.layer.translate(event.memo.pointer);
      
      if (offset < this.layer.getPreviousReorderThreshold()) {
        this.layer.swapActiveElementWithPrevious();
      } else if (offset >= this.layer.getNextReorderThreshold()) {
        this.layer.swapActiveElementWithNext();
      }
      
      this.layer.moveActiveElementTo(
        this.layer.translatePointer(event.memo.pointer)
      );
    }
    
    event.stop();
  },
  
  onDragStopped: function(event) {
    if (this.stopped) return;

    if (this.layer && !this.stopping) {    
      this.stopping = true;  
      this.layer.thawWithAnimation(function() {
        this.container.removeClassName("reordering");

        if (this.layer.hasChangedOrder()) {
          this.container.fire("order:changed");
        }

        this.container.fire("order:stopped");
        this.reset();
        
      }.bind(this));
    }
    
    event.stop();
  },
  
  findContainerForElement: function(element) {
    return element.trace(".reorder_container");
  },
  
  findRegionForContainer: function(container) {
    return container.trace(".reorder_region");
  },
  
  findSiblingContainers: function(container) {
    var siblings = container.previousSiblings().reverse().concat(
      [container], container.nextSiblings());
    return siblings.select(function(sibling) { 
      return sibling.match(".reorder_container")
    });
  },
  
  prepareForReorder: function(container) {
    this.container = container;
    this.region = this.findRegionForContainer(container);
    this.containers = this.findSiblingContainers(container);
  },
  
  reset: function() {
    this.container =
    this.region =
    this.containers = 
    this.stopping =
    this.layer = false;
  }
});
var SelectionObserver = Class.create({
  initialize: function(region) {
    this.region = $(region);
    this.registerObservers();
    this.start();
  },

  start: function() {
    if (this.started) return;
    this.started = true;
  },

  stop: function() {
    if (!this.started) return;
    this.started = false;
  },

  prepareSelection: function(selectable) {
    this.deactivateSelection();
    this.pendingSelection = selectable;
    this.pendingSelection.fire("selection:prepared");
    this.pendingSelection.addClassName("selected");
  },

  cancelPendingSelection: function() {
    if (!this.pendingSelection) return;
    this.pendingSelection.removeClassName("selected");
    this.pendingSelection.fire("selection:canceled");
    delete this.pendingSelection;
  },

  activatePendingSelection: function(memo) {
    if (!this.pendingSelection) return;
    this.activeSelection = this.pendingSelection;
    this.activeSelection.fire("selection:activated", memo);
    this.activeSelection.addClassName("active_selection");
    delete this.pendingSelection;
  },

  deactivateSelection: function() {
    if (!this.activeSelection) return;
    this.activeSelection.removeClassName("active_selection");
    this.activeSelection.removeClassName("selected");
    this.activeSelection.fire("selection:deactivated");
    delete this.activeSelection;
  },

  getPendingSelection: function() {
    return this.pendingSelection;
  },

  getActiveSelection: function() {
    return this.activeSelection;
  },

  findTargetFromElement: function(element) {
    return element.trace(".selectable_target");
  },

  findSelectableFromTarget: function(target) {
    return target.trace(".selectable");
  },

  findSelectableFromElement: function(element) {
    var target = this.findTargetFromElement(element);
    if (target) return this.findSelectableFromTarget(target);
  },

  elementBelongsToPendingSelection: function(element) {
    if (this.pendingSelection) return element.descendantOf(this.pendingSelection);
  },

  elementBelongsToActiveSelection: function(element) {
    if (this.activeSelection) return element.descendantOf(this.activeSelection);
  },

  handleEvent: function(eventName) {
    var method = this["on" + eventName].bind(this);
    this.region.observe(eventName.toLowerCase(), method);
  }
});

var TouchSelectionObserver = Class.create(SelectionObserver, {
  registerObservers: function() {
    this.handleEvent("TouchStart");
    this.handleEvent("TouchMove");
    this.handleEvent("TouchEnd");
  },

  onTouchStart: function(event) {
    var element = event.findElement();
    if (this.elementBelongsToActiveSelection(element)) return;

    var selectable = this.findSelectableFromElement(element);

    if (selectable) {
      this.x = event.touches[0].pageX;
      this.y = event.touches[0].pageY;
      this.prepareSelection(selectable);
    } else {
      this.deactivateSelection();
    }
  },

  onTouchMove: function(event) {
    var element = event.findElement();

    if (this.elementBelongsToPendingSelection(element)) {
      this.cancelPendingSelection();
    }
  },

  onTouchEnd: function(event) {
    var element = event.findElement();

    if (this.elementBelongsToPendingSelection(element)) {
      this.activatePendingSelection({ offset: new Element.Offset(this.x, this.y) });
    }
  }
});
document.observe("keypress", function(event) {
  var textarea = event.findElement("textarea.submits_on_return");
  if (textarea && event.keyCode == Event.KEY_RETURN && !event.shiftKey) {
    var form = textarea.up("form");
    form.onsubmit ? form.onsubmit() : form.submit();
    event.stop();
  }
});
document.observe("dom:loaded", function() {
  var button;
  
  $(document.body).observe("mousedown", function(event) {
    var element = event.findElement("button.image_button");
    if (element) {
      button = element;
      button.addClassName("pressed");
      event.stop();
    }
  });
  
  $(document.body).observe("mouseup", function(event) {
    if (button) {
      var element = event.findElement("button.image_button");
      if (!element) {
        event.stop();
      }
      button.removeClassName("pressed");
      button = null;
    }
  });
  
  $(document.body).observe("mouseover", function(event) {
    if (button) {
      var element = event.findElement("button.image_button");
      if (element) {
        button.addClassName("pressed");
      } else {
        button.removeClassName("pressed");
      }
    }
  });
});


var Popup = {
  showForActivator: function(activator) {
    var popup = this.findForElement(activator);
    if (!popup.visible()) {
      this.positionNearElement(popup, activator);
      this.show(popup);
    }
  },

  hideForDeactivator: function(deactivator) {
    var popup = this.findForElement(deactivator);
    if (popup.visible()) {
      this.hide(popup);
    }
  },
  
  findForElement: function(element) {
    return $(element.readAttribute("popup"));
  },
  
  positionNearElement: function(popup, element) {
    var position = element.readAttribute("popup_position") || "top left"
    popup.positionInViewportAt(popup.getOffsetRelativeToElement(element, position));
  },
  
  show: function(popup) {
    popup.show();
  },
  
  hide: function(popup) {
    popup.hide();
  }
};

document.observe("dom:loaded", function() {
  $(document.body).observe("click", function(event) {
    var element = event.findElement(".popup_activator");
    if (element) {
      Popup.showForActivator(element);
      event.stop();
    }
  });
  
  $(document.body).observe("click", function(event) {
    var element = event.findElement(".popup_deactivator");
    if (element) {
      Popup.hideForDeactivator(element);
      event.stop();
    }
  });
});
var SelectAllCheckbox = Class.create({
  initialize: function(aggregator, container) {
    this.aggregator = $(aggregator);
    this.container  = container ? $(container) : this.aggregator.up("form");
    this.updateAggregator();
    
    this.container.observe("click", function(event) {
      var element = event.findElement("input[type=checkbox]");
      if (element) this.onCheckboxClicked(event, element);
    }.bind(this));
  },
  
  onCheckboxClicked: function(event, element) {
    if (element == this.aggregator) {
      this.setAllCheckboxes(element.checked);
    } else {
      this.updateAggregator();
    }
  },
  
  getCheckboxes: function() {
    return this.checkboxes = this.checkboxes ||
      this.container.select("input[type=checkbox]").without(this.aggregator);
  },
  
  updateAggregator: function() {
    this.aggregator.checked = this.getAggregateValue();
  },
  
  getAggregateValue: function() {
    return this.getCheckboxes().all(function(element) { return element.checked });
  },

  setAllCheckboxes: function(value) {
    this.getCheckboxes().each(function(element) { element.checked = value });
  }
});
Object.extend(Date.prototype, (function() {
  var shortWeekdays = $w("Sun Mon Tue Wed Thu Fri Sat");
  var longWeekdays  = $w("Sunday Monday Tuesday Wednesday Thursday Friday Saturday");
  var shortMonths   = $w("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec");
  var longMonths    = $w("January February March April May June July August September October November December");

  function pad(num) { 
    return num.toPaddedString(2);
  }

  return {
    strftime: function(formatString) {
      var day     = this.getDay(),
          date    = this.getDate(),
          month   = this.getMonth(),
          year    = this.getFullYear(),
          hours   = this.getHours(),
          minutes = this.getMinutes(),
          seconds = this.getSeconds();

      function format(modifier) {
        switch (modifier) {
          case "%": return "%";
          case "a": return shortWeekdays[day];
          case "A": return longWeekdays[day];
          case "b": return shortMonths[month];
          case "B": return longMonths[month];
          case "c": return this;
          case "d": return pad(date);
          case "e": return date;
          case "H": return pad(hours);
          case "I": return pad(format("l"));
          case "l": return (hours === 12 || hours === 0) ? 12 : (hours + 12) % 12;
          case "m": return pad(month + 1);
          case "M": return pad(minutes);
          case "p": return hours > 11 ? "PM" : "AM";
          case "S": return pad(seconds);
          case "w": return day;
          case "y": return pad(year % 100);
          case "Y": return year;
        }
      }

      return formatString.gsub(/%([%aAbBcdeHIlmMpSwyY])/, function(matches) {
        return format(matches[1]).toString();
      }.bind(this));
    }
  };
})());


var DuplicateIdWatchdog = {
  interval:   1000,
  duplicates: $H(),
  
  watch: function() {
    if (this.timer) return;

    this.timer = setInterval(function() {
      if (DuplicateIdWatchdog.running) return;
      DuplicateIdWatchdog.running = true;
      var elements = $$("*[id]"), ids = $H(), duplicates = $H();
      
      elements.backgroundEach(function(element) {
        if (!element.id) return;  // ignore id=""
        
        if (ids.get(element.id)) {
          if (duplicates.get(element.id)) {
            duplicates.get(element.id).push(element);
          } else {
            duplicates.set(element.id, [ids.get(element.id), element]);
          }
          return true;
        }
        ids.set(element.id, element);
      }).after(function() {
        DuplicateIdWatchdog.running = false;
        DuplicateIdWatchdog.notify(duplicates);
      });
      
    }, DuplicateIdWatchdog.interval);
  },
  
  notify: function(duplicates) {
    duplicates.each(function(match) {
      var id = match.key, elements = match.value;
      var previousElements = DuplicateIdWatchdog.duplicates.get(id) || [];

      if (elements.length != previousElements.length) {
        var message = elements.length.toString() + " elements with id=" + id.inspect() + ":";
        console.warn.apply(console, [message].concat(elements));
      }
    });
    DuplicateIdWatchdog.duplicates = duplicates;
  },
  
  stopWatching: function() {
    if (this.timer) {
      setInterval(this.timer);
      this.timer = false;
    }
  }
};
Effect.Blend = Class.create();
Object.extend(Effect.Blend.prototype, Effect.Base.prototype);
Object.extend(Effect.Blend.prototype, {
  initialize: function(element, options) {
    this.element = $(element);
    options = Object.extend({
      invert: false,
      from: 0.0,
      to: 1.0
    }, options || {});
    this.start(options);
  },
  
  setup: function() {
    this.setOpacityByPosition(this.options.from);
  },
  
  update: function(position) {
    this.setOpacityByPosition(position);
  },
  
  finish: function() {
    this.setOpacityByPosition(this.options.to);
  },
  
  setOpacityByPosition: function(position) {
    var opacity = this.options.invert ? 1.0 - position : position;
    this.element.setOpacity(opacity);
  }
});
Effect.Height = Class.create();
Object.extend(Effect.Height.prototype, Effect.Base.prototype);
Object.extend(Effect.Height.prototype, {
  initialize: function(element, options) {
    this.element = $(element);
    options = Object.extend({
      from: this.element.getHeight(),
      to: 0
    }, options || {});
    this.start(options);
  },
  
  setup: function() {
    this.setHeight(this.options.from);
  },
  
  update: function(position) {
    this.setHeight(position);
  },
  
  finish: function() {
    this.setHeight(this.options.to);
  },
  
  setHeight: function(height) {
    this.element.style.height = parseInt(height) + "px";
  }
});

Element.addMethods({
  autofocus: function(element) {
    element = $(element);
    var field;
    if (field = element.down(".autofocus")) {
      (function() { try { field.focus() } catch (e) { } }).defer();
    }
    return element;
  }
});
Element.addMethods({
  forceVisibility: function(element, callback) {
    var hiddenParents = [];
    while (element = $(element)) {
      if (element.visible && !element.visible())
        hiddenParents.push(element.show());
      element = element.parentNode;
    }
    
    try {
      callback();
    } catch (e) {
      throw e;
    } finally {
      hiddenParents.invoke("hide");
    }
  }
});


Element.Layer = Class.create({
  initialize: function(elements, activeElement, pointer) {
    this.elements      = elements;
    this.activeElement = activeElement;
    this.container     = this.elements[0].up();
    this.index         = this.elements.indexOf(activeElement);
    this.styles        = [];
    this.offsets       = [];
    this.dimensions    = [];
    
    this.setPointerOffset(pointer);
    this.analyzeElements();
    this.analyzeContainer();
  },
  
  freeze: function() {
    if (this.frozen) return;
    this.lockElements();
    this.bringToFront(this.activeElement);
    this.frozen = true;
  },
  
  thaw: function() {
    if (!this.frozen) return;
    this.unlockElements();
    this.unlockContainer();
    this.frozen = false;
  },
  
  translate: function(pointer) {
    var left = pointer.x - this.containerOffset.left;
    var top  = pointer.y - this.containerOffset.top;
    return { left: left, top: top };
  },
  
  translatePointer: function(pointer) {
    var left = pointer.x - this.pointerOffset.x;
    var top  = pointer.y - this.pointerOffset.y;
    return { left: left, top: top };
  },
  
  // -- private --
  
  setPointerOffset: function(pointer) {
    if (pointer) {
      var positionedOffset = this.activeElement.positionedOffset();
      this.pointerOffset = {
        x: pointer.x - this.activeElement.offsetLeft,
        y: pointer.y - this.activeElement.offsetTop
      };
    } else {
      this.pointerOffset = { x: 0, y: 0 };
    }
  },

  analyzeElements: function() {
    var elements = this.elements, length = elements.length, i;
    for (i = 0; i < length; i++) {
      this.rememberStylesFor(elements[i], i);
      this.rememberOffsetsFor(elements[i], i);
      this.rememberDimensionsFor(elements[i], i);
    }
  },
  
  analyzeContainer: function() {
    var container = this.elements[0].up();
    this.containerOffset = container.cumulativeOffset();
    this.containerOffset.top += container.measure("padding-top");
    this.containerOffset.left += container.measure("padding-left");
    this.containerStyles = container.style.cssText;

    container.setStyle({
      width:    container.measure("width") + "px",
      height:   container.measure("height") + "px",
      zoom:     1
    });
  },
  
  bringToFront: function(element) {
    element.setStyle({ zIndex: 1001 });
  },
  
  lockElements: function() {
    var elements = this.elements, length = elements.length, i;
    for (i = 0; i < length; i++) {
      this.lockIntoPlace(elements[i], i);
    }
  },
  
  unlockElements: function() {
    var elements = this.elements, length = elements.length, i;
    for (i = 0; i < length; i++) {
      this.restoreStylesFor(elements[i], i);
    }
  },
  
  unlockContainer: function() {
    this.container.style.cssText = this.containerStyles;
    this.containerStyles = "";
  },
  
  rememberStylesFor: function(element, index) {
    this.styles[index] = element.style.cssText;
  },
  
  rememberOffsetsFor: function(element, index) {
    this.offsets[index] = element.positionedOffset();
  },
  
  rememberDimensionsFor: function(element, index) {
    this.dimensions[index] = {
      width:  element.measure("padding-box-width"),
      height: element.measure("padding-box-height")
    };
  },
  
  restoreStylesFor: function(element, index) {
    element.style.cssText = this.styles[index];
  },
  
  lockIntoPlace: function(element, index) {
    var offsets = this.offsets[index];
    
    element.setStyle({
      position: "absolute",
      left:     offsets.left + "px",
      top:      offsets.top + "px",
      width:    element.measure("width") + "px",
      height:   element.measure("height") + "px",
      zIndex:   1000
    });
  }
});
(function() {
  
  // Converts a CSS percentage value to a decimal.
  // Ex: toDecimal("30%"); // -> 0.3
  function toDecimal(pctString) {
    var match = pctString.match(/^(\d+)%?$/i);
    if (!match) return null;
    return (Number(match[1]) / 100);
  }
  
  // Can be called like this:
  //   getPixelValue("11px");
  // Or like this:
  //   getPixelValue(someElement, 'paddingTop');  
  function getPixelValue(value, property) {
    if (Object.isElement(value)) {
      element = value;
      value = element.getStyle(property);
    }
    if (value === null) {
      return null;
    }

    // Non-IE browsers will always return pixels.
    if ((/^\d+(px)?$/i).test(value)) {
      return window.parseInt(value, 10);      
    }
    
    // When IE gives us something other than a pixel value, this technique
    // (invented by Dean Edwards) will convert it to pixels.
    if (/\d/.test(value) && element.runtimeStyle) {
      var style = element.style.left, rStyle = element.runtimeStyle.left; 
      element.runtimeStyle.left = element.currentStyle.left;
      element.style.left = value || 0;  
      value = element.style.pixelLeft;
      element.style.left = style;
      element.runtimeStyle.left = rStyle;
      
      return value;
    }
    
    // For other browsers, we have to do a bit of work.
    if (value.include('%')) {
      var decimal = toDecimal(value);
      var whole;
      if (property.include('left') || property.include('right') ||
       property.include('width')) {
        whole = $(element.parentNode).measure('width');
      } else if (property.include('top') || property.include('bottom') ||
       property.include('height')) {
        whole = $(element.parentNode).measure('height');
      }
      
      return whole * decimal;
    }
    
    // If we get this far, we should probably give up.
    return 0;
  }
  
  function toCSSPixels(number) {
    if (Object.isString(number) && number.endsWith('px')) {
      return number;
    }    
    return number + 'px';    
  }
  
  function isDisplayed(element) {
    var originalElement = element;    
    while (element && element.parentNode) {
      var display = element.getStyle('display');
      if (display === 'none') {
        return false;
      }
      element = $(element.parentNode);
    }    
    return true;
  }
  
  /**
   *  class Element.Layout < Hash
   *  
   *  A set of key/value pairs representing measurements of various
   *  dimensions of an element.
  **/
  Element.Layout = Class.create(Hash, {
    initialize: function($super, element, preCompute) {
      $super();      
      this.element = $(element);
      // The 'preCompute' boolean tells us whether we should fetch all values
      // at once. If so, we should do setup/teardown only once. We set a flag
      // so that we can ignore calls to `_begin` and `_end` elsewhere.
      if (preCompute) {
        this._preComputing = true;
        this._begin();
      }
      Element.Layout.PROPERTIES.each( function(property) {
        if (preCompute) {
          this._compute(property);
        } else {
          this._set(property, null);
        }
      }, this);
      if (preCompute) {
        this._end();
        this._preComputing = false;
      }
    },
    
    _set: function(property, value) {
      return Hash.prototype.set.call(this, property, value);
    },
    
    set: function(property, value) {
      if (Element.Layout.COMPOSITE_PROPERTIES.include(property)) {
        throw "Cannot set a composite property.";
      }
      
      return this._set(property, toCSSPixels(value));
    },
    
    get: function($super, property) {
      // Try to fetch from the cache.
      var value = $super(property);      
      return value === null ? this._compute(property) : value;
    },
    
    // `_begin` and `_end` are two functions that are called internally 
    // before and after any measurement is done. In certain conditions (e.g.,
    // when hidden), elements need a "preparation" phase that ensures
    // accuracy of measurements.
    _begin: function() {
      if (this._prepared) return;      

      var element = this.element;
      if (isDisplayed(element)) {
        this._prepared = true;
        return;
      }
      
      // Remember the original values for some styles we're going to alter.
      var originalStyles = {
        position:   element.style.position   || '',
        width:      element.style.width      || '',
        visibility: element.style.visibility || '',
        display:    element.style.display    || ''
      };
      
      // We store them so that the `_end` function can retrieve them later.
      element.store('prototype_original_styles', originalStyles);
      
      var position = element.getStyle('position'),
       width = element.getStyle('width');
       
      element.setStyle({
        position:   'absolute',
        visibility: 'hidden',
        display:    'block'
      });
      
      var positionedWidth = element.getStyle('width');
      
      var newWidth;
      if (width && (positionedWidth === width)) {
        // If the element's width is the same both before and after
        // we set absolute positioning, that means:
        //  (a) it was already absolutely-positioned; or
        //  (b) it has an explicitly-set width, instead of width: auto.
        // Either way, it means the element is the width it needs to be
        // in order to report an accurate height.
        newWidth = window.parseInt(width, 10);
      } else if (width && (position === 'absolute' || position === 'fixed')) {
        newWidth = window.parseInt(width, 10);
      } else {
        // If not, that means the element's width depends upon the width of
        // its parent.
        var parent = element.parentNode, pLayout = $(parent).getLayout();
        
        
        newWidth = pLayout.get('width') -
         this.get('margin-left') -
         this.get('border-left') -
         this.get('padding-left') -
         this.get('padding-right') -
         this.get('border-right') -
         this.get('margin-right');
      }
      
      element.setStyle({ width: newWidth + 'px' });
      
      // The element is now ready for measuring.
      this._prepared = true;
    },
    
    _end: function() {
      var element = this.element;
      var originalStyles = element.retrieve('prototype_original_styles');
      element.store('prototype_original_styles', null);      
      element.setStyle(originalStyles);
      this._prepared = false;
    },
    
    _compute: function(property) {
      var COMPUTATIONS = Element.Layout.COMPUTATIONS;
      if (!(property in COMPUTATIONS)) {
        throw "Property not found.";
      }
      
      var value = COMPUTATIONS[property].call(this, this.element);
      this._set(property, value);
      return value;
    }    
  });
  
  Object.extend(Element.Layout, {
    // All measurable properties.
    PROPERTIES: $w('height width top left right bottom border-left border-right border-top border-bottom padding-left padding-right padding-top padding-bottom margin-top margin-bottom margin-left margin-right padding-box-width padding-box-height border-box-width border-box-height margin-box-width margin-box-height'),
    
    // Sums of other properties. Can be read but not written.
    COMPOSITE_PROPERTIES: $w('padding-box-width padding-box-height margin-box-width margin-box-height border-box-width border-box-height'),
    
    COMPUTATIONS: {
      'height': function(element) {
        if (!this._preComputing) this._begin();
        
        var bHeight = this.get('border-box-height');        
        if (bHeight <= 0) return 0;
        
        var bTop = this.get('border-top'),
         bBottom = this.get('border-bottom');
         
        var pTop = this.get('padding-top'),
         pBottom = this.get('padding-bottom');
         
        if (!this._preComputing) this._end();
        
        return bHeight - bTop - bBottom - pTop - pBottom;
      },
      
      'width': function(element) {
        if (!this._preComputing) this._begin();
        
        var bWidth = this.get('border-box-width');
        if (bWidth <= 0) return 0;

        var bLeft = this.get('border-left'),
         bRight = this.get('border-right');

        var pLeft = this.get('padding-left'),
         pRight = this.get('padding-right');
        
        if (!this._preComputing) this._end();
        
        return bWidth - bLeft - bRight - pLeft - pRight;
      },
      
      'padding-box-height': function(element) {
        var height = this.get('height'),
         pTop = this.get('padding-top'),
         pBottom = this.get('padding-bottom');
         
        return height + pTop + pBottom;
      },

      'padding-box-width': function(element) {
        var width = this.get('width'),
         pLeft = this.get('padding-left'),
         pRight = this.get('padding-right');
         
        return width + pLeft + pRight;
      },
      
      'border-box-height': function(element) {
        return element.offsetHeight;
      },
            
      'border-box-width': function(element) {
        return element.offsetWidth;
      },
      
      'margin-box-height': function(element) {
        var bHeight = this.get('border-box-height'),
         mTop = this.get('margin-top'),
         mBottom = this.get('margin-bottom');
         
        if (bHeight <= 0) return 0;
         
        return bHeight + mTop + mBottom;        
      },

      'margin-box-width': function(element) {
        var bWidth = this.get('border-box-width'),
         mLeft = this.get('margin-left'),
         mRight = this.get('margin-right');

        if (bWidth <= 0) return 0;
         
        return bWidth + mLeft + mRight;
      },
      
      'top': function(element) {
        return getPixelValue(element, 'top');
      },
      
      'bottom': function(element) {
        return getPixelValue(element, 'bottom');
      },
      
      'left': function(element) {
        return getPixelValue(element, 'left');
      },
      
      'right': function(element) {
        return getPixelValue(element, 'right');
      },
      
      'padding-top': function(element) {
        return getPixelValue(element, 'paddingTop');
      },
      
      'padding-bottom': function(element) {
        return getPixelValue(element, 'paddingBottom');
      },
      
      'padding-left': function(element) {
        return getPixelValue(element, 'paddingLeft');
      },
      
      'padding-right': function(element) {
        return getPixelValue(element, 'paddingRight');
      },
      
      'border-top': function(element) {
        return Object.isNumber(element.clientTop) ? element.clientTop : 
         getPixelValue(element, 'borderTopWidth');
      },
      
      'border-bottom': function(element) {
        return Object.isNumber(element.clientBottom) ? element.clientBottom : 
         getPixelValue(element, 'borderBottomWidth');
      },
      
      'border-left': function(element) {
        return Object.isNumber(element.clientLeft) ? element.clientLeft : 
         getPixelValue(element, 'borderLeftWidth');
      },
      
      'border-right': function(element) {
        return Object.isNumber(element.clientRight) ? element.clientRight : 
         getPixelValue(element, 'borderRightWidth');
      },
      
      'margin-top': function(element) {
        return getPixelValue(element, 'marginTop');
      },
      
      'margin-bottom': function(element) {
        return getPixelValue(element, 'marginBottom');
      },
      
      'margin-left': function(element) {
        return getPixelValue(element, 'marginLeft');
      },
      
      'margin-right': function(element) {
        return getPixelValue(element, 'marginRight');
      }
    }
  });
  
  /**
   *  class Element.Offset
   *  
   *  A representation of the top- and left-offsets of an element relative to
   *  another.
  **/
  Element.Offset = Class.create({
    /**
     *  new Element.Offset(left, top)
     *  
     *  Instantiates an [[Element.Offset]]. You shouldn't need to call this
     *  directly.
    **/
    initialize: function(left, top) {
      this.left = left.round();
      this.top  = top.round();
      
      // Act like an array.
      this[0] = this.left;
      this[1] = this.top;
    },
    
    /**
     *  Element.Offset#relativeTo(offset) -> Element.Offset
     *  - offset (Element.Offset): Another offset to compare to.
     *  
     *  Returns a new [[Element.Offset]] with its origin at the given
     *  `offset`. Useful for determining an element's distance from another
     *  arbitrary element.
    **/
    relativeTo: function(offset) {
      return new Element.Offset(
        this.left - offset.left, 
        this.top  - offset.top
      );
    },
    
    /**
     *  Element.Offset#inspect() -> String
    **/
    inspect: function() {
      return "#<Element.Offset left: #{left} top: #{top}".interpolate(this);
    },
    
    /**
     *  Element.Offset#toArray() -> Array
    **/
    toArray: function() {
      return [this.left, this.top];
    }
  });
  
  /**
   *  Element.getLayout(@element) -> Element.Layout
   *  
   *  Returns an instance of [[Element.Layout]] for measuring an element's
   *  dimensions.
   *  
   *  Note that this method returns a _new_ `Element.Layout` object each time
   *  it's called. If you want to take advantage of measurement caching,
   *  retain a reference to one `Element.Layout` object, rather than calling
   *  `Element.getLayout` whenever you need a measurement. You should call
   *  `Element.getLayout` again only when the values in an existing 
   *  `Element.Layout` object have become outdated.
  **/
  function getLayout(element) {
    return new Element.Layout(element);
  }
    
  /**
   *  Element.measure(@element, property) -> Number
   *  
   *  Gives the pixel value of `element`'s dimension specified by
   *  `property`.
   *  
   *  Useful for one-off measurements of elements. If you find yourself
   *  calling this method frequently over short spans of code, you might want
   *  to call [[Element.getLayout]] and operate on the [[Element.Layout]]
   *  object itself (thereby taking advantage of measurement caching).
  **/
  function measure(element, property) {
    return $(element).getLayout().get(property);  
  }
  
  /**
   *  Element.cumulativeOffset(@element) -> Element.Offset
   *
   *  Returns the offsets of `element` from the top left corner of the
   *  document.
  **/
  function cumulativeOffset(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
    } while (element);
    return new Element.Offset(valueL, valueT);
  }
  
  /**
   *  Element.positionedOffset(@element) -> Element.Offset
   *
   *  Returns `element`'s offset relative to its closest positioned ancestor
   *  (the element that would be returned by [[Element.getOffsetParent]]).
  **/  
  function positionedOffset(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
      if (element) {
        if (element.tagName.toUpperCase() == 'BODY') break;
        var p = Element.getStyle(element, 'position');
        if (p !== 'static') break;
      }
    } while (element);
    return new Element.Offset(valueL, valueT);
  }

  /**
   *  Element.cumulativeScrollOffset(@element) -> Element.Offset
   *
   *  Calculates the cumulative scroll offset of an element in nested
   *  scrolling containers.
  **/
  function cumulativeScrollOffset(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.scrollTop  || 0;
      valueL += element.scrollLeft || 0;
      element = element.parentNode;
    } while (element);
    return new Element.Offset(valueL, valueT);
  }

  /**
   *  Element.viewportOffset(@element) -> Array
   *
   *  Returns the X/Y coordinates of element relative to the viewport.
  **/
  function viewportOffset(forElement) {
    var valueT = 0, valueL = 0;

    var element = forElement;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      // Safari fix
      if (element.offsetParent == document.body &&
        Element.getStyle(element, 'position') == 'absolute') break;
    } while (element = element.offsetParent);

    element = forElement;    
    var tagName = element.tagName, O = Prototype.Browser.Opera;
    do {
      if (!O || tagName && tagName.toUpperCase() === 'BODY') {
        valueT -= element.scrollTop  || 0;
        valueL -= element.scrollLeft || 0;
      }
    } while (element = element.parentNode);    
    return new Element.Offset(valueL, valueT);
  }
  
  Element.addMethods({
    getLayout:              getLayout,
    measure:                measure,
    cumulativeOffset:       cumulativeOffset,
    positionedOffset:       positionedOffset,
    cumulativeScrollOffset: cumulativeScrollOffset,
    viewportOffset:         viewportOffset
  });
  
  // If the browser supports the nonstandard `getBoundingClientRect`
  // (currently only IE and Firefox), it becomes far easier to obtain
  // true offsets.
  if ('getBoundingClientRectx' in document.documentElement) {
    Element.addMethods({
      viewportOffset: function(element) {
        element = $(element);
        var rect = element.getBoundingClientRect();
        return new Element.Offset(rect.left, rect.top);
      },
      
      cumulativeOffset: function(element) {
        element = $(element);
        var docOffset = $(document.documentElement).viewportOffset(),
          elementOffset = element.viewportOffset();
        return elementOffset.relativeTo(docOffset);
      },
            
      positionedOffset: function(element) {
        element = $(element);
        var parent = element.getOffsetParent();
        var isBody = (parent.nodeName.toUpperCase() === 'BODY');
        var eOffset = element.viewportOffset(),
          pOffset = isBody ? viewportOffset(parent) : parent.viewportOffset();
        return eOffset.relativeTo(pOffset);
      }
    });
  }  
})();
Element.addMethods({
  getMargins: function(element) {
    element = $(element);
    return {
      top:    parseInt(element.getStyle("margin-top")),
      right:  parseInt(element.getStyle("margin-right")),
      bottom: parseInt(element.getStyle("margin-bottom")),
      left:   parseInt(element.getStyle("margin-left"))
    };
  },
  
  getBounds: function(element) {
    element = $(element);
    var offset = element.cumulativeOffset()
    var top = parseInt(offset.top), left = parseInt(offset.left);
    var dimensions = element.getDimensions();
    
    return {
      top:    top,
      right:  left + dimensions.width,
      bottom: top + dimensions.height,
      left:   left,
      width:  dimensions.width,
      height: dimensions.height
    };
  },
  
  getOffsetRelativeToElement: function(element, otherElement, position) {
    element = $(element), otherElement = $(otherElement);
    var bounds = element.getBounds(), otherBounds = otherElement.getBounds();

    position = (position || "top left").strip().split(" ");
    var x = position[1], y = position[0];
    var left = otherBounds.left, top = otherBounds.top;
        
    switch (x) {
      case "right":  left += otherBounds.width - bounds.width; break;
      case "center": left += parseInt((otherBounds.width / 2) - (bounds.width / 2));
    }
    
    switch (y) {
      case "bottom": top += otherBounds.height - bounds.height; break;
      case "center": top += parseInt((otherBounds.height / 2) - (bounds.height / 2));
    }
    
    return {
      top: top, left: left
    }
  },
  
  positionInViewportAt: function(element, offset) {
    element = $(element);
    var margin = element.getMargins();
    var dimensions = element.getDimensions();
    
    var bottom = offset.top + dimensions.height + margin.bottom;
    var right = offset.left + dimensions.width + margin.right;
    
    var viewportOffset = document.viewport.getScrollOffsets();
    var viewportDimensions = document.viewport.getDimensions();
    var viewportBottom = viewportOffset.top + viewportDimensions.height;
    var viewportRight = viewportOffset.left + viewportDimensions.width;
    
    if (bottom > viewportBottom)
      offset.top = viewportBottom - dimensions.height - margin.top - margin.bottom;
    if (right > viewportRight)
      offset.left = viewportRight - dimensions.width - margin.left - margin.right;

    document.body.appendChild(element);
    element.setStyle({ position: "absolute", top: offset.top + "px", left: offset.left + "px" });
    return element;
  }
});
Element.addMethods({
  preservingScrollPosition: function(element, callback) {
    element = $(element);
    var offset = element.cumulativeOffset().top - document.viewport.getScrollOffsets().top;
    callback();
    window.scrollTo(0, element.cumulativeOffset().top - offset);
    return element;
  }
});



Element.ReorderLayer = Class.create(Element.Layer, {
  initialize: function($super, elements, activeElement, pointer) {
    if (elements.length < 2) {
      throw new Error("Element.ReorderLayer must have at least 2 elements");
    }

    $super(elements, activeElement, pointer);
    this.animations = [];
    this.determineAxis();
    this.prepareForReorder();
  },
  
  thaw: function($super) {
    $super();
    this.reorderElements();
  },
  
  thawWithAnimation: function(callback) {
    var index = this.reorderMapping[this.reorderIndex];
    var style = this.offsetAttribute + ":" + this.getActiveReorderOffset() + "px";

    this.animate(index, style, function() {
      this.thaw();
      callback();
    }.bind(this));
  },
  
  hasChangedOrder: function() {
    return this.reorderMapping.toString() != $R(0, this.elements.length - 1).toArray().toString();
  },
  
  translate: function($super, pointer) {
    var result = $super(pointer)[this.offsetAttribute];
    return Math.min(Math.max(0, result), this.maxOffset);
  },
  
  translatePointer: function($super, pointer) {
    var result = $super(pointer)[this.offsetAttribute];
    return Math.min(Math.max(0, result), this.maxReorderOffset);
  },
  
  getPreviousReorderThreshold: function() {
    return this.getPreviousReorderOffset() + Math.max(
      this.getExtent(this.reorderIndex - 1),
      this.getExtent(this.reorderIndex)
    );
  },
  
  getNextReorderThreshold: function() {
    return this.getActiveReorderOffset() + Math.max(
      this.getExtent(this.reorderIndex),
      this.getExtent(this.reorderIndex + 1)
    );
  },
  
  getPreviousReorderOffset: function() {
    return this.reorderOffsets[this.reorderIndex - 1];
  },
  
  getActiveReorderOffset: function() {
    return this.reorderOffsets[this.reorderIndex];
  },
  
  getNextReorderOffset: function() {
    return this.reorderOffsets[this.reorderIndex + 1];
  },
  
  swapActiveElementWithPrevious: function() {
    var index = this.reorderMapping[this.reorderIndex - 1];
    this.prepareForReorder(this.reorderIndex - 1);
    this.animateReorderToOffset(index, this.getNextReorderOffset());
  },
  
  swapActiveElementWithNext: function() {
    var index = this.reorderMapping[this.reorderIndex + 1];
    this.prepareForReorder(this.reorderIndex + 1);
    this.animateReorderToOffset(index, this.getPreviousReorderOffset());
  },
  
  moveActiveElementTo: function(offset) {
    this.activeElement.setStyle(this.offsetAttribute + ":" + offset + "px");
  },
  
  // -- private --
  
  determineAxis: function() {
    var offsets = this.offsets;

    if (offsets[0].left != offsets[1].left) {
      this.setAxis("x");
    } else if (offsets[0].top  != offsets[1].top) {
      this.setAxis("y");
    } else {
      throw new Error("Element.ReorderLayer couldn't determine axis");
    }
  },
  
  prepareForReorder: function(newReorderIndex) {
    if (this.reorderMapping) {
      this.reorderMapping.swap(this.reorderIndex, newReorderIndex);
      this.reorderIndex   = newReorderIndex;
    } else {
      this.reorderMapping = $R(0, this.elements.length - 1).toArray();
      this.reorderIndex   = this.index;
    }
    
    this.reorderOffsets   = this.getReorderOffsets();
    this.maxReorderOffset = this.reorderOffsets.last();
    this.maxOffset        = this.maxReorderOffset + this.getExtent(this.elements.length - 1);
  },
  
  reorderElements: function() {
    if (this.reorderIndex == this.index) return;

    if (this.reorderIndex == 0) {
      this.elements[this.reorderMapping[1]].insert({ before: this.activeElement });
    } else {
      this.elements[this.reorderMapping[this.reorderIndex - 1]].insert({ after: this.activeElement });
    }
  },
  
  setAxis: function(axis) {
    this.axis = axis;
    
    if (axis == "x") {
      this.extentAttribute = "width";
      this.offsetAttribute = "left";
      
    } else if (axis == "y") {
      this.extentAttribute = "height";
      this.offsetAttribute = "top";
    }
  },
  
  animateReorderToOffset: function(index, offset) {
    this.animate(index, this.offsetAttribute + ":" + offset + "px");
  },
  
  getReorderOffsets: function() {
    var offsets = [], mapping = this.reorderMapping, length = mapping.length;
    var sum = this.container.measure("padding-" + this.offsetAttribute);

    for (var i = 0; i < length; i++) {
      offsets[i] = sum;
      sum += this.getExtent(mapping[i]);
    }
    return offsets;
  },
  
  getOffset: function(index) {
    var offsetPair = this.offsets[index];
    if (!offsetPair) return;
    return offsetPair[this.offsetAttribute];
  },
  
  getExtent: function(index) {
    var nextOffset = this.getOffset(index + 1);
    if (nextOffset) return nextOffset - this.getOffset(index);
    
    var extentPair = this.dimensions[index];
    if (!extentPair) return;
    return extentPair[this.extentAttribute];
  },
  
  animate: function(index, toStyle, callback) {
    if (this.animations[index]) this.animations[index].cancel();
    var element = this.elements[index];
    this.animations[index] = new Effect.Morph(element, {
      style: toStyle,
      duration: 0.2,
      afterFinish: function() {
        delete this.animations[index];
        if (callback) callback();
      }.bind(this)
    });
  }
});
Element.addMethods({
  slideIntoView: function(element, options) {
    element = $(element), options = options || {};

    var effect;
    var top = element.cumulativeOffset()[1], height = element.getHeight(), bottom = top + height;
    var viewTop = document.viewport.getScrollOffsets().top, viewHeight = document.viewport.getHeight(),
        viewBottom = viewTop + viewHeight;
        
    if (top < viewTop) {
      effect = new Effect.ScrollTo(element, Object.extend({ duration: 0.15 }, options));
    } else if (bottom > viewBottom) {
      effect = new Effect.ScrollTo(element, Object.extend({ duration: 0.15, offset: height - viewHeight }, options));
    }

    if (options.sync) return effect;
    return element;
  }
});
Element.addMethods({
  trace: function(element, expression) {
    element = $(element);
    if (element.match(expression)) return element;
    return element.up(expression);
  }
});



var Transitions = {
  animationEnabled: true
};

Element.addMethods({
  transition: function(element, change, options) {
    // Allow transition(options, change) as well as transition(change, options)
    if (typeof change == "object" && typeof options == "function")
      change = [change, options], options = change.shift(), change = change.shift();

    element = $(element);
    options = options || {};
    options.animate = options.animate !== false && Transitions.animationEnabled;
    options.fade = options.fade !== false;
    
    function finish() {
      (options.after || Prototype.K)();
    }

    function highlightAndFinish(destinationElement) {
      if (options.highlight) {
        var highlightElement = options.highlight === true ? destinationElement : ($(options.highlight) || destinationElement);
        new Effect.Highlight(highlightElement, { duration: 2, afterFinish: finish });
      } else {
        finish.defer();
      }
    }
    
    function cloneWithoutIDs(element) {
      element = $(element);
      var clone = element.cloneNode(true);
      clone.id = "";
      clone.getElementsBySelector("*[id]").each(function(e) { e.id = "" });
      return clone;
    }

    if (options.animate) {
      var transitionElement = new Element("div").setStyle({ position: "relative", overflow: "hidden" });
      element.insert({ before: transitionElement });
    
      var sourceElement = cloneWithoutIDs(element);
      var sourceElementWrapper = sourceElement.wrap("div");
      var destinationElementWrapper = element.wrap("div");
      transitionElement.appendChild(sourceElementWrapper);
      transitionElement.appendChild(destinationElementWrapper);
    }
    
    change(element);

    if (options.animate) {
      var sourceHeight = sourceElementWrapper.getHeight(), destinationHeight = destinationElementWrapper.getHeight();
      var sourceWidth  = sourceElementWrapper.getWidth(),  destinationWidth  = destinationElementWrapper.getWidth();
    
      var outerWrapper = new Element("div");
      transitionElement.insert({ before: outerWrapper });
      outerWrapper.setStyle({ overflow: "hidden", height: sourceHeight + "px"});
      outerWrapper.appendChild(transitionElement);
        
      var maxHeight = destinationHeight > sourceHeight ? destinationHeight : sourceHeight;
      transitionElement.setStyle({ height: maxHeight + "px" });
      sourceElementWrapper.setStyle({ position: "absolute", height: maxHeight + "px", width: sourceWidth + "px", top: 0, left: 0 });
      destinationElementWrapper.setStyle({ position: "absolute", height: maxHeight + "px", width: sourceWidth + "px", top: 0, left: 0, opacity: 0, zIndex: 2000 });
    
      var effects = [
        new Effect.Height(transitionElement, { sync: true, from: sourceHeight, to: destinationHeight }),
        new Effect.Blend(destinationElementWrapper, { sync: true })
      ];
      
      if (options.fade) {
        effects.push(new Effect.Blend(sourceElementWrapper, { invert: true, sync: true }));
        destinationElementWrapper.setStyle({ zIndex: 0 });
        sourceElementWrapper.setStyle({ zIndex: 2000 });
      }
      
      new Effect.Parallel(effects, {
        duration: options.duration || 0.3, 
      
        afterUpdate: function() {
          if (outerWrapper) {
            outerWrapper.insert({ before: transitionElement });
            outerWrapper.remove();
            outerWrapper = false;
          }
        },

        afterFinish: function() {
          var destinationElement = destinationElementWrapper.down();
          if (destinationElement)
            transitionElement.insert({ before: destinationElement });
          transitionElement.remove();
        
          highlightAndFinish(destinationElement);
        }
      });
    
    } else {
      highlightAndFinish(element);
    }

    return {
      after: function(after) {
        options.after = (options.after || Prototype.K).wrap(function(proceed) {
          proceed();
          after();
        });
        return this;
      }
    };
  }
});

Element.addMethods({
  upwards: function(element, iterator) {
    while (element = $(element)) {
      if (element.URL !== undefined) return;
      if (iterator(element)) return element;
      element = element.parentNode;
    }
  }
});
(function() {
  var queue = $A([]);
  function checkQueue() {
    if (queue.any())
      queue.pop().fire("dom:modified");
  }

  var notify;
  function deferFire(element) {
    if (!queue.include(element))
      queue.push(element);

    if (notify)
      window.clearTimeout(notify);
    notify = checkQueue.defer();
  }

  function fireModifiedEvent() {
    var args = $A(arguments), proceed = args.shift(), parent = $(args.first()).up();
    var element = proceed.apply(this, args);

    if (Object.isElement(element) && element.up("html")) {
      deferFire(element);
    } else if (Object.isElement(parent) && parent.up("html")) {
      deferFire(parent);
    }

    return element;
  }

  Element.addMethods({
    insert: Element.Methods.insert.wrap(fireModifiedEvent),
    replace: Element.Methods.replace.wrap(fireModifiedEvent),
    update: Element.Methods.update.wrap(fireModifiedEvent)
  });

  document.observe("dom:loaded", function() {
    Event.fire.defer(document.body, "dom:modified")
  });
})();
(function() {
  var focusInHandler = function(e) { e.findElement().fire("focus:in") };
  var focusOutHandler = function(e) { e.findElement().fire("focus:out") };

  if (document.addEventListener) {
    document.addEventListener("focus", focusInHandler, true);
    document.addEventListener("blur", focusOutHandler, true);
  } else {
    document.observe("focusin", focusInHandler);
    document.observe("focusout", focusOutHandler);
  }
})();
(function() {
  var tabHasFocus;
  var object, focusEventName, unfocusEventName;
  
  if (Prototype.Browser.IE) {
    object = document, focusEventName = "focusin", unfocusEventName = "focusout";
  } else if (Prototype.Browser.Gecko) {
    object = document, focusEventName = "focus", unfocusEventName = "blur";
  } else {
    object = window, focusEventName = "focus", unfocusEventName = "blur";
  }
  
  document.observe("dom:loaded", function() {
    notifyOfTabFocusChange(document.hasFocus());
  });
  
  Event.observe(object, focusEventName, function() {
    notifyOfTabFocusChange(true);
  });
  
  Event.observe(object, unfocusEventName, function() {
    notifyOfTabFocusChange(false);
  });
  
  function notifyOfTabFocusChange(hasFocus) {
    if (tabHasFocus !== hasFocus) {
      tabHasFocus = hasFocus;
      if (hasFocus) {
        document.fire("tab:focused");
      } else {
        document.fire("tab:unfocused");
      }
    }
  }
})();
(function() {
  var dimensions;

  document.observe("dom:loaded", function(event) { 
    dimensions = document.viewport.getDimensions();
  });

  Event.observe(window, "resize", function(event) {
    var newDimensions = document.viewport.getDimensions();
    // Swallow spurious window resize events in IE
    if (!dimensions || 
        dimensions.width != newDimensions.width || 
        dimensions.height != newDimensions.height) {
      document.fire("viewport:resized", { 
        dimensions:         newDimensions, 
        previousDimensions: dimensions 
      });
      dimensions = newDimensions;
    }
  });
})();
var BackgroundIteration = Class.create({
  initialize: function(iterator, produceNextValue) {
    this.iterator = iterator;
    this.produceNextValue = produceNextValue;
    this.callbacks = [];
    this.results = [];

    this.next = this.next.bind(this);
    this.next.defer();
  },
  
  next: function() {
    var value = {}, hasValue = this.produceNextValue(value);
    this.running = true;

    if (hasValue) {
      try {
        this.results.push(this.iterator(value.value));
        this.next.defer();
      } catch (exception) {
        this.exception = exception;
        this.end();
      }
    } else {
      this.end();
    }
  },
  
  end: function() {
    if (this.running) {
      this.running = false;
      this.callbacks.invoke("call", this);
    }
  },
  
  after: function(callback) {
    this.callbacks.push(callback);
    return this;
  }
});

Object.extend(Array.prototype, {
  backgroundEach: function(iterator) {
    var index = 0;
    return new BackgroundIteration(iterator, function(memo) {
      if (index == this.length) {
        return false;
      } else {
        memo.value = this[index++];
        return true;
      }
    }.bind(this));
  }
});
/**
*
*  Base64 encode / decode
*  http://www.webtoolkit.info/
*
**/

 
var Base64 = {
 
  // private property
  _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
 
  // public method for encoding
  encode : function (input) {
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;
 
    input = Base64._utf8_encode(input);
 
    while (i < input.length) {
 
      chr1 = input.charCodeAt(i++);
      chr2 = input.charCodeAt(i++);
      chr3 = input.charCodeAt(i++);
 
      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;
 
      if (isNaN(chr2)) {
        enc3 = enc4 = 64;
      } else if (isNaN(chr3)) {
        enc4 = 64;
      }
 
      output = output +
      this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
      this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
 
    }
 
    return output;
  },
 
  // public method for decoding
  decode : function (input) {
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;
 
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
 
    while (i < input.length) {
 
      enc1 = this._keyStr.indexOf(input.charAt(i++));
      enc2 = this._keyStr.indexOf(input.charAt(i++));
      enc3 = this._keyStr.indexOf(input.charAt(i++));
      enc4 = this._keyStr.indexOf(input.charAt(i++));
 
      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;
 
      output = output + String.fromCharCode(chr1);
 
      if (enc3 != 64) {
        output = output + String.fromCharCode(chr2);
      }
      if (enc4 != 64) {
        output = output + String.fromCharCode(chr3);
      }
 
    }
 
    output = Base64._utf8_decode(output);
 
    return output;
 
  },
 
  // private method for UTF-8 encoding
  _utf8_encode : function (string) {
    string = string.replace(/\r\n/g,"\n");
    var utftext = "";
 
    for (var n = 0; n < string.length; n++) {
 
      var c = string.charCodeAt(n);
 
      if (c < 128) {
        utftext += String.fromCharCode(c);
      }
      else if((c > 127) && (c < 2048)) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      }
      else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }
 
    }
 
    return utftext;
  },
 
  // private method for UTF-8 decoding
  _utf8_decode : function (utftext) {
    var string = "";
    var i = 0;
    var c = c1 = c2 = 0;
 
    while ( i < utftext.length ) {
 
      c = utftext.charCodeAt(i);
 
      if (c < 128) {
        string += String.fromCharCode(c);
        i++;
      }
      else if((c > 191) && (c < 224)) {
        c2 = utftext.charCodeAt(i+1);
        string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
        i += 2;
      }
      else {
        c2 = utftext.charCodeAt(i+1);
        c3 = utftext.charCodeAt(i+2);
        string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
        i += 3;
      }
 
    }
 
    return string;
  }
 
};

var Cookie = {
  get: function(name) {
    var cookie = document.cookie.match(new RegExp('(^|;)\\s*' + escape(name) + '=([^;\\s]*)'));
    return (cookie ? unescape(cookie[2]) : null);
  },
  
  set: function(name, value, daysToExpire) {
    var attrs = '; path=/';
    if (daysToExpire != undefined) {
      var d = new Date();
      d.setTime(d.getTime() + (86400000 * parseFloat(daysToExpire)));
      attrs += '; expires=' + d.toGMTString();
    }
    return (document.cookie = escape(name) + '=' + escape(value || '') + attrs);
  },
  
  remove: function(name) {
    var cookie = Cookie.get(name) || true;
    Cookie.set(name, '', -1);
    return cookie;
  }
};
function preload() {
  var all = $$('link[href*="/all.css"]'), protocol = '', domain = '';

  if (all.length > 0) {
    url = all.first().readAttribute('href').match(/^(.*?:)(\/\/.*?)\//);
    if (url) protocol = url[1], domain = url[2];
  }

  $A(arguments).each(function(path) {
    var src = protocol + domain + path;
    new Image().src = src;
  });
}
;
/**
*
*  Secure Hash Algorithm (SHA1)
*  http://www.webtoolkit.info/
*
**/

 
function SHA1 (msg) {
 
  function rotate_left(n,s) {
    var t4 = ( n<<s ) | (n>>>(32-s));
    return t4;
  };
 
  function lsb_hex(val) {
    var str="";
    var i;
    var vh;
    var vl;
 
    for( i=0; i<=6; i+=2 ) {
      vh = (val>>>(i*4+4))&0x0f;
      vl = (val>>>(i*4))&0x0f;
      str += vh.toString(16) + vl.toString(16);
    }
    return str;
  };
 
  function cvt_hex(val) {
    var str="";
    var i;
    var v;
 
    for( i=7; i>=0; i-- ) {
      v = (val>>>(i*4))&0x0f;
      str += v.toString(16);
    }
    return str;
  };
 
 
  function Utf8Encode(string) {
    string = string.replace(/\r\n/g,"\n");
    var utftext = "";
 
    for (var n = 0; n < string.length; n++) {
 
      var c = string.charCodeAt(n);
 
      if (c < 128) {
        utftext += String.fromCharCode(c);
      }
      else if((c > 127) && (c < 2048)) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      }
      else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }
 
    }
 
    return utftext;
  };
 
  var blockstart;
  var i, j;
  var W = new Array(80);
  var H0 = 0x67452301;
  var H1 = 0xEFCDAB89;
  var H2 = 0x98BADCFE;
  var H3 = 0x10325476;
  var H4 = 0xC3D2E1F0;
  var A, B, C, D, E;
  var temp;
 
  msg = Utf8Encode(msg);
 
  var msg_len = msg.length;
 
  var word_array = new Array();
  for( i=0; i<msg_len-3; i+=4 ) {
    j = msg.charCodeAt(i)<<24 | msg.charCodeAt(i+1)<<16 |
    msg.charCodeAt(i+2)<<8 | msg.charCodeAt(i+3);
    word_array.push( j );
  }
 
  switch( msg_len % 4 ) {
    case 0:
      i = 0x080000000;
    break;
    case 1:
      i = msg.charCodeAt(msg_len-1)<<24 | 0x0800000;
    break;
 
    case 2:
      i = msg.charCodeAt(msg_len-2)<<24 | msg.charCodeAt(msg_len-1)<<16 | 0x08000;
    break;
 
    case 3:
      i = msg.charCodeAt(msg_len-3)<<24 | msg.charCodeAt(msg_len-2)<<16 | msg.charCodeAt(msg_len-1)<<8  | 0x80;
    break;
  }
 
  word_array.push( i );
 
  while( (word_array.length % 16) != 14 ) word_array.push( 0 );
 
  word_array.push( msg_len>>>29 );
  word_array.push( (msg_len<<3)&0x0ffffffff );
 
 
  for ( blockstart=0; blockstart<word_array.length; blockstart+=16 ) {
 
    for( i=0; i<16; i++ ) W[i] = word_array[blockstart+i];
    for( i=16; i<=79; i++ ) W[i] = rotate_left(W[i-3] ^ W[i-8] ^ W[i-14] ^ W[i-16], 1);
 
    A = H0;
    B = H1;
    C = H2;
    D = H3;
    E = H4;
 
    for( i= 0; i<=19; i++ ) {
      temp = (rotate_left(A,5) + ((B&C) | (~B&D)) + E + W[i] + 0x5A827999) & 0x0ffffffff;
      E = D;
      D = C;
      C = rotate_left(B,30);
      B = A;
      A = temp;
    }
 
    for( i=20; i<=39; i++ ) {
      temp = (rotate_left(A,5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0x0ffffffff;
      E = D;
      D = C;
      C = rotate_left(B,30);
      B = A;
      A = temp;
    }
 
    for( i=40; i<=59; i++ ) {
      temp = (rotate_left(A,5) + ((B&C) | (B&D) | (C&D)) + E + W[i] + 0x8F1BBCDC) & 0x0ffffffff;
      E = D;
      D = C;
      C = rotate_left(B,30);
      B = A;
      A = temp;
    }
 
    for( i=60; i<=79; i++ ) {
      temp = (rotate_left(A,5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0x0ffffffff;
      E = D;
      D = C;
      C = rotate_left(B,30);
      B = A;
      A = temp;
    }
 
    H0 = (H0 + A) & 0x0ffffffff;
    H1 = (H1 + B) & 0x0ffffffff;
    H2 = (H2 + C) & 0x0ffffffff;
    H3 = (H3 + D) & 0x0ffffffff;
    H4 = (H4 + E) & 0x0ffffffff;
 
  }
 
  var temp = cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4);
 
  return temp.toLowerCase();
 
}
;


if (Prototype.Browser.IE) {
  window._prompt = window.prompt;
  window.prompt = function(text, value) {
    var self = arguments.callee;

    if (self.useModalDialog) {
      text = (text || "").toString(), value = (value || "").toString();
      return window.showModalDialog("/ie7_prompt_fix.html",
        { title: document.title, text: text.escapeHTML(), value: value.escapeHTML() },
        "dialogHeight:150px;dialogWidth:400px;scroll:no;status:no"
      );

    } else {
      var time = new Date().getTime(), result = window._prompt(text, value);
      if (new Date().getTime() - time < 10) {
        self.useModalDialog = true;
        result = self(text, value);
      }
      return result;
    }
  };
}
;
// Fix Safari's tendency to cut-off background colors

if (Prototype.Browser.WebKit) {
  document.observe("dom:loaded", function() {
    document.documentElement.setStyle({
      backgroundColor: document.body.getStyle("backgroundColor")
    });
  });
}
;
(function() {
  var propertiesToCopy = $A(['fontSize', 'fontStyle', 'fontWeight', 'fontFamily', 'lineHeight']);

  function valueDimensions(element, dimension) {
    element = $(element);

    var dimensions;
    var div = new Element('div');

    dimensions = $(element).getDimensions();

    if (dimension == 'height') {
      div.setStyle({ width: dimensions.width + 'px' });
    } else if (dimension == 'width') {
      div.setStyle({ height: dimensions.height + 'px' });
    }

    var styles = {}
    propertiesToCopy.each(function(property) {
      styles[property] = $(element).getStyle(property);
    })
    div.setStyle(styles)

    div.setStyle({ position: 'absolute', display: 'none' });
    div.update(element.getValue());

    $(document.body).insert(div);
    dimensions = div.getDimensions();
    div.remove();

    return dimensions[dimension];
  }

  var methods = {
    valueDimensions: valueDimensions
  };

  Element.addMethods("INPUT", methods);
  Element.addMethods("TEXTAREA", methods);
})();


var Placeholder = {
  supported: function() {
    var i = document.createElement('input');
    return 'placeholder' in i;
  },

  reset: function(input) {
    input.value = input.readAttribute('placeholder');
    input.addClassName('placeholder');
  },

  setup: function(input) {
    Placeholder.reset(input);
  },

  teardown: function(input) {
    Placeholder.focus(input);
  },

  clear: function(input) {
    input.value = '';
    input.removeClassName('placeholder');
  },

  focus: function(input) {
    if (input.hasClassName('placeholder') &&
        input.value == input.readAttribute('placeholder'))
      Placeholder.clear(input);
  },

  blur: function(input) {
    if (input.value.blank())
      Placeholder.reset(input)
  }
};

document.observe('dom:loaded', function() {
  if (!Placeholder.supported()) {
    $$('input[placeholder]').each(Placeholder.reset);

    $(document.body).observe('focus:in', function(event) {
      var input = event.findElement('input[placeholder]');
      if (input) Placeholder.focus(input);
    });

    $(document.body).observe('focus:out', function(event) {
      var input = event.findElement('input[placeholder]');
      if (input) Placeholder.blur(input);
    });

    $(document.body).observe('submit', function(event) {
      event.element().select('input[placeholder]').each(Placeholder.teardown);
    });
  }
});
Placeholder.Overlay = {
  wrap: function(input) {
    if (!input)
      return $$('input.overlayable').each(Placeholder.Overlay.wrap);

    input = $(input);

    if (input.overlay) return;
    input.overlay = true;

    var wrapper = new Element('span', { 'class': 'overlay_wrapper' });
    input.parentNode.replaceChild(wrapper, input);
    wrapper.appendChild(input);

    input.label = new Element('label', { 'for': input.id, 'class': 'overlabel' });
    input.label.update(input.title);
    input.insert({ before: input.label });

    Placeholder.Overlay.reset(input);
  },

  reset: function(input) {
    if (input.value.blank())
      input.label.show();
    else
      input.label.hide();
  },

  focus: function(input) {
    if (input.value.blank())
      input.label.addClassName('focus');
  },

  blur: function(input) {
    if (input.value.blank()) {
      input.label.removeClassName('focus');
      input.label.show();
    }
  }
};

document.observe('dom:loaded', function() {
  document.observe('focus:in', function(event) {
    var input = event.findElement('.overlayable')
    if (input) Placeholder.Overlay.focus(input);
  });

  document.observe('focus:out', function(event) {
    var input = event.findElement('.overlayable')
    if (input) Placeholder.Overlay.blur(input);
  });

  document.observe('keypress', function(event) {
    if (event.keyCode == Event.KEY_TAB) return;
    var input = event.findElement('.overlayable')
    if (input) input.label.hide();
  });

  Placeholder.Overlay.wrap();

  // Autocomplete fields need polling
  $$('input.overlayable[autocomplete=on]').each(function(input) {
    Placeholder.Overlay.reset(input);

    new Form.Element.Observer(input, 0.2, function() {
      Placeholder.Overlay.reset(input);
    });
  });
});
(function() {
  function getElementInfo(element) {
    element = $(element);
    if (!element.getValue) return {};
    return { name: element.tagName, type: element.readAttribute("type"), value: element.getValue() };
  }

  function restoreElementInfo(oldElements, element) {
    var elementInfo = getElementInfo(element);
    if (!elementInfo) return;

    for (var i = 0; i < oldElements.length; i++) {
      var oldElementInfo = oldElements[i];
      if (elementInfo.name == oldElementInfo.name && elementInfo.type == oldElementInfo.type) {
        $(element).setValue(oldElementInfo.value);
        oldElements[i] = {};
        break;
      }
    }
  }

  Element.addMethods("form", {
    preservingValues: function(element, callback) {
      element = $(element);
      var oldElements = $A(element.elements).map(getElementInfo);
      callback();
      $A(element.elements).each(restoreElementInfo.curry(oldElements));
      return element;
    }
  });
})();
var DimZum = {
  Version: "0.1"
};
DimZum.Controller = Class.create({
  initialize: function(options) {
    this.options = options || { };
    this.prefix  = options.prefix || "z";
    this.active  = false;

    document.observe("anchor:changed", this.onAnchorChanged.bind(this));
    document.observe("shade:clicked", this.onShadeClicked.bind(this));
    document.observe("viewport:resized", this.onViewportResized.bind(this));
  },

  getShade: function() {
    return this.shade = this.shade || new DimZum.Shade(this.options.shade);
  },

  getWindow: function() {
    return this.window = this.window || new DimZum.Window(this.options.window);
  },
  
  onAnchorChanged: function(event) {
    if (this.isActableAnchor(event.memo.to)) {
      var elements = this.getElementsFromAnchor(event.memo.to);
      this.showElement(elements.first());
      
    } else {
      this.hideActiveElement();
    }
  },
  
  onShadeClicked: function(event) {
    this.close();
  },

  onViewportResized: function(event) {
    if (this.active) {
      this.getShade().resizeElement();
      this.getWindow().repositionWindow();
    }
  },
  
  isActableAnchor: function(anchor) {
    var components = (anchor || "").split("/");
    if (components[0] != this.prefix) return false;
    if (!$(components[1])) return false;
    return true;
  },
  
  getElementsFromAnchor: function(anchor) {
    return anchor.split("/").slice(1).map(function(id) { return $(id) });
  },
  
  showElement: function(element) {
    if (!this.active) this.getShade().show();
    this.getWindow().showWithContents(element);
    this.active = true;
  },
  
  hideActiveElement: function() {
    if (this.active) {
      this.getWindow().hide();
      this.getShade().hide();
      this.active = false;
    }
  },
  
  close: function() {
    window.location.hash = "#/";
  }
});
DimZum.Shade = Class.create({
  initialize: function(options) {
    this.options = options || { };
    this.createElement();
    $(document.body).insert(this.element);
    this.element.observe("click", this.onClick.bind(this));
  },
  
  show: function() {
    this.resizeElement();
    this.element.show();
  },
  
  hide: function() {
    this.element.hide();
  },
  
  createElement: function() {
    this.element = new Element("div").hide();
    this.element.setStyle({ 
      position:   "absolute", 
      top:        0,
      left:       0,
      background: this.options.background || "#000", 
      opacity:    this.options.opacity || 0.50,
      zIndex:     this.options.zIndex || 1000
    });
  },
  
  resizeElement: function() {
    var dimensions = $(document.body).getDimensions();
    this.element.setStyle({ 
      width:  dimensions.width + "px", 
      height: dimensions.height + "px"
    });
  },
  
  onClick: function(event) {
    this.element.fire("shade:clicked", { shade: this });
  }
});
DimZum.Window = Class.create({
  initialize: function(options) {
    this.options = options || { };
    this.createElements();
    $(document.body).insert(this.element);
  },
  
  createElements: function() {
    this.element = new Element("div").hide();
    this.element.addClassName(this.options.className || "dim_zum_window");
    this.element.setStyle({ 
      position: "absolute", 
      top:      0,
      left:     0,
      zIndex:   this.options.zIndex || 2000
    });
    
    this.viewport = new Element("div").addClassName("viewport");
    this.element.insert(this.viewport);
    
    this.controls = this.options.controls || 
      new Element("div").update('<a href="#/">Close</a>');
    this.controls.show().addClassName("controls");
    this.element.insert(this.controls);
  },
  
  showWithContents: function(contentElement) {
    this.adoptContents(contentElement);
    this.repositionWindow();
    this.element.show();
  },
  
  adoptContents: function(contentElement) {
    this.releaseContents();
    this.contents = contentElement;
    this.viewport.insert(this.contents);
    this.contents.show();
  },
  
  releaseContents: function() {
    if (this.contents) {
      this.contents.hide();
      document.body.insert(this.contents);
      this.contents = null;
    }
  },
  
  repositionWindow: function() {
    var windowDimensions   = this.element.getDimensions();
    var viewportDimensions = document.viewport.getDimensions();
    var viewportOffsets    = document.viewport.getScrollOffsets();
    
    var left = viewportDimensions.width / 2 - windowDimensions.width / 2;
    var top  = viewportDimensions.height / 2 - windowDimensions.height / 2;

    this.element.setStyle({
      left: viewportOffsets.left + left + "px",
      top:  viewportOffsets.top + top + "px"
    });
  },
  
  hide: function() {
    this.releaseContents();
    this.element.hide();
  }
});
/*  WysiHat - WYSIWYG JavaScript framework, version 0.2.1
 *  (c) 2008-2010 Joshua Peek
 *
 *  WysiHat is freely distributable under the terms of an MIT-style license.
 *--------------------------------------------------------------------------*/

/**
 * == wysihat ==
**/

/** section: wysihat
 * WysiHat
**/

var WysiHat = {};



/* When the user clicks on the button,
toggle between hiding and showing the dropdown content */
function toggleCategories() {
document.getElementById("categoriesDropdown").classList.toggle("show");
document.getElementsByClassName("dropbtn").classList.toggle("caret");
}

// function toggleCaret() {
//   document.getElementsByClassName("dropbtn").classList.toggle("caret");
// }


// Close the dropdown if the user clicks outside of it
window.onclick = function(event) {
if (!event.target.matches('.dropbtn')) {

var dropdowns = document.getElementsByClassName("dropdown-content");
var i;
for (i = 0; i < dropdowns.length; i++) {
  var openDropdown = dropdowns[i];
  if (openDropdown.classList.contains('show')) {
    openDropdown.classList.remove('show');
  }
 }
}
}
;
/** section: wysihat
 * WysiHat.Editor
**/

WysiHat.Editor = {
  /** section: wysihat
   *  WysiHat.Editor.attach(textarea) -> undefined
   *  - textarea (String | Element): an id or DOM node of the textarea that
   *    you want to convert to rich text.
   *
   *  Creates a new editor for the textarea.
  **/
  attach: function(textarea) {
    var editArea;

    textarea = $(textarea);

    var id = textarea.id + '_editor';
    if (editArea = $(id)) return editArea;

    editArea = new Element('div', {
      'id': id,
      'class': 'editor',
      'contentEditable': 'true'
    });

    editArea.update(WysiHat.Formatting.getBrowserMarkupFrom(textarea.value));

    Object.extend(editArea, WysiHat.Commands);

    textarea.insert({before: editArea});
    textarea.hide();

    // WysiHat.BrowserFeatures.run()

    return editArea;
  }
};
WysiHat.BrowserFeatures = (function() {
  function createTmpIframe(callback) {
    var frame, frameDocument;

    frame = new Element('iframe');
    frame.setStyle({
      position: 'absolute',
      left: '-1000px'
    });

    frame.onFrameLoaded(function() {
      if (typeof frame.contentDocument !== 'undefined') {
        frameDocument = frame.contentDocument;
      } else if (typeof frame.contentWindow !== 'undefined' && typeof frame.contentWindow.document !== 'undefined') {
        frameDocument = frame.contentWindow.document;
      }

      frameDocument.designMode = 'on';

      callback(frameDocument);

      frame.remove();
    });

    $(document.body).insert(frame);
  }

  var features = {};

  function detectParagraphType(document) {
    document.body.innerHTML = '';
    document.execCommand('insertparagraph', false, null);

    var tagName;
    element = document.body.childNodes[0];
    if (element && element.tagName)
      tagName = element.tagName.toLowerCase();

    if (tagName == 'div')
      features.paragraphType = "div";
    else if (document.body.innerHTML == "<p><br></p>")
      features.paragraphType = "br";
    else
      features.paragraphType = "p";
  }

  function detectIndentType(document) {
    document.body.innerHTML = 'tab';
    document.execCommand('indent', false, null);

    var tagName;
    element = document.body.childNodes[0];
    if (element && element.tagName)
      tagName = element.tagName.toLowerCase();
    features.indentInsertsBlockquote = (tagName == 'blockquote');
  }

  features.run = function run() {
    if (features.finished) return;

    createTmpIframe(function(document) {
      detectParagraphType(document);
      detectIndentType(document);

      features.finished = true;
    });
  }

  return features;
})();



/** section: wysihat
 *  mixin WysiHat.Commands
 *
 *  Methods will be mixed into the editor element. Most of these
 *  methods will be used to bind to button clicks or key presses.
 *
 *  var editor = WysiHat.Editor.attach(textarea);
 *  $('bold_button').on('click', function(event) {
 *    editor.boldSelection();
 *    event.stop();
 *  });
 *
 *  In this example, it is important to stop the click event so you don't
 *  lose your current selection.
**/

WysiHat.Commands = (function(window) {
  /**
   *  WysiHat.Commands#boldSelection() -> undefined
   *
   *  Bolds the current selection.
  **/
  function boldSelection() {
    this.execCommand('bold', false, null);
  }

  /**
   *  WysiHat.Commands#boldSelected() -> boolean
   *
   *  Check if current selection is bold or strong.
  **/
  function boldSelected() {
    return this.queryCommandState('bold');
  }

  /**
   *  WysiHat.Commands#underlineSelection() -> undefined
   *
   *  Underlines the current selection.
  **/
  function underlineSelection() {
    this.execCommand('underline', false, null);
  }

  /**
   *  WysiHat.Commands#underlineSelected() -> boolean
   *
   *  Check if current selection is underlined.
  **/
  function underlineSelected() {
    return this.queryCommandState('underline');
  }

  /**
   *  WysiHat.Commands#italicSelection() -> undefined
   *
   *  Italicizes the current selection.
  **/
  function italicSelection() {
    this.execCommand('italic', false, null);
  }

  /**
   *  WysiHat.Commands#italicSelected() -> boolean
   *
   *  Check if current selection is italic or emphasized.
  **/
  function italicSelected() {
    return this.queryCommandState('italic');
  }

  /**
   *  WysiHat.Commands#italicSelection() -> undefined
   *
   *  Strikethroughs the current selection.
  **/
  function strikethroughSelection() {
    this.execCommand('strikethrough', false, null);
  }

  /**
   *  WysiHat.Commands#indentSelection() -> undefined
   *
   *  Indents the current selection.
  **/
  function indentSelection() {
    // TODO: Should use feature detection
    if (Prototype.Browser.Gecko) {
      var selection, range, node, blockquote;

      selection = window.getSelection();
      range     = selection.getRangeAt(0);
      node      = selection.getNode();

      if (range.collapsed) {
        range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      blockquote = new Element('blockquote');
      range = selection.getRangeAt(0);
      range.surroundContents(blockquote);
    } else {
      this.execCommand('indent', false, null);
    }
  }

  /**
   *  WysiHat.Commands#outdentSelection() -> undefined
   *
   *  Outdents the current selection.
  **/
  function outdentSelection() {
    this.execCommand('outdent', false, null);
  }

  /**
   *  WysiHat.Commands#toggleIndentation() -> undefined
   *
   *  Toggles indentation the current selection.
  **/
  function toggleIndentation() {
    if (this.indentSelected()) {
      this.outdentSelection();
    } else {
      this.indentSelection();
    }
  }

  /**
   *  WysiHat.Commands#indentSelected() -> boolean
   *
   *  Check if current selection is indented.
  **/
  function indentSelected() {
    var node = window.getSelection().getNode();
    return node.match("blockquote, blockquote *");
  }

  /**
   * WysiHat.Commands#fontSelection(font) -> undefined
   *
   * Sets the font for the current selection
  **/
  function fontSelection(font) {
    this.execCommand('fontname', false, font);
  }

  /**
   * WysiHat.Commands#fontSizeSelection(fontSize) -> undefined
   * - font size (int) : font size for selection
   *
   * Sets the font size for the current selection
  **/
  function fontSizeSelection(fontSize) {
    this.execCommand('fontsize', false, fontSize);
  }

  /**
   *  WysiHat.Commands#colorSelection(color) -> undefined
   *  - color (String): a color name or hexadecimal value
   *
   *  Sets the foreground color of the current selection.
  **/
  function colorSelection(color) {
    this.execCommand('forecolor', false, color);
  }

  /**
   *  WysiHat.Commands#backgroundColorSelection(color) -> undefined
   *  - color (string) - a color or hexadecimal value
   *
   * Sets the background color.  Firefox will fill in the background
   * color of the entire iframe unless hilitecolor is used.
  **/
  function backgroundColorSelection(color) {
    if(Prototype.Browser.Gecko) {
      this.execCommand('hilitecolor', false, color);
    } else {
      this.execCommand('backcolor', false, color);
    }
  }

  /**
   *  WysiHat.Commands#alignSelection(color) -> undefined
   *  - alignment (string) - how the text should be aligned (left, center, right)
   *
  **/
  function alignSelection(alignment) {
    this.execCommand('justify' + alignment);
  }

  /**
   *  WysiHat.Commands#backgroundColorSelected() -> alignment
   *
   *  Returns the alignment of the selected text area
  **/
  function alignSelected() {
    var node = window.getSelection().getNode();
    return Element.getStyle(node, 'textAlign');
  }

  /**
   *  WysiHat.Commands#linkSelection(url) -> undefined
   *  - url (String): value for href
   *
   *  Wraps the current selection in a link.
  **/
  function linkSelection(url) {
    this.execCommand('createLink', false, url);
  }

  /**
   *  WysiHat.Commands#unlinkSelection() -> undefined
   *
   *  Selects the entire link at the cursor and removes it
  **/
  function unlinkSelection() {
    var node = window.getSelection().getNode();
    if (this.linkSelected())
      window.getSelection().selectNode(node);

    this.execCommand('unlink', false, null);
  }

  /**
   *  WysiHat.Commands#linkSelected() -> boolean
   *
   *  Check if current selection is link.
  **/
  function linkSelected() {
    var node = window.getSelection().getNode();
    return node ? node.tagName.toUpperCase() == 'A' : false;
  }

  /**
   *  WysiHat.Commands#formatblockSelection(element) -> undefined
   *  - element (String): the type of element you want to wrap your selection
   *    with (like 'h1' or 'p').
   *
   *  Wraps the current selection in a header or paragraph.
  **/
  function formatblockSelection(element){
    this.execCommand('formatblock', false, element);
  }

  /**
   *  WysiHat.Commands#toggleOrderedList() -> undefined
   *
   *  Formats current selection as an ordered list. If the selection is empty
   *  a new list is inserted.
   *
   *  If the selection is already a ordered list, the entire list
   *  will be toggled. However, toggling the last item of the list
   *  will only affect that item, not the entire list.
  **/
  function toggleOrderedList() {
    var selection, node;

    selection = window.getSelection();
    node      = selection.getNode();

    if (this.orderedListSelected() && !node.match("ol li:last-child, ol li:last-child *")) {
      selection.selectNode(node.up("ol"));
    } else if (this.unorderedListSelected()) {
      // Toggle list type
      selection.selectNode(node.up("ul"));
    }

    this.execCommand('insertorderedlist', false, null);
  }

  /**
   *  WysiHat.Commands#insertOrderedList() -> undefined
   *
   *  Alias for WysiHat.Commands#toggleOrderedList
  **/
  function insertOrderedList() {
    this.toggleOrderedList();
  }

  /**
   *  WysiHat.Commands#orderedListSelected() -> boolean
   *
   *  Check if current selection is within an ordered list.
  **/
  function orderedListSelected() {
    var element = window.getSelection().getNode();
    if (element) return element.match('*[contenteditable=""] ol, *[contenteditable=true] ol, *[contenteditable=""] ol *, *[contenteditable=true] ol *');
    return false;
  }

  /**
   *  WysiHat.Commands#toggleUnorderedList() -> undefined
   *
   *  Formats current selection as an unordered list. If the selection is empty
   *  a new list is inserted.
   *
   *  If the selection is already a unordered list, the entire list
   *  will be toggled. However, toggling the last item of the list
   *  will only affect that item, not the entire list.
  **/
  function toggleUnorderedList() {
    var selection, node;

    selection = window.getSelection();
    node      = selection.getNode();

    if (this.unorderedListSelected() && !node.match("ul li:last-child, ul li:last-child *")) {
      selection.selectNode(node.up("ul"));
    } else if (this.orderedListSelected()) {
      // Toggle list type
      selection.selectNode(node.up("ol"));
    }

    this.execCommand('insertunorderedlist', false, null);
  }

  /**
   *  WysiHat.Commands#insertUnorderedList() -> undefined
   *
   *  Alias for WysiHat.Commands#toggleUnorderedList()
  **/
  function insertUnorderedList() {
    this.toggleUnorderedList();
  }

  /**
   *  WysiHat.Commands#unorderedListSelected() -> boolean
   *
   *  Check if current selection is within an unordered list.
  **/
  function unorderedListSelected() {
    var element = window.getSelection().getNode();
    if (element) return element.match('*[contenteditable=""] ul, *[contenteditable=true] ul, *[contenteditable=""] ul *, *[contenteditable=true] ul *');
    return false;
  }

  /**
   *  WysiHat.Commands#insertImage(url) -> undefined
   *
   *  - url (String): value for src
   *  Insert an image at the insertion point with the given url.
  **/
  function insertImage(url) {
    this.execCommand('insertImage', false, url);
  }

  /**
   *  WysiHat.Commands#insertHTML(html) -> undefined
   *
   *  - html (String): HTML or plain text
   *  Insert HTML at the insertion point.
  **/
  function insertHTML(html) {
    if (Prototype.Browser.IE) {
      var range = window.document.selection.createRange();
      range.pasteHTML(html);
      range.collapse(false);
      range.select();
    } else {
      this.execCommand('insertHTML', false, html);
    }
  }

  /**
   *  WysiHat.Commands#execCommand(command[, ui = false][, value = null]) -> undefined
   *  - command (String): Command to execute
   *  - ui (Boolean): Boolean flag for showing UI. Currenty this not
   *    implemented by any browser. Just use false.
   *  - value (String): Value to pass to command
   *
   *  A simple delegation method to the documents execCommand method.
  **/
  function execCommand(command, ui, value) {
    var handler = this.commands.get(command);
    if (handler) {
      handler.bind(this)(value);
    } else {
      try {
        window.document.execCommand(command, ui, value);
      } catch(e) { return null; }
    }

    document.activeElement.fire("field:change");
  }

  /**
   *  WysiHat.Commands#queryCommandState(state) -> Boolean
   *  - state (String): bold, italic, underline, etc
   *
   *  A delegation method to the document's queryCommandState method.
   *
   *  Custom states handlers can be added to the queryCommands hash,
   *  which will be checked before calling the native queryCommandState
   *  command.
   *
   *  editor.queryCommands.set("link", editor.linkSelected);
  **/
  function queryCommandState(state) {
    var handler = this.queryCommands.get(state);
    if (handler) {
      return handler.bind(this)();
    } else {
      try {
        return window.document.queryCommandState(state);
      } catch(e) { return null; }
    }
  }

  /**
   *  WysiHat.Commands#getSelectedStyles() -> Hash
   *
   *  Fetches the styles (from the styleSelectors hash) from the current
   *  selection and returns it as a hash
  **/
  function getSelectedStyles() {
    var styles = $H({});
    var editor = this;
    editor.styleSelectors.each(function(style){
      var node = editor.selection.getNode();
      styles.set(style.first(), Element.getStyle(node, style.last()));
    });
    return styles;
  }

  return {
     boldSelection:            boldSelection,
     boldSelected:             boldSelected,
     underlineSelection:       underlineSelection,
     underlineSelected:        underlineSelected,
     italicSelection:          italicSelection,
     italicSelected:           italicSelected,
     strikethroughSelection:   strikethroughSelection,
     indentSelection:          indentSelection,
     outdentSelection:         outdentSelection,
     toggleIndentation:        toggleIndentation,
     indentSelected:           indentSelected,
     fontSelection:            fontSelection,
     fontSizeSelection:        fontSizeSelection,
     colorSelection:           colorSelection,
     backgroundColorSelection: backgroundColorSelection,
     alignSelection:           alignSelection,
     alignSelected:            alignSelected,
     linkSelection:            linkSelection,
     unlinkSelection:          unlinkSelection,
     linkSelected:             linkSelected,
     formatblockSelection:     formatblockSelection,
     toggleOrderedList:        toggleOrderedList,
     insertOrderedList:        insertOrderedList,
     orderedListSelected:      orderedListSelected,
     toggleUnorderedList:      toggleUnorderedList,
     insertUnorderedList:      insertUnorderedList,
     unorderedListSelected:    unorderedListSelected,
     insertImage:              insertImage,
     insertHTML:               insertHTML,
     execCommand:              execCommand,
     queryCommandState:        queryCommandState,
     getSelectedStyles:        getSelectedStyles,

    commands: $H({}),

    queryCommands: $H({
      link:          linkSelected,
      orderedlist:   orderedListSelected,
      unorderedlist: unorderedListSelected
    }),

    styleSelectors: $H({
      fontname:    'fontFamily',
      fontsize:    'fontSize',
      forecolor:   'color',
      hilitecolor: 'backgroundColor',
      backcolor:   'backgroundColor'
    })
  };
})(window);


if (Prototype.Browser.IE) {
  Object.extend(Selection.prototype, (function() {
    function setBookmark() {
      var bookmark = $('bookmark');
      if (bookmark) bookmark.remove();

      bookmark = new Element('span', { 'id': 'bookmark' }).update("&nbsp;");
      var parent = new Element('div');
      parent.appendChild(bookmark);

      var range = this._document.selection.createRange();
      range.collapse();
      range.pasteHTML(parent.innerHTML);
    }

    function moveToBookmark() {
      var bookmark = $('bookmark');
      if (!bookmark) return;

      var range = this._document.selection.createRange();
      range.moveToElementText(bookmark);
      range.collapse();
      range.select();

      bookmark.remove();
    }

    return {
      setBookmark:    setBookmark,
      moveToBookmark: moveToBookmark
    }
  })());
} else {
  Object.extend(Selection.prototype, (function() {
    function setBookmark() {
      var bookmark = $('bookmark');
      if (bookmark) bookmark.remove();

      bookmark = new Element('span', { 'id': 'bookmark' }).update("&nbsp;");
      this.getRangeAt(0).insertNode(bookmark);
    }

    function moveToBookmark() {
      var bookmark = $('bookmark');
      if (!bookmark) return;

      var range = document.createRange();
      range.setStartBefore(bookmark);
      this.removeAllRanges();
      this.addRange(range);

      bookmark.remove();
    }

    return {
      setBookmark:    setBookmark,
      moveToBookmark: moveToBookmark
    }
  })());
}
;
/*  IE Selection and Range classes
 *
 *  Original created by Tim Cameron Ryan
 *    http://github.com/timcameronryan/IERange
 *  Copyright (c) 2009 Tim Cameron Ryan
 *  Released under the MIT/X License
 *
 *  Modified by Joshua Peek
 */

if (!window.getSelection) {
  // TODO: Move this object into a closure
  var DOMUtils = {
    isDataNode: function(node) {
      try {
        return node && node.nodeValue !== null && node.data !== null;
      } catch (e) {
        return false;
      }
    },
    isAncestorOf: function(parent, node) {
      if (!parent) return false;
      return !DOMUtils.isDataNode(parent) &&
          (parent.contains(DOMUtils.isDataNode(node) ? node.parentNode : node) ||
          node.parentNode == parent);
    },
    isAncestorOrSelf: function(root, node) {
      return DOMUtils.isAncestorOf(root, node) || root == node;
    },
    findClosestAncestor: function(root, node) {
      if (DOMUtils.isAncestorOf(root, node))
        while (node && node.parentNode != root)
          node = node.parentNode;
      return node;
    },
    getNodeLength: function(node) {
      return DOMUtils.isDataNode(node) ? node.length : node.childNodes.length;
    },
    splitDataNode: function(node, offset) {
      if (!DOMUtils.isDataNode(node))
        return false;
      var newNode = node.cloneNode(false);
      node.deleteData(offset, node.length);
      newNode.deleteData(0, offset);
      node.parentNode.insertBefore(newNode, node.nextSibling);
    }
  };

  window.Range = (function() {
    function Range(document) {
      // save document parameter
      this._document = document;

      // initialize range
      this.startContainer = this.endContainer = document.body;
      this.endOffset = DOMUtils.getNodeLength(document.body);
    }
    Range.START_TO_START = 0;
    Range.START_TO_END = 1;
    Range.END_TO_END = 2;
    Range.END_TO_START = 3;

    function findChildPosition(node) {
      for (var i = 0; node = node.previousSibling; i++)
        continue;
      return i;
    }

    Range.prototype = {
      startContainer: null,
      startOffset: 0,
      endContainer: null,
      endOffset: 0,
      commonAncestorContainer: null,
      collapsed: false,
      _document: null,

      _toTextRange: function() {
        function adoptEndPoint(textRange, domRange, bStart) {
          // find anchor node and offset
          var container = domRange[bStart ? 'startContainer' : 'endContainer'];
          var offset = domRange[bStart ? 'startOffset' : 'endOffset'], textOffset = 0;
          var anchorNode = DOMUtils.isDataNode(container) ? container : container.childNodes[offset];
          var anchorParent = DOMUtils.isDataNode(container) ? container.parentNode : container;

          // visible data nodes need a text offset
          if (container.nodeType == 3 || container.nodeType == 4)
            textOffset = offset;

          // create a cursor element node to position range (since we can't select text nodes)
          var cursorNode = domRange._document.createElement('a');
          if (anchorNode)
            anchorParent.insertBefore(cursorNode, anchorNode);
          else
            anchorParent.appendChild(cursorNode);
          var cursor = domRange._document.body.createTextRange();
          cursor.moveToElementText(cursorNode);
          cursorNode.parentNode.removeChild(cursorNode);

          // move range
          textRange.setEndPoint(bStart ? 'StartToStart' : 'EndToStart', cursor);
          textRange[bStart ? 'moveStart' : 'moveEnd']('character', textOffset);
        }

        // return an IE text range
        var textRange = this._document.body.createTextRange();
        adoptEndPoint(textRange, this, true);
        adoptEndPoint(textRange, this, false);
        return textRange;
      },

      _refreshProperties: function() {
        // collapsed attribute
        this.collapsed = (this.startContainer == this.endContainer && this.startOffset == this.endOffset);
        // find common ancestor
        var node = this.startContainer;
        while (node && node != this.endContainer && !DOMUtils.isAncestorOf(node, this.endContainer))
          node = node.parentNode;
        this.commonAncestorContainer = node;
      },

      setStart: function(container, offset) {
        this.startContainer = container;
        this.startOffset = offset;
        this._refreshProperties();
      },
      setEnd: function(container, offset) {
        this.endContainer = container;
        this.endOffset = offset;
        this._refreshProperties();
      },
      setStartBefore: function(refNode) {
        // set start to beore this node
        this.setStart(refNode.parentNode, findChildPosition(refNode));
      },
      setStartAfter: function(refNode) {
        // select next sibling
        this.setStart(refNode.parentNode, findChildPosition(refNode) + 1);
      },
      setEndBefore: function(refNode) {
        // set end to beore this node
        this.setEnd(refNode.parentNode, findChildPosition(refNode));
      },
      setEndAfter: function(refNode) {
        // select next sibling
        this.setEnd(refNode.parentNode, findChildPosition(refNode) + 1);
      },
      selectNode: function(refNode) {
        this.setStartBefore(refNode);
        this.setEndAfter(refNode);
      },
      selectNodeContents: function(refNode) {
        this.setStart(refNode, 0);
        this.setEnd(refNode, DOMUtils.getNodeLength(refNode));
      },
      collapse: function(toStart) {
        if (toStart)
          this.setEnd(this.startContainer, this.startOffset);
        else
          this.setStart(this.endContainer, this.endOffset);
      },

      cloneContents: function() {
        // clone subtree
        return (function cloneSubtree(iterator) {
          for (var node, frag = document.createDocumentFragment(); node = iterator.next(); ) {
            node = node.cloneNode(!iterator.hasPartialSubtree());
            if (iterator.hasPartialSubtree())
              node.appendChild(cloneSubtree(iterator.getSubtreeIterator()));
            frag.appendChild(node);
          }
          return frag;
        })(new RangeIterator(this));
      },
      extractContents: function() {
        // cache range and move anchor points
        var range = this.cloneRange();
        if (this.startContainer != this.commonAncestorContainer)
          this.setStartAfter(DOMUtils.findClosestAncestor(this.commonAncestorContainer, this.startContainer));
        this.collapse(true);
        // extract range
        return (function extractSubtree(iterator) {
          for (var node, frag = document.createDocumentFragment(); node = iterator.next(); ) {
            iterator.hasPartialSubtree() ? node = node.cloneNode(false) : iterator.remove();
            if (iterator.hasPartialSubtree())
              node.appendChild(extractSubtree(iterator.getSubtreeIterator()));
            frag.appendChild(node);
          }
          return frag;
        })(new RangeIterator(range));
      },
      deleteContents: function() {
        // cache range and move anchor points
        var range = this.cloneRange();
        if (this.startContainer != this.commonAncestorContainer)
          this.setStartAfter(DOMUtils.findClosestAncestor(this.commonAncestorContainer, this.startContainer));
        this.collapse(true);
        // delete range
        (function deleteSubtree(iterator) {
          while (iterator.next())
            iterator.hasPartialSubtree() ? deleteSubtree(iterator.getSubtreeIterator()) : iterator.remove();
        })(new RangeIterator(range));
      },
      insertNode: function(newNode) {
        // set original anchor and insert node
        if (DOMUtils.isDataNode(this.startContainer)) {
          DOMUtils.splitDataNode(this.startContainer, this.startOffset);
          this.startContainer.parentNode.insertBefore(newNode, this.startContainer.nextSibling);
        } else {
          var offsetNode = this.startContainer.childNodes[this.startOffset];
          if (offsetNode) {
            this.startContainer.insertBefore(newNode, offsetNode);
          } else {
            this.startContainer.appendChild(newNode);
          }
        }
        // resync start anchor
        this.setStart(this.startContainer, this.startOffset);
      },
      surroundContents: function(newNode) {
        // extract and surround contents
        var content = this.extractContents();
        this.insertNode(newNode);
        newNode.appendChild(content);
        this.selectNode(newNode);
      },

      compareBoundaryPoints: function(how, sourceRange) {
        // get anchors
        var containerA, offsetA, containerB, offsetB;
        switch (how) {
            case Range.START_TO_START:
            case Range.START_TO_END:
          containerA = this.startContainer;
          offsetA = this.startOffset;
          break;
            case Range.END_TO_END:
            case Range.END_TO_START:
          containerA = this.endContainer;
          offsetA = this.endOffset;
          break;
        }
        switch (how) {
            case Range.START_TO_START:
            case Range.END_TO_START:
          containerB = sourceRange.startContainer;
          offsetB = sourceRange.startOffset;
          break;
            case Range.START_TO_END:
            case Range.END_TO_END:
          containerB = sourceRange.endContainer;
          offsetB = sourceRange.endOffset;
          break;
        }

        // compare
        return containerA.sourceIndex < containerB.sourceIndex ? -1 :
            containerA.sourceIndex == containerB.sourceIndex ?
                offsetA < offsetB ? -1 : offsetA == offsetB ? 0 : 1
                : 1;
      },
      cloneRange: function() {
        // return cloned range
        var range = new Range(this._document);
        range.setStart(this.startContainer, this.startOffset);
        range.setEnd(this.endContainer, this.endOffset);
        return range;
      },
      detach: function() {
      },
      toString: function() {
        return this._toTextRange().text;
      },
      createContextualFragment: function(tagString) {
        // parse the tag string in a context node
        var content = (DOMUtils.isDataNode(this.startContainer) ? this.startContainer.parentNode : this.startContainer).cloneNode(false);
        content.innerHTML = tagString;
        // return a document fragment from the created node
        for (var fragment = this._document.createDocumentFragment(); content.firstChild; )
          fragment.appendChild(content.firstChild);
        return fragment;
      }
    };

    function RangeIterator(range) {
      this.range = range;
      if (range.collapsed)
        return;

      // get anchors
      var root = range.commonAncestorContainer;
      this._next = range.startContainer == root && !DOMUtils.isDataNode(range.startContainer) ?
          range.startContainer.childNodes[range.startOffset] :
          DOMUtils.findClosestAncestor(root, range.startContainer);
      this._end = range.endContainer == root && !DOMUtils.isDataNode(range.endContainer) ?
          range.endContainer.childNodes[range.endOffset] :
          DOMUtils.findClosestAncestor(root, range.endContainer).nextSibling;
    }

    RangeIterator.prototype = {
      range: null,
      _current: null,
      _next: null,
      _end: null,

      hasNext: function() {
        return !!this._next;
      },
      next: function() {
        // move to next node
        var current = this._current = this._next;
        this._next = this._current && this._current.nextSibling != this._end ?
            this._current.nextSibling : null;

        // check for partial text nodes
        if (DOMUtils.isDataNode(this._current)) {
          if (this.range.endContainer == this._current)
            (current = current.cloneNode(true)).deleteData(this.range.endOffset, current.length - this.range.endOffset);
          if (this.range.startContainer == this._current)
            (current = current.cloneNode(true)).deleteData(0, this.range.startOffset);
        }
        return current;
      },
      remove: function() {
        // check for partial text nodes
        if (DOMUtils.isDataNode(this._current) &&
            (this.range.startContainer == this._current || this.range.endContainer == this._current)) {
          var start = this.range.startContainer == this._current ? this.range.startOffset : 0;
          var end = this.range.endContainer == this._current ? this.range.endOffset : this._current.length;
          this._current.deleteData(start, end - start);
        } else
          this._current.parentNode.removeChild(this._current);
      },
      hasPartialSubtree: function() {
        // check if this node be partially selected
        return !DOMUtils.isDataNode(this._current) &&
            (DOMUtils.isAncestorOrSelf(this._current, this.range.startContainer) ||
                DOMUtils.isAncestorOrSelf(this._current, this.range.endContainer));
      },
      getSubtreeIterator: function() {
        // create a new range
        var subRange = new Range(this.range._document);
        subRange.selectNodeContents(this._current);
        // handle anchor points
        if (DOMUtils.isAncestorOrSelf(this._current, this.range.startContainer))
          subRange.setStart(this.range.startContainer, this.range.startOffset);
        if (DOMUtils.isAncestorOrSelf(this._current, this.range.endContainer))
          subRange.setEnd(this.range.endContainer, this.range.endOffset);
        // return iterator
        return new RangeIterator(subRange);
      }
    };

    return Range;
  })();

  window.Range._fromTextRange = function(textRange, document) {
    function adoptBoundary(domRange, textRange, bStart) {
      // iterate backwards through parent element to find anchor location
      var cursorNode = document.createElement('a'), cursor = textRange.duplicate();
      cursor.collapse(bStart);
      var parent = cursor.parentElement();
      do {
        parent.insertBefore(cursorNode, cursorNode.previousSibling);
        cursor.moveToElementText(cursorNode);
      } while (cursor.compareEndPoints(bStart ? 'StartToStart' : 'StartToEnd', textRange) > 0 && cursorNode.previousSibling);

      // when we exceed or meet the cursor, we've found the node
      if (cursor.compareEndPoints(bStart ? 'StartToStart' : 'StartToEnd', textRange) == -1 && cursorNode.nextSibling) {
        // data node
        cursor.setEndPoint(bStart ? 'EndToStart' : 'EndToEnd', textRange);
        domRange[bStart ? 'setStart' : 'setEnd'](cursorNode.nextSibling, cursor.text.length);
      } else {
        // element
        domRange[bStart ? 'setStartBefore' : 'setEndBefore'](cursorNode);
      }
      cursorNode.parentNode.removeChild(cursorNode);
    }

    // return a DOM range
    var domRange = new Range(document);
    adoptBoundary(domRange, textRange, true);
    adoptBoundary(domRange, textRange, false);
    return domRange;
  }

  document.createRange = function() {
    return new Range(document);
  };

  window.Selection = (function() {
    function Selection(document) {
      this._document = document;

      var selection = this;
      document.attachEvent('onselectionchange', function() {
        selection._selectionChangeHandler();
      });
    }

    Selection.prototype = {
      rangeCount: 0,
      _document: null,

      _selectionChangeHandler: function() {
        this.rangeCount = this._selectionExists(this._document.selection.createRange()) ? 1 : 0;
      },
      _selectionExists: function(textRange) {
        return textRange.compareEndPoints('StartToEnd', textRange) != 0 ||
            textRange.parentElement().isContentEditable;
      },
      addRange: function(range) {
        var selection = this._document.selection.createRange(), textRange = range._toTextRange();
        if (!this._selectionExists(selection)) {
          textRange.select();
        } else {
          // only modify range if it intersects with current range
          if (textRange.compareEndPoints('StartToStart', selection) == -1)
            if (textRange.compareEndPoints('StartToEnd', selection) > -1 &&
                textRange.compareEndPoints('EndToEnd', selection) == -1)
              selection.setEndPoint('StartToStart', textRange);
          else
            if (textRange.compareEndPoints('EndToStart', selection) < 1 &&
                textRange.compareEndPoints('EndToEnd', selection) > -1)
              selection.setEndPoint('EndToEnd', textRange);
          selection.select();
        }
      },
      removeAllRanges: function() {
        this._document.selection.empty();
      },
      getRangeAt: function(index) {
        var textRange = this._document.selection.createRange();
        if (this._selectionExists(textRange))
          return Range._fromTextRange(textRange, this._document);
        return null;
      },
      toString: function() {
        return this._document.selection.createRange().text;
      }
    };

    return Selection;
  })();

  window.getSelection = (function() {
    var selection = new Selection(document);
    return function() { return selection; };
  })();

  window.getSelection.custom = true;
}
;


Object.extend(Range.prototype, (function() {
  function beforeRange(range) {
    if (!range || !range.compareBoundaryPoints) return false;
    return (this.compareBoundaryPoints(this.START_TO_START, range) == -1 &&
      this.compareBoundaryPoints(this.START_TO_END, range) == -1 &&
      this.compareBoundaryPoints(this.END_TO_END, range) == -1 &&
      this.compareBoundaryPoints(this.END_TO_START, range) == -1);
  }

  function afterRange(range) {
    if (!range || !range.compareBoundaryPoints) return false;
    return (this.compareBoundaryPoints(this.START_TO_START, range) == 1 &&
      this.compareBoundaryPoints(this.START_TO_END, range) == 1 &&
      this.compareBoundaryPoints(this.END_TO_END, range) == 1 &&
      this.compareBoundaryPoints(this.END_TO_START, range) == 1);
  }

  function betweenRange(range) {
    if (!range || !range.compareBoundaryPoints) return false;
    return !(this.beforeRange(range) || this.afterRange(range));
  }

  function equalRange(range) {
    if (!range || !range.compareBoundaryPoints) return false;
    return (this.compareBoundaryPoints(this.START_TO_START, range) == 0 &&
      this.compareBoundaryPoints(this.START_TO_END, range) == 1 &&
      this.compareBoundaryPoints(this.END_TO_END, range) == 0 &&
      this.compareBoundaryPoints(this.END_TO_START, range) == -1);
  }

  function getNode() {
    var parent = this.commonAncestorContainer;

    while (parent.nodeType == Node.TEXT_NODE)
      parent = parent.parentNode;

    var child = parent.childElements().detect(function(child) {
      var range = document.createRange();
      range.selectNodeContents(child);
      return this.betweenRange(range);
    }.bind(this));

    return $(child || parent);
  }

  return {
    beforeRange:  beforeRange,
    afterRange:   afterRange,
    betweenRange: betweenRange,
    equalRange:   equalRange,
    getNode:      getNode
  };
})());



if (window.getSelection.custom) {
  Object.extend(Selection.prototype, (function() {
    // TODO: More robust getNode
    function getNode() {
      var range = this._document.selection.createRange();
      return $(range.parentElement());
    }

    // TODO: IE selectNode should work with range.selectNode
    function selectNode(element) {
      var range = this._document.body.createTextRange();
      range.moveToElementText(element);
      range.select();
    }

    return {
      getNode:    getNode,
      selectNode: selectNode
    }
  })());
} else {
  // WebKit does not have a public Selection prototype
  if (typeof Selection == 'undefined') {
    var Selection = {}
    Selection.prototype = window.getSelection().__proto__;
  }

  Object.extend(Selection.prototype, (function() {
    function getNode() {
      if (this.rangeCount > 0)
        return this.getRangeAt(0).getNode();
      else
        return null;
    }

    function selectNode(element) {
      var range = document.createRange();
      range.selectNode(element);
      this.removeAllRanges();
      this.addRange(range);
    }

    return {
      getNode:    getNode,
      selectNode: selectNode
    }
  })());
}
;
(function() {
  function cloneWithAllowedAttributes(element, allowedAttributes) {
    var result = new Element(element.tagName), length = allowedAttributes.length, i;
    element = $(element);

    for (i = 0; i < allowedAttributes.length; i++) {
      attribute = allowedAttributes[i];
      if (element.hasAttribute(attribute)) {
        result.writeAttribute(attribute, element.readAttribute(attribute));
      }
    }

    return result;
  }

  function withEachChildNodeOf(element, callback) {
    var nodes = $A(element.childNodes), length = nodes.length, i;
    for (i = 0; i < length; i++) callback(nodes[i]);
  }

  function sanitizeNode(node, tagsToRemove, tagsToAllow, tagsToSkip) {
    var parentNode = node.parentNode;

    switch (node.nodeType) {
      case Node.ELEMENT_NODE:
        var tagName = node.tagName.toLowerCase();

        if (tagsToSkip) {
          var newNode = node.cloneNode(false);
          withEachChildNodeOf(node, function(childNode) {
            newNode.appendChild(childNode);
            sanitizeNode(childNode, tagsToRemove, tagsToAllow, tagsToSkip);
          });
          parentNode.insertBefore(newNode, node);

        } else if (tagName in tagsToAllow) {
          var newNode = cloneWithAllowedAttributes(node, tagsToAllow[tagName]);
          withEachChildNodeOf(node, function(childNode) {
            newNode.appendChild(childNode);
            sanitizeNode(childNode, tagsToRemove, tagsToAllow, tagsToSkip);
          });
          parentNode.insertBefore(newNode, node);

        } else if (!(tagName in tagsToRemove)) {
          withEachChildNodeOf(node, function(childNode) {
            parentNode.insertBefore(childNode, node);
            sanitizeNode(childNode, tagsToRemove, tagsToAllow, tagsToSkip);
          });
        }

      case Node.COMMENT_NODE:
        parentNode.removeChild(node);
    }
  }

  Element.addMethods({
    sanitizeContents: function(element, options) {
      element = $(element);

      var tagsToRemove = {};
      (options.remove || "").split(",").each(function(tagName) {
        tagsToRemove[tagName.strip()] = true;
      });

      var tagsToAllow = {};
      (options.allow || "").split(",").each(function(selector) {
        var parts = selector.strip().split(/[\[\]]/);
        var tagName = parts[0], allowedAttributes = parts.slice(1).grep(/./);
        tagsToAllow[tagName] = allowedAttributes;
      });

      var tagsToSkip = options.skip;

      withEachChildNodeOf(element, function(childNode) {
        sanitizeNode(childNode, tagsToRemove, tagsToAllow, tagsToSkip);
      });

      return element;
    }
  });
})();
document.on("dom:loaded", function() {
  function fieldChangeHandler(event, element) {
    var value;

    if (element.contentEditable == 'true')
      value = element.innerHTML;
    else if (element.getValue)
      value = element.getValue();

    if (value && element.previousValue != value) {
      element.fire("field:change");
      element.previousValue = value;
    }
  }

  $(document.body).on("keyup", 'input,textarea,*[contenteditable=""],*[contenteditable=true]', fieldChangeHandler);
});
(function() {
  function onReadyStateComplete(document, callback) {
    var handler;

    function checkReadyState() {
      if (document.readyState === 'complete') {
        if (handler) handler.stop();
        callback();
        return true;
      } else {
        return false;
      }
    }

    handler = Element.on(document, 'readystatechange', checkReadyState);
    checkReadyState();
  }

  function observeFrameContentLoaded(element) {
    element = $(element);

    var loaded, contentLoadedHandler;

    loaded = false;
    function fireFrameLoaded() {
      if (loaded) return;

      loaded = true;
      if (contentLoadedHandler) contentLoadedHandler.stop();
      element.fire('frame:loaded');
    }

    if (window.addEventListener) {
      contentLoadedHandler = document.on("DOMFrameContentLoaded", function(event) {
        if (element == event.element())
          fireFrameLoaded();
      });
    }

    element.on('load', function() {
      var frameDocument;

      if (typeof element.contentDocument !== 'undefined') {
        frameDocument = element.contentDocument;
      } else if (typeof element.contentWindow !== 'undefined' && typeof element.contentWindow.document !== 'undefined') {
        frameDocument = element.contentWindow.document;
      }

      onReadyStateComplete(frameDocument, fireFrameLoaded);
    });

    return element;
  }

  function onFrameLoaded(element, callback) {
    element.on('frame:loaded', callback);
    element.observeFrameContentLoaded();
  }

  Element.addMethods({
    observeFrameContentLoaded: observeFrameContentLoaded,
    onFrameLoaded: onFrameLoaded
  });
})();
document.on("dom:loaded", function() {
  if ('selection' in document && 'onselectionchange' in document) {
    var selectionChangeHandler = function() {
      var range   = document.selection.createRange();
      var element = range.parentElement();
      $(element).fire("selection:change");
    }

    document.on("selectionchange", selectionChangeHandler);
  } else {
    var previousRange;

    var selectionChangeHandler = function() {
      var element        = document.activeElement;
      var elementTagName = element.tagName.toLowerCase();

      if (elementTagName == "textarea" || elementTagName == "input") {
        previousRange = null;
        $(element).fire("selection:change");
      } else {
        var selection = window.getSelection();
        if (selection.rangeCount < 1) return;

        var range = selection.getRangeAt(0);
        if (range && range.equalRange(previousRange)) return;
        previousRange = range;

        element = range.commonAncestorContainer;
        while (element.nodeType == Node.TEXT_NODE)
          element = element.parentNode;

        $(element).fire("selection:change");
      }
    };

    document.on("mouseup", selectionChangeHandler);
    document.on("keyup", selectionChangeHandler);
  }
});
WysiHat.Formatting = (function() {
  var ACCUMULATING_LINE      = {};
  var EXPECTING_LIST_ITEM    = {};
  var ACCUMULATING_LIST_ITEM = {};

  return {
    getBrowserMarkupFrom: function(applicationMarkup) {
      var container = new Element("div").update(applicationMarkup);

      function spanify(element, style) {
        element.replace(
          '<span style="' + style +
          '" class="Apple-style-span">' +
          element.innerHTML + '</span>'
        );
      }

      function convertStrongsToSpans() {
        container.select("strong").each(function(element) {
          spanify(element, "font-weight: bold");
        });
      }

      function convertEmsToSpans() {
        container.select("em").each(function(element) {
          spanify(element, "font-style: italic");
        });
      }

      function convertDivsToParagraphs() {
        container.select("div").each(function(element) {
          element.replace("<p>" + element.innerHTML + "</p>");
        });
      }

      if (Prototype.Browser.WebKit || Prototype.Browser.Gecko) {
        convertStrongsToSpans();
        convertEmsToSpans();
      } else if (Prototype.Browser.IE || Prototype.Browser.Opera) {
        convertDivsToParagraphs();
      }

      return container.innerHTML;
    },

    getApplicationMarkupFrom: function(element) {
      var mode = ACCUMULATING_LINE, result, container, line, lineContainer, previousAccumulation;

      function walk(nodes) {
        var length = nodes.length, node, tagName, i;

        for (i = 0; i < length; i++) {
          node = nodes[i];

          if (node.nodeType == Node.ELEMENT_NODE) {
            tagName = node.tagName.toLowerCase();
            open(tagName, node);
            walk(node.childNodes);
            close(tagName);

          } else if (node.nodeType == Node.TEXT_NODE) {
            read(node.nodeValue);
          }
        }
      }

      function open(tagName, node) {
        if (mode == ACCUMULATING_LINE) {
          // if it's a block-level element and the line buffer is full, flush it
          if (isBlockElement(tagName)) {
            if (isEmptyParagraph(node)) {
              accumulate(new Element("br"));
            }

            flush();

            // if it's a ul or ol, switch to expecting-list-item mode
            if (isListElement(tagName)) {
              container = insertList(tagName);
              mode = EXPECTING_LIST_ITEM;
            }

          } else if (isLineBreak(tagName)) {
            // if it's a br, and the previous accumulation was a br,
            // remove the previous accumulation and flush
            if (isLineBreak(getPreviouslyAccumulatedTagName())) {
              previousAccumulation.parentNode.removeChild(previousAccumulation);
              flush();
            }

            // accumulate the br
            accumulate(node.cloneNode(false));

            // if it's the first br in a line, flush
            if (!previousAccumulation.previousNode) flush();

          } else {
            accumulateInlineElement(tagName, node);
          }

        } else if (mode == EXPECTING_LIST_ITEM) {
          if (isListItemElement(tagName)) {
            mode = ACCUMULATING_LIST_ITEM;
          }

        } else if (mode == ACCUMULATING_LIST_ITEM) {
          if (isLineBreak(tagName)) {
            accumulate(node.cloneNode(false));

          } else if (!isBlockElement(tagName)) {
            accumulateInlineElement(tagName, node);
          }
        }
      }

      function close(tagName) {
        if (mode == ACCUMULATING_LINE) {
          if (isLineElement(tagName)) {
            flush();
          }

          if (line != lineContainer) {
            lineContainer = lineContainer.parentNode;
          }

        } else if (mode == EXPECTING_LIST_ITEM) {
          if (isListElement(tagName)) {
            container = result;
            mode = ACCUMULATING_LINE;
          }

        } else if (mode == ACCUMULATING_LIST_ITEM) {
          if (isListItemElement(tagName)) {
            flush();
            mode = EXPECTING_LIST_ITEM;
          }

          if (line != lineContainer) {
            lineContainer = lineContainer.parentNode;
          }
        }
      }

      function isBlockElement(tagName) {
        return isLineElement(tagName) || isListElement(tagName);
      }

      function isLineElement(tagName) {
        return tagName == "p" || tagName == "div";
      }

      function isListElement(tagName) {
        return tagName == "ol" || tagName == "ul";
      }

      function isListItemElement(tagName) {
        return tagName == "li";
      }

      function isLineBreak(tagName) {
        return tagName == "br";
      }

      function isEmptyParagraph(node) {
        return node.tagName.toLowerCase() == "p" && node.childNodes.length == 0;
      }

      function read(value) {
        accumulate(document.createTextNode(value));
      }

      function accumulateInlineElement(tagName, node) {
        var element = node.cloneNode(false);

        if (tagName == "span") {
          if ($(node).getStyle("fontWeight") == "bold") {
            element = new Element("strong");

          } else if ($(node).getStyle("fontStyle") == "italic") {
            element = new Element("em");
          }
        }

        accumulate(element);
        lineContainer = element;
      }

      function accumulate(node) {
        if (mode != EXPECTING_LIST_ITEM) {
          if (!line) line = lineContainer = createLine();
          previousAccumulation = node;
          lineContainer.appendChild(node);
        }
      }

      function getPreviouslyAccumulatedTagName() {
        if (previousAccumulation && previousAccumulation.nodeType == Node.ELEMENT_NODE) {
          return previousAccumulation.tagName.toLowerCase();
        }
      }

      function flush() {
        if (line && line.childNodes.length) {
          container.appendChild(line);
          line = lineContainer = null;
        }
      }

      function createLine() {
        if (mode == ACCUMULATING_LINE) {
          return new Element("div");
        } else if (mode == ACCUMULATING_LIST_ITEM) {
          return new Element("li");
        }
      }

      function insertList(tagName) {
        var list = new Element(tagName);
        result.appendChild(list);
        return list;
      }

      result = container = new Element("div");
      walk(element.childNodes);
      flush();
      return result.innerHTML;
    }
  };
})();


/** section: wysihat
 *  class WysiHat.Toolbar
**/

WysiHat.Toolbar = Class.create((function() {
  /**
   *  new WysiHat.Toolbar(editor)
   *  - editor (WysiHat.Editor): the editor object that you want to attach to
   *
   *  Creates a toolbar element above the editor. The WysiHat.Toolbar object
   *  has many helper methods to easily add buttons to the toolbar.
   *
   *  This toolbar class is not required for the Editor object to function.
   *  It is merely a set of helper methods to get you started and to build
   *  on top of. If you are going to use this class in your application,
   *  it is highly recommended that you subclass it and override methods
   *  to add custom functionality.
  **/
  function initialize(editor) {
    this.editor = editor;
    this.element = this.createToolbarElement();
  }

  /**
   *  WysiHat.Toolbar#createToolbarElement() -> Element
   *
   *  Creates a toolbar container element and inserts it right above the
   *  original textarea element. The element is a div with the class
   *  'editor_toolbar'.
   *
   *  You can override this method to customize the element attributes and
   *  insert position. Be sure to return the element after it has been
   *  inserted.
  **/
  function createToolbarElement() {
    var toolbar = new Element('div', { 'class': 'editor_toolbar' });
    this.editor.insert({before: toolbar});
    return toolbar;
  }

  /**
   *  WysiHat.Toolbar#addButtonSet(set) -> undefined
   *  - set (Array): The set array contains nested arrays that hold the
   *  button options, and handler.
   *
   *  Adds a button set to the toolbar.
  **/
  function addButtonSet(set) {
    $A(set).each(function(button){
      this.addButton(button);
    }.bind(this));
  }

  /**
   *  WysiHat.Toolbar#addButton(options[, handler]) -> undefined
   *  - options (Hash): Required options hash
   *  - handler (Function): Function to bind to the button
   *
   *  The options hash accepts two required keys, name and label. The label
   *  value is used as the link's inner text. The name value is set to the
   *  link's class and is used to check the button state. However the name
   *  may be omitted if the name and label are the same. In that case, the
   *  label will be down cased to make the name value. So a "Bold" label
   *  will default to "bold" name.
   *
   *  The second optional handler argument will be used if no handler
   *  function is supplied in the options hash.
   *
   *  toolbar.addButton({
   *    name: 'bold', label: "Bold" }, function(editor) {
   *      editor.boldSelection();
   *  });
   *
   *  Would create a link,
   *  "<a href='#' class='button bold'><span>Bold</span></a>"
  **/
  function addButton(options, handler) {
    options = $H(options);

    if (!options.get('name'))
      options.set('name', options.get('label').toLowerCase());
    var name = options.get('name');

    var button = this.createButtonElement(this.element, options);

    var handler = this.buttonHandler(name, options);
    this.observeButtonClick(button, handler);

    var handler = this.buttonStateHandler(name, options);
    this.observeStateChanges(button, name, handler);
  }

  /**
   *  WysiHat.Toolbar#createButtonElement(toolbar, options) -> Element
   *  - toolbar (Element): Toolbar element created by createToolbarElement
   *  - options (Hash): Options hash that pass from addButton
   *
   *  Creates individual button elements and inserts them into the toolbar
   *  container. The default elements are 'a' tags with a 'button' class.
   *
   *  You can override this method to customize the element attributes and
   *  insert positions. Be sure to return the element after it has been
   *  inserted.
  **/
  function createButtonElement(toolbar, options) {
    var button = new Element('a', {
      'class': 'button', 'href': '#'
    });
    button.update('<span>' + options.get('label') + '</span>');
    button.addClassName(options.get('name'));

    toolbar.appendChild(button);

    return button;
  }

  /**
   *  WysiHat.Toolbar#buttonHandler(name, options) -> Function
   *  - name (String): Name of button command: 'bold', 'italic'
   *  - options (Hash): Options hash that pass from addButton
   *
   *  Returns the button handler function to bind to the buttons onclick
   *  event. It checks the options for a 'handler' attribute otherwise it
   *  defaults to a function that calls execCommand with the button name.
  **/
  function buttonHandler(name, options) {
    if (options.handler)
      return options.handler;
    else if (options.get('handler'))
      return options.get('handler');
    else
      return function(editor) { editor.execCommand(name); };
  }

  /**
   *  WysiHat.Toolbar#observeButtonClick(element, handler) -> undefined
   *  - element (Element): Button element
   *  - handler (Function): Handler function to bind to element
   *
   *  Bind handler to elements onclick event.
  **/
  function observeButtonClick(element, handler) {
    element.on('click', function(event) {
      handler(this.editor);
      event.stop();
    }.bind(this));
  }

  /**
   *  WysiHat.Toolbar#buttonStateHandler(name, options) -> Function
   *  - name (String): Name of button command: 'bold', 'italic'
   *  - options (Hash): Options hash that pass from addButton
   *
   *  Returns the button handler function that checks whether the button
   *  state is on (true) or off (false). It checks the options for a
   *  'query' attribute otherwise it defaults to a function that calls
   *  queryCommandState with the button name.
  **/
  function buttonStateHandler(name, options) {
    if (options.query)
      return options.query;
    else if (options.get('query'))
      return options.get('query');
    else
      return function(editor) { return editor.queryCommandState(name); };
  }

  /**
   *  WysiHat.Toolbar#observeStateChanges(element, name, handler) -> undefined
   *  - element (Element): Button element
   *  - name (String): Button name
   *  - handler (Function): State query function
   *
   *  Determines buttons state by calling the query handler function then
   *  calls updateButtonState.
  **/
  function observeStateChanges(element, name, handler) {
    var previousState;
    this.editor.on("selection:change", function(event) {
      var state = handler(this.editor);
      if (state != previousState) {
        previousState = state;
        this.updateButtonState(element, name, state);
      }
    }.bind(this));
  }

  /**
   *  WysiHat.Toolbar#updateButtonState(element, name, state) -> undefined
   *  - element (Element): Button element
   *  - name (String): Button name
   *  - state (Boolean): Whether button state is on/off
   *
   *  If the state is on, it adds a 'selected' class to the button element.
   *  Otherwise it removes the 'selected' class.
   *
   *  You can override this method to change the class name or styles
   *  applied to buttons when their state changes.
  **/
  function updateButtonState(element, name, state) {
    if (state)
      element.addClassName('selected');
    else
      element.removeClassName('selected');
  }

  return {
    initialize:           initialize,
    createToolbarElement: createToolbarElement,
    addButtonSet:         addButtonSet,
    addButton:            addButton,
    createButtonElement:  createButtonElement,
    buttonHandler:        buttonHandler,
    observeButtonClick:   observeButtonClick,
    buttonStateHandler:   buttonStateHandler,
    observeStateChanges:  observeStateChanges,
    updateButtonState:    updateButtonState
  };
})());

/**
 * WysiHat.Toolbar.ButtonSets
 *
 *  A namespace for various sets of Toolbar buttons. These sets should be
 *  compatible with WysiHat.Toolbar, and can be added to the toolbar with:
 *  toolbar.addButtonSet(WysiHat.Toolbar.ButtonSets.Basic);
**/
WysiHat.Toolbar.ButtonSets = {};

/**
 * WysiHat.Toolbar.ButtonSets.Basic
 *
 *  A basic set of buttons: bold, underline, and italic. This set is
 *  compatible with WysiHat.Toolbar, and can be added to the toolbar with:
 *  toolbar.addButtonSet(WysiHat.Toolbar.ButtonSets.Basic);
**/
WysiHat.Toolbar.ButtonSets.Basic = $A([
  { label: "Bold" },
  { label: "Underline" },
  { label: "Italic" }
]);
var CreditCardForm = Class.create({
  initialize: function(form) {
    this.form = $(form);
    this.form.onsubmit = this.submitPayment.bind(this);
    this.cardContainer = document.body.querySelector('.credit-card');

    this.submitButton = this.form.querySelector('input[name="commit"]')
    this.stripeTokenField = this.form.querySelector('#credit_card_charge_token');

    this.cardFields = {
      number: this.cardContainer.querySelector('#credit_card_number'),
      expiration: this.cardContainer.querySelector('#credit_card_expiration'),
      postalCode: this.cardContainer.querySelector('#credit_card_postal_code'),
      cvc: this.cardContainer.querySelector('#credit_card_cvv')
    };

    Stripe.setPublishableKey(_stripe_key);
  },

  install: function() {
    this.cardFields.number.oninput = this._validateField.bind(this, this.cardFields.number, function(v) {
      return /^\d+$/.test(v) && v.length > 12 && v.length < 17;
    });

    this.cardFields.expiration.oninput = this._validateField.bind(this, this.cardFields.expiration, function(v) {
      return /^\d+$/.test(v) && v.length == 4;
    });

    this.cardFields.postalCode.oninput = this._validateField.bind(this, this.cardFields.postalCode, function(v) {
      return /^[a-z0-9]+$/i.test(v) && v.length > 3 && v.length < 9;
    });

    this.cardFields.cvc.oninput = this._validateField.bind(this, this.cardFields.cvc, function(v) {
      return /^[a-z0-9]+$/i.test(v) && v.length > 2 && v.length < 5;
    });
  },

  submitPayment: function(event) {
    var _this = this;

    if (this.hasStripeToken) return;

    event.preventDefault();
    if (!this._allFieldsValid()) return;

    this.submitButton.value = "Submitting...";

    this._createStripeToken(
      function(token) {
        _this.stripeTokenField.value = token;
        _this.hasStripeToken = true;
        _this.form.submit();
      },
      function(message) {
        alert("Could not process payment: " + message);
      },
      function() {
        _this.submitButton.value = "Place your order";
      }
    );
  },

  _createStripeToken: function(success, fail, always) {
    var expiration = this._sanitizeValue(this.cardFields.expiration.value);

    Stripe.createToken({
      number: this._sanitizeValue(this.cardFields.number.value),
      cvc: this._sanitizeValue(this.cardFields.cvc.value),
      exp_month: expiration.slice(0, 2),
      exp_year: expiration.slice(2, 4),
    }, function(status, response) {
      if (status === 200) {
        success(response.id);
      } else {
        success(response.error.message);
      }

      always(response);
    });
  },

  _allFieldsValid: function() {
    _this = this;
    return Object.keys(this.cardFields).every(function(element) {
      return _this.cardFields[element].dataset.valid == "true";
    })
  },

  _sanitizeValue: function(value) {
    return value.replace(/ |-|\//g, '').toLowerCase();
  },

  _validateField: function(field, checker) {
    var value = this._sanitizeValue(field.value);
    var valid = checker(value);

    field.dataset.valid = valid;
    field.classList[(valid || !value.length) ? 'remove' : 'add']('invalid');
  }
});

document.on("dom:loaded", function() {
  var form = $("purchase_listing");
  if (form) { new CreditCardForm(form).install(); }
});
var Digest = Class.create({
  initialize: function(form) {
    this.form = form;
    this.toggle = this.form.querySelector('.inline-categories-toggle');

    // Convert this NodeList to Array so we can iterate on it
    this.categoryChecks = [].slice.call(this.form.querySelectorAll('.email-subscription-categories input'));
  },

  install: function() {
    this.toggle.addEventListener('click', function() {
      var actionVerb = this.form.classList.contains('toggle-active') ? 'remove' : 'add';
      this.form.classList[actionVerb]('toggle-active');
    });

    this.categoryChecks.forEach(function(checkbox) {
      checkbox.addEventListener('change', this.updateToggleLabel.bind(this));
    }.bind(this))
  },

  updateToggleLabel() {
    var checkedCategories = this.categoryChecks.filter(function(checkbox) {
      return checkbox.checked;
    });

    var newLabel;

    switch (checkedCategories.length) {
      case 0:
        newLabel = "Nothing selected";
        break;
      case 1:
        newLabel = checkedCategories[0].dataset.label;
        break;
      default:
        newLabel = checkedCategories.length + " categories";
    };

    this.toggle.textContent = newLabel;
  }
});

document.on("dom:loaded", function() {
  var form = document.querySelector('#email-subscription-form.inline');
  if (form) { new Digest(form).install(); }
});
document.on("dom:loaded", function() {
  function validateForm(form) {
    var required = form.select('*[required]');

    var errors = required.select(function(element) {
      var requirement = element.readAttribute('required');
      var emailRegexp = /^[^@\s]+@(?:[^@\s.]+\.)+[a-z]{2,}$/i;

      if (element.value.blank()) {
        return element;
      }

      if (requirement == 'email') {
        element.value = element.value.strip();
        if (!element.value.match(emailRegexp)) {
          return element;
        }
      }
    });

    return errors.any() ? errors : null;
  }

  function clearErrorMessages(form) {
    form.select(".error_message").invoke('hide');
    form.select(".invalid").invoke('removeClassName', 'invalid');
  }

  function displayErrorMessageFor(input) {
    input.addClassName("invalid");

    var element = $(input.id + "_error_message");
    if (element) element.setStyle({display: "block"});
  }

  var form = $("new_listing");
  if (form) {
    form.on("submit", function(event, form) {
      clearErrorMessages(form);

      var errors = validateForm(form);
      if (errors) {
        event.stop();
        errors.each(function(element) { displayErrorMessageFor(element); });
      }
    });
  }
});

document.on("dom:loaded", function() {
  $(document.body).on("selectable:changed", ".selectable_container", function(event, container) {
    container.select(".selectable").invoke("removeClassName", "selected");
    var checked = container.down("input[checked]");
    if (checked) checked.up(".selectable").addClassName("selected");
  });

  $(document.body).on("dom:modified", function(event, region) {
    $(region).select(".selectable_container").invoke("fire", "selectable:changed");
  });
});
// TODO: Move to WysiHat
(function() {
  if (document.selection) {
    // IE
    Object.extend(Selection.prototype, {
      makeInactiveSelection: function() {
        var range = this._document.selection.createRange();

        var dummy   = new Element('div');
        var wrapper = new Element('span', {'class': 'inactive_selection'}).update(range.htmlText);
        dummy.appendChild(wrapper);
        range.pasteHTML(dummy.innerHTML);
      },

      restoreInactiveSelection: function(element) {
        var range = this._document.selection.createRange();
        range.moveToElementText(element);
        element.removeClassName("inactive_selection");
        range.select();
      }
    });
  } else {
    // W3C
    Object.extend(Selection.prototype, {
      makeInactiveSelection: function() {
        var range   = this.getRangeAt(0);
        var wrapper = new Element('span', {'class': "inactive_selection"});
        range.surroundContents(wrapper);
      },

      restoreInactiveSelection: function(element) {
        var range = document.createRange();
        range.selectNodeContents(element);
        element.removeClassName("inactive_selection");
        this.removeAllRanges();
        this.addRange(range);
      }
    });
  }

  document.observe("focus:in", function(event) {
    var element = event.findElement("div[contentEditable=true]");
    if (element) {
      element.select("span.inactive_selection").each(function(element) {
        element.removeClassName("inactive_selection");
      });
    }
  });
})();

var RichTextArea = Class.create({
  initialize: function(editor) {
    this.editor = $(editor);
    this.element = this.editor.up("div.rich_text_area");
    this.hiddenField = this.editor.next("input");
    this.element.addClassName("uses_" + this.getParagraphType());

    // Extend editor element with command delegates
    // TODO: This API is going to change
    Object.extend(this.editor, WysiHat.Commands);

    this.loadContents(this.hiddenField.value);

    this.toolbar = this.element.down("div.rich_text_toolbar");
    this.initializeToolbarButtons();

    this.element.observe("selection:change", this.onCursorMove.bind(this));
    this.element.observe("field:change", this.onChange.bind(this));
    this.editor.observe("paste", this.onPaste.bind(this));
    this.editor.observe("blur", this.onBlur.bind(this));

    this.element.observe("link:selection", this.onLinkSelection.bind(this));
  },

  getParagraphType: function() {
    if (Prototype.Browser.WebKit) return "div";
    if (Prototype.Browser.Gecko)  return "br";
    return "p";
  },

  content: function() {
    return WysiHat.Formatting.getApplicationMarkupFrom(this.editor);
  },

  loadContents: function(applicationMarkup) {
    var html = WysiHat.Formatting.getBrowserMarkupFrom(applicationMarkup);
    if (html.blank() && Prototype.Browser.Gecko) html = "<br>";
    this.editor.update(html);
  },

  saveContents: function(text) {
    this.hiddenField.setValue(this.content());
  },

  initializeToolbarButtons: function() {
    this.toolbarButtons = this.toolbar.select("a.button['data-state']");
    this.toolbar.observe("mousedown", this.onToolbarMousedown.bind(this));
    this.toolbar.observe("mouseup", this.onToolbarMouseup.bind(this));
    this.toolbar.observe("click", this.onToolbarClicked.bind(this));

    this.menuObserver = new MenuObserver(this.toolbar);
    this.toolbar.observe("menu:prepared", this.onMenuPrepared.bind(this));
    this.toolbar.observe("menu:activated", this.onMenuActivated.bind(this));
    this.toolbar.observe("menu:deactivated", this.onMenuDeactivated.bind(this));
  },

  onToolbarMousedown: function(event) {
    var button = this.findButtonFromEvent(event);
    if (button) {
      if (this.editorHasFocus()) {
        var state = this.getButtonState(button);
        this["on" + state.capitalize() + "Clicked"].call(this);
        this.updateToolbar();
      }
      event.stop();
    }
  },

  onToolbarMouseup: function(event) {
    var element = this.findButtonFromEvent(event);
    if (element && !element.hasClassName("menu_target")) {
      this.editor.focus();
    }
  },

  onToolbarClicked: function(event) {
    if (this.findButtonFromEvent(event)) {
      event.stop();
    }
  },

  onMenuPrepared: function(event) {
    if (!this.editorHasFocus()) {
      event.stop();
    }
  },

  onMenuActivated: function(event) {
    event.findElement().autofocus();
  },

  onMenuDeactivated: function(event) {
    this.editor.focus();
  },

  findButtonFromEvent: function(event) {
    return event.findElement("a.button['data-state']");
  },

  editorHasFocus: function() {
    return this.element.hasClassName("editor_has_focus");
  },

  onPaste: function() {
    this.onAfterPaste.bind(this).defer();
  },

  onAfterPaste: function() {
    var selection = window.getSelection();
    var selectedRange = selection.getRangeAt(0);
    var bookmark = new Element("bookmark");
    selectedRange.surroundContents(bookmark);

    this.reformatPaste(this.editor);

    bookmark = this.editor.down("bookmark");
    selectedRange = document.createRange();
    selectedRange.selectNode(bookmark);
    selection.removeAllRanges();
    selection.addRange(selectedRange);
    selectedRange.deleteContents();
  },

  reformatPaste: function(pasteContainer) {
    pasteContainer.sanitizeContents({
      remove: "style, link, meta",
      allow:  "span, p, br, strong, b, em, i, a[href], ul, ol, li, div, bookmark",
      skip:   "[_moz_dirty]"
    });

    pasteContainer.select("p").each(function(paragraph) {
      if (paragraph.childNodes.length == 2) {
        // Remove strange empty paragraphs from Pages -> Safari pastes
        var first = paragraph.childNodes[0], second = paragraph.childNodes[1];
        if (first.tagName && first.tagName.toLowerCase() == "span" && first.innerHTML == "" &&
            second.tagName && second.tagName.toLowerCase() == "br") {
          paragraph.remove();
          return;
        }
      } else if (Prototype.Browser.IE && paragraph.innerText == "") {
        paragraph.update("&nbsp;");
      } else if (!Prototype.Browser.IE) {
        var html = paragraph.innerHTML.toLowerCase();
        if (html.match(/^<br>$/)) {
          paragraph.remove();
        } else if (!html.match(/<br><br>$/)) {
          paragraph.insert("<br><br>");
        }
      }
    });
  },

  onBlur: function() {
    this.saveContents();
  },

  onCursorMove: function(event) {
    this.updateToolbar();
  },

  onBoldClicked: function() {
    this.editor.boldSelection();
  },

  onItalicClicked: function() {
    this.editor.italicSelection();
  },

  onOrderedlistClicked: function() {
    var node = window.getSelection().getNode();
    if (this.editor.orderedListSelected() && !node.match("ol li:last-child *"))
      window.getSelection().selectNode(node.up("ol"));
    else if (this.editor.unorderedListSelected())
      window.getSelection().selectNode(node.up("ul"));

    this.editor.toggleOrderedList();
  },

  onUnorderedlistClicked: function() {
    var node = window.getSelection().getNode();
    if (this.editor.unorderedListSelected() && !node.match("ul li:last-child *"))
      window.getSelection().selectNode(node.up("ul"));
    else if (this.editor.orderedListSelected())
      window.getSelection().selectNode(node.up("ol"));

    this.editor.toggleUnorderedList();
  },

  onLinkClicked: function() {
    this.selectionBookmark = null;

    var container = this.element.down(".link_container");
    var input = container.down(".menu_content input");

    var selectedElement = window.getSelection().getNode();
    if (selectedElement && this.editor.linkSelected()) {
      window.getSelection().selectNode(selectedElement);
      selectedElement.value = selectedElement.href;
    } else {
      input.value = "";
    }

    window.getSelection().makeInactiveSelection();
  },

  onLinkSelection: function(event) {
    var container = this.element.down(".link_container");
    this.menuObserver.deactivate(container);

    var inactiveSelection = this.editor.down('span.inactive_selection');
    if (!inactiveSelection) return;

    // Editor needs focus in IE before we can reselect
    this.editor.focus();
    window.getSelection().restoreInactiveSelection(inactiveSelection);

    var value = container.down(".menu_content input").value;

    if (value.blank()) {
      this.editor.unlinkSelection();
    } else {
      this.editor.linkSelection(this.tidyUrl(value));
    }
  },

  tidyUrl: function(url) {
    if (!url.match(/^[a-z]+:\/\//i)) {
      url = "http://" + url;
    }
    return url;
  },

  onChange: function(event) {
    this.saveContents();
    this.updateToolbar();
  },

  updateToolbar: function() {
    this.toolbarButtons.each(function(button) {
      var state = this.getButtonState(button);
      if (this.editor.queryCommandState(state)) {
        button.addClassName("selected");
      } else {
        button.removeClassName("selected");
      }
    }, this);
  },

  getButtonState: function(button) {
    return button.readAttribute("data-state");
  }
});

Object.extend(RichTextArea, {
  findAll: function(parent) {
    return $(parent || document.body).select("div.rich_text_area div.editor[contentEditable=true]");
  },

  initializeAll: function() {
    RichTextArea.findAll().each(function(contentEditable) {
      if (!contentEditable.retrieve("richTextArea")) {
        var richTextArea = new RichTextArea(contentEditable);
        contentEditable.store("richTextArea", richTextArea);
      }
    });
  }
});

document.observe("dom:modified", function() {
  RichTextArea.initializeAll();
});

(function() {
  var childSelector = "div.rich_text_area div.editor";
  var parentSelector = "div.rich_text_area";
  var className = "editor_has_focus";

  document.observe("focus:in", function(event) {
    var element = event.findElement(childSelector);
    if (element) element.up(parentSelector).addClassName(className);
  });

  document.observe("focus:out", function(event) {
    var element = event.findElement(childSelector);
    if (element) element.up(parentSelector).removeClassName(className);
  });
})();

document.observe("click", function(event) {
  var element = event.findElement("a.formatting_switch");

  if (element) {
    event.stop();
    if (element.hasClassName("busy")) return;

    var formattableBody = element.up("div.formattable_body");
    var confirmation = element.readAttribute("data-confirm");
    var body = formattableBody.down("input.body[type=hidden], textarea.body");
    var url = element.readAttribute("href");

    if (body.getValue().blank() || confirm(confirmation)) {
      element.addClassName("busy");
      new Ajax.Request(url, { parameters: element.up("form").serialize() });
    }
  }
});
document.on("dom:loaded", function() {
  if (!$("search_term")) {
    return;
  }

  new Form.Element.Observer("search_term", 1, function(element, value) {
    new Ajax.Updater("job_list", element.form.action, {
      method: "GET",
      parameters: { term: value }
    })
  });
});
/*!
 * "position: sticky" polyfill
 * https://github.com/matthewp/position--sticky-
 * License: MIT
 */

(function () {
  var prefixTestList = ['', '-webkit-', '-ms-', '-moz-', '-o-'];
  var stickyTestElement = document.createElement('div');
  var lastKnownScrollTop = 0;
  var waitingForUpdate = false;
  // requestAnimationFrame may be prefixed
  var requestAnimationFrame = window.requestAnimationFrame ||
                              window.webkitRequestAnimationFrame ||
                              window.mozRequestAnimationFrame;

  for (var i = 0, l = prefixTestList.length; i < l; i++) {
    try {
      stickyTestElement.style.position = prefixTestList[i] + 'sticky';
    } catch(e) {
      return false;
    }
  }

  var slice = Array.prototype.slice;
  function getBodyOffset(body) {
    return {
      top: body.offsetTop,
      left: body.offsetLeft
    };
  }
  function getOffset(elem) {
    var docElem,
        body,
        win,
        clientTop,
        clientLeft,
        scrollTop,
        scrollLeft,
        box = {
        top: 0,
        left: 0
      },
      doc = elem && elem.ownerDocument;

    if(!doc) {
      return;
    }
    if((body = doc.body) === elem) {
      return getBodyOffset(elem);
    }
    docElem = doc.documentElement;
    if(typeof elem.getBoundingClientRect !== "undefined") {
      box = elem.getBoundingClientRect();
    }
    win = window;
    clientTop = docElem.clientTop || body.clientTop || 0;
    clientLeft = docElem.clientLeft || body.clientLeft || 0;
    scrollTop = win.pageYOffset || docElem.scrollTop;
    scrollLeft = win.pageXOffset || docElem.scrollLeft;
    return {
      top: box.top + scrollTop - clientTop,
      left: box.left + scrollLeft - clientLeft
    };
  }
  function setStyle(elem, repl) {
    var style = elem.getAttribute('style').split(';'),
        newStyle = [];

    for(var i = 0, l = style.length; i < l; i++) {
      var both = style[i].split(':'),
          key = both[0],
          value = both[1];

      if(key in repl) {
        newStyle.push(key + ':' + repl[key]);
      } else {
        newStyle.push(both.join(':'));
      }
    }
    elem.setAttribute('style', newStyle.join(';'));
  }
  var cssPattern = /\s*(.*?)\s*{(.*?)}+/g,
      matchPosition = /\.*?position:.*?sticky.*?;/i,
      getTop = /\.*?top:(.*?);/i,
      toObserve = [];

  function parse(css) {
    var matches;
    css = css.replace(/(\/\*([\s\S]*?)\*\/)|(\/\/(.*)$)/gm, '').replace(/\n|\r/g, '');

    while((matches = cssPattern.exec(css)) !== null) {
      var selector = matches[1];
      if(matchPosition.test(matches[2]) && selector !== "#modernizr") {
        var topMatch = getTop.exec(matches[2]),
            topCSS = ((topMatch !== null) ? parseInt(topMatch[1]) : 0);

        var elems = slice.call(document.querySelectorAll(selector));
        elems.forEach(function (elem) {
          var height = elem.offsetHeight,
              parent = elem.parentElement,
              parOff = getOffset(parent),
              parOffTop = ((parOff !== null && parOff.top !== null) ? parOff.top : 0),
              elmOff = getOffset(elem),
              elmOffTop = ((elmOff !== null && elmOff.top !== null) ? elmOff.top : 0),
              start = elmOffTop - topCSS,
              end = (parOffTop + parent.offsetHeight) - height - topCSS,
              newCSS = matches[2] + "position:fixed;width:" + elem.offsetWidth + "px;height:" + height + "px",
              dummy = document.createElement('div');

          dummy.innerHTML = '<span style="position:static;display:block;height:' + height + 'px;"></span>';
          toObserve.push({
            element: elem,
            parent: parent,
            repl: dummy.firstElementChild,
            start: start,
            end: end,
            oldCSS: matches[2],
            newCSS: newCSS,
            fixed: false
          });
        });
      }
    }
  }
  function setPositions() {
    var scrollTop = lastKnownScrollTop;
    waitingForUpdate = false;
    for(var i = 0, l = toObserve.length; i < l; i++) {
      var obj = toObserve[i];
      if(obj.fixed === false && scrollTop > obj.start && scrollTop < obj.end) {
        obj.element.setAttribute('style', obj.newCSS);
        obj.fixed = true;
        obj.element.classList.add('stuck');
      } else {
        if(obj.fixed === true) {
          if(scrollTop < obj.start) {
            obj.element.setAttribute('style', obj.oldCSS);
            obj.fixed = false;
            obj.element.classList.remove('stuck');
          } else {
            if(scrollTop > obj.end) {
              var absolute = getOffset(obj.element);
              absolute.position = "absolute";
              obj.element.setAttribute('style', obj.newCSS);
              setStyle(obj.element, absolute);
              obj.fixed = false;
              obj.element.classList.remove('stuck');
            }
          }
        }
      }
    }
  }

  // Debounced scroll handling
  function updateScrollPos() {
    lastKnownScrollTop = document.documentElement.scrollTop || document.body.scrollTop;

    // Only trigger a layout change if weâ€™re not already waiting for one
    if (!waitingForUpdate) {
      waitingForUpdate = true;
      // Donâ€™t update until next animation frame if we can, otherwise use a
      // timeout - either will help avoid too many repaints
      if (requestAnimationFrame) {
        requestAnimationFrame(setPositions);
      }
      else {
        setTimeout(setPositions, 15);
      }
    }
  }
  window.addEventListener('scroll', updateScrollPos);

  window.addEventListener('load', function () {
    var styles = slice.call(document.querySelectorAll('style'));
    styles.forEach(function (style) {
      var text = style.textContent || style.innerText;
      parse(text);
    });
    var links = slice.call(document.querySelectorAll('link'));
    links.forEach(function (link) {
      if(link.getAttribute('rel') !== 'stylesheet') {
        return;
      }
      var href = link.getAttribute('href'),
          req = new XMLHttpRequest();
      req.open('GET', href, true);
      req.onload = function (e) {
        parse(req.responseText);

        // Update once stylesheet loaded, in case page loaded with a scroll offset
        updateScrollPos();
      };
      req.send();
    });
  }, false);
})();
(function(){var t=this;(function(){(function(){var t=[].slice;this.LocalTime={config:{},run:function(){return this.getController().processElements()},process:function(){var e,n,r,a;for(n=1<=arguments.length?t.call(arguments,0):[],r=0,a=n.length;r<a;r++)e=n[r],this.getController().processElement(e);return n.length},getController:function(){return null!=this.controller?this.controller:this.controller=new e.Controller}}}).call(this)}).call(t);var e=t.LocalTime;(function(){(function(){e.config.i18n={en:{date:{dayNames:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],abbrDayNames:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],monthNames:["January","February","March","April","May","June","July","August","September","October","November","December"],abbrMonthNames:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],yesterday:"yesterday",today:"today",tomorrow:"tomorrow",on:"on {date}",formats:{"default":"%b %e, %Y",thisYear:"%b %e"}},time:{am:"am",pm:"pm",singular:"a {time}",singularAn:"an {time}",elapsed:"{time} ago",second:"second",seconds:"seconds",minute:"minute",minutes:"minutes",hour:"hour",hours:"hours",formats:{"default":"%l:%M%P"}},datetime:{at:"{date} at {time}",formats:{"default":"%B %e, %Y at %l:%M%P %Z"}}}}}).call(this),function(){e.config.locale="en",e.config.defaultLocale="en"}.call(this),function(){e.config.timerInterval=6e4}.call(this),function(){var t,n,r;r=!isNaN(Date.parse("2011-01-01T12:00:00-05:00")),e.parseDate=function(t){return t=t.toString(),r||(t=n(t)),new Date(Date.parse(t))},t=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[-+]?[\d:]+)$/,n=function(e){var n,r,a,i,o,s,u,c,l;if(a=e.match(t))return a[0],c=a[1],o=a[2],n=a[3],r=a[4],i=a[5],u=a[6],l=a[7],"Z"!==l&&(s=l.replace(":","")),c+"/"+o+"/"+n+" "+r+":"+i+":"+u+" GMT"+[s]}}.call(this),function(){e.elementMatchesSelector=function(){var t,e,n,r,a,i;return t=document.documentElement,e=null!=(n=null!=(r=null!=(a=null!=(i=t.matches)?i:t.matchesSelector)?a:t.webkitMatchesSelector)?r:t.mozMatchesSelector)?n:t.msMatchesSelector,function(t,n){if((null!=t?t.nodeType:void 0)===Node.ELEMENT_NODE)return e.call(t,n)}}()}.call(this),function(){var t,n,r;t=e.config,r=t.i18n,e.getI18nValue=function(a,i){var o,s;return null==a&&(a=""),o=(null!=i?i:{locale:t.locale}).locale,s=n(r[o],a),null!=s?s:o!==t.defaultLocale?e.getI18nValue(a,{locale:t.defaultLocale}):void 0},e.translate=function(t,n,r){var a,i,o;null==n&&(n={}),o=e.getI18nValue(t,r);for(a in n)i=n[a],o=o.replace("{"+a+"}",i);return o},n=function(t,e){var n,r,a,i,o;for(o=t,i=e.split("."),n=0,a=i.length;n<a;n++){if(r=i[n],null==o[r])return null;o=o[r]}return o}}.call(this),function(){var t,n,r,a,i;t=e.getI18nValue,i=e.translate,e.strftime=a=function(e,o){var s,u,c,l,d,h,f;return u=e.getDay(),s=e.getDate(),d=e.getMonth(),f=e.getFullYear(),c=e.getHours(),l=e.getMinutes(),h=e.getSeconds(),o.replace(/%([%aAbBcdeHIlmMpPSwyYZ])/g,function(o){switch(o[0],o[1]){case"%":return"%";case"a":return t("date.abbrDayNames")[u];case"A":return t("date.dayNames")[u];case"b":return t("date.abbrMonthNames")[d];case"B":return t("date.monthNames")[d];case"c":return e.toString();case"d":return n(s);case"e":return s;case"H":return n(c);case"I":return n(a(e,"%l"));case"l":return 0===c||12===c?12:(c+12)%12;case"m":return n(d+1);case"M":return n(l);case"p":return i("time."+(c>11?"pm":"am")).toUpperCase();case"P":return i("time."+(c>11?"pm":"am"));case"S":return n(h);case"w":return u;case"y":return n(f%100);case"Y":return f;case"Z":return r(e)}})},n=function(t){return("0"+t).slice(-2)},r=function(t){var e,n,r,a,i;return i=t.toString(),(e=null!=(n=i.match(/\(([\w\s]+)\)$/))?n[1]:void 0)?/\s/.test(e)?e.match(/\b(\w)/g).join(""):e:(e=null!=(r=i.match(/(\w{3,4})\s\d{4}$/))?r[1]:void 0)?e:(e=null!=(a=i.match(/(UTC[\+\-]\d+)/))?a[1]:void 0)?e:""}}.call(this),function(){e.CalendarDate=function(){function t(t,e,n){this.date=new Date(Date.UTC(t,e-1)),this.date.setUTCDate(n),this.year=this.date.getUTCFullYear(),this.month=this.date.getUTCMonth()+1,this.day=this.date.getUTCDate(),this.value=this.date.getTime()}return t.fromDate=function(t){return new this(t.getFullYear(),t.getMonth()+1,t.getDate())},t.today=function(){return this.fromDate(new Date)},t.prototype.equals=function(t){return(null!=t?t.value:void 0)===this.value},t.prototype.is=function(t){return this.equals(t)},t.prototype.isToday=function(){return this.is(this.constructor.today())},t.prototype.occursOnSameYearAs=function(t){return this.year===(null!=t?t.year:void 0)},t.prototype.occursThisYear=function(){return this.occursOnSameYearAs(this.constructor.today())},t.prototype.daysSince=function(t){if(t)return(this.date-t.date)/864e5},t.prototype.daysPassed=function(){return this.constructor.today().daysSince(this)},t}()}.call(this),function(){var t,n,r;n=e.strftime,r=e.translate,t=e.getI18nValue,e.RelativeTime=function(){function a(t){this.date=t,this.calendarDate=e.CalendarDate.fromDate(this.date)}return a.prototype.toString=function(){var t,e;return(e=this.toTimeElapsedString())?r("time.elapsed",{time:e}):(t=this.toWeekdayString())?(e=this.toTimeString(),r("datetime.at",{date:t,time:e})):r("date.on",{date:this.toDateString()})},a.prototype.toTimeOrDateString=function(){return this.calendarDate.isToday()?this.toTimeString():this.toDateString()},a.prototype.toTimeElapsedString=function(){var t,e,n,a,i;return n=(new Date).getTime()-this.date.getTime(),a=Math.round(n/1e3),e=Math.round(a/60),t=Math.round(e/60),n<0?null:a<10?(i=r("time.second"),r("time.singular",{time:i})):a<45?a+" "+r("time.seconds"):a<90?(i=r("time.minute"),r("time.singular",{time:i})):e<45?e+" "+r("time.minutes"):e<90?(i=r("time.hour"),r("time.singularAn",{time:i})):t<24?t+" "+r("time.hours"):""},a.prototype.toWeekdayString=function(){switch(this.calendarDate.daysPassed()){case 0:return r("date.today");case 1:return r("date.yesterday");case-1:return r("date.tomorrow");case 2:case 3:case 4:case 5:case 6:return n(this.date,"%A");default:return""}},a.prototype.toDateString=function(){var e;return e=t(this.calendarDate.occursThisYear()?"date.formats.thisYear":"date.formats.default"),n(this.date,e)},a.prototype.toTimeString=function(){return n(this.date,t("time.formats.default"))},a}()}.call(this),function(){var t,n=function(t,e){return function(){return t.apply(e,arguments)}};t=e.elementMatchesSelector,e.PageObserver=function(){function e(t,e){this.selector=t,this.callback=e,this.processInsertion=n(this.processInsertion,this),this.processMutations=n(this.processMutations,this)}return e.prototype.start=function(){if(!this.started)return this.observeWithMutationObserver()||this.observeWithMutationEvent(),this.started=!0},e.prototype.observeWithMutationObserver=function(){var t;if("undefined"!=typeof MutationObserver&&null!==MutationObserver)return t=new MutationObserver(this.processMutations),t.observe(document.documentElement,{childList:!0,subtree:!0}),!0},e.prototype.observeWithMutationEvent=function(){return addEventListener("DOMNodeInserted",this.processInsertion,!1),!0},e.prototype.findSignificantElements=function(e){var n;return n=[],(null!=e?e.nodeType:void 0)===Node.ELEMENT_NODE&&(t(e,this.selector)&&n.push(e),n.push.apply(n,e.querySelectorAll(this.selector))),n},e.prototype.processMutations=function(t){var e,n,r,a,i,o,s,u;for(e=[],n=0,a=t.length;n<a;n++)switch(o=t[n],o.type){case"childList":for(u=o.addedNodes,r=0,i=u.length;r<i;r++)s=u[r],e.push.apply(e,this.findSignificantElements(s))}return this.notify(e)},e.prototype.processInsertion=function(t){var e;return e=this.findSignificantElements(t.target),this.notify(e)},e.prototype.notify=function(t){if(null!=t?t.length:void 0)return"function"==typeof this.callback?this.callback(t):void 0},e}()}.call(this),function(){var t,n,r,a,i=function(t,e){return function(){return t.apply(e,arguments)}};r=e.parseDate,a=e.strftime,n=e.getI18nValue,t=e.config,e.Controller=function(){function o(){this.processElements=i(this.processElements,this),this.pageObserver=new e.PageObserver(s,this.processElements)}var s,u,c;return s="time[data-local]:not([data-localized])",o.prototype.start=function(){if(!this.started)return this.processElements(),this.startTimer(),this.pageObserver.start(),this.started=!0},o.prototype.startTimer=function(){var e;if(e=t.timerInterval)return null!=this.timer?this.timer:this.timer=setInterval(this.processElements,e)},o.prototype.processElements=function(t){var e,n,r;for(null==t&&(t=document.querySelectorAll(s)),n=0,r=t.length;n<r;n++)e=t[n],this.processElement(e);return t.length},o.prototype.processElement=function(t){var e,i,o,s,l;if(e=t.getAttribute("datetime"),i=t.getAttribute("data-format"),o=t.getAttribute("data-local"),s=r(e),!isNaN(s))return t.hasAttribute("title")||(l=a(s,n("datetime.formats.default")),t.setAttribute("title",l)),t.textContent=function(){switch(o){case"time":return u(t),a(s,i);case"date":return u(t),c(s).toDateString();case"time-ago":return c(s).toString();case"time-or-date":return c(s).toTimeOrDateString();case"weekday":return c(s).toWeekdayString();case"weekday-or-date":return c(s).toWeekdayString()||c(s).toDateString()}}()},u=function(t){return t.setAttribute("data-localized","")},c=function(t){return new e.RelativeTime(t)},o}()}.call(this),function(){var t,n,r,a;a=!1,t=function(){return document.attachEvent?"complete"===document.readyState:"loading"!==document.readyState},n=function(t){var e;return null!=(e="function"==typeof requestAnimationFrame?requestAnimationFrame(t):void 0)?e:setTimeout(t,17)},r=function(){var t;return t=e.getController(),t.start()},e.start=function(){if(!a)return a=!0,"undefined"!=typeof MutationObserver&&null!==MutationObserver||t()?r():n(r)},window.LocalTime===e&&e.start()}.call(this)}).call(this),"object"==typeof module&&module.exports?module.exports=e:"function"==typeof define&&define.amd&&define(e)}).call(this);


















document.observe("dom:loaded", function() {
  new DimZum.Controller({
    prefix: "post",
    shade:  { background: "#000" },
    window: { controls: $("dim_zum_controls") }
  });
});