document.addEventListener('DOMContentLoaded', restore_toggl_options);
document.addEventListener('DOMContentLoaded', restore_pivotal_options);
document.addEventListener('DOMContentLoaded', restore_projects_map_options);

document.getElementById('save').addEventListener('click', save_options);
document.getElementById('add-map').addEventListener('click', add_projects_map);

function restore_toggl_options() {

  chrome.storage.sync.get({ togglToken: '', mappedProjects: []}, function (storage) {

    if (!storage.togglToken) {
      return;
    }

    $('#projects_map').addClass('toggl');

    document.getElementById('toggl_token').value = storage.togglToken;

    var usedTogglProjects = [];
    if (storage.mappedProjects.length > 0) {
      for (i in storage.mappedProjects) {
        var mappedProject = storage.mappedProjects[i];
        usedTogglProjects.push(mappedProject.toggl.id);
      }
    }

    var Toggl = TogglClient(storage.togglToken, {defaultWorkspace: 1783688});

    /*Toggl.workspaces.tags(1783688).
     then(function(response) {
     console.log(response);
     });*/


    Toggl.projects.getAll()
      .then(function (projects) {

        var projectsSelect = document.getElementById('toggl-projects');
        projectsSelect.innerHTML = '';

        // Sort Toggl projects by name ASC.
        projects.sort(sortByName);

        projects.forEach(function (project) {
          if ($.inArray(project.id, usedTogglProjects) == -1) {
            var projectOption = document.createElement('option');
            projectOption.setAttribute('value', project.id);
            projectOption.innerHTML = project.name;

            projectsSelect.appendChild(projectOption);
          }
        });
      })
      .catch(function (status) {
        var projectsSelect = document.getElementById('toggl-projects');
        projectsSelect.innerHTML = '';
      });

  });
}

function restore_pivotal_options () {
  chrome.storage.sync.get({
    pivotalToken: '',
    mappedProjects: []
  }, function (storage) {

    if (!storage.pivotalToken) {
      return;
    }

    $('#projects_map').addClass('pivotal');

    document.getElementById('pt_token').value = storage.pivotalToken;

    var usedPivotalProjects = [];
    if (storage.mappedProjects.length > 0) {
      for (i in storage.mappedProjects) {
        var mappedProject = storage.mappedProjects[i];
        usedPivotalProjects.push(mappedProject.pivotal.id);
      }
    }

    var Pivotal = PivotalClient(storage.pivotalToken);
    Pivotal.client.allProjects()
      .then(function (projects) {

        var projectsSelect = document.getElementById('pt-projects');
        projectsSelect.innerHTML = '';

        // Add sorting of projects by "name" attribute.
        projects.sort(sortByName);

        projects.forEach(function (project) {
          if ($.inArray(project.id, usedPivotalProjects) == -1) {
            var projectOption = document.createElement('option');
            projectOption.setAttribute('value', project.id);
            projectOption.innerHTML = project.name;

            projectsSelect.appendChild(projectOption);
          }
        });

      })
      .catch(function (status) {
        var projectsSelect = document.getElementById('pt-projects');
        projectsSelect.innerHTML = '';
      });

  });
}

function restore_projects_map_options() {

  chrome.storage.sync.get({
    mappedProjects: []
  }, function (storage) {

    if (!storage.mappedProjects.length) {
      return;
    }

    var mapTbody = document.getElementById('projects-map-tbody');

    for (i in storage.mappedProjects) {
      var map = storage.mappedProjects[i];
      var mapRow = document.createElement('tr');
      mapRow.className = 'added-map';

      var togglProjectCell = document.createElement('td');
      togglProjectCell.setAttribute('class', 'toggl-project');
      togglProjectCell.innerHTML = map.toggl.name;
      mapRow.appendChild(togglProjectCell);

      var pivotalProjectCell = document.createElement('td');
      pivotalProjectCell.setAttribute('class', 'pivotal-project');
      pivotalProjectCell.innerHTML = map.pivotal.name;
      mapRow.appendChild(pivotalProjectCell);

      var deleteButton = document.createElement('button');
      deleteButton.setAttribute('class', 'delete-map-button');
      deleteButton.setAttribute('data-delete-index', i);
      deleteButton.innerHTML = 'Delete';
      deleteButton.addEventListener('click', delete_projects_map);

      var deleteProjectMapCell = document.createElement('td');
      deleteProjectMapCell.setAttribute('class', 'delete-map');
      deleteProjectMapCell.appendChild(deleteButton);
      mapRow.appendChild(deleteProjectMapCell);

      mapTbody.appendChild(mapRow);
    }
  });
}

function save_options() {
  var togglToken = document.getElementById('toggl_token').value;
  var pivotalToken = document.getElementById('pt_token').value;
  chrome.storage.sync.set({
    togglToken: togglToken,
    pivotalToken: pivotalToken
  }, function () {

    location.reload();

    /*

     // Update status to let user know options were saved.
     var status = document.getElementById('status');
     status.textContent = 'Options have been successfully saved.';
     status.classList = 'active';
     setTimeout(function () {
     status.textContent = '';
     status.classList = '';
     }, 2000);*/
  });
}

function add_projects_map(event) {
  var $row = $(this).parents('tr');

  var togglProjectID = $row.find('td.toggl-project select').val();
  var togglProjectName = $row.find('td.toggl-project option[value="' + togglProjectID + '"]').text();

  var pivotalProjectID = $row.find('td.pivotal-project select').val();
  var pivotalProjectName = $row.find('td.pivotal-project option[value="' + pivotalProjectID + '"]').text();

  var map = {};
  map.toggl = {};
  map.pivotal = {};

  map.toggl.id = parseInt(togglProjectID);
  map.toggl.name = togglProjectName;
  map.pivotal.id = parseInt(pivotalProjectID);
  map.pivotal.name = pivotalProjectName;

  chrome.storage.sync.get({
    mappedProjects: []
  }, function (storage) {

    storage.mappedProjects.push(map);
    chrome.storage.sync.set({
      mappedProjects: storage.mappedProjects
    });

    $('tr.added-map').remove();
    restore_projects_map_options();
    restore_toggl_options();
    restore_pivotal_options();
  });
}

function delete_projects_map() {
  var deleteIndex = this.getAttribute('data-delete-index');

  chrome.storage.sync.get({
    mappedProjects: []
  }, function (storage) {
    storage.mappedProjects.splice(deleteIndex, 1);
    chrome.storage.sync.set({
      mappedProjects: storage.mappedProjects
    });

    $('tr.added-map').remove();
    restore_projects_map_options();
    restore_toggl_options();
    restore_pivotal_options();
  });

}

function sortByName(a, b) {
  if (a.name > b.name) {
    return 1;
  }
  if (a.name < b.name) {
    return -1;
  }
  return 0;
}
