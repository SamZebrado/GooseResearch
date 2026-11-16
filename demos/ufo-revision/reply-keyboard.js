/* One conventional keyboard shortcut, shared by the public demo forms. */
(function (host) {
  'use strict';
  function submitOnShortcut(event, submit) {
    if (event.defaultPrevented || event.key !== 'Enter' || !event.metaKey ||
        event.ctrlKey || event.altKey || event.shiftKey || event.isComposing || event.keyCode === 229) return false;
    event.preventDefault();
    if (!event.repeat) submit();
    return true;
  }
  const api = Object.freeze({ submitOnShortcut });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.GooseReplyKeyboard = api;
})(typeof window === 'object' ? window : globalThis);
