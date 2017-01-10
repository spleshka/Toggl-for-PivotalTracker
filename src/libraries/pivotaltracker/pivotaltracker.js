var PivotalClient = function (token, options) {

  var config = {
    baseUrl: 'https://www.pivotaltracker.com/services/',
    apiVersion: 'v5'
  };

  var _buildUrl = function (collection, object, action) {
    return config.baseUrl + config.apiVersion + '/' + collection + ((typeof action !== 'undefined' && typeof object !== 'undefined') ? '/' + object + '/' + action : (typeof action === 'undefined' && typeof object !== 'undefined') ? '/' + object : (typeof object === 'undefined' && typeof action !== 'undefined') ? '/' + action : '');
  };

  var _request = function (url, verb, postdata) {
    var headers = {
      'X-TrackerToken': config.auth
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

  var _init = function (token, options) {
    if (!token) {
      throw new Error('You must provide your API token to use the Pivotal Tracker API');
    }
    config.auth = token;
  };

  var client = {
    allProjects: function () {
      return _request(_buildUrl('projects'));
    }
  };


  _init(token, options);

  return {
    client: client
  };

};