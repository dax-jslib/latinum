/**
 * @module latinum-definition-xml
 */

import Logger from "./dax-logger.mod.js";
import MurmurHash3 from "./murmurhash.mod.js";

/** @class */
var XmlDefinitionLoader = function(siteData) {

	var _L = Logger.get("XmlDefinitionLoader");

	this.loadAll = function(xmlData) {
		_L.debug("definitions data [all]:");
		_L.debug(xmlData);

		if(xmlData == null) {
			_L.warn("bad_configuration: xml is empty or malformed");
			return;
		}

		let rElm = xmlData.documentElement;
		if(rElm.nodeName !== "latinum") {
			_L.warn("bad_configuration: root is not <latinum>");
			return;
		}

		let tcol = rElm.getElementsByTagName("template");
		if(tcol.length != 1) {
			_L.warn("bad_configuration: missing <template>");
			return;
		}
		loadTemplate0(tcol.item(0));

		let ccol = rElm.getElementsByTagName("content");
		if(ccol.length != 1) {
			_L.warn("bad_configuration: missing <content>");
			return;
		}
		loadContent0(ccol.item(0));
	}

	this.loadTemplate = function(xmlData) {
		_L.debug("definitions data [template]:");
		_L.debug(xmlData);

		if(xmlData == null) {
			_L.warn("bad_configuration: xml is empty or malformed");
			return;
		}

		var rElm = xmlData.documentElement;
		if(rElm.nodeName !== "template") {
			_L.warn("bad_configuration: root is not <template>");
			return;
		}

		loadTemplate0(rElm);
	}

	this.loadContent = function(xmlData) {
		_L.debug("definitions data [content]:");
		_L.debug(xmlData);

		if(xmlData == null) {
			_L.warn("bad_configuration: xml is empty or malformed");
			return;
		}

		var rElm = xmlData.documentElement;
		if(rElm.nodeName !== "content") {
			_L.warn("bad_configuration: root is not <content>");
			return;
		}

		loadContent0(rElm);
	}

	//// HELPER METHODS ////////////////////////////////////////////////////////////////////////////

	function loadTemplate0(tplElm) {
		let tplId = toSimpleValue(tplElm, "template-id");
		if(tplId != null && tplId.length > 0) {
			siteData.tplId = tplId;
		}

		let version = toSimpleValue(tplElm, "version");
		if(version != null && version.length > 0) {
			siteData.tplVer = version;
		}

		let loutCol = findCollection(tplElm, "layouts", "layout");
		if(loutCol == null || loutCol.length == 0) {
			_L.warn("definition does not have any layout");
			return;
		}

		var mmh = new MurmurHash3();

		let layoutMap = {}; //use this to ensure no duplicate layouts identified by their respective
		// slugs.

		Array.from(loutCol).forEach(function(lout) {
			if(!lout.hasAttribute("id")) {
				_L.warn("layout does not specify an id");
				return;
			}
			let loutId = lout.getAttribute("id");
			let loutPath = toSimpleValue(lout, "path");//findNodeValue(lout, "path");
			if(loutPath == null || loutPath.trim().length == 0) {
				_L.warn("layout does not specify a path");
				return;
			}
			let loutTitle = findNodeValue(lout, "title");

			var layout = { id : loutId, path : loutPath, title : loutTitle };

			layout.inserts = toSimpleMap(lout, "inserts", "insert");

			layout.styles = {};
			let styleArr = toSimpleArray(lout, "styles", "style");
			styleArr.forEach(function (st) {
				layout.styles[mmh.hash(st)] = st;
			});

			layout.enterAxns = toSimpleArray(lout, "enter", "action");
			layout.exitAxns = toSimpleArray(lout, "exit", "action");
			layout.enterPageAxns = toSimpleArray(lout, "enter-page", "action");
			layout.exitPageAxns = toSimpleArray(lout, "exit-page", "action");

			//setting up the default layout if at all
			if(lout.getElementsByTagName("default-layout").length == 1) {
				if(siteData.defaultLayout != null) {
					_L.warn("default layout has already been set. skipping this " + loutId);
				}
				else {
					siteData.defaultLayout = layout;
				}
			}

			layoutMap[loutId] = layout;
		});

		//get all unique layouts from the map values and update sitedata
		siteData.layouts = Object.values(layoutMap);

		if(siteData.defaultLayout == null) {
			_L.warn("definition does not specify a default layout");
		}

		_L.debug("loaded " + siteData.layouts.length + " layout(s)");

		let notFound = findNodeValue(tplElm, "not-found");
		if(notFound) {
			siteData.notFound = notFound;
		}

/*
 * Now load the default pages that have been specified as part of the template
 */

		let pgCol = findCollection(tplElm, "pages", "page");
		if(pgCol == null || pgCol.length == 0) {
			_L.debug("definition does not have any pages");
			return;
		}
		loadPages(pgCol);
	}

	function loadContent0(cntElem) {
		let siteName = toSimpleValue(cntElem, "site-name");
		if(siteName != null && siteName.length > 0) {
			siteData.siteName = siteName;
		}

		let siteId = toSimpleValue(cntElem, "site-id");
		if(siteId != null && siteId.length > 0) {
			siteData.siteId = siteId;
		}

		let version = toSimpleValue(cntElem, "version");
		if(version != null && version.length > 0) {
			siteData.cntVer = version;
		}

		let pgCol = findCollection(cntElem, "pages", "page");
		if(pgCol == null || pgCol.length == 0) {
			_L.warn("definition does not have any pages");
			return;
		}
		loadPages(pgCol);

		if(siteData.welcomePage == null) {
			_L.warn("definition does not specify a welcome page");
		}

		if(siteData.notFoundPage == null) {
			_L.warn("definition does not specify a 404 page");
		}

		_L.debug("loaded " + siteData.pages.length + " page(s)");
	}

	function loadPages(pgCol) {

		let pageMap = {}; //use this to ensure no duplicate pages identified by their respective
		// slugs.

		// first populate the page map
		siteData.pages.forEach(function(page) {
			pageMap[page.slug] = page;
		});

		Array.from(pgCol).forEach(function(pg) {
			let slug = toSimpleValue(pg, "slug");
			if(slug == null || slug.length == 0) {
				return;
			}

			let pgPath = toSimpleValue(pg, "path");
			if(pgPath == null || pgPath.length == 0) {
				return;
			}

			let pgLayout = toSimpleValue(pg, "layout");
			var layout = siteData.defaultLayout; //start by setting the page layout to be the default layout.
			if(pgLayout != null && pgLayout.length > 0) {
				let match = false;
				for(var i = 0; i < siteData.layouts.length; i++) {
					if( siteData.layouts[i].id == pgLayout) {
						layout =  siteData.layouts[i];
						match = true;
						break;
					}
				}
				//at this point if a matching layout is not found for the given id, we still have the
				//page layout at default.
				if(!match) {
					_L.warn("page specifies a layout id but matching layout not found", pgLayout);
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

			var page = { slug : slug, path : pgPath, layout : layout.path };

			//resolving the page title
			let pgTitle = findNodeValue(pg, "title");
			page.title = null; //set the default title placeholder to be null
			if(typeof layout.title !== "undefined" && layout.title) {
				if(pgTitle != null) {
					page.title = layout.title.replace("_title_", pgTitle);
				}
				else {
					page.title = layout.title;
				}
			}
			else {
				page.title = pgTitle;
			}

			//resolve the page parameters
			page.parameters = toSimpleArray(pg, "parameters", "name");

			//resolve the page inserts
			let pgInserts = toSimpleMap(pg, "inserts", "insert");
			page.inserts = Object.assign({}, layout.inserts, pgInserts);

			//resolve the page actions
			page.enterLayoutAxns = layout.enterAxns;
			page.exitLayoutAxns = layout.exitAxns;
			page.enterAxns = layout.enterPageAxns.concat(toSimpleArray(pg, "enter", "action"));
			page.exitAxns = layout.exitPageAxns.concat(toSimpleArray(pg, "exit", "action"));

			//resolve the page styles: copy from layout
			page.styles = layout.styles;

			//setting up the welcome page, if at all
			if(pg.getElementsByTagName("welcome-page").length == 1) {
				if(siteData.welcomePage != null) {
					_L.warn("welcome page has already been set. replacing with " + slug);
				}
				siteData.welcomePage = slug;
			}

			//setting up the 404 page, if at all
			if(pg.getElementsByTagName("not-found-page").length == 1) {
				if(siteData.notFoundPage != null) {
					_L.warn("404 page has already been set. replacing with " + slug);
				}
				siteData.notFoundPage = slug;
			}

			pageMap[slug] = page;
		});

		siteData.pages = Object.values(pageMap);
	}

	function findNodeValue(pnode, name) {
		let hcol = pnode.getElementsByTagName(name);
		if(hcol.length > 0) {
			if(typeof hcol.item(0).textContent === "string") {
				return hcol.item(0).textContent.trim();
			}
		}
		return null;
	}

	function toSimpleValue(pnode, name) {
		if(pnode.hasAttribute(name)) {
			return pnode.getAttribute(name);
		}
		let hcol = pnode.getElementsByTagName(name);
		if(hcol.length == 1) {
			if(typeof hcol.item(0).textContent === "string") {
				return hcol.item(0).textContent.trim();
			}
		}
		return null;
	}

	function findCollection(parentElem, collectionName, itemName) {
		//this gets you a reference to the <_collection_> node
		let colElem = parentElem.getElementsByTagName(collectionName);
		if(colElem.length != 1) {
			_L.warn("node " + collectionName + " missing or is more than one");
			return null;
		}

		//this gets you a collection of <_collection_item_> inside <_collection_>
		return colElem.item(0).getElementsByTagName(itemName);
	}

	function toSimpleArray(parentElem, nodeName, itemNodeName) {
		var retarr = new Array();
		//this gets you a reference to the <_array_> node
		let colArr = parentElem.getElementsByTagName(nodeName);
		if(colArr.length != 1) {
			_L.debug("node " + nodeName + " missing or is more than one");
			return retarr;
		}

		//this gets you a collection of <_array_item_> inside <_array_>
		let colItems = colArr.item(0).getElementsByTagName(itemNodeName);
		Array.from(colItems).forEach(function(item) {
			let val = item.textContent.trim();
			if(val.length > 0) {
				retarr.push(val);
			}
		});
		return retarr;
	}

	function toSimpleMap(parentElem, mapNodeName, itemNodeName) {
		var mapObj = {};

		//this gets you a reference to the <_map_> node
		let colMap = parentElem.getElementsByTagName(mapNodeName);
		if(colMap.length != 1) {
			_L.debug("node " + mapNodeName + " missing or is more than one");
			return;
		}

		//this gets you a collection of <_map_item_> inside <_map_>
		let colEntries = colMap.item(0).getElementsByTagName(itemNodeName);
		Array.from(colEntries).forEach(function(entry) {
			if(!entry.hasAttribute("name")) {
				return;
			}
			let name = entry.getAttribute("name").trim();
			if(name.length == 0) {
				return;
			}
			let value = entry.textContent.trim();
			if(value.length == 0) {
				return;
			}
			mapObj[name] = value;
		});

		return mapObj;
	}
}

export default XmlDefinitionLoader;