var TogglClient = function (token, options) {
  var config = {
    clientName: 'Toggl Report Client',
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
    var query = options ? _encodeQueryData(options) : '';
    return config.baseUrl + config.apiVersion + '/' + action + query ? '?' + query : '';
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

    get: function (options) {
      var promise = _request(_buildUrl('detailed', options));
      return promise;
    }
  };

  _init(token, options);

  return {
    detailed: detailed
  };
};