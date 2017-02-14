var TogglReport = function (token, options) {

  var config = {
    clientName: 'Toggl for PivotalTracker Chrome extension',
    baseUrl: 'https://toggl.com/reports/api/',
    apiVersion: 'v2'
  };

  var _init = function (token, options) {
    if (!token) {
      throw new Error('You must provide your API token to use the Toggl API');
    }
    config.auth = 'Basic ' + btoa(token + ':api_token');

    if (options && options.defaultWorkspace) {
      config.defaultWorkspace = options.defaultWorkspace;
    }
  };

  var _buildUrl = function (action, options) {

    if (!options) {
      options = [];
    }

    options['user_agent'] = config.clientName;
    options['workspace_id'] = config.defaultWorkspace;

    var query = options ? _encodeQueryData(options) : '';
    return config.baseUrl + config.apiVersion + '/' + action + (query ? '?' + query : '');
  };

  var _encodeQueryData = function (data) {
    var ret = [];
    for (var d in data)
      ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(data[d]));
    return ret.join('&');
  };

  var _request = function (url, verb, postdata) {
    var headers = {
      'Authorization': config.auth
    };
    if (typeof verb === 'undefined' && typeof postdata === 'undefined') {
      verb = 'GET';
    } else if (typeof verb === 'undefined' && typeof postdata !== 'undefined') {
      verb = 'POST';
    }

    var deferred = $.Deferred();
    $.ajax({
      url: url,
      type: verb,
      headers: headers,
      data: postdata,
      dataType: 'json',
      contentType: 'application/json',
      success: function (data) {
        deferred.resolve(data);
      },
      error: function (error) {
        deferred.reject(error);
      }
    });
    return deferred.promise();
  };


  var detailed = {

    /**
     * @see https://github.com/toggl/toggl_api_docs/blob/master/reports/detailed.md
     * @param options
     */
    get: function (options) {
      var url = _buildUrl('details', options);
      console.log('Request URL: ' + url);
      var promise = _request(url);
      return promise;
    }
  };

  _init(token, options);

  return {
    detailed: detailed
  };
};
