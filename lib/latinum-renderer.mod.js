/**
 * @module latinum-renderer
 */

import Logger from "./js-logger.mod.js";
import contLoader from "./latinum-content.mod.js";

var _L = Logger.get("L.rend");

/** @class */
var DirectRenderer = function() {

	this.populate = function(htmlTag, location) {
		_L.debug("populating direct {" + location + "}");
		return new Promise((resolve, reject) => {
			contLoader.fetch(location).then(function(data) {
				htmlTag.html(data);
				resolve();
			}).catch(err => {
				reject({
					"status" : err.status,
					"statusText" : err.statusText
				});
			});
		});
	}
}

/** @class */
var Renderers = function() {

	var rendMap = {};

	this.addRenderer = function (extn, renderer) {
		rendMap[extn] = renderer;
		contLoader.addExtensions(extn);
	}

	this.listExtensions = function() {
		return Object.keys(rendMap);
	}

	this.getRenderer = function (extn) {
		if(typeof rendMap[extn] === "undefined" || rendMap[extn] == null) {
			return null;
		}
		return rendMap[extn];
	}
}

var rend = new Renderers();
rend.addRenderer(".html", new DirectRenderer());
rend.addRenderer(".htm", new DirectRenderer());
rend.addRenderer(".css", new DirectRenderer());

export default rend;