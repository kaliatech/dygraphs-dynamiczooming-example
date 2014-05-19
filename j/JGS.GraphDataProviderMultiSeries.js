(function (JGS, $, undefined) {
  "use strict";
  /**
   This class is more generic version of JGS.GraphDataProvider and is able to handle multiple series.

   This class is used to acquire, aggregate, splice, and convert data to be fed to dygraphs.  The handling
   of data will be different for each project and is heavily dependent on the downsampling methods, backend service API,
   etc.  Generally though, the expectation is that JavaScript clients are able to make one or more calls to get the following
   data sets:

   - range-data-avg
   - range-data-min
   - range-data-max

   - detail-data-avg
   - detail-data-min
   - detail-data-max

   Depending on backend API, this could mean six distinct HTTP calls, or just one.  In this example, the API is
   structured such that a single API call with start date, end date, & downsampling level, provides a dataset
   that includes avg/min/min values in a single response.  As a result, the example  initially has to make two calls
   to get data; one for the range datasets, and one for the detail datasets.  It has to make these calls for each series
   to be displayed.  This class is responsible for waiting until all datasets of all series are available before
   continuing.

   After the initial loads, only detailed datasets need to be loaded if the graph range does not change. Data loads are
   often delayed. Users might be initiating or changing zoom extents even before responses have been received.  Because
   of that, this class is also responsible for making sure only the most recent request/response gets used. All others
   are discarded. That is the purpose of "reqNum" parameter in the requests.

   Once data is available, this class splices the range and detail to generate a single spliced data set per series. It
   then combines all series in to a single dataset with a common time base (x-axis) that is useable by dygraphs.

   @class GraphDataProviderMultiSeries
   @constructor
   */
  JGS.GraphDataProviderMultiSeries = function () {
    this.serverDataSims = {};
    this.newGraphDataCallbacks = $.Callbacks();

    this.lastRangeReqNum = 0;
    this.lastDetailReqNum = 0;

    // This is used to track that all series have been loaded. In a production system, this might not be robust
    // enough as-is because the system should also watch for errors, handle timeouts, etc. But for demo purposes...
    this.seriesNames = [];
    this.seriesDataHolders = {};
    this.numSeriesRequested = 0;
    this.numSeriesLoaded = 0;
  };

  /**
   Initiates data load requests for 1 or more series. The rangeStartDateTm and rangeEndDateTm parameters are optional. If null, then only
   new detail data will be loaded, and the result spliced with most recent existing range data.  Callbacks are not initiated
   until all series have been loaded.

   @method loadData
   */
  JGS.GraphDataProviderMultiSeries.prototype.loadData = function (seriesConfigs, rangeStartDateTm, rangeEndDateTm, detailStartDateTm, detailEndDateTm, pixelWidth) {
    //console.log("loadData", seriesConfigs);
    //console.log("loadData", this);


    var prevSeriesDataHolders = this.seriesDataHolders;

    // Each loadData request will effectively cancel out any previous requests, even if they
    // have not yet returned.
    this.seriesNames.length = 0;
    this.seriesDataHolders = {};
    this.numSeriesRequested = seriesConfigs.length;
    this.numSeriesLoaded = 0;

    var i;
    for (i = 0; i < seriesConfigs.length; i++) {
      var seriesConfig = seriesConfigs[i];
      var seriesName = seriesConfig.seriesName;
      var seriesDataHolder = {};
      this.seriesNames.push(seriesName);
      this.seriesDataHolders[seriesConfig.seriesName] = seriesDataHolder;


      //Construct server data provider/simulator if needed for the requested series
      var serverDataSim = this.serverDataSims[seriesName];
      if (!serverDataSim) {
        serverDataSim = new JGS.ServerDataSimulator(seriesName);
        serverDataSim.onServerDataLoadCallbacks.add($.proxy(this._onServerDataLoad, this));
        this.serverDataSims[seriesName] = serverDataSim;
      }

      // loading range data is optional, and it not reloaded when changing only the detail
      if (!rangeStartDateTm || !rangeEndDateTm) {
        seriesDataHolder.rangeDataLoadComplete = true;
        if (prevSeriesDataHolders[seriesName]) {
          seriesDataHolder.lastRangeDataLoadResp = prevSeriesDataHolders[seriesName].lastRangeDataLoadResp;
        }
      }
      else { //if (rangeStartDateTm && rangeEndDateTm) {

        seriesDataHolder.rangeDataLoadComplete = false;

        //This determines how many points we load (and so how much downsampling is being asked for).
        //This might be specific to each project and require some knowledge of the underlying data purpose.
        var numRangeIntervals = pixelWidth / 2; // ...so at most, downsample to one point every two pixels in the range selector

        var rangeDataLoadReq = {
          seriesName: seriesName,
          reqType: "range",
          reqNum: ++this.lastRangeReqNum,
          startDateTm: rangeStartDateTm,
          endDateTm: rangeEndDateTm,
          numIntervals: numRangeIntervals,
          includeMinMax: true
        };
        seriesDataHolder.lastRangeDataLoadReq = rangeDataLoadReq;
        serverDataSim.loadData(rangeDataLoadReq);
      }

      // load detail data ...also coded optional, but never used as optional because we don't range extents without changing detail extents
      if (detailStartDateTm && detailEndDateTm) {
        seriesDataHolder.detailDataLoadComplete = false;

        //This determines how many points we load (and so how much downsampling is being asked for).
        //This might be specific to each project and require some knowledge of the underlying data purpose.
        var numDetailsIntervals = pixelWidth / 2; // ...so at most, downsample to one point every two pixels in the graph

        var detailDataLoadReq = {
          seriesName: seriesName,
          reqType: "detail",
          reqNum: ++this.lastDetailReqNum,
          startDateTm: detailStartDateTm,
          endDateTm: detailEndDateTm,
          numIntervals: numDetailsIntervals,
          includeMinMax: true
        };
        seriesDataHolder.lastDetailDataLoadReq = detailDataLoadReq;
        serverDataSim.loadData(detailDataLoadReq);
      }
      else {
        seriesDataHolder.detailDataLoadComplete = true;
      }
    }
  };

  /**
   Callback handler for server data load response. Will discard responses if newer requests were made in the meantime.
   Responsible for making sure all data (detail & range for all series) has been received before triggering callbacks.

   @method _onServerDataLoad
   @private
   */
  JGS.GraphDataProviderMultiSeries.prototype._onServerDataLoad = function (dataLoadReq, dataLoadResp) {
    //console.log("_onServerDataLoad", dataLoadReq, dataLoadResp);
    //console.log("_onServerDataLoad", this);

    var seriesDataHolder = this.seriesDataHolders[dataLoadReq.seriesName];
    if (!seriesDataHolder)
      return;

    if (dataLoadReq.reqType == 'detail') {
      if (seriesDataHolder.lastDetailDataLoadReq.reqNum != dataLoadReq.reqNum) {
        return;  //discard because newer request was sent
      }
      else {
        seriesDataHolder.lastDetailDataLoadResp = dataLoadResp;
        seriesDataHolder.detailDataLoadComplete = true;
      }
    }
    else { //range
      if (seriesDataHolder.lastRangeDataLoadReq.reqNum != dataLoadReq.reqNum) {
        return;  //discard because newer request was sent
      }
      else {
        seriesDataHolder.lastRangeDataLoadResp = dataLoadResp;
        seriesDataHolder.rangeDataLoadComplete = true;
      }
    }
    if (seriesDataHolder.rangeDataLoadComplete && seriesDataHolder.detailDataLoadComplete) {

      this.numSeriesLoaded++;

      // Do not continue until we have range and detail for all series
      if (this.numSeriesLoaded != this.numSeriesRequested) {
        return;
      }

      //Splice the range and detail datasets for each series
      var seriesDps = [];
      for (var seriesIdx = 0; seriesIdx < this.numSeriesLoaded; seriesIdx++) {
        var seriesDataHolder = this.seriesDataHolders[this.seriesNames[seriesIdx]];
        seriesDataHolder.splicedData = this._spliceRangeAndDetail(seriesDataHolder.lastRangeDataLoadResp.dataPoints, seriesDataHolder.lastDetailDataLoadResp.dataPoints);
        seriesDps.push(seriesDataHolder.splicedData);
      }

      // Combine all of the series splices in to a single dataset useable by dygraphs.
      var combinedSeriesData = this._combineSeries(seriesDps, this.seriesDataHolders);

      // Trigger the callbacks
      var graphData = {
        dyData: combinedSeriesData,
        detailStartDateTm: seriesDataHolder.lastDetailDataLoadReq.startDateTm,
        detailEndDateTm: seriesDataHolder.lastDetailDataLoadReq.endDateTm
      };

      this.newGraphDataCallbacks.fire(graphData);
    }

  };

  /**
   Splices the range data set, with detail data set, to come-up with a single spliced dataset. See documentation
   for explanation.  There might be more efficient ways to code it.

   @method _spliceRangeAndDetail
   @private
   */
  JGS.GraphDataProviderMultiSeries.prototype._spliceRangeAndDetail = function (rangeDps, detailDps) {

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

      // Find last data point index in range where-after detail data will be inserted
      var lastRangeIdx = this._findLastRangeIdxBeforeDetailStart(rangeDps, detailStartX);

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
  };

  /**
   Finds last index in the range data set before the first detail data value.  Uses binary search per suggestion
   by Benoit Person (https://github.com/ddr2) in Dygraphs mailing list.

   @method _findLastRangeIdxBeforeDetailStart
   @private
   */
  JGS.GraphDataProviderMultiSeries.prototype._findLastRangeIdxBeforeDetailStart = function (rangeDps, firstDetailTime) {

    var minIndex = 0;
    var maxIndex = rangeDps.length - 1;
    var currentIndex;
    var currentElement;

    // Handle out of range cases
    if (rangeDps.length == 0 || firstDetailTime <= rangeDps[0].x)
      return -1;
    else if (rangeDps[rangeDps.length - 1].x < firstDetailTime)
      return rangeDps.length - 1;

    // Use binary search to find index of data point in range data that occurs immediately before firstDetailTime
    while (minIndex <= maxIndex) {
      currentIndex = Math.floor((minIndex + maxIndex) / 2);
      currentElement = rangeDps[currentIndex];

      if (currentElement.x < firstDetailTime) {
        minIndex = currentIndex + 1;

        //we want previous point, and will not often have an exact match due to different sampling intervals
        if (rangeDps[minIndex].x > firstDetailTime) {
          return currentIndex;
        }
      }
      else if (currentElement.x > firstDetailTime) {
        maxIndex = currentIndex - 1;

        //we want previous point, and will not often have an exact match due to different sampling intervals
        if (rangeDps[maxIndex].x < firstDetailTime) {
          return currentIndex - 1;
        }

      }
      else {
        return currentIndex - 1; //if exact match, we use previous range data point
      }

    }

    return -1;

  };

  /**
   Combines (aka merges) multiple datasets of {x,[min,avg,max]} values into a single dataset with a common x axis. The
   input series do not have to have matching x (time) values. This method will insert nulls where needed to provide a
   format useable by dygraphs even if the time axis does not align between series as it goes through and merges the
   series.

   To better understand things: If there are 3 series, they all have the same number of points, and they all have the same
   x value for each point, then the combined dataset returned by this method will have exactly the same number of points
   as any one of the datasets. However, if one of the series has x values that are never the same as x values in the other
   two series, then combined dataset is going to have a total length  of (EitherOfTheSamesSeries.length +
   DifferentSeries.length) ...the set of all unique x values.

   This method has gone through a number of iterations with too much copy-and-paste, and is due for major refactoring.
   I'm almost embarrassed to post it, but I also don't feel like refactoring it just for a demo. It's more important for
   any interested parties to understand the fundamentals of what this method is doing rather than the code itself.

   @method _combineSeries
   @private
   */
  JGS.GraphDataProviderMultiSeries.prototype._combineSeries = function (seriesNames, seriesDataHolders) {
    //console.log("_combineSeries", seriesDataHolders);

    var dyDataRows = [];

    for (var seriesIdx = 0; seriesIdx < seriesNames.length; seriesIdx++) {

      var seriesName = this.seriesNames[seriesIdx];
      var seriesDataHolder = seriesDataHolders[seriesName];
      var dps = seriesDataHolder.splicedData;

      var newDyDataRows = [];

      var nextDataRowInsertIdx = 0;
      for (var dataPointIdx = 0; dataPointIdx < dps.length; dataPointIdx++) {

        var dp = dps[dataPointIdx];

        if (nextDataRowInsertIdx < dyDataRows.length) {
          var nextDataRowCols = dyDataRows[nextDataRowInsertIdx];
          var nextDataRowDateTm = nextDataRowCols[0];
          var nextDataRowX = nextDataRowDateTm.getTime();
        }

        if (nextDataRowInsertIdx >= dyDataRows.length || dp.x < nextDataRowX) {
          var newDataRowCols = [new Date(dp.x)];
          for (var colIdx = 0; colIdx < seriesIdx; colIdx++) {
            newDataRowCols.push([null, null, null]);
          }
          newDataRowCols.push([dp.min, dp.avg, dp.max]);

          //if min/max optional, do test and use:
          //newDataRowCols.push([null, dp.avg, null]);

          newDyDataRows.push(newDataRowCols);
        } else if (dp.x > nextDataRowX) {

          var newDataRowCols = nextDataRowCols.slice(0);
          newDataRowCols.push([null, null, null]);
          newDyDataRows.push(newDataRowCols);
          nextDataRowInsertIdx++;
          dataPointIdx--;
        } else { //(dp.x == nextDataRowX) {

          var newDataRowCols = nextDataRowCols.slice(0);

          newDataRowCols.push([dp.min, dp.avg, dp.max]);

          //if min/max optional, do test and use:
          //newDataRowCols.push([null, dp.avg, null]);

          newDyDataRows.push(newDataRowCols);
          nextDataRowInsertIdx++;
        }

      }

      //insert any remaining existing rows
      for (var i = nextDataRowInsertIdx; i < dyDataRows.length; i++) {
        nextDataRowCols = dyDataRows[i];
        nextDataRowDateTm = nextDataRowCols[0];

        newDataRowCols = nextDataRowCols.slice(0);
        newDataRowCols.push([null, null, null]);
        newDyDataRows.push(newDataRowCols);
      }

      dyDataRows = newDyDataRows;

    }

    return dyDataRows;
  };


}(window.JGS = window.JGS || {}, jQuery));