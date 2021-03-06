/**
 * @file OSDViewerUtils.js Interface to ask information to OSD
 * @author Leslie Solorzano
 * @see {@link OSDViewerUtils}
 */

/**
 * @namespace OSDViewerUtils
 */
OSDViewerUtils={
  _currentZoom:0,
  _currentPan:0,
}

/** 
 * Handler to ensure that at maximum zoom, the ima WILL pixelate */
OSDViewerUtils.pixelateAtMaximumZoomHandler=function(data){
  var viewer = data.eventSource;
  var drawer = viewer.drawer;
  var canvas = drawer.canvas;
  var context = canvas.getContext("2d");

  context.mozImageSmoothingEnabled = false;
  context.webkitImageSmoothingEnabled = false;
  context.msImageSmoothingEnabled = false;
  context.imageSmoothingEnabled = false;
}

/** 
 * Get viewport maximum zoom
 * @param {string} overlay Object prefix identifying the desired viewport in case there is more than one.
 * Established at {@link tmapp} but can be called directly, for example @example OSDViewerUtils.getMaxZoom("ISS");  */
OSDViewerUtils.getMaxZoom=function(overlay){
  return tmapp[overlay+"_viewer"].viewport.getMaxZoom();

}

/** 
 * Get current viewport zoom
 * @param {string} overlay Object prefix identifying the desired viewport in case there is more than one.
 * Established at {@link tmapp} but can be called directly, for example @example OSDViewerUtils.getMaxZoom("ISS");  */
OSDViewerUtils.getZoom=function(overlay){
  return tmapp[overlay+"_viewer"].viewport.getZoom();
}

/** 
 * Get image width.
 * @param {OpenSeadragonViewer} - optional. If specified, returns the width of the
 * viewer passed in. If not, returns the width of the main viewer.
 */
OSDViewerUtils.getImageWidth=function(viewer){
  if(!viewer) {
    var op=tmapp["object_prefix"];
    viewer = tmapp[op+"_viewer"];
  }
  return viewer.world.getItemAt(0).getContentSize().x;
}

/** 
 * Get image height.
 * @param {OpenSeadragonViewer} - optional. If specified, returns the height of the
 * viewer passed in. If not, returns the width of the main viewer.
 */
OSDViewerUtils.getImageHeight=function(viewer){
  if(!viewer) {
    var op=tmapp["object_prefix"];
    viewer = tmapp[op+"_viewer"];
  }
  return viewer.world.getItemAt(0).getContentSize().y;
}

/** 
 * Add a new image on top of the main viewer. It is mandatory to have the same tile size for this to work. Currently only in main viewer */
OSDViewerUtils.addTiledImage=function(options){
  if(!options){var options={}};
  var replace= options.replace || false;
  var tileSource = options.tileSource || false;
  var op=tmapp["object_prefix"];
  //get zoom
  OSDViewerUtils._currentZoom=tmapp[op+"_viewer"].viewport.getZoom();
  //get center
  OSDViewerUtils._currentPan=tmapp[op+"_viewer"].viewport.getCenter();
  options.success=function(){
      tmapp[op+"_viewer"].viewport.zoomTo(OSDViewerUtils._currentZoom,null, true);
      tmapp[op+"_viewer"].viewport.panTo(OSDViewerUtils._currentPan, true);
  };

  tmapp[op+"_viewer"].addTiledImage(options);
}
