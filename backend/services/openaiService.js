// Compatibility facade kept so existing prediction services and tests retain their
// import path. The implementation is provider-neutral in llmProviderService.js;
// Gemini is the default selected by backend/config.js.
module.exports = require('./llmProviderService');
