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
            this.markers = {};
            this.visibleMarkers = {};
            this.metrics = document.getElementById(options.id + "__metrics");
            this.borderWidth = 4; // in pixels
            this.minWidth = 100;

            this.totalBorderWidths = new $.Point(
                this.borderWidth * 2,
                this.borderWidth * 2
            ).minus(fudge);

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

            // The magnifier outline and overlay magnifier
            this.displayRegion = $.makeNeutralElement("div");
            this.displayRegion.id = this.element.id + "-displayregion";
            this.displayRegion.className = "displayregion";
            this.displayRegion.style.width = this.startingWidth + "px";
            this.displayRegion.style.height = this.startingHeight + "px";
            this.displayRegion.style.position = "absolute";
            this.displayRegion.style.border =
                this.borderWidth + "px solid #333";
            this.displayRegion.style.margin = "0";
            this.displayRegion.style.padding = "0";

            // Move and resize controls for the overlay magnifier.
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

            // Invisible container for the overlay magnifier and controls
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

            if (this.round) {
                $.addClass(this.element, "round");
                $.addClass(this.displayRegion, "round");
            }

            this.displayRegion.appendChild(this.regionMoveHangle);
            this.displayRegion.appendChild(this.regionResizeHangle);
            this.displayRegion.appendChild(this.inViewerElement);
            this.displayRegionContainer.appendChild(this.displayRegion);
            this.mainViewer.canvas.appendChild(this.displayRegionContainer);

            $.setElementTouchActionNone(this.element);
            $.setElementTouchActionNone(this.inViewerElement);

            // Actually instantiate the magnifier viewers now
            this.viewer = $(options);
            // The same thing again, but inside the viewer instead of outside.
            this.inlineViewer = $(
                $.extend(options, {
                    element: this.inViewerElement,
                })
            );

            // Move and resize handlers
            new $.MouseTracker({
                element: this.regionMoveHangle,
                dragHandler: $.delegate(this, this.moveRegion),
            });

            new $.MouseTracker({
                element: this.regionResizeHangle,
                dragHandler: $.delegate(this, this.resizeRegion),
            });

            // OSD event handlers for the magnifiers and main viewers
            const self = this;
            this.mainViewer.addHandler("zoom", function (event) {
                self.mainViewerZoom(event.refPoint);
            });
            this.mainViewer.addHandler("canvas-drag", function (event) {
                // I'd listen to pan, but this gives us a delta, which gives
                // more information about how to position the display region.
                self.mainViewerPan(event);
            });

            this.mainViewer.addHandler("update-level", function () {
                self.update();
            });

            this.mainViewer.addHandler("resize", function () {
                self.update();
            });

            this.mainViewer.world.addHandler("update-viewport", function () {
                self.update();
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

            // Event handlers for magnifier controls
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

        updateDisplayRegionFromBounds(bounds) {
            const bottomright = this.mainViewer.viewport
                .pixelFromPoint(bounds.getBottomRight(), true)
                .plus(this.totalBorderWidths);

            const topleft = this.mainViewer.viewport.pixelFromPoint(
                bounds.getTopLeft(),
                true
            );

            let width = Math.abs(topleft.x - bottomright.x);
            let height = Math.abs(topleft.y - bottomright.y);

            if (this.showInViewer) {
                width = Math.max(width, this.minWidth);
                height = Math.max(height, this.minWidth);
            }

            this.updateDisplayRegionStyle(topleft.y, topleft.x, width, height);
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

            let bounds;

            if (this.showInViewer) {
                bounds = this.inlineViewer.viewport.getBounds();

                // put the center of the display region on top of the click target;

                const height = parseInt(this.displayRegion.style.height, 10);
                const width = parseInt(this.displayRegion.style.width, 10);
                const top = event.position.y - height / 2;
                const left = event.position.x - width / 2;

                this.viewer.viewport.fitBounds(bounds);
                this.updateDisplayRegionStyle(top, left, width, height);
            } else {
                bounds = this.viewer.viewport.getBounds();

                this.updateDisplayRegionFromBounds(bounds);
                this.inlineViewer.viewport.fitBounds(bounds);
            }
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

            var left = parseInt(this.displayRegion.style.left, 10);
            var top = parseInt(this.displayRegion.style.top, 10);

            // This is in coordinates relative to the main viewer.
            var bounds_rect = new $.Rect(left, top, newWidth, newHeight);
            const center =
                this.mainViewer.viewport.viewerElementToViewportCoordinates(
                    bounds_rect.getCenter()
                );
            this.inlineViewer.viewport.panTo(center);
            this.viewer.viewport.fitBounds(
                this.inlineViewer.viewport.getBounds()
            );
        }

        mainViewerZoom(refPoint = null) {
            const zoomTarget = this.mainViewer.viewport.getZoom() * this.ratio;

            this.viewer.viewport.zoomTo(zoomTarget, refPoint);
            this.inlineViewer.viewport.zoomTo(zoomTarget, refPoint);

            let bounds, center;

            if (this.showInViewer) {
                // Event handing for when the inline magnifier is active
                bounds = this.inlineViewer.viewport.getBounds(true);

                const bottomright = this.mainViewer.viewport.pixelFromPoint(
                    bounds.getBottomRight(),
                    true
                );

                const topleft = this.mainViewer.viewport.pixelFromPoint(
                    bounds.getTopLeft(),
                    true
                );

                const width = Math.min(
                    Math.abs(topleft.x - bottomright.x),
                    this.minWidth
                );
                const height = Math.min(
                    Math.abs(topleft.y - bottomright.y),
                    this.minWidth
                );

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
                this.inlineViewer.viewport.panTo(center);
                this.viewer.viewport.fitBounds(bounds);
            } else {
                // inline / overlay viewer is invisibly pinned to the sidebar viewer
                bounds = this.viewer.viewport.getBounds(true);
                this.updateDisplayRegionFromBounds(bounds);
                center = this.mainViewer.viewport.getCenter();
                this.viewer.viewport.panTo(center);
                this.inlineViewer.viewport.panTo(center);
            }
        }

        mainViewerPan(event) {
            const panDelta = event.delta.times(-1);
            const panBy = this.mainViewer.viewport.deltaPointsFromPixels(
                event.delta.times(-1)
            );
            let bounds, center;

            if (this.showInViewer) {
                const top = parseInt(this.displayRegion.style.top, 10);
                const left = parseInt(this.displayRegion.style.left, 10);

                this.updateDisplayRegionStyle(
                    top - panDelta.y,
                    left - panDelta.x
                );

                this.inlineViewer.viewport.panBy(panBy);
                bounds = this.inlineViewer.viewport.getBounds();
            } else {
                this.viewer.viewport.panBy(panBy);
                bounds = this.viewer.viewport.getBounds();
            }

            const bottomright = this.mainViewer.viewport.pixelFromPoint(
                bounds.getBottomRight(),
                true
            );

            const topleft = this.mainViewer.viewport.pixelFromPoint(
                bounds.getTopLeft(),
                true
            );

            const width = Math.abs(topleft.x - bottomright.x);
            const height = Math.abs(topleft.y - bottomright.y);

            // the center of the overlay magnifier is at whatever
            // is in the center of its display region, on the main
            // viewer. We're using layers, but they are all the same
            // size for this purpose, so just pick one.

            // This is in coordinates relative to the main viewer.
            var bounds_rect = new $.Rect(topleft.x, topleft.y, width, height);

            // Translate those into viewport coordinates for the inline viewer.
            center =
                this.mainViewer.viewport.viewerElementToViewportCoordinates(
                    bounds_rect.getCenter()
                );

            this.viewer.viewport.panTo(center);

            if (this.showInViewer) {
                this.inlineViewer.viewport.panTo(center);
                this.viewer.viewport.fitBounds(bounds, true);
            } else {
                this.updateDisplayRegionFromBounds(bounds);
            }
        }

        update() {
            if (
                this.mainViewer.viewport &&
                this.viewer.viewport &&
                this.inlineViewer.viewport
            ) {
                // things we always want to do
                const zoomTarget =
                    this.mainViewer.viewport.getZoom() * this.ratio;

                this.viewer.viewport.zoomTo(zoomTarget);
                this.inlineViewer.viewport.zoomTo(zoomTarget);

                let bounds;

                if (this.showInViewer) {
                    // Event handing for when the inline magnifier is active
                    bounds = this.inlineViewer.viewport.getBounds(true);
                    this.viewer.viewport.fitBounds(bounds);
                } else {
                    // inline / overlay viewer is invisibly pinned to the sidebar viewer
                    bounds = this.viewer.viewport.getBounds(true);
                    this.updateDisplayRegionFromBounds(bounds);
                }
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

                const bounds = this.viewer.viewport.getBounds(true);

                this.updateDisplayRegionFromBounds(bounds);
                //re-sync the inline viewer to this, invisibly
                this.inlineViewer.viewport.panTo(bounds.getCenter());
            } else {
                this.showInViewer = true;

                // make it a bit bigger so it shows the same things,
                // just on top of the main viewer
                const bounds = this.viewer.viewport.getBounds(true);

                var bottomright = this.mainViewer.viewport
                    .pixelFromPoint(bounds.getBottomRight(), true)
                    .plus(this.totalBorderWidths);

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
            const imageWidth = OSDViewerUtils.getImageWidth(this.viewer);
            const self = this;
            processed_markers.forEach(function (m) {
                self.markers[m.key] = m.values.map(
                    (v) =>
                        new $.Point(
                            v["global_X_pos"] / imageWidth,
                            v["global_Y_pos"] / imageWidth
                        )
                );
                self.visibleMarkers[m.key] = 0;
            });
        }

        /**
         *  Gets the names and barcodes of markers that are in the current visible
         *  viewport.
         **/

        showVisibleMarkerCounts() {
            const self = this;
            let viewport = this.viewer.viewport;
            if (this.showInViewer) {
                viewport = this.inlineViewer.viewport;
            }
            const bounds = viewport.getBounds();
            Object.keys(this.markers).forEach(function (k) {
                if (markerUtils._checkBoxes[k].checked) {
                    self.visibleMarkers[k] = self.markers[k].reduceRight(
                        function (prev, curr) {
                            return bounds.containsPoint(curr) ? prev + 1 : prev;
                        },
                        0
                    );
                }
            });
            Object.keys(this.visibleMarkers).forEach(function (k) {
                const countElement = document.getElementById(
                    "metrics__count--" + k
                );
                countElement.innerText = self.visibleMarkers[k];
            });
        }
    }
    window.Magnifier = Magnifier;
})(OpenSeadragon);
