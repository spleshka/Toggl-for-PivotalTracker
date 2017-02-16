/**
 * Initial entry point for the content script.
 * Sends request to the background to initialize the current
 * page and project.
 */
chrome.runtime.sendMessage({ action: 'init' });

/**
 * Listen for messages from backgrounds script or popup.
 */
chrome.runtime.onMessage.addListener(function(request) {

  console.log('content.js got message:');
  console.log(request);

  switch(request.action) {

    // If background successfully initialized the project then we can
    // carry on UI changes.
    case 'initialized':
      finalizeInitialization();
      break;

    // Gets feedback from the background script to reload Toggl Start/Stop
    // buttons.
    case 'reloadButtons':
      rebuildTogglButtons();
      break;

    // Gets feedback from the background script when list with story IDs
    // and logged time is ready.
    case 'displayTimeLoggedPerStory':
      displayTimeLoggedPerStory(request.timeLoggedPerStory);
      break;

    // Gets information about time logged in this month for the given
    // project.
    case 'displayTimeLoggedInProjectThisMonth':
      displayTimeLoggedInProjectThisMonth(request.timeLoggedInProjectThisMonth);
      break;
  }
});

/**
 * This method gets invoked when background script confirms that
 * currently opened project is mapped to Toggl.
 */
var finalizeInitialization = function() {
  console.log('PT project is mapped and can be initialized');

  var readyStateCheckInterval = setInterval(function () {

    // We check the state each 10ms until the DOM is completely ready.
    if (document.readyState != "complete") {
      return;
    }
    clearInterval(readyStateCheckInterval);

    console.log('Document is ready');

    // Create a new observer to track DOM changes.
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(handleMutationEvents);
    });

    // Add observer handler.
    observer.observe(document, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true
    });

  }, 10);
};

/**
 * Handle each mutation.
 */
var handleMutationEvents = function(mutation) {
  // TODO: Figure out which mutations could be ignored to improve performance.
  Array.prototype.forEach.call(mutation.addedNodes, processMutation);
  processMutation(mutation.target);
};

/**
 * Handle any change in the DOM.
 */
var processMutation = function(node) {

  if (typeof node.querySelectorAll == 'undefined') {
    return;
  }

  // Select all visible stories.
  var stories = node.querySelectorAll('.story.item');
  if (!stories.length) {
    return;
  }

  handleHeader(node);

  // Handle all expanded stories.
  handleExpandedStories(stories);

  // Handle all collapsed stories.
  handleCollapsedStories(stories);
};

/**
 * Processes all expanded stories in PT.
 *
 * @param stories
 *   Array of DOM selectors for stories
 */
var handleExpandedStories = function(stories) {

  // TODO: Is there an option to improve performance to avoid querying of
  // selectors for each story?
  Array.prototype.forEach.call(stories, function(story) {

    // Adds time tracking button in the right state to the expanded story.
    if (story.querySelector('.info_box')) {
      togglButton.render(story);
    }
  });
};

/**
 * Processes all collapsed stories in PT.
 * Shows time spent on every collapsed story.
 */
var handleCollapsedStories = function(stories) {

  // Array to gather list of visible PT Story IDs.
  var pivotalStoryIDs = [];

  Array.prototype.forEach.call(stories, function(story) {

    // Ignore expanded stories.
    if (story.querySelector('.info_box')) {
      return;
    }

    // At this point we deliberately ignore iceboxed stories.
    // TODO: include iceboxed stories?
    if (story.classList.contains('unscheduled')) {
      return;
    }

    // Prepare html for time logged per story only once.
    if (!story.querySelector('.toggl-time')) {

      // TODO: Debug why done stories load even though they
      // are not set to display.
      //console.log(story);

      // Create a new span element for display of Toggl time logged.
      var togglLogged = document.createElement('span');
      togglLogged.classList += 'toggl-time';

      // Set an attribute just because it's more performance to get story ID
      // from this selector in the future. See displayLoggedTimePerStory().
      var storyID = story.getAttribute('data-id');
      togglLogged.setAttribute('data-id', storyID);

      // Append our custom html to the story header section.
      var header = story.querySelector('header.preview');
      header.appendChild(togglLogged);

      // Add PT story ID to the array of visible stories.
      pivotalStoryIDs.push(storyID);
    }
  });

  // If there are no stories then we're done here.
  if (!pivotalStoryIDs.length) {
    return;
  }

  console.log('List of PT Story IDs:');
  console.log(pivotalStoryIDs);

  // Send request to the background script to fetch time for visible stories.
  chrome.runtime.sendMessage({
    action: 'fetchTimeLoggedPerStory',
    pivotalStoryIDs: pivotalStoryIDs
  });
};

/**
 * Adds monthly used hours to the PT header section.
 * @param dom
 *   DOM object.
 */
var handleHeader = function(dom) {

  // Get selector of PT project header.
  var header = dom.querySelector('header.tc_page_header');
  if (!header) {
    return;
  }

  // Don't send request to fetch time logged in this project this month more
  // than once.
  if (!header.querySelector('.toggl-month-hrs')) {

    // Prepare HTML element to make sure it appears only once on the page.
    var li = document.createElement('li');
    li.classList = 'toggl-month-hrs';
    header.querySelector('ul').appendChild(li);

    // Send request to the backend to fetch hrs spent this month.
    chrome.runtime.sendMessage({ action: 'fetchTimeLoggedInProjectThisMonth' });
  }
};

/**
 * Adds time spent within the project to the header section.
 *
 * @param timeLoggedInProjectThisMonth
 *   Amount of time (in milliseconds) logged against the project
 *   in the current month.
 */
var displayTimeLoggedInProjectThisMonth = function(timeLoggedInProjectThisMonth) {

  console.log('Amount of time logged in the project this month:');
  console.log(timeLoggedInProjectThisMonth);

  // Get selector of PT project header.
  var header = document.querySelector('header.tc_page_header');
  console.log(header);

  // Get human readable amount of hrs logged this month in the project.
  var hours = Math.floor(timeLoggedInProjectThisMonth / 1000 / 3600);

  // Add human readable title to the header of the page.
  header.querySelector('.toggl-month-hrs').innerText = 'This month logged: ' + hours + 'hrs';
};

/**
 * Shows how much time was logged against each PT story.
 * This function is being invoked as soon as message from
 * background script is received.
 * @see chrome.runtime.onMessage.addListener
 *
 * @param timeLoggedPerStory
 *   Array with PT Stories and logged time.
 *   - Array keys are PT Story IDs
 *   - Array values are logged time (in seconds).
 */
var displayTimeLoggedPerStory = function(timeLoggedPerStory) {

  // Get list of all story IDs to loop through each of those.
  var storyIDs = Object.keys(timeLoggedPerStory);

  // Show logged time per each story.
  Array.prototype.forEach.call(storyIDs, function(storyID) {

    // Find html container for display of toggl time spent at the story.
    var togglContainer = document.querySelector('.toggl-time[data-id="' + storyID + '"]');

    // If for any reason the container doesn't exist - then we're done here.
    if (!togglContainer) {
      return;
    }

    // Get amount of seconds from Toggl logged against the story.
    var seconds = timeLoggedPerStory[storyID];

    // Convert seconds into human readable minutes and hours.
    var hours = parseInt(seconds / 3600);
    var minutes = parseInt((seconds - hours * 3600) / 60);

    // Add human readable time to the html.
    togglContainer.innerHTML = hours ? hours + 'h ' + minutes + 'm' : minutes + 'm';
  });

  console.log('Time logged per stories: ');
  console.log(timeLoggedPerStory);
};

/**
 * Function which is being invoked after any change
 * in time tracking entities (usually it's starting or
 * stopping time tracking).
 */
var rebuildTogglButtons = function() {
  console.log('Got request to reload Toggl Buttons');

  var stories = document.querySelectorAll('.story.item');
  Array.prototype.forEach.call(stories, function(story) {

    // We reload Toggl buttons only for expanded stories.
    if (story.querySelector('.info_box')) {

      // Find a row in the info box of story with Toggl button.
      var togglRow = story.querySelector('.row.toggl');

      // Remove old Toggl button.
      var togglBtn = togglRow.querySelector('a');
      togglBtn.parentNode.removeChild(togglBtn);

      // Add a new Toggl button with a new state.
      togglButton.renderButton(story, togglRow);
    }
  });
};
