(function (JGS, $, undefined) {


  JGS.GraphDataProvider = function () {
    this.serverDataSims = {};
    this.newGraphDataCallbacks = $.Callbacks();

    this.lastRangeReqNum = 0;
    this.lastDetailReqNum = 0;
  };

  JGS.GraphDataProvider.prototype.loadData = function (seriesName, rangeStartDateTm, rangeEndDateTm, detailStartDateTm, detailEndDateTm, pixelWidth) {

    var serverDataSim = this.serverDataSims[seriesName];
    if (!serverDataSim) {
      serverDataSim = new JGS.ServerDataSimulator(seriesName);
      serverDataSim.onServerDataLoadCallbacks.add($.proxy(this._onServerDataLoad, this));
      this.serverDataSims[seriesName] = serverDataSim;
    }

    if (rangeStartDateTm && rangeEndDateTm) {
      this.rangeDataLoadComplete = false;
      // load range data
      var numRangeIntervals = pixelWidth / 2; // Downsample to num intervals = width in pixels / 2 ...so at most, draw one point every two pixels
      var rangeDataLoadReq = {
        reqType: "range",
        reqNum: ++this.lastRangeReqNum,
        startDateTm: rangeStartDateTm,
        endDateTm: rangeEndDateTm,
        numIntervals: numRangeIntervals,
        includeMinMax: true
      };
      this.lastRangeDataLoadReq = rangeDataLoadReq;
      serverDataSim.loadData(rangeDataLoadReq);
    }
    else {
      this.rangeDataLoadComplete = true;
    }

    // load detail data
    if (detailStartDateTm && detailEndDateTm) {
      this.detailDataLoadComplete = false;
      var numDetailsIntervals = pixelWidth / 2; // Downsample to num intervals = width in pixels / 2 ...so at most, draw one point every two pixels
      var detailDataLoadReq = {
        reqType: "detail",
        reqNum: ++this.lastDetailReqNum,
        startDateTm: detailStartDateTm,
        endDateTm: detailEndDateTm,
        numIntervals: numDetailsIntervals,
        includeMinMax: true
      };
      this.lastDetailDataLoadReq = detailDataLoadReq;
      serverDataSim.loadData(detailDataLoadReq);
    }
    else {
      this.detailDataLoadComplete = true;
    }
  };


  JGS.GraphDataProvider.prototype._onServerDataLoad = function (dataLoadReq, dataLoadResp) {

    console.log("_onServerDataLoad", dataLoadReq, dataLoadResp);

    if (dataLoadReq.reqType == 'detail') {
      if (this.lastDetailReqNum != dataLoadReq.reqNum) {
        return;  //discard because newer request was sent
      }
      else {
        this.lastDetailDataLoadResp = dataLoadResp;
        this.detailDataLoadComplete = true;
      }
    }
    else { //range
      if (this.lastRangeReqNum != dataLoadReq.reqNum) {
        return;  //discard because newer request was sent
      }
      else {
        this.lastRangeDataLoadResp = dataLoadResp;
        this.rangeDataLoadComplete = true;
      }
    }
    if (this.rangeDataLoadComplete && this.detailDataLoadComplete) {
      var splicedData = this._spliceRangeAndDetail(this.lastRangeDataLoadResp.dataPoints, this.lastDetailDataLoadResp.dataPoints);

      //Convert to dygraph native format
      var dyData = [];
      for (var i = 0; i < splicedData.length; i++) {
        if (dataLoadReq.includeMinMax)
          dyData.push([new Date(splicedData[i].x), [splicedData[i].min, splicedData[i].avg, splicedData[i].max]]);
        else
          dyData.push([new Date(splicedData[i].x), splicedData[i].y]);
      }

      var graphData = {
        dyData: dyData,
        detailStartDateTm: this.lastDetailDataLoadReq.startDateTm,
        detailEndDateTm: this.lastDetailDataLoadReq.endDateTm
      };

      this.newGraphDataCallbacks.fire(graphData);
    }

  };

  JGS.GraphDataProvider.prototype._spliceRangeAndDetail = function (rangeDps, detailDps) {

    var splicedDps = [];

    if (rangeDps.length == 0 && detailDps.length == 0) {
      // do nothing, no data
    } else if (detailDps.length == 0) {
      for (var i = 0; i < rangeDps.length; i++) {
        splicedDps.push(rangeDps[i]);
      }
    } else if (rangeDps.length == 0) { //should never happen?
      for (var i = 0; i < detailDps.length; i++) {
        splicedDps.push(detailDps[i]);
      }
    } else {
      var detailStartX = detailDps[0].x;
      var detailEndX = detailDps[detailDps.length - 1].x;

      var lastRangeIdx = -1;
      for (var i = 0; i < rangeDps.length; i++) {
        if (rangeDps[i].x >= detailStartX) {
          break;
        } else {
          lastRangeIdx++;
        }
      }

      //Insert 1st part of range
      if (lastRangeIdx >= 0) {
        splicedDps.push.apply(splicedDps, rangeDps.slice(0, lastRangeIdx + 1));
      }

      //Insert detail
      splicedDps.push.apply(splicedDps, detailDps.slice(0));

      //Insert last part of range
      var startEndRangeIdx = rangeDps.length;
      for (var i = startEndRangeIdx; i >= lastRangeIdx; i--) {
        if (i <= 1 || rangeDps[i - 1].x <= detailEndX) {
          break;
        } else {
          startEndRangeIdx--;
        }
      }

      if (startEndRangeIdx < rangeDps.length) {
        splicedDps.push.apply(splicedDps, rangeDps.slice(startEndRangeIdx, rangeDps.length));
      }

    }

    return splicedDps;
  }


}(window.JGS = window.JGS || {}, jQuery));