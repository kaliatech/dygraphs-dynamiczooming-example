(function (JGS, $, undefined) {
  "use strict";
  /**
   * This class simulates a backend time series data service.  It makes it possible to provide a live demo without
   * having any backend service dependencies.  The server-side downsampling can be done an infinite number of ways
   * and will depend on nature of project, data purpose, size, etc.  Relational databases can be used, but often not
   * ideal.  For those looking for time series specific databases,  I would recommend checking out OpenTSDB, KairoDB,
   * or my newest favorite, tempo-db.com.
   *
   * This class simulates a randomized loading delay, default from 100 - 1000ms.
   *
   *
   @class ServerDataSimulator
   @constructor
   */
  JGS.ServerDataSimulator = function (seriesName, minDelay, maxDelay) {
    this.seriesName = seriesName;
    this.minDelay = minDelay === undefined ? 100 : minDelay;
    this.maxDelay = maxDelay === undefined ? 1000 : maxDelay;

    this.onServerDataLoadCallbacks = $.Callbacks();
  };

  JGS.ServerDataSimulator.prototype.loadData = function (dataLoadReq) {
    //console.log("loadData", dataLoadReq);

    //Generate fake raw data set on first call
    if (!this.serverData) {
      this._generateServerData();
    }

    //Do down sampling per the dataLoadReq
    var dataPoints = [];

    var timePerInterval = (dataLoadReq.endDateTm.getTime() - dataLoadReq.startDateTm.getTime()) / dataLoadReq.numIntervals;
    var currTime = dataLoadReq.startDateTm.getTime();

    //Find start of load request in the raw dataset
    var currIdx = 0;
    for (var i = 0; i < this.serverData.length; i++) {

      if (this.serverData[currIdx].x < (currTime - timePerInterval))
        currIdx++;
      else
        break;
    }

    // Calculate average/min/max while downsampling
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
            avg: Math.round(avg),
            min: Math.round(min),
            max: Math.round(max)
          });
        }
        else {
          dataPoints.push({x: currTime, avg: avg});
        }
      }

      currTime += timePerInterval;
      currTime = Math.round(currTime);
    }

    var delay = (Math.random() * (this.maxDelay - this.minDelay)) + this.minDelay;

    //console.log("dataPoints", dataLoadReq, dataPoints);

    //Random delay for "_onDataLoad" callback to simulate loading data from real server
    setTimeout($.proxy(this._onDataLoad, this, dataLoadReq, dataPoints), delay);

  };


  JGS.ServerDataSimulator.prototype._onDataLoad = function (dataLoadReq, dataPoints) {
    var dataLoadResp = {
      dataPoints: dataPoints
    };
    this.onServerDataLoadCallbacks.fire(dataLoadReq, dataLoadResp);
  };


  /**
   Generates the simulated raw dataset. To make the demo compelling, we want obvious larger trends in the data over time, with
   more detail viewable only when zooming in. That's basically what this does. Date ranges and randomizing is hardcoded, but
   could be easily parameterized.

   NOTE:[2013-08-19 JGS]  This method is a bit of a mess. I just wanted something that generated semi-compelling
   data consistently and played around with a multitude of variations.

   @method _generateServerData
   @private
   */
  JGS.ServerDataSimulator.prototype._generateServerData = function () {

    var startMom = moment().utc();
	startMom.add('year',-3);
	
    var endMom = moment().utc();
    endMom.add('day', 30);

    var min = 500;
    var max = 1500;
    var majorInterval = moment.duration(11, 'days');
    var minorInterval = moment.duration(1, 'minute');

    if (this.seriesName == "Series-A") {
      majorInterval = moment.duration(11, 'days');
      minorInterval = moment.duration(1, 'minute');
    }
    else if (this.seriesName == "Series-B") {
      majorInterval = moment.duration(5, 'days');
      minorInterval = moment.duration(5, 'minute');
    }
    else {
      majorInterval = moment.duration(20, 'days');
      minorInterval = moment.duration(10, 'minute');
    }

    var data = [];

    var totalDur = endMom.valueOf() - startMom.valueOf();

    var currTime = startMom.valueOf();
    var numPoints = (endMom.valueOf() - startMom.valueOf()) / minorInterval.valueOf();


    var period = majorInterval.valueOf();
    var periodNum = currTime / period;

    // just need a number that can change as we iterate, but stays
    // the same for each reload of data set given same start/end dates. This makes the overall trend look the same every time
    // for a given series, and might avoid some confusion in the demo.
    var periodIncr;
    var detailFactor;

    if (this.seriesName == "Series-A") {
      periodIncr = startMom.date() / 31.0; //1-31
      detailFactor = 50 + (Math.random() * 450);
    }
    else if (this.seriesName == "Series-B") {
      periodIncr = ((endMom.date() - 5) / 31.0) * 2; //1-31
      detailFactor = 150 + (Math.random() * 650);
    }
    else {
      periodIncr = Math.random();
      detailFactor = 20 + (Math.random() * 250);
    }

    var lastY = min;


    for (var i = 0; i < numPoints; i++) {
      if (Math.floor(currTime / period) != periodNum) {
        periodNum = Math.floor(currTime / period);
        periodIncr = moment(currTime).date() / 31.0;
        periodIncr = periodIncr * ((0.09) - (0.09 / 2));
      }
      else {

        if (lastY > (max + min) / 2)
          periodIncr = periodIncr - (lastY / (max + min)) * .000002;
        else
          periodIncr = periodIncr + ((max + min - lastY) / (max + min)) * .000002;
      }

      if (Math.floor(currTime / (period / 4) != periodNum)) {
        detailFactor = 50 + (Math.random() * 450);
      }


      lastY += periodIncr;
      if (lastY > max) {
        periodIncr = periodIncr * -1;
      }
      else if (lastY < min) {
        periodIncr = periodIncr * -1;
      }


      var detailY = lastY + (Math.random() - 0.5) * detailFactor;
//      if (detailY > max)
//        detailY = max;
//      if (detailY < min)
//        detailY = min;

      data.push({ x: currTime, y: detailY});
      currTime += minorInterval.valueOf();
    }

    this.serverData = data;

  }


}(window.JGS = window.JGS || {}, jQuery));