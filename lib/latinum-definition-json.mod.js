/**
 * @module latinum-definition-json
 */

import Logger from "./vflogger.mod.js";
import MurmurHash3 from "./murmurhash.mod.js";

/** @class */
var JsonDefinitionLoader = function(siteData) {

	var _L = Logger.get("JsonDefinitionLoader");

	this.loadAll = loadAll;
	this.loadTemplate = loadTemplate;
	this.loadContent = loadContent;

	function loadAll(jsonData) {
		_L.debug("definitions data [all]:");
		_L.debug(jsonData);
		if(typeof jsonData["template"] !== "object") {
			throw "bad_format: missing node: template";
		}
		if(typeof jsonData["content"] !== "object") {
			throw "bad_format: missing node: content";
		}
		loadTemplate(jsonData["template"]);
		loadContent(jsonData["content"]);
	}

	function loadTemplate(jsonData) {
		_L.debug("definitions data [template]:");
		_L.debug(jsonData);

		if(typeof jsonData.layouts === "undefined" || !Array.isArray(jsonData.layouts)) {
			_L.warn("definition does not have any layout");
			return;
		}

		var mmh = new MurmurHash3();

		let layoutMap = {}; //use this to ensure no duplicate layouts identified by their respective
		// slugs.

		if(typeof jsonData["template-id"] === "string") {
			siteData.tplId = jsonData["template-id"];
		}

		if(typeof jsonData["version"] === "string") {
			siteData.tplVer = jsonData["version"];
		}

		jsonData.layouts.forEach(function(lout) {
			if(typeof lout.id === "undefined" || lout.id == null
					|| typeof lout.path === "undefined" || lout.path == null) {
				return;
			}

			var layout = { id : lout.id, path : lout.path, title : lout.title };

			layout.inserts = {};
			if(typeof lout.inserts !== "undefined" && lout.inserts) {
				for(var key in lout.inserts) {
					if (lout.inserts.hasOwnProperty(key)) {
						layout.inserts[key] = lout.inserts[key];
					}
				}
			}

			layout.styles = {};
			if(typeof lout.styles !== "undefined" && lout.styles) {
				if(Array.isArray(lout.styles)) {
					lout.styles.forEach(function (st) {
						layout.styles[mmh.hash(st)] = st;
					});
				}
				else {
					layout.styles[mmh.hash(lout.styles)] = lout.styles;
				}
			}

			layout.enterAxns = _resolveActions(lout, "enter");
			layout.exitAxns = _resolveActions(lout, "exit");
			layout.enterPageAxns = _resolveActions(lout, "enter-page");
			layout.exitPageAxns = _resolveActions(lout, "exit-page");

			layoutMap[loutId] = layout;
		});

		//get all unique layouts from the map values and update sitedata
		siteData.layouts = Object.values(layoutMap);

		_L.debug("loaded " + siteData.layouts.length + " layout(s)");

		if(typeof jsonData["default-layout"] !== "string") {
			_L.warn("definition does not specify a default layout");
		}
		else {
			let dlid = jsonData["default-layout"];

			if(layoutMap.hasOwnProperty(dlid) && layoutMap[dlid] != null) {
				siteData.defaultLayout = dlid;
				_L.debug("default layout id : " + siteData.defaultLayout.id);
			}
			else {
				_L.warn("definition specifies a default layout id, but corresponding layout not found");
			}

			/*
			for(var i=0; i<siteData.layouts.length; i++) {
				if(siteData.layouts[i].id === dlid) {
					siteData.defaultLayout = siteData.layouts[i];
					break;
				}
			}
			if(siteData.defaultLayout == null) {
				_L.warn("definition specifies a default layout id, but corresponding layout not found");
			}
			else {
				_L.debug("default layout id : " + siteData.defaultLayout.id);
			}
			*/
		}

		if(typeof jsonData["not-found"] === "string") {
			siteData.notFound = jsonData["not-found"];
		}

/*
 * Now load the default pages that have been specified as part of the template
 */

		if(typeof jsonData.pages === "undefined" || !Array.isArray(jsonData.pages)) {
			_L.debug("definition does not have any pages");
			return;
		}
		loadPages(jsonData);
	}

	function loadContent(jsonData) {
		_L.debug("definitions data [content]:");
		_L.debug(jsonData);

		if(typeof jsonData["site-name"] === "string") {
			siteData.siteName = jsonData["site-name"];
		}

		if(typeof jsonData["site-id"] === "string") {
			siteData.siteId = jsonData["site-id"];
		}

		if(typeof jsonData["version"] === "string") {
			siteData.cntVer = jsonData["version"];
		}

		if(typeof jsonData.pages === "undefined" || !Array.isArray(jsonData.pages)) {
			_L.warn("definition does not have any pages");
			return;
		}
		loadPages(jsonData);

		if(siteData.welcomePage == null) {
			_L.warn("definition does not specify a welcome page");
		}

		if(siteData.notFoundPage == null) {
			_L.warn("definition does not specify a 404 page");
		}

		_L.debug("loaded " + siteData.pages.length + " page(s)");
	}

	function loadPages(jsonData) {

		let pageMap = {}; //use this to ensure no duplicate pages identified by their respective
		// slugs.

		// first populate the page map
		siteData.pages.forEach(function(page) {
			pageMap[page.slug] = page;
		});

		jsonData.pages.forEach(function(pg) {

			if(typeof pg.slug === "undefined" || pg.slug == null
					|| typeof pg.path === "undefined" || pg.path == null) {
				return;
			}

			var layout = siteData.defaultLayout; //start by setting the page layout to be the default layout.
			if(typeof pg["layout-id"] === "string" && pg["layout-id"] != null) {
				let match = false;
				for(var i = 0; i < siteData.layouts.length; i++) {
					if( siteData.layouts[i].id == pg["layout-id"]) {
						layout =  siteData.layouts[i];
						match = true;
						break;
					}
				}
				//at this point if a matching layout is not found for the given id, we still have the
				//page layout at default.
				if(!match) {
					_L.warn("pages specifies a layout id but matching layout not found");
				}
			}
			else {
				_L.debug("page does not specify a layout. Will use default");
			}
			if(layout == null) {
				//page must have a layout.
				_L.warn("page not added. Layout could not be determined");
				return;
			}

			var page = { slug : pg.slug, path : pg.path, layout : layout.path };

			//resolving the page title
			page.title = null; //set the default title placeholder to be null
			if(typeof layout.title !== "undefined" && layout.title) {
				if(typeof pg.title !== "undefined" && pg.title) {
					page.title = layout.title.replace("_title_", pg.title);
				}
				else {
					page.title = layout.title;
				}
			}
			else if(typeof pg.title !== "undefined") {
				page.title = pg.title;
			}

			//resolve the page parameters
			page.parameters = new Array();
			if(typeof pg.parameters !== "undefined" && pg.parameters) {
				if(Array.isArray(pg.parameters)) {
					page.parameters = page.parameters.concat(pg.parameters);
				}
				else {
					page.parameters.push(pg.parameters);
				}
			}

			//resolve the page inserts
			page.inserts = {};
			for(var key in layout.inserts) {
				if (layout.inserts.hasOwnProperty(key)) {
					page.inserts[key] = layout.inserts[key];
				}
			}
			if(typeof pg.inserts !== "undefined" && pg.inserts) {
				for(var key in pg.inserts) {
					if (pg.inserts.hasOwnProperty(key)) {
						page.inserts[key] = pg.inserts[key];
					}
				}
			}

			//resolve the page actions
			page.enterLayoutAxns = layout.enterAxns;
			page.exitLayoutAxns = layout.exitAxns;
			page.enterAxns = layout.enterPageAxns.concat(_resolveActions(pg, "enter"));
			page.exitAxns = layout.exitPageAxns.concat(_resolveActions(pg, "exit"));

			//resolve the page styles: copy from layout
			page.styles = layout.styles;

			if(pg["welcome-page"]) {
				if(siteData.welcomePage != null) {
					_L.warn("welcome page has already been set. overwriting with " + slug);
				}
				siteData.welcomePage = page.slug;
			}
			if(pg["not-found-page"]) {
				if(siteData.notFoundPage != null) {
					_L.warn("404 page has already been set. overwriting with " + slug);
				}
				siteData.notFoundPage = page.slug;
			}

			pageMap[slug] = page;
		});
		siteData.pages = Object.values(pageMap);
	}

	function _resolveActions(node, key) {
		var actions = new Array();
		if((typeof node[key] !== "undefined") && node[key] != null) {
			if(Array.isArray(node[key])) {
				actions = actions.concat(node[key]);
			}
			else {
				actions.push(node[key]);
			}
		}
		return actions;
	}
}

export default JsonDefinitionLoader;