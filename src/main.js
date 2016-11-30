chrome.extension.sendMessage({}, function(response) {
  var readyStateCheckInterval = setInterval(function() {

    if (document.readyState === "complete") {
      clearInterval(readyStateCheckInterval);

      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(handleMutationEvents);
      });

      // Configuration of the observer.
      var config = {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true
      };

      // Add observer handler.
      observer.observe(document, config);

      /**
       * Handle each mutation.
       */
      var handleMutationEvents = function handleMutationEvents(mutation) {
        // TODO: Figure out which mutations could be ignored to improve performance.
        Array.prototype.forEach.call(mutation.addedNodes, processStories);
        processStories(mutation.target);
      };

      /**
       * Main entry point to loop through all stories and to process them.
       */
      var processStories = function processStories(node) {
        if (typeof node.querySelectorAll !== 'undefined') {

          // Select all visible stories.
          var stories = node.querySelectorAll('.story.item');
          if (!stories.length) {
            return;
          }

          // Loop through every story.
          Array.prototype.forEach.call(stories, function (story) {
            addTimeTrackingButton(story);
          });
        }
      };


      function addTimeTrackingButton(story) {

        var storyInfoBox = story.querySelector('.info_box .info');
        var togglAdded = story.querySelector('.row.toggl');

        // Filter out all not expanded stories or stories where timetracking
        // button was already added.
        if (!storyInfoBox || togglAdded) {
          return;
        }

        //theParent = document.getElementById("theParent");
        var togglRow = document.createElement('div');
        togglRow.className = 'row toggl';
        togglRow.innerHTML = '<em>Toggl timer</em>';

        // Get story ID from the story meta info.
        var storyID = story.getAttribute('data-id');

        // Get story label from the textfield.
        var storyLabel = story.querySelector('textarea.name').innerHTML;

        // Add a button to start time tracking.
        var trackButton = document.createElement('a');
        trackButton.setAttribute('href', '#');
        trackButton.setAttribute('data-story-id', storyID);
        trackButton.setAttribute('data-story-label', storyLabel);
        trackButton.setAttribute('data-state', 'unstarted');
        trackButton.className = 'button start';
        trackButton.innerHTML = 'Start';
        trackButton.addEventListener('click', trackButtonClick);
        togglRow.appendChild(trackButton);

        // Place the row with Toggl tracking button on top of the info box.
        storyInfoBox.insertBefore(togglRow, storyInfoBox.firstChild);
      }

      function trackButtonClick(event) {

        //wid: 1783688
        //pid: 26259673 SS-TempProject

        var Toggl = TogglClient('b992f1cfb9072d5f7bc355f8e31e788b', { defaultWorkspace: 1783688 });

        var trackButton = this;

        var state = this.getAttribute('data-state');
        if (state == 'unstarted') {
          var storyID = this.getAttribute('data-story-id');
          var storyLabel = this.getAttribute('data-story-label');
          console.log(storyID);
          console.log(storyLabel);

          Toggl.timers.start('#' + storyID + ' ' + storyLabel, 26259673).then(function(timer) {
            console.log(timer);
            console.log(timer.data.id);

            trackButton.innerHTML = 'Stop';
            trackButton.className = 'button stop';
            trackButton.setAttribute('data-timer-id', timer.data.id);
            trackButton.setAttribute('data-state', 'started');
          });
        }
        else {
          var timerID = this.getAttribute('data-timer-id');
          console.log(timerID);

          Toggl.timers.stop(timerID).then(function(){
            trackButton.innerHTML = 'Start';
            trackButton.className = 'button start';
            trackButton.setAttribute('data-state', 'unstarted');
            trackButton.setAttribute('data-timer-id', '');
          });


        }

      }

    }
  }, 10);
});
