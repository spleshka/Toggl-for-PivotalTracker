var timeTracking = {

  /**
   * Processes request from one of the browser tabs or plugin popup
   * to start time tracking.
   */
  start: function(togglProjectID, label) {
    console.log('background got confirmation to start time tracking');

    console.log('Toggl Project ID is: ' + togglProjectID);
    console.log('Toggl Label is: ' + label);

    // Regular expression which helps to find tags in the description
    // string like "#12345 Story description".
    var regExp = new RegExp('[.+]?\#([0-9a-zA-Z\-]+)[.+]?', 'g');
    var matches = regExp.exec(label);
    console.log('regexp matches:');
    console.log(matches);

    // Define tags array based on found PT story ID.
    var tags = [];
    var storyID = 0;
    if (matches) {

      // Everything marked with # in the description is considered as a tag.
      tags.push(matches[1]);

      // If the current match is a number then we assume it's a story ID.
      if (!isNaN(matches[1])) {
        storyID = matches[1];
      }
    }

    chrome.storage.sync.get({ togglToken: '' }, function(storage) {

      if (!storage.togglToken) {
        return;
      }

      // TODO: Make workspace configurable.
      var toggl = TogglClient(storage.togglToken, { defaultWorkspace: 1783688 });
      toggl.timers.start(label, togglProjectID, tags)
        .then(function (timer) {

          // Update info about active time tracking entry and active PT story.
          timeTracking.setActive(timer.data, storyID);

          // Sends message to all tabs to bring Toggl buttons to the new state.
          timeTracking.reloadTogglButtons();
        });

    });
  },

  /**
   * Processes request from one of the browser tabs
   * to stop time tracking.
   */
  stop: function() {
    console.log('background got confirmation to stop time tracking');
    chrome.storage.sync.get({ togglToken: '' }, function(storage) {

      if (!storage.togglToken) {
        return;
      }

      var activeTimeTracking = timeTracking.getActive();
      activeTimeTracking = activeTimeTracking || {};
      activeTimeTracking.id = activeTimeTracking.id || 0;

      // TODO: Make workspace configurable.
      var toggl = TogglClient(storage.togglToken, { defaultWorkspace: 1783688 });
      toggl.timers.stop(activeTimeTracking.id)
        .then(function () {

          // Delete info about active time tracking entry and active PT story.
          timeTracking.removeActive();

          // Sends message to all tabs to bring Toggl buttons to the new state.
          timeTracking.reloadTogglButtons();
        })
        // If could not stop time tracking by any reason - just reload the
        // Toggl buttons to bring them to the latest state.
        .catch(function() {
          timeTracking.reloadTogglButtons();
        });

    });
  },

  /**
   * Updates info about active time tracking entry and active PT story.
   */
  setActive: function(timeTracking, storyID) {
    storyID = storyID || 0;

    // Set extension icon to display active time tracking.
    var iconURL = chrome.extension.getURL('src/icons/active48.png');
    chrome.browserAction.setIcon({ path: iconURL });

    localStorage.setItem('activeTimeTracking', JSON.stringify(timeTracking));
    localStorage.setItem('activeStoryID', storyID);
  },

  /**
   * Fetches object with currently active time tracking.
   */
  getActive: function() {
    var timeTracking = localStorage.getItem('activeTimeTracking');
    return timeTracking ? JSON.parse(timeTracking) : null;
  },

  /**
   * Deletes info about active time tracking entry and active PT story.
   */
  removeActive: function() {

    // Set extension icon to show that there's no active time tracking.
    var iconURL = chrome.extension.getURL('src/icons/icon48.png');
    chrome.browserAction.setIcon({ path: iconURL });

    localStorage.removeItem('activeTimeTracking');
    localStorage.removeItem('activeStoryID');
  },

  /**
   * Returns ID of PT story where the time is currently being logged.
   */
  getActiveStory: function() {

    console.log('Request to fetch active story. Here is local storage:');
    console.log(localStorage);

    return localStorage.getItem('activeStoryID');
  },

  /**
   * A function that sends message to all tabs with opened PT
   * and to the popup to refresh states of visible Toggl buttons.
   */
  reloadTogglButtons: function() {

    // Send message to tabs where PT is opened.
    chrome.tabs.query({ url: '*://www.pivotaltracker.com/*' }, function (tabs) {
      Array.prototype.forEach.call(tabs, function (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'reloadButtons' });
      });
    });

    // Send message to popup to update its state.
    chrome.runtime.sendMessage({ action: 'reloadPopup' }, function(response) {
      console.log(response);
    });
  }

};
