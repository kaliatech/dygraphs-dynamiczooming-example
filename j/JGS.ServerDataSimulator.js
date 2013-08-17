(function (JGS, $, undefined) {

  JGS.ServerDataSimulator = function (seriesName, minDelay, maxDelay) {
    this.seriesName = seriesName;
    this.minDelay = minDelay === undefined ? 100 : minDelay;
    this.maxDelay = maxDelay === undefined ? 1000 : maxDelay;

    this.onServerDataLoadCallbacks = $.Callbacks();
  };

  JGS.ServerDataSimulator.prototype.loadData = function (dataLoadReq) {
    console.log("loadData", dataLoadReq);
    if (!this.serverData) {
      this._generateServerData();
    }

    //Simulate Downsampling
    var dataPoints = [];

    var timePerInterval = (dataLoadReq.endDateTm.getTime() - dataLoadReq.startDateTm.getTime()) / dataLoadReq.numIntervals;
    var currTime = dataLoadReq.startDateTm.getTime();

    //Find start
    var currIdx = 0;
    for (var i = 0; i < this.serverData.length; i++) {

      if (this.serverData[currIdx].x < (currTime - timePerInterval))
        currIdx++;
      else
        break;
    }

    while (currIdx < this.serverData.length && currTime < dataLoadReq.endDateTm.getTime()) {
      var numPoints = 0;
      var sum = 0;
      var min = 9007199254740992;
      var max = -9007199254740992;

      while (currIdx < this.serverData.length && this.serverData[currIdx].x < currTime) {
        sum += this.serverData[currIdx].y;
        min = Math.min(min, this.serverData[currIdx].y);
        max = Math.max(max, this.serverData[currIdx].y);
        currIdx++;
        numPoints++;
      }

      var avg = sum / numPoints

      var dps = [];

      if (numPoints == 0) {
        if (dataLoadReq.includeMinMax) {
          dataPoints.push({
            x: currTime,
            avg: null,
            min: null,
            max: null
          });
        }
        else {
          dataPoints.push({x: currTime, avg: null});
        }
      }
      else {
        if (dataLoadReq.includeMinMax) {
          dataPoints.push({
            x: currTime,
            avg: avg,
            min: min,
            max: max
          });
        }
        else {
          dataPoints.push({x: currTime, avg: avg});
        }
      }

      currTime += timePerInterval;
    }

    var delay = (Math.random() * (this.maxDelay - this.minDelay)) + this.minDelay;
    setTimeout($.proxy(this._onDataLoad, this, dataLoadReq, dataPoints), delay);

  };

  JGS.ServerDataSimulator.prototype._onDataLoad = function (dataLoadReq, dataPoints) {
    var dataLoadResp = {
      dataPoints: dataPoints
    };
    this.onServerDataLoadCallbacks.fire(dataLoadReq, dataLoadResp);
  };

  JGS.ServerDataSimulator.prototype._generateServerData = function () {

    var startMom = moment('2010-06-01');
    var endMom = moment();
    endMom.add('day', -5);

    var min = 0;
    var max = 1000;
    var majorInterval = moment.duration(37, 'days');
    var minorInterval = moment.duration(1, 'hour');

    var data = [];

    var totalDur = endMom.valueOf() - startMom.valueOf();

    var currTime = startMom.valueOf();
    var numPoints = (endMom.valueOf() - startMom.valueOf()) / minorInterval.valueOf();


    var period = majorInterval.valueOf();
    var periodNum = currTime / period;
    var periodIncr = startMom.date() / 31.0; //1-31, just need a number that can change as we iterate, but stays the same for each reload of data set given same start/end dates. This makes the overall trend look the same every time
    //and should avoid some confusion in the demo.

    var detailFactor = 500;

    var lastY = min;


    for (var i = 0; i < numPoints; i++) {


      //console.log(currTime);
      if (Math.floor(currTime / period) != periodNum) {
        //console.log("break:" + currTime);
        periodNum = Math.floor(currTime / period);
        //periodIncr = Math.random() * 1;
        periodIncr = moment(currTime).date() / 31.0;
        periodIncr = periodIncr - 0.5;
      }

      lastY += periodIncr;
      if (lastY > max) {
        periodIncr = periodIncr * -1;
      }
      else if (lastY < min) {
        periodIncr = periodIncr * -1;
      }

      var detailY = lastY + Math.random() * detailFactor;
//      if (detailY > max)
//        detailY = max;
//      if (detailY < min)
//        detailY = min;

      //data.push({x:currTime, y:min + ((Math.sin(i*10000)) * (max-min) + (max-min)/2)});
      data.push({ x: currTime, y: detailY});
      currTime += minorInterval.valueOf();
    }

    this.serverData = data;

  }


}(window.JGS = window.JGS || {}, jQuery));