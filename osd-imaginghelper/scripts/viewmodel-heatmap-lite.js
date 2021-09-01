(function () {
	/* global $,OpenSeadragon,ko */

	var appTitle = 'OpenSeadragon Imaging';
	var appDesc = 'OpenSeadragonImagingHelper / OpenSeadragonViewerInputHook Plugins';

	$(window).resize(onWindowResize);
	$(window).resize();

	// var tileSourcesPrefix = './data/';
	// var tileSources = [
	// 	tileSourcesPrefix + 'testpattern.dzi',
	// 	tileSourcesPrefix + 'tall.dzi',
	// 	tileSourcesPrefix + 'wide.dzi',
	// 	new OpenSeadragon.LegacyTileSource( [{
	// 		url: tileSourcesPrefix + 'dog_radiograph_2.jpg',
	// 		width: 1909,
	// 		height: 1331
	// 	}] )
	// ];
	
	var viewer = OpenSeadragon({
		// debugMode: true,
		id: 'viewerDiv1',
		prefixUrl: 'content/images/openseadragon/',
		useCanvas: true,
		autoResize: false, // If false, we have to handle resizing of the viewer
		// blendTime: 0,
		// wrapHorizontal: true,
		// visibilityRatio: 0.1,
		// minZoomLevel: 0.001,
		// maxZoomLevel: 10,
		// zoomPerClick: 1.4,
		//------------------
		showNavigationControl: true,
		navigationControlAnchor: OpenSeadragon.ControlAnchor.BOTTOM_LEFT,
		//------------------
		showNavigator: true,
		// navigatorSizeRatio: 0.25,
		navigatorId: 'navigatorDiv1',
		navigatorAutoResize: false,
		//------------------
		sequenceMode: true,
		// initialPage: 1,
		// preserveViewport: true,
		// preserveOverlays: false,
		showSequenceControl: true,
		sequenceControlAnchor: OpenSeadragon.ControlAnchor.BOTTOM_LEFT,
		// showReferenceStrip: false,
		// referenceStripScroll: 'horizontal',
		// referenceStripElement: null,
		// referenceStripHeight: null,
		// referenceStripWidth: null,
		// referenceStripPosition: 'BOTTOM_LEFT',
		// referenceStripSizeRatio: 0.2,
		//------------------
		collectionMode: false,
		// collectionLayout: 'horizontal',
		collectionRows: 2,
		collectionColumns: 2,
		// collectionTileSize: 800,
		// collectionTileMargin: 80,
		//------------------
		// tileSources: tileSources
        tileSources:   {
            height: 81548,
            width:  107999,
            tileSize: 256,
            minLevel: 0,
            maxLevel: 9,
            getTileUrl: function( level, x, y ){
                return "http://127.0.0.1:8001/wsisvs/getCvImage/" + "/" + "c91a842257ed2add5134" +
                "/" + "256" + "/" + level + "/" + y + "/" + x;
            }
        }
	});
	// eslint-disable-line no-unused-vars
	var imagingHelper = viewer.activateImagingHelper({
		worldIndex: 0,
		onImageViewChanged: onImageViewChanged
	});
	// eslint-disable-line no-unused-vars
	var viewerInputHook = viewer.addViewerInputHook({hooks: [
		// {tracker: 'viewer', handler: 'moveHandler', hookHandler: onHookOsdViewerMove},
		// {tracker: 'viewer', handler: 'scrollHandler', hookHandler: onHookOsdViewerScroll},
		// {tracker: 'viewer', handler: 'clickHandler', hookHandler: onHookOsdViewerClick}
	]});
	var _$osdCanvas = null;
	var _$svgOverlay = $('.imgvwrSVG');

	// Example SVG annotation overlay.  We use these observables to keep the example annotation sync'd with the image zoom/pan
	var annoGroupTranslateX = ko.observable(0.0),
		annoGroupTranslateY = ko.observable(0.0),
		annoGroupScale = ko.observable(1.0),
		annoGroupTransform = ko.computed(function () {
			return 'translate(' + annoGroupTranslateX() + ',' + annoGroupTranslateY() + ') scale(' + annoGroupScale() + ')';
		}, this);

	viewer.addHandler('open', function (event) {
		_$osdCanvas = $(viewer.canvas);
		setMinMaxZoomForImage();
		outputVM.haveImage(true);
		_$osdCanvas.on('mouseenter.osdimaginghelper', onOsdCanvasMouseEnter);
		_$osdCanvas.on('mousemove.osdimaginghelper', onOsdCanvasMouseMove);
		_$osdCanvas.on('mouseleave.osdimaginghelper', onOsdCanvasMouseLeave);
		updateImageVM();
		updateImgViewerViewVM();
		updateImgViewerDataCoordinatesVM();

		// _$navExpander.css( 'visibility', 'visible');
		// if (_navExpanderIsCollapsed) {
		// 	_navExpanderDoCollapse(false);
		// }
		// else {
		// 	_navExpanderDoExpand(true);
		// }

		_$svgOverlay.css( 'visibility', 'visible');
//***************************************************************** */
		// var elt = document.createElement("div");
		// elt.className = "overlay";
		// elt.style.overlay = "border:thin solid blue";
		// elt.style.background = 'rgba(0,0,255,0.25)';
		// var dimensions = viewer.source.dimensions;
		// // var rect = viewer.viewport.imageToViewportRectangle( new OpenSeadragon.Rect(0, 0, dimensions.x/2, dimensions.y/2));
		// var rect = new OpenSeadragon.Rect(0.33, 0.33, 0.25, 0.25);
		// // viewer.addOverlay({
		// // 	element: elt,
		// // 	location: viewer.viewport.imageToViewportRectangle( new OpenSeadragon.Rect(0, 0, dimensions.x, dimensions.y) )
		// // });
		// viewer.addOverlay(elt, rect);

		// // Example OpenSeadragon overlay
		// var olDiv = document.createElement('div');
		// olDiv.style.background = 'rgba(0,0,255,0.25)';
		// // var olRect = new OpenSeadragon.Rect(-0.1, -0.1, 1.2, 1.0 / viewer.viewport.getAspectRatio() + 0.2);
		// var olRect = new OpenSeadragon.Rect(10000, 10000, 100, 100);
		// //var olRect = new OpenSeadragon.Rect(-0.5, -0.5, 2.0, 1.0 / event.viewer.source.aspectRatio + 1.0);
		// viewer.addOverlay(olDiv, olRect);

		// Example
		// var boundBoxRect = viewport.imageToViewportRectangle(
		// 	boundBox.x, boundBox.y, boundBox.width, boundBox.height);
		// var boundBoxOverlay = $("<div id=\"overlay-boundbox-colony-" + colony + "\"></div>");
		// boundBoxOverlay.css({
		// 	border: "2px solid " + color
		// });
		// // drawer.addOverlay(boundBoxOverlay.get(0), boundBoxRect);
		// viewer.addOverlay(boundBoxOverlay.get(0), boundBoxRect);

		// Example OpenSeadragon overlay
		// var img = document.createElement('img');
		// var img2 = document.createElement('img');
		// img.src = 'content/images/openseadragon/next_rest.png';
		// img2.src = 'content/images/openseadragon/next_rest.png';

		// var point = new OpenSeadragon.Point(0.5, 0.5);
		// var point2 = new OpenSeadragon.Point(0.25, 0.5);
		// // viewer.drawer.addOverlay(img, point);
		// viewer.addOverlay(img, point);
		// viewer.addOverlay(img2, point2);

		//Heatmap OSD Overlay
		var elt = document.createElement("div");
		elt.className = "runtime-overlay";
		elt.style.background = "white";
		elt.style.opacity = "0.5";
		elt.style.outline = "5px solid pink";
		elt.style.width = "100px";
		elt.style.height = "100px";
		elt.textContent = "Test Box - Scalled, Centered in Middle";
		viewer.addOverlay({
			element: elt,
			location: new OpenSeadragon.Point(0.5, 0.5),
			placement: OpenSeadragon.Placement.CENTER,
			checkResize: false,
			rotationMode: OpenSeadragon.OverlayRotationMode.EXACT
		});
		var heatmap_cfg = {backgroundColor: 'rgba(0,0,0,0)',maxOpacity: 0.5,minOpacity: 0.25}
		var heatmap_data = gen_heatmap_data(ds_size = 1000, hs_radius=20, hs_intensity = 1);
		var heatmap = new HeatmapOverlay(viewer, heatmap_cfg);
		// heatmap.setData(heatmap_data)
		viewer.addOverlay(heatmap.setData(heatmap_data));
		
	});

	// viewer.addHandler('close', function (event) {
	// 	_$navExpander.css( 'visibility', 'hidden');
	// 	_$svgOverlay.css( 'visibility', 'hidden');
	// 	outputVM.haveImage(false);
	// 	_$osdCanvas.off('mouseenter.osdimaginghelper', onOsdCanvasMouseEnter);
	// 	_$osdCanvas.off('mousemove.osdimaginghelper', onOsdCanvasMouseMove);
	// 	_$osdCanvas.off('mouseleave.osdimaginghelper', onOsdCanvasMouseLeave);
	// 	_$osdCanvas = null;
	// });

	function gen_heatmap_data(ds_size, hs_radius, hs_intensity){
			// now generate some random data
			var points = [];
			var max = 0;
			var width = 80000;
			var height = 60000;
			// var len = 300;
			var len = ds_size;

			while (len--) {
			//   var val = Math.floor(Math.random()*100);
				// var val = 10;
				var val = hs_intensity;
				// now also with custom radius
			//   var radius = Math.floor(Math.random()*70);
				// var radius = 5;
				var radius = hs_radius;

				max = Math.max(max, val);
				var point = {
				x: Math.floor(Math.random()*width),
				y: Math.floor(Math.random()*height),
				value: val,
				// radius configuration on point basis
				radius: radius
				};
				points.push(point);
			}
			// heatmap data format
			var data = {
				max: max,
				data: points
			};
			return data;	
		};
	

	function setMinMaxZoomForImage() {
		var minzoomX = 50.0 / imagingHelper.imgWidth;
		var minzoomY = 50.0 / imagingHelper.imgHeight;
		var minZoom = Math.min(minzoomX, minzoomY);
		var maxZoom = 10.0;
		imagingHelper.setMinZoom(minZoom);
		imagingHelper.setMaxZoom(maxZoom);
		imagingHelper.setZoomStepPercent(35);
		
	}

	function onImageViewChanged(event) {
		// // event.viewportWidth == width of viewer viewport in logical coordinates relative to image native size
		// // event.viewportHeight == height of viewer viewport in logical coordinates relative to image native size
		// // event.viewportOrigin == OpenSeadragon.Point, top-left of the viewer viewport in logical coordinates relative to image
		// // event.viewportCenter == OpenSeadragon.Point, center of the viewer viewport in logical coordinates relative to image
		// // event.zoomFactor == current zoom factor
		// updateImgViewerViewVM();
		// updateImgViewerScreenCoordinatesVM();
		// updateImgViewerDataCoordinatesVM();

		// Example SVG annotation overlay - keep the example annotation sync'd with the image zoom/pan
		//var p = viewer.viewport.pixelFromPoint(new OpenSeadragon.Point(0, 0), true);
		var p = imagingHelper.logicalToPhysicalPoint(new OpenSeadragon.Point(0, 0));
		annoGroupTranslateX(p.x);
		annoGroupTranslateY(p.y);
		annoGroupScale(imagingHelper.getZoomFactor());
		// alert(imagingHelper.getZoomFactor());

		//Set hotspt radius
		var zoomfact = imagingHelper.getZoomFactor()
		// console.log(zoomfact);

		// switch (true) {
		// 	// If score is 90 or greater
		// 	case zoomfact <= 0.010:
		// 		// console.log(zoomfact);
		// 		hs_radius = 15;
		// 		break;
		// 	case zoomfact >= 0.0010:
		// 		// console.log(zoomfact);
		// 		hs_radius = 5;
		// };
		// console.log(hs_radius);
		//Heatmap OSD Overlay
		// var heatmap_cfg = {backgroundColor: 'rgba(0,0,0,0)',maxOpacity: 0.5,minOpacity: 0.05}
		// var heatmap_data = gen_heatmap_data(ds_size = 1000, hs_radius, hs_intensity = 10);
		// var heatmap = new HeatmapOverlay(viewer, heatmap_cfg);
		// heatmap.setData(heatmap_data)
		// // viewer.addOverlay(heatmap.setData(heatmap_data));

	}

	function onHookOsdViewerMove(event) {
		// set event.stopHandlers = true to prevent any more handlers in the chain from being called
		// set event.stopBubbling = true to prevent the original event from bubbling
		// set event.preventDefaultAction = true to prevent viewer's default action
		outputVM.osdMouseRelativeX(event.position.x);
		outputVM.osdMouseRelativeY(event.position.y);
		event.stopHandlers = true;
		event.stopBubbling = true;
		event.preventDefaultAction = true;
	}

	function onHookOsdViewerScroll(event) {
		// set event.stopHandlers = true to prevent any more handlers in the chain from being called
		// set event.stopBubbling = true to prevent the original event from bubbling
		// set event.preventDefaultAction = true to prevent viewer's default action
		var logPoint = imagingHelper.physicalToLogicalPoint(event.position);
		if (event.scroll > 0) {
			imagingHelper.zoomInAboutLogicalPoint(logPoint);
		}
		else {
			imagingHelper.zoomOutAboutLogicalPoint(logPoint);
		}
		event.stopBubbling = true;
		event.preventDefaultAction = true;
	}

	function onHookOsdViewerClick(event) {
		// set event.stopHandlers = true to prevent any more handlers in the chain from being called
		// set event.stopBubbling = true to prevent the original event from bubbling
		// set event.preventDefaultAction = true to prevent viewer's default action
		if (event.quick) {
			var logPoint = imagingHelper.physicalToLogicalPoint(event.position);
			if (event.shift) {
				imagingHelper.zoomOutAboutLogicalPoint(logPoint);
			}
			else {
				imagingHelper.zoomInAboutLogicalPoint(logPoint);
			}
		}
		event.stopBubbling = true;
		event.preventDefaultAction = true;
	}

	function onOsdCanvasMouseEnter(event) {
		outputVM.haveMouse(true);
		updateImgViewerScreenCoordinatesVM();
	}

	function onOsdCanvasMouseMove(event) {
		var osdmouse = OpenSeadragon.getMousePosition(event),
			osdoffset = OpenSeadragon.getElementOffset(viewer.canvas);
		outputVM.osdMousePositionX(osdmouse.x);
		outputVM.osdMousePositionY(osdmouse.y);
		outputVM.osdElementOffsetX(osdoffset.x);
		outputVM.osdElementOffsetY(osdoffset.y);

		var offset = _$osdCanvas.offset();
		outputVM.mousePositionX(event.pageX);
		outputVM.mousePositionY(event.pageY);
		outputVM.elementOffsetX(offset.left);
		outputVM.elementOffsetY(offset.top);
		outputVM.mouseRelativeX(event.pageX - offset.left);
		outputVM.mouseRelativeY(event.pageY - offset.top);
		updateImgViewerScreenCoordinatesVM();
	}

	function onOsdCanvasMouseLeave(event) {
		outputVM.haveMouse(false);
	}

	function updateImageVM() {
		if (outputVM.haveImage()) {
			outputVM.imgWidth(imagingHelper.imgWidth);
			outputVM.imgHeight(imagingHelper.imgHeight);
			outputVM.imgAspectRatio(imagingHelper.imgAspectRatio);
			outputVM.minZoom(imagingHelper.getMinZoom());
			outputVM.maxZoom(imagingHelper.getMaxZoom());
		}
	}

	function updateImgViewerViewVM() {
		if (outputVM.haveImage()) {
			var containerSize = viewer.viewport.getContainerSize();
			outputVM.osdContainerWidth(containerSize.x);
			outputVM.osdContainerHeight(containerSize.y);
			outputVM.osdZoom(viewer.viewport.getZoom(true));

			var boundsRect = viewer.viewport.getBounds(true);
			outputVM.osdBoundsX(boundsRect.x);
			outputVM.osdBoundsY(boundsRect.y);
			outputVM.osdBoundsWidth(boundsRect.width);
			outputVM.osdBoundsHeight(boundsRect.height);

			var tiledImage = viewer.world.getItemAt(0);
			var boundsTiledImageRect = tiledImage.getBounds(true);
			outputVM.osdTiledImageBoundsX(boundsTiledImageRect.x);
			outputVM.osdTiledImageBoundsY(boundsTiledImageRect.y);
			outputVM.osdTiledImageBoundsWidth(boundsTiledImageRect.width);
			outputVM.osdTiledImageBoundsHeight(boundsTiledImageRect.height);

			outputVM.zoomFactor(imagingHelper.getZoomFactor());
			outputVM.viewportWidth(imagingHelper._viewportWidth);
			outputVM.viewportHeight(imagingHelper._viewportHeight);
			outputVM.viewportOriginX(imagingHelper._viewportOrigin.x);
			outputVM.viewportOriginY(imagingHelper._viewportOrigin.y);
			outputVM.viewportCenterX(imagingHelper._viewportCenter.x);
			outputVM.viewportCenterY(imagingHelper._viewportCenter.y);
		}
	}

	function updateImgViewerScreenCoordinatesVM() {
		if (outputVM.haveImage() && outputVM.haveMouse()) {
			var logX = imagingHelper.physicalToLogicalX(outputVM.mouseRelativeX());
			var logY = imagingHelper.physicalToLogicalY(outputVM.mouseRelativeY());
			outputVM.physicalToLogicalX(logX);
			outputVM.physicalToLogicalY(logY);
			outputVM.logicalToPhysicalX(imagingHelper.logicalToPhysicalX(logX));
			outputVM.logicalToPhysicalY(imagingHelper.logicalToPhysicalY(logY));
			var dataX = imagingHelper.physicalToDataX( outputVM.mouseRelativeX());
			var dataY = imagingHelper.physicalToDataY( outputVM.mouseRelativeY());
			outputVM.physicalToDataX(dataX);
			outputVM.physicalToDataY(dataY);
			outputVM.dataToPhysicalX(imagingHelper.dataToPhysicalX(dataX));
			outputVM.dataToPhysicalY(imagingHelper.dataToPhysicalY(dataY));
		}
	}

	function updateImgViewerDataCoordinatesVM() {
		if (outputVM.haveImage()) {
			outputVM.logicalToDataTLX(imagingHelper.logicalToDataX(0.0));
			outputVM.logicalToDataTLY(imagingHelper.logicalToDataY(0.0));
			outputVM.logicalToDataBRX(imagingHelper.logicalToDataX(1.0));
			outputVM.logicalToDataBRY(imagingHelper.logicalToDataY(1.0));
			outputVM.dataToLogicalTLX(imagingHelper.dataToLogicalX(0));
			outputVM.dataToLogicalTLY(imagingHelper.dataToLogicalY(0));
			outputVM.dataToLogicalBRX(imagingHelper.dataToLogicalX(imagingHelper.imgWidth));
			outputVM.dataToLogicalBRY(imagingHelper.dataToLogicalY(imagingHelper.imgHeight));
		}
	}

	function onWindowResize() {
		var headerheight = $('.shell-header-wrapper').outerHeight(true);
		var footerheight = $('.shell-footer-wrapper').outerHeight(true);
		//var shellheight = $('.shell-wrapper').innerHeight();
		//var contentheight = shellheight - (headerheight + footerheight);
		$('.shell-view-wrapper').css('top', headerheight);
		$('.shell-view-wrapper').css('bottom', footerheight);

		$('.viewer-container').css('height', $('.output-container').height());

		if (viewer && imagingHelper && !viewer.autoResize) {
			// We're handling viewer resizing ourselves. Let the ImagingHelper do it.
			imagingHelper.notifyResize();
		}
	}

	// _$navExpanderHeaderContainer.on('click', null, function (event) {
	// 	if (_navExpanderIsCollapsed) {
	// 		_navExpanderExpand();
	// 	}
	// 	else {
	// 		_navExpanderCollapse();
	// 	}
	// });

	// function _navExpanderMakeResizable() {
	// 	_$navExpander.resizable({
	// 		disabled: false,
	// 		handles: 'e, s, se',
	// 		minWidth: 100,
	// 		minHeight: 100,
	// 		maxWidth: null,
	// 		maxHeight: null,
	// 		containment: '#theImageViewerContainer',
	// 		resize: function (event, ui) {
	// 			_navExpanderWidth = ui.size.width;
	// 			_navExpanderHeight = ui.size.height;
	// 			_navExpanderResizeContent();
	// 		}
	// 	});
	// }

	// function _navExpanderRemoveResizable() {
	// 	_$navExpander.resizable('destroy');
	// }

	// function _navExpanderDoExpand(adjustresizable) {
	// 	if (adjustresizable) {
	// 		_navExpanderMakeResizable();
	// 	}
	// 	_$navExpander.width(_navExpanderWidth);
	// 	_$navExpander.height(_navExpanderHeight);
	// 	_$navExpanderContentContainer.show('fast', function () {
	// 		_navExpanderResizeContent();
	// 	});
	// 	_$navExpander.css('opacity', _navExpanderExpandedOpacity);
	// }

	// function _navExpanderDoCollapse(adjustresizable) {
	// 	_$navExpander.css('opacity', _navExpanderCollapsedOpacity);
	// 	_$navExpanderContentContainer.hide('fast');
	// 	_$navExpander.width(_navExpanderCollapsedWidth);
	// 	_$navExpander.height(_navExpanderCollapsedHeight);
	// 	_navExpanderResizeContent();
	// 	if (adjustresizable) {
	// 		_navExpanderRemoveResizable();
	// 	}
	// }

	// function _navExpanderExpand() {
	// 	if (_navExpanderIsCollapsed) {
	// 		_navExpanderDoExpand(true);
	// 		_navExpanderIsCollapsed = false;
	// 	}
	// }

	// function _navExpanderCollapse() {
	// 	if (!_navExpanderIsCollapsed) {
	// 		_navExpanderDoCollapse(true);
	// 		_navExpanderIsCollapsed = true;
	// 	}
	// }

	// function _navExpanderResizeContent() {
	// 	var wrapperwidth = _$navExpander.innerWidth();
	// 	var wrapperheight = _$navExpander.innerHeight();
	// 	var headerheight = _$navExpanderHeaderContainer ? _$navExpanderHeaderContainer.outerHeight(true) : 0;
	// 	var newheight = wrapperheight - headerheight;
	// 	_$navExpanderContentContainer.width(wrapperwidth);
	// 	_$navExpanderContentContainer.height(newheight);
	// 	viewer.navigator.updateSize();
	// 	viewer.navigator.update(viewer.viewport);
	// }

	var outputVM = {
		haveImage: ko.observable(false),
		haveMouse: ko.observable(false),
		imgWidth: ko.observable(0),
		imgHeight: ko.observable(0),
		imgAspectRatio: ko.observable(0),
		minZoom: ko.observable(0),
		maxZoom: ko.observable(0),
		osdContainerWidth: ko.observable(0),
		osdContainerHeight: ko.observable(0),
		osdZoom: ko.observable(0),
		osdBoundsX: ko.observable(0),
		osdBoundsY: ko.observable(0),
		osdBoundsWidth: ko.observable(0),
		osdBoundsHeight: ko.observable(0),
		osdMousePositionX: ko.observable(0),
		osdMousePositionY: ko.observable(0),
		osdElementOffsetX: ko.observable(0),
		osdElementOffsetY: ko.observable(0),
		osdMouseRelativeX: ko.observable(0),
		osdMouseRelativeY: ko.observable(0),
		osdTiledImageBoundsX: ko.observable(0),
		osdTiledImageBoundsY: ko.observable(0),
		osdTiledImageBoundsWidth: ko.observable(0),
		osdTiledImageBoundsHeight: ko.observable(0),
		zoomFactor: ko.observable(0),
		viewportWidth: ko.observable(0),
		viewportHeight: ko.observable(0),
		viewportOriginX: ko.observable(0),
		viewportOriginY: ko.observable(0),
		viewportCenterX: ko.observable(0),
		viewportCenterY: ko.observable(0),
		mousePositionX: ko.observable(0),
		mousePositionY: ko.observable(0),
		elementOffsetX: ko.observable(0),
		elementOffsetY: ko.observable(0),
		mouseRelativeX: ko.observable(0),
		mouseRelativeY: ko.observable(0),
		physicalToLogicalX: ko.observable(0),
		physicalToLogicalY: ko.observable(0),
		logicalToPhysicalX: ko.observable(0),
		logicalToPhysicalY: ko.observable(0),
		physicalToDataX: ko.observable(0),
		physicalToDataY: ko.observable(0),
		dataToPhysicalX: ko.observable(0),
		dataToPhysicalY: ko.observable(0),
		logicalToDataTLX: ko.observable(0),
		logicalToDataTLY: ko.observable(0),
		logicalToDataBRX: ko.observable(0),
		logicalToDataBRY: ko.observable(0),
		dataToLogicalTLX: ko.observable(0),
		dataToLogicalTLY: ko.observable(0),
		dataToLogicalBRX: ko.observable(0),
		dataToLogicalBRY: ko.observable(0)
	};

	var svgOverlayVM = {
		annoGroupTransform: annoGroupTransform
	};

	var vm = {
		appTitle: ko.observable(appTitle),
		appDesc: ko.observable(appDesc),
		outputVM: ko.observable(outputVM),
		svgOverlayVM: ko.observable(svgOverlayVM)
	};

	ko.applyBindings(vm);

}());