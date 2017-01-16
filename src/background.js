/**
 * Listens for all messages from browser tabs.
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

  console.log('--- background got a new request to handle');
  console.log(request);
  var pivotalProjectID;

  switch (request.action) {

    case 'init':
      pivotalProjectID = getPivotalProjectID(sender);
      init(pivotalProjectID, sender.tab);
      break;

    case 'startTimeTracking':
      pivotalProjectID = getPivotalProjectID(sender);
      var togglProjectID = localStorage[pivotalProjectID];
      var label = '#' + request.storyID + ' ' + request.storyLabel;
      timeTracking.start(togglProjectID, label);
      break;

    case 'stopTimeTracking':
      timeTracking.stop();
      break;

    case 'getActiveStory':
      sendResponse({ activeStoryID: timeTracking.getActiveStory() });
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
    var toggl = TogglClient(storage.togglToken, { defaultWorkspace: 1783688 });
    toggl.timers.current().then(function (response) {

      // Flag to indicate if Toggl buttons in the UI have to be rebuilt.
      var buttonsNeedUpdating = false;

      // Save time tracking object for better code readability.
      var togglTimeTracking = response.data;
      /*console.log('Time tracking from Toggl:');
       console.log(togglTimeTracking);*/

      var activeTimeTracking = timeTracking.getActive();
      /*console.log('Time tracking from local storage:');
       console.log(activeTimeTracking);*/

      // If there's no active time tracking but it's active in the extension,
      // then we need to bring all states & buttons up to date.
      // Usually it means that somebody stopped time tracking externally.
      if (!togglTimeTracking && activeTimeTracking) {
        timeTracking.removeActive();
        buttonsNeedUpdating = true;
        console.log('There is no active time tracking, but bg thinks there is. Rebuilding buttons.');
      }
      // Process the case when Toggl returned info about active time tracking.
      else if (togglTimeTracking) {

        // If background script doesn't know about active time tracking in the
        // Toggl - we have to update buttons states across the board.
        if (!activeTimeTracking) {
          buttonsNeedUpdating = true;
          console.log('There\'s active time tracking in Toggl but bg thinks there is no timetrackings. Rebuilding buttons.');
        }
        // If background script doesn't know that the current time tracking
        // had been changed - we need to update buttons states.
        else if (activeTimeTracking.id != togglTimeTracking.id) {
          buttonsNeedUpdating = true;
          console.log('There\'s active time tracking in Toggl but bg has different timetracking id. Rebuilding buttons.');
        }

        // Save information about active time tracking.
        var storyID = 0;
        if (typeof togglTimeTracking.tags != 'undefined') {
          // TODO: a bit fragile. Probably, to add processing of all tags and
          // add support of story ids like #1234 from the description.
          storyID = parseInt(togglTimeTracking.tags[0]);
        }

        timeTracking.setActive(togglTimeTracking, storyID);
      }

      // Sends message to all tabs to bring Toggl buttons to the new state.
      if (buttonsNeedUpdating) {
        timeTracking.reloadTogglButtons();
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

    console.log('mapped projects:');
    console.log(storage.mappedProjects);

    storage.mappedProjects.forEach(function(mappedProject) {
      if (mappedProject.pivotal.id == pivotalProjectID) {

        // Store projects mapping in the local storage.
        localStorage.setItem(pivotalProjectID, mappedProject.toggl.id);

        // Send message to the browser tab saying that the current project
        // is mapped to Toggl project and can be initialized.
        chrome.tabs.sendMessage(tab.id, { action: "initialized" });
      }
    });

  });
};

/**
 * Get PT project ID from browser tab's URL.
 *
 * @param sender
 *   Browser tab who sent request.
 */
var getPivotalProjectID = function(sender) {
  const regex = /\/n\/projects\/(\d+)/;
  var regExp = regex.exec(sender.url);
  var pivotalProjectID = parseInt(regExp[1]);
  console.log('PT project ID is: ' + pivotalProjectID);
  return pivotalProjectID;
};
