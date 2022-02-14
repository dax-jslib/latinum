/**
 * @module latinum
 * @description This is the main module for Latinum. In order to use Latinum, you should include
 * this in your HTML file using the following code:
 *
 * ```
 * <script type="module" src="{path_to}/latinum.mod.js"></script>
 * ```
 * Thereafter a global instance of latinum is available as `window.$latinum` that you should use to
 * further configure and initialize Latinum, as shown below:
 *
 * ```
 * <script>
 * window.addEventListener("LatinumLoaded", event => {
 *     $latinum.enableLogging();
 *     $latinum.setStore("hello-something");
 *     $latinum.definition.JSON.all("latinum.json");
 *     $latinum.init().then(function() {
 *         console.log("all good");
 *     }).catch(function(err) {
 *         console.log("something has gone wrong");
 *         console.log(err);
 *     });
 * });
 * </script>
 * ```
 */

import Logger from "./vflogger.mod.js";
import { definition, defnLoader } from "./latinum-definition.mod.js";
import contLoader from "./latinum-content.mod.js";
import renderers from "./latinum-renderer.mod.js";
import director   from "./latinum-director.mod.js";

/*
this ensures that all ajax calls from jquery will have a random query appended at the end so as to
forcefully ensure no caching on the client side.
*/
$.ajaxSetup({ cache: false });

Logger.setLevel(Logger.OFF); //by default, logging is disabled.

/**
 * The constructor function that is used to create an instance of this class.
 * @class
 * @classdesc This is the main class and the entry point for latinum.
 */

var Latinum = function() {

	var _L = Logger.get("Latinum");

/**
 * A context that is used to register custom operations to be performed when a layout or a page
 * changes
 */

	var actionCtxt = {};

/**
 * Sets the locations and formats of definition files for configuring the layouts and pages that
 * make up a site. These definition files are made available on the server side and may have an
 * internal format of either XML or JSON.
 * @type { module:latinum-definition~Definition }
 */

	this.definition = definition;

/**
 * Sets the site identifier information for client-side caching.
 * @param {string} id the store identifier.
 */

	this.setSiteId = function(id) {
		contLoader.setSiteId(id);
	}

/**
 * Retrieves the site identifier.
 */

	this.siteId = function() {
		return contLoader.siteId();
	}

/**
 * By default, logging is switched off for Latinum. Calling this function will enable the same.
 * Note: this is not recommended for production sites.
 */

	this.enableLogging = function(level) {
		Logger.setLevel(Logger.ERROR);
		if(typeof level === "string") {
			if(level === "debug") {
				Logger.setLevel(Logger.DEBUG);
			}
			else if(level === "info") {
				Logger.setLevel(Logger.INFO);
			}
			else if(level === "warn") {
				Logger.setLevel(Logger.WARN);
			}
		}
	}

	this.registerAction = function(name, action) {
		_L.debug("registering action: " + name);
		actionCtxt[name] = action;
	}

/**
 * Prepares the framework and composes and renders the default (welcome) page within its layout and
 * the scaffold where latinum is embedded.
 */

	this.init = function() {
		contLoader.addExtensions(renderers.listExtensions());
		return new Promise(function (resolve, reject) {
			defnLoader.init().then(function() {
				defnLoader.dumpSiteData();
				if(defnLoader.siteId() != null) {
					contLoader.setSiteId(defnLoader.siteId());
				}
				contLoader.init().then(function() {
					director.init(actionCtxt);
					resolve("ok");
				}).catch(err => {
					reject(err);
				});
			}).catch(err => {
				reject(err);
			});
		});
	}
}

/**
 * The global latinum instance.
 * @type { module:latinum~Latinum }
 */
let latinum = new Latinum();
export default latinum;

/** @global */
window.$latinum = latinum;

window.dispatchEvent(new Event("LatinumLoaded"));