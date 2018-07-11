'use strict';

function getExerciseId() {

  return (window.location.pathname.split('/'))[3];
}

function getPatientId() {

  return (window.location.pathname.split('/'))[4];
}

function initialSetting(numSets, numReps, exerciseId, patientId, redirectToUrl) {

  const values = {};
  values.exerciseId = exerciseId;
  values.userId = patientId;
  values.numSets = numSets;
  values.numRepetition = numReps;
  values.rangeScale = 0.7; // default
  values.topThresh = 0.25; // values
  values.bottomThresh = 0.75;

  $.ajax({
    type: 'POST',
    url: '/api/userexercise/reference',
    data: values,
    success: function (result) {
        successAlert('Setting successfully updated');
        if(redirectToUrl) {
          window.location = redirectToUrl;
        }
    },
    error: function (result) {
      errorAlert(result.responseJSON.message);
    }
  });
}

function updateSetting(numSets, numReps, exerciseId, patientId) {

  const values = {};
  values.numSets = numSets;
  values.numRepetition = numReps;
  values.numSets = numSets;
  values.numRepetition = numReps;
  values.rangeScale = 0.5; //dummy
  values.topThresh = 0.5; // dummy
  values.bottomThresh = 0.5;//dummy values


  $.ajax({
    type: 'PUT',
    url: '/api/userexercise/reference/mostrecent/setting/' + exerciseId +'/' + patientId,
    data: values,
    success: function (result) {
       successAlert('Setting successfully updated');
    },
    error: function (result) {
      errorAlert(result.responseJSON.message);
    }
  });
}

//when there's no reference update setting can do both inserting or updating
function changeSetting() {

  const numSets = $("#numSets").val();
  const numReps = $("#numReps").val();
  const url = '/userexercise/setting/' + getExerciseId() +'/' + getPatientId();

  $.get('/api/userexercise/reference/' + getExerciseId() + '/' + getPatientId(), function(data){

    if ( data.settingIsUpdated ) {
      updateSetting(numSets, numReps, getExerciseId(), getPatientId());
    }

    else {
      alert('no reference found');
      initialSetting(numSets, numReps, getExerciseId(), getPatientId());
    }
  });
}

//when there is a reference meaning a reference is recorded update setting just updates
function update() {

  const numSets = $("#numSets").val();
  const numReps = $("#numReps").val();
  const url = '/userexercise/setting/' + getExerciseId() +'/' + getPatientId();
  updateSetting(numSets, numReps, getExerciseId(), getPatientId(), url);
}

function createRef() {

  const url = '/api/userexercise/reference/' + getExerciseId() + '/' + getPatientId();
  const redirectToUrl = '/userexercise/session/start/reference/' +
                            getExerciseId() + '/' + getPatientId();

  $.get(url, function(data){

    if ( data.settingIsUpdated ) {
      window.location = redirectToUrl;
    }

    else {
      initialSetting(1, 1, getExerciseId(), getPatientId(), redirectToUrl);
    }
  });
}

function viewReferences() {

  window.location = '/userexercise/reference/' + getPatientId();
}

function updateReference() {
  loadReferenceandStart('reference');
}

function StartPracticeSession() {
  loadReferenceandStart('practice');
}

function loadReferenceandStart(type) {
  const url = '/api/userexercise/loadreference/' + getExerciseId() + '/' + getPatientId();
  $.get(url, function(data){
    console.log("Get from CLINICIAN side");
    localStorage.setItem("refFrames", JSON.stringify(data));
    redirect(type);
  });
}

function redirect(type) {
  window.location = '/userexercise/session/start/' + type + '/' +
    getExerciseId() + '/' + getPatientId();
}
