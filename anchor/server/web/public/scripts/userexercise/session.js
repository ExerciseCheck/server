'use strict';

// liveFrames is a temporary name/status for currently recorded frames.
// ref frames refers to either the updated ref (liveFrames -> refFrames) OR one from database
// recentFrames refers to practicee exercise 'stop' page (liveFrames -> recentFrames)
let liveFrames, refFrames, recentFrames;
let req, db;
let dataForCntReps = {};
let refStart, refEnd; //not used
let repEvals = [];
let liveBodyColor="#7BE39F";
let commonBlue = "#1E89FB"
let refJointColor = "#FF6786"
window.actionBtn = false;

window.onbeforeunload = (e) => {
  if (window.actionBtn) {
    return;
  }

  if(confirm('Are you sure you want to quit? Incomplete session data will be lost.')) {
    return;
  }
  else {
    return false;
  }
}

$('.actionBtn').click(function() {
  window.actionBtn = true;
})

function parseURL(url)
{

  var exerciseId = null;
  var patientId = null;
  var mode = null;
  var type = null;
  const urlToArray = url.split('/');

  mode = urlToArray[3];
  type = urlToArray[4];
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
    mode: mode,
    patientId: patientId,
    exerciseId: exerciseId,
    type: type
  };
}

function action(nextMode, type) {
  openDB(function() {
    const parsedURL = parseURL(window.location.pathname);
    var patientId = parsedURL.patientId;
    var exerciseId = parsedURL.exerciseId;

    function redirect() {
      var redirectToUrl = '/userexercise/session/' + nextMode + '/' + type + '/' + exerciseId + '/';
      window.location = (!parsedURL.patientId) ? redirectToUrl : redirectToUrl + patientId;
    }

    //This condition describes the end of an update or create reference.
    //The refFrames data in local storage gets set to the most recent frames.
    if(nextMode === 'stop' && type === 'reference') {
        var ref_ed = new Date().getTime();
        localStorage.setItem("refEnd", ref_ed);
        let updatedRef = {type: 'refFrames', body: liveFrames};
        let bodyFramesStore = db.transaction(['bodyFrames'], 'readwrite').objectStore('bodyFrames');
        let request = bodyFramesStore.put(updatedRef);
        request.onsuccess = function(event) {
          redirect();
        }
    }
    else if(nextMode === 'start' && type === 'reference') {
      let deleteref = db.transaction(['bodyFrames'], 'readwrite').objectStore('bodyFrames').put({type: 'refFrames', body: []});
      deleteref.onsuccess = function(e) {
        redirect();
      }
    }
    else {
      if(nextMode === 'stop') {
        let request = db.transaction(['bodyFrames'], 'readwrite').objectStore('bodyFrames').put({type: 'liveFrames', body: liveFrames});
      }
      redirect();
    }
  });
}

// helper function for calculating the refMax, refMin
// axis is either 'depthX' or 'depthY'
function getMinMax_joint(joint, array, axis) {
  var out = [];
  array.forEach(function(el) {
    return out.push.apply(out, [el.joints[joint][axis]]);
  }, []);
  return { min: Math.min.apply(null, out), max: Math.max.apply(null, out) };
}

// assuming the save button is clicked by someone else
function saveReference() {
  const pathToArray = window.location.pathname.split('/');
  const exerciseId = pathToArray[5];
  const patientId = pathToArray[6];
  const redirectToUrl = '/userexercise/setting/' + exerciseId +'/' + patientId;

  let values = {};
  // save to referenceExercise
  values.bodyFrames = JSON.stringify(refFrames);
  values.neckX = refFrames[0].joints[2].depthX;
  values.neckY = refFrames[0].joints[2].depthY;
  var mm = getMinMax_joint(dataForCntReps.joint, refFrames, dataForCntReps.axis);
  values.refMin = mm.min;
  values.refMax = mm.max;
  values.refLowerJoint = refFrames[0].joints[dataForCntReps.refLowerJointID][dataForCntReps.axis];
  values.refUpperJoint = refFrames[0].joints[dataForCntReps.refUpperJointID][dataForCntReps.axis];
  var ed = localStorage.getItem("refEnd");
  var st = localStorage.getItem("refStart");
  localStorage.removeItem("refEnd");
  localStorage.removeItem("refStart");
  values.refTime = Math.round((ed - st) / 1000);
  console.log(values.refTime);
  // save also to dataForCntReps
  dataForCntReps.refLowerJointPos = values.refLowerJoint;
  dataForCntReps.refUpperJointPos = values.refUpperJoint;
  dataForCntReps.refTime = values.refTime;

  $.ajax({
    type: 'PUT',
    url: '/api/userexercise/reference/mostrecent/data/' + exerciseId + '/' + patientId,
    data: values,
    success: function (result) {
      window.location = redirectToUrl
    },
    error: function (result) {
      errorAlert(result.responseJSON.message);
    }
  });
}

function savePractice() {

  const parsedURL = parseURL(window.location.pathname);
  let patientId = parsedURL.patientId;
  let exerciseId = parsedURL.exerciseId;
  let url ='/api/userexercise/practice/mostrecent/data/' + exerciseId + '/';
  let isComplete = false;
  let values = {};
  values.bodyFrames = JSON.stringify(recentFrames);
  //TODO: better ways than store to localStorage?
  //values.repEvals = JSON.parse(localStorage.getItem("repEvals"));
  values.repEvals = localStorage.getItem("repEvals");
  console.log(values.repEvals);
  //localStorage.removeItem("repEvals");
  //logged-in user is clinician

  if (patientId) {
    url = url + patientId;
  }
  if(setNumber === numSets) {
    values.weekEnd = new Date().getWeekNumber();
    isComplete = true;
  }
  $.ajax({
    type: 'PUT',
    url: url,
    data: values,
    success: function (result) {

      if(isComplete) {
      window.location = '/userexercise/session/end/practice/' +
        exerciseId + '/' + patientId;
      } else {
        window.location = '/userexercise/session/start/practice/' +
          exerciseId + '/' + patientId;
      }
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
  let processing, canvas, ctx, ref_canvas, ref_ctx, exe_canvas, exe_ctx;
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'];
  //canvas dimension
  let width = 0;
  let height = 0;
  let radius=9; //radius of joint circle
  let circle_radius = 30//radius of calibration circle
  let jointType = [7,6,5,4,2,8,9,10,11,10,9,8,2,3,2,1,0,12,13,14,15,14,13,12,0,16,17,18,19];//re visit and draw in a line
  let notAligned = true; // whether person has aligned in circle for the first time or not
  let useTimer = true; // whether or not to use the startTimer() function
  // index of reference frame
  let ref_index = 0;
  // index of exercise frame
  let exe_index = 0;
  let parsedURL = parseURL(window.location.pathname);

  // value for countReps
  let nx_1stFrame, ny_1stFrame;
  let neck_z; // distance to the camera sensor
  let threshold_flag, direction;
  // fetch data before start exercise
  let url = '/api/userexercise/dataforcount/' + parsedURL.exerciseId + '/';
  (!parsedURL.patientId) ? url = url: url = url + parsedURL.patientId;
  $.get(url, function(data){
    dataForCntReps = data;
    //threshold_flag = data.direction;
    //group: (down, L2R) +; (up, R2L) -
    if(data.direction === 'L2R') {
      direction = "down";
      threshold_flag = "down";
    } else if (data.direction === 'R2L') {
      direction = "up";
      threshold_flag = "up";
    } else {
      direction = data.direction;
      threshold_flag = data.direction;
    }
  });
  // time for speed evaluation
  var st, ed;

  if (isElectron())
  {
    document.addEventListener('DOMContentLoaded', function() {
      processing = false;
      //live canvas
      canvas = document.getElementById('outputCanvas');
      ctx = canvas.getContext('2d');
      drawGrids(ctx);
      drawFloorPlane(ctx);
      //reference canvas
      ref_canvas = document.getElementById('refCanvas');
      ref_ctx = ref_canvas.getContext('2d');
      drawGrids(ref_ctx);
      drawFloorPlane(ref_ctx);
      //exercise canvas
      exe_canvas = document.getElementById('exeCanvas');
      exe_ctx = exe_canvas.getContext('2d');
      drawGrids(exe_ctx);
      drawFloorPlane(exe_ctx);

      //get the canvas dimension
      width = canvas.width;
      height = canvas.height;
      liveFrames = [];
      localStorage.setItem('canStartRecording', false);

      openDB(function() {
        let getref = db.transaction(['bodyFrames']).objectStore('bodyFrames').get('refFrames');
        getref.onsuccess = function(e) {
          if(getref.result) {
            refFrames = getref.result.body;
            console.log("refFrames loaded locally");
          }
          showCanvas();
          console.log("show canvas called after getting referenceFrames");
        }

        let getrecent = db.transaction(['bodyFrames']).objectStore('bodyFrames').get('liveFrames');
        getrecent.onsuccess = function(e) {
          if(getrecent.result) {
            recentFrames = getrecent.result.body;
          }
        }
      });
      window.Bridge.eStartKinect();
    });
  }

  // the function that controls the canvas hiding/displaying logic
  // we determine the state of the website by parsing URL
  // we also reset the reference counter whenever we transit to a new state
  function showCanvas()
  {
    let refCanvas = document.getElementById("refCanvas");
    let exeCanvas = document.getElementById("exeCanvas");
    let outputCanvas = document.getElementById("outputCanvas");

    //start of creating reference
    if(parsedURL.mode === 'start' && refFrames.length === 0)
    {
      ref_index = 0;
      exe_index = 0;
      //nothing should be shown
      // document.getElementById("refCanvas").style.display = "none";
      // document.getElementById("exeCanvas").style.display = "none";
      // document.getElementById("outputCanvas").style.display = "none";
      refCanvas.style.display = "none";
      exeCanvas.style.display = "none";
      outputCanvas.style.display = "none";
    }
    // start of updating reference and practice
    else if((parsedURL.mode === 'start' || parsedURL.mode === 'end') && refFrames)
    {
      ref_index = 0;
      exe_index = 0;
      //show reference canvas only
      // document.getElementById("refCanvas").style.display = "block";
      // document.getElementById("exeCanvas").style.display = "none";
      // document.getElementById("outputCanvas").style.display = "none";
      refCanvas.style.display = "block";
      exeCanvas.style.display = "none";
      outputCanvas.style.display = "none";
      let ctx = refCanvas.getContext('2d');
      drawGrids(ctx);
      drawFloorPlane(ctx);

    }
    //play state for updating reference and creating reference
    else if(parsedURL.mode === 'play' && parsedURL.type === 'reference')
    {
      ref_index = 0;
      exe_index = 0;
      //show live canvas only
      // document.getElementById("refCanvas").style.display = "none";
      // document.getElementById("exeCanvas").style.display = "none";
      // document.getElementById("outputCanvas").style.display = "block";
      refCanvas.style.display = "none";
      exeCanvas.style.display = "none";
      outputCanvas.style.display = "block";
      let ctx = outputCanvas.getContext('2d');
      drawGrids(ctx);
      drawFloorPlane(ctx);
    }
    //play state for practice
    else if(parsedURL.mode === 'play' && parsedURL.type === 'practice')
    {
      ref_index = 0;
      exe_index = 0;
      //show live canvas and reference canvas
      // document.getElementById("refCanvas").style.display = "inline";
      // document.getElementById("exeCanvas").style.display = "none";
      // document.getElementById("outputCanvas").style.display = "inline";
      refCanvas.style.display = "inline";
      exeCanvas.style.display = "none";
      outputCanvas.style.display = "inline";
      let ctx1 = refCanvas.getContext('2d');
      drawGrids(ctx1);
      drawFloorPlane(ctx1);
      let ctx2 = outputCanvas.getContext('2d');
      drawGrids(ctx2);
      drawFloorPlane(ctx2);

    }
    //stop state for updating reference and creating reference
    else if(parsedURL.mode === 'stop' && parsedURL.type === 'reference')
    {
      ref_index = 0;
      exe_index = 0;
      //show reference canvas
      // document.getElementById("refCanvas").style.display = "block";
      // document.getElementById("exeCanvas").style.display = "none";
      // document.getElementById("outputCanvas").style.display = "none";
      refCanvas.style.display = "block";
      exeCanvas.style.display = "none";
      outputCanvas.style.display = "none";
      let ctx = refCanvas.getContext('2d');
      drawGrids(ctx);
      drawFloorPlane(ctx);

    }
    //stop state for exercise
    else if(parsedURL.mode === 'stop' && parsedURL.type === 'practice')
    {
      ref_index = 0;
      exe_index = 0;
      //show reference and exercise canvas
      // document.getElementById("refCanvas").style.display = "inline";
      // document.getElementById("exeCanvas").style.display = "inline";
      // document.getElementById("outputCanvas").style.display = "none";
      refCanvas.style.display = "inline";
      exeCanvas.style.display = "inline";
      outputCanvas.style.display = "none";
      let ctx1 = refCanvas.getContext('2d');
      drawGrids(ctx1);
      drawFloorPlane(ctx1);
      let ctx2 = exeCanvas.getContext('2d');
      drawGrids(ctx2);
      drawFloorPlane(ctx2);
    }
    //this case is used for error safety, should not be called normally
    else
    {
      ref_index = 0;
      exe_index = 0;
      console.log("State error occurs!");
    }
  }

  function drawGrids(ctx){
    // grid
    let bw = 500; // canvas.width
    let bh = 500; // canvas.height
    let p = -0.5; // padding
    let count = 0;
    ctx.beginPath();
    for (let x = 0; x <= bh; x += 100.3) {
        ctx.moveTo(p, x + p);
        ctx.lineTo(bw + p, x + p);
    }
    ctx.lineWidth=0.5;
    ctx.strokeStyle = "#525B74";
    ctx.stroke();
    ctx.closePath();
  }

  function drawFloorPlane(ctx) {
    ctx.strokeStyle = "none";
    ctx.fillStyle = '#F0F0F2';
    ctx.beginPath();
    ctx.moveTo(0, 500);
    ctx.lineTo(100, 406);
    ctx.lineTo(400, 406);
    ctx.lineTo(500, 500);
    ctx.fill();

  }


  function startTimer() {
    let start = Date.now();
    let timer = setInterval(function () {
      let delta = Date.now() - start;
      let time = window.CONFIG.TIMER_MAX - Math.floor(delta / 1000);
      if (time <= 0) {
        clearInterval(timer);
        $("#timerStart").attr("class", "greenColor large");
        $("#timerStart").text("Now Recording...");
        $("#num").text("");
        localStorage.setItem('canStartRecording', true);
        notAligned = false;
        let event = new Event('timer-done');
        document.dispatchEvent(event);
      } else {
        $("#timerStart").text("Recording will begin in...");
        $("#num").text(time);
      }
    }, 100);
  }

  //function that draws the body skeleton
  function drawBody(parameters, ctx, color, jointColor, drawCircle = true){

    let body = parameters;
    jointType.forEach(function(jointType){
      drawJoints({cx: body.joints[jointType].depthX * width, cy: body.joints[jointType].depthY * height},ctx, jointColor);
    });
    if(drawCircle)
    {
      drawCenterCircle({
        x: width / 2, y: 200, r: circle_radius, nx: body.joints[2].depthX * width, ny: body.joints[2].depthY * height
      },ctx);
    }
    //connect all the joints with the order defined in jointType

    ctx.beginPath();
    ctx.moveTo(body.joints[7].depthX * width, body.joints[7].depthY * height);
    jointType.forEach(function(jointType){
      ctx.lineTo(body.joints[jointType].depthX * width, body.joints[jointType].depthY * height);
//      ctx.shadowColor = "red";
//      ctx.shadowOffsetX = 2;
//      ctx.shadowOffsetY = 4;
//      ctx.shadowBlur = 8;
      ctx.moveTo(body.joints[jointType].depthX * width, body.joints[jointType].depthY * height);

    });

    ctx.lineWidth=8;
    ctx.strokeStyle=color;
    ctx.stroke();
    ctx.closePath();
  }

  //function that draws each joint as a yellow round dot
  function drawJoints(parameters, ctx, color){

    let cx = parameters.cx;
    let cy = parameters.cy;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI*2); //radius is a global variable defined at the beginning
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  //function that draws the red Center Circle in ctx1 (canvasSKLT)
  function drawCenterCircle (parameters, ctx){

    //coordinate of the red circle
    let x = parameters.x;
    let y = parameters.y;
    //radius
    let r = parameters.r;
    //
    let neck_x = parameters.nx;
    let neck_y = parameters.ny;
    ctx.beginPath();
    //euclidean distance from head to calibration circle
    let dist = Math.sqrt(Math.pow((neck_x - x),2) + Math.pow((neck_y - y), 2))
    if(notAligned) {
      if(dist <= r){
        //When person's neck enters green circle && mode is 'play', recording will start.
        ctx.strokeStyle="Lime";
        var parsedURL = parseURL(window.location.pathname);
        if(parsedURL.mode === 'play' && useTimer) {
          startTimer();
          useTimer = false;
        }
      }
      else {
        ctx.strokeStyle="red";
      }
    }
    else {
      ctx.strokeStyle="DimGray"; // circle turns into a dark grey color once countdown finishes
    }
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.stroke();
    ctx.closePath();
    ctx.strokeStyle="black";
  }

  //function that counts repetitions
  function countReps(body, threshold_flag, range_scale, top_thresh, bottom_thresh) {

    var reps = 0;
    var norm, ref_norm;
    // This is set when user is correctly positioned in circle
    // neck: 2
    if (dataForCntReps.axis == 'depthY') {
      ref_norm = dataForCntReps.neckY;
      norm = ny_1stFrame;
    } else if (dataForCntReps.axis == 'depthX') {
      ref_norm = dataForCntReps.neckX;
      norm = nx_1stFrame;
    }

    // Normalize reference points to neck
    var ref_lower_joint = dataForCntReps.refLowerJointPos - ref_norm;
    var ref_upper_joint = dataForCntReps.refUpperJointPos - ref_norm;
    var range = (ref_lower_joint - ref_upper_joint) * range_scale;

    var ref_max = dataForCntReps.refMax - ref_norm;
    var ref_min = dataForCntReps.refMin - ref_norm;
    //var range = (ref_max - ref_min) * range_scale;

    // Normalize current point by range and current neck value
    var current_pt = (body.joints[dataForCntReps.joint][dataForCntReps.axis] - norm - ref_min) / range;

    // direction group: (down, right), (up, left)
    if ((threshold_flag === 'up') && (current_pt < top_thresh)) {
      // goes up and pass the top_thresh
      // only increase reps when moving against the exercise direction:
      if (threshold_flag !== direction && isBodyInPlane(neck_z, body.joints[2].cameraZ)) {
        reps++;
      }
      return [reps, 'down'];
    } else if ((threshold_flag === 'down') && (current_pt > bottom_thresh)) {
      // goes down and pass the bottom_thresh
      // only increase reps when moving against the exercise direction:
      if (threshold_flag !== direction && isBodyInPlane(neck_z, body.joints[2].cameraZ)) {
        reps++;
      }
      return [reps, 'up'];
    } else {
      // console.log("No flip");
      return [reps, threshold_flag];
    }
  }

  // patient reaching out for button makes body NOT in plane
  function isBodyInPlane(ref_neck, neck) {
    if (ref_neck * 0.6 < neck && ref_neck * 1.2 > neck && neck >= 1.5){
      return true;
    }
    return false;
  }

  //only start drawing with a body frame is detected
  //even though


  window.Bridge.aOnBodyFrame = (bodyFrame) =>
  {


    const parsedURL = parseURL(window.location.pathname);
    //clear out the canvas so that the previous frame will not overlap
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ref_ctx.clearRect(0, 0, ref_canvas.width, ref_canvas.height);
    exe_ctx.clearRect(0, 0, exe_canvas.width, exe_canvas.height);
    //tag the canvas
    ctx.font="20px Arial";
    (notAligned) ? ctx.fillStyle = "red" : ctx.fillStyle = "#23D160";
    ctx.textAlign = "center";
    ctx.fillText("Current Set", canvas.width/2, canvas.height/20);
    drawGrids(ctx);
    drawFloorPlane(ctx);

    ref_ctx.font="20px Arial";
    //ref_ctx.fillStyle = "red";
    ref_ctx.fillStyle = "#1E89FB";
    ref_ctx.textAlign = "center";
    ref_ctx.fillText("Reference", canvas.width/2, canvas.height/20);
    drawGrids(ref_ctx);
    drawFloorPlane(ref_ctx);

    exe_ctx.font="20px Arial";
    //exe_ctx.fillStyle = "red";
    exe_ctx.fillStyle = "#7BE39F";
    exe_ctx.textAlign = "center";
    exe_ctx.fillText("Exercise", canvas.width/2, canvas.height/20);
    drawGrids(exe_ctx);
    drawFloorPlane(exe_ctx);

    //draw each joint circles when a body is tracked
    bodyFrame.bodies.forEach(function (body)
    {
      if (body.tracked)
      {
        //location of the neck
        let neck_x = body.joints[2].depthX;
        let neck_y = body.joints[2].depthY;

        //draw the body skeleton in live canvas
        drawBody(body,ctx, liveBodyColor, commonBlue);

        document.addEventListener('timer-done', function(evt){
          console.log("timer done", evt.detail);
          nx_1stFrame = neck_x;
          ny_1stFrame = neck_y;
          neck_z = body.joints[2].cameraZ;

          console.log("neck position in the first frame recorded");
          st = new Date().getTime();
          if ((parsedURL.type === 'reference') && (parsedURL.mode === 'play')) {
            localStorage.setItem("refStart", st);
          }
        });

        // check in-position status whenever kinect captures a body
        // if(!inPosition) {
        //   if((Math.sqrt(Math.pow(((neck_x - 0.5)* width),2) + Math.pow(((neck_y - 0.2)*height), 2))) <= circle_radius === true) {
        //     inPosition = true;
        //     //TODO: if there is timer, may need to move this
        //     //record the neck position for norm once inPosition
        //     nx_1stFrame = neck_x;
        //     ny_1stFrame = neck_y;
        //     neck_z = body.joints[2].cameraZ;
        //
        //     console.log("neck position in the first frame recorded");
        //     st = new Date().getTime();
        //     if ((parsedURL.type === 'reference') && (parsedURL.mode === 'play')) {
        //       localStorage.setItem("refStart", st);
        //     }
        //   }
        // }

        if(JSON.parse(localStorage.getItem('canStartRecording')) === true)
        {
          liveFrames.push(body);
          if ((parsedURL.type === 'practice') && (parsedURL.mode === 'play')) {
            // countReps and timing
            var tempCnt = countReps(body, threshold_flag,
              dataForCntReps.rangeScale, dataForCntReps.topThresh, dataForCntReps.bottomThresh);

            threshold_flag = tempCnt[1];
            document.getElementById("cntReps").innerHTML =
              parseInt(document.getElementById("cntReps").innerHTML) + parseInt(tempCnt[0]);

            if (tempCnt[0] === 1) {
              ed = new Date().getTime();
              console.log("end time: ", ed);
              var diff = Math.round((ed - st) / 1000);
              var speedEval = "It takes " + diff + " s";
              var repItem = {"speed": diff};
              repEvals.push(repItem);
              localStorage.setItem("repEvals", JSON.stringify((repEvals)));
              console.log(repEvals);
              console.log(JSON.parse(localStorage.getItem("repEvals")));
              document.getElementById("speedEval").innerHTML = speedEval;
              st = ed;
              console.log("start time: ", st);
            }
          }
        }
      }
    });

    //if the patient is in position and doing a practice session

    if(JSON.parse(localStorage.getItem('canStartRecording')) === true && (parsedURL.type === 'practice') && (parsedURL.mode === 'play')) {

      //draw in the reference canvas
        drawBody(refFrames[ref_index], ref_ctx,commonBlue,refJointColor, false);
        //display one frame of reference every 2 frames of live frame captured
        //we can manipulate the number to control the display speed
        ref_index = (ref_index + 1) % refFrames.length;
    }

    //check if it is in the state of displaying reference, if reference exists
    //1. end of creating reference and end of updating
    //2. start of updating
    //3. start of practice
    //4. end of practice
    //in theses cases, the in-position will not be checked
    else if (((parsedURL.type === 'reference') && (parsedURL.mode === 'stop')) ||
      ((parsedURL.type === 'reference') && (parsedURL.mode === 'start') && refFrames.length > 0) ||
      ((parsedURL.type === 'practice') && (parsedURL.mode === 'start' || parsedURL.mode === 'end')) ||
      ((parsedURL.type === 'practice') && (parsedURL.mode === 'stop'))
    )
    {
      //draw in the reference canvas
      drawBody(refFrames[ref_index], ref_ctx,commonBlue, refJointColor, false);
      //if in the end of practice state, we will also display the latest exercise, with the same frequency as the reference
      if((parsedURL.type === 'practice') && (parsedURL.mode === 'stop'))
      {
        drawBody(recentFrames[exe_index], exe_ctx,liveBodyColor,commonBlue ,false);
      }
      ref_index = (ref_index + 1) % refFrames.length;
      if(recentFrames) {
        exe_index = (exe_index + 1) % recentFrames.length;
      }
    }
  };

  function isElectron() {
    return 'Bridge' in window;
  }
})();
