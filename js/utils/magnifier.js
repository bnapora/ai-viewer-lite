/**
* @file magnifier.js A custom magnifier for this app - based loosely on https://github.com/picturae/OpenSeadragonMagnifier
* @author Melinda Minch
**/

(function($) {
    'use strict';

    class Magnifier {
        constructor(mainViewer, options) {
            this.mainViewer = mainViewer;
            this.ratio = options.magnificationRatio;

            this.element = document.getElementById(options.id);

            options.controlOptions  = $.extend(true, {
                    anchor:           $.ControlAnchor.NONE,
                    attachToViewer:   false,
                    autoFade:         false,
                }, options.controlOptions || {});

            this.element.id = options.id;

            options = $.extend(true, {
                sizeRatio:              0.2,
                viewerWidth: null,
                viewerHeight: null,
                minPixelRatio:         this.mainViewer.minPixelRatio,
                defaultZoomLevel:       this.mainViewer.viewport.getZoom() * this.ratio,
                minZoomLevel:           1,
            }, options, {
                element:                this.element,
                tabIndex:               -1, // No keyboard navigation, omit from tab order
                //These need to be overridden to prevent recursion since
                //the magnifier is a viewer and a viewer has a magnifier/navigator
                showNavigator:          false,
                showNavigationControl:  false,
                showSequenceControl:    false,
                immediateRender:        true,
                blendTime:              0,
                animationTime:          0,
                autoResize:             options.autoResize,
                // prevent resizing the magnifier from adding unwanted space around the image
                minZoomImageRatio:      1.0,
            });

            $.setElementTouchActionNone( this.element );

            this.borderWidth = 2;
            this.viewerWidth = options.viewerWidth;
            this.viewerHeight = options.viewerHeight;

            this.borderWidth = 2; // in pixels

            //At some browser magnification levels the display regions lines up correctly, but at some there appears to
            //be a one pixel gap.
            this.fudge = new $.Point(1, 1);
            this.totalBorderWidths = new $.Point(this.borderWidth*2, this.borderWidth*2).minus(this.fudge);

            this.viewer = $(options);

            new $.MouseTracker({
                element:     this.element,
                dragHandler: $.delegate(this, function (event) {
                  const viewerSize = $.getElementSize( this.mainViewer.element );
                  let newWidth = parseInt(this.element.style.width, 10) - event.delta.x;
                  newWidth = Math.min(newWidth, viewerSize.x * .75);
                  newWidth = Math.max(newWidth, parseInt(this.element.style.minWidth, 10));
                  this.element.style.width = newWidth + 'px';
                  let newHeight = parseInt(this.element.style.height, 10) - event.delta.y;
                  newHeight = Math.min(newHeight, viewerSize.y * .75);
                  newHeight = Math.max(newHeight, parseInt(this.element.style.minHeight, 10));
                  this.element.style.height = newHeight + 'px';
                }),
            });

            this.displayRegion           = $.makeNeutralElement( 'div' );
            this.displayRegion.id        = this.element.id + '-displayregion';
            this.displayRegion.className = 'displayregion';

            this.displayRegionContainer              = $.makeNeutralElement('div');
            this.displayRegionContainer.id           = this.element.id + '-displayregioncontainer';
            this.displayRegionContainer.className    = 'displayregioncontainer';
            this.displayRegionContainer.style.width  = '0';
            this.displayRegionContainer.style.height = '0';

            this.displayRegionContainer.appendChild(this.displayRegion);
            this.mainViewer.canvas.appendChild(this.displayRegionContainer);

            (function( style, borderWidth ){
                style.position      = 'absolute';
                style.border        = borderWidth + 'px solid #333';
                style.margin        = '0px';
                style.padding       = '0px';
            }( this.displayRegion.style, this.borderWidth ));

            const self = this;
            this.mainViewer.addHandler(
                'zoom',
                function(){ self.update(); }
            );
            this.mainViewer.addHandler(
                'pan',
                function(){ self.update(); }
            );

            this.mainViewer.addHandler('update-level', function() {
                self.update();
            });

            this.mainViewer.addHandler('close', function() {
                self.close();
            });

            this.mainViewer.addHandler('full-page', function() {
                self.update();
            });

            this.mainViewer.addHandler('full-screen', function() {
                self.update();
            });

            this.mainViewer.world.addHandler('update-viewport', function() {
                self.update();
            });

            this.storedBounds = null;
            this.update();
        }

        update() {
            var viewerSize = $.getElementSize( this.viewer.element );
            if ( this._resizeWithViewer && viewerSize.x && viewerSize.y && !viewerSize.equals( this.oldViewerSize ) ) {
                var newWidth;
                var newHeight;
                this.oldViewerSize = viewerSize;

                if ( this.maintainSizeRatio || !this.elementArea) {
                    newWidth  = viewerSize.x * this.sizeRatio;
                    newHeight = viewerSize.y * this.sizeRatio;
                } else {
                    newWidth = Math.sqrt(this.elementArea * (viewerSize.x / viewerSize.y));
                    newHeight = this.elementArea / newWidth;
                }

                // When dimensions are suplied with the plugin options
                if (this.viewerWidth && this.viewerHeight) {
                    newWidth = this.viewerWidth;
                    newHeight = this.viewerHeight;
                }

                this.element.style.width  = Math.round( newWidth ) + 'px';
                this.element.style.height = Math.round( newHeight ) + 'px';

                if (!this.elementArea) {
                    this.elementArea = newWidth * newHeight;
                }

                this.updateSize();
            }

            if (this.mainViewer.viewport && this.viewer.viewport) {
                this.viewer.viewport.zoomTo(this.mainViewer.viewport.getZoom() * this.ratio);
                this.viewer.viewport.panTo(this.mainViewer.viewport.getCenter());

                var bounds      = this.viewer.viewport.getBounds( true );
                var topleft     = this.mainViewer.viewport.pixelFromPoint( bounds.getTopLeft(), true );
                var bottomright = this.mainViewer.viewport.pixelFromPoint( bounds.getBottomRight(), true )
                    .minus( this.totalBorderWidths );

                //update style for magnifier-box
                var style = this.displayRegion.style;
                style.display = this.viewer.world.getItemCount() ? 'block' : 'none';

                style.top    = Math.round( topleft.y ) + 'px';
                style.left   = Math.round( topleft.x ) + 'px';

                var width = Math.abs( topleft.x - bottomright.x );
                var height = Math.abs( topleft.y - bottomright.y );
                // make sure width and height are non-negative so IE doesn't throw
                style.width  = Math.round( Math.max( width, 0 ) ) + 'px';
                style.height = Math.round( Math.max( height, 0 ) ) + 'px';

                this.storedBounds = bounds;
            }
        }
    };
    window.Magnifier = Magnifier;

})(OpenSeadragon);

