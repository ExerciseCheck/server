'use strict';

function parseURL(url) {

  var exerciseId = null;
  var patientId = null;
  const urlToArray = url.split('/');

  //logged-in user is a clinician
  if (urlToArray.length === 7) {
    exerciseId = urlToArray[5];
    patientId = urlToArray[6];
  }
  //logged-in user is a patient
  else if (urlToArray.length === 6) {
    exerciseId = urlToArray.pop();
    patientId = null;
  }
  return {
    patientId: patientId,
    exerciseId: exerciseId
  };
}

function action(nextMode, type) {

  function setFlag(callback) {

    if(nextMode === 'play') {
      localStorage.setItem('canStartRecording', true);
    }
    else if(nextMode === 'stop') {
      localStorage.setItem('canStartRecording', false);
    } else {
      localStorage.clear();
    }
    callback();
  }

  setFlag(function(){

    const parsedURL = parseURL(window.location.pathname);
    var patientId = parsedURL.patientId;
    var exerciseId = parsedURL.exerciseId;
    var url = '/userexercise/session/' + nextMode + '/' + type + '/' + exerciseId + '/';
    window.location = (!parsedURL.patientId)? url: url + patientId;
  });
}

function saveReference() {

  const pathToArray = window.location.pathname.split('/');
  const exerciseId = pathToArray[5];
  const patientId = pathToArray[6];
  const redirectToUrl = '/userexercise/setting/' + exerciseId +'/' + patientId;
  const values = {};
  let data = JSON.parse(localStorage.getItem('data'));
  values.bodyFrames = JSON.stringify(data);
  $.ajax({
    type: 'PUT',
    url: '/api/userexercise/reference/mostrecent/data/' + exerciseId + '/' + patientId,
    data: values,
    success: function (result) {
      localStorage.clear();
      window.location = redirectToUrl
    },
    error: function (result) {
      errorAlert(result.responseJSON.message);
    }
  });
}

function savePractice() {

  const values = {};
  const parsedURL = parseURL(window.location.pathname);
  values.exerciseId = parsedURL.exerciseId;
  let url ='/api/userexercise/practice';
  let patientId = '';
  //logged-in user ia clinician
  if (parsedURL.patientId) {
    url = '/api/userexercise/practice/' + parsedURL.patientId;
    patientId = parsedURL.patientId;
  }
  $.ajax({
    type: 'POST',
    url: url,
    data: values,
    success: function (result) {
       window.location = '/userexercise/session/start/practice/' +
                     parsedURL.exerciseId + '/' + patientId;
    },
    error: function (result) {
      errorAlert(result.responseJSON.message);
    }
  });
}

function goTodashBoard() {

  window.location = '/dashboard';
}

function goToExercises() {

  const patientId = window.location .pathname.split('/').pop();
  window.location = '/clinician/patientexercises/' + patientId;
}

(function ()
{
  let processing, canvas, ctx;
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'];
  //canvas dimension
  let width = 0;
  let height = 0;
  let radius=4; //radius of joint circle
  let circle_radius = 14//radius of calibration circle
  let jointType = [7,6,5,4,2,8,9,10,11,10,9,8,2,3,2,1,0,12,13,14,15,14,13,12,0,16,17,18,19];//re visit and draw in a line
  if (isElectron()) {
    document.addEventListener('DOMContentLoaded', function() {
      processing = false;
      canvas = document.getElementById('outputCanvas');
      ctx = canvas.getContext('2d');
      //get the canvas dimension
      width = canvas.width;
      height = canvas.height;
      window.Bridge.eStartKinect();
    });
  }

  //function that draws the body skeleton
  function drawBody(parameters, ctx){
    let body = parameters;
    jointType.forEach(function(jointType){
      drawJoints({cx: body.joints[jointType].depthX * width, cy: body.joints[jointType].depthY * height},ctx);
    });
    drawCenterCircle({
      x: width / 2, y: height / 5, r: circle_radius, nx: body.joints[2].depthX * width, ny: body.joints[2].depthY * height
    },ctx);

    //connect all the joints with the order defined in jointType
    ctx.beginPath();
    ctx.moveTo(body.joints[7].depthX * width, body.joints[7].depthY * height);
    jointType.forEach(function(jointType){
      ctx.lineTo(body.joints[jointType].depthX * width, body.joints[jointType].depthY * height);
      ctx.moveTo(body.joints[jointType].depthX * width, body.joints[jointType].depthY * height);
    });
    ctx.lineWidth=2;
    ctx.strokeStyle='blue';
    ctx.stroke();
    ctx.closePath();
  }

  //function that draws each joint as a yellow round dot
  function drawJoints(parameters, ctx){
    let cx = parameters.cx;
    let cy = parameters.cy;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI*2); //radius is a global variable defined at the beginning
    ctx.closePath();
    ctx.fillStyle = "yellow";
    ctx.fill();
  }

  // Draw the red Center Circle in ctx1 (canvasSKLT)
  function drawCenterCircle(parameters, ctx){
    //coordinate of the red circle
    let x = parameters.x;
    let y = parameters.y;
    //radius
    let r = parameters.r;
    //
    let head_x = parameters.nx;
    let head_y = parameters.ny;
    ctx.beginPath();
    //euclidean distance from head to calibration circle
    let dist = Math.sqrt(Math.pow((head_x - x),2) + Math.pow((head_y - y), 2))
    if(dist <= r)
      ctx.strokeStyle="green";
    else
      ctx.strokeStyle="red";

    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.stroke();
    ctx.closePath();
    ctx.strokeStyle="black";
  }

  //only start drawing with a bodyframe is detected
  window.Bridge.aOnBodyFrame = (bodyFrame) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let frames = new Array();
    let data = JSON.parse(localStorage.getItem('data')) || [];

    //draw each joint circles
    bodyFrame.bodies.forEach(function (body) {
      if (body.tracked) {
        //draw the body skeleton
        drawBody(body,ctx);
        if(JSON.parse(localStorage.getItem('canStartRecording')) === true) {
          frames.push(body);
          data.push(frames);
          localStorage.setItem('data', JSON.stringify(data));
        }
      }
    });
  };

  function isElectron() {
    return 'Bridge' in window;
  }
})();
