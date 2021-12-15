/**
 * @file magnifier.js A custom magnifier for this app - based loosely on https://github.com/picturae/OpenSeadragonMagnifier
 * @author Melinda Minch
 **/

(function ($) {
    "use strict";

    //At some browser magnification levels the display regions lines up correctly, but at some there appears to
    //be a one pixel gap.
    const fudge = new $.Point(1, 1);
    const checkboxId = 'magnifier__show-in-viewer';
    const activeClass = 'magnifier--active';
    const inactiveClass = 'magnifier--inactive';

    class Magnifier {
        constructor(mainViewer, options) {
            this.mainViewer = mainViewer;
            this.ratio = options.magnificationRatio;
            this.element = document.getElementById(options.id);
            this.element.id = options.id;
            this.showInViewer = document.getElementById(checkboxId).checked;

            options = $.extend(
                true,
                {
                    sizeRatio: 0.2,
                    minPixelRatio: this.mainViewer.minPixelRatio,
                    defaultZoomLevel:
                        this.mainViewer.viewport.getZoom() * this.ratio,
                    minZoomLevel: 1,
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
                    minZoomImageRatio: 1.0,
                }
            );

            this.displayRegion = $.makeNeutralElement("div");
            this.displayRegion.id = this.element.id + "-displayregion";
            this.displayRegion.className = "displayregion";

            this.displayRegionContainer = $.makeNeutralElement("div");
            this.displayRegionContainer.id =
                this.element.id + "-displayregioncontainer";
            this.displayRegionContainer.className = "displayregioncontainer";
            this.displayRegionContainer.style.width = "0";
            this.displayRegionContainer.style.height = "0";

            this.inViewerElement = $.makeNeutralElement("div");
            this.inViewerElement.id = this.element.id + "--inline";
            this.inViewerElement.className = 'magnifier magnifier--square magnifier--inline'
            if(this.showInViewer) {
                $.addClass(this.inViewerElement, activeClass);
            } else {
                $.addClass(this.inViewerElement, inactiveClass);
            }

            this.displayRegionContainer.appendChild(this.displayRegion);
            this.displayRegion.appendChild(this.inViewerElement);
            this.mainViewer.canvas.appendChild(this.displayRegionContainer);

            $.setElementTouchActionNone(this.element);

            this.borderWidth = 2; // in pixels

            this.totalBorderWidths = new $.Point(
                this.borderWidth * 2,
                this.borderWidth * 2
            ).minus(fudge);

            this.viewer = $(options);
            // The same thing again, but inside the viewer instead of outside. It looks better twice as big.
            this.inlineViewer = $($.extend(
                options,
                { element: this.inViewerElement, defaultZoomLevel: options.defaultZoomLevel })
            );

            (function (style, borderWidth) {
                style.position = "absolute";
                style.border = borderWidth + "px solid #333";
                style.margin = "0px";
                style.padding = "0px";
            })(this.displayRegion.style, this.borderWidth);

            const self = this;
            this.mainViewer.addHandler("zoom", function () {
                self.update();
            });
            this.mainViewer.addHandler("pan", function () {
                self.update();
            });

            this.mainViewer.addHandler("update-level", function () {
                self.update();
            });

            this.mainViewer.addHandler("full-page", function () {
                self.update();
            });

            this.mainViewer.addHandler("full-screen", function () {
                self.update();
            });

            this.mainViewer.world.addHandler("update-viewport", function () {
                self.update();
            });

            document.getElementById(checkboxId).addEventListener('change', function() {
                self.toggleInViewer();
            })

            this.storedBounds = null;
            this.update();
        }

        update() {
            const viewerSize = $.getElementSize(this.viewer.element);
            const inlineViewerSize = $.getElementSize(this.inlineViewer.element);

            if (
                this.mainViewer.viewport &&
                this.viewer.viewport &&
                this.inlineViewer.viewport) {
                    const zoomTarget = this.mainViewer.viewport.getZoom() * this.ratio;

                    this.viewer.viewport.zoomTo(zoomTarget);
                    this.inlineViewer.viewport.zoomTo(zoomTarget * 2);

                    const center = this.mainViewer.viewport.getCenter();
                    this.viewer.viewport.panTo(center);
                    this.inlineViewer.viewport.panTo(center);

                    var bounds = this.viewer.viewport.getBounds(true);
                    var topleft = this.mainViewer.viewport.pixelFromPoint(
                        bounds.getTopLeft(),
                        true
                    );
                    var bottomright = this.mainViewer.viewport
                        .pixelFromPoint(bounds.getBottomRight(), true)
                        .minus(this.totalBorderWidths);

                    //update style for magnifier-box
                    var style = this.displayRegion.style;
                    style.display = this.viewer.world.getItemCount()
                        ? "block"
                        : "none";

                    style.top = Math.round(topleft.y) + "px";
                    style.left = Math.round(topleft.x) + "px";

                    var width = Math.abs(topleft.x - bottomright.x);
                    var height = Math.abs(topleft.y - bottomright.y);
                    // make sure width and height are non-negative so IE doesn't throw
                    style.width = Math.round(Math.max(width, 0)) + "px";
                    style.height = Math.round(Math.max(height, 0)) + "px";

                    this.storedBounds = bounds;

            }
        }

        toggleInViewer() {
            if(this.showInViewer) {
                this.showInViewer = false;
                $.removeClass(this.inViewerElement, activeClass);
                $.addClass(this.inViewerElement, inactiveClass);
                this.inlineViewer.setVisible(false);
            } else {
                this.showInViewer = true;
                $.removeClass(this.inViewerElement, inactiveClass);
                $.addClass(this.inViewerElement, activeClass);
                this.inlineViewer.setVisible(true);
                this.inlineViewer.forceRedraw();
            }
        }

        _createSuccessCallback(i, viewer) {
            return function(i) {
                const layer0X = viewer.world.getItemAt(0).getContentSize().x;
                const layerNX = viewer.world.getItemAt(viewer.world.getItemCount() - 1).getContentSize().x;
                viewer.world.getItemAt(viewer.world.getItemCount() -1 ).setWidth(layerNX / layer0X);
            }
        }

        addLayer(url_suffix, opacity, layerName, tileSource, i) {
            url_suffix = url_suffix ? url_suffix : '';

            this.viewer.addTiledImage({
                index: i + 1,
                tileSource: url_suffix + tileSource,
                opacity: opacity,
                success: this._createSuccessCallback(i, this.viewer)
            });

            this.inlineViewer.addTiledImage({
                index: i + 1,
                tileSource: url_suffix + tileSource,
                opacity: opacity,
                success: this._createSuccessCallback(i, this.inlineViewer)
            });
        }


    }
    window.Magnifier = Magnifier;
})(OpenSeadragon);
