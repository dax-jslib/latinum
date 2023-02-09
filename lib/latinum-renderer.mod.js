/**
 * @module latinum-renderer
 */

import { Logger } from "./latinum-logger.mod.js";
import { contentLoader } from "./latinum-content.mod.js";

/** @class */
var DirectRenderer = function() {

	var _L = Logger.get("DirectRenderer");

	this.populate = function(htmlTag, location) {
		_L.debug("populating direct {" + location + "}");
		return new Promise((resolve, reject) => {
			contentLoader.fetch(location).then(function(data) {
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
		contentLoader.addExtensions(extn);
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

var renderers = new Renderers();
renderers.addRenderer(".html", new DirectRenderer());
renderers.addRenderer(".htm", new DirectRenderer());
renderers.addRenderer(".css", new DirectRenderer());

export { renderers };