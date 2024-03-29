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
    const ratioId = "magnifier__ratio";
    const hpfSettingsId = "magnifier__hpf-settings";
    const toggle10HpfId = "magnifier__10hpf";
    const mppId = "magnifier__10hpf-mpp";
    const hpf_magFactorId = "magnifier__10hpf-magnification";
    const hpf_fieldId = "magnifier__10hpf-field-number";
    const hpf_gridId = "magnifier__10hpf-grid";

    class Magnifier {
        constructor(mainViewer, options) {
            this.mainViewer = mainViewer;
            this.ratio = document.getElementById(ratioId).value;
            this.element = document.getElementById(options.id);
            this.element.id = options.id;
            this.showInViewer = document.getElementById(checkboxId).checked;
            this.round = document.getElementById(roundId).checked;
            this.hpf = document.getElementById(toggle10HpfId).checked;
            this.hpfSettings = document.getElementById(hpfSettingsId);
            this.hpfGrid = document.getElementById(hpf_gridId).checked;
            this.markers = {};
            this.visibleMarkers = {};
            this.metrics = document.getElementById(options.id + "__metrics");
            this.borderWidth = 4; // in pixels
            this.minWidth = 100;
            this.mnameMain = options.mnameMain;
            this.mnameInline = options.mnameInline;

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
                    mouseNavEnabled: false,
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
            // Position and color styles for both of these have to
            // be here or they will be overridden.
            this.regionMoveHangle = $.makeNeutralElement("div");
            this.regionMoveHangle.className = "displayregion__move";
            this.regionMoveHangle.style.position = "absolute";
            this.regionMoveHangle.style.background = "rgba(0, 0, 0, 0.5)";
            this.regionMoveHangle.style.border = "1px solid #000";

            this.regionResizeHangle = $.makeNeutralElement("div");
            this.regionResizeHangle.className = "displayregion__resize";
            this.regionResizeHangle.style.position = "absolute";
            this.regionResizeHangle.style.background =
                "rgba(255, 255, 255, 0.5)";

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

            this.displayRegion.appendChild(this.regionMoveHangle);
            this.displayRegion.appendChild(this.regionResizeHangle);
            this.displayRegion.appendChild(this.inViewerElement);
            this.displayRegionContainer.appendChild(this.displayRegion);
            this.mainViewer.canvas.appendChild(this.displayRegionContainer);

            // A marker / crosshair icon in the OSD navigator for the main
            // viewer to show where the center of the magnifier is, in the image
            this.displayRegionCenterMarker = $.makeNeutralElement("div");
            this.displayRegionCenterMarker.className = "displayregion__center";
            this.displayRegionCenterMarker.style.position = "absolute";
            this.displayRegionCenterMarker.style.background = "transparent";
            this.displayRegionCenterMarker.style.width = "10px";
            this.displayRegionCenterMarker.style.height = "10px";
            this.displayRegionCenterMarker.style.margin = "0 0 0 -5px";
            this.displayRegionCenterMarker.innerHTML = "&#9678;";
            this.mainViewer.navigator.displayRegionContainer.appendChild(
                this.displayRegionCenterMarker
            );

            $.setElementTouchActionNone(this.element);
            $.setElementTouchActionNone(this.inViewerElement);

            this.recordPreviousDisplayRegionPosition();

            // Actually instantiate the magnifier viewers now
            this.viewer = $(options);
            // The same thing again, but inside the viewer instead of outside.
            this.inlineViewer = $(
                $.extend(options, {
                    element: this.inViewerElement,
                })
            );

            if (this.showInViewer) {
                document.getElementById(toggle10HpfId).value = false;
                this.hpf = false;
                this.hpfSettings.setAttribute("disabled", true);
                this.initializeInlineMagnifier();
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

            const self = this;
            if (this.hpf) {
                document.getElementById(ratioId).setAttribute("disabled", true);
                document
                    .getElementById(checkboxId)
                    .setAttribute("disabled", true);
                this.mainViewer.world.addOnceHandler(
                    "add-item",
                    function (event) {
                        self.initializeHpf();
                    }
                );
            }

            if (this.hpfGrid) {
                this.mainViewer.world.addOnceHandler(
                    "add-item",
                    function (event) {
                        self.showHpfGrid();
                    }
                );
            }

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
            this.mainViewer.addHandler("zoom", function (event) {
                self.mainViewerZoom(event.refPoint);
            });

            this.mainViewer.addHandler("viewport-change", function (event) {
                self.recordPreviousDisplayRegionPosition();
            });

            this.mainViewer.addHandler("pan", function (event) {
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

                if (self.inlineViewer && self.showInViewer) {
                    overlayUtils.modifyDisplayIfAny(self.mnameInline);
                } else if (self.viewer) {
                    overlayUtils.modifyDisplayIfAny(self.mnameMain);
                }
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

            document
                .getElementById(ratioId)
                .addEventListener("change", function () {
                    self.ratio = event.target.value;
                    self.update();
                });

            document
                .getElementById(toggle10HpfId)
                .addEventListener("change", function () {
                    self.toggle10HPF();
                });

            document
                .getElementById(mppId)
                .addEventListener("change", function () {
                    self.initializeHpf();
                    if (self.hpfGrid) {
                        self.destroyHpfGrid();
                        self.showHpfGrid();
                    }
                });

            document
                .getElementById(hpf_magFactorId)
                .addEventListener("change", function () {
                    self.initializeHpf();
                    if (self.hpfGrid) {
                        self.destroyHpfGrid();
                        self.showHpfGrid();
                    }
                });

            document
                .getElementById(hpf_fieldId)
                .addEventListener("change", function () {
                    self.initializeHpf();
                    if (self.hpfGrid) {
                        self.destroyHpfGrid();
                        self.showHpfGrid();
                    }
                });
            document
                .getElementById("magnifier__10hpf-ocularmag")
                .addEventListener("change", function () {
                    self.initializeHpf();
                    if (self.hpfGrid) {
                        self.destroyHpfGrid();
                        self.showHpfGrid();
                    }
                });

            document
                .getElementById(hpf_gridId)
                .addEventListener("change", function () {
                    self.toggleHpfGrid();
                });

            this.update();
        }

        getCenterFromBounds(bounds) {
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
            const bounds_rect = new $.Rect(topleft.x, topleft.y, width, height);

            // Translate those into viewport coordinates for the inline viewer.
            const center =
                this.mainViewer.viewport.viewerElementToViewportCoordinates(
                    bounds_rect.getCenter()
                );

            return center;
        }

        updateDisplayRegionStyle(top, left, width, height) {
            var style = this.displayRegion.style;

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

        recordPreviousDisplayRegionPosition() {
            this.displayRegionTop = parseInt(this.displayRegion.style.top, 10);
            this.displayRegionLeft = parseInt(
                this.displayRegion.style.left,
                10
            );
        }

        updateCenterMarkerStyle(center) {
            var navigatorCenter =
                this.mainViewer.navigator.viewport.pixelFromPoint(center, true);
            var style = this.displayRegionCenterMarker.style;

            // make sure these are non-negative so IE doesn't throw.
            style.top = Math.round(Math.max(navigatorCenter.y, 0)) + "px";
            style.left = Math.round(Math.max(navigatorCenter.x, 0)) + "px";
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
            this.updateCenterMarkerStyle(bounds.getCenter());
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
                this.updateCenterMarkerStyle(bounds.getCenter());
            } else {
                bounds = this.viewer.viewport.getBounds();

                this.updateDisplayRegionFromBounds(bounds);
                this.inlineViewer.viewport.fitBounds(bounds);
            }
            this.recordPreviousDisplayRegionPosition();
        }

        moveRegion(event) {
            const top = parseInt(this.displayRegion.style.top, 10);
            const left = parseInt(this.displayRegion.style.left, 10);

            const newTop = top + event.delta.y;
            const newLeft = left + event.delta.x;

            const mainViewerBounds =
                this.mainViewer.viewport.viewportToViewerElementRectangle(
                    this.mainViewer.viewport.getBounds()
                );

            if (
                !mainViewerBounds.containsPoint(
                    new $.Point(newLeft + 20, newTop + 20)
                )
            ) {
                return;
            }

            this.updateDisplayRegionStyle(newTop, newLeft);
            this.inlineViewer.viewport.panBy(
                this.mainViewer.viewport.deltaPointsFromPixels(event.delta)
            );
            const bounds = this.inlineViewer.viewport.getBounds();
            this.viewer.viewport.fitBounds(bounds, true);
            this.updateCenterMarkerStyle(bounds.getCenter());
            this.recordPreviousDisplayRegionPosition();
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
            this.updateCenterMarkerStyle(newBounds.getTopLeft());
        }

        mainViewerZoom(refPoint = null) {
            const zoomTarget = this.mainViewer.viewport.getZoom() * this.ratio;

            this.viewer.viewport.zoomTo(zoomTarget, refPoint);
            this.inlineViewer.viewport.zoomTo(zoomTarget, refPoint);
            if (this.hpf) {
                this.fitHpfBounds();
            }
            this.recordPreviousDisplayRegionPosition();
        }

        mainViewerPan(event) {
            // Similar to when we resize the overlay / inline viewer,
            // display exactly what is underneath its boundaries in
            // the main viewer.
            const left = parseInt(this.displayRegion.style.left, 10);
            const top = parseInt(this.displayRegion.style.top, 10);
            const width = parseInt(this.displayRegion.style.width, 10);
            const height = parseInt(this.displayRegion.style.width, 10);

            if (this.showInViewer) {
                // This is in coordinates relative to the main viewer.
                const bounds_rect = new $.Rect(left, top, width, height);
                const center =
                    this.mainViewer.viewport.viewerElementToViewportCoordinates(
                        bounds_rect.getCenter()
                    );

                this.inlineViewer.viewport.panTo(center, event.immediately);
                const bounds = this.inlineViewer.viewport.getBounds();
                this.viewer.viewport.fitBounds(bounds);
                this.updateCenterMarkerStyle(bounds.getCenter());
            } else {
                const delta = new $.Point(
                    this.displayRegionLeft - left,
                    this.displayRegionTop - top
                );
                this.viewer.viewport.panBy(
                    this.mainViewer.viewport.deltaPointsFromPixels(delta)
                );
                this.viewer.viewport.applyConstraints();

                const bounds = this.viewer.viewport.getBounds();
                this.inlineViewer.viewport.fitBounds(bounds);
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

                if (!this.hpf && !this.hpfGrid) {
                    this.viewer.viewport.zoomTo(zoomTarget);
                    this.inlineViewer.viewport.zoomTo(zoomTarget);
                }

                let bounds;

                if (this.showInViewer) {
                    // Event handing for when the inline magnifier is active
                    bounds = this.inlineViewer.viewport.getBounds();
                    this.viewer.viewport.fitBounds(bounds);
                } else if (this.hpf) {
                    bounds = this.inlineViewer.viewport.getBounds();
                    this.fitHpfBounds();
                } else {
                    // inline / overlay viewer is invisibly pinned to the sidebar viewer
                    bounds = this.viewer.viewport.getBounds();
                    this.updateDisplayRegionFromBounds(bounds);
                }
                this.updateCenterMarkerStyle(bounds.getCenter());
            }
        }

        initializeInlineMagnifier() {
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

            const width = Math.min(Math.abs(topleft.x - bottomright.x), 100);
            const height = Math.min(Math.abs(topleft.y - bottomright.y), 100);

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

            this.displayRegion.style.display = null;
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

        fitHpfBounds() {
            // We need to have an image in the viewer in order to calculate
            // an HPF region size for it.
            if (this.mainViewer.world.getItemCount() == 0) {
                return;
            }
            // where is the viewport on the actual image right now?
            const bounds = this.mainViewer.world
                .getItemAt(0)
                .viewportToImageRectangle(this.viewer.viewport.getBounds(true));
            // where should the bounds be, then?
            const hpfBounds = this.mainViewer.world
                .getItemAt(0)
                .imageToViewportRectangle(
                    bounds.x,
                    bounds.y,
                    this.hpfSideLength,
                    this.hpfSideLength
                );

            this.viewer.viewport.fitBounds(hpfBounds);
            this.updateDisplayRegionFromBounds(hpfBounds);
        }

        storeHpfSideLength() {
            // Created by Melinda Minch (03/22)
            // The formula I need to use here is that the region visible in the magnifier has this many pixels per side at its maximum zoom level:
            // sqrt(HPF field area / mpp * mpp)
            // HPF field area is the area, in square microns, of a standard 10HPF field of view.We are assuming a square viewer for now and equal horizontal and vertical
            // microns per pixel.
            // Modified by Bnapora(08/25/22)
            const mpp = document.getElementById(mppId).value;
            const mag_occular = document.getElementById("magnifier__10hpf-ocularmag").value;
        
            // this field number is in millimeters in the UI; convert to microns to get diameter,
            const field = document.getElementById(hpf_fieldId).value * (1000);
            // Manually entered objective magnification (eg 20X, 40X, 60X, etc)
            const mag_objective = document.getElementById(hpf_magFactorId).value; //TODO Add calculation of actual magnification based on MPP (https://www.microscopesinternational.com/blog/20180420-magnification_vs_resolution.aspx)
            
            // Calculated Objective Mag based on MPP
            const mag_obj_calc = Number.parseFloat(1/mpp*10).toFixed(1)

            // divide diameter by 2, because we need a radius to calculate area, since number is commmonly
            // used in the science to represent the diameter of a round ocular field.
            // https://journals.sagepub.com/doi/full/10.1177/0300985815593349
            const hpfDiameter = 2200 // units are pixels (550 microns / 0.25 mpp)
            const hpfMPP = 0.25
            const hpfMPPFactor = mpp/hpfMPP
            const hpfOcularFactor = field/(hpfDiameter*10)

            // Calculate hpfSideLength from hpfAreaRadius(microns)
            // Convert microns to pixels and multiply by Ocular Mag
            this.hpfSideLength = (hpfDiameter*hpfMPPFactor*hpfOcularFactor)*mag_occular;

            document.getElementById("magnifier__10hpf-dimensions").value = Number.parseFloat(this.hpfSideLength/4/1000).toFixed(2)
            document.getElementById(hpf_magFactorId).value = mag_obj_calc
            tmapp.mpp = document.getElementById("magnifier__10hpf-mpp").value
        }

        initializeHpf() {
            this.storeHpfSideLength();
            if (this.hpf) {
                this.fitHpfBounds();
            }
        }

        toggle10HPF() {
            if (this.hpf) {
                this.hpf = false;

                // disable mutually exclusive UI
                document.getElementById(ratioId).removeAttribute("disabled");
                document.getElementById(checkboxId).removeAttribute("disabled");

                // If we are showing the overlay, get out of it
                if (this.showInViewer) {
                    this.toggleInViewer();
                }

                const bounds = this.viewer.viewport.getBounds(true);

                this.updateDisplayRegionFromBounds(bounds);
                //re-sync the inline viewer to this, invisibly
                this.inlineViewer.viewport.panTo(bounds.getCenter());
                this.update();
            } else {
                this.hpf = true;
                document.getElementById(ratioId).setAttribute("disabled", true);
                document
                    .getElementById(checkboxId)
                    .setAttribute("disabled", true);
                this.initializeHpf();
            }
        }

        destroyHpfGrid() {
            this.recordPreviousDisplayRegionPosition();
            d3.select(".grid").remove();
        }

        showHpfGrid() {
            // We need to have an image in the viewer in order to calculate
            // an HPF region size for it.
            if (this.mainViewer.world.getItemCount() == 0) {
                return;
            }
            this.hpfGridOverlay = d3
                .select(this.mainViewer.svgOverlay().node())
                .append("g")
                .attr("class", "grid");
            if (!this.hpfSideLength) {
                this.storeHpfSideLength();
            }

            const strokeWidth = 0.001;

            let data = new Array();

            let xpos = 0;
            let ypos = 0;

            let rectBounds = this.mainViewer.world
                .getItemAt(0)
                .imageToViewportRectangle(
                    xpos,
                    ypos,
                    this.hpfSideLength,
                    this.hpfSideLength
                );
            let row = 0;

            // iterate for rows
            for (ypos; ypos < 1; ypos += rectBounds.height) {
                data.push(new Array());
                rectBounds.y = ypos;

                // iterate for cells/columns inside rows
                for (xpos; xpos < 1; xpos += rectBounds.width) {
                    rectBounds.x = xpos;
                    data[row].push({
                        bounds: rectBounds.clone(),
                    });
                }
                xpos = 0;
                row++;
            }

            const grid = d3.select(".grid");

            // get rid of any old grid
            grid.selectAll(".grid-row").remove();

            const gridRow = grid
                .selectAll(".grid-row")
                .data(data)
                .enter()
                .append("g")
                .attr("class", "grid-row")
                .style("fill-opacity", 0.0);

            const self = this;
            const squares = gridRow
                .selectAll(".square")
                .data(function (d) {
                    return d;
                })
                .enter()
                .append("rect")
                .attr("class", "square")
                .attr("x", function (d) {
                    return d.bounds.x + strokeWidth;
                })
                .attr("y", function (d) {
                    return d.bounds.y + strokeWidth;
                })
                .attr("width", function (d) {
                    return d.bounds.width + strokeWidth;
                })
                .attr("height", function (d) {
                    return d.bounds.height + strokeWidth;
                })
                .style("fill-opacity", 0.3)
                .style("stroke", "#ccc")
                .style("stroke-width", strokeWidth);

            squares.nodes().forEach(function (node) {
                self.mainViewer.svgOverlay().onClick(node, function (event) {
                    // we want to catch clicks, not drags. We also want people to be
                    // able to zoom normally if the shift key is down.
                    if (event.quick && !event.shift) {
                        event.preventDefaultAction = true;
                        const target = d3.select(event.originalTarget);
                        target.style("fill-opacity", 0.0);
                        const d = target.data()[0];

                        const bounds = new $.Rect(
                            d.bounds.x - strokeWidth,
                            d.bounds.y - strokeWidth,
                            d.bounds.width - strokeWidth,
                            d.bounds.height - strokeWidth
                        );
                        self.viewer.viewport.fitBounds(bounds);

                        const viewer_bounds = self.viewer.viewport.getBounds();
                        self.inlineViewer.viewport.fitBounds(viewer_bounds);
                        self.updateDisplayRegionFromBounds(viewer_bounds);
                        self.recordPreviousDisplayRegionPosition();
                    } else if(event.shift) {
                        self.clickToZoom(event);
                    }
                });
            });
        }

        toggleHpfGrid() {
            if (this.hpfGrid) {
                this.hpfGrid = false;
                this.destroyHpfGrid();
                document.getElementById(checkboxId).removeAttribute("disabled");
            } else {
                this.hpfGrid = true;
                this.showInViewer = false;
                document
                    .getElementById(checkboxId)
                    .setAttribute("disabled", true);
                this.showHpfGrid();
            }
        }

        toggleInViewer() {
            if (this.showInViewer) {
                this.showInViewer = false;
                this.hpfSettings.removeAttribute("disabled");
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
                // This is mutually exclusive with HPF
                document.getElementById(toggle10HpfId).value = false;
                this.hpf = false;
                this.hpfGrid = false;
                this.destroyHpfGrid();
                this.hpfSettings.setAttribute("disabled", true);
                this.showInViewer = true;
                this.initializeInlineMagnifier();
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
                } else {
                    delete self.visibleMarkers[k];
                    document.getElementById(
                        "metrics__row--" + k
                    ).style.display = "none";
                }
            });
            Object.keys(this.visibleMarkers).forEach(function (k) {
                const countElement = document.getElementById(
                    "metrics__count--" + k
                );
                countElement.innerText = self.visibleMarkers[k];
                document.getElementById("metrics__row--" + k).style.display =
                    "table-row";
            });
        }
    }
    window.Magnifier = Magnifier;
})(OpenSeadragon);
