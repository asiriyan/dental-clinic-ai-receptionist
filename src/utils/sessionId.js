let currentSessionId = null;

export function getSessionId() {
  if (!currentSessionId) {
    if (typeof window !== 'undefined' && window.localStorage) {
      currentSessionId = localStorage.getItem('denttora_session_id');
    }
    if (!currentSessionId) {
      currentSessionId = `web-${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('denttora_session_id', currentSessionId);
      }
    }
  }
  return currentSessionId;
}

export function resetSessionId() {
  currentSessionId = `web-${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('denttora_session_id', currentSessionId);
  }
  return currentSessionId;
}
