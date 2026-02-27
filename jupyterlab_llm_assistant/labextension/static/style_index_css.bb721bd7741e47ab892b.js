"use strict";
(self["webpackChunkjupyterlab_llm_assistant"] = self["webpackChunkjupyterlab_llm_assistant"] || []).push([["style_index_css"],{

/***/ "./node_modules/css-loader/dist/runtime/api.js"
/*!*****************************************************!*\
  !*** ./node_modules/css-loader/dist/runtime/api.js ***!
  \*****************************************************/
(module) {



/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
module.exports = function (cssWithMappingToString) {
  var list = [];

  // return the list of modules as css string
  list.toString = function toString() {
    return this.map(function (item) {
      var content = "";
      var needLayer = typeof item[5] !== "undefined";
      if (item[4]) {
        content += "@supports (".concat(item[4], ") {");
      }
      if (item[2]) {
        content += "@media ".concat(item[2], " {");
      }
      if (needLayer) {
        content += "@layer".concat(item[5].length > 0 ? " ".concat(item[5]) : "", " {");
      }
      content += cssWithMappingToString(item);
      if (needLayer) {
        content += "}";
      }
      if (item[2]) {
        content += "}";
      }
      if (item[4]) {
        content += "}";
      }
      return content;
    }).join("");
  };

  // import a list of modules into the list
  list.i = function i(modules, media, dedupe, supports, layer) {
    if (typeof modules === "string") {
      modules = [[null, modules, undefined]];
    }
    var alreadyImportedModules = {};
    if (dedupe) {
      for (var k = 0; k < this.length; k++) {
        var id = this[k][0];
        if (id != null) {
          alreadyImportedModules[id] = true;
        }
      }
    }
    for (var _k = 0; _k < modules.length; _k++) {
      var item = [].concat(modules[_k]);
      if (dedupe && alreadyImportedModules[item[0]]) {
        continue;
      }
      if (typeof layer !== "undefined") {
        if (typeof item[5] === "undefined") {
          item[5] = layer;
        } else {
          item[1] = "@layer".concat(item[5].length > 0 ? " ".concat(item[5]) : "", " {").concat(item[1], "}");
          item[5] = layer;
        }
      }
      if (media) {
        if (!item[2]) {
          item[2] = media;
        } else {
          item[1] = "@media ".concat(item[2], " {").concat(item[1], "}");
          item[2] = media;
        }
      }
      if (supports) {
        if (!item[4]) {
          item[4] = "".concat(supports);
        } else {
          item[1] = "@supports (".concat(item[4], ") {").concat(item[1], "}");
          item[4] = supports;
        }
      }
      list.push(item);
    }
  };
  return list;
};

/***/ },

/***/ "./node_modules/css-loader/dist/runtime/sourceMaps.js"
/*!************************************************************!*\
  !*** ./node_modules/css-loader/dist/runtime/sourceMaps.js ***!
  \************************************************************/
(module) {



module.exports = function (item) {
  var content = item[1];
  var cssMapping = item[3];
  if (!cssMapping) {
    return content;
  }
  if (typeof btoa === "function") {
    var base64 = btoa(unescape(encodeURIComponent(JSON.stringify(cssMapping))));
    var data = "sourceMappingURL=data:application/json;charset=utf-8;base64,".concat(base64);
    var sourceMapping = "/*# ".concat(data, " */");
    return [content].concat([sourceMapping]).join("\n");
  }
  return [content].join("\n");
};

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js"
/*!****************************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js ***!
  \****************************************************************************/
(module) {



var stylesInDOM = [];
function getIndexByIdentifier(identifier) {
  var result = -1;
  for (var i = 0; i < stylesInDOM.length; i++) {
    if (stylesInDOM[i].identifier === identifier) {
      result = i;
      break;
    }
  }
  return result;
}
function modulesToDom(list, options) {
  var idCountMap = {};
  var identifiers = [];
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var id = options.base ? item[0] + options.base : item[0];
    var count = idCountMap[id] || 0;
    var identifier = "".concat(id, " ").concat(count);
    idCountMap[id] = count + 1;
    var indexByIdentifier = getIndexByIdentifier(identifier);
    var obj = {
      css: item[1],
      media: item[2],
      sourceMap: item[3],
      supports: item[4],
      layer: item[5]
    };
    if (indexByIdentifier !== -1) {
      stylesInDOM[indexByIdentifier].references++;
      stylesInDOM[indexByIdentifier].updater(obj);
    } else {
      var updater = addElementStyle(obj, options);
      options.byIndex = i;
      stylesInDOM.splice(i, 0, {
        identifier: identifier,
        updater: updater,
        references: 1
      });
    }
    identifiers.push(identifier);
  }
  return identifiers;
}
function addElementStyle(obj, options) {
  var api = options.domAPI(options);
  api.update(obj);
  var updater = function updater(newObj) {
    if (newObj) {
      if (newObj.css === obj.css && newObj.media === obj.media && newObj.sourceMap === obj.sourceMap && newObj.supports === obj.supports && newObj.layer === obj.layer) {
        return;
      }
      api.update(obj = newObj);
    } else {
      api.remove();
    }
  };
  return updater;
}
module.exports = function (list, options) {
  options = options || {};
  list = list || [];
  var lastIdentifiers = modulesToDom(list, options);
  return function update(newList) {
    newList = newList || [];
    for (var i = 0; i < lastIdentifiers.length; i++) {
      var identifier = lastIdentifiers[i];
      var index = getIndexByIdentifier(identifier);
      stylesInDOM[index].references--;
    }
    var newLastIdentifiers = modulesToDom(newList, options);
    for (var _i = 0; _i < lastIdentifiers.length; _i++) {
      var _identifier = lastIdentifiers[_i];
      var _index = getIndexByIdentifier(_identifier);
      if (stylesInDOM[_index].references === 0) {
        stylesInDOM[_index].updater();
        stylesInDOM.splice(_index, 1);
      }
    }
    lastIdentifiers = newLastIdentifiers;
  };
};

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/insertBySelector.js"
/*!********************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/insertBySelector.js ***!
  \********************************************************************/
(module) {



var memo = {};

/* istanbul ignore next  */
function getTarget(target) {
  if (typeof memo[target] === "undefined") {
    var styleTarget = document.querySelector(target);

    // Special case to return head of iframe instead of iframe itself
    if (window.HTMLIFrameElement && styleTarget instanceof window.HTMLIFrameElement) {
      try {
        // This will throw an exception if access to iframe is blocked
        // due to cross-origin restrictions
        styleTarget = styleTarget.contentDocument.head;
      } catch (e) {
        // istanbul ignore next
        styleTarget = null;
      }
    }
    memo[target] = styleTarget;
  }
  return memo[target];
}

/* istanbul ignore next  */
function insertBySelector(insert, style) {
  var target = getTarget(insert);
  if (!target) {
    throw new Error("Couldn't find a style target. This probably means that the value for the 'insert' parameter is invalid.");
  }
  target.appendChild(style);
}
module.exports = insertBySelector;

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/insertStyleElement.js"
/*!**********************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/insertStyleElement.js ***!
  \**********************************************************************/
(module) {



/* istanbul ignore next  */
function insertStyleElement(options) {
  var element = document.createElement("style");
  options.setAttributes(element, options.attributes);
  options.insert(element, options.options);
  return element;
}
module.exports = insertStyleElement;

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js"
/*!**********************************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js ***!
  \**********************************************************************************/
(module, __unused_webpack_exports, __webpack_require__) {



/* istanbul ignore next  */
function setAttributesWithoutAttributes(styleElement) {
  var nonce =  true ? __webpack_require__.nc : 0;
  if (nonce) {
    styleElement.setAttribute("nonce", nonce);
  }
}
module.exports = setAttributesWithoutAttributes;

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/styleDomAPI.js"
/*!***************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/styleDomAPI.js ***!
  \***************************************************************/
(module) {



/* istanbul ignore next  */
function apply(styleElement, options, obj) {
  var css = "";
  if (obj.supports) {
    css += "@supports (".concat(obj.supports, ") {");
  }
  if (obj.media) {
    css += "@media ".concat(obj.media, " {");
  }
  var needLayer = typeof obj.layer !== "undefined";
  if (needLayer) {
    css += "@layer".concat(obj.layer.length > 0 ? " ".concat(obj.layer) : "", " {");
  }
  css += obj.css;
  if (needLayer) {
    css += "}";
  }
  if (obj.media) {
    css += "}";
  }
  if (obj.supports) {
    css += "}";
  }
  var sourceMap = obj.sourceMap;
  if (sourceMap && typeof btoa !== "undefined") {
    css += "\n/*# sourceMappingURL=data:application/json;base64,".concat(btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap)))), " */");
  }

  // For old IE
  /* istanbul ignore if  */
  options.styleTagTransform(css, styleElement, options.options);
}
function removeStyleElement(styleElement) {
  // istanbul ignore if
  if (styleElement.parentNode === null) {
    return false;
  }
  styleElement.parentNode.removeChild(styleElement);
}

/* istanbul ignore next  */
function domAPI(options) {
  if (typeof document === "undefined") {
    return {
      update: function update() {},
      remove: function remove() {}
    };
  }
  var styleElement = options.insertStyleElement(options);
  return {
    update: function update(obj) {
      apply(styleElement, options, obj);
    },
    remove: function remove() {
      removeStyleElement(styleElement);
    }
  };
}
module.exports = domAPI;

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/styleTagTransform.js"
/*!*********************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/styleTagTransform.js ***!
  \*********************************************************************/
(module) {



/* istanbul ignore next  */
function styleTagTransform(css, styleElement) {
  if (styleElement.styleSheet) {
    styleElement.styleSheet.cssText = css;
  } else {
    while (styleElement.firstChild) {
      styleElement.removeChild(styleElement.firstChild);
    }
    styleElement.appendChild(document.createTextNode(css));
  }
}
module.exports = styleTagTransform;

/***/ },

/***/ "./node_modules/css-loader/dist/cjs.js!./style/chat.css"
/*!**************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./style/chat.css ***!
  \**************************************************************/
(module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../node_modules/css-loader/dist/runtime/sourceMaps.js */ "./node_modules/css-loader/dist/runtime/sourceMaps.js");
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/* LLM Assistant Chat Panel Styles */

/* ==============================================================================
   Chat Panel Container
   ============================================================================== */

.llm-chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--jp-layout-color1);
  color: var(--jp-ui-font-color1);
  font-family: var(--jp-ui-font-family);
  overflow: hidden;
}

/* ==============================================================================
   Header
   ============================================================================== */

.llm-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--jp-border-color0);
  background-color: var(--jp-layout-color0);
  flex-shrink: 0;
}

.llm-chat-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--jp-ui-font-color0);
  display: flex;
  align-items: center;
  gap: 8px;
}

.llm-chat-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.llm-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--jp-ui-font-color1);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.llm-icon-btn:hover {
  background-color: var(--jp-layout-color2);
  color: var(--jp-ui-font-color0);
}

.llm-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.llm-icon-btn.active {
  background-color: var(--jp-brand-color1);
  color: white;
}

/* ==============================================================================
   Message List
   ============================================================================== */

.llm-message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.llm-message-list-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ==============================================================================
   Empty State
   ============================================================================== */

.llm-empty-state {
  text-align: center;
  padding: 32px;
  color: var(--jp-ui-font-color2);
}

.llm-empty-icon {
  margin-bottom: 16px;
  opacity: 0.6;
}

.llm-empty-state h3 {
  font-size: 18px;
  font-weight: 500;
  margin: 0 0 8px 0;
  color: var(--jp-ui-font-color1);
}

.llm-empty-state p {
  font-size: 14px;
  margin: 0 0 16px 0;
}

.llm-empty-hints {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 13px;
}

.llm-empty-hints li {
  padding: 4px 0;
  position: relative;
  padding-left: 16px;
}

.llm-empty-hints li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--jp-brand-color1);
}

/* ==============================================================================
   Message Item
   ============================================================================== */

.llm-message-item {
  display: flex;
  gap: 12px;
  animation: llm-message-fade-in 0.2s ease-out;
}

@keyframes llm-message-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.llm-message-item.user {
  flex-direction: row-reverse;
}

.llm-message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 600;
}

.llm-message-item.user .llm-message-avatar {
  background-color: var(--jp-brand-color1);
  color: white;
}

.llm-message-item.assistant .llm-message-avatar {
  background-color: var(--jp-accent-color1);
  color: white;
}

.llm-message-item.system .llm-message-avatar {
  background-color: var(--jp-warn-color1);
  color: white;
}

.llm-message-content {
  max-width: calc(100% - 56px);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.llm-message-item.user .llm-message-content {
  align-items: flex-end;
}

.llm-message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--jp-ui-font-color2);
}

.llm-message-role {
  font-weight: 500;
  color: var(--jp-ui-font-color1);
}

.llm-message-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.llm-message-item.user .llm-message-bubble {
  background-color: var(--jp-brand-color1);
  color: white;
  border-bottom-right-radius: 4px;
}

.llm-message-item.assistant .llm-message-bubble,
.llm-message-item.system .llm-message-bubble {
  background-color: var(--jp-layout-color2);
  color: var(--jp-ui-font-color1);
  border-bottom-left-radius: 4px;
}

/* Error state */
.llm-message-item.error .llm-message-bubble {
  background-color: var(--jp-error-color0);
  color: var(--jp-ui-inverse-font-color0);
}

/* ==============================================================================
   Input Area
   ============================================================================== */

.llm-input-area {
  padding: 12px 16px;
  border-top: 1px solid var(--jp-border-color0);
  background-color: var(--jp-layout-color0);
  flex-shrink: 0;
}

.llm-image-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  padding: 8px;
  background-color: var(--jp-layout-color1);
  border-radius: 8px;
}

.llm-image-preview {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--jp-border-color1);
}

.llm-image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.llm-image-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.llm-image-preview:hover .llm-image-remove {
  opacity: 1;
}

.llm-image-remove:hover {
  background-color: rgba(0, 0, 0, 0.8);
}

.llm-input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.llm-image-btn,
.llm-send-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background-color: var(--jp-layout-color2);
  color: var(--jp-ui-font-color1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.2s, color 0.2s;
}

.llm-image-btn:hover:not(:disabled),
.llm-send-btn:hover:not(:disabled) {
  background-color: var(--jp-layout-color3);
  color: var(--jp-ui-font-color0);
}

.llm-image-btn:disabled,
.llm-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.llm-send-btn:not(:disabled) {
  background-color: var(--jp-brand-color1);
  color: white;
}

.llm-send-btn:not(:disabled):hover {
  background-color: var(--jp-brand-color0);
}

.llm-text-input {
  flex: 1;
  min-height: 36px;
  max-height: 200px;
  padding: 8px 12px;
  border: 1px solid var(--jp-border-color1);
  border-radius: 8px;
  background-color: var(--jp-layout-color1);
  color: var(--jp-ui-font-color1);
  font-family: var(--jp-ui-font-family);
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
}

.llm-text-input:focus {
  border-color: var(--jp-brand-color1);
}

.llm-text-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.llm-input-hint {
  text-align: center;
  margin-top: 8px;
  font-size: 11px;
  color: var(--jp-ui-font-color2);
}

/* ==============================================================================
   Loading Indicator
   ============================================================================== */

.llm-loading-indicator {
  display: flex;
  align-items: center;
  padding: 12px 16px;
}

.llm-loading-dots {
  display: flex;
  gap: 4px;
}

.llm-loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--jp-ui-font-color2);
  animation: llm-loading-bounce 1.4s ease-in-out infinite both;
}

.llm-loading-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.llm-loading-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes llm-loading-bounce {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* ==============================================================================
   Settings Panel
   ============================================================================== */

.llm-settings-panel {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.llm-settings-section {
  margin-bottom: 24px;
}

.llm-settings-section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--jp-ui-font-color2);
  margin: 0 0 12px 0;
}

.llm-settings-field {
  margin-bottom: 16px;
}

.llm-settings-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--jp-ui-font-color1);
  margin-bottom: 6px;
}

.llm-settings-description {
  font-size: 12px;
  color: var(--jp-ui-font-color2);
  margin: 4px 0 0 0;
}

.llm-settings-input,
.llm-settings-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--jp-border-color1);
  border-radius: 6px;
  background-color: var(--jp-layout-color1);
  color: var(--jp-ui-font-color1);
  font-family: var(--jp-ui-font-family);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.llm-settings-input:focus,
.llm-settings-select:focus {
  border-color: var(--jp-brand-color1);
}

.llm-settings-checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.llm-settings-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--jp-brand-color1);
}

.llm-settings-checkbox-label {
  font-size: 13px;
  color: var(--jp-ui-font-color1);
}

.llm-settings-actions {
  display: flex;
  gap: 8px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--jp-border-color0);
}

.llm-settings-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.llm-settings-btn-primary {
  background-color: var(--jp-brand-color1);
  color: white;
}

.llm-settings-btn-primary:hover:not(:disabled) {
  background-color: var(--jp-brand-color0);
}

.llm-settings-btn-secondary {
  background-color: var(--jp-layout-color2);
  color: var(--jp-ui-font-color1);
}

.llm-settings-btn-secondary:hover {
  background-color: var(--jp-layout-color3);
}

.llm-settings-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.llm-test-status {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
}

.llm-test-status.success {
  background-color: var(--jp-success-color0);
  color: var(--jp-ui-inverse-font-color0);
}

.llm-test-status.error {
  background-color: var(--jp-error-color0);
  color: var(--jp-ui-inverse-font-color0);
}

/* ==============================================================================
   New Settings Panel Styles
   ============================================================================== */

.llm-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 16px 0;
  border-bottom: 1px solid var(--jp-border-color0);
  margin-bottom: 16px;
}

.llm-settings-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--jp-ui-font-color0);
}

.llm-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--jp-ui-font-color2);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.llm-close-btn:hover {
  background-color: var(--jp-layout-color2);
  color: var(--jp-ui-font-color0);
}

.llm-settings-content {
  padding: 0;
}

.llm-section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--jp-ui-font-color2);
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--jp-border-color2);
}

.llm-settings-section {
  margin-bottom: 24px;
}

.llm-settings-field {
  margin-bottom: 16px;
}

.llm-settings-field label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--jp-ui-font-color1);
  margin-bottom: 6px;
}

.llm-settings-field input[type="text"],
.llm-settings-field input[type="password"],
.llm-settings-field input[type="number"],
.llm-settings-field select,
.llm-settings-field textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--jp-border-color1);
  border-radius: 6px;
  background-color: var(--jp-layout-color1);
  color: var(--jp-ui-font-color1);
  font-family: var(--jp-ui-font-family);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.llm-settings-field input:focus,
.llm-settings-field select:focus,
.llm-settings-field textarea:focus {
  border-color: var(--jp-brand-color1);
  box-shadow: 0 0 0 2px rgba(19, 124, 189, 0.2);
}

.llm-input-with-button {
  display: flex;
  gap: 8px;
}

.llm-api-key-input {
  flex: 1;
}

.llm-toggle-visibility-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--jp-border-color1);
  border-radius: 6px;
  background-color: var(--jp-layout-color2);
  color: var(--jp-ui-font-color1);
  cursor: pointer;
  transition: background-color 0.2s;
}

.llm-toggle-visibility-btn:hover {
  background-color: var(--jp-layout-color3);
}

.llm-settings-field input[type="range"] {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--jp-layout-color3);
  outline: none;
  -webkit-appearance: none;
}

.llm-settings-field input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--jp-brand-color1);
  cursor: pointer;
}

.llm-settings-hint {
  font-size: 11px;
  color: var(--jp-ui-font-color2);
  margin: 6px 0 0 0;
}

.llm-settings-hint code {
  background-color: var(--jp-layout-color3);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: var(--jp-code-font-family);
}

.llm-settings-toggle label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 500;
}

.llm-settings-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--jp-brand-color1);
  cursor: pointer;
}

.llm-api-key-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 8px;
}

.llm-status-ok {
  background-color: var(--jp-success-color0);
  color: var(--jp-ui-inverse-font-color0);
}

.llm-status-error {
  background-color: var(--jp-error-color0);
  color: var(--jp-ui-inverse-font-color0);
}

.llm-test-btn {
  width: 100%;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  background-color: var(--jp-brand-color1);
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.llm-test-btn:hover:not(:disabled) {
  background-color: var(--jp-brand-color0);
}

.llm-test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.llm-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: llm-spin 0.8s linear infinite;
}

@keyframes llm-spin {
  to {
    transform: rotate(360deg);
  }
}

.llm-test-result {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.llm-test-success {
  background-color: var(--jp-success-color0);
  color: var(--jp-ui-inverse-font-color0);
}

.llm-test-error {
  background-color: var(--jp-error-color0);
  color: var(--jp-ui-inverse-font-color0);
}

.llm-settings-footer {
  display: flex;
  gap: 12px;
  padding: 16px 0 0 0;
  border-top: 1px solid var(--jp-border-color0);
  margin-top: 24px;
}

.llm-cancel-btn,
.llm-save-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.llm-cancel-btn {
  background-color: var(--jp-layout-color2);
  color: var(--jp-ui-font-color1);
}

.llm-cancel-btn:hover {
  background-color: var(--jp-layout-color3);
}

.llm-save-btn {
  background-color: var(--jp-brand-color1);
  color: white;
}

.llm-save-btn:hover:not(:disabled) {
  background-color: var(--jp-brand-color0);
}

.llm-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.llm-value {
  font-weight: 600;
  color: var(--jp-brand-color1);
}

/* ==============================================================================
   Markdown Content
   ============================================================================== */

.llm-markdown-content {
  line-height: 1.6;
}

.llm-markdown-content *:first-child {
  margin-top: 0;
}

.llm-markdown-content *:last-child {
  margin-bottom: 0;
}

.llm-md-paragraph {
  margin: 8px 0;
}

.llm-md-link {
  color: var(--jp-link-color);
  text-decoration: none;
}

.llm-md-link:hover {
  text-decoration: underline;
}

.llm-md-code-inline {
  font-family: var(--jp-code-font-family);
  font-size: 0.9em;
  padding: 2px 6px;
  background-color: var(--jp-layout-color3);
  border-radius: 4px;
  color: var(--jp-content-font-color1);
}

.llm-message-item.user .llm-md-code-inline {
  background-color: rgba(255, 255, 255, 0.2);
  color: inherit;
}

.llm-md-list {
  margin: 8px 0;
  padding-left: 24px;
}

.llm-md-list-ordered {
  list-style-type: decimal;
}

.llm-md-list-item {
  margin: 4px 0;
}

.llm-md-heading {
  font-weight: 600;
  margin: 16px 0 8px 0;
  color: var(--jp-content-font-color0);
}

.llm-message-item.user .llm-md-heading {
  color: inherit;
}

.llm-md-heading-1 {
  font-size: 1.5em;
  border-bottom: 1px solid var(--jp-border-color1);
  padding-bottom: 8px;
}

.llm-md-heading-2 {
  font-size: 1.3em;
}

.llm-md-heading-3 {
  font-size: 1.1em;
}

.llm-md-heading-4,
.llm-md-heading-5,
.llm-md-heading-6 {
  font-size: 1em;
}

.llm-md-blockquote {
  margin: 8px 0;
  padding: 8px 16px;
  border-left: 4px solid var(--jp-brand-color1);
  background-color: var(--jp-layout-color2);
  color: var(--jp-ui-font-color2);
}

.llm-md-table-wrapper {
  overflow-x: auto;
  margin: 8px 0;
}

.llm-md-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.llm-md-th,
.llm-md-td {
  padding: 8px 12px;
  border: 1px solid var(--jp-border-color1);
  text-align: left;
}

.llm-md-th {
  background-color: var(--jp-layout-color2);
  font-weight: 600;
}

/* ==============================================================================
   Code Block
   ============================================================================== */

.llm-code-block {
  margin: 12px 0;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--jp-cell-editor-background);
  border: 1px solid var(--jp-border-color1);
}

.llm-code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: var(--jp-layout-color2);
  border-bottom: 1px solid var(--jp-border-color1);
}

.llm-code-language {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  color: var(--jp-ui-font-color2);
}

.llm-code-copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background-color: transparent;
  color: var(--jp-ui-font-color2);
  font-size: 11px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.llm-code-copy-btn:hover {
  background-color: var(--jp-layout-color3);
  color: var(--jp-ui-font-color0);
}

.llm-code-copy-btn.copied {
  color: var(--jp-success-color1);
}

.llm-code-block pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  font-family: var(--jp-code-font-family);
  font-size: 13px;
  line-height: 1.5;
}

.llm-code-block code {
  font-family: var(--jp-code-font-family);
}

/* ==============================================================================
   Image in Message
   ============================================================================== */

.llm-message-image {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  margin: 8px 0;
}

/* ==============================================================================
   Scrollbar Styling
   ============================================================================== */

.llm-chat-panel ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.llm-chat-panel ::-webkit-scrollbar-track {
  background: transparent;
}

.llm-chat-panel ::-webkit-scrollbar-thumb {
  background: var(--jp-scrollbar-thumb-color);
  border-radius: 4px;
}

.llm-chat-panel ::-webkit-scrollbar-thumb:hover {
  background: var(--jp-scrollbar-thumb-hover-color);
}

/* ==============================================================================
   Responsive Adjustments
   ============================================================================== */

@media (max-width: 400px) {
  .llm-message-content {
    max-width: calc(100% - 48px);
  }

  .llm-message-avatar {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }

  .llm-input-area {
    padding: 8px 12px;
  }
}
`, "",{"version":3,"sources":["webpack://./style/chat.css"],"names":[],"mappings":"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","sourcesContent":["/* LLM Assistant Chat Panel Styles */\n\n/* ==============================================================================\n   Chat Panel Container\n   ============================================================================== */\n\n.llm-chat-panel {\n  display: flex;\n  flex-direction: column;\n  height: 100%;\n  background-color: var(--jp-layout-color1);\n  color: var(--jp-ui-font-color1);\n  font-family: var(--jp-ui-font-family);\n  overflow: hidden;\n}\n\n/* ==============================================================================\n   Header\n   ============================================================================== */\n\n.llm-chat-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 12px 16px;\n  border-bottom: 1px solid var(--jp-border-color0);\n  background-color: var(--jp-layout-color0);\n  flex-shrink: 0;\n}\n\n.llm-chat-title {\n  font-size: 14px;\n  font-weight: 600;\n  color: var(--jp-ui-font-color0);\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.llm-chat-actions {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n}\n\n.llm-icon-btn {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  border: none;\n  border-radius: 4px;\n  background: transparent;\n  color: var(--jp-ui-font-color1);\n  cursor: pointer;\n  transition: background-color 0.2s, color 0.2s;\n}\n\n.llm-icon-btn:hover {\n  background-color: var(--jp-layout-color2);\n  color: var(--jp-ui-font-color0);\n}\n\n.llm-icon-btn:disabled {\n  opacity: 0.4;\n  cursor: not-allowed;\n}\n\n.llm-icon-btn.active {\n  background-color: var(--jp-brand-color1);\n  color: white;\n}\n\n/* ==============================================================================\n   Message List\n   ============================================================================== */\n\n.llm-message-list {\n  flex: 1;\n  overflow-y: auto;\n  padding: 16px;\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n}\n\n.llm-message-list-empty {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n/* ==============================================================================\n   Empty State\n   ============================================================================== */\n\n.llm-empty-state {\n  text-align: center;\n  padding: 32px;\n  color: var(--jp-ui-font-color2);\n}\n\n.llm-empty-icon {\n  margin-bottom: 16px;\n  opacity: 0.6;\n}\n\n.llm-empty-state h3 {\n  font-size: 18px;\n  font-weight: 500;\n  margin: 0 0 8px 0;\n  color: var(--jp-ui-font-color1);\n}\n\n.llm-empty-state p {\n  font-size: 14px;\n  margin: 0 0 16px 0;\n}\n\n.llm-empty-hints {\n  list-style: none;\n  padding: 0;\n  margin: 0;\n  font-size: 13px;\n}\n\n.llm-empty-hints li {\n  padding: 4px 0;\n  position: relative;\n  padding-left: 16px;\n}\n\n.llm-empty-hints li::before {\n  content: \"•\";\n  position: absolute;\n  left: 0;\n  color: var(--jp-brand-color1);\n}\n\n/* ==============================================================================\n   Message Item\n   ============================================================================== */\n\n.llm-message-item {\n  display: flex;\n  gap: 12px;\n  animation: llm-message-fade-in 0.2s ease-out;\n}\n\n@keyframes llm-message-fade-in {\n  from {\n    opacity: 0;\n    transform: translateY(8px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n\n.llm-message-item.user {\n  flex-direction: row-reverse;\n}\n\n.llm-message-avatar {\n  width: 32px;\n  height: 32px;\n  border-radius: 50%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex-shrink: 0;\n  font-size: 14px;\n  font-weight: 600;\n}\n\n.llm-message-item.user .llm-message-avatar {\n  background-color: var(--jp-brand-color1);\n  color: white;\n}\n\n.llm-message-item.assistant .llm-message-avatar {\n  background-color: var(--jp-accent-color1);\n  color: white;\n}\n\n.llm-message-item.system .llm-message-avatar {\n  background-color: var(--jp-warn-color1);\n  color: white;\n}\n\n.llm-message-content {\n  max-width: calc(100% - 56px);\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.llm-message-item.user .llm-message-content {\n  align-items: flex-end;\n}\n\n.llm-message-header {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 12px;\n  color: var(--jp-ui-font-color2);\n}\n\n.llm-message-role {\n  font-weight: 500;\n  color: var(--jp-ui-font-color1);\n}\n\n.llm-message-bubble {\n  padding: 12px 16px;\n  border-radius: 12px;\n  font-size: 14px;\n  line-height: 1.6;\n  word-break: break-word;\n}\n\n.llm-message-item.user .llm-message-bubble {\n  background-color: var(--jp-brand-color1);\n  color: white;\n  border-bottom-right-radius: 4px;\n}\n\n.llm-message-item.assistant .llm-message-bubble,\n.llm-message-item.system .llm-message-bubble {\n  background-color: var(--jp-layout-color2);\n  color: var(--jp-ui-font-color1);\n  border-bottom-left-radius: 4px;\n}\n\n/* Error state */\n.llm-message-item.error .llm-message-bubble {\n  background-color: var(--jp-error-color0);\n  color: var(--jp-ui-inverse-font-color0);\n}\n\n/* ==============================================================================\n   Input Area\n   ============================================================================== */\n\n.llm-input-area {\n  padding: 12px 16px;\n  border-top: 1px solid var(--jp-border-color0);\n  background-color: var(--jp-layout-color0);\n  flex-shrink: 0;\n}\n\n.llm-image-previews {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n  margin-bottom: 8px;\n  padding: 8px;\n  background-color: var(--jp-layout-color1);\n  border-radius: 8px;\n}\n\n.llm-image-preview {\n  position: relative;\n  width: 80px;\n  height: 80px;\n  border-radius: 6px;\n  overflow: hidden;\n  border: 1px solid var(--jp-border-color1);\n}\n\n.llm-image-preview img {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n}\n\n.llm-image-remove {\n  position: absolute;\n  top: 2px;\n  right: 2px;\n  width: 20px;\n  height: 20px;\n  border: none;\n  border-radius: 50%;\n  background-color: rgba(0, 0, 0, 0.6);\n  color: white;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  opacity: 0;\n  transition: opacity 0.2s;\n}\n\n.llm-image-preview:hover .llm-image-remove {\n  opacity: 1;\n}\n\n.llm-image-remove:hover {\n  background-color: rgba(0, 0, 0, 0.8);\n}\n\n.llm-input-row {\n  display: flex;\n  align-items: flex-end;\n  gap: 8px;\n}\n\n.llm-image-btn,\n.llm-send-btn {\n  width: 36px;\n  height: 36px;\n  border: none;\n  border-radius: 8px;\n  background-color: var(--jp-layout-color2);\n  color: var(--jp-ui-font-color1);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  flex-shrink: 0;\n  transition: background-color 0.2s, color 0.2s;\n}\n\n.llm-image-btn:hover:not(:disabled),\n.llm-send-btn:hover:not(:disabled) {\n  background-color: var(--jp-layout-color3);\n  color: var(--jp-ui-font-color0);\n}\n\n.llm-image-btn:disabled,\n.llm-send-btn:disabled {\n  opacity: 0.4;\n  cursor: not-allowed;\n}\n\n.llm-send-btn:not(:disabled) {\n  background-color: var(--jp-brand-color1);\n  color: white;\n}\n\n.llm-send-btn:not(:disabled):hover {\n  background-color: var(--jp-brand-color0);\n}\n\n.llm-text-input {\n  flex: 1;\n  min-height: 36px;\n  max-height: 200px;\n  padding: 8px 12px;\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 8px;\n  background-color: var(--jp-layout-color1);\n  color: var(--jp-ui-font-color1);\n  font-family: var(--jp-ui-font-family);\n  font-size: 14px;\n  line-height: 1.5;\n  resize: none;\n  outline: none;\n  transition: border-color 0.2s;\n}\n\n.llm-text-input:focus {\n  border-color: var(--jp-brand-color1);\n}\n\n.llm-text-input:disabled {\n  opacity: 0.6;\n  cursor: not-allowed;\n}\n\n.llm-input-hint {\n  text-align: center;\n  margin-top: 8px;\n  font-size: 11px;\n  color: var(--jp-ui-font-color2);\n}\n\n/* ==============================================================================\n   Loading Indicator\n   ============================================================================== */\n\n.llm-loading-indicator {\n  display: flex;\n  align-items: center;\n  padding: 12px 16px;\n}\n\n.llm-loading-dots {\n  display: flex;\n  gap: 4px;\n}\n\n.llm-loading-dots span {\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;\n  background-color: var(--jp-ui-font-color2);\n  animation: llm-loading-bounce 1.4s ease-in-out infinite both;\n}\n\n.llm-loading-dots span:nth-child(1) {\n  animation-delay: -0.32s;\n}\n\n.llm-loading-dots span:nth-child(2) {\n  animation-delay: -0.16s;\n}\n\n@keyframes llm-loading-bounce {\n  0%,\n  80%,\n  100% {\n    transform: scale(0.6);\n    opacity: 0.5;\n  }\n  40% {\n    transform: scale(1);\n    opacity: 1;\n  }\n}\n\n/* ==============================================================================\n   Settings Panel\n   ============================================================================== */\n\n.llm-settings-panel {\n  padding: 16px;\n  overflow-y: auto;\n  flex: 1;\n}\n\n.llm-settings-section {\n  margin-bottom: 24px;\n}\n\n.llm-settings-section-title {\n  font-size: 12px;\n  font-weight: 600;\n  text-transform: uppercase;\n  letter-spacing: 0.5px;\n  color: var(--jp-ui-font-color2);\n  margin: 0 0 12px 0;\n}\n\n.llm-settings-field {\n  margin-bottom: 16px;\n}\n\n.llm-settings-label {\n  display: block;\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--jp-ui-font-color1);\n  margin-bottom: 6px;\n}\n\n.llm-settings-description {\n  font-size: 12px;\n  color: var(--jp-ui-font-color2);\n  margin: 4px 0 0 0;\n}\n\n.llm-settings-input,\n.llm-settings-select {\n  width: 100%;\n  padding: 8px 12px;\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 6px;\n  background-color: var(--jp-layout-color1);\n  color: var(--jp-ui-font-color1);\n  font-family: var(--jp-ui-font-family);\n  font-size: 13px;\n  outline: none;\n  transition: border-color 0.2s;\n}\n\n.llm-settings-input:focus,\n.llm-settings-select:focus {\n  border-color: var(--jp-brand-color1);\n}\n\n.llm-settings-checkbox-wrapper {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  cursor: pointer;\n}\n\n.llm-settings-checkbox {\n  width: 16px;\n  height: 16px;\n  accent-color: var(--jp-brand-color1);\n}\n\n.llm-settings-checkbox-label {\n  font-size: 13px;\n  color: var(--jp-ui-font-color1);\n}\n\n.llm-settings-actions {\n  display: flex;\n  gap: 8px;\n  margin-top: 24px;\n  padding-top: 16px;\n  border-top: 1px solid var(--jp-border-color0);\n}\n\n.llm-settings-btn {\n  flex: 1;\n  padding: 10px 16px;\n  border: none;\n  border-radius: 6px;\n  font-size: 13px;\n  font-weight: 500;\n  cursor: pointer;\n  transition: background-color 0.2s;\n}\n\n.llm-settings-btn-primary {\n  background-color: var(--jp-brand-color1);\n  color: white;\n}\n\n.llm-settings-btn-primary:hover:not(:disabled) {\n  background-color: var(--jp-brand-color0);\n}\n\n.llm-settings-btn-secondary {\n  background-color: var(--jp-layout-color2);\n  color: var(--jp-ui-font-color1);\n}\n\n.llm-settings-btn-secondary:hover {\n  background-color: var(--jp-layout-color3);\n}\n\n.llm-settings-btn:disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n}\n\n.llm-test-status {\n  margin-top: 8px;\n  padding: 8px 12px;\n  border-radius: 6px;\n  font-size: 12px;\n}\n\n.llm-test-status.success {\n  background-color: var(--jp-success-color0);\n  color: var(--jp-ui-inverse-font-color0);\n}\n\n.llm-test-status.error {\n  background-color: var(--jp-error-color0);\n  color: var(--jp-ui-inverse-font-color0);\n}\n\n/* ==============================================================================\n   New Settings Panel Styles\n   ============================================================================== */\n\n.llm-settings-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 0 0 16px 0;\n  border-bottom: 1px solid var(--jp-border-color0);\n  margin-bottom: 16px;\n}\n\n.llm-settings-header h3 {\n  margin: 0;\n  font-size: 16px;\n  font-weight: 600;\n  color: var(--jp-ui-font-color0);\n}\n\n.llm-close-btn {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  border: none;\n  border-radius: 4px;\n  background: transparent;\n  color: var(--jp-ui-font-color2);\n  cursor: pointer;\n  transition: background-color 0.2s, color 0.2s;\n}\n\n.llm-close-btn:hover {\n  background-color: var(--jp-layout-color2);\n  color: var(--jp-ui-font-color0);\n}\n\n.llm-settings-content {\n  padding: 0;\n}\n\n.llm-section-title {\n  font-size: 12px;\n  font-weight: 600;\n  text-transform: uppercase;\n  letter-spacing: 0.5px;\n  color: var(--jp-ui-font-color2);\n  margin: 0 0 12px 0;\n  padding-bottom: 8px;\n  border-bottom: 1px solid var(--jp-border-color2);\n}\n\n.llm-settings-section {\n  margin-bottom: 24px;\n}\n\n.llm-settings-field {\n  margin-bottom: 16px;\n}\n\n.llm-settings-field label {\n  display: block;\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--jp-ui-font-color1);\n  margin-bottom: 6px;\n}\n\n.llm-settings-field input[type=\"text\"],\n.llm-settings-field input[type=\"password\"],\n.llm-settings-field input[type=\"number\"],\n.llm-settings-field select,\n.llm-settings-field textarea {\n  width: 100%;\n  padding: 8px 12px;\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 6px;\n  background-color: var(--jp-layout-color1);\n  color: var(--jp-ui-font-color1);\n  font-family: var(--jp-ui-font-family);\n  font-size: 13px;\n  outline: none;\n  transition: border-color 0.2s, box-shadow 0.2s;\n}\n\n.llm-settings-field input:focus,\n.llm-settings-field select:focus,\n.llm-settings-field textarea:focus {\n  border-color: var(--jp-brand-color1);\n  box-shadow: 0 0 0 2px rgba(19, 124, 189, 0.2);\n}\n\n.llm-input-with-button {\n  display: flex;\n  gap: 8px;\n}\n\n.llm-api-key-input {\n  flex: 1;\n}\n\n.llm-toggle-visibility-btn {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 36px;\n  height: 36px;\n  border: 1px solid var(--jp-border-color1);\n  border-radius: 6px;\n  background-color: var(--jp-layout-color2);\n  color: var(--jp-ui-font-color1);\n  cursor: pointer;\n  transition: background-color 0.2s;\n}\n\n.llm-toggle-visibility-btn:hover {\n  background-color: var(--jp-layout-color3);\n}\n\n.llm-settings-field input[type=\"range\"] {\n  width: 100%;\n  height: 6px;\n  border-radius: 3px;\n  background: var(--jp-layout-color3);\n  outline: none;\n  -webkit-appearance: none;\n}\n\n.llm-settings-field input[type=\"range\"]::-webkit-slider-thumb {\n  -webkit-appearance: none;\n  width: 16px;\n  height: 16px;\n  border-radius: 50%;\n  background: var(--jp-brand-color1);\n  cursor: pointer;\n}\n\n.llm-settings-hint {\n  font-size: 11px;\n  color: var(--jp-ui-font-color2);\n  margin: 6px 0 0 0;\n}\n\n.llm-settings-hint code {\n  background-color: var(--jp-layout-color3);\n  padding: 2px 4px;\n  border-radius: 3px;\n  font-family: var(--jp-code-font-family);\n}\n\n.llm-settings-toggle label {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  cursor: pointer;\n  font-weight: 500;\n}\n\n.llm-settings-toggle input[type=\"checkbox\"] {\n  width: 16px;\n  height: 16px;\n  accent-color: var(--jp-brand-color1);\n  cursor: pointer;\n}\n\n.llm-api-key-status {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 10px 12px;\n  border-radius: 6px;\n  font-size: 13px;\n  margin-bottom: 8px;\n}\n\n.llm-status-ok {\n  background-color: var(--jp-success-color0);\n  color: var(--jp-ui-inverse-font-color0);\n}\n\n.llm-status-error {\n  background-color: var(--jp-error-color0);\n  color: var(--jp-ui-inverse-font-color0);\n}\n\n.llm-test-btn {\n  width: 100%;\n  padding: 10px 16px;\n  border: none;\n  border-radius: 6px;\n  background-color: var(--jp-brand-color1);\n  color: white;\n  font-size: 13px;\n  font-weight: 500;\n  cursor: pointer;\n  transition: background-color 0.2s;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n}\n\n.llm-test-btn:hover:not(:disabled) {\n  background-color: var(--jp-brand-color0);\n}\n\n.llm-test-btn:disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n}\n\n.llm-spinner {\n  width: 16px;\n  height: 16px;\n  border: 2px solid rgba(255, 255, 255, 0.3);\n  border-top-color: white;\n  border-radius: 50%;\n  animation: llm-spin 0.8s linear infinite;\n}\n\n@keyframes llm-spin {\n  to {\n    transform: rotate(360deg);\n  }\n}\n\n.llm-test-result {\n  margin-top: 12px;\n  padding: 10px 12px;\n  border-radius: 6px;\n  font-size: 13px;\n}\n\n.llm-test-success {\n  background-color: var(--jp-success-color0);\n  color: var(--jp-ui-inverse-font-color0);\n}\n\n.llm-test-error {\n  background-color: var(--jp-error-color0);\n  color: var(--jp-ui-inverse-font-color0);\n}\n\n.llm-settings-footer {\n  display: flex;\n  gap: 12px;\n  padding: 16px 0 0 0;\n  border-top: 1px solid var(--jp-border-color0);\n  margin-top: 24px;\n}\n\n.llm-cancel-btn,\n.llm-save-btn {\n  flex: 1;\n  padding: 10px 16px;\n  border: none;\n  border-radius: 6px;\n  font-size: 13px;\n  font-weight: 500;\n  cursor: pointer;\n  transition: background-color 0.2s;\n}\n\n.llm-cancel-btn {\n  background-color: var(--jp-layout-color2);\n  color: var(--jp-ui-font-color1);\n}\n\n.llm-cancel-btn:hover {\n  background-color: var(--jp-layout-color3);\n}\n\n.llm-save-btn {\n  background-color: var(--jp-brand-color1);\n  color: white;\n}\n\n.llm-save-btn:hover:not(:disabled) {\n  background-color: var(--jp-brand-color0);\n}\n\n.llm-save-btn:disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n}\n\n.llm-value {\n  font-weight: 600;\n  color: var(--jp-brand-color1);\n}\n\n/* ==============================================================================\n   Markdown Content\n   ============================================================================== */\n\n.llm-markdown-content {\n  line-height: 1.6;\n}\n\n.llm-markdown-content *:first-child {\n  margin-top: 0;\n}\n\n.llm-markdown-content *:last-child {\n  margin-bottom: 0;\n}\n\n.llm-md-paragraph {\n  margin: 8px 0;\n}\n\n.llm-md-link {\n  color: var(--jp-link-color);\n  text-decoration: none;\n}\n\n.llm-md-link:hover {\n  text-decoration: underline;\n}\n\n.llm-md-code-inline {\n  font-family: var(--jp-code-font-family);\n  font-size: 0.9em;\n  padding: 2px 6px;\n  background-color: var(--jp-layout-color3);\n  border-radius: 4px;\n  color: var(--jp-content-font-color1);\n}\n\n.llm-message-item.user .llm-md-code-inline {\n  background-color: rgba(255, 255, 255, 0.2);\n  color: inherit;\n}\n\n.llm-md-list {\n  margin: 8px 0;\n  padding-left: 24px;\n}\n\n.llm-md-list-ordered {\n  list-style-type: decimal;\n}\n\n.llm-md-list-item {\n  margin: 4px 0;\n}\n\n.llm-md-heading {\n  font-weight: 600;\n  margin: 16px 0 8px 0;\n  color: var(--jp-content-font-color0);\n}\n\n.llm-message-item.user .llm-md-heading {\n  color: inherit;\n}\n\n.llm-md-heading-1 {\n  font-size: 1.5em;\n  border-bottom: 1px solid var(--jp-border-color1);\n  padding-bottom: 8px;\n}\n\n.llm-md-heading-2 {\n  font-size: 1.3em;\n}\n\n.llm-md-heading-3 {\n  font-size: 1.1em;\n}\n\n.llm-md-heading-4,\n.llm-md-heading-5,\n.llm-md-heading-6 {\n  font-size: 1em;\n}\n\n.llm-md-blockquote {\n  margin: 8px 0;\n  padding: 8px 16px;\n  border-left: 4px solid var(--jp-brand-color1);\n  background-color: var(--jp-layout-color2);\n  color: var(--jp-ui-font-color2);\n}\n\n.llm-md-table-wrapper {\n  overflow-x: auto;\n  margin: 8px 0;\n}\n\n.llm-md-table {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 13px;\n}\n\n.llm-md-th,\n.llm-md-td {\n  padding: 8px 12px;\n  border: 1px solid var(--jp-border-color1);\n  text-align: left;\n}\n\n.llm-md-th {\n  background-color: var(--jp-layout-color2);\n  font-weight: 600;\n}\n\n/* ==============================================================================\n   Code Block\n   ============================================================================== */\n\n.llm-code-block {\n  margin: 12px 0;\n  border-radius: 8px;\n  overflow: hidden;\n  background-color: var(--jp-cell-editor-background);\n  border: 1px solid var(--jp-border-color1);\n}\n\n.llm-code-block-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 8px 12px;\n  background-color: var(--jp-layout-color2);\n  border-bottom: 1px solid var(--jp-border-color1);\n}\n\n.llm-code-language {\n  font-size: 11px;\n  font-weight: 500;\n  text-transform: uppercase;\n  color: var(--jp-ui-font-color2);\n}\n\n.llm-code-copy-btn {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  padding: 4px 8px;\n  border: none;\n  border-radius: 4px;\n  background-color: transparent;\n  color: var(--jp-ui-font-color2);\n  font-size: 11px;\n  cursor: pointer;\n  transition: background-color 0.2s, color 0.2s;\n}\n\n.llm-code-copy-btn:hover {\n  background-color: var(--jp-layout-color3);\n  color: var(--jp-ui-font-color0);\n}\n\n.llm-code-copy-btn.copied {\n  color: var(--jp-success-color1);\n}\n\n.llm-code-block pre {\n  margin: 0;\n  padding: 16px;\n  overflow-x: auto;\n  font-family: var(--jp-code-font-family);\n  font-size: 13px;\n  line-height: 1.5;\n}\n\n.llm-code-block code {\n  font-family: var(--jp-code-font-family);\n}\n\n/* ==============================================================================\n   Image in Message\n   ============================================================================== */\n\n.llm-message-image {\n  max-width: 100%;\n  max-height: 300px;\n  border-radius: 8px;\n  margin: 8px 0;\n}\n\n/* ==============================================================================\n   Scrollbar Styling\n   ============================================================================== */\n\n.llm-chat-panel ::-webkit-scrollbar {\n  width: 8px;\n  height: 8px;\n}\n\n.llm-chat-panel ::-webkit-scrollbar-track {\n  background: transparent;\n}\n\n.llm-chat-panel ::-webkit-scrollbar-thumb {\n  background: var(--jp-scrollbar-thumb-color);\n  border-radius: 4px;\n}\n\n.llm-chat-panel ::-webkit-scrollbar-thumb:hover {\n  background: var(--jp-scrollbar-thumb-hover-color);\n}\n\n/* ==============================================================================\n   Responsive Adjustments\n   ============================================================================== */\n\n@media (max-width: 400px) {\n  .llm-message-content {\n    max-width: calc(100% - 48px);\n  }\n\n  .llm-message-avatar {\n    width: 28px;\n    height: 28px;\n    font-size: 12px;\n  }\n\n  .llm-input-area {\n    padding: 8px 12px;\n  }\n}\n"],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ },

/***/ "./node_modules/css-loader/dist/cjs.js!./style/index.css"
/*!***************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./style/index.css ***!
  \***************************************************************/
(module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../node_modules/css-loader/dist/runtime/sourceMaps.js */ "./node_modules/css-loader/dist/runtime/sourceMaps.js");
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_chat_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! -!../node_modules/css-loader/dist/cjs.js!./chat.css */ "./node_modules/css-loader/dist/cjs.js!./style/chat.css");
// Imports



var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_chat_css__WEBPACK_IMPORTED_MODULE_2__["default"]);
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/**
 * JupyterLab LLM Assistant Extension Styles
 *
 * This file imports all component styles.
 */

/* Import base styles */

/* Variables */
:root {
  --llm-primary-color: #1976d2;
  --llm-primary-hover: #1565c0;
  --llm-bg-color: var(--jp-layout-color1);
  --llm-text-color: var(--jp-content-font-color1);
  --llm-border-color: var(--jp-border-color1);
  --llm-user-bg: #e3f2fd;
  --llm-assistant-bg: var(--jp-layout-color2);
  --llm-code-bg: var(--jp-layout-color3);
  --llm-success-color: #4caf50;
  --llm-error-color: #f44336;
  --llm-warning-color: #ff9800;
}

/* Dark theme adjustments */
body[data-jp-theme-light='false'] {
  --llm-user-bg: #1e3a5f;
}

/* Main panel container */
.llm-assistant-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--llm-bg-color);
  color: var(--llm-text-color);
}

.llm-assistant-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}`, "",{"version":3,"sources":["webpack://./style/index.css"],"names":[],"mappings":"AAAA;;;;EAIE;;AAEF,uBAAuB;;AAGvB,cAAc;AACd;EACE,4BAA4B;EAC5B,4BAA4B;EAC5B,uCAAuC;EACvC,+CAA+C;EAC/C,2CAA2C;EAC3C,sBAAsB;EACtB,2CAA2C;EAC3C,sCAAsC;EACtC,4BAA4B;EAC5B,0BAA0B;EAC1B,4BAA4B;AAC9B;;AAEA,2BAA2B;AAC3B;EACE,sBAAsB;AACxB;;AAEA,yBAAyB;AACzB;EACE,aAAa;EACb,sBAAsB;EACtB,YAAY;EACZ,qCAAqC;EACrC,4BAA4B;AAC9B;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,YAAY;AACd","sourcesContent":["/**\n * JupyterLab LLM Assistant Extension Styles\n *\n * This file imports all component styles.\n */\n\n/* Import base styles */\n@import './chat.css';\n\n/* Variables */\n:root {\n  --llm-primary-color: #1976d2;\n  --llm-primary-hover: #1565c0;\n  --llm-bg-color: var(--jp-layout-color1);\n  --llm-text-color: var(--jp-content-font-color1);\n  --llm-border-color: var(--jp-border-color1);\n  --llm-user-bg: #e3f2fd;\n  --llm-assistant-bg: var(--jp-layout-color2);\n  --llm-code-bg: var(--jp-layout-color3);\n  --llm-success-color: #4caf50;\n  --llm-error-color: #f44336;\n  --llm-warning-color: #ff9800;\n}\n\n/* Dark theme adjustments */\nbody[data-jp-theme-light='false'] {\n  --llm-user-bg: #1e3a5f;\n}\n\n/* Main panel container */\n.llm-assistant-panel {\n  display: flex;\n  flex-direction: column;\n  height: 100%;\n  background-color: var(--llm-bg-color);\n  color: var(--llm-text-color);\n}\n\n.llm-assistant-content {\n  display: flex;\n  flex-direction: column;\n  height: 100%;\n}"],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ },

/***/ "./style/index.css"
/*!*************************!*\
  !*** ./style/index.css ***!
  \*************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/styleDomAPI.js */ "./node_modules/style-loader/dist/runtime/styleDomAPI.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/insertBySelector.js */ "./node_modules/style-loader/dist/runtime/insertBySelector.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js */ "./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/insertStyleElement.js */ "./node_modules/style-loader/dist/runtime/insertStyleElement.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/styleTagTransform.js */ "./node_modules/style-loader/dist/runtime/styleTagTransform.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! !!../node_modules/css-loader/dist/cjs.js!./index.css */ "./node_modules/css-loader/dist/cjs.js!./style/index.css");

      
      
      
      
      
      
      
      
      

var options = {};

options.styleTagTransform = (_node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default());
options.setAttributes = (_node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default());

      options.insert = _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default().bind(null, "head");
    
options.domAPI = (_node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default());
options.insertStyleElement = (_node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default());

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()(_node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__["default"], options);




       /* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (_node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__["default"] && _node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__["default"].locals ? _node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__["default"].locals : undefined);


/***/ }

}]);
//# sourceMappingURL=style_index_css.bb721bd7741e47ab892b.js.map