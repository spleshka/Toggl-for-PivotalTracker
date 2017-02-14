chrome.storage.sync.get({ togglToken: '' }, function(storage) {

  if (!storage.togglToken) {
    // TODO: Show a help message.
    return;
  }

  // TODO: Make workspace configurable.
  var Toggl = TogglClient(storage.togglToken, { defaultWorkspace: 1783688 });
  Toggl.projects.getAll()
    .then(function (projects) {

      // TODO: Test case when there is no projects (is it possible?).

      // Get html select selector where list of Toggl projects is visible.
      var $togglProjects = $('form #toggl-projects');

      // Clean default 'Loading..' option from the list.
      $togglProjects.html('');

      // Added sorting of elements by name.
      projects.sort(function (a, b) {
        if (a.name > b.name) {
          return 1;
        }
        if (a.name < b.name) {
          return -1;
        }
        return 0;
      });

      // Add each Toggl project to the select element.
      Array.prototype.forEach.call(projects, function (project) {
        var $option = $('<option/>').val(project.id).text(project.name);
        $togglProjects.append($option);
      });

      setCurrentFormState();
    })
    .catch(function (status) {
      // TODO: Check if timetracking can be without Toggl project reference.
    });

});

chrome.runtime.onMessage.addListener(function(message) {

  console.log('POPUP got message.');
  console.log(message);

  switch(message.action) {

    case 'reloadPopup':
      setCurrentFormState();
      break;
  }

});

var setCurrentFormState = function() {

  // Get <select> with list of available Toggl projects.
  var $togglProjects = $('form #toggl-projects');

  // Get text.input with time tracking description.
  var $timeTrackingDescription = $('form #time-tracking-current');

  // Get 'Start' / 'Stop' button.
  var $button = $('form button');

  // Check if there's available active time tracking.
  var activeTimeTracking = timeTracking.getActive();
  if (activeTimeTracking) {
    console.log('there is active timetracking');

    // Pre-select active Toggl project in the select list and lock it.
    $togglProjects.find('option[value="' + activeTimeTracking.pid + '"]').attr('selected', 'selected');
    $togglProjects.attr('disabled', true);

    // Set input of form representing time tracking description
    // to the current value.
    $timeTrackingDescription.val(activeTimeTracking.description);
    $timeTrackingDescription.attr('disabled', true);

    // Bring button to the current state.
    $button.removeClass('start').addClass('stop');
    $button.text('Stop');
    $button.unbind('click').click(popupButton.stop);
  }
  else {
    console.log('there is NO active timetracking');

    // Remove default selection for Toggl projects and make it enabled again.
    $togglProjects.find('option[selected="selected"]').removeAttr('selected');
    $togglProjects.removeAttr('disabled');

    // Remove description from the text input field and make it enabled.
    $timeTrackingDescription.val('');
    $timeTrackingDescription.removeAttr('disabled');

    // Bring button to the current state.
    $button.removeClass('stop').addClass('start');
    $button.text('Start');
    $button.unbind('click').click(popupButton.start);
  }
};

/**
 * Describes 'Start' / 'Stop' button in the popup.
 */
var popupButton = {

  start: function() {
    var $form = $(this).parents('form');
    var timeTrackingLabel = $form.find('#time-tracking-current').val();
    var togglProjectID = $form.find('#toggl-projects').val();
    timeTracking.start(togglProjectID, timeTrackingLabel);
  },

  stop: function() {
    timeTracking.stop();
  }

};


