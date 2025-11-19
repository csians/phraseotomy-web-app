import {
  require_AppLink,
  require_Button,
  require_ButtonGroup,
  require_Cart,
  require_ChannelMenu,
  require_Client,
  require_ContextualSaveBar,
  require_Error,
  require_Error2,
  require_FeedbackModal,
  require_Fullscreen,
  require_History,
  require_LeaveConfirmation,
  require_Loading,
  require_Modal,
  require_NavigationMenu,
  require_Picker,
  require_Print,
  require_Redirect,
  require_ResourcePicker,
  require_Scanner,
  require_TitleBar,
  require_Toast,
  require_WebVitals,
  require_collection,
  require_env,
  require_env2,
  require_helper,
  require_helper2,
  require_types2 as require_types,
  require_types3 as require_types2,
  require_validator
} from "./chunk-VMYYKUHW.js";
import {
  __commonJS
} from "./chunk-HXA6O6EE.js";

// node_modules/@shopify/app-bridge-core/MessageTransport.js
var require_MessageTransport = __commonJS({
  "node_modules/@shopify/app-bridge-core/MessageTransport.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createTransportListener = exports.fromWindow = exports.fromFrame = exports.Context = void 0;
    var Error_1 = require_Error();
    var validator_1 = require_validator();
    var types_1 = require_types2();
    var collection_1 = require_collection();
    var env_1 = require_env();
    var Context;
    (function(Context2) {
      Context2["Modal"] = "Modal";
      Context2["Main"] = "Main";
    })(Context = exports.Context || (exports.Context = {}));
    function fromFrame(frame, localOrigin, context) {
      var handlers = [];
      var host = frame.host, frameWindow = frame.window;
      if (!host) {
        throw Error_1.fromAction("App frame is undefined", Error_1.AppActionType.WINDOW_UNDEFINED);
      }
      if (env_1.isUnframed && window.MobileWebView) {
        Object.assign(window.MobileWebView, {
          postMessageToIframe: function(message, origin) {
            frameWindow === null || frameWindow === void 0 ? void 0 : frameWindow.postMessage(message, origin);
            if (isDispatchAction(message)) {
              host.postMessage(JSON.stringify(message.payload), location.origin);
            }
          },
          updateIframeUrl: function(newUrl) {
            var currentWindowLocation = window.location;
            var frameWindowLocation = (frame.window || {}).location;
            try {
              var newUrlOrigin = new URL(newUrl).origin;
              if (newUrlOrigin === localOrigin && frameWindowLocation) {
                frameWindowLocation.replace(newUrl);
              } else {
                currentWindowLocation.href = newUrl;
              }
            } catch (_) {
            }
          }
        });
      }
      host.addEventListener("message", function(event) {
        if (event.source === host || !validator_1.isAppMessage(event)) {
          return;
        }
        if (event.origin !== localOrigin) {
          var errorMessage = "Message origin '" + event.origin + "' does not match app origin '" + localOrigin + "'.";
          var payload = Error_1.invalidOriginAction(errorMessage);
          var message = {
            type: "dispatch",
            payload
          };
          frameWindow === null || frameWindow === void 0 ? void 0 : frameWindow.postMessage(message, event.origin);
          return;
        }
        if (env_1.isUnframed && window.MobileWebView) {
          var payload = JSON.stringify({
            id: "unframed://fromClient",
            origin: localOrigin,
            data: event.data
          });
          window.MobileWebView.postMessage(payload);
          return;
        }
        for (var _i = 0, handlers_1 = handlers; _i < handlers_1.length; _i++) {
          var handler = handlers_1[_i];
          handler(event);
        }
      });
      return {
        context,
        localOrigin,
        frameWindow,
        hostFrame: host,
        dispatch: function(message) {
          frameWindow === null || frameWindow === void 0 ? void 0 : frameWindow.postMessage(message, localOrigin);
        },
        subscribe: function(handler) {
          return collection_1.addAndRemoveFromCollection(handlers, handler);
        }
      };
    }
    exports.fromFrame = fromFrame;
    function fromWindow(contentWindow, localOrigin) {
      var handlers = [];
      if (typeof window !== void 0) {
        window.addEventListener("message", function(event) {
          if (window === contentWindow && !env_1.isUnframed || event.source !== contentWindow || !(validator_1.isAppBridgeAction(event.data.payload) || validator_1.isAppMessage(event))) {
            return;
          }
          for (var _i = 0, handlers_2 = handlers; _i < handlers_2.length; _i++) {
            var handler = handlers_2[_i];
            handler(event);
          }
        });
      }
      return {
        localOrigin,
        hostFrame: contentWindow,
        dispatch: function(message) {
          var _a;
          if (!((_a = message.source) === null || _a === void 0 ? void 0 : _a.host)) {
            return;
          }
          if (env_1.isUnframed && window && window.MobileWebView) {
            var payload = JSON.stringify({
              id: "unframed://fromClient",
              origin: localOrigin,
              data: message
            });
            window.MobileWebView.postMessage(payload);
            return;
          }
          var messageOrigin = new URL("https://" + message.source.host).origin;
          contentWindow.postMessage(message, messageOrigin);
        },
        subscribe: function(handler) {
          return collection_1.addAndRemoveFromCollection(handlers, handler);
        }
      };
    }
    exports.fromWindow = fromWindow;
    function createTransportListener() {
      var listeners = [];
      var actionListeners = {};
      function createSubscribeHandler(dispatcher) {
        function subscribe() {
          if (arguments.length < 2) {
            return collection_1.addAndRemoveFromCollection(listeners, { callback: arguments[0] });
          }
          var _a = Array.from(arguments), type = _a[0], callback = _a[1], id = _a[2];
          var actionCallback = { callback, id };
          var payload = { type, id };
          if (!Object.prototype.hasOwnProperty.call(actionListeners, type)) {
            actionListeners[type] = [];
          }
          if (dispatcher) {
            dispatcher(types_1.MessageType.Subscribe, payload);
          }
          return collection_1.addAndRemoveFromCollection(actionListeners[type], actionCallback, function() {
            if (dispatcher) {
              dispatcher(types_1.MessageType.Unsubscribe, payload);
            }
          });
        }
        return subscribe;
      }
      return {
        createSubscribeHandler,
        handleMessage: function(message) {
          listeners.forEach(function(listener) {
            return listener.callback(message);
          });
        },
        handleActionDispatch: function(_a) {
          var type = _a.type, payload = _a.payload;
          var hasCallback = false;
          if (Object.prototype.hasOwnProperty.call(actionListeners, type)) {
            for (var _i = 0, _b = actionListeners[type]; _i < _b.length; _i++) {
              var listener = _b[_i];
              var id = listener.id, callback = listener.callback;
              var matchId = payload && payload.id === id;
              if (matchId || !id) {
                callback(payload);
                hasCallback = true;
              }
            }
          }
          return hasCallback;
        }
      };
    }
    exports.createTransportListener = createTransportListener;
    function isDispatchAction(message) {
      return message !== null && typeof message === "object" && !Array.isArray(message) && message.type === "dispatch" && typeof message.payload === "object";
    }
  }
});

// node_modules/@shopify/app-bridge/MessageTransport.js
var require_MessageTransport2 = __commonJS({
  "node_modules/@shopify/app-bridge/MessageTransport.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_MessageTransport(), exports);
  }
});

// node_modules/@shopify/app-bridge/util/shared.js
var require_shared = __commonJS({
  "node_modules/@shopify/app-bridge/util/shared.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mockAppBridge = exports.serverAppBridge = void 0;
    var Error_1 = require_Error2();
    var noop = function() {
    };
    var noopPromise = new Promise(function() {
    });
    exports.serverAppBridge = {
      dispatch: function() {
        return {};
      },
      error: function() {
        return noop;
      },
      featuresAvailable: function() {
        return Promise.reject(Error_1.fromAction("Feature detection is only available on the client side.", Error_1.AppActionType.WINDOW_UNDEFINED));
      },
      getState: function() {
        return Promise.reject(Error_1.fromAction("State is only available on the client side.", Error_1.AppActionType.WINDOW_UNDEFINED));
      },
      localOrigin: "",
      hostOrigin: "",
      subscribe: function() {
        return noop;
      }
    };
    exports.mockAppBridge = {
      dispatch: function() {
        return {};
      },
      error: function() {
        return noop;
      },
      featuresAvailable: function() {
        return noopPromise;
      },
      getState: function() {
        return noopPromise;
      },
      localOrigin: "",
      hostOrigin: "",
      subscribe: function() {
        return noop;
      }
    };
  }
});

// node_modules/@shopify/app-bridge/client/redirect.js
var require_redirect = __commonJS({
  "node_modules/@shopify/app-bridge/client/redirect.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getWindow = exports.getLocation = exports.redirect = exports.shouldRedirect = void 0;
    function shouldRedirect(frame) {
      return frame === window;
    }
    exports.shouldRedirect = shouldRedirect;
    function redirect(url) {
      var location2 = getLocation();
      if (!location2) {
        return;
      }
      location2.assign(url);
    }
    exports.redirect = redirect;
    function getLocation() {
      return hasWindow() ? window.location : void 0;
    }
    exports.getLocation = getLocation;
    function getWindow() {
      return hasWindow() ? window : void 0;
    }
    exports.getWindow = getWindow;
    function hasWindow() {
      return typeof window !== "undefined";
    }
  }
});

// node_modules/@shopify/app-bridge/client/print.js
var require_print = __commonJS({
  "node_modules/@shopify/app-bridge/client/print.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.handleAppPrint = void 0;
    var redirect_1 = require_redirect();
    function isRunningOniOS() {
      return navigator.userAgent.indexOf("iOS") >= 0;
    }
    function createHiddenInput() {
      var currentWindow = redirect_1.getWindow();
      if (!currentWindow || !currentWindow.document || !currentWindow.document.body) {
        return;
      }
      var inputElement = currentWindow.document.createElement("input");
      inputElement.style.display = "none";
      currentWindow.document.body.appendChild(inputElement);
      return inputElement;
    }
    function printWindow() {
      var _a;
      (_a = redirect_1.getWindow()) === null || _a === void 0 ? void 0 : _a.print();
    }
    function handleMobileAppPrint() {
      var input = createHiddenInput();
      if (!input) {
        return;
      }
      input.select();
      printWindow();
      input.remove();
    }
    function handleAppPrint() {
      if (isRunningOniOS()) {
        handleMobileAppPrint();
      } else {
        printWindow();
      }
    }
    exports.handleAppPrint = handleAppPrint;
  }
});

// node_modules/@shopify/app-bridge/client/types.js
var require_types3 = __commonJS({
  "node_modules/@shopify/app-bridge/client/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isV1Config = exports.MessageType = exports.LifecycleHook = exports.PermissionType = void 0;
    var types_1 = require_types2();
    Object.defineProperty(exports, "MessageType", { enumerable: true, get: function() {
      return types_1.MessageType;
    } });
    var types_2 = require_types2();
    Object.defineProperty(exports, "PermissionType", { enumerable: true, get: function() {
      return types_2.PermissionType;
    } });
    Object.defineProperty(exports, "LifecycleHook", { enumerable: true, get: function() {
      return types_2.LifecycleHook;
    } });
    function isV1Config(config) {
      return !config.host;
    }
    exports.isV1Config = isV1Config;
  }
});

// node_modules/@shopify/app-bridge/util/collection.js
var require_collection2 = __commonJS({
  "node_modules/@shopify/app-bridge/util/collection.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.removeFromCollection = exports.addAndRemoveFromCollection = void 0;
    var collection_1 = require_collection();
    Object.defineProperty(exports, "addAndRemoveFromCollection", { enumerable: true, get: function() {
      return collection_1.addAndRemoveFromCollection;
    } });
    Object.defineProperty(exports, "removeFromCollection", { enumerable: true, get: function() {
      return collection_1.removeFromCollection;
    } });
  }
});

// node_modules/@shopify/app-bridge/client/Hooks.js
var require_Hooks = __commonJS({
  "node_modules/@shopify/app-bridge/client/Hooks.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var collection_1 = require_collection2();
    var Hooks = (
      /** @class */
      function() {
        function Hooks2() {
          this.map = {};
        }
        Hooks2.prototype.set = function(hook, handler) {
          if (!Object.prototype.hasOwnProperty.call(this.map, hook)) {
            this.map[hook] = [];
          }
          var value = { handler, remove: function() {
          } };
          var remove = collection_1.addAndRemoveFromCollection(this.map[hook], value);
          value = { handler, remove };
          return remove;
        };
        Hooks2.prototype.get = function(hook) {
          var value = this.map[hook];
          return value ? value.map(function(val) {
            return val.handler;
          }) : void 0;
        };
        Hooks2.prototype.run = function(hook, final, context) {
          var initialArgs = [];
          for (var _i = 3; _i < arguments.length; _i++) {
            initialArgs[_i - 3] = arguments[_i];
          }
          var index = 0;
          var handlers = this.get(hook) || [];
          function handler() {
            var args = [];
            for (var _i2 = 0; _i2 < arguments.length; _i2++) {
              args[_i2] = arguments[_i2];
            }
            var childHandler = handlers[index++];
            if (childHandler) {
              return childHandler(handler).apply(context, args);
            }
            return final.apply(context, args);
          }
          return handler.apply(context, initialArgs);
        };
        return Hooks2;
      }()
    );
    exports.default = Hooks;
  }
});

// node_modules/@shopify/app-bridge/client/Client.js
var require_Client2 = __commonJS({
  "node_modules/@shopify/app-bridge/client/Client.js"(exports) {
    "use strict";
    var __assign = exports && exports.__assign || function() {
      __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
        }
        return t;
      };
      return __assign.apply(this, arguments);
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
      return to;
    };
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createApp = exports.createAppWrapper = exports.createClientApp = exports.WINDOW_UNDEFINED_MESSAGE = void 0;
    var helper_1 = require_helper2();
    var Print_1 = require_Print();
    var Error_1 = require_Error2();
    var MessageTransport_1 = require_MessageTransport2();
    var shared_1 = require_shared();
    var env_1 = require_env2();
    var Client_1 = require_Client();
    var WebVitals_1 = require_WebVitals();
    var print_1 = require_print();
    var redirect_1 = require_redirect();
    var types_1 = require_types3();
    var Hooks_1 = __importDefault(require_Hooks());
    exports.WINDOW_UNDEFINED_MESSAGE = "window is not defined. Running an app outside a browser is not supported";
    function redirectHandler(hostFrame, config) {
      var apiKey = config.apiKey, host = config.host, _a = config.forceRedirect, forceRedirect = _a === void 0 ? !env_1.isDevelopmentClient : _a;
      var location2 = redirect_1.getLocation();
      if (env_1.isUnframed || !location2 || !apiKey || !host || !forceRedirect || !redirect_1.shouldRedirect(hostFrame)) {
        return false;
      }
      var url = "https://" + host + "/apps/" + apiKey + location2.pathname + (location2.search || "");
      redirect_1.redirect(url);
      return true;
    }
    var actionWrapper = function(next) {
      return function(action) {
        return next(__assign(__assign({}, action), { version: helper_1.getVersion(), clientInterface: {
          name: helper_1.getPackageName(),
          version: helper_1.getVersion()
        } }));
      };
    };
    var actionWrappingMiddleware = function(hooks) {
      hooks.set(types_1.LifecycleHook.DispatchAction, actionWrapper);
    };
    function appSetUp(app) {
      app.subscribe(Print_1.Action.APP, print_1.handleAppPrint);
      app.dispatch(Client_1.initialize());
      try {
        WebVitals_1.initializeWebVitals(app);
      } catch (err) {
        console.error("App-Bridge failed to initialize web-vitals", err);
      }
    }
    var createClientApp = function(transport, middlewares) {
      if (middlewares === void 0) {
        middlewares = [];
      }
      var getStateListeners = [];
      var transportListener = MessageTransport_1.createTransportListener();
      var handler = function(event) {
        var message = event.data;
        var type = message.type, payload = message.payload;
        switch (type) {
          case "getState": {
            var resolvers = getStateListeners.splice(0);
            resolvers.forEach(function(resolver) {
              return resolver(payload);
            });
            break;
          }
          case "dispatch": {
            transportListener.handleMessage(payload);
            var hasCallback = transportListener.handleActionDispatch(payload);
            if (hasCallback) {
              return;
            }
            var errorType = helper_1.findMatchInEnum(Error_1.Action, payload.type);
            if (errorType) {
              Error_1.throwError(errorType, payload);
            }
            break;
          }
          default:
        }
      };
      transport.subscribe(handler);
      return function(config) {
        var decodedConfig = validateAndDecodeConfig(config);
        var isRedirecting = redirectHandler(transport.hostFrame, decodedConfig);
        if (isRedirecting) {
          return shared_1.mockAppBridge;
        }
        var dispatcher = createDispatcher(transport, decodedConfig);
        var subscribe = transportListener.createSubscribeHandler(dispatcher);
        dispatcher(types_1.MessageType.Unsubscribe);
        function dispatch(action) {
          dispatcher(types_1.MessageType.Dispatch, action);
          return action;
        }
        var hostOrigin = new URL("https://" + decodedConfig.host).origin;
        var hooks = new Hooks_1.default();
        var app = {
          hostOrigin,
          localOrigin: transport.localOrigin,
          hooks,
          dispatch: function(action) {
            if (!app.hooks) {
              return dispatch(action);
            }
            return app.hooks.run(types_1.LifecycleHook.DispatchAction, dispatch, app, action);
          },
          featuresAvailable: function() {
            var features = [];
            for (var _i2 = 0; _i2 < arguments.length; _i2++) {
              features[_i2] = arguments[_i2];
            }
            var firstItem = features[0];
            var parsedFeatures = Array.isArray(firstItem) ? __spreadArray([], firstItem) : features;
            return app.getState("features").then(function(state) {
              if (parsedFeatures.length) {
                return parsedFeatures.reduce(function(acc, feature) {
                  if (Object.keys(state).includes(feature)) {
                    acc[feature] = state[feature];
                  }
                  return acc;
                }, {});
              }
              return state;
            });
          },
          getState: function(query) {
            if (query && typeof query !== "string") {
              return Promise.resolve(void 0);
            }
            return new Promise(function(resolve) {
              getStateListeners.push(resolve);
              dispatcher(types_1.MessageType.GetState);
            }).then(function(state) {
              var newState = state;
              if (query) {
                for (var _i2 = 0, _a = query.split("."); _i2 < _a.length; _i2++) {
                  var key = _a[_i2];
                  if (newState == null || typeof newState !== "object" || Array.isArray(newState) || !Object.keys(newState).includes(key)) {
                    return void 0;
                  }
                  newState = newState[key];
                }
              }
              return newState;
            });
          },
          subscribe,
          error: function(listener, id) {
            var unsubscribeCb = [];
            helper_1.forEachInEnum(Error_1.Action, function(eventNameSpace) {
              unsubscribeCb.push(subscribe(eventNameSpace, listener, id));
            });
            return function() {
              unsubscribeCb.forEach(function(unsubscribe) {
                return unsubscribe();
              });
            };
          }
        };
        for (var _i = 0, middlewares_1 = middlewares; _i < middlewares_1.length; _i++) {
          var middleware = middlewares_1[_i];
          middleware(hooks, app);
        }
        appSetUp(app);
        return app;
      };
    };
    exports.createClientApp = createClientApp;
    function validateAndDecodeConfig(config) {
      var _a;
      if (!config.host) {
        throw Error_1.fromAction("host must be provided", Error_1.AppActionType.INVALID_CONFIG);
      }
      if (!config.apiKey) {
        throw Error_1.fromAction("apiKey must be provided", Error_1.AppActionType.INVALID_CONFIG);
      }
      try {
        var host = atob((_a = config.host) === null || _a === void 0 ? void 0 : _a.replace(/_/g, "/").replace(/-/g, "+"));
        return __assign(__assign({}, config), { host });
      } catch (_b) {
        var message = "not a valid host, please use the value provided by Shopify";
        throw Error_1.fromAction(message, Error_1.AppActionType.INVALID_CONFIG);
      }
    }
    function createAppWrapper(frame, localOrigin, middleware) {
      if (middleware === void 0) {
        middleware = [];
      }
      if (!frame) {
        throw Error_1.fromAction(exports.WINDOW_UNDEFINED_MESSAGE, Error_1.AppActionType.WINDOW_UNDEFINED);
      }
      var location2 = redirect_1.getLocation();
      var origin = localOrigin || location2 && location2.origin;
      if (!origin) {
        throw Error_1.fromAction("local origin cannot be blank", Error_1.AppActionType.MISSING_LOCAL_ORIGIN);
      }
      var transport = MessageTransport_1.fromWindow(frame, origin);
      var appCreator = exports.createClientApp(transport, __spreadArray([actionWrappingMiddleware], middleware));
      return appCreator;
    }
    exports.createAppWrapper = createAppWrapper;
    function createApp(config) {
      var currentWindow = redirect_1.getWindow();
      if (!currentWindow || !currentWindow.top) {
        return shared_1.serverAppBridge;
      }
      return createAppWrapper(currentWindow.top)(config);
    }
    exports.createApp = createApp;
    function createDispatcher(transport, config) {
      return function(type, payload) {
        transport.dispatch({
          payload,
          source: config,
          type
        });
      };
    }
    exports.default = createApp;
  }
});

// node_modules/@shopify/app-bridge/client/index.js
var require_client = __commonJS({
  "node_modules/@shopify/app-bridge/client/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    var Client_1 = require_Client2();
    __exportStar(require_types3(), exports);
    __exportStar(require_Client2(), exports);
    exports.default = Client_1.createClientApp;
  }
});

// node_modules/@shopify/app-bridge-core/validate/type-validate.js
var require_type_validate = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/type-validate.js"(exports) {
    "use strict";
    var __assign = exports && exports.__assign || function() {
      __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
        }
        return t;
      };
      return __assign.apply(this, arguments);
    };
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validate = exports.matchesPositiveInteger = exports.matchesBoolean = exports.makeOptional = exports.matchesString = exports.matchesObject = exports.getErrors = exports.oneOf = exports.matchesArray = exports.matchesEnum = exports.composeSchemas = exports.TYPE_ERROR = void 0;
    exports.TYPE_ERROR = "type_error_expected";
    function composeSchemas() {
      var validators = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        validators[_i] = arguments[_i];
      }
      return function(val) {
        var error;
        var i = 0;
        var len = validators.length;
        while (!error && i < len) {
          error = validators[i](val);
          if (error) {
            return error;
          }
          i++;
        }
      };
    }
    exports.composeSchemas = composeSchemas;
    function matchesEnum(types, options) {
      return function(value) {
        var values = Object.keys(types).map(function(key) {
          return types[key];
        });
        var message = options && options.message || "expected:" + values.map(function(val) {
          return "`" + val + "`";
        }).join(" or ");
        return values.includes(value) ? void 0 : constructErrors(value, "invalid_enum_value", __assign(__assign({}, options), { message }));
      };
    }
    exports.matchesEnum = matchesEnum;
    function matchesArray(validator, options) {
      return function(value) {
        if (!Array.isArray(value)) {
          return constructErrors(value, exports.TYPE_ERROR + "_array", options);
        }
        if (!validator) {
          return;
        }
        var errors = [];
        value.forEach(function(val, key) {
          var objectError = validator(val);
          if (objectError) {
            errors = errors.concat(objectError.map(function(error) {
              return __assign(__assign({}, error), { path: "['" + key + "']" + (error.path || "") });
            }));
          }
        });
        return errors.length ? errors : void 0;
      };
    }
    exports.matchesArray = matchesArray;
    function oneOf() {
      var validators = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        validators[_i] = arguments[_i];
      }
      return function(val) {
        var errors = [];
        for (var _i2 = 0, validators_1 = validators; _i2 < validators_1.length; _i2++) {
          var validator = validators_1[_i2];
          var result = validator(val);
          if (result == null)
            return result;
          errors.push.apply(errors, result);
        }
        return errors;
      };
    }
    exports.oneOf = oneOf;
    function constructErrors(value, error, options) {
      if (options === void 0) {
        options = { message: void 0 };
      }
      return [
        {
          value,
          error,
          message: typeof options.message === "function" ? options.message(error, value) : options.message
        }
      ];
    }
    function getErrors(obj, validator, key) {
      var value = key ? obj[key] : obj;
      var path = key ? "['" + key + "']" : void 0;
      var error = validator(value);
      if (!error) {
        return;
      }
      return error.map(function(errorObj) {
        return __assign(__assign({}, errorObj), { path: "" + (path || "") + (errorObj.path || "") || void 0 });
      });
    }
    exports.getErrors = getErrors;
    function matchesObject(schema, options) {
      return function(val) {
        if (typeof val !== "object" || !val || Array.isArray(val)) {
          return constructErrors(val, exports.TYPE_ERROR + "_object", options);
        }
        var flattened = Object.keys(schema).reduce(function(acc, key) {
          return __spreadArray(__spreadArray([], acc), getErrors(val, schema[key], key) || []);
        }, []);
        return flattened.length ? flattened : void 0;
      };
    }
    exports.matchesObject = matchesObject;
    function matchesString(options) {
      return function(value) {
        return typeof value === "string" ? void 0 : constructErrors(value, exports.TYPE_ERROR + "_string", options);
      };
    }
    exports.matchesString = matchesString;
    function makeOptional(validator) {
      return function(value) {
        if (value === void 0 || value === null) {
          return void 0;
        }
        return validator(value);
      };
    }
    exports.makeOptional = makeOptional;
    function matchesBoolean(options) {
      return function(value) {
        return typeof value === "boolean" ? void 0 : constructErrors(value, exports.TYPE_ERROR + "_boolean", options);
      };
    }
    exports.matchesBoolean = matchesBoolean;
    function matchesPositiveInteger(options) {
      return function(value) {
        return !Number.isInteger(value) || value < 0 ? constructErrors(value, exports.TYPE_ERROR + "_integer", options) : void 0;
      };
    }
    exports.matchesPositiveInteger = matchesPositiveInteger;
    function validate(obj, validator) {
      return getErrors(obj, validator);
    }
    exports.validate = validate;
  }
});

// node_modules/@shopify/app-bridge-core/validate/utils.js
var require_utils = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/utils.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.relativePathSchema = exports.relativeUrlSchema = exports.isValidRelativePath = exports.createActionValidator = void 0;
    var type_validate_1 = require_type_validate();
    function createActionValidator(type, payloadSchema, payloadRequired, idRequired) {
      if (payloadSchema === void 0) {
        payloadSchema = void 0;
      }
      if (payloadRequired === void 0) {
        payloadRequired = false;
      }
      if (idRequired === void 0) {
        idRequired = false;
      }
      var idSchema = type_validate_1.matchesObject({
        id: idRequired ? type_validate_1.matchesString() : type_validate_1.makeOptional(type_validate_1.matchesString())
      });
      var schema = payloadSchema ? type_validate_1.composeSchemas(idSchema, payloadSchema) : idSchema;
      return type_validate_1.matchesObject({
        type: type_validate_1.matchesEnum(type, {
          message: function(_, val) {
            return "The action type `" + val + "` is invalid or unsupported";
          }
        }),
        payload: payloadRequired ? schema : type_validate_1.makeOptional(schema)
      });
    }
    exports.createActionValidator = createActionValidator;
    function isValidRelativePath(path) {
      return typeof path === "string" && (path === "" || path.startsWith("/"));
    }
    exports.isValidRelativePath = isValidRelativePath;
    exports.relativeUrlSchema = type_validate_1.composeSchemas(type_validate_1.matchesString(), function(value) {
      return isValidRelativePath(value) ? void 0 : [{ error: "invalid_relative_path", value, message: "expected string to start with `/`" }];
    });
    exports.relativePathSchema = type_validate_1.matchesObject({
      path: exports.relativeUrlSchema
    });
  }
});

// node_modules/@shopify/app-bridge-core/validate/actions/button.js
var require_button = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/actions/button.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = exports.validateProps = exports.buttonSchemaWithId = exports.buttonSchema = void 0;
    var Button_1 = require_Button();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Button_1.Action;
    } });
    var type_validate_1 = require_type_validate();
    var utils_1 = require_utils();
    exports.buttonSchema = type_validate_1.matchesObject({
      disabled: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      label: type_validate_1.matchesString(),
      style: type_validate_1.makeOptional(type_validate_1.matchesEnum(Button_1.Style)),
      icon: type_validate_1.makeOptional(type_validate_1.matchesEnum(Button_1.Icon)),
      loading: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      plain: type_validate_1.makeOptional(type_validate_1.matchesBoolean())
    });
    exports.buttonSchemaWithId = type_validate_1.composeSchemas(type_validate_1.matchesObject({
      id: type_validate_1.matchesString()
    }), exports.buttonSchema);
    function validateProps(props) {
      return type_validate_1.validate(props, exports.buttonSchema);
    }
    exports.validateProps = validateProps;
    function validateAction(action) {
      var validator = utils_1.createActionValidator(Button_1.Action, action.type === Button_1.Action.UPDATE ? exports.buttonSchema : void 0, true, true);
      return type_validate_1.validate(action, validator);
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge-core/validate/actions/buttonGroup.js
var require_buttonGroup = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/actions/buttonGroup.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = exports.validateProps = exports.buttonGroupSchema = void 0;
    var ButtonGroup_1 = require_ButtonGroup();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return ButtonGroup_1.Action;
    } });
    var type_validate_1 = require_type_validate();
    var utils_1 = require_utils();
    var button_1 = require_button();
    exports.buttonGroupSchema = type_validate_1.composeSchemas(button_1.buttonSchema, type_validate_1.matchesObject({
      buttons: type_validate_1.matchesArray(type_validate_1.makeOptional(button_1.buttonSchemaWithId))
    }));
    function validateProps(props) {
      return type_validate_1.validate(props, exports.buttonGroupSchema);
    }
    exports.validateProps = validateProps;
    function validateAction(action) {
      var validator = utils_1.createActionValidator(ButtonGroup_1.Action, exports.buttonGroupSchema, true, true);
      return type_validate_1.validate(action, validator);
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge-core/validate/actions/contextualSaveBar.js
var require_contextualSaveBar = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/actions/contextualSaveBar.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = exports.validateProps = exports.contextSaveBarSchema = void 0;
    var type_validate_1 = require_type_validate();
    var ContextualSaveBar_1 = require_ContextualSaveBar();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return ContextualSaveBar_1.Action;
    } });
    var utils_1 = require_utils();
    exports.contextSaveBarSchema = type_validate_1.makeOptional(type_validate_1.matchesObject({
      fullWidth: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      discardAction: type_validate_1.makeOptional(type_validate_1.matchesObject({
        disabled: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
        discardConfirmationModal: type_validate_1.makeOptional(type_validate_1.matchesBoolean())
      })),
      saveAction: type_validate_1.makeOptional(type_validate_1.matchesObject({
        disabled: type_validate_1.makeOptional(type_validate_1.matchesBoolean())
      })),
      leaveConfirmationDisable: type_validate_1.makeOptional(type_validate_1.matchesBoolean())
    }));
    function validateProps(props) {
      return type_validate_1.validate(props, exports.contextSaveBarSchema);
    }
    exports.validateProps = validateProps;
    function validateAction(action) {
      var validator = utils_1.createActionValidator(ContextualSaveBar_1.Action, exports.contextSaveBarSchema);
      return type_validate_1.validate(action, validator);
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge-core/validate/actions/feedbackModal.js
var require_feedbackModal = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/actions/feedbackModal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = exports.validateProps = exports.feedbackModalSchema = void 0;
    var FeedbackModal_1 = require_FeedbackModal();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return FeedbackModal_1.Action;
    } });
    var type_validate_1 = require_type_validate();
    var utils_1 = require_utils();
    exports.feedbackModalSchema = type_validate_1.matchesObject({
      formId: type_validate_1.matchesPositiveInteger()
    });
    function validateProps(props) {
      return type_validate_1.validate(props, exports.feedbackModalSchema);
    }
    exports.validateProps = validateProps;
    function validateAction(action) {
      switch (action.type) {
        case FeedbackModal_1.Action.OPEN:
          return type_validate_1.validate(action, utils_1.createActionValidator(FeedbackModal_1.Action, exports.feedbackModalSchema, true));
        case FeedbackModal_1.Action.CLOSE:
        default:
          return type_validate_1.validate(action, utils_1.createActionValidator(FeedbackModal_1.Action));
      }
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge-core/validate/actions/leaveConfirmation.js
var require_leaveConfirmation = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/actions/leaveConfirmation.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = void 0;
    var LeaveConfirmation_1 = require_LeaveConfirmation();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return LeaveConfirmation_1.Action;
    } });
    var type_validate_1 = require_type_validate();
    var utils_1 = require_utils();
    function validateAction(action) {
      var validator = utils_1.createActionValidator(LeaveConfirmation_1.Action);
      return type_validate_1.validate(action, validator);
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge-core/validate/actions/link.js
var require_link = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/actions/link.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = exports.validateProps = exports.linkActionSchema = exports.linkPropsSchema = void 0;
    var AppLink_1 = require_AppLink();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return AppLink_1.Action;
    } });
    var type_validate_1 = require_type_validate();
    var utils_1 = require_utils();
    var AllowedRedirectType;
    (function(AllowedRedirectType2) {
      AllowedRedirectType2["APP"] = "APP::NAVIGATION::REDIRECT::APP";
      AllowedRedirectType2["LEGACY_APP"] = "APP";
    })(AllowedRedirectType || (AllowedRedirectType = {}));
    exports.linkPropsSchema = type_validate_1.matchesObject({
      label: type_validate_1.matchesString(),
      destination: utils_1.relativeUrlSchema,
      redirectType: type_validate_1.matchesEnum(AllowedRedirectType)
    });
    exports.linkActionSchema = type_validate_1.matchesObject({
      label: type_validate_1.matchesString(),
      destination: utils_1.relativePathSchema,
      redirectType: type_validate_1.matchesEnum(AllowedRedirectType)
    });
    function validateProps(props) {
      return type_validate_1.validate(props, exports.linkPropsSchema);
    }
    exports.validateProps = validateProps;
    function validateAction(action) {
      return type_validate_1.validate(action, utils_1.createActionValidator(AppLink_1.Action, exports.linkActionSchema, true, true));
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge-core/validate/actions/menu.js
var require_menu = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/actions/menu.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateAction = exports.validateProps = void 0;
    var NavigationMenu_1 = require_NavigationMenu();
    var ChannelMenu_1 = require_ChannelMenu();
    var type_validate_1 = require_type_validate();
    var utils_1 = require_utils();
    var helper_1 = require_helper();
    var link_1 = require_link();
    var linkOptionsValidator = type_validate_1.matchesObject({ id: type_validate_1.matchesString(), options: link_1.linkPropsSchema });
    function activeLinkError(value) {
      return [
        {
          error: "invalid_active_item",
          value,
          message: "expected active item to exist in menu items"
        }
      ];
    }
    function getOptionsSchema(options) {
      var baseSchema = type_validate_1.matchesObject({
        items: type_validate_1.makeOptional(type_validate_1.matchesArray(linkOptionsValidator)),
        active: type_validate_1.makeOptional(linkOptionsValidator)
      });
      var items = options.items, active = options.active;
      if (items && active) {
        var activeItemSchema = type_validate_1.matchesObject({
          active: type_validate_1.composeSchemas(linkOptionsValidator, function(value) {
            return items.find(function(item) {
              return item.id === value.id;
            }) ? void 0 : activeLinkError(value);
          })
        });
        return type_validate_1.composeSchemas(baseSchema, activeItemSchema);
      }
      return baseSchema;
    }
    function getPayloadSchema(payload) {
      var baseSchema = type_validate_1.matchesObject({
        items: type_validate_1.makeOptional(type_validate_1.matchesArray(link_1.linkActionSchema)),
        active: type_validate_1.makeOptional(type_validate_1.matchesString())
      });
      var items = payload.items, active = payload.active;
      if (items && active) {
        var activeItemSchema = type_validate_1.matchesObject({
          active: type_validate_1.composeSchemas(type_validate_1.matchesString(), function(value) {
            return items.find(function(item) {
              return item.id === value;
            }) ? void 0 : activeLinkError(value);
          })
        });
        return type_validate_1.composeSchemas(baseSchema, activeItemSchema);
      }
      return baseSchema;
    }
    function validateProps(props) {
      var result = type_validate_1.validate(props, getOptionsSchema(props));
      return result;
    }
    exports.validateProps = validateProps;
    function validateAction(action) {
      var actionType = NavigationMenu_1.Action;
      if (helper_1.findMatchInEnum(ChannelMenu_1.Action, action.type)) {
        actionType = ChannelMenu_1.Action;
      }
      return type_validate_1.validate(action, utils_1.createActionValidator(actionType, getPayloadSchema(action.payload), true, false));
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge-core/util/constants.js
var require_constants = __commonJS({
  "node_modules/@shopify/app-bridge-core/util/constants.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.INTERNAL_PROTOCOL = void 0;
    exports.INTERNAL_PROTOCOL = "shopify:";
  }
});

// node_modules/@shopify/app-bridge-core/validate/safe-redirect.js
var require_safe_redirect = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/safe-redirect.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isSafe = void 0;
    var constants_1 = require_constants();
    var FILE_URI_MATCH = /\/\/\//;
    var INVALID_RELATIVE_URL = /[/\\][/\\]/;
    var VALID_PROTOCOLS = ["https:", "http:"];
    var DUMMY_HOSTNAME = "http://test.com";
    function isSafe(redirectUrl, _a) {
      var _b = _a === void 0 ? {} : _a, _c = _b.allowedDomains, allowedDomains = _c === void 0 ? [] : _c, _d = _b.subdomains, subdomains = _d === void 0 ? [] : _d, matchPath = _b.matchPath, requireAbsolute = _b.requireAbsolute, requireSSL = _b.requireSSL, allowInternalProtocol = _b.allowInternalProtocol;
      if (FILE_URI_MATCH.test(redirectUrl)) {
        return false;
      }
      if (redirectUrl.startsWith("/")) {
        if (allowedDomains.length > 0 || subdomains.length > 0 || requireAbsolute || requireSSL) {
          return false;
        }
        if (matchPath) {
          return pathMatches(new URL(redirectUrl, DUMMY_HOSTNAME), redirectUrl, matchPath);
        }
        return !INVALID_RELATIVE_URL.test(redirectUrl);
      }
      var url;
      try {
        url = new URL(redirectUrl);
      } catch (error) {
        return false;
      }
      if (allowInternalProtocol && url.protocol === constants_1.INTERNAL_PROTOCOL) {
        return true;
      }
      if (!VALID_PROTOCOLS.includes(url.protocol)) {
        return false;
      }
      if (requireSSL && url.protocol !== "https:") {
        return false;
      }
      if (url.username || url.password) {
        return false;
      }
      if (matchPath && !pathMatches(url, redirectUrl, matchPath)) {
        return false;
      }
      if (!hostIsValid(url, allowedDomains, subdomains)) {
        return false;
      }
      return true;
    }
    exports.isSafe = isSafe;
    function hostIsValid(url, allowedDomains, subdomains) {
      if (!subdomains.every(function(subdomain) {
        return subdomain.startsWith(".");
      })) {
        throw new TypeError("Subdomains must begin with .");
      }
      var hostname = url.hostname;
      return allowedDomains.length === 0 && subdomains.length === 0 || allowedDomains.includes(hostname) || subdomains.some(function(subdomain) {
        return hostname.endsWith(subdomain);
      });
    }
    function pathMatches(url, originalUrl, matcher) {
      var pathname = url.pathname;
      var originalPathname = originalUrl.replace(url.origin, "").split("?")[0];
      return typeof matcher === "string" ? pathname === matcher && originalPathname === matcher : matcher.test(pathname) && matcher.test(originalPathname);
    }
  }
});

// node_modules/@shopify/app-bridge-core/validate/actions/modal.js
var require_modal = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/actions/modal.js"(exports) {
    "use strict";
    var __assign = exports && exports.__assign || function() {
      __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
        }
        return t;
      };
      return __assign.apply(this, arguments);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = exports.validateProps = void 0;
    var type_validate_1 = require_type_validate();
    var utils_1 = require_utils();
    var Modal_1 = require_Modal();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Modal_1.Action;
    } });
    var Button_1 = require_Button();
    var safe_redirect_1 = require_safe_redirect();
    var button_1 = require_button();
    function matchesSafeOrigin(value, localOrigin) {
      var hostName;
      try {
        hostName = new URL(localOrigin).hostname;
      } catch (error) {
        return [
          {
            error: "invalid_app_origin",
            value: localOrigin,
            message: "Provided value for app origin: `" + localOrigin + "` is invalid"
          }
        ];
      }
      var isSafeSrc = safe_redirect_1.isSafe(value, {
        requireAbsolute: true,
        requireSSL: true,
        allowInternalProtocol: true,
        allowedDomains: [hostName]
      });
      if (!isSafeSrc) {
        return [
          {
            error: "not_matching_app_origin",
            value,
            message: "Provided URL origin does not match app origin `" + hostName + "`"
          }
        ];
      }
    }
    function matchesSize() {
      return function(value) {
        var values = [Modal_1.Size.Small, Modal_1.Size.Medium, Modal_1.Size.Large];
        if (values.includes(value)) {
          return;
        }
        var message = "expected:" + values.map(function(val) {
          return "`" + val + "`";
        }).join(" or ");
        if (value === Modal_1.Size.Full) {
          message += ". Size `" + value + "` is deprecated as of version 1.6.5 and will fall back to size `medium`";
        }
        if (value === Modal_1.Size.Auto) {
          message += ". Size `" + value + "` is deprecated as of version 1.12.x and will fall back to size `medium`. Use the `setUpModalAutoSizing` utility from `app-bridge` instead";
        }
        return [
          {
            error: "invalid_enum_value",
            value,
            message
          }
        ];
      };
    }
    function getModalSchema(props, localOrigin) {
      if (props === void 0) {
        props = {};
      }
      var baseModalSchema = type_validate_1.matchesObject({
        title: type_validate_1.makeOptional(type_validate_1.matchesString()),
        footer: type_validate_1.makeOptional(type_validate_1.matchesObject({
          buttons: type_validate_1.matchesObject({
            primary: type_validate_1.makeOptional(button_1.buttonSchemaWithId),
            secondary: type_validate_1.makeOptional(type_validate_1.matchesArray(button_1.buttonSchemaWithId))
          })
        })),
        size: type_validate_1.makeOptional(matchesSize())
      });
      if (Modal_1.isIframeModal(props)) {
        if (props.url) {
          var urlSchema = type_validate_1.matchesObject({
            url: type_validate_1.composeSchemas(type_validate_1.matchesString(), function(value) {
              return localOrigin ? matchesSafeOrigin(value, localOrigin) : void 0;
            })
          });
          return type_validate_1.composeSchemas(baseModalSchema, urlSchema);
        }
        return type_validate_1.composeSchemas(baseModalSchema, utils_1.relativePathSchema);
      }
      return type_validate_1.composeSchemas(baseModalSchema, type_validate_1.matchesObject({ message: type_validate_1.matchesString() }));
    }
    function validateProps(props, localOrigin) {
      return type_validate_1.validate(props, getModalSchema(props, localOrigin));
    }
    exports.validateProps = validateProps;
    function validateAction(action, localOrigin) {
      var schema = getModalSchema(action.payload, localOrigin);
      switch (action.type) {
        case Modal_1.Action.OPEN:
        case Modal_1.Action.UPDATE:
          return type_validate_1.validate(action, utils_1.createActionValidator(Modal_1.Action, schema, true, action.type === Modal_1.Action.UPDATE));
        case Modal_1.Action.FOOTER_BUTTON_CLICK:
          return button_1.validateAction(__assign(__assign({}, action), { type: Button_1.Action.CLICK }));
        case Modal_1.Action.FOOTER_BUTTON_UPDATE:
          return button_1.validateAction(__assign(__assign({}, action), { type: Button_1.Action.UPDATE }));
        case Modal_1.Action.CLOSE:
        default:
          return type_validate_1.validate(action, utils_1.createActionValidator(Modal_1.Action));
      }
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge-core/validate/actions/navigation.js
var require_navigation = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/actions/navigation.js"(exports) {
    "use strict";
    var __assign = exports && exports.__assign || function() {
      __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
        }
        return t;
      };
      return __assign.apply(this, arguments);
    };
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateAction = exports.getSectionSchema = exports.matchesAbsolutePath = void 0;
    var History = __importStar(require_History());
    var Redirect = __importStar(require_Redirect());
    var type_validate_1 = require_type_validate();
    var utils_1 = require_utils();
    function matchesAbsolutePath(value) {
      return value.match("^https?://") ? void 0 : [
        {
          value,
          error: "invalid_absolute_url",
          message: "expected string to start with `https://` or `http://`"
        }
      ];
    }
    exports.matchesAbsolutePath = matchesAbsolutePath;
    function getSectionSchema(payload) {
      var isProductVariant = payload && payload.section && payload.section.resource && payload.section.name === Redirect.ResourceType.Product;
      var resourceSchema = {
        create: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
        id: type_validate_1.makeOptional(type_validate_1.matchesString())
      };
      var productVariantSchema = __assign(__assign({}, resourceSchema), { variant: type_validate_1.makeOptional(type_validate_1.matchesObject(resourceSchema)) });
      return type_validate_1.matchesObject({
        section: type_validate_1.matchesObject({
          name: type_validate_1.matchesEnum(Redirect.ResourceType),
          resource: type_validate_1.makeOptional(type_validate_1.matchesObject(isProductVariant ? productVariantSchema : resourceSchema))
        })
      });
    }
    exports.getSectionSchema = getSectionSchema;
    function validateAction(action) {
      var newContextSchema = type_validate_1.matchesObject({ newContext: type_validate_1.makeOptional(type_validate_1.matchesBoolean()) });
      var actionType = Redirect.Action;
      var schema;
      switch (action.type) {
        case History.Action.PUSH:
        case History.Action.REPLACE:
          actionType = History.Action;
          schema = utils_1.relativePathSchema;
          break;
        case Redirect.Action.APP:
          schema = utils_1.relativePathSchema;
          break;
        case Redirect.Action.REMOTE:
          schema = type_validate_1.composeSchemas(type_validate_1.matchesObject({
            url: type_validate_1.composeSchemas(type_validate_1.matchesString(), function(value) {
              return matchesAbsolutePath(value);
            })
          }), newContextSchema);
          break;
        case Redirect.Action.ADMIN_PATH:
          schema = type_validate_1.composeSchemas(utils_1.relativePathSchema, newContextSchema);
          break;
        case Redirect.Action.ADMIN_SECTION:
          schema = type_validate_1.composeSchemas(getSectionSchema(action.payload), newContextSchema);
          break;
      }
      return type_validate_1.validate(action, utils_1.createActionValidator(actionType, schema));
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge-core/validate/actions/resourcePicker.js
var require_resourcePicker = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/actions/resourcePicker.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = exports.validateProps = void 0;
    var ResourcePicker_1 = require_ResourcePicker();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return ResourcePicker_1.Action;
    } });
    var type_validate_1 = require_type_validate();
    var utils_1 = require_utils();
    var resourceSelectionSchema = type_validate_1.matchesArray(type_validate_1.matchesObject({
      id: type_validate_1.matchesString()
    }));
    var resourcePickerOptions = type_validate_1.matchesObject({
      initialQuery: type_validate_1.makeOptional(type_validate_1.matchesString()),
      filterQuery: type_validate_1.makeOptional(type_validate_1.matchesString()),
      initialSelectionIds: type_validate_1.makeOptional(resourceSelectionSchema),
      selectMultiple: type_validate_1.makeOptional(type_validate_1.oneOf(type_validate_1.matchesBoolean(), type_validate_1.matchesPositiveInteger())),
      showHidden: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      showVariants: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      showDraft: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      showArchived: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      showDraftBadge: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      showArchivedBadge: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      actionVerb: type_validate_1.makeOptional(type_validate_1.matchesEnum(ResourcePicker_1.ActionVerb))
    });
    var resourcePickerActionSchema = type_validate_1.matchesObject({
      resourceType: type_validate_1.matchesEnum(ResourcePicker_1.ResourceType),
      options: type_validate_1.makeOptional(resourcePickerOptions)
    });
    var selectionSchema = type_validate_1.matchesObject({
      selection: resourceSelectionSchema
    });
    function validateProps(props) {
      return type_validate_1.validate(props, resourcePickerOptions);
    }
    exports.validateProps = validateProps;
    function validateAction(action) {
      switch (action.type) {
        case ResourcePicker_1.Action.UPDATE:
        case ResourcePicker_1.Action.OPEN:
          return type_validate_1.validate(action, utils_1.createActionValidator(ResourcePicker_1.Action, resourcePickerActionSchema, false, true));
        case ResourcePicker_1.Action.SELECT:
          return type_validate_1.validate(action, utils_1.createActionValidator(ResourcePicker_1.Action, selectionSchema, true, true));
        case ResourcePicker_1.Action.CANCEL:
        case ResourcePicker_1.Action.CLOSE:
        default:
          return type_validate_1.validate(action, utils_1.createActionValidator(ResourcePicker_1.Action));
      }
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge-core/validate/actions/titleBar.js
var require_titleBar = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/actions/titleBar.js"(exports) {
    "use strict";
    var __assign = exports && exports.__assign || function() {
      __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
        }
        return t;
      };
      return __assign.apply(this, arguments);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = exports.validateProps = exports.titleBarSchema = void 0;
    var TitleBar_1 = require_TitleBar();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return TitleBar_1.Action;
    } });
    var Button_1 = require_Button();
    var ButtonGroup_1 = require_ButtonGroup();
    var type_validate_1 = require_type_validate();
    var utils_1 = require_utils();
    var button_1 = require_button();
    var buttonGroup_1 = require_buttonGroup();
    var buttonSchemaWithId = type_validate_1.composeSchemas(button_1.buttonSchema, type_validate_1.matchesObject({
      id: type_validate_1.matchesString()
    }));
    exports.titleBarSchema = type_validate_1.matchesObject({
      breadcrumbs: type_validate_1.makeOptional(button_1.buttonSchema),
      title: type_validate_1.makeOptional(type_validate_1.matchesString()),
      buttons: type_validate_1.makeOptional(type_validate_1.matchesObject({
        primary: type_validate_1.makeOptional(buttonSchemaWithId),
        secondary: type_validate_1.makeOptional(type_validate_1.matchesArray(type_validate_1.composeSchemas(buttonSchemaWithId, type_validate_1.matchesObject({
          buttons: type_validate_1.makeOptional(type_validate_1.matchesArray(buttonSchemaWithId))
        }))))
      }))
    });
    function validateProps(props) {
      return type_validate_1.validate(props, exports.titleBarSchema);
    }
    exports.validateProps = validateProps;
    function validateAction(action) {
      switch (action.type) {
        default:
        case TitleBar_1.Action.UPDATE:
          return type_validate_1.validate(action, utils_1.createActionValidator(TitleBar_1.Action, exports.titleBarSchema, true, false));
        case TitleBar_1.Action.BUTTON_CLICK:
        case TitleBar_1.Action.BREADCRUMBS_CLICK:
          return button_1.validateAction(__assign(__assign({}, action), { type: Button_1.Action.CLICK }));
        case TitleBar_1.Action.BUTTON_UPDATE:
        case TitleBar_1.Action.BREADCRUMBS_UPDATE:
          return button_1.validateAction(__assign(__assign({}, action), { type: Button_1.Action.UPDATE }));
        case TitleBar_1.Action.BUTTON_GROUP_UPDATE:
          return buttonGroup_1.validateAction(__assign(__assign({}, action), { type: ButtonGroup_1.Action.UPDATE }));
      }
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge-core/validate/actions/toast.js
var require_toast = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/actions/toast.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateProps = exports.validateAction = exports.toastSchema = void 0;
    var Toast_1 = require_Toast();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Toast_1.Action;
    } });
    var type_validate_1 = require_type_validate();
    var utils_1 = require_utils();
    exports.toastSchema = type_validate_1.matchesObject({
      message: type_validate_1.matchesString(),
      duration: type_validate_1.matchesPositiveInteger(),
      isError: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      action: type_validate_1.makeOptional(type_validate_1.matchesObject({
        content: type_validate_1.matchesString()
      }))
    });
    function validateAction(action) {
      switch (action.type) {
        case Toast_1.Action.SHOW:
          return type_validate_1.validate(action, utils_1.createActionValidator(Toast_1.Action, exports.toastSchema, true));
        default:
          return type_validate_1.validate(action, utils_1.createActionValidator(Toast_1.Action));
      }
    }
    exports.validateAction = validateAction;
    function validateProps(props) {
      return type_validate_1.validate(props, exports.toastSchema);
    }
    exports.validateProps = validateProps;
  }
});

// node_modules/@shopify/app-bridge-core/validate/actions/picker.js
var require_picker = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/actions/picker.js"(exports) {
    "use strict";
    var __assign = exports && exports.__assign || function() {
      __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
        }
        return t;
      };
      return __assign.apply(this, arguments);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = exports.validateProps = void 0;
    var Picker_1 = require_Picker();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Picker_1.Action;
    } });
    var type_validate_1 = require_type_validate();
    var utils_1 = require_utils();
    var resourceBadge = type_validate_1.matchesObject({
      content: type_validate_1.matchesString(),
      id: type_validate_1.matchesString(),
      progress: type_validate_1.matchesEnum(Picker_1.ALL_BADGE_PROGRESSES),
      status: type_validate_1.matchesEnum(Picker_1.ALL_BADGE_STATUSES)
    });
    var resourceMedia = type_validate_1.matchesObject({
      accessibilityLabel: type_validate_1.makeOptional(type_validate_1.matchesString()),
      alt: type_validate_1.makeOptional(type_validate_1.matchesString()),
      initials: type_validate_1.makeOptional(type_validate_1.matchesString()),
      kind: type_validate_1.makeOptional(type_validate_1.matchesEnum(Picker_1.ALL_MEDIA_KINDS)),
      name: type_validate_1.makeOptional(type_validate_1.matchesString()),
      source: type_validate_1.matchesString()
    });
    var sharedResourceSchema = {
      accessibilityLabel: type_validate_1.makeOptional(type_validate_1.matchesString()),
      badges: type_validate_1.makeOptional(type_validate_1.matchesArray(resourceBadge)),
      disabled: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      id: type_validate_1.matchesString(),
      loading: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      media: type_validate_1.makeOptional(resourceMedia),
      name: type_validate_1.makeOptional(type_validate_1.matchesString()),
      caption: type_validate_1.makeOptional(type_validate_1.matchesString()),
      selectable: type_validate_1.makeOptional(type_validate_1.matchesBoolean())
    };
    var resourceOption = type_validate_1.matchesObject(__assign({}, sharedResourceSchema));
    var resourceSelectionSchema = type_validate_1.matchesArray(type_validate_1.matchesObject(__assign(__assign({}, sharedResourceSchema), { options: type_validate_1.makeOptional(type_validate_1.matchesArray(resourceOption)) })));
    var resourceName = type_validate_1.matchesObject({
      plural: type_validate_1.matchesString(),
      singular: type_validate_1.matchesString()
    });
    var pickerOptions = type_validate_1.matchesObject({
      canLoadMore: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      emptySearchLabel: type_validate_1.makeOptional(type_validate_1.matchesObject({
        title: type_validate_1.matchesString(),
        description: type_validate_1.matchesString(),
        withIllustration: type_validate_1.matchesBoolean()
      })),
      items: type_validate_1.makeOptional(resourceSelectionSchema),
      loading: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      loadingMore: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      maxSelectable: type_validate_1.makeOptional(type_validate_1.matchesPositiveInteger()),
      primaryActionLabel: type_validate_1.makeOptional(type_validate_1.matchesString()),
      searchQuery: type_validate_1.makeOptional(type_validate_1.matchesString()),
      searchQueryPlaceholder: type_validate_1.makeOptional(type_validate_1.matchesString()),
      secondaryActionLabel: type_validate_1.makeOptional(type_validate_1.matchesString()),
      selectedItems: type_validate_1.makeOptional(type_validate_1.matchesArray(type_validate_1.matchesObject(sharedResourceSchema))),
      title: type_validate_1.makeOptional(type_validate_1.matchesString()),
      verticalAlignment: type_validate_1.makeOptional(type_validate_1.matchesEnum(Picker_1.ALL_RESOURCE_VERTICAL_ALIGNMENT)),
      allowEmptySelection: type_validate_1.makeOptional(type_validate_1.matchesBoolean()),
      resourceName: type_validate_1.makeOptional(resourceName)
    });
    var pickerActionSchema = type_validate_1.matchesObject({
      options: type_validate_1.makeOptional(resourceSelectionSchema)
    });
    var selectionSchema = type_validate_1.matchesObject({
      selectedItems: resourceSelectionSchema
    });
    var searchSchema = type_validate_1.matchesObject({
      searchQuery: type_validate_1.makeOptional(type_validate_1.matchesString())
    });
    function validateProps(props) {
      return type_validate_1.validate(props, pickerOptions);
    }
    exports.validateProps = validateProps;
    function validateAction(action) {
      switch (action.type) {
        case Picker_1.Action.UPDATE:
        case Picker_1.Action.OPEN:
          return type_validate_1.validate(action, utils_1.createActionValidator(Picker_1.Action, pickerActionSchema, false, true));
        case Picker_1.Action.SELECT:
          return type_validate_1.validate(action, utils_1.createActionValidator(Picker_1.Action, selectionSchema, true, true));
        case Picker_1.Action.SEARCH:
          return type_validate_1.validate(action, utils_1.createActionValidator(Picker_1.Action, searchSchema, true, true));
        case Picker_1.Action.CANCEL:
        case Picker_1.Action.LOAD_MORE:
          return type_validate_1.validate(action, utils_1.createActionValidator(Picker_1.Action));
        default:
          return type_validate_1.validate(action, utils_1.createActionValidator(Picker_1.Action));
      }
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge-core/validate/actions/index.js
var require_actions = __commonJS({
  "node_modules/@shopify/app-bridge-core/validate/actions/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.unstable_Picker = exports.Toast = exports.TitleBar = exports.ResourcePicker = exports.Navigation = exports.Modal = exports.Menu = exports.Link = exports.LeaveConfirmation = exports.FeedbackModal = exports.ContextualSaveBar = exports.ButtonGroup = exports.Button = void 0;
    var Button = __importStar(require_button());
    exports.Button = Button;
    var ButtonGroup = __importStar(require_buttonGroup());
    exports.ButtonGroup = ButtonGroup;
    var ContextualSaveBar = __importStar(require_contextualSaveBar());
    exports.ContextualSaveBar = ContextualSaveBar;
    var FeedbackModal = __importStar(require_feedbackModal());
    exports.FeedbackModal = FeedbackModal;
    var LeaveConfirmation = __importStar(require_leaveConfirmation());
    exports.LeaveConfirmation = LeaveConfirmation;
    var Link = __importStar(require_link());
    exports.Link = Link;
    var Menu = __importStar(require_menu());
    exports.Menu = Menu;
    var Modal = __importStar(require_modal());
    exports.Modal = Modal;
    var Navigation = __importStar(require_navigation());
    exports.Navigation = Navigation;
    var ResourcePicker = __importStar(require_resourcePicker());
    exports.ResourcePicker = ResourcePicker;
    var TitleBar = __importStar(require_titleBar());
    exports.TitleBar = TitleBar;
    var Toast = __importStar(require_toast());
    exports.Toast = Toast;
    var unstable_Picker = __importStar(require_picker());
    exports.unstable_Picker = unstable_Picker;
  }
});

// node_modules/@shopify/app-bridge/validate/type-validate.js
var require_type_validate2 = __commonJS({
  "node_modules/@shopify/app-bridge/validate/type-validate.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.matchesPositiveNumber = exports.TYPE_ERROR = exports.oneOf = exports.matchesArray = exports.validate = exports.matchesPositiveInteger = exports.matchesBoolean = exports.makeOptional = exports.matchesString = exports.matchesObject = exports.matchesEnum = exports.composeSchemas = void 0;
    var type_validate_1 = require_type_validate();
    Object.defineProperty(exports, "TYPE_ERROR", { enumerable: true, get: function() {
      return type_validate_1.TYPE_ERROR;
    } });
    var type_validate_2 = require_type_validate();
    Object.defineProperty(exports, "composeSchemas", { enumerable: true, get: function() {
      return type_validate_2.composeSchemas;
    } });
    Object.defineProperty(exports, "matchesEnum", { enumerable: true, get: function() {
      return type_validate_2.matchesEnum;
    } });
    Object.defineProperty(exports, "matchesObject", { enumerable: true, get: function() {
      return type_validate_2.matchesObject;
    } });
    Object.defineProperty(exports, "matchesString", { enumerable: true, get: function() {
      return type_validate_2.matchesString;
    } });
    Object.defineProperty(exports, "makeOptional", { enumerable: true, get: function() {
      return type_validate_2.makeOptional;
    } });
    Object.defineProperty(exports, "matchesBoolean", { enumerable: true, get: function() {
      return type_validate_2.matchesBoolean;
    } });
    Object.defineProperty(exports, "matchesPositiveInteger", { enumerable: true, get: function() {
      return type_validate_2.matchesPositiveInteger;
    } });
    Object.defineProperty(exports, "validate", { enumerable: true, get: function() {
      return type_validate_2.validate;
    } });
    Object.defineProperty(exports, "matchesArray", { enumerable: true, get: function() {
      return type_validate_2.matchesArray;
    } });
    Object.defineProperty(exports, "oneOf", { enumerable: true, get: function() {
      return type_validate_2.oneOf;
    } });
    function constructErrors(value, error, options) {
      if (options === void 0) {
        options = { message: void 0 };
      }
      return [
        {
          value,
          error,
          message: typeof options.message === "function" ? options.message(error, value) : options.message
        }
      ];
    }
    function matchesPositiveNumber(options) {
      return function(value) {
        return Number.isNaN(value) || !Number.isFinite(value) || value < 0 ? constructErrors(value, type_validate_1.TYPE_ERROR + "_number", options) : void 0;
      };
    }
    exports.matchesPositiveNumber = matchesPositiveNumber;
  }
});

// node_modules/@shopify/app-bridge/validate/utils.js
var require_utils2 = __commonJS({
  "node_modules/@shopify/app-bridge/validate/utils.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mixedAppClientCheck = exports.actionMessage = exports.relativePathSchema = exports.relativeUrlSchema = exports.isValidRelativePath = exports.createActionValidator = void 0;
    var utils_1 = require_utils();
    Object.defineProperty(exports, "createActionValidator", { enumerable: true, get: function() {
      return utils_1.createActionValidator;
    } });
    Object.defineProperty(exports, "isValidRelativePath", { enumerable: true, get: function() {
      return utils_1.isValidRelativePath;
    } });
    Object.defineProperty(exports, "relativeUrlSchema", { enumerable: true, get: function() {
      return utils_1.relativeUrlSchema;
    } });
    Object.defineProperty(exports, "relativePathSchema", { enumerable: true, get: function() {
      return utils_1.relativePathSchema;
    } });
    function actionMessage(errors) {
      return errors.map(function(err) {
        var path = err.path, error = err.error, message = err.message, value = err.value;
        var valueStr = typeof value === "object" ? JSON.stringify(value) : value;
        return "`" + error + "` thrown for" + (path ? " path: " + path + " and" : "") + " value: `" + valueStr + "`" + (message ? " with message: " + message : "");
      }).join(" | ");
    }
    exports.actionMessage = actionMessage;
    function mixedAppClientCheck(window2) {
      window2.addEventListener("DOMContentLoaded", function() {
        if (!Object.prototype.hasOwnProperty.call(window2, "ShopifyApp")) {
          return;
        }
        console.error("%cException Detected 🚫\n\n%cAn instance of the EASDK client was detected while initializing Shopify App Bridge. Using Shopify App Bridge and the EASDK simultaneously is not supported.\n\nIf you're migrating an existing app that was built with the shopify_app gem, then the EASDK client might have been included in the home page view template. In this case, remove it from your app before initializing Shopify App Bridge again.", "font-size: large;", "font-size: normal;");
      }, { once: true });
    }
    exports.mixedAppClientCheck = mixedAppClientCheck;
  }
});

// node_modules/@shopify/app-bridge/validate/actions/cart.js
var require_cart = __commonJS({
  "node_modules/@shopify/app-bridge/validate/actions/cart.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = void 0;
    var Cart_1 = require_Cart();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Cart_1.Action;
    } });
    var type_validate_1 = require_type_validate2();
    var utils_1 = require_utils2();
    var addressSchema = type_validate_1.matchesObject({
      address1: type_validate_1.makeOptional(type_validate_1.matchesString()),
      address2: type_validate_1.makeOptional(type_validate_1.matchesString()),
      city: type_validate_1.makeOptional(type_validate_1.matchesString()),
      company: type_validate_1.makeOptional(type_validate_1.matchesString()),
      firstName: type_validate_1.makeOptional(type_validate_1.matchesString()),
      lastName: type_validate_1.makeOptional(type_validate_1.matchesString()),
      phone: type_validate_1.makeOptional(type_validate_1.matchesString()),
      province: type_validate_1.makeOptional(type_validate_1.matchesString()),
      country: type_validate_1.makeOptional(type_validate_1.matchesString()),
      zip: type_validate_1.makeOptional(type_validate_1.matchesString()),
      name: type_validate_1.makeOptional(type_validate_1.matchesString()),
      provinceCode: type_validate_1.makeOptional(type_validate_1.matchesString()),
      countryCode: type_validate_1.makeOptional(type_validate_1.matchesString())
    });
    var discountSchema = type_validate_1.matchesObject({
      amount: type_validate_1.makeOptional(type_validate_1.matchesPositiveInteger()),
      discountDescription: type_validate_1.makeOptional(type_validate_1.matchesString()),
      type: type_validate_1.makeOptional(type_validate_1.matchesString()),
      discountCode: type_validate_1.makeOptional(type_validate_1.matchesString())
    });
    var discountAmount = type_validate_1.matchesObject({
      amount: type_validate_1.matchesPositiveNumber(),
      discountDescription: type_validate_1.makeOptional(type_validate_1.matchesString()),
      type: type_validate_1.makeOptional(type_validate_1.matchesString())
    });
    var discountCode = type_validate_1.matchesObject({
      discountCode: type_validate_1.matchesString()
    });
    var lineItemSchema = type_validate_1.matchesObject({
      price: type_validate_1.makeOptional(type_validate_1.matchesPositiveNumber()),
      quantity: type_validate_1.makeOptional(type_validate_1.matchesPositiveInteger()),
      title: type_validate_1.makeOptional(type_validate_1.matchesString()),
      variantId: type_validate_1.makeOptional(type_validate_1.matchesPositiveInteger()),
      discount: type_validate_1.makeOptional(discountAmount)
    });
    var updateLineItemSchema = type_validate_1.matchesObject({
      quantity: type_validate_1.matchesPositiveInteger()
    });
    var customerSchema = type_validate_1.matchesObject({
      id: type_validate_1.makeOptional(type_validate_1.matchesPositiveInteger()),
      email: type_validate_1.makeOptional(type_validate_1.matchesString()),
      firstName: type_validate_1.makeOptional(type_validate_1.matchesString()),
      lastName: type_validate_1.makeOptional(type_validate_1.matchesString()),
      note: type_validate_1.makeOptional(type_validate_1.matchesString()),
      addresses: type_validate_1.makeOptional(type_validate_1.matchesArray(addressSchema))
    });
    var noteSchema = type_validate_1.matchesObject({
      name: type_validate_1.matchesString(),
      value: type_validate_1.matchesString()
    });
    var cartSchema = type_validate_1.matchesObject({
      cartDiscount: type_validate_1.makeOptional(discountSchema),
      customer: type_validate_1.makeOptional(customerSchema),
      grandTotal: type_validate_1.makeOptional(type_validate_1.matchesString()),
      lineItems: type_validate_1.makeOptional(type_validate_1.matchesArray(lineItemSchema)),
      noteAttributes: type_validate_1.makeOptional(type_validate_1.matchesArray(noteSchema)),
      subTotal: type_validate_1.makeOptional(type_validate_1.matchesString()),
      taxTotal: type_validate_1.makeOptional(type_validate_1.matchesString())
    });
    var propertiesSchema = type_validate_1.composeSchemas(type_validate_1.matchesObject({}), function(value) {
      var validator = type_validate_1.matchesString();
      var schema = Object.keys(value).reduce(function(acc, key) {
        acc[key] = validator;
        return acc;
      }, {});
      return type_validate_1.validate(value, type_validate_1.matchesObject(schema));
    });
    var matchesStringArray = type_validate_1.matchesArray(type_validate_1.matchesString());
    function createDataValidator(data) {
      return utils_1.createActionValidator(Cart_1.Action, data ? type_validate_1.matchesObject({ data }) : void 0, true, true);
    }
    function createDataValidatorWithIndex(data) {
      var indexSchema = type_validate_1.matchesObject({ index: type_validate_1.matchesPositiveInteger() });
      if (data) {
        var dataSchema = type_validate_1.matchesObject({ data });
        return utils_1.createActionValidator(Cart_1.Action, type_validate_1.composeSchemas(indexSchema, dataSchema), true, true);
      }
      return utils_1.createActionValidator(Cart_1.Action, indexSchema, true, true);
    }
    function getDiscountSchema(data) {
      if (data.amount) {
        return discountAmount;
      }
      return discountCode;
    }
    function validateAction(action) {
      switch (action.type) {
        case Cart_1.Action.UPDATE:
          return type_validate_1.validate(action, createDataValidator(cartSchema));
        case Cart_1.Action.SET_CUSTOMER:
          return type_validate_1.validate(action, createDataValidator(customerSchema));
        case Cart_1.Action.ADD_CUSTOMER_ADDRESS:
          return type_validate_1.validate(action, createDataValidator(addressSchema));
        case Cart_1.Action.UPDATE_CUSTOMER_ADDRESS:
          return type_validate_1.validate(action, createDataValidatorWithIndex(addressSchema));
        case Cart_1.Action.SET_DISCOUNT:
          return type_validate_1.validate(action, createDataValidator(getDiscountSchema(action.payload.data)));
        case Cart_1.Action.SET_PROPERTIES:
          return type_validate_1.validate(action, createDataValidator(propertiesSchema));
        case Cart_1.Action.REMOVE_PROPERTIES:
          return type_validate_1.validate(action, createDataValidator(matchesStringArray));
        case Cart_1.Action.ADD_LINE_ITEM:
          return type_validate_1.validate(action, createDataValidator(lineItemSchema));
        case Cart_1.Action.UPDATE_LINE_ITEM:
          return type_validate_1.validate(action, createDataValidatorWithIndex(updateLineItemSchema));
        case Cart_1.Action.REMOVE_LINE_ITEM:
          return type_validate_1.validate(action, createDataValidatorWithIndex());
        case Cart_1.Action.SET_LINE_ITEM_DISCOUNT:
          return type_validate_1.validate(action, createDataValidatorWithIndex(discountAmount));
        case Cart_1.Action.REMOVE_LINE_ITEM_DISCOUNT:
          return type_validate_1.validate(action, createDataValidatorWithIndex());
        case Cart_1.Action.SET_LINE_ITEM_PROPERTIES:
          return type_validate_1.validate(action, createDataValidatorWithIndex(propertiesSchema));
        case Cart_1.Action.REMOVE_LINE_ITEM_PROPERTIES:
          return type_validate_1.validate(action, createDataValidatorWithIndex(matchesStringArray));
        case Cart_1.Action.FETCH:
        case Cart_1.Action.REMOVE_CUSTOMER:
        case Cart_1.Action.REMOVE_DISCOUNT:
        case Cart_1.Action.CLEAR:
        default:
          return type_validate_1.validate(action, utils_1.createActionValidator(Cart_1.Action, void 0, false, true));
      }
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge/validate/actions/fullscreen.js
var require_fullscreen = __commonJS({
  "node_modules/@shopify/app-bridge/validate/actions/fullscreen.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = void 0;
    var Fullscreen_1 = require_Fullscreen();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Fullscreen_1.Action;
    } });
    var type_validate_1 = require_type_validate2();
    var utils_1 = require_utils2();
    function validateAction(action) {
      var validator = utils_1.createActionValidator(Fullscreen_1.Action);
      return type_validate_1.validate(action, validator);
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge/validate/actions/loading.js
var require_loading = __commonJS({
  "node_modules/@shopify/app-bridge/validate/actions/loading.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = void 0;
    var Loading_1 = require_Loading();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Loading_1.Action;
    } });
    var type_validate_1 = require_type_validate2();
    var utils_1 = require_utils2();
    function validateAction(action) {
      var validator = utils_1.createActionValidator(Loading_1.Action);
      return type_validate_1.validate(action, validator);
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge/validate/actions/print.js
var require_print2 = __commonJS({
  "node_modules/@shopify/app-bridge/validate/actions/print.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = void 0;
    var Print_1 = require_Print();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Print_1.Action;
    } });
    var type_validate_1 = require_type_validate2();
    var utils_1 = require_utils2();
    function validateAction(action) {
      return type_validate_1.validate(action, utils_1.createActionValidator(Print_1.Action));
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge/validate/actions/scanner.js
var require_scanner = __commonJS({
  "node_modules/@shopify/app-bridge/validate/actions/scanner.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = exports.validateAction = void 0;
    var Scanner_1 = require_Scanner();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Scanner_1.Action;
    } });
    var type_validate_1 = require_type_validate2();
    var utils_1 = require_utils2();
    function validateAction(action) {
      return type_validate_1.validate(action, utils_1.createActionValidator(Scanner_1.Action));
    }
    exports.validateAction = validateAction;
  }
});

// node_modules/@shopify/app-bridge/validate/actions/index.js
var require_actions2 = __commonJS({
  "node_modules/@shopify/app-bridge/validate/actions/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.unstable_Picker = exports.Toast = exports.TitleBar = exports.Scanner = exports.ResourcePicker = exports.Print = exports.Navigation = exports.Modal = exports.Menu = exports.Loading = exports.Link = exports.LeaveConfirmation = exports.Fullscreen = exports.FeedbackModal = exports.ContextualSaveBar = exports.Cart = exports.ButtonGroup = exports.Button = void 0;
    var actions_1 = require_actions();
    Object.defineProperty(exports, "Button", { enumerable: true, get: function() {
      return actions_1.Button;
    } });
    Object.defineProperty(exports, "ButtonGroup", { enumerable: true, get: function() {
      return actions_1.ButtonGroup;
    } });
    Object.defineProperty(exports, "ContextualSaveBar", { enumerable: true, get: function() {
      return actions_1.ContextualSaveBar;
    } });
    Object.defineProperty(exports, "FeedbackModal", { enumerable: true, get: function() {
      return actions_1.FeedbackModal;
    } });
    Object.defineProperty(exports, "LeaveConfirmation", { enumerable: true, get: function() {
      return actions_1.LeaveConfirmation;
    } });
    Object.defineProperty(exports, "Link", { enumerable: true, get: function() {
      return actions_1.Link;
    } });
    Object.defineProperty(exports, "Menu", { enumerable: true, get: function() {
      return actions_1.Menu;
    } });
    Object.defineProperty(exports, "Modal", { enumerable: true, get: function() {
      return actions_1.Modal;
    } });
    Object.defineProperty(exports, "Navigation", { enumerable: true, get: function() {
      return actions_1.Navigation;
    } });
    Object.defineProperty(exports, "ResourcePicker", { enumerable: true, get: function() {
      return actions_1.ResourcePicker;
    } });
    Object.defineProperty(exports, "TitleBar", { enumerable: true, get: function() {
      return actions_1.TitleBar;
    } });
    Object.defineProperty(exports, "Toast", { enumerable: true, get: function() {
      return actions_1.Toast;
    } });
    Object.defineProperty(exports, "unstable_Picker", { enumerable: true, get: function() {
      return actions_1.unstable_Picker;
    } });
    var Cart = __importStar(require_cart());
    exports.Cart = Cart;
    var Fullscreen = __importStar(require_fullscreen());
    exports.Fullscreen = Fullscreen;
    var Loading = __importStar(require_loading());
    exports.Loading = Loading;
    var Print = __importStar(require_print2());
    exports.Print = Print;
    var Scanner = __importStar(require_scanner());
    exports.Scanner = Scanner;
  }
});

// node_modules/@shopify/app-bridge/validate/validator.js
var require_validator2 = __commonJS({
  "node_modules/@shopify/app-bridge/validate/validator.js"(exports) {
    "use strict";
    var __spreadArray = exports && exports.__spreadArray || function(to, from) {
      for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
      return to;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validatorMiddleware = exports.connectValidatorToDispatchHook = exports.connectValidatorToUpdateHook = void 0;
    var client_1 = require_client();
    var types_1 = require_types();
    var Error_1 = require_Error2();
    var helper_1 = require_helper2();
    var actions_1 = require_actions2();
    var type_validate_1 = require_type_validate2();
    var utils_1 = require_utils2();
    function updateValidator(localOrigin, group, options) {
      switch (group) {
        case types_1.Group.Button:
          return actions_1.Button.validateProps(options);
        case types_1.Group.ButtonGroup:
          return actions_1.ButtonGroup.validateProps(options);
        case types_1.Group.Modal:
          return actions_1.Modal.validateProps(options, localOrigin);
        case types_1.Group.Menu:
          return actions_1.Menu.validateProps(options);
        case types_1.Group.Link:
          return actions_1.Link.validateProps(options);
        case types_1.Group.TitleBar:
          return actions_1.TitleBar.validateProps(options);
        case types_1.Group.ResourcePicker:
          return actions_1.ResourcePicker.validateProps(options);
        case types_1.Group.Toast:
          return actions_1.Toast.validateProps(options);
        case types_1.Group.ContextualSaveBar:
          return actions_1.ContextualSaveBar.validateProps(options);
        case types_1.Group.unstable_Picker:
          return actions_1.unstable_Picker.validateProps(options);
      }
    }
    function dispatchPayloadValidator(action, localOrigin) {
      switch (action.group) {
        case types_1.Group.Button:
          return actions_1.Button.validateAction(action);
        case types_1.Group.ButtonGroup:
          return actions_1.ButtonGroup.validateAction(action);
        case types_1.Group.Modal:
          return actions_1.Modal.validateAction(action, localOrigin);
        case types_1.Group.Menu:
          return actions_1.Menu.validateAction(action);
        case types_1.Group.TitleBar:
          return actions_1.TitleBar.validateAction(action);
        case types_1.Group.ResourcePicker:
          return actions_1.ResourcePicker.validateAction(action);
        case types_1.Group.Loading:
          return actions_1.Loading.validateAction(action);
        case types_1.Group.Toast:
          return actions_1.Toast.validateAction(action);
        case types_1.Group.Cart:
          return actions_1.Cart.validateAction(action);
        case types_1.Group.Navigation:
          return actions_1.Navigation.validateAction(action);
        case types_1.Group.Print:
          return actions_1.Print.validateAction(action);
        case types_1.Group.Scanner:
          return actions_1.Scanner.validateAction(action);
        case types_1.Group.Fullscreen:
          return actions_1.Fullscreen.validateAction(action);
        case types_1.Group.ContextualSaveBar:
          return actions_1.ContextualSaveBar.validateAction(action);
        case types_1.Group.Link:
          return actions_1.Link.validateAction(action);
        case types_1.Group.unstable_Picker:
          return actions_1.unstable_Picker.validateAction(action);
      }
    }
    function dispatchValidator(action, origin) {
      var errors = type_validate_1.validate(action, type_validate_1.matchesObject({
        group: type_validate_1.matchesEnum(types_1.Group, {
          message: function(_, value) {
            return "Unknown or unsupported action group `" + value + "`";
          }
        }),
        version: type_validate_1.matchesString()
      }));
      if (errors) {
        return Error_1.invalidAction(action, utils_1.actionMessage(errors));
      }
      var payloadErrors = dispatchPayloadValidator(action, origin);
      return payloadErrors ? Error_1.invalidPayload(action, utils_1.actionMessage(payloadErrors)) : action;
    }
    var connectValidatorToUpdateHook = function(next) {
      return function(options) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
          args[_i - 1] = arguments[_i];
        }
        var mergedOptions = helper_1.getMergedProps(this.options, options);
        var errors = updateValidator(this.app.localOrigin, this.defaultGroup, mergedOptions);
        if (errors) {
          throw Error_1.fromAction(utils_1.actionMessage(errors), Error_1.Action.INVALID_OPTIONS);
        }
        return next.apply(void 0, __spreadArray([options], args));
      };
    };
    exports.connectValidatorToUpdateHook = connectValidatorToUpdateHook;
    var connectValidatorToDispatchHook = function(next) {
      return function(action) {
        var finalAction = dispatchValidator(action, this.localOrigin);
        return next(finalAction);
      };
    };
    exports.connectValidatorToDispatchHook = connectValidatorToDispatchHook;
    var validatorMiddleware = function(hooks) {
      hooks.set(client_1.LifecycleHook.UpdateAction, exports.connectValidatorToUpdateHook);
      hooks.set(client_1.LifecycleHook.DispatchAction, exports.connectValidatorToDispatchHook);
    };
    exports.validatorMiddleware = validatorMiddleware;
  }
});

// node_modules/@shopify/app-bridge/validate/index.js
var require_validate = __commonJS({
  "node_modules/@shopify/app-bridge/validate/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var validator_1 = require_validator2();
    exports.default = validator_1.validatorMiddleware;
  }
});

// node_modules/@shopify/app-bridge/development.js
var require_development = __commonJS({
  "node_modules/@shopify/app-bridge/development.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createApp = void 0;
    var validate_1 = __importDefault(require_validate());
    var utils_1 = require_utils2();
    var redirect_1 = require_redirect();
    var client_1 = require_client();
    var shared_1 = require_shared();
    function createApp(config) {
      var currentWindow = redirect_1.getWindow();
      if (!currentWindow || !currentWindow.top) {
        return shared_1.serverAppBridge;
      }
      utils_1.mixedAppClientCheck(currentWindow);
      return client_1.createAppWrapper(currentWindow.top, currentWindow.location.origin, [validate_1.default])(config);
    }
    exports.createApp = createApp;
    exports.default = createApp;
    __exportStar(require_MessageTransport2(), exports);
    __exportStar(require_client(), exports);
  }
});

// node_modules/@shopify/app-bridge/index.js
var require_app_bridge = __commonJS({
  "node_modules/@shopify/app-bridge/index.js"(exports, module) {
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_development();
    }
  }
});
export default require_app_bridge();
//# sourceMappingURL=@shopify_app-bridge.js.map
