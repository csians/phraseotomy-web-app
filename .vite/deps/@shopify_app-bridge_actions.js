import {
  require_ActionSet,
  require_AppLink,
  require_Button,
  require_ButtonGroup,
  require_Cart,
  require_ChannelMenu,
  require_Client,
  require_ContextualSaveBar,
  require_Error2 as require_Error,
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
  require_buttonHelper,
  require_helper,
  require_helper2,
  require_types,
  require_types2,
  require_validator
} from "./chunk-VMYYKUHW.js";
import {
  __commonJS
} from "./chunk-HXA6O6EE.js";

// node_modules/@shopify/app-bridge-core/actions/AuthCode/index.js
var require_AuthCode = __commonJS({
  "node_modules/@shopify/app-bridge-core/actions/AuthCode/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.respond = exports.Action = void 0;
    var helper_1 = require_helper();
    var types_1 = require_types();
    var Action;
    (function(Action2) {
      Action2["REQUEST"] = "APP::AUTH_CODE::REQUEST";
      Action2["RESPOND"] = "APP::AUTH_CODE::RESPOND";
    })(Action = exports.Action || (exports.Action = {}));
    function respond(payload) {
      return helper_1.actionWrapper({
        payload,
        group: types_1.Group.AuthCode,
        type: Action.RESPOND
      });
    }
    exports.respond = respond;
  }
});

// node_modules/@shopify/app-bridge/actions/AuthCode/index.js
var require_AuthCode2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/AuthCode/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.request = exports.Action = exports.respond = void 0;
    var AuthCode_1 = require_AuthCode();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return AuthCode_1.Action;
    } });
    var helper_1 = require_helper2();
    var types_1 = require_types2();
    var AuthCode_2 = require_AuthCode();
    Object.defineProperty(exports, "respond", { enumerable: true, get: function() {
      return AuthCode_2.respond;
    } });
    function request(id) {
      return helper_1.actionWrapper({
        group: types_1.Group.AuthCode,
        type: AuthCode_1.Action.REQUEST,
        payload: { id }
      });
    }
    exports.request = request;
  }
});

// node_modules/@shopify/app-bridge/actions/Button/index.js
var require_Button2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Button/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.isValidButtonProps = exports.Button = exports.update = exports.Style = exports.Icon = exports.clickButton = exports.Action = void 0;
    var Button_1 = require_Button();
    Object.defineProperty(exports, "Button", { enumerable: true, get: function() {
      return Button_1.Button;
    } });
    var Button_2 = require_Button();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Button_2.Action;
    } });
    Object.defineProperty(exports, "clickButton", { enumerable: true, get: function() {
      return Button_2.clickButton;
    } });
    Object.defineProperty(exports, "Icon", { enumerable: true, get: function() {
      return Button_2.Icon;
    } });
    Object.defineProperty(exports, "Style", { enumerable: true, get: function() {
      return Button_2.Style;
    } });
    Object.defineProperty(exports, "update", { enumerable: true, get: function() {
      return Button_2.update;
    } });
    function isValidButtonProps(button) {
      return typeof button.id === "string" && typeof button.label === "string";
    }
    exports.isValidButtonProps = isValidButtonProps;
    function create(app, options) {
      return new Button_1.Button(app, options);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge/actions/ButtonGroup/index.js
var require_ButtonGroup2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/ButtonGroup/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.ButtonGroup = exports.isGroupedButtonPayload = exports.isGroupedButton = exports.update = exports.Action = void 0;
    var ButtonGroup_1 = require_ButtonGroup();
    Object.defineProperty(exports, "ButtonGroup", { enumerable: true, get: function() {
      return ButtonGroup_1.ButtonGroup;
    } });
    var ButtonGroup_2 = require_ButtonGroup();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return ButtonGroup_2.Action;
    } });
    Object.defineProperty(exports, "update", { enumerable: true, get: function() {
      return ButtonGroup_2.update;
    } });
    Object.defineProperty(exports, "isGroupedButton", { enumerable: true, get: function() {
      return ButtonGroup_2.isGroupedButton;
    } });
    Object.defineProperty(exports, "isGroupedButtonPayload", { enumerable: true, get: function() {
      return ButtonGroup_2.isGroupedButtonPayload;
    } });
    function create(app, options) {
      return new ButtonGroup_1.ButtonGroup(app, options);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge/actions/Flash/actions.js
var require_actions = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Flash/actions.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.Flash = exports.show = exports.clear = void 0;
    var Toast_1 = require_Toast();
    Object.defineProperty(exports, "clear", { enumerable: true, get: function() {
      return Toast_1.clear;
    } });
    Object.defineProperty(exports, "show", { enumerable: true, get: function() {
      return Toast_1.show;
    } });
    var Flash = (
      /** @class */
      function(_super) {
        __extends(Flash2, _super);
        function Flash2() {
          return _super !== null && _super.apply(this, arguments) || this;
        }
        return Flash2;
      }(Toast_1.Toast)
    );
    exports.Flash = Flash;
    function create(app, options) {
      return new Flash(app, options);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge/actions/Flash/index.js
var require_Flash = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Flash/index.js"(exports) {
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
    __exportStar(require_actions(), exports);
  }
});

// node_modules/@shopify/app-bridge-core/actions/Features/types.js
var require_types3 = __commonJS({
  "node_modules/@shopify/app-bridge-core/actions/Features/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = void 0;
    var Action;
    (function(Action2) {
      Action2["UPDATE"] = "APP::FEATURES::UPDATE";
      Action2["REQUEST"] = "APP::FEATURES::REQUEST";
      Action2["REQUEST_UPDATE"] = "APP::FEATURES::REQUEST::UPDATE";
    })(Action = exports.Action || (exports.Action = {}));
  }
});

// node_modules/@shopify/app-bridge-core/actions/Features/actions.js
var require_actions2 = __commonJS({
  "node_modules/@shopify/app-bridge-core/actions/Features/actions.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
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
    exports.Features = void 0;
    var helper_1 = require_helper();
    var ActionSet_1 = require_ActionSet();
    var types_1 = require_types();
    var types_2 = require_types3();
    var Features = (
      /** @class */
      function(_super) {
        __extends(Features2, _super);
        function Features2(app, options) {
          return _super.call(this, app, types_1.Group.Features, types_1.Group.Features, options ? options.id : void 0) || this;
        }
        Features2.prototype.dispatch = function(action, payload) {
          switch (action) {
            case types_2.Action.REQUEST:
              this.dispatchFeaturesAction(types_2.Action.REQUEST, payload);
              break;
          }
          return this;
        };
        Features2.prototype.dispatchFeaturesAction = function(type, payload) {
          this.app.dispatch(helper_1.actionWrapper({
            group: types_1.Group.Features,
            type,
            payload: __assign(__assign({}, payload || {}), { id: this.id })
          }));
        };
        return Features2;
      }(ActionSet_1.ActionSet)
    );
    exports.Features = Features;
  }
});

// node_modules/@shopify/app-bridge-core/actions/Features/index.js
var require_Features = __commonJS({
  "node_modules/@shopify/app-bridge-core/actions/Features/index.js"(exports) {
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
    __exportStar(require_actions2(), exports);
    __exportStar(require_types3(), exports);
  }
});

// node_modules/@shopify/app-bridge/actions/Features/actions.js
var require_actions3 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Features/actions.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.Features = void 0;
    var Features_1 = require_Features();
    Object.defineProperty(exports, "Features", { enumerable: true, get: function() {
      return Features_1.Features;
    } });
    function create(app, options) {
      return new Features_1.Features(app, options);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge/actions/Features/types.js
var require_types4 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Features/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = void 0;
    var Features_1 = require_Features();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Features_1.Action;
    } });
  }
});

// node_modules/@shopify/app-bridge/actions/Features/index.js
var require_Features2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Features/index.js"(exports) {
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
    __exportStar(require_actions3(), exports);
    __exportStar(require_types4(), exports);
  }
});

// node_modules/@shopify/app-bridge/actions/FeedbackModal/index.js
var require_FeedbackModal2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/FeedbackModal/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.FeedbackModal = exports.close = exports.open = exports.Action = void 0;
    var FeedbackModal_1 = require_FeedbackModal();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return FeedbackModal_1.Action;
    } });
    Object.defineProperty(exports, "open", { enumerable: true, get: function() {
      return FeedbackModal_1.open;
    } });
    Object.defineProperty(exports, "close", { enumerable: true, get: function() {
      return FeedbackModal_1.close;
    } });
    Object.defineProperty(exports, "FeedbackModal", { enumerable: true, get: function() {
      return FeedbackModal_1.FeedbackModal;
    } });
    Object.defineProperty(exports, "create", { enumerable: true, get: function() {
      return FeedbackModal_1.create;
    } });
  }
});

// node_modules/@shopify/app-bridge/actions/LeaveConfirmation/index.js
var require_LeaveConfirmation2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/LeaveConfirmation/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.LeaveConfirmation = exports.confirm = exports.disable = exports.enable = exports.Action = void 0;
    var LeaveConfirmation_1 = require_LeaveConfirmation();
    Object.defineProperty(exports, "LeaveConfirmation", { enumerable: true, get: function() {
      return LeaveConfirmation_1.LeaveConfirmation;
    } });
    var LeaveConfirmation_2 = require_LeaveConfirmation();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return LeaveConfirmation_2.Action;
    } });
    Object.defineProperty(exports, "enable", { enumerable: true, get: function() {
      return LeaveConfirmation_2.enable;
    } });
    Object.defineProperty(exports, "disable", { enumerable: true, get: function() {
      return LeaveConfirmation_2.disable;
    } });
    Object.defineProperty(exports, "confirm", { enumerable: true, get: function() {
      return LeaveConfirmation_2.confirm;
    } });
    function create(app, options) {
      if (options === void 0) {
        options = {};
      }
      return new LeaveConfirmation_1.LeaveConfirmation(app, options);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge/actions/Modal/index.js
var require_Modal2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Modal/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.Modal = exports.isMessageModal = exports.data = exports.update = exports.clickFooterButton = exports.updateModalSize = exports.closeModal = exports.openModal = exports.Size = exports.Action = exports.isIframeModal = exports.ModalMessage = exports.ModalIframe = void 0;
    var Modal_1 = require_Modal();
    Object.defineProperty(exports, "ModalIframe", { enumerable: true, get: function() {
      return Modal_1.ModalIframe;
    } });
    Object.defineProperty(exports, "ModalMessage", { enumerable: true, get: function() {
      return Modal_1.ModalMessage;
    } });
    Object.defineProperty(exports, "isIframeModal", { enumerable: true, get: function() {
      return Modal_1.isIframeModal;
    } });
    var Modal_2 = require_Modal();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Modal_2.Action;
    } });
    Object.defineProperty(exports, "Size", { enumerable: true, get: function() {
      return Modal_2.Size;
    } });
    Object.defineProperty(exports, "openModal", { enumerable: true, get: function() {
      return Modal_2.openModal;
    } });
    Object.defineProperty(exports, "closeModal", { enumerable: true, get: function() {
      return Modal_2.closeModal;
    } });
    Object.defineProperty(exports, "updateModalSize", { enumerable: true, get: function() {
      return Modal_2.updateModalSize;
    } });
    Object.defineProperty(exports, "clickFooterButton", { enumerable: true, get: function() {
      return Modal_2.clickFooterButton;
    } });
    Object.defineProperty(exports, "update", { enumerable: true, get: function() {
      return Modal_2.update;
    } });
    Object.defineProperty(exports, "data", { enumerable: true, get: function() {
      return Modal_2.data;
    } });
    Object.defineProperty(exports, "isMessageModal", { enumerable: true, get: function() {
      return Modal_2.isMessageModal;
    } });
    Object.defineProperty(exports, "Modal", { enumerable: true, get: function() {
      return Modal_2.Modal;
    } });
    var create = function(app, options) {
      if (Modal_1.isIframeModal(options)) {
        return new Modal_1.ModalIframe(app, options);
      }
      return new Modal_1.ModalMessage(app, options);
    };
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge-core/actions/Modal/ModalContent/index.js
var require_ModalContent = __commonJS({
  "node_modules/@shopify/app-bridge-core/actions/Modal/ModalContent/index.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
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
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ModalContent = exports.Action = void 0;
    var helper_1 = require_helper();
    var ActionSet_1 = require_ActionSet();
    var types_1 = require_types();
    var index_1 = require_Modal();
    var Action;
    (function(Action2) {
      Action2["LOADING"] = "LOADING";
      Action2["LOADED"] = "LOADED";
    })(Action = exports.Action || (exports.Action = {}));
    var ModalContent = (
      /** @class */
      function(_super) {
        __extends(ModalContent2, _super);
        function ModalContent2(app, options) {
          return _super.call(this, app, types_1.Group.Modal, types_1.Group.Modal, options ? options.id : void 0) || this;
        }
        ModalContent2.prototype.loaded = function() {
          this.dispatch(Action.LOADED);
        };
        ModalContent2.prototype.loading = function() {
          this.dispatch(Action.LOADING);
        };
        ModalContent2.prototype.dispatch = function(action) {
          switch (action) {
            case Action.LOADED:
              this.dispatchModalAction(index_1.Action.UPDATE_CONTENT, { loading: false });
              break;
            case Action.LOADING:
              this.dispatchModalAction(index_1.Action.UPDATE_CONTENT, { loading: true });
              break;
          }
          return this;
        };
        ModalContent2.prototype.dispatchModalAction = function(type, payload) {
          return __awaiter(this, void 0, void 0, function() {
            var updateAction;
            return __generator(this, function(_a) {
              updateAction = helper_1.actionWrapper({
                type,
                group: types_1.Group.Modal,
                payload: __assign({}, payload)
              });
              this.app.dispatch(updateAction);
              return [
                2
                /*return*/
              ];
            });
          });
        };
        return ModalContent2;
      }(ActionSet_1.ActionSet)
    );
    exports.ModalContent = ModalContent;
  }
});

// node_modules/@shopify/app-bridge/actions/Modal/ModalContent/index.js
var require_ModalContent2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Modal/ModalContent/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.ModalContent = exports.Action = void 0;
    var ModalContent_1 = require_ModalContent();
    Object.defineProperty(exports, "ModalContent", { enumerable: true, get: function() {
      return ModalContent_1.ModalContent;
    } });
    var ModalContent_2 = require_ModalContent();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return ModalContent_2.Action;
    } });
    function create(app, options) {
      return new ModalContent_1.ModalContent(app, options);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge/actions/Navigation/History/index.js
var require_History2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Navigation/History/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.replace = exports.push = exports.Action = exports.History = void 0;
    var History_1 = require_History();
    Object.defineProperty(exports, "History", { enumerable: true, get: function() {
      return History_1.History;
    } });
    var History_2 = require_History();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return History_2.Action;
    } });
    Object.defineProperty(exports, "push", { enumerable: true, get: function() {
      return History_2.push;
    } });
    Object.defineProperty(exports, "replace", { enumerable: true, get: function() {
      return History_2.replace;
    } });
    function create(app) {
      return new History_1.History(app);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge/actions/Navigation/Redirect/index.js
var require_Redirect2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Navigation/Redirect/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.isProductVariantCreateResourcePayload = exports.isProductVariantResourcePayload = exports.isCreateResourcePayload = exports.isAdminSection = exports.isRemotePayload = exports.isAdminSectionPayload = exports.isAdminPathPayload = exports.isAppPayload = exports.getRelativePath = exports.normalizeUrl = exports.getPathWithSearchAndHash = exports.toDestination = exports.toApp = exports.toRemote = exports.toAdminSection = exports.toAdminPath = exports.isResourcePayload = exports.ResourceType = exports.Action = exports.Redirect = void 0;
    var Redirect_1 = require_Redirect();
    Object.defineProperty(exports, "Redirect", { enumerable: true, get: function() {
      return Redirect_1.Redirect;
    } });
    Object.defineProperty(exports, "isCreateResourcePayload", { enumerable: true, get: function() {
      return Redirect_1.isCreateResourcePayload;
    } });
    Object.defineProperty(exports, "isProductVariantResourcePayload", { enumerable: true, get: function() {
      return Redirect_1.isProductVariantResourcePayload;
    } });
    var Redirect_2 = require_Redirect();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Redirect_2.Action;
    } });
    Object.defineProperty(exports, "ResourceType", { enumerable: true, get: function() {
      return Redirect_2.ResourceType;
    } });
    Object.defineProperty(exports, "isResourcePayload", { enumerable: true, get: function() {
      return Redirect_2.isResourcePayload;
    } });
    Object.defineProperty(exports, "toAdminPath", { enumerable: true, get: function() {
      return Redirect_2.toAdminPath;
    } });
    Object.defineProperty(exports, "toAdminSection", { enumerable: true, get: function() {
      return Redirect_2.toAdminSection;
    } });
    Object.defineProperty(exports, "toRemote", { enumerable: true, get: function() {
      return Redirect_2.toRemote;
    } });
    Object.defineProperty(exports, "toApp", { enumerable: true, get: function() {
      return Redirect_2.toApp;
    } });
    Object.defineProperty(exports, "toDestination", { enumerable: true, get: function() {
      return Redirect_2.toDestination;
    } });
    Object.defineProperty(exports, "getPathWithSearchAndHash", { enumerable: true, get: function() {
      return Redirect_2.getPathWithSearchAndHash;
    } });
    Object.defineProperty(exports, "normalizeUrl", { enumerable: true, get: function() {
      return Redirect_2.normalizeUrl;
    } });
    Object.defineProperty(exports, "getRelativePath", { enumerable: true, get: function() {
      return Redirect_2.getRelativePath;
    } });
    Object.defineProperty(exports, "isAppPayload", { enumerable: true, get: function() {
      return Redirect_2.isAppPayload;
    } });
    Object.defineProperty(exports, "isAdminPathPayload", { enumerable: true, get: function() {
      return Redirect_2.isAdminPathPayload;
    } });
    Object.defineProperty(exports, "isAdminSectionPayload", { enumerable: true, get: function() {
      return Redirect_2.isAdminSectionPayload;
    } });
    Object.defineProperty(exports, "isRemotePayload", { enumerable: true, get: function() {
      return Redirect_2.isRemotePayload;
    } });
    Object.defineProperty(exports, "isAdminSection", { enumerable: true, get: function() {
      return Redirect_2.isAdminSection;
    } });
    function isProductVariantCreateResourcePayload(resource) {
      if (!Redirect_1.isProductVariantResourcePayload(resource)) {
        return false;
      }
      return Redirect_1.isCreateResourcePayload(resource.variant);
    }
    exports.isProductVariantCreateResourcePayload = isProductVariantCreateResourcePayload;
    function create(app) {
      return new Redirect_1.Redirect(app);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge/actions/ResourcePicker/index.js
var require_ResourcePicker2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/ResourcePicker/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.ResourcePicker = exports.WeightUnit = exports.update = exports.select = exports.ResourceType = exports.ProductVariantInventoryPolicy = exports.ProductVariantInventoryManagement = exports.ProductStatus = exports.open = exports.FulfillmentServiceType = exports.CollectionSortOrder = exports.close = exports.cancel = exports.ActionVerb = exports.Action = void 0;
    var ResourcePicker_1 = require_ResourcePicker();
    Object.defineProperty(exports, "ResourcePicker", { enumerable: true, get: function() {
      return ResourcePicker_1.ResourcePicker;
    } });
    var ResourcePicker_2 = require_ResourcePicker();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return ResourcePicker_2.Action;
    } });
    Object.defineProperty(exports, "ActionVerb", { enumerable: true, get: function() {
      return ResourcePicker_2.ActionVerb;
    } });
    Object.defineProperty(exports, "cancel", { enumerable: true, get: function() {
      return ResourcePicker_2.cancel;
    } });
    Object.defineProperty(exports, "close", { enumerable: true, get: function() {
      return ResourcePicker_2.close;
    } });
    Object.defineProperty(exports, "CollectionSortOrder", { enumerable: true, get: function() {
      return ResourcePicker_2.CollectionSortOrder;
    } });
    Object.defineProperty(exports, "FulfillmentServiceType", { enumerable: true, get: function() {
      return ResourcePicker_2.FulfillmentServiceType;
    } });
    Object.defineProperty(exports, "open", { enumerable: true, get: function() {
      return ResourcePicker_2.open;
    } });
    Object.defineProperty(exports, "ProductStatus", { enumerable: true, get: function() {
      return ResourcePicker_2.ProductStatus;
    } });
    Object.defineProperty(exports, "ProductVariantInventoryManagement", { enumerable: true, get: function() {
      return ResourcePicker_2.ProductVariantInventoryManagement;
    } });
    Object.defineProperty(exports, "ProductVariantInventoryPolicy", { enumerable: true, get: function() {
      return ResourcePicker_2.ProductVariantInventoryPolicy;
    } });
    Object.defineProperty(exports, "ResourceType", { enumerable: true, get: function() {
      return ResourcePicker_2.ResourceType;
    } });
    Object.defineProperty(exports, "select", { enumerable: true, get: function() {
      return ResourcePicker_2.select;
    } });
    Object.defineProperty(exports, "update", { enumerable: true, get: function() {
      return ResourcePicker_2.update;
    } });
    Object.defineProperty(exports, "WeightUnit", { enumerable: true, get: function() {
      return ResourcePicker_2.WeightUnit;
    } });
    var create = function(app, baseOptions) {
      var resourceType = baseOptions.resourceType, _a = baseOptions.options, options = _a === void 0 ? {} : _a;
      return new ResourcePicker_1.ResourcePicker(app, options, resourceType);
    };
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge-core/actions/SessionToken/index.js
var require_SessionToken = __commonJS({
  "node_modules/@shopify/app-bridge-core/actions/SessionToken/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.respond = exports.request = exports.Action = void 0;
    var helper_1 = require_helper();
    var types_1 = require_types();
    var Action;
    (function(Action2) {
      Action2["REQUEST"] = "APP::SESSION_TOKEN::REQUEST";
      Action2["RESPOND"] = "APP::SESSION_TOKEN::RESPOND";
    })(Action = exports.Action || (exports.Action = {}));
    function request() {
      return helper_1.actionWrapper({
        group: types_1.Group.SessionToken,
        type: Action.REQUEST
      });
    }
    exports.request = request;
    function respond(sessionToken) {
      return helper_1.actionWrapper({
        payload: sessionToken,
        group: types_1.Group.SessionToken,
        type: Action.RESPOND
      });
    }
    exports.respond = respond;
  }
});

// node_modules/@shopify/app-bridge/actions/SessionToken/index.js
var require_SessionToken2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/SessionToken/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.respond = exports.request = exports.Action = void 0;
    var SessionToken_1 = require_SessionToken();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return SessionToken_1.Action;
    } });
    Object.defineProperty(exports, "request", { enumerable: true, get: function() {
      return SessionToken_1.request;
    } });
    Object.defineProperty(exports, "respond", { enumerable: true, get: function() {
      return SessionToken_1.respond;
    } });
  }
});

// node_modules/@shopify/app-bridge/actions/TitleBar/index.js
var require_TitleBar2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/TitleBar/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.TitleBar = exports.update = exports.clickBreadcrumb = exports.clickActionButton = exports.Action = void 0;
    var TitleBar_1 = require_TitleBar();
    Object.defineProperty(exports, "TitleBar", { enumerable: true, get: function() {
      return TitleBar_1.TitleBar;
    } });
    var TitleBar_2 = require_TitleBar();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return TitleBar_2.Action;
    } });
    Object.defineProperty(exports, "clickActionButton", { enumerable: true, get: function() {
      return TitleBar_2.clickActionButton;
    } });
    Object.defineProperty(exports, "clickBreadcrumb", { enumerable: true, get: function() {
      return TitleBar_2.clickBreadcrumb;
    } });
    Object.defineProperty(exports, "update", { enumerable: true, get: function() {
      return TitleBar_2.update;
    } });
    function create(app, options) {
      return new TitleBar_1.TitleBar(app, options);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge/actions/Toast/index.js
var require_Toast2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Toast/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.Toast = exports.primaryAction = exports.clear = exports.show = exports.Action = void 0;
    var Toast_1 = require_Toast();
    Object.defineProperty(exports, "Toast", { enumerable: true, get: function() {
      return Toast_1.Toast;
    } });
    var Toast_2 = require_Toast();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Toast_2.Action;
    } });
    Object.defineProperty(exports, "show", { enumerable: true, get: function() {
      return Toast_2.show;
    } });
    Object.defineProperty(exports, "clear", { enumerable: true, get: function() {
      return Toast_2.clear;
    } });
    Object.defineProperty(exports, "primaryAction", { enumerable: true, get: function() {
      return Toast_2.primaryAction;
    } });
    function create(app, options) {
      return new Toast_1.Toast(app, options);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge/actions/ContextualSaveBar/index.js
var require_ContextualSaveBar2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/ContextualSaveBar/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.ContextualSaveBar = exports.update = exports.discard = exports.save = exports.hide = exports.show = exports.Action = void 0;
    var ContextualSaveBar_1 = require_ContextualSaveBar();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return ContextualSaveBar_1.Action;
    } });
    Object.defineProperty(exports, "show", { enumerable: true, get: function() {
      return ContextualSaveBar_1.show;
    } });
    Object.defineProperty(exports, "hide", { enumerable: true, get: function() {
      return ContextualSaveBar_1.hide;
    } });
    Object.defineProperty(exports, "save", { enumerable: true, get: function() {
      return ContextualSaveBar_1.save;
    } });
    Object.defineProperty(exports, "discard", { enumerable: true, get: function() {
      return ContextualSaveBar_1.discard;
    } });
    Object.defineProperty(exports, "update", { enumerable: true, get: function() {
      return ContextualSaveBar_1.update;
    } });
    Object.defineProperty(exports, "ContextualSaveBar", { enumerable: true, get: function() {
      return ContextualSaveBar_1.ContextualSaveBar;
    } });
    function create(app, options) {
      return new ContextualSaveBar_1.ContextualSaveBar(app, options);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge-core/actions/Share/index.js
var require_Share = __commonJS({
  "node_modules/@shopify/app-bridge-core/actions/Share/index.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
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
    exports.close = exports.show = exports.Share = exports.Action = void 0;
    var types_1 = require_types();
    var helper_1 = require_helper();
    var ActionSet_1 = require_ActionSet();
    var Action;
    (function(Action2) {
      Action2["SHOW"] = "APP::SHARE::SHOW";
      Action2["CLOSE"] = "APP::SHARE::CLOSE";
    })(Action = exports.Action || (exports.Action = {}));
    var Share = (
      /** @class */
      function(_super) {
        __extends(Share2, _super);
        function Share2(app) {
          return _super.call(this, app, types_1.Group.Share, types_1.Group.Share) || this;
        }
        Share2.prototype.dispatch = function(action, payload) {
          switch (action) {
            case Action.SHOW:
              this.dispatchShareAction(Action.SHOW, payload);
              break;
            case Action.CLOSE:
              this.dispatchShareAction(Action.CLOSE, payload);
              break;
            default:
              throw new Error("Action: " + action + " not supported");
          }
          return this;
        };
        Share2.prototype.dispatchShareAction = function(actionType, payload) {
          this.app.dispatch(helper_1.actionWrapper({
            type: actionType,
            group: types_1.Group.Share,
            payload: __assign({ id: this.id }, payload)
          }));
        };
        return Share2;
      }(ActionSet_1.ActionSet)
    );
    exports.Share = Share;
    function show() {
      return helper_1.actionWrapper({
        group: types_1.Group.Share,
        type: Action.SHOW
      });
    }
    exports.show = show;
    function close(payload) {
      return helper_1.actionWrapper({
        group: types_1.Group.Share,
        type: Action.CLOSE,
        payload
      });
    }
    exports.close = close;
  }
});

// node_modules/@shopify/app-bridge/actions/Share/index.js
var require_Share2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Share/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.Share = exports.close = exports.show = exports.Action = void 0;
    var Share_1 = require_Share();
    Object.defineProperty(exports, "Share", { enumerable: true, get: function() {
      return Share_1.Share;
    } });
    var Share_2 = require_Share();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Share_2.Action;
    } });
    Object.defineProperty(exports, "show", { enumerable: true, get: function() {
      return Share_2.show;
    } });
    Object.defineProperty(exports, "close", { enumerable: true, get: function() {
      return Share_2.close;
    } });
    function create(app) {
      return new Share_1.Share(app);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge/actions/Menu/NavigationMenu/index.js
var require_NavigationMenu2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Menu/NavigationMenu/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.NavigationMenu = exports.update = exports.Action = void 0;
    var NavigationMenu_1 = require_NavigationMenu();
    Object.defineProperty(exports, "NavigationMenu", { enumerable: true, get: function() {
      return NavigationMenu_1.NavigationMenu;
    } });
    var NavigationMenu_2 = require_NavigationMenu();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return NavigationMenu_2.Action;
    } });
    Object.defineProperty(exports, "update", { enumerable: true, get: function() {
      return NavigationMenu_2.update;
    } });
    function create(app, options) {
      return new NavigationMenu_1.NavigationMenu(app, options);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge/actions/Menu/ChannelMenu/index.js
var require_ChannelMenu2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Menu/ChannelMenu/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.ChannelMenu = exports.update = exports.Action = void 0;
    var ChannelMenu_1 = require_ChannelMenu();
    Object.defineProperty(exports, "ChannelMenu", { enumerable: true, get: function() {
      return ChannelMenu_1.ChannelMenu;
    } });
    var ChannelMenu_2 = require_ChannelMenu();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return ChannelMenu_2.Action;
    } });
    Object.defineProperty(exports, "update", { enumerable: true, get: function() {
      return ChannelMenu_2.update;
    } });
    function create(app, options) {
      return new ChannelMenu_1.ChannelMenu(app, options);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge/actions/Link/AppLink/index.js
var require_AppLink2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Link/AppLink/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.AppLink = exports.update = exports.Action = void 0;
    var AppLink_1 = require_AppLink();
    Object.defineProperty(exports, "AppLink", { enumerable: true, get: function() {
      return AppLink_1.AppLink;
    } });
    var AppLink_2 = require_AppLink();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return AppLink_2.Action;
    } });
    Object.defineProperty(exports, "update", { enumerable: true, get: function() {
      return AppLink_2.update;
    } });
    function create(app, options) {
      return new AppLink_1.AppLink(app, options);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge-core/actions/Pos/index.js
var require_Pos = __commonJS({
  "node_modules/@shopify/app-bridge-core/actions/Pos/index.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Pos = exports.close = exports.Action = void 0;
    var helper_1 = require_helper();
    var ActionSet_1 = require_ActionSet();
    var types_1 = require_types();
    var Action;
    (function(Action2) {
      Action2["CLOSE"] = "APP::POS::CLOSE";
      Action2["LOCATION_UPDATE"] = "APP::POS::LOCATION::UPDATE";
      Action2["USER_UPDATE"] = "APP::POS::USER::UPDATE";
      Action2["DEVICE_UPDATE"] = "APP::POS::DEVICE::UPDATE";
    })(Action = exports.Action || (exports.Action = {}));
    function close() {
      return helper_1.actionWrapper({
        group: types_1.Group.Pos,
        type: Action.CLOSE
      });
    }
    exports.close = close;
    var Pos = (
      /** @class */
      function(_super) {
        __extends(Pos2, _super);
        function Pos2(app) {
          return _super.call(this, app, types_1.Group.Pos, types_1.Group.Pos) || this;
        }
        Pos2.prototype.dispatch = function(action) {
          switch (action) {
            case Action.CLOSE:
              this.app.dispatch(close());
              break;
          }
          return this;
        };
        return Pos2;
      }(ActionSet_1.ActionSet)
    );
    exports.Pos = Pos;
  }
});

// node_modules/@shopify/app-bridge/actions/Pos/index.js
var require_Pos2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Pos/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.Pos = exports.close = exports.Action = void 0;
    var Pos_1 = require_Pos();
    Object.defineProperty(exports, "Pos", { enumerable: true, get: function() {
      return Pos_1.Pos;
    } });
    var Pos_2 = require_Pos();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Pos_2.Action;
    } });
    Object.defineProperty(exports, "close", { enumerable: true, get: function() {
      return Pos_2.close;
    } });
    function create(app) {
      return new Pos_1.Pos(app);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge-core/actions/MarketingExternalActivityTopBar/index.js
var require_MarketingExternalActivityTopBar = __commonJS({
  "node_modules/@shopify/app-bridge-core/actions/MarketingExternalActivityTopBar/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Action = void 0;
    var Action;
    (function(Action2) {
      Action2["UPDATE"] = "APP::MARKETING_EXTERNAL_ACTIVITY_TOP_BAR::UPDATE";
      Action2["BUTTON_CLICK"] = "APP::MARKETING_EXTERNAL_ACTIVITY_TOP_BAR::BUTTONS::BUTTON::CLICK";
      Action2["BUTTON_UPDATE"] = "APP::MARKETING_EXTERNAL_ACTIVITY_TOP_BAR::BUTTONS::BUTTON::UPDATE";
    })(Action = exports.Action || (exports.Action = {}));
  }
});

// node_modules/@shopify/app-bridge/actions/buttonHelper.js
var require_buttonHelper2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/buttonHelper.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getSingleButton = void 0;
    var buttonHelper_1 = require_buttonHelper();
    Object.defineProperty(exports, "getSingleButton", { enumerable: true, get: function() {
      return buttonHelper_1.getSingleButton;
    } });
  }
});

// node_modules/@shopify/app-bridge/actions/ActionSet.js
var require_ActionSet2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/ActionSet.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.unsubscribeActions = exports.ActionSetWithChildren = exports.ActionSet = void 0;
    var ActionSet_1 = require_ActionSet();
    Object.defineProperty(exports, "ActionSet", { enumerable: true, get: function() {
      return ActionSet_1.ActionSet;
    } });
    Object.defineProperty(exports, "ActionSetWithChildren", { enumerable: true, get: function() {
      return ActionSet_1.ActionSetWithChildren;
    } });
    Object.defineProperty(exports, "unsubscribeActions", { enumerable: true, get: function() {
      return ActionSet_1.unsubscribeActions;
    } });
  }
});

// node_modules/@shopify/app-bridge/actions/MarketingExternalActivityTopBar/index.js
var require_MarketingExternalActivityTopBar2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/MarketingExternalActivityTopBar/index.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
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
    exports.create = exports.MarketingExternalActivityTopBar = exports.update = exports.clickActionButton = exports.MarketingActivityStatusBadgeType = exports.Action = void 0;
    var MarketingExternalActivityTopBar_1 = require_MarketingExternalActivityTopBar();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return MarketingExternalActivityTopBar_1.Action;
    } });
    var Button_1 = require_Button2();
    var buttonHelper_1 = require_buttonHelper2();
    var helper_1 = require_helper2();
    var ActionSet_1 = require_ActionSet2();
    var types_1 = require_types2();
    var MarketingActivityStatusBadgeType;
    (function(MarketingActivityStatusBadgeType2) {
      MarketingActivityStatusBadgeType2["Default"] = "DEFAULT";
      MarketingActivityStatusBadgeType2["Success"] = "SUCCESS";
      MarketingActivityStatusBadgeType2["Attention"] = "ATTENTION";
      MarketingActivityStatusBadgeType2["Warning"] = "WARNING";
      MarketingActivityStatusBadgeType2["Info"] = "INFO";
    })(MarketingActivityStatusBadgeType = exports.MarketingActivityStatusBadgeType || (exports.MarketingActivityStatusBadgeType = {}));
    var MARKETING_ACTIVITY_TOPBAR_BUTTON_PROPS = {
      group: types_1.Group.MarketingExternalActivityTopBar,
      subgroups: ["Buttons"]
    };
    function clickActionButton(id, payload) {
      var type = types_1.ComponentType.Button;
      var component = __assign({ id, type }, MARKETING_ACTIVITY_TOPBAR_BUTTON_PROPS);
      return Button_1.clickButton(types_1.Group.MarketingExternalActivityTopBar, component, payload);
    }
    exports.clickActionButton = clickActionButton;
    function update(payload) {
      return helper_1.actionWrapper({
        payload,
        group: types_1.Group.MarketingExternalActivityTopBar,
        type: MarketingExternalActivityTopBar_1.Action.UPDATE
      });
    }
    exports.update = update;
    var MarketingExternalActivityTopBar = (
      /** @class */
      function(_super) {
        __extends(MarketingExternalActivityTopBar2, _super);
        function MarketingExternalActivityTopBar2(app, options) {
          var _this = _super.call(this, app, types_1.Group.MarketingExternalActivityTopBar, types_1.Group.MarketingExternalActivityTopBar) || this;
          _this.set(options);
          return _this;
        }
        Object.defineProperty(MarketingExternalActivityTopBar2.prototype, "buttons", {
          get: function() {
            if (!this.primary && !this.secondary) {
              return void 0;
            }
            return {
              primary: this.primary,
              secondary: this.secondary
            };
          },
          enumerable: false,
          configurable: true
        });
        Object.defineProperty(MarketingExternalActivityTopBar2.prototype, "buttonsOptions", {
          get: function() {
            if (!this.primaryOptions && !this.secondaryOptions) {
              return void 0;
            }
            return {
              primary: this.primaryOptions,
              secondary: this.secondaryOptions
            };
          },
          enumerable: false,
          configurable: true
        });
        Object.defineProperty(MarketingExternalActivityTopBar2.prototype, "options", {
          get: function() {
            return {
              title: this.title,
              status: this.status,
              saving: this.saving,
              saved: this.saved,
              buttons: this.buttonsOptions
            };
          },
          enumerable: false,
          configurable: true
        });
        Object.defineProperty(MarketingExternalActivityTopBar2.prototype, "payload", {
          get: function() {
            return __assign(__assign({}, this.options), { buttons: this.buttons, id: this.id });
          },
          enumerable: false,
          configurable: true
        });
        MarketingExternalActivityTopBar2.prototype.set = function(options, shouldUpdate) {
          if (shouldUpdate === void 0) {
            shouldUpdate = true;
          }
          var mergedOptions = helper_1.getMergedProps(this.options, options);
          var title = mergedOptions.title, buttons = mergedOptions.buttons, saved = mergedOptions.saved, saving = mergedOptions.saving, status = mergedOptions.status;
          this.title = title;
          this.saving = saving;
          this.saved = saved;
          this.status = status;
          this.setPrimaryButton(buttons ? buttons.primary : void 0);
          this.setSecondaryButtons(buttons ? buttons.secondary : void 0);
          if (shouldUpdate) {
            this.dispatch(MarketingExternalActivityTopBar_1.Action.UPDATE);
          }
          return this;
        };
        MarketingExternalActivityTopBar2.prototype.dispatch = function(action) {
          switch (action) {
            case MarketingExternalActivityTopBar_1.Action.UPDATE:
              this.app.dispatch(update(this.payload));
              break;
          }
          return this;
        };
        MarketingExternalActivityTopBar2.prototype.getButton = function(button, subgroups, updateCb) {
          return buttonHelper_1.getSingleButton(this, button, subgroups, updateCb);
        };
        MarketingExternalActivityTopBar2.prototype.updatePrimaryButton = function(newPayload) {
          if (!this.primary) {
            return;
          }
          if (helper_1.updateActionFromPayload(this.primary, newPayload)) {
            this.dispatch(MarketingExternalActivityTopBar_1.Action.UPDATE);
          }
        };
        MarketingExternalActivityTopBar2.prototype.updateSecondaryButtons = function(newPayload) {
          if (!this.secondary) {
            return;
          }
          var buttonToUpdate = this.secondary.find(function(action) {
            return action.id === newPayload.id;
          });
          if (!buttonToUpdate) {
            return;
          }
          var updated = helper_1.updateActionFromPayload(buttonToUpdate, newPayload);
          if (updated) {
            this.dispatch(MarketingExternalActivityTopBar_1.Action.UPDATE);
          }
        };
        MarketingExternalActivityTopBar2.prototype.setPrimaryButton = function(newOptions) {
          this.primaryOptions = this.getChildButton(newOptions, this.primaryOptions);
          this.primary = this.primaryOptions ? this.getButton(this.primaryOptions, MARKETING_ACTIVITY_TOPBAR_BUTTON_PROPS.subgroups, this.updatePrimaryButton) : void 0;
        };
        MarketingExternalActivityTopBar2.prototype.setSecondaryButtons = function(newOptions) {
          var _this = this;
          var newButtons = newOptions || [];
          var currentButtons = this.secondaryOptions || [];
          this.secondaryOptions = this.getUpdatedChildActions(newButtons, currentButtons);
          this.secondary = this.secondaryOptions ? this.secondaryOptions.map(function(action) {
            return _this.getButton(action, MARKETING_ACTIVITY_TOPBAR_BUTTON_PROPS.subgroups, _this.updateSecondaryButtons);
          }) : void 0;
        };
        MarketingExternalActivityTopBar2.prototype.updateSaving = function(saving) {
          this.saving = saving;
          this.dispatch(MarketingExternalActivityTopBar_1.Action.UPDATE);
        };
        MarketingExternalActivityTopBar2.prototype.updateSaved = function(saved) {
          this.saved = saved;
          this.dispatch(MarketingExternalActivityTopBar_1.Action.UPDATE);
        };
        MarketingExternalActivityTopBar2.prototype.updateStatus = function(newPayload) {
          this.status = newPayload;
          this.dispatch(MarketingExternalActivityTopBar_1.Action.UPDATE);
        };
        MarketingExternalActivityTopBar2.prototype.getChildButton = function(newAction, currentAction) {
          var newButtons = newAction ? [newAction] : [];
          var currentButtons = currentAction ? [currentAction] : [];
          var updatedButton = this.getUpdatedChildActions(newButtons, currentButtons);
          return updatedButton ? updatedButton[0] : void 0;
        };
        return MarketingExternalActivityTopBar2;
      }(ActionSet_1.ActionSetWithChildren)
    );
    exports.MarketingExternalActivityTopBar = MarketingExternalActivityTopBar;
    function create(app, options) {
      return new MarketingExternalActivityTopBar(app, options);
    }
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge-core/actions/Performance/index.js
var require_Performance = __commonJS({
  "node_modules/@shopify/app-bridge-core/actions/Performance/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.fullPageLoad = exports.skeletonPageLoad = exports.Action = void 0;
    var types_1 = require_types();
    var helper_1 = require_helper();
    var Action;
    (function(Action2) {
      Action2["SKELETON_PAGE_LOAD"] = "APP::PERFORMANCE::SKELETON_PAGE_LOAD";
      Action2["FULL_PAGE_LOAD"] = "APP::PERFORMANCE::FULL_PAGE_LOAD";
    })(Action = exports.Action || (exports.Action = {}));
    function skeletonPageLoad() {
      return helper_1.actionWrapper({
        group: types_1.Group.Performance,
        type: Action.SKELETON_PAGE_LOAD
      });
    }
    exports.skeletonPageLoad = skeletonPageLoad;
    function fullPageLoad() {
      return helper_1.actionWrapper({
        group: types_1.Group.Performance,
        type: Action.FULL_PAGE_LOAD
      });
    }
    exports.fullPageLoad = fullPageLoad;
  }
});

// node_modules/@shopify/app-bridge/actions/Performance/index.js
var require_Performance2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Performance/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.fullPageLoad = exports.skeletonPageLoad = exports.Action = void 0;
    var Performance_1 = require_Performance();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Performance_1.Action;
    } });
    Object.defineProperty(exports, "skeletonPageLoad", { enumerable: true, get: function() {
      return Performance_1.skeletonPageLoad;
    } });
    Object.defineProperty(exports, "fullPageLoad", { enumerable: true, get: function() {
      return Performance_1.fullPageLoad;
    } });
  }
});

// node_modules/@shopify/app-bridge/actions/Picker/index.js
var require_Picker2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/Picker/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.create = exports.unstable_Picker = exports.update = exports.select = exports.search = exports.open = exports.loadMore = exports.cancel = exports.ALL_RESOURCE_VERTICAL_ALIGNMENT = exports.ALL_MEDIA_KINDS = exports.ALL_BADGE_STATUSES = exports.ALL_BADGE_PROGRESSES = exports.Action = void 0;
    var Picker_1 = require_Picker();
    Object.defineProperty(exports, "unstable_Picker", { enumerable: true, get: function() {
      return Picker_1.unstable_Picker;
    } });
    var Picker_2 = require_Picker();
    Object.defineProperty(exports, "Action", { enumerable: true, get: function() {
      return Picker_2.Action;
    } });
    Object.defineProperty(exports, "ALL_BADGE_PROGRESSES", { enumerable: true, get: function() {
      return Picker_2.ALL_BADGE_PROGRESSES;
    } });
    Object.defineProperty(exports, "ALL_BADGE_STATUSES", { enumerable: true, get: function() {
      return Picker_2.ALL_BADGE_STATUSES;
    } });
    Object.defineProperty(exports, "ALL_MEDIA_KINDS", { enumerable: true, get: function() {
      return Picker_2.ALL_MEDIA_KINDS;
    } });
    Object.defineProperty(exports, "ALL_RESOURCE_VERTICAL_ALIGNMENT", { enumerable: true, get: function() {
      return Picker_2.ALL_RESOURCE_VERTICAL_ALIGNMENT;
    } });
    Object.defineProperty(exports, "cancel", { enumerable: true, get: function() {
      return Picker_2.cancel;
    } });
    Object.defineProperty(exports, "loadMore", { enumerable: true, get: function() {
      return Picker_2.loadMore;
    } });
    Object.defineProperty(exports, "open", { enumerable: true, get: function() {
      return Picker_2.open;
    } });
    Object.defineProperty(exports, "search", { enumerable: true, get: function() {
      return Picker_2.search;
    } });
    Object.defineProperty(exports, "select", { enumerable: true, get: function() {
      return Picker_2.select;
    } });
    Object.defineProperty(exports, "update", { enumerable: true, get: function() {
      return Picker_2.update;
    } });
    var create = function(app, options) {
      return new Picker_1.unstable_Picker(app, options);
    };
    exports.create = create;
  }
});

// node_modules/@shopify/app-bridge/actions/validator.js
var require_validator2 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/validator.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isFromApp = exports.isPerformanceOrWebVitalsAction = exports.getPermissionKey = exports.isPermitted = exports.isAppMessage = exports.isAppBridgeAction = void 0;
    var validator_1 = require_validator();
    Object.defineProperty(exports, "isAppBridgeAction", { enumerable: true, get: function() {
      return validator_1.isAppBridgeAction;
    } });
    Object.defineProperty(exports, "isAppMessage", { enumerable: true, get: function() {
      return validator_1.isAppMessage;
    } });
    Object.defineProperty(exports, "isPermitted", { enumerable: true, get: function() {
      return validator_1.isPermitted;
    } });
    Object.defineProperty(exports, "getPermissionKey", { enumerable: true, get: function() {
      return validator_1.getPermissionKey;
    } });
    Object.defineProperty(exports, "isPerformanceOrWebVitalsAction", { enumerable: true, get: function() {
      return validator_1.isPerformanceOrWebVitalsAction;
    } });
    function isFromApp(action) {
      if (typeof action !== "object" || typeof action.source !== "object") {
        return false;
      }
      return typeof action.source.apiKey === "string";
    }
    exports.isFromApp = isFromApp;
  }
});

// node_modules/@shopify/app-bridge/actions/index.js
var require_actions4 = __commonJS({
  "node_modules/@shopify/app-bridge/actions/index.js"(exports) {
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
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WebVitals = exports.unstable_Picker = exports.Performance = exports.Pos = exports.AppLink = exports.ChannelMenu = exports.NavigationMenu = exports.Share = exports.ContextualSaveBar = exports.MarketingExternalActivityTopBar = exports.TitleBar = exports.SessionToken = exports.ResourcePicker = exports.Redirect = exports.Print = exports.ModalContent = exports.Modal = exports.Loading = exports.LeaveConfirmation = exports.History = exports.Toast = exports.Fullscreen = exports.FeedbackModal = exports.Features = exports.Flash = exports.Error = exports.Client = exports.Cart = exports.Scanner = exports.ButtonGroup = exports.Button = exports.AuthCode = exports.isAppBridgeAction = void 0;
    var AuthCode = __importStar(require_AuthCode2());
    exports.AuthCode = AuthCode;
    var Button = __importStar(require_Button2());
    exports.Button = Button;
    var ButtonGroup = __importStar(require_ButtonGroup2());
    exports.ButtonGroup = ButtonGroup;
    var Cart = __importStar(require_Cart());
    exports.Cart = Cart;
    var Client = __importStar(require_Client());
    exports.Client = Client;
    var Error2 = __importStar(require_Error());
    exports.Error = Error2;
    var Flash = __importStar(require_Flash());
    exports.Flash = Flash;
    var Features = __importStar(require_Features2());
    exports.Features = Features;
    var FeedbackModal = __importStar(require_FeedbackModal2());
    exports.FeedbackModal = FeedbackModal;
    var Fullscreen = __importStar(require_Fullscreen());
    exports.Fullscreen = Fullscreen;
    var LeaveConfirmation = __importStar(require_LeaveConfirmation2());
    exports.LeaveConfirmation = LeaveConfirmation;
    var Loading = __importStar(require_Loading());
    exports.Loading = Loading;
    var Modal = __importStar(require_Modal2());
    exports.Modal = Modal;
    var ModalContent = __importStar(require_ModalContent2());
    exports.ModalContent = ModalContent;
    var History = __importStar(require_History2());
    exports.History = History;
    var Redirect = __importStar(require_Redirect2());
    exports.Redirect = Redirect;
    var Print = __importStar(require_Print());
    exports.Print = Print;
    var ResourcePicker = __importStar(require_ResourcePicker2());
    exports.ResourcePicker = ResourcePicker;
    var Scanner = __importStar(require_Scanner());
    exports.Scanner = Scanner;
    var SessionToken = __importStar(require_SessionToken2());
    exports.SessionToken = SessionToken;
    var TitleBar = __importStar(require_TitleBar2());
    exports.TitleBar = TitleBar;
    var Toast = __importStar(require_Toast2());
    exports.Toast = Toast;
    var ContextualSaveBar = __importStar(require_ContextualSaveBar2());
    exports.ContextualSaveBar = ContextualSaveBar;
    var Share = __importStar(require_Share2());
    exports.Share = Share;
    var NavigationMenu = __importStar(require_NavigationMenu2());
    exports.NavigationMenu = NavigationMenu;
    var ChannelMenu = __importStar(require_ChannelMenu2());
    exports.ChannelMenu = ChannelMenu;
    var AppLink = __importStar(require_AppLink2());
    exports.AppLink = AppLink;
    var Pos = __importStar(require_Pos2());
    exports.Pos = Pos;
    var MarketingExternalActivityTopBar = __importStar(require_MarketingExternalActivityTopBar2());
    exports.MarketingExternalActivityTopBar = MarketingExternalActivityTopBar;
    var Performance = __importStar(require_Performance2());
    exports.Performance = Performance;
    var unstable_Picker = __importStar(require_Picker2());
    exports.unstable_Picker = unstable_Picker;
    var WebVitals = __importStar(require_WebVitals());
    exports.WebVitals = WebVitals;
    var validator_1 = require_validator2();
    Object.defineProperty(exports, "isAppBridgeAction", { enumerable: true, get: function() {
      return validator_1.isAppBridgeAction;
    } });
    __exportStar(require_types2(), exports);
  }
});
export default require_actions4();
//# sourceMappingURL=@shopify_app-bridge_actions.js.map
