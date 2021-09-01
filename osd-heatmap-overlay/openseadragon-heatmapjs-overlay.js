/*
* heatmap.js openseadragon overlay
*
* Dual-licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
* and the Beerware (http://en.wikipedia.org/wiki/Beerware) license.
*/

function HeatmapOverlay(viewer, cfg) {
    var self = this;
    this._viewer = viewer;
    this.initialize(cfg || {});
};

HeatmapOverlay.CSS_TRANSFORM = (function () {
    var div = document.createElement('div');
    var props = [
        'transform',
        'WebkitTransform',
        'MozTransform',
        'OTransform',
        'msTransform'
    ];

    for (var i = 0; i < props.length; i++) {
        var prop = props[i];
        if (div.style[prop] !== undefined) {
            return prop;
        }
    }
    return props[0];
})();

HeatmapOverlay.prototype.initialize = function (cfg) {
    this.cfg = cfg;

    //var map = this.map = this.getMap();
    
    var container = this.container = document.createElement('div');
    var width = this.width = this._viewer.container.clientWidth;
    var height = this.height = this._viewer.container.clientHeight;

    container.style.cssText = 'width:' + width + 'px;height:' + height + 'px;';

    this.data = [];
    this.max = 1;

    cfg.container = container;

    this.onAdd();
};

HeatmapOverlay.prototype.setData = function (data) {
    this.max = data.max;

    // transform data to latlngs
    var data = data.data;
    var len = data.length;
    var d = [];

    while (len--) {
        var entry = data[len];
        var dataObj = {};
        dataObj.value = entry.value;
        dataObj.x = entry.x;
        dataObj.y = entry.y;
        if (entry.radius) {
            dataObj.radius = entry.radius;
        }
        d.push(dataObj);
    }
    this.data = d;
    this.update();
};

HeatmapOverlay.prototype.update = function () {
    var zoom = this._viewer.viewport.getZoom(true);

    if (this.data.length == 0) {
        return;
    }

    var generatedData = { max: this.max };
    var points = [];
    // iterate through data 
    var len = this.data.length;
    var localMax = 0;
    var valueField = this.cfg.valueField;


    while (len--) {
        var entry = this.data[len];
        var value = entry.value;

        if (value > localMax) {
            localMax = value;
        }
       
        var viewportPoint  = this._viewer.viewport.imageToViewportCoordinates(entry.x, entry.y);
        var imagePoint = this._viewer.viewport.pixelFromPoint(viewportPoint , true);
		
		//ignore outter point
        if (imagePoint.x <= 0 || imagePoint.y <= 0 || imagePoint.x >= viewer.viewport.getContainerSize().x || imagePoint.y >= viewer.viewport.getContainerSize().y)
            continue;

        var point = { x: Math.round(imagePoint.x), y: Math.round(imagePoint.y), value : value };
        
        var radius;

        if (entry.radius) {
            radius = entry.radius * zoom;
        } else {
            radius = (this.cfg.radius || 20) * zoom;
        }
        point.radius = radius;
        points.push(point);
    }
    if (this.cfg.useLocalExtrema) {
        generatedData.max = localMax;
    }

    generatedData.data = points;

    this.heatmap.setData(generatedData);

};

HeatmapOverlay.prototype.onAdd = function () {

    this._viewer.canvas.appendChild(this.container);

    this.changeHandler = this._viewer.addHandler('update-viewport', function (arg) {
        arg.userData.draw.call(arg.userData);
    }, this);

    
    if (!this.heatmap) {
        this.heatmap = h337.create(this.cfg);
    }
    this.draw();
};

HeatmapOverlay.prototype.draw = function () {
    if (!this._viewer) { return; }

    this.update();
};
