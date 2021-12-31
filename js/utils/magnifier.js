/**
 * @file magnifier.js A custom magnifier for this app - based loosely on https://github.com/picturae/OpenSeadragonMagnifier
 * @author Melinda Minch
 **/

(function ($) {
    "use strict";

    //At some browser magnification levels the display regions lines up correctly, but at some there appears to
    //be a one pixel gap.
    const fudge = new $.Point(1, 1);
    const checkboxId = "magnifier__show-in-viewer";
    const activeClass = "magnifier--active";
    const inactiveClass = "magnifier--inactive";
    const roundId = "magnifier__round";

    class Magnifier {
        constructor(mainViewer, options) {
            this.mainViewer = mainViewer;
            this.ratio = options.magnificationRatio;
            this.element = document.getElementById(options.id);
            this.element.id = options.id;
            this.showInViewer = document.getElementById(checkboxId).checked;
            this.round = document.getElementById(roundId).checked;
            this.markers = [];
            this.visibleMarkers = {};
            this.metrics = document.getElementById(options.id + "__metrics");

            options = $.extend(
                true,
                {
                    minPixelRatio: this.mainViewer.minPixelRatio,
                    defaultZoomLevel:
                        this.mainViewer.viewport.getZoom() * this.ratio,
                },
                options,
                {
                    element: this.element,
                    showNavigator: false,
                    showNavigationControl: false,
                    showSequenceControl: false,
                    immediateRender: true,
                    blendTime: 0,
                    animationTime: 0,
                    autoResize: options.autoResize,
                    // prevent resizing the magnifier from adding unwanted space around the image
                    minZoomImageRatio: 1,
                }
            );

            this.displayRegion = $.makeNeutralElement("div");
            this.displayRegion.id = this.element.id + "-displayregion";
            this.displayRegion.className = "displayregion";
            this.displayRegion.style.width = this.startingWidth + "px";
            this.displayRegion.style.height = this.startingHeight + "px";

            // Styles for both of these have to be here or they will be
            // overridden.
            this.regionMoveHangle = $.makeNeutralElement("div");
            this.regionMoveHangle.className = "displayregion__move";
            this.regionMoveHangle.style.position = "absolute";
            this.regionMoveHangle.style.top = "-20px";
            this.regionMoveHangle.style.left = "-20px";
            this.regionMoveHangle.style.width = "20px";
            this.regionMoveHangle.style.height = "20px";
            this.regionMoveHangle.style.cursor = "move";
            this.regionMoveHangle.style.background = "rgba(0, 0, 0, 0.5)";
            this.regionMoveHangle.style.border = "1px solid #000";
            new $.MouseTracker({
                element: this.regionMoveHangle,
                dragHandler: $.delegate(this, this.moveRegion),
            });

            this.regionResizeHangle = $.makeNeutralElement("div");
            this.regionResizeHangle.className = "displayregion__resize";
            this.regionResizeHangle.style.position = "absolute";
            this.regionResizeHangle.style.bottom = "-5px";
            this.regionResizeHangle.style.right = "-5px";
            this.regionResizeHangle.style.width = "10%";
            this.regionResizeHangle.style.height = "10%";
            this.regionResizeHangle.style.maxWidth = "50px";
            this.regionResizeHangle.style.maxHeight = "50px";
            this.regionResizeHangle.style.cursor = "se-resize";
            this.regionResizeHangle.style.background = "#ccc";
            new $.MouseTracker({
                element: this.regionResizeHangle,
                dragHandler: $.delegate(this, this.resizeRegion),
            });

            this.displayRegionContainer = $.makeNeutralElement("div");
            this.displayRegionContainer.id =
                this.element.id + "-displayregioncontainer";
            this.displayRegionContainer.className = "displayregioncontainer";
            this.displayRegionContainer.style.width = "0";
            this.displayRegionContainer.style.height = "0";

            this.inViewerElement = $.makeNeutralElement("div");
            this.inViewerElement.id = this.element.id + "--inline";
            this.inViewerElement.className =
                "magnifier magnifier--square magnifier--inline";

            if (this.showInViewer) {
                $.addClass(this.inViewerElement, activeClass);
                $.addClass(this.element, inactiveClass);
                $.addClass(this.regionResizeHangle, activeClass);
                $.addClass(this.regionMoveHangle, activeClass);
            } else {
                $.addClass(this.inViewerElement, inactiveClass);
                $.addClass(this.element, activeClass);
                $.addClass(this.regionResizeHangle, inactiveClass);
                $.addClass(this.regionMoveHangle, inactiveClass);
            }

            this.displayRegion.appendChild(this.regionMoveHangle);
            this.displayRegion.appendChild(this.regionResizeHangle);
            this.displayRegion.appendChild(this.inViewerElement);
            this.displayRegionContainer.appendChild(this.displayRegion);
            this.mainViewer.canvas.appendChild(this.displayRegionContainer);

            $.setElementTouchActionNone(this.element);
            $.setElementTouchActionNone(this.inViewerElement);

            this.borderWidth = 4; // in pixels

            this.totalBorderWidths = new $.Point(
                this.borderWidth * 2,
                this.borderWidth * 2
            ).minus(fudge);

            this.viewer = $(options);
            // The same thing again, but inside the viewer instead of outside.
            this.inlineViewer = $(
                $.extend(options, {
                    element: this.inViewerElement,
                })
            );

            (function (style, borderWidth) {
                style.position = "absolute";
                style.border = borderWidth + "px solid #333";
                style.margin = "0px";
                style.padding = "0px";
            })(this.displayRegion.style, this.borderWidth);

            if (this.round) {
                $.addClass(this.element, "round");
                $.addClass(this.displayRegion, "round");
            }

            const self = this;
            this.mainViewer.addHandler("zoom", function (event) {
                self.update(false, event.refPoint);
            });
            this.mainViewer.addHandler("pan", function () {
                self.update(true); // bring the overlay viewer along if you pan the underlying main viewer
            });

            this.mainViewer.addHandler("update-level", function () {
                self.update(true);
            });

            this.mainViewer.addHandler("resize", function () {
                self.update(true);
            });

            this.mainViewer.world.addHandler("update-viewport", function () {
                self.update(true);
            });

            this.mainViewer.addHandler("canvas-click", function (event) {
                // we want to catch clicks, not drags
                if (event.quick) {
                    event.preventDefaultAction = true;
                    self.clickToZoom(event);
                }
            });

            this.viewer.addHandler("animation-finish", function () {
                self.showVisibleMarkerCounts();
            });

            this.inlineViewer.addHandler("animation-finish", function () {
                self.showVisibleMarkerCounts();
            });

            document
                .getElementById(checkboxId)
                .addEventListener("change", function () {
                    self.toggleInViewer();
                });

            document
                .querySelectorAll('input[name="magnifier__shape"]')
                .forEach(function (input) {
                    input.addEventListener("change", function () {
                        self.toggleShape();
                    });
                });

            this.update();
            this.showVisibleMarkerCounts();
        }

        clickToZoom(event) {
            // Center the magnifiers on a click target, to make
            // it easy to look at annotated cells.
            const target =
                this.mainViewer.viewport.viewerElementToViewportCoordinates(
                    event.position
                );

            this.viewer.viewport.panTo(target);
            this.inlineViewer.viewport.panTo(target);

            let bounds, top, left, width, height;

            if (this.showInViewer) {
                bounds = this.inlineViewer.viewport.getBounds();

                // put the center of the display region on top of the click target;

                height = parseInt(this.displayRegion.style.height, 10);
                width = parseInt(this.displayRegion.style.width, 10);
                top = event.position.y - height / 2;
                left = event.position.x - width / 2;

                this.viewer.viewport.fitBounds(bounds);
            } else {
                bounds = this.viewer.viewport.getBounds();

                const bottomright = this.mainViewer.viewport
                    .pixelFromPoint(bounds.getBottomRight(), true)
                    .minus(this.totalBorderWidths);

                const topleft = this.mainViewer.viewport.pixelFromPoint(
                    bounds.getTopLeft(),
                    true
                );

                width = Math.abs(topleft.x - bottomright.x);
                height = Math.abs(topleft.y - bottomright.y);
                top = topleft.y;
                left = topleft.x;

                this.inlineViewer.viewport.fitBounds(bounds);
            }
            this.updateDisplayRegionStyle(top, left, width, height);
        }

        moveRegion(event) {
            var top = parseInt(this.displayRegion.style.top, 10);
            var left = parseInt(this.displayRegion.style.left, 10);

            this.updateDisplayRegionStyle(
                top + event.delta.y,
                left + event.delta.x
            );
            this.inlineViewer.viewport.panBy(
                this.mainViewer.viewport.deltaPointsFromPixels(event.delta)
            );
            this.viewer.viewport.fitBounds(
                this.inlineViewer.viewport.getBounds(),
                true
            );
        }

        resizeRegion(event) {
            // First, get some actual viewer coordinates so we can preserve the image
            // position in the viewer on resize. We can't just use
            // options.preserveImageSizeOnResize because of the way the
            // app behaves the rest of the time, but we can put its behavior here.
            var oldBounds = this.inlineViewer.viewport.getBounds(true);
            var oldTopleft = this.mainViewer.viewport.pixelFromPoint(
                oldBounds.getTopLeft(),
                true
            );
            var oldBottomright = this.mainViewer.viewport.pixelFromPoint(
                oldBounds.getBottomRight(),
                true
            );

            // then, resize the actual element that contains the overlay viewer
            const viewerSize = $.getElementSize(this.mainViewer.element);
            const width = parseInt(this.displayRegion.style.width, 10);
            const height = parseInt(this.displayRegion.style.height, 10);

            let newWidth = width + event.delta.x;
            newWidth = Math.min(newWidth, viewerSize.x * 0.75);
            newWidth = Math.max(newWidth, 100); // to preserve some sanity

            let newHeight = height + event.delta.y;
            newHeight = Math.min(newHeight, viewerSize.y * 0.75);
            newHeight = Math.max(newHeight, 100);

            this.updateDisplayRegionStyle(null, null, newWidth, newHeight);

            var newBounds = this.inlineViewer.viewport.getBounds();

            var newTopleft = this.mainViewer.viewport.pixelFromPoint(
                newBounds.getTopLeft(),
                true
            );
            var newBottomright = this.mainViewer.viewport.pixelFromPoint(
                newBounds.getBottomRight(),
                true
            );

            // then set the overlay magnifier accordingly
            const resizeRatio =
                Math.abs(oldTopleft.x - oldBottomright.x) /
                Math.abs(newTopleft.x - newBottomright.x);

            const zoom = Math.min(
                this.inlineViewer.viewport.getZoom() * resizeRatio,
                this.mainViewer.viewport.getZoom() * this.ratio
            );
            this.inlineViewer.viewport.zoomTo(zoom, undefined, true);

            var xBounds = this.inlineViewer.viewport.getBounds();

            var left = parseInt(this.displayRegion.style.left, 10)
            var top = parseInt(this.displayRegion.style.top, 10)

            // This is in coordinates relative to the main viewer.
            var bounds_rect = new $.Rect(
                left,
                top,
                newWidth,
                newHeight
            );
            const center =
                this.mainViewer.viewport.viewerElementToViewportCoordinates(
                    bounds_rect.getCenter()
                );
            this.inlineViewer.viewport.panTo(center);
            this.viewer.viewport.fitBounds(xBounds);
        }

        updateDisplayRegionStyle(top, left, width, height) {
            var style = this.displayRegion.style;
            style.display = this.viewer.world.getItemCount() ? "block" : "none";

            // make sure these are non-negative so IE doesn't throw
            if (top) {
                style.top = Math.round(Math.max(top, 0)) + "px";
            }
            if (left) {
                style.left = Math.round(Math.max(left, 0)) + "px";
            }
            if (width) {
                style.width = Math.round(Math.max(width, 0)) + "px";
            }
            if (height) {
                style.height = Math.round(Math.max(height, 0)) + "px";
            }
        }

        update(pinOverlay = false, refPoint = null) {
            const viewerSize = $.getElementSize(this.viewer.element);
            const inlineViewerSize = $.getElementSize(
                this.inlineViewer.element
            );

            if (
                this.mainViewer.viewport &&
                this.viewer.viewport &&
                this.inlineViewer.viewport
            ) {
                // things we always want to do
                const zoomTarget =
                    this.mainViewer.viewport.getZoom() * this.ratio;

                this.viewer.viewport.zoomTo(zoomTarget, refPoint);
                this.inlineViewer.viewport.zoomTo(zoomTarget, refPoint);

                var bounds, bottomright, topleft, width, height, center;

                if (this.showInViewer) {
                    // Event handing for when the inline magnifier is active
                    var bounds = this.inlineViewer.viewport.getBounds(true);

                    var bottomright = this.mainViewer.viewport
                        .pixelFromPoint(bounds.getBottomRight(), true)
                        .minus(this.totalBorderWidths);

                    var topleft = this.mainViewer.viewport.pixelFromPoint(
                        bounds.getTopLeft(),
                        true
                    );

                    width = Math.min(Math.abs(topleft.x - bottomright.x), 100);
                    height = Math.min(Math.abs(topleft.y - bottomright.y), 100);

                    if (pinOverlay) {
                        center = this.mainViewer.viewport.getCenter();
                    } else {
                        // the center of the overlay magnifier is at whatever
                        // is in the center of its display region, on the main
                        // viewer. We're using layers, but they are all the same
                        // size for this purpose, so just pick one.

                        // This is in coordinates relative to the main viewer.
                        var bounds_rect = new $.Rect(
                            topleft.x,
                            topleft.y,
                            width,
                            height
                        );

                        // Translate those into viewport coordinates for the inline viewer.
                        center =
                            this.mainViewer.viewport.viewerElementToViewportCoordinates(
                                bounds_rect.getCenter()
                            );
                    }
                } else {
                    // inline / overlay viewer is invisibly pinned to the sidebar viewer

                    var bounds = this.viewer.viewport.getBounds(true);
                    var bottomright = this.mainViewer.viewport
                        .pixelFromPoint(bounds.getBottomRight(), true)
                        .minus(this.totalBorderWidths);

                    var topleft = this.mainViewer.viewport.pixelFromPoint(
                        bounds.getTopLeft(),
                        true
                    );

                    width = Math.abs(topleft.x - bottomright.x);
                    height = Math.abs(topleft.y - bottomright.y);
                    center = this.mainViewer.viewport.getCenter();

                    this.updateDisplayRegionStyle(
                        topleft.y,
                        topleft.x,
                        width,
                        height
                    );
                }
                this.viewer.viewport.panTo(center);
                this.inlineViewer.viewport.panTo(center);
            }
        }

        toggleInViewer() {
            if (this.showInViewer) {
                this.showInViewer = false;
                $.removeClass(this.inViewerElement, activeClass);
                $.addClass(this.inViewerElement, inactiveClass);
                this.inlineViewer.setVisible(false);
                $.removeClass(this.element, inactiveClass);
                $.addClass(this.element, activeClass);
                $.removeClass(this.regionResizeHangle, activeClass);
                $.removeClass(this.regionMoveHangle, activeClass);
                $.addClass(this.regionResizeHangle, inactiveClass);
                $.addClass(this.regionMoveHangle, inactiveClass);

                var bounds = this.viewer.viewport.getBounds(true);

                var bottomright = this.mainViewer.viewport
                    .pixelFromPoint(bounds.getBottomRight(), true)
                    .minus(this.totalBorderWidths);

                var topleft = this.mainViewer.viewport.pixelFromPoint(
                    bounds.getTopLeft(),
                    true
                );

                const width = Math.abs(topleft.x - bottomright.x);
                const height = Math.abs(topleft.y - bottomright.y);

                this.updateDisplayRegionStyle(
                    topleft.y,
                    topleft.x,
                    width,
                    height
                );
                //re-sync the inline viewer to this, invisibly
                this.inlineViewer.viewport.panTo(bounds.getCenter());
            } else {
                this.showInViewer = true;

                // make it a bit bigger so it shows the same things,
                // just on top of the main viewer
                var bounds = this.viewer.viewport.getBounds(true);

                var bottomright = this.mainViewer.viewport
                    .pixelFromPoint(bounds.getBottomRight(), true)
                    .minus(this.totalBorderWidths);

                var topleft = this.mainViewer.viewport.pixelFromPoint(
                    bounds.getTopLeft(),
                    true
                );

                const width = Math.abs(topleft.x - bottomright.x);
                const height = Math.abs(topleft.y - bottomright.y);

                // How much bigger does each side of the square
                // need to be in order to accommodate an overlay
                // magnifier at the same zoom level?
                const factor = Math.log2(this.ratio);

                const expandedWidth = width * factor;
                const expandedHeight = height * factor;

                this.updateDisplayRegionStyle(
                    topleft.y - expandedHeight / 4,
                    topleft.x - expandedWidth / 4,
                    expandedWidth,
                    expandedHeight
                );

                this.inlineViewer.viewport.panTo(bounds.getCenter());

                $.addClass(this.regionResizeHangle, activeClass);
                $.addClass(this.regionMoveHangle, activeClass);
                $.removeClass(this.regionResizeHangle, inactiveClass);
                $.removeClass(this.regionMoveHangle, inactiveClass);
                $.removeClass(this.inViewerElement, inactiveClass);
                $.addClass(this.inViewerElement, activeClass);
                this.inlineViewer.setVisible(true);
                this.inlineViewer.forceRedraw();
                $.removeClass(this.element, activeClass);
                $.addClass(this.element, inactiveClass);
            }
        }

        toggleShape() {
            if (this.round) {
                $.removeClass(this.element, "round");
                $.removeClass(this.displayRegion, "round");
                this.round = false;
            } else {
                $.addClass(this.element, "round");
                $.addClass(this.displayRegion, "round");
                this.round = true;
            }
        }

        _createSuccessCallback(i, viewer) {
            return function (i) {
                const layer0X = viewer.world.getItemAt(0).getContentSize().x;
                const layerNX = viewer.world
                    .getItemAt(viewer.world.getItemCount() - 1)
                    .getContentSize().x;
                viewer.world
                    .getItemAt(viewer.world.getItemCount() - 1)
                    .setWidth(layerNX / layer0X);
            };
        }

        addLayer(url_suffix, opacity, layerName, tileSource, i) {
            url_suffix = url_suffix ? url_suffix : "";

            this.viewer.addTiledImage({
                index: i + 1,
                tileSource: url_suffix + tileSource,
                opacity: opacity,
                success: this._createSuccessCallback(i, this.viewer),
            });

            this.inlineViewer.addTiledImage({
                index: i + 1,
                tileSource: url_suffix + tileSource,
                opacity: opacity,
                success: this._createSuccessCallback(i, this.inlineViewer),
            });
        }

        /**
         * Takes a list of markers from dataUtils and make them easily findable based on whether they are
         * visible in the current viewport.
         * **/
        buildMarkerList(processed_markers) {
            processed_markers.forEach((m) => {
                const point = new $.Point(m["viewer_X_pos"], m["viewer_Y_pos"]);
                this.markers.push({
                    point: point,
                    letters: m["letters"],
                    name: m["gene_name"],
                });
                this.visibleMarkers[
                    dataUtils.getKeyFromString(m["gene_name"])
                ] = 0;
            });
        }

        /**
         *  Gets the names and barcodes of markers that are in the current visible
         *  viewport.
         **/

        showVisibleMarkerCounts() {
            // First, reset our counts
            Object.keys(this.visibleMarkers).forEach((k) => {
                this.visibleMarkers[k] = 0;
            });
            let viewport = this.viewer.viewport;
            if (this.showInViewer) {
                viewport = this.inlineViewer.viewport;
            }
            const bounds = viewport.getBounds(false);
            this.markers.forEach((m) => {
                const name = dataUtils.getKeyFromString(m.name);
                if (
                    bounds.containsPoint(m.point) &&
                    markerUtils._checkBoxes[name].checked
                ) {
                    if (name in this.visibleMarkers) {
                        this.visibleMarkers[name] += 1;
                    }
                }
            });
            Object.keys(this.visibleMarkers).forEach((k) => {
                const countElement = document.getElementById(
                    "metrics__count--" + k
                );
                countElement.innerText = this.visibleMarkers[k];
            });
        }
    }
    window.Magnifier = Magnifier;
})(OpenSeadragon);
