/**
 * Listens for all messages from browser tabs.
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

  console.log('--- background got a new request to handle');
  console.log(request);

  var pivotalProjectID;
  var togglProjectID;

  switch (request.action) {

    case 'init':

      // Get PT Project ID from URL of sender tab.
      pivotalProjectID = getPivotalProjectID(sender);

      // Run initialization
      initialize(pivotalProjectID, sender.tab);
      break;

    case 'startTimeTracking':

      var label;
      // If request comes with toggle project ID property it means that
      // the request was sent from popup.
      if (request.hasOwnProperty('toggleProjectID')) {
        togglProjectID = request.toggleProjectID;
        label = request.hasOwnProperty('label') ? request.label : '';
      }
      // Handle request from PT page.
      else {
        pivotalProjectID = getPivotalProjectID(sender);
        togglProjectID = localStorage.getItem(pivotalProjectID);
        label = '#' + request.storyID + ' ' + request.storyLabel;
      }

      timeTracking.start(togglProjectID, label);
      break;

    case 'stopTimeTracking':
      timeTracking.stop();
      break;

    case 'fetchTimeLoggedPerStory':
      fetchTimeLoggedPerStory(request.pivotalStoryIDs, sender.tab);
      break;

    case 'fetchTimeLoggedInProjectThisMonth':
      pivotalProjectID = getPivotalProjectID(sender);
      togglProjectID = localStorage.getItem(pivotalProjectID);
      fetchTimeLoggedInProjectThisMonth(togglProjectID, pivotalProjectID, sender.tab);
      break;

    case 'getActiveStory':
      sendResponse({ activeStoryID: timeTracking.getActiveStory() });
      break;
  }

  console.log('--- background finished request');
});

/**
 * Periodically check active time tracking.
 * TODO: Consider using websocket:
 * https://github.com/toggl/toggl_api_docs/issues/47#issuecomment-23381732
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

      var activeTimeTracking = timeTracking.getActive();

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
var initialize = function(pivotalProjectID, tab) {

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
 * Get & Update information regarding time spent in the project
 * within the current month.
 *
 * @param togglProjectID
 *   Mapped project ID in Toggl.
 *
 * @param pivotalProjectID
 *   PT project ID.
 *
 * @param tab
 *    Sender tab.
 */
var fetchTimeLoggedInProjectThisMonth = function(togglProjectID, pivotalProjectID, tab) {
  chrome.storage.sync.get({ togglToken: '' }, function (storage) {

    if (!storage.togglToken) {
      return;
    }

    // Calculate date of the first day of the current month.
    var date = new Date();
    var currentYear = date.getFullYear();
    var currentMonth = ("0" + (date.getMonth() + 1)).slice(-2);
    var startDate = currentYear + '-' + currentMonth + '-01';

    // Get all time entries for the project since the start of this month.
    var TogglRep = TogglReport(storage.togglToken, { defaultWorkspace: 1783688 });
    TogglRep.detailed.get({ project_ids: togglProjectID, since: startDate })
      .then(function (response) {

        // Send message back to the tabs to show the latest amount of hrs spent
        // in the project this month.
        chrome.tabs.sendMessage(tab.id, {
          action: 'displayTimeLoggedInProjectThisMonth',
          timeLoggedInProjectThisMonth: response.total_grand
        });
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

/**
 *
 * Fetches time tracking entries for the given stories.
 *
 * @param pivotalStoryIDs
 *   List of PT Stories to fetch time entries for.
 *
 * @param tab
 *   Chrome tab object which requested the backgrounds script.
 */
var fetchTimeLoggedPerStory = function (pivotalStoryIDs, tab) {

  chrome.storage.sync.get({ togglToken: ''}, function (storage) {

    if (!storage.togglToken) {
      return;
    }

    // TODO: potentially tags fetch can be cached.
    var Toggl = TogglClient(storage.togglToken, {defaultWorkspace: 1783688});
    Toggl.workspaces.tags(1783688).
    then(function(tags) {

      // Create lookup array for easy search of Toggl tag ID
      // by tag name (which equals to Story ID in PT).
      var tagsLookup = {};
      Array.prototype.forEach.call(tags, function (tag) {
        tagsLookup[tag.name] = tag.id;
      });

      // Collect ID of Toggl tags which match PT story IDs.
      var tagsList = [];
      Array.prototype.forEach.call(pivotalStoryIDs, function (storyID) {
        if (tagsLookup.hasOwnProperty(storyID)) {
          tagsList.push(tagsLookup[storyID]);
        }
      });

      if (tagsList.length) {

        console.log('Tags list:');
        console.log(tagsList);

        fetchTimeEntriesByTags(tab, tagsList, storage.togglToken);
      }
    });

  });
};

/**
 * Fetches time entries from Toggl by tag IDs.
 * TODO: Cache results for 1h.
 *
 * @param tab
 * @param tagsList
 * @param togglToken
 * @param page
 * @param timeEntries
 */
var fetchTimeEntriesByTags = function (tab, tagsList, togglToken, page, timeEntries) {

  // Toggl returns result paged by 50 entries, starting with page 1.
  page = page ? page : 1;

  // Prepare variable for list of all time entries fetched from Toggl.
  timeEntries = timeEntries ? timeEntries : [];

  // TODO: add support of time tracking older than 1 year.
  // Prepare YYYY-DD-MM date of the current year-1.
  // Toggl reports api documentation says that max date span (until - since)
  // is one year.
  // See https://github.com/toggl/toggl_api_docs/blob/master/reports.md#request-parameters
  var date = new Date();
  var lastYear = date.getFullYear() - 1;
  var currentMonth = ("0" + (date.getMonth() + 1)).slice(-2);
  var currentDay = ("0" + (date.getDate() + 1)).slice(-2);
  var startDate = lastYear + '-' + currentMonth + '-' + currentDay;

  // Make as much requests to Toggl as needed to fetch all time tracking entries
  // for the given tags.
  var TogglRep = TogglReport(togglToken, { defaultWorkspace: 1783688 });
  TogglRep.detailed.get({ since: startDate, tag_ids: tagsList.join(','), page: page })
    .then(function (response) {

      // Add fetched time entries from this request to the global array with
      // the list of all time tracking entities.
      Array.prototype.forEach.call(response.data, function(timeEntry) {
        timeEntries.push(timeEntry);
      });

      // Calculate amount of pages in the response based on total amount of
      // time entries in the Report API query.
      var totalPages = Math.ceil(response.total_count / 50);

      // Keep requesting to Toggl until all time entries are fetched.
      if (page < totalPages) {
        fetchTimeEntriesByTags(tab, tagsList, togglToken, page + 1, timeEntries);
      }
      else {
        // Calculate time entries per story ID:
        var timeLoggedPerStory = {};
        Array.prototype.forEach.call(timeEntries, function(timeEntry) {

          // Get story ID from time entry of Toggl. It's stored there as
          // a tag name. Just search for the first numeric tag and it will
          // be our storyID.
          var storyID;
          Array.prototype.forEach.call(timeEntry.tags, function(tag) {
            if (!isNaN(tag) && !storyID) {
              storyID = tag;
            }
          });

          // Make sure we found numeric story ID in the tags of time entry.
          if (storyID) {

            // Initialize a new key of story ID just for better dev experience.
            if (!timeLoggedPerStory.hasOwnProperty(storyID)) {
              timeLoggedPerStory[storyID] = 0;
            }

            // Convert milliseconds to seconds.
            timeLoggedPerStory[storyID] += Math.round(timeEntry.dur / 1000);
          }
        });

        // Send message to the browser tab saying that the current project
        // is mapped to Toggl project and can be initialized.
        chrome.tabs.sendMessage(tab.id, {
          action: 'displayTimeLoggedPerStory',
          timeLoggedPerStory: timeLoggedPerStory
        });
      }

    });
};
