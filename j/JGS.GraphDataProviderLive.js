(function (JGS, $, undefined) {
  "use strict";
  /**
   * This class simply wraps JGS.GraphDataProvider, but uses a JGS.ServerDataSimulatorLive to support example #6.
   *
   @class GraphDataProviderLive
   @constructor
   */
  JGS.GraphDataProviderLive = function () {
    this.serverDataSims = {};
    this.graphDataProvider = new JGS.GraphDataProvider();
    this.newGraphDataCallbacks = this.graphDataProvider.newGraphDataCallbacks;
  };

  /**
   Initiates data load request. The rangeStartDateTm and rangeEndDateTm parameters are optional. If null, then only
   new detail data will be loaded, and the result spliced with most recent existing range data.
   @method loadData
  */
  JGS.GraphDataProviderLive.prototype.loadData = function (seriesName, rangeStartDateTm, rangeEndDateTm, detailStartDateTm, detailEndDateTm, pixelWidth) {

    //Construct server data provider/simulator if needed for the requested series
    var serverDataSim = this.serverDataSims[seriesName];
    if (!serverDataSim) {
        serverDataSim = new JGS.ServerDataSimulatorLive(seriesName);
        serverDataSim.onServerDataLoadCallbacks.add($.proxy(this._onServerDataLoad, this));
        this.serverDataSims[seriesName] = serverDataSim;
        this.graphDataProvider.serverDataSims[seriesName] = serverDataSim;
    }

    this.graphDataProvider.loadData.apply(this.graphDataProvider, arguments);
  };

  JGS.GraphDataProviderLive.prototype._onServerDataLoad = function (dataLoadReq, dataLoadResp) {
    this.graphDataProvider._onServerDataLoad.call(this.graphDataProvider, dataLoadReq, dataLoadResp);
  };

}(window.JGS = window.JGS || {}, jQuery));