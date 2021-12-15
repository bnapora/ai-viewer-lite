/**
* @file glUtils.js Utilities for WebGL-based marker drawing
* @author Fredrik Nysjo
* @see {@link glUtils}
*/

PATH_MARKERSHAPES_IMG = "misc/markershapes.png"

MARKERS_VS = `
    uniform vec2 u_imageSize;
    uniform vec4 u_viewportRect;
    uniform mat2 u_viewportTransform;
    uniform int u_markerType;
    uniform float u_markerScale;
    uniform vec2 u_markerScalarRange;
    uniform float u_markerOpacity;
    uniform bool u_useColorFromMarker;
    uniform sampler2D u_colorLUT;
    uniform sampler2D u_colorscale;

    attribute vec4 a_position;

    varying vec4 v_color;
    varying vec2 v_shapeOrigin;
    varying float v_shapeColorBias;

    #define MARKER_TYPE_BARCODE 0
    #define MARKER_TYPE_CP 1
    #define SHAPE_GRID_SIZE 4.0

    vec3 hex_to_rgb(float v)
    {
        // Extract RGB color from 24-bit hex color stored in float
        v = clamp(v, 0.0, 16777215.0);
        return floor(mod((v + 0.49) / vec3(65536.0, 256.0, 1.0), 256.0)) / 255.0;
    }

    void main()
    {
        vec2 imagePos = a_position.xy * u_imageSize;
        vec2 viewportPos = imagePos - u_viewportRect.xy;
        vec2 ndcPos = (viewportPos / u_viewportRect.zw) * 2.0 - 1.0;
        ndcPos.y = -ndcPos.y;
        ndcPos = u_viewportTransform * ndcPos;

        if (u_markerType == MARKER_TYPE_BARCODE) {
            v_color = texture2D(u_colorLUT, vec2(a_position.z, 0.5));
        } else if (u_markerType == MARKER_TYPE_CP) {
            vec2 range = u_markerScalarRange;
            float normalized = (a_position.z - range[0]) / (range[1] - range[0]);
            v_color.rgb = texture2D(u_colorscale, vec2(normalized, 0.5)).rgb;
            v_color.a = 7.0 / 255.0;  // Give CP markers a round shape
        }

        if (u_useColorFromMarker) v_color.rgb = hex_to_rgb(a_position.w);

        gl_Position = vec4(ndcPos, 0.0, 1.0);
        gl_PointSize = max(2.0, u_markerScale / u_viewportRect.w);

        v_shapeOrigin.x = mod(v_color.a * 255.0 - 1.0, SHAPE_GRID_SIZE);
        v_shapeOrigin.y = floor((v_color.a * 255.0 - 1.0) / SHAPE_GRID_SIZE);
        v_shapeColorBias = max(0.0, 1.0 - gl_PointSize * 0.2);

        // Discard point here in vertex shader if marker is hidden
        v_color.a = v_color.a > 0.0 ? u_markerOpacity : 0.0;
        if (v_color.a == 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 0.0);
    }
`;


MARKERS_FS = `
    precision mediump float;

    uniform sampler2D u_shapeAtlas;

    varying vec4 v_color;
    varying vec2 v_shapeOrigin;
    varying float v_shapeColorBias;

    #define UV_SCALE 0.7
    #define SHAPE_GRID_SIZE 4.0

    void main()
    {
        vec2 uv = (gl_PointCoord.xy - 0.5) * UV_SCALE + 0.5;
        uv = (uv + v_shapeOrigin) * (1.0 / SHAPE_GRID_SIZE);

        vec4 shapeColor = texture2D(u_shapeAtlas, uv, -0.5);
        shapeColor.rgb = clamp(shapeColor.rgb + v_shapeColorBias, 0.0, 1.0);

        gl_FragColor = shapeColor * v_color;
        gl_FragColor.rgb *= gl_FragColor.a;  // Need to pre-multiply alpha
        if (gl_FragColor.a < 0.01) discard;
    }
`;


class glUtils {
    constructor(osdViewer, markerScale) {
        this.viewer = osdViewer;
        this._initialized = false;
        this._programs =  {};
        this._buffers = {};
        this._textures = {};
        this._numBarcodePoints = 0;
        this._numCPPoints = 0;
        this._imageSize = [1, 1];
        this._viewportRect = [0, 0, 1, 1];
         // Supply a default marker scale, but allow us to scale them down for annotations
        this._markerScale = markerScale ? markerScale: 1.0;
        this._markerScalarRange = [0.0, 1.0];
        this._markerOpacity = 1.0;
        this._useColorFromMarker = false;
        this._colorscaleName = "null";``
        this._colorscaleData = [];
        this._barcodeToLUTIndex = {};
        this._barcodeToKey = {};
        this._options = {antialias: false};
        this._showColorbar = true;

        const osd = this.viewer.element.getElementsByClassName("openseadragon-canvas")[0];

        this._canvas = this.viewer.element.getElementsByClassName("gl_canvas")[0];
        if (!this._canvas) this._canvas = this._createMarkerWebGLCanvas();
        const gl = this._canvas.getContext("webgl", this._options);

        // Place marker canvas under the OSD canvas. Doing this also enables proper
        // compositing with the minimap and other OSD elements.
        osd.appendChild(this._canvas);

        this._programs["markers"] = this._loadShaderProgram(gl, MARKERS_VS, MARKERS_FS);
        this._buffers["barcodeMarkers"] = this._createDummyMarkerBuffer(gl, this._numBarcodePoints);
        this._buffers["CPMarkers"] = this._createDummyMarkerBuffer(gl, this._numCPPoints);
        this._textures["colorLUT"] = this._createColorLUTTexture(gl);
        this._textures["colorscale"] = this._createColorScaleTexture(gl);
        this._textures["shapeAtlas"] = this._loadTextureFromImageURL(gl, PATH_MARKERSHAPES_IMG);

        this._createColorbarCanvas();  // The colorbar is drawn separately in a 2D-canvas

        this.updateMarkerScale();

        const self = this;
        const drawHandler = function(event) {
            self.draw();
        };
        document.getElementById("ISS_globalmarkersize_text").addEventListener(
            "input",
            function(event) {
                self.updateMarkerScale();
            }
        );
        document.getElementById("ISS_globalmarkersize_text").addEventListener("input", drawHandler);
        document.getElementById("ISS_markers").addEventListener(
            "change",
            function(event) {
             self.updateLUTTextures();
          }
        );
        document.getElementById("ISS_markers").addEventListener("change", drawHandler);

        tmapp["hideSVGMarkers"] = true;

        const resizeAndDrawHandler = function(event) {
            self.resizeAndDraw();
        };
        this.viewer.removeHandler('resize', resizeAndDrawHandler);
        this.viewer.addHandler('resize', resizeAndDrawHandler);
        this.viewer.removeHandler('open', drawHandler);
        this.viewer.addHandler('open', drawHandler);
        this.viewer.removeHandler('viewport-change', drawHandler);
        this.viewer.addHandler('viewport-change', drawHandler);

        this._initialized = true;
        this.resize();  // Force initial resize to OSD canvas size
        return this;
    }
};

glUtils.prototype.resize = function(){
    const gl = this._canvas.getContext("webgl", this._options);

    const newSize = this.viewer.viewport.containerSize;
    gl.canvas.width = newSize.x;
    gl.canvas.height = newSize.y;
}

glUtils.prototype._loadShaderProgram = function(gl, vertSource, fragSource) {
    const vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertSource);
    gl.compileShader(vertShader);
    if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
        console.log("Could not compile vertex shader: " + gl.getShaderInfoLog(vertShader));
    }

    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragSource);
    gl.compileShader(fragShader);
    if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
        console.log("Could not compile fragment shader: " + gl.getShaderInfoLog(fragShader));
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.deleteShader(vertShader);  // Flag shaders for automatic deletion after
    gl.deleteShader(fragShader);  // their program object is destroyed
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.log("Unable to link shader program: " + gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }

    return program;
}


glUtils.prototype._createDummyMarkerBuffer = function(gl, numPoints) {
    const positions = [];
    for (let i = 0; i < numPoints; ++i) {
        positions[4 * i + 0] = Math.random();  // X-coord
        positions[4 * i + 1] = Math.random();  // Y-coord
        positions[4 * i + 2] = Math.random();  // LUT-coord
        positions[4 * i + 3] = i / numPoints;  // Scalar data
    }

    const bytedata = new Float32Array(positions);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); 
    gl.bufferData(gl.ARRAY_BUFFER, bytedata, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return buffer;
}


// Load barcode markers loaded from CSV file into vertex buffer
glUtils.prototype.loadMarkers = function() {
    if (!this._initialized) return;
    const gl = this._canvas.getContext("webgl", this._options);

    const markerData = dataUtils["ISS_processeddata"];
    const numPoints = markerData.length;
    const keyName = document.getElementById("ISS_key_header").value;


    const imageWidth = OSDViewerUtils.getImageWidth(this.viewer);
    const imageHeight = OSDViewerUtils.getImageHeight(this.viewer);

    // If new marker data was loaded, we need to assign each barcode an index
    // that we can use with the LUT textures for color, visibility, etc.
    this._updateBarcodeToLUTIndexDict(markerData, keyName);

    const colorPropertyName = markerUtils._uniqueColorSelector;
    const useColorFromMarker = markerUtils._uniqueColor && (colorPropertyName in markerData[0]);
    let hexColor = "#000000";

    const positions = [];
    for (let i = 0; i < numPoints; ++i) {
        if (useColorFromMarker) hexColor = markerData[i][colorPropertyName];
        positions[4 * i + 0] = markerData[i].global_X_pos / imageWidth;
        positions[4 * i + 1] = markerData[i].global_Y_pos / imageHeight;
        positions[4 * i + 2] = this._barcodeToLUTIndex[markerData[i].letters] / 4095.0;
        positions[4 * i + 3] = Number("0x" + hexColor.substring(1,7));
    }

    const bytedata = new Float32Array(positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers["barcodeMarkers"]);
    gl.bufferData(gl.ARRAY_BUFFER, bytedata, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this._numBarcodePoints = numPoints;
    this._useColorFromMarker = useColorFromMarker;
    this.updateLUTTextures();
}


// Load cell morphology markers loaded from CSV file into vertex buffer
glUtils.prototype.loadCPMarkers = function() {
    if (!this._initialized) return;

    const gl = this._canvas.getContext("webgl", this._options);

    const markerData = CPDataUtils["CP_rawdata"];
    const numPoints = markerData.length;
    const propertyName = document.getElementById("CP_property_header").value;
    const xColumnName = document.getElementById("CP_X_header").value;
    const yColumnName = document.getElementById("CP_Y_header").value;
    const colorscaleName = document.getElementById("CP_colorscale").value;
    const imageWidth = OSDViewerUtils.getImageWidth(this.viewer);
    const imageHeight = OSDViewerUtils.getImageHeight(this.viewer);

    const useColorFromMarker = colorscaleName.includes("ownColorFromColumn");
    let hexColor = "#000000";

    const positions = [];
    let scalarRange = [1e9, -1e9];
    for (let i = 0; i < numPoints; ++i) {
        if (useColorFromMarker) hexColor = markerData[i][propertyName];
        positions[4 * i + 0] = Number(markerData[i][xColumnName]) / imageWidth;
        positions[4 * i + 1] = Number(markerData[i][yColumnName]) / imageHeight;
        positions[4 * i + 2] = Number(markerData[i][propertyName]);
        positions[4 * i + 3] = Number("0x" + hexColor.substring(1,7));
        scalarRange[0] = Math.min(scalarRange[0], positions[4 * i + 2]);
        scalarRange[1] = Math.max(scalarRange[1], positions[4 * i + 2]);
    }

    const bytedata = new Float32Array(positions);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers["CPMarkers"]);
    gl.bufferData(gl.ARRAY_BUFFER, bytedata, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this._numCPPoints = numPoints;
    this._markerScalarRange = scalarRange;
    this._colorscaleName = colorscaleName;
    this._updateColorScaleTexture(gl, this._textures["colorscale"]);
    this._updateColorbarCanvas(colorscaleName, this._colorscaleData, propertyName, scalarRange);
    this.draw();  // Force redraw
}


glUtils.prototype._updateBarcodeToLUTIndexDict = function(markerData, keyName) {
    const barcodeToLUTIndex = {};
    const barcodeToKey = {};
    const numPoints = markerData.length;
    for (let i = 0, index = 0; i < numPoints; ++i) {
        const barcode = markerData[i].letters;
        const gene_name = markerData[i].gene_name;
        if (!(barcode in barcodeToLUTIndex)) {
            barcodeToLUTIndex[barcode] = index++;
            barcodeToKey[barcode] = (keyName == "letters" ? barcode : dataUtils.getKeyFromString(gene_name));
        }
    }
    this._barcodeToLUTIndex = barcodeToLUTIndex;
    this._barcodeToKey = barcodeToKey;
}


glUtils.prototype._createColorLUTTexture = function(gl) {
    const randomColors = [];
    for (let i = 0; i < 4096; ++i) {
        randomColors[4 * i + 0] = Math.random() * 256.0; 
        randomColors[4 * i + 1] = Math.random() * 256.0;
        randomColors[4 * i + 2] = Math.random() * 256.0;
        randomColors[4 * i + 3] = Math.floor(Math.random() * 7) + 1;
    }

    const bytedata = new Uint8Array(randomColors);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); 
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4096, 1, 0, gl.RGBA,
                  gl.UNSIGNED_BYTE, bytedata);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return texture;
}


glUtils.prototype._updateColorLUTTexture = function(gl, texture) {
    const allMarkersCheckbox = document.getElementById("AllMarkers-checkbox-ISS");
    const showAll = allMarkersCheckbox && allMarkersCheckbox.checked;

    const colors = new Array(4096 * 4);
    for (let [barcode, index] of Object.entries(this._barcodeToLUTIndex)) {
        // Get color, shape, etc. from HTML input elements for barcode
        const key = this._barcodeToKey[barcode];  // Could be barcode or gene name
        hexInput = document.getElementById(key + "-color-ISS")
        if (hexInput) {
            var hexColor = document.getElementById(key + "-color-ISS").value;
        }
        else {
            var hexColor = "#000000";
        }
        const shape = document.getElementById(key + "-shape-ISS").value;
        const visible = showAll || markerUtils._checkBoxes[key].checked;
        colors[4 * index + 0] = Number("0x" + hexColor.substring(1,3)); 
        colors[4 * index + 1] = Number("0x" + hexColor.substring(3,5));
        colors[4 * index + 2] = Number("0x" + hexColor.substring(5,7));
        colors[4 * index + 3] = Number(visible) * (Number(shape) + 1);
    }

    const bytedata = new Uint8Array(colors);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4096, 1, 0, gl.RGBA,
                  gl.UNSIGNED_BYTE, bytedata);
    gl.bindTexture(gl.TEXTURE_2D, null);
}


glUtils.prototype._createColorScaleTexture = function(gl) {
    const bytedata = new Uint8Array(256 * 4);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA,
                  gl.UNSIGNED_BYTE, bytedata);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return texture;
}


glUtils.prototype._formatHex = function(color) {
    if (color.includes("rgb")) {
        const r = color.split(",")[0].replace("rgb(", "").replace(")", "");
        const g = color.split(",")[1].replace("rgb(", "").replace(")", "");
        const b = color.split(",")[2].replace("rgb(", "").replace(")", "");
        const hex = (Number(r) * 65536 + Number(g) * 256 + Number(b)).toString(16);
        color = "#" + ("0").repeat(6 - hex.length) + hex;
    }
    return color;
}


glUtils.prototype._updateColorScaleTexture = function(gl, texture) {
    const colors = [];
    for (let i = 0; i < 256; ++i) {
        const normalized = i / 255.0;
        if (this._colorscaleName.includes("interpolate") &&
            !this._colorscaleName.includes("Rainbow")) {
            const color = d3[this._colorscaleName](normalized);
            const hexColor = this._formatHex(color);  // D3 sometimes returns RGB strings
            colors[4 * i + 0] = Number("0x" + hexColor.substring(1,3));
            colors[4 * i + 1] = Number("0x" + hexColor.substring(3,5));
            colors[4 * i + 2] = Number("0x" + hexColor.substring(5,7));
            colors[4 * i + 3] = 255.0;
        } else {
            // Use a version of Google's Turbo colormap with brighter blue range
            // Reference: https://www.shadertoy.com/view/WtGBDw
            const r = Math.sin((normalized - 0.33) * 3.141592);
            const g = Math.sin((normalized + 0.00) * 3.141592);
            const b = Math.sin((normalized + 0.33) * 3.141592);
            const s = 1.0 - normalized;  // For purplish tone at end of the range
            colors[4 * i + 0] = Math.max(0.0, Math.min(1.0, r * (1.0 - 0.5 * b*b) + s*s)) * 255.99;
            colors[4 * i + 1] = Math.max(0.0, Math.min(1.0, g * (1.0 - r*r * b*b))) * 255.99;
            colors[4 * i + 2] = Math.max(0.0, Math.min(1.0, b * (1.0 - 0.5 * r*r))) * 255.99;
            colors[4 * i + 3] = 255.0;
        }
    }
    this._colorscaleData = colors;

    const bytedata = new Uint8Array(colors);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA,
                  gl.UNSIGNED_BYTE, bytedata);
    gl.bindTexture(gl.TEXTURE_2D, null);
}


glUtils.prototype._updateColorbarCanvas = function(colorscaleName, colorscaleData, propertyName, propertyRange) {
    const canvas = this.viewer.element.getElementByClassName("CP_colorbar");
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!this._showColorbar || colorscaleName == "null" ||
        colorscaleName == "ownColorFromColumn") return;

    const gradient = ctx.createLinearGradient(64, 0, 256+64, 0);
    const numStops = 32;
    for (let i = 0; i < numStops; ++i) {
        const normalized = i / (numStops - 1);
        const index = Math.floor(normalized * 255.99);
        const r = Math.floor(colorscaleData[4 * index + 0]);
        const g = Math.floor(colorscaleData[4 * index + 1]);
        const b = Math.floor(colorscaleData[4 * index + 2]);
        gradient.addColorStop(normalized, "rgb(" + r + "," + g + "," + b + ")");
    }

    // Draw colorbar (with outline)
    ctx.fillStyle = gradient;
    ctx.fillRect(64, 64, 256, 16);
    ctx.strokeStyle = "#555";
    ctx.strokeRect(64, 64, 256, 16);

    // Convert range annotations to scientific notation if they may overflow
    let propertyMin = propertyRange[0].toString();
    let propertyMax = propertyRange[1].toString();
    if (propertyMin.length > 9) propertyMin = propertyRange[0].toExponential(5);
    if (propertyMax.length > 9) propertyMax = propertyRange[1].toExponential(5);

    // Draw annotations (with drop shadow)
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#000";  // Shadow color
    ctx.fillText(propertyName, ctx.canvas.width/2+1, 32+1);
    ctx.fillText(propertyMin, ctx.canvas.width/2-128+1, 56+1);
    ctx.fillText(propertyMax, ctx.canvas.width/2+128+1, 56+1);
    ctx.fillStyle = "#fff";  // Text color
    ctx.fillText(propertyName, ctx.canvas.width/2, 32);
    ctx.fillText(propertyMin, ctx.canvas.width/2-128, 56);
    ctx.fillText(propertyMax, ctx.canvas.width/2+128, 56);
}


// Creates a 2D-canvas for drawing the colorbar on top of the WebGL-canvas
glUtils.prototype._createColorbarCanvas = function() {
    let canvas = this.viewer.element.getElementsByClassName("CP_colorbar")[0];

    if (canvas) {
        return;
    }

    const root = this._canvas.parentElement;
    canvas = document.createElement("canvas");
    root.appendChild(canvas);

    canvas.className = "CP_colorbar";
    canvas.width = "384";  // Fixed width in pixels
    canvas.height = "96";  // Fixed height in pixels
    canvas.style = "position:relative; float:left; width:31%; left:68%; " +
                   "margin-top:-9%; z-index:20; pointer-events:none";
}


// Creates WebGL canvas for drawing the markers
glUtils.prototype._createMarkerWebGLCanvas = function() {
    const canvas = document.createElement("canvas");
    canvas.className = "gl_canvas";
    canvas.width = "1"; canvas.height = "1";
    canvas.style = "position:relative; pointer-events:none";
    return canvas;
}


glUtils.prototype._loadTextureFromImageURL = function(gl, src) {
    const texture = gl.createTexture();
    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); 
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);  // Requires power-of-two size images
        gl.bindTexture(gl.TEXTURE_2D, null);
    };
    image.src = src;
    return texture;
}


// @deprecated Not required anymore, but kept for backwards-compatibility
glUtils.prototype.clearNavigatorArea = function() {}


glUtils.prototype.draw = function() {
    if (!this._initialized) return;

    const gl = this._canvas.getContext("webgl", this._options);

    const bounds = this.viewer.viewport.getBounds();
    this._viewportRect = [bounds.x, bounds.y, bounds.width, bounds.height];
    const homeBounds = this.viewer.world.getHomeBounds();
    this._imageSize = [homeBounds.width, homeBounds.height];
    const orientationDegrees = this.viewer.viewport.getRotation();

    // The OSD viewer can be rotated, so need to apply the same transform to markers
    const t = orientationDegrees * (3.141592 / 180.0);
    const viewportTransform = [Math.cos(t), -Math.sin(t), Math.sin(t), Math.cos(t)];

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const program = this._programs["markers"];

    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const POSITION = gl.getAttribLocation(program, "a_position");
    gl.uniform2fv(gl.getUniformLocation(program, "u_imageSize"), this._imageSize);
    gl.uniform4fv(gl.getUniformLocation(program, "u_viewportRect"), this._viewportRect);
    gl.uniformMatrix2fv(gl.getUniformLocation(program, "u_viewportTransform"), false, viewportTransform);
    gl.uniform2fv(gl.getUniformLocation(program, "u_markerScalarRange"), this._markerScalarRange);
    gl.uniform1f(gl.getUniformLocation(program, "u_markerOpacity"), this._markerOpacity);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._textures["colorLUT"]);
    gl.uniform1i(gl.getUniformLocation(program, "u_colorLUT"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._textures["colorscale"]);
    gl.uniform1i(gl.getUniformLocation(program, "u_colorscale"), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this._textures["shapeAtlas"]);
    gl.uniform1i(gl.getUniformLocation(program, "u_shapeAtlas"), 2);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers["barcodeMarkers"]);
    gl.enableVertexAttribArray(POSITION);
    gl.vertexAttribPointer(POSITION, 4, gl.FLOAT, false, 0, 0);
    gl.uniform1i(gl.getUniformLocation(program, "u_markerType"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "u_markerScale"), this._markerScale);
    gl.uniform1i(gl.getUniformLocation(program, "u_useColorFromMarker"), this._useColorFromMarker);
    gl.drawArrays(gl.POINTS, 0, this._numBarcodePoints);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers["CPMarkers"]);
    gl.enableVertexAttribArray(POSITION);
    gl.vertexAttribPointer(POSITION, 4, gl.FLOAT, false, 0, 0);
    gl.uniform1i(gl.getUniformLocation(program, "u_markerType"), 1);
    gl.uniform1f(gl.getUniformLocation(program, "u_markerScale"), this._markerScale * 0.5);
    gl.uniform1i(gl.getUniformLocation(program, "u_useColorFromMarker"),
        this._colorscaleName.includes("ownColorFromColumn"));
    if (this._colorscaleName != "null") {  // Only show markers when a colorscale is selected
        gl.drawArrays(gl.POINTS, 0, this._numCPPoints);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.blendFunc(gl.ONE, gl.ONE);
    gl.disable(gl.BLEND);
    gl.useProgram(null);
}

glUtils.prototype.resizeAndDraw = function() {
    if (!this._initialized) return;

    this.resize();
    this.draw();
}

// @deprecated Not required anymore, but kept for backwards-compatibility
glUtils.prototype.postRedraw = function() {}


glUtils.prototype.updateMarkerScale = function() {
    const globalMarkerSize = Number(document.getElementById("ISS_globalmarkersize_text").value);
    // Clamp the scale factor to avoid giant markers and slow rendering if the
    // user inputs a very large value (say 10000 or something)
    this._markerScale = Math.max(0.01, Math.min(5.0, globalMarkerSize / 100.0));
}


glUtils.prototype.updateLUTTextures = function() {
    if (!this._initialized) return;

    const gl = this._canvas.getContext("webgl", this._options);

    if (this._numBarcodePoints > 0) {  // LUTs are currently only used for barcode data
        this._updateColorLUTTexture(gl, this._textures["colorLUT"]);
    }
}

window.glUtils = glUtils;

