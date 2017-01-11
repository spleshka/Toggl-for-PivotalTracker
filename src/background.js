/**
 * Listens for all messages from browser tabs.
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

  console.log('--- background got a new request to handle');
  console.log(request);

  // Get info about PT project from the URL.
  const regex = /\/n\/projects\/(\d+)/;
  var regExp = regex.exec(sender.url);
  var pivotalProjectID = parseInt(regExp[1]);
  console.log('PT project ID is: ' + pivotalProjectID);

  switch (request.action) {

    case 'init':
      init(pivotalProjectID, sender.tab);
      break;

    case 'startTimeTracking':
      startTimeTracking(pivotalProjectID, request.storyID, request.storyLabel);
      break;

    case 'stopTimeTracking':
      stopTimeTracking();
      break;

    case 'getActiveStory':
      sendResponse({ activeStoryID: getActiveStory() });
      break;
  }

  console.log('--- background finished request');
});

/**
 * Periodically check active time tracking.
 */
setInterval(function() {

  chrome.storage.sync.get({ togglToken: '' }, function(storage) {

    if (!storage.togglToken) {
      return;
    }

    // TODO: Make workspace configurable.
    var toggl = TogglClient(storage.togglToken, {defaultWorkspace: 1783688});
    toggl.timers.current().then(function (response) {

      // Flag to indicate if Toggl buttons in the UI have to be rebuilt.
      var buttonsNeedUpdating = false;

      // Save time tracking object for better code readabiility.
      var currentTimeTracking = response.data;

      // If there's no active timetracking but it's active in extension,
      // then we need to bring all states & buttons up to date.
      // Usually it means that somebody stopped time tracking externally.
      if (!currentTimeTracking && 'activeTimeTrackingID' in localStorage) {
        delete localStorage['activeTimeTrackingID'];
        delete localStorage['activeStoryID'];
        buttonsNeedUpdating = true;
        console.log('There is no active time tracking, but bg thinks there is. Rebuilding buttons.');
      }
      // Process the case when Toggl returned info about active time tracking.
      else if (currentTimeTracking) {

        // If background script doesn't know about active time tracking in the
        // Toggl - we have to update buttons states across the board.
        if (!('activeTimeTrackingID' in localStorage)) {
          buttonsNeedUpdating = true;
          console.log('There\'s active time tracking in Toggl but bg thinks there is no timetrackings. Rebuilding buttons.');
        }
        // If background script doesn't know that the current time tracking
        // had been changed - we need to update buttons states.
        else if (localStorage['activeTimeTrackingID'] != currentTimeTracking.id) {
          buttonsNeedUpdating = true;
          console.log('There\'s active time tracking in Toggl but bg has different timetracking id. Rebuilding buttons.');
        }

        // Safe information about active time tracking.
        localStorage['activeTimeTrackingID'] = parseInt(currentTimeTracking.id);
        if (typeof currentTimeTracking.tags != 'undefined') {
          // TODO: a bit fragile. Probably, to add processing of all tags and
          // add support of story ids like #1234 from the description.
          localStorage['activeStoryID'] = parseInt(currentTimeTracking.tags[0]);
        }
      }

      // Sends message to all tabs to bring Toggl buttons to the new state.
      if (buttonsNeedUpdating) {
        reloadTogglButtons();
      }
    });

  });

}, 5000); // TODO: Too often?

/**
 * Performs initial validation of tab's url to make
 * sure that the current PT project is mapped to Toggl project.
 */
var init = function(pivotalProjectID, tab) {

  // Load list of mapped projects between Toggl and Pivotal from settings.
  chrome.storage.sync.get({ mappedProjects: [] }, function(storage) {

    // If there are no mapped projects then we should not proceed any further.
    if (!storage.mappedProjects.length) {
      return;
    }

    console.log('storage');
    console.log(storage);

    storage.mappedProjects.forEach(function(mappedProject) {
      if (mappedProject.pivotal.id == pivotalProjectID) {

        // Store projects mapping in the local storage.
        localStorage[pivotalProjectID] = mappedProject.toggl.id;

        // Send message to the browser tab saying that the current project
        // is mapped to Toggl project and can be initialized.
        chrome.tabs.sendMessage(tab.id, { action: "initialized" });
      }
    });

  });
};

/**
 *
 * @returns {*}
 */
var getActiveStory = function() {

  console.log('request to fetch active story. Here is local storage:');
  console.log(localStorage);


  if (typeof localStorage['activeStoryID'] != 'undefined') {
    return localStorage['activeStoryID'];
  }

  return false;
};

/**
 * Processes request from one of the browser tabs
 * to start time tracking.
 */
var startTimeTracking = function(projectID, storyID, storyLabel) {
  console.log('background got confirmation to start time tracking');
  var tags = [storyID];

  console.log('PT Project ID is: ' + projectID);
  console.log('Toggl Project ID is: ' + localStorage[projectID]);
  console.log('PT Story ID is: ' + storyID);
  console.log('PT Story Label is: ' + storyLabel);


  chrome.storage.sync.get({ togglToken: '' }, function(storage) {

    if (!storage.togglToken) {
      return;
    }

    // TODO: Make workspace configurable.
    var toggl = TogglClient(storage.togglToken, {defaultWorkspace: 1783688});
    toggl.timers.start('#' + storyID + ' ' + storyLabel, localStorage[projectID], tags).then(function (timer) {

      // Update info about active time tracking entry and active PT story.
      localStorage['activeTimeTrackingID'] = timer.data.id;
      localStorage['activeStoryID'] = storyID;

      // Sends message to all tabs to bring Toggl buttons to the new state.
      reloadTogglButtons();
    });

  });
};

/**
 * Processes request from one of the browser tabs
 * to stop time tracking.
 */
var stopTimeTracking = function() {
  console.log('background got confirmation to stop time tracking');
  chrome.storage.sync.get({ togglToken: '' }, function(storage) {

    if (!storage.togglToken) {
      return;
    }

    // TODO: Make workspace configurable.
    var toggl = TogglClient(storage.togglToken, {defaultWorkspace: 1783688});
    toggl.timers.stop(localStorage['activeTimeTrackingID']).then(function () {

      // Delete info about active time tracking entry and active PT story.
      delete localStorage['activeTimeTrackingID'];
      delete localStorage['activeStoryID'];

      // Sends message to all tabs to bring Toggl buttons to the new state.
      reloadTogglButtons();
    });

    // Todo: implement case when timetracking was stopped externally.

  });
};

/**
 * A function that sends message to all tabs to refresh states of
 * all visible Toggl buttons.
 */
var reloadTogglButtons = function() {
  chrome.tabs.query({url: '*://www.pivotaltracker.com/*'}, function (tabs) {
    Array.prototype.forEach.call(tabs, function (tab) {
      chrome.tabs.sendMessage(tab.id, {action: 'reloadButtons'});
    });
  });
};