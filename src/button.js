var togglButton = {

  render: function(story) {

    // Don't add toggle button twice.
    if (story.querySelector('.row.toggl')) {
      return;
    }

    // Create a new row in the story info box with toggle label.
    var togglRow = document.createElement('div');
    togglRow.className = 'row toggl';
    togglRow.innerHTML = '<em>Toggl timer</em>';

    // Place the row on top of the info box.
    var storyInfoBox = story.querySelector('.info_box .info');
    storyInfoBox.insertBefore(togglRow, storyInfoBox.firstChild);

    this.renderButton(story, togglRow);
  },

  renderButton: function(story, togglRow) {

    // In order to render button state properly (started or stopped) we
    // need to request background script who has all info about active
    // time tracking.
    chrome.runtime.sendMessage({ action: 'getActiveStory' }, function(response) {

      console.log('Toggl button got info about active story. Response is:');
      console.log(response);

      // Get story ID from the story meta info.
      // TODO: doesn't work for single story pages.
      var storyID = togglButton.fetchStoryID(story);
      console.log('opened story id is:');
      console.log(storyID);

      // Get story label from the textfield.
      var storyLabel = story.querySelector('textarea.name').innerHTML;

      var trackButton = document.createElement('a');
      trackButton.setAttribute('href', '#');
      trackButton.setAttribute('data-story-id', storyID);
      trackButton.setAttribute('data-story-label', storyLabel);

      if (response.activeStoryID == storyID) {
        trackButton.addEventListener('click', togglButton.stop);
        trackButton.className = 'button stop';
        trackButton.innerHTML = 'Stop';
      }
      else {
        trackButton.addEventListener('click', togglButton.start);
        trackButton.className = 'button start';
        trackButton.innerHTML = 'Start';
      }

      togglRow.appendChild(trackButton);
    });


  },

  start: function() {

    console.log('Registered click to start time tracking');

    var trackButton = this;
    var storyID = trackButton.getAttribute('data-story-id');
    var storyLabel = trackButton.getAttribute('data-story-label');

    chrome.runtime.sendMessage({
      action: 'startTimeTracking',
      storyID: storyID,
      storyLabel: storyLabel
    });
  },

  stop: function() {
    console.log('Registered click to stop time tracking');

    chrome.runtime.sendMessage({ action: 'stopTimeTracking' });
  },

  /**
   * Fetches PT story ID from story DOM.
   *
   * @param story Node
   *   DOM root element of PT story.
   */
  fetchStoryID: function(story) {

    // Fetch story ID from clipboard action button to copy it.
    // If someone has better idea where to fetch it - you're welcome.
    var clipboardButton = story.querySelector('.clipboard_button.use_click_to_copy');
    var clipboardText = clipboardButton.getAttribute('data-clipboard-text');

    // Clipboard text looks like #123456, so we have to remove the first
    // char to get the pure story ID.
    return parseInt(clipboardText.substr(1));
  }

};
