(function () {
  async function request(path, options) {
    const config = options || {};
    const method = config.method || 'GET';
    const headers = { ...(config.headers || {}) };
    const fetchOptions = {
      method,
      headers,
      signal: config.signal,
    };

    if (config.body !== undefined) {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
      fetchOptions.body = typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
    }

    const response = await fetch(path, fetchOptions);
    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.message || `Request failed (${response.status})`);
    }

    if (config.expectStatus !== false && data && Object.prototype.hasOwnProperty.call(data, 'status') && data.status !== 'success') {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  }

  function apiGet(path, options) {
    return request(path, { ...(options || {}), method: 'GET' });
  }

  function apiSend(path, options) {
    return request(path, options || {});
  }

  window.FoodSaveApi = { request, apiGet, apiSend };
})();
