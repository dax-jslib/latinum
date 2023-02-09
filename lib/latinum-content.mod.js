/**
 * @module      latinum-content
 * @description fetches and optionally caches pages and layout content from a remote location.
 */

import { Logger } from "./latinum-logger.mod.js";
import { defnLoader } from "./latinum-definition.mod.js";

/**
 * @class
 */

var ContentLoader = function() {
	var _L = Logger.get("ContentLoader");

	const EXT_PAT = /\.([0-9a-z]+)(?=[?#])|(\.)(?:[\w]+)$/

	var KEY_PREFIX, VERSION_KEY, cacheEnabled = false;
	var siteId = null;
	var extensions = new Array();

/**
 *
 * @param {string} id
 */

	this.setSiteId = function(id) {
		siteId = id;
		_L.info("site id set to : " + siteId);
	}

	this.siteId = function() {
		return siteId;
	}

/**
 *
 * @param {string | Array} extn
 */

	this.addExtensions = function(extn) {
		if(typeof extn === "string") {
			extensions.push(extn);
		}
		else if(Array.isArray(extn)) {
			extensions.concat(extn);
		}
	}

/**
 *
 */

	this.init = function() {
		if(siteId == null) {
			_L.debug("caching content into local storage is disabled. No site id");
			return Promise.resolve("ok");
		}

		KEY_PREFIX  = "LN." + siteId + ".cnt:";
		VERSION_KEY = "LN." + siteId + ".version";

		let latestVer = defnLoader.currentVersion(); // this is the latest version as obtained from the server.
		_L.debug("latest version from server : " + latestVer);
		if(latestVer == null) {
			_L.debug("caching content into local storage is disabled");
			clearCached();
			return Promise.resolve("ok");
		}

		cacheEnabled = true;

		let currentVer = sessionStorage.getItem(VERSION_KEY);
		if(currentVer === latestVer) {
			_L.debug("versions match. Nothing to cache");
			return Promise.resolve("ok");
		}

		clearCached();
		var remotePaths = {};
		var pages = defnLoader.listPages();
		pages.forEach(function(pg) {
			//prefetch the page content
			remotePaths[pg.path] = true;

			// prefetch the page layout
			remotePaths[pg.layout] = true;

			// prefetch the page inserts that translate to a fragment
			for(var key in pg.inserts) {
				var insval = pg.inserts[key];
				if(getFileExtension0(insval) != null) {
					remotePaths[insval] = true;
				}
			}
			// prefetch the view styles that translate to a css fragment
			for(var sid in pg.styles) {
				remotePaths[pg.styles[sid]] = true;
			}
		});

		return new Promise((resolve, reject) =>{
			_L.debug("prefetching", remotePaths);
			var promArr = [];
			for(var path in remotePaths) {
				promArr.push(cacheContent(path));
			}
			Promise.all(promArr).finally(function() {
				sessionStorage.setItem(VERSION_KEY, latestVer);
				resolve("ok");
			});
		});
	}

/**
 *
 * @param {*} location
 */

	this.fetch = function(location) {
		let prom = null;
		if(cacheEnabled) {
			let ckey = KEY_PREFIX + location;
			_L.debug("using cache content at " + ckey);
			let data = sessionStorage.getItem(ckey);
			if(data != null) {
				prom = Promise.resolve(data);
			}
			else {
				_L.debug("cache miss!! -> " + ckey);
				prom = cacheContent(location);
			}
		}
		else {
			prom = new Promise((resolve, reject) => {
				$.get(location, function(data) {
					resolve(data);
				}).fail(function(err) {
					reject(err);
				});
			});
		}
		return prom;
	}

	this.getFileExtension = function(location) {
		return getFileExtension0(location);
	}

	//// HELPER METHODS ////////////////////////////////////////////////////////////////////////////

	function getFileExtension0(location) {
		var extnArr = location.match(EXT_PAT);
		if(extnArr === null || extnArr.length === 0) {
			return null;
		}

		var extn = extnArr[0].toLowerCase();
		var pos = extensions.indexOf(extn);
		if(pos < 0) {
			return null;
		}
		return extensions[pos];
	}

	function clearCached() {
		var keysToRemove = [];
		// prepare a list of all keys to be removed from local storage
		for (var i = 0; i < sessionStorage.length; ++i ) {
			if(sessionStorage.key(i).startsWith(KEY_PREFIX)) {
				keysToRemove.push(localStorage.key(i));
			}
		}
		// and remove.
		keysToRemove.forEach(key => {
			sessionStorage.removeItem(key);
		});

		//also remove current version
		sessionStorage.removeItem(VERSION_KEY);
	}

	function cacheContent (location) {
		return new Promise((resolve, reject) => {
			_L.debug("loading into session storage " + location);
			$.get(location, function(data) {
				try {
					sessionStorage.setItem(KEY_PREFIX + location, data);
				}
				catch(err) {
					_L.warn(err);
					reject(err);
				}
				resolve(data);
			}).fail(function(err) {
				_L.warn(err);
				reject(err);
			});
		});
	}
}

/**
 * the content loader
 */
var contentLoader = new ContentLoader();
export { contentLoader };