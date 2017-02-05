(function (JGS, $, undefined) {
  "use strict";

  /**
   This class provides javascript handling specific  to the example1 page. Most importantly, it provides the dygraphs
   setup and handling, including the handling of mouse-down/up events on the dygraphs range control element.

   @class Demo6Page
   @constructor
   */
  JGS.Demo6Page = function (pageCfg) {
    this.$graphCont = pageCfg.$graphCont;
    this.$rangeBtnsCont = pageCfg.$rangeBtnsCont;

    this.liveGraphDataProvider = new JGS.GraphDataProviderLive();
    this.liveGraphDataProvider.newGraphDataCallbacks.add($.proxy(this._onNewGraphData, this));

    this.isRangeSelectorActive = false;

    this.isMouseDown = false;
  };

  /**
   * Starts everything by requesting initial data load. For example's purposes, initial date extents are hardcoded.
   *
   * @method
   */
  JGS.Demo6Page.prototype.init = function () {
    this.showSpinner(true);

    this._setupRangeButtons();

    // Default range dates
    var rangeEndMom = moment().utc();
    this.rangeEndMom = rangeEndMom;

    var rangeStartMom = moment.utc(rangeEndMom).add('minute', -15);
    this.rangeStartMom = rangeStartMom;

    this.$rangeBtnsCont.find("button[name='range-btn-15min']").addClass('active');

    // Default detail dates
    var detailEndMom = moment(rangeEndMom);
    //detailEndMom.add('minute', -5);
    this.detailEndDateTm = detailEndMom.toDate(); //needed for the live data handler. Refactoring needed.

    var detailStartMom = moment(detailEndMom);
    detailStartMom.add('minute', -5);
    this.detailStartDateTm = detailStartMom.toDate();

    this._setupMouseButtonTrackingForLiveData();
    this.liveGraphDataProvider.loadData("Series-A", rangeStartMom.toDate(), rangeEndMom.toDate(), detailStartMom.toDate(), detailEndMom.toDate(), this.$graphCont.width());

    var self = this;
    $('.liveupdate-btn').on('click', function (evt) {
      var $btn = $(this);
      $btn.button('toggle');
      if ($btn.hasClass('active')) {
        $btn.addClass("btn-danger");
        $btn.removeClass("btn-success");
        $btn.text("Disable Live Updates");

        self.liveIntervalId = setInterval(function () {
          self.rangeEndMom = moment().utc();

          if (self.rangeEndMom.diff(moment(self.detailEndDateTm), "seconds") < 10) {
            self.detailEndDateTm = self.rangeEndMom.toDate();
          }

          self.liveGraphDataProvider.loadData("Series-A", self.rangeStartMom.toDate(), self.rangeEndMom.toDate(), self.detailStartDateTm, self.detailEndDateTm, self.$graphCont.width());
        }, 1000);

      }
      else {
        clearInterval(self.liveIntervalId);
        $btn.addClass("btn-success");
        $btn.removeClass("btn-danger");
        $btn.text("Enable Live Updates");
      }
    });

    // NOTE: These next two lines were added specifically for Example 6 to make the live data loading work as expected
    // upon page load. Without these lines, the detail window did stay current until the user clicked in the range
    // selector. I'm not sure why and it didn't some worthwhile to debug for demo. Refactoring is needed.
    this.$rangeBtnsCont.find("button[name='range-btn-15min']").trigger('click');
    this.detailStartDateTm = detailStartMom.toDate();

    $('.liveupdate-btn').trigger('click');

  };

  JGS.Demo6Page.prototype._setupRangeButtons = function () {
    var self = this;

    this.$rangeBtnsCont.children().on('click', function (evt) {
      evt.preventDefault();
      var rangeType = evt.target.name.toString().replace("range-btn-", "");

      self.$rangeBtnsCont.children().removeClass('active');

      $(this).addClass('active');

      var rangeEndMom;
      rangeEndMom = moment().utc();
      //    rangeEndMom.minutes(0).seconds(0);
//      rangeEndMom.add('hour', 1);

      //console.log("rangeType", rangeType);

      var rangeStartMom;
      if (rangeType == "5min") {
        rangeStartMom = moment.utc(rangeEndMom).add('minute', -5);
      } else if (rangeType == "15min") {
        rangeStartMom = moment.utc(rangeEndMom).add('minute', -15);
      } else if (rangeType == "1d") {
        rangeStartMom = moment.utc(rangeEndMom).add('week', -1);
      } else if (rangeType == "1m") {
        rangeStartMom = moment.utc(rangeEndMom).add('month', -1);
      } else if (rangeType == "6m") {
        rangeStartMom = moment.utc(rangeEndMom).add('month', -6);
      } else if (rangeType == "1y") {
        rangeStartMom = moment.utc(rangeEndMom).add('year', -1);
      } else if (rangeType == "5y") {
        rangeStartMom = moment.utc(rangeEndMom).add('year', -5);
      } else if (rangeType == "ytd") {
        rangeStartMom = moment().startOf('year').utc();
      }

      //For demo purposes, when range is reset, auto reset detail view to same extents as range
      self.detailStartDateTm = rangeStartMom.clone().toDate();
      self.detailEndDateTm = rangeEndMom.clone().toDate();

      self.rangeStartMom = rangeStartMom;
      self.rangeEndMom = rangeEndMom;

      self.showSpinner(true);
      self.liveGraphDataProvider.loadData("Series-A",
        self.rangeStartMom.toDate(),
        self.rangeEndMom.toDate(),
        self.detailStartDateTm,
        self.detailEndDateTm,
        self.$graphCont.width());

    });

  };


  /**
   * Setup mouse button down handling prevent redrawing graph while mouse is down and live data loading is enabled.
   *
   * @method _setupLiveDataMouseHandling
   * @private
   */
  JGS.Demo6Page.prototype._setupMouseButtonTrackingForLiveData = function () {
    var self = this;

    // Element used for tracking mouse up events
    this.$mouseUpEventEl = $(window);
    if ($.support.cssFloat == false) { //IE<=8, doesn't support mouse events on window
      this.$mouseUpEventEl = $(document.body);
    }

    //Install new mouse down handler
    this.$mouseUpEventEl.on("mousedown.jgslivedata touchstart.jgslivedata", function (evt) {
      self.isMouseDown = true;
    });

    //Install new mouse down handler
    this.$mouseUpEventEl.on("mouseup.jgslivedata touchend.jgslivedata", function (evt) {
      self.isMouseDown = false;
    });

  };

  /**
   * Internal method to add mouse down listener to dygraphs range selector.  Coded so that it can be called
   * multiple times without concern. Although not necessary for simple example (like example1), this becomes necessary
   * for more advanced examples when the graph must be recreated, not just updated.
   *
   * @method _setupRangeMouseHandling
   * @private
   */
  JGS.Demo6Page.prototype._setupRangeMouseHandling = function () {
    var self = this;

    // Element used for tracking mouse up events
    this.$mouseUpEventEl = $(window);
    if ($.support.cssFloat == false) { //IE<=8, doesn't support mouse events on window
      this.$mouseUpEventEl = $(document.body);
    }

    //Minor Hack...not sure how else to hook-in to dygraphs range selector events without modifying source. This is
    //where minor modification to dygraphs (range selector plugin) might make for a cleaner approach.
    //We only want to install a mouse up handler if mouse down interaction is started on the range control
    var $rangeEl = this.$graphCont.find('.dygraph-rangesel-fgcanvas, .dygraph-rangesel-zoomhandle');

    //Uninstall existing handler if already installed
    $rangeEl.off("mousedown.jgs touchstart.jgs");

    //Install new mouse down handler
    $rangeEl.on("mousedown.jgs touchstart.jgs", function (evt) {

      //Track that mouse is down on range selector
      self.isRangeSelectorActive = true;

      // Setup mouse up handler to initiate new data load
      self.$mouseUpEventEl.off("mouseup.jgs touchend.jgs"); //cancel any existing
      $(self.$mouseUpEventEl).on('mouseup.jgs touchend.jgs', function (evt) {
        self.$mouseUpEventEl.off("mouseup.jgs touchend.jgs");

        //Mouse no longer down on range selector
        self.isRangeSelectorActive = false;

        //Get the new detail window extents
        var graphAxisX = self.graph.xAxisRange();
        self.detailStartDateTm = new Date(graphAxisX[0]);
        self.detailEndDateTm = new Date(graphAxisX[1]);

        // Load new detail data
        self._loadNewDetailData();
      });

    });


  };

  /**
   * Internal method that provides a hook in to Dygraphs default pan interaction handling.  This is a bit of hack
   * and relies on Dygraphs' internals. Without this, pan interactions (holding SHIFT and dragging graph) do not result
   * in detail data being loaded.
   *
   * This method works by replacing the global Dygraph.Interaction.endPan method.  The replacement method
   * is global to all instances of this class, and so it can not rely on "self" scope.  To support muliple graphs
   * with their own pan interactions, we keep a circular reference to this object instance on the dygraphs instance
   * itself when creating it. This allows us to look up the correct page object instance when the endPan callback is
   * triggered. We use a global JGS.Demo6Page.isGlobalPanInteractionHandlerInstalled flag to make sure we only install
   * the global handler once.
   *
   * @method _setupPanInteractionHandling
   * @private
   */
  JGS.Demo6Page.prototype._setupPanInteractionHandling = function () {

    if (JGS.Demo6Page.isGlobalPanInteractionHandlerInstalled)
      return;
    else
      JGS.Demo6Page.isGlobalPanInteractionHandlerInstalled = true;

    //Save original endPan function
    var origEndPan = Dygraph.Interaction.endPan;

    //Replace built-in handling with our own function
    Dygraph.Interaction.endPan = function (event, g, context) {

      var myInstance = g.demoPageInstance;

      //Call the original to let it do it's magic
      origEndPan(event, g, context);

      //Extract new start/end from the x-axis

      //Note that this _might_ not work as is in IE8. If not, might require a setTimeout hack that executes these
      //next few lines after a few ms delay. Have not tested with IE8 yet.
      var axisX = g.xAxisRange();
      myInstance.detailStartDateTm = new Date(axisX[0]);
      myInstance.detailEndDateTm = new Date(axisX[1]);

      //Trigger new detail load
      myInstance._loadNewDetailData();
    };
    Dygraph.endPan = Dygraph.Interaction.endPan; //see dygraph-interaction-model.js
  };


  /**
   * Initiates detail data load request using last known zoom extents
   *
   * @method _loadNewDetailData
   * @private
   */
  JGS.Demo6Page.prototype._loadNewDetailData = function () {
    this.showSpinner(true);
    this.liveGraphDataProvider.loadData("Series-A", null, null, this.detailStartDateTm, this.detailEndDateTm, this.$graphCont.width());
  };

  /**
   * Callback handler when new graph data is available to be drawn
   *
   * @param graphData
   * @method _onNewGraphData
   * @private
   */
  JGS.Demo6Page.prototype._onNewGraphData = function (graphData) {
    this.drawDygraph(graphData);
    this.$rangeBtnsCont.css('visibility', 'visible');
    this.showSpinner(false);

  };

  /**
   * Main method for creating or updating dygraph control
   *
   * @param graphData
   * @method drawDygraph
   */
  JGS.Demo6Page.prototype.drawDygraph = function (graphData) {
    var dyData = graphData.dyData;
    var detailStartDateTm = graphData.detailStartDateTm;
    var detailEndDateTm = graphData.detailEndDateTm;

    // This will be needed later when supporting dynamic show/hide of multiple series
    var recreateDygraph = false;

    // To keep example1 simple, we just hard code the labels with one series
    var labels = ["time", "Series-A"];

    var useAutoRange = false; // normally configurable
    var expectMinMax = true; // normally configurable, but for demo easier to hardcode that min/max always available

    //Create the axes for dygraphs
    var axes = {};
    if (useAutoRange) {
      axes.y = {valueRange: null};
    } else {
      axes.y = {valueRange: [400, 1600]};
    }


    //Create new graph instance
    if (!this.graph || recreateDygraph) {

      var graphCfg = {
        axes: axes,
        labels: labels,
        customBars: expectMinMax,
        showRangeSelector: true,
        interactionModel: Dygraph.Interaction.defaultModel,
        //clickCallback: $.proxy(this._onDyClickCallback, this),
        connectSeparatedPoints: true,
        dateWindow: [detailStartDateTm.getTime(), detailEndDateTm.getTime()],
        drawCallback: $.proxy(this._onDyDrawCallback, this),
        zoomCallback: $.proxy(this._onDyZoomCallback, this),
        digitsAfterDecimal: 2,
        labelsDivWidth: "275"
      };
      this.graph = new Dygraph(this.$graphCont.get(0), dyData, graphCfg);

      this._setupRangeMouseHandling();
      this._setupPanInteractionHandling();

      //Store this object instance on the graph itself so we can later reference it for endPan callback handling
      this.graph.demoPageInstance = this;

    }
    //Update existing graph instance
    else {
      var graphCfg = {
        axes: axes,
        labels: labels,
        file: dyData,
        dateWindow: [detailStartDateTm.getTime(), detailEndDateTm.getTime()]
      };
      if (!this.isMouseDown && !this.isRangeSelectorActive) {
        this.graph.updateOptions(graphCfg);
      }
    }

  };

  JGS.Demo6Page.prototype._onDyDrawCallback = function (dygraph, is_initial) {
//      console.log("_onDyDrawCallback");
//
//    //IE8 does not have new dates at time of callback, so use timer hack
//    if ($.support.cssFloat == false) { //IE<=8
//      setTimeout(function (evt) {
//        var axisX = dygraph.xAxisRange();
//        var axisXStartDateTm = new Date(axisX[0]);
//        var axisXEndDateTm = new Date(axisX[1]);
//
//        this.detailStartDateTm = axisXStartDateTm;
//        this.detailEndDateTm = axisXEndDateTm;
//      }, 250);
//      return;
//    }
//
//    var axisX = dygraph.xAxisRange();
//    var axisXStartDateTm = new Date(axisX[0]);
//    var axisXEndDateTm = new Date(axisX[1]);
//
//    this.detailStartDateTm = axisXStartDateTm;
//    this.detailEndDateTm = axisXEndDateTm;

  };

  /**
   * Dygraphs zoom callback handler
   *
   * @method _onDyZoomCallback
   * @private
   */
  JGS.Demo6Page.prototype._onDyZoomCallback = function (minDate, maxDate, yRanges) {
    //console.log("_onDyZoomCallback");

    if (this.graph == null)
      return;

    this.detailStartDateTm = new Date(minDate);
    this.detailEndDateTm = new Date(maxDate);

    //When zoom reset via double-click, there is no mouse-up event in chrome (maybe a bug?),
    //so we initiate data load directly
    if (this.graph.isZoomed('x') === false) {
      this.$mouseUpEventEl.off("mouseup.jgs touchend.jgs"); //Cancel current event handler if any
      this._loadNewDetailData();
      return;
    }

    //Check if need to do IE8 workaround
    if ($.support.cssFloat == false) { //IE<=8
      // ie8 calls drawCallback with new dates before zoom. This example currently does not implement the
      // drawCallback, so this example might not work in IE8 currently. This next line _might_ solve, but will
      // result in duplicate loading when drawCallback is added back in.
      this._loadNewDetailData();
      return;
    }

    //The zoom callback is called when zooming via mouse drag on graph area, as well as when
    //dragging the range selector bars. We only want to initiate dataload when mouse-drag zooming. The mouse
    //up handler takes care of loading data when dragging range selector bars.
    var doDataLoad = !this.isRangeSelectorActive;
    if (doDataLoad === true)
      this._loadNewDetailData();

  };

  /**
   * Helper method for showing/hiding spin indicator. Uses spin.js, but this method could just as easily
   * use a simple "data is loading..." div.
   *
   * @method showSpinner
   */
  JGS.Demo6Page.prototype.showSpinner = function (show) {
    if (show === true) {

      var target = this.$graphCont.get(0);

      if (this.spinner == null) {
        var opts = {
          lines: 13, // The number of lines to draw
          length: 7, // The length of each line
          width: 6, // The line thickness
          radius: 10, // The radius of the inner circle
          corners: 1, // Corner roundness (0..1)
          rotate: 0, // The rotation offset
          color: '#000', // #rgb or #rrggbb
          speed: 1, // Rounds per second
          trail: 60, // Afterglow percentage
          shadow: false, // Whether to render a shadow
          hwaccel: false, // Whether to use hardware acceleration
          className: 'spinner', // The CSS class to assign to the spinner
          zIndex: 2e9 // The z-index (defaults to 2000000000)
        };

        this.spinner = new Spinner(opts);
        this.spinner.spin(target);
        this.spinnerIsSpinning = true;
      } else {
        if (this.spinnerIsSpinning === false) { //else already spinning
          this.spinner.spin(target);
          this.spinnerIsSpinning = true;
        }
      }
    } else if (this.spinner != null && show === false) {
      this.spinner.stop();
      this.spinnerIsSpinning = false;
    }

  };

}(window.JGS = window.JGS || {}, jQuery));