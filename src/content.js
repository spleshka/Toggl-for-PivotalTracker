/**
 * Initial entry point for the content script.
 * Sends request to the background to initialize the current
 * page and project.
 */
chrome.runtime.sendMessage({ action: 'init' });

/**
 *
 */
chrome.runtime.onMessage.addListener(function(request) {

  console.log('content got message.');
  console.log(request);

  switch(request.action) {

    // If background successfully initialized the project then we can
    // carry on UI changes.
    case 'initialized':
      finalizeInitialization();
      break;

    case 'reloadButtons':
      reloadTogglButtons();
      break;
  }

});

/**
 * TODO.
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
  Array.prototype.forEach.call(mutation.addedNodes, handleAllStories);
  handleAllStories(mutation.target);
};

/**
 * Handle processing of all stories.
 */
var handleAllStories = function(node) {

  if (typeof node.querySelectorAll == 'undefined') {
    return;
  }

  // Select all visible stories.
  var stories = node.querySelectorAll('.story.item');
  if (!stories.length) {
    return;
  }

  Array.prototype.forEach.call(stories, function(story) {
    // TODO: Is there an option to improve performance to avoid querying of
    // selectors for each story?

    // Handle expanded story.
    if (story.querySelector('.info_box')) {
      handleExpandedStory(story);
    }
    // Handle collapsed story.
    else {
      handleCollapsedStory(story);
    }

  });
};

/**
 * Adds a time tracking button in the right state
 * to the expanded story.
 */
var handleExpandedStory = function(story) {
  /*console.log('expanded story');
  console.log(story);*/

  togglButton.render(story);
};

/**
 * Shows time spent on every collapsed story.
 */
var handleCollapsedStory = function(story) {
  /*console.log('collapsed story');
  console.log(story);*/
};

/**
 * Function which is being invoked after any change
 * in time tracking entities (usually it's starting or
 * stopping time tracking).
 */
var reloadTogglButtons = function() {
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



