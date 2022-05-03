/**
 * @module latinum-definition
 */

import { Logger } from "./vflogger.mod.js";
import { JsonDefinitionLoader } from "./latinum-definition-json.mod.js";
import { XmlDefinitionLoader } from "./latinum-definition-xml.mod.js";

var defnData  = {
	"template" : { "path" : null, "format" : null },
	"content" : { "path" : null, "format" : null },
	"all" : { "path" : null, "format" : null }
};

/**
 * A definition file may describe either the template or the content for a Latinum site, or both.
 * These files have a syntax that is either XML or JSON. A template is a collection of layouts,
 * while the content is a collection of pages. Pages are embedded within layouts. The whole assembly
 * gets included within a HTML page that serves as the scaffold or outer shell.
 *
 * The layouts and pages specified in a definition file includes only the corresponding meta
 * information and not the actual content. The latter is loaded by Latinum on demand and optionally
 * cached on the client-side for faster page loads.
 *
 * @class
 * @summary Encapsulates the location and format of definition files that are used to configure
 * Latinum.
 */

var Definition = function() {

	var _L = Logger.get("Definition");

	function templateFrom (path, format) {
		defnData.all.path = null;
		defnData.template.path = path; defnData.template.format = format;
	}

	function contentFrom (path, format) {
		defnData.all.path = null;
		defnData.content.path = path; defnData.content.format = format;
	}

	function allFrom (path, format) {
		defnData.content.path = null; defnData.template.path = null;
		defnData.all.path = path; defnData.all.format = format;
	}

/**
 * This is a nested namespace that groups together methods for specifying definition files. All such
 * definitions having an internal syntax that are XML based.
 * @namespace
 * @summary a nested namespace that groups together methods for specifying definition files having
 * syntax that are XML based.
 */
	this.XML = {
/**
 * set the path to load template definition.
 * @param { string } path relative URL to a server-side resource.
 * @inner
 */
		"template" : function(path) {
			templateFrom(path, "xml");
		},
/**
 * set the path to load content definition.
 * @param { string } path relative URL to a server-side resource.
 * @inner
 */
		"content" : function(path) {
			contentFrom(path, "xml");
		},
/**
 * set the path to load both template and content definition from a single location.
 * @param { string } path relative URL to a server-side resource.
 * @inner
 */
		"all" : function(path) {
			allFrom(path, "xml");
		}
	}

/**
 * This is a nested namespace that groups together methods for specifying definition files. All such
 * definitions having an internal syntax that are JSON based.
 * @namespace
 * @summary a nested namespace that groups together methods for specifying definition files having
 * syntax that are JSON based.
 */
	this.JSON = {
/**
 * @inner
 * @param {@} path
 */
		"template" : function(path) {
			templateFrom(path, "json");
		},
		"content" : function(path) {
			contentFrom(path, "json");
		},
		"all" : function(path) {
			allFrom(path, "json");
		}
	}
}

//// NEXT CLASS ////////////////////////////////////////////////////////////////////////////////////


/**
 * @class
 * @summary Given a set of definition files, loads the layouts and pages described within those
 * files from the server.
 */

var DefinitionLoader = function() {

	var _L = Logger.get("DefinitionLoader");

/**
 * This is the sitewide data that is derived from the layouts and pages loaded from template and
 * content definition files.
 * @namespace
 */

	var siteData = {
		/** the template identifier */
		"tplId"         : null,
		/** the template version  */
		"tplVer"        : null,
		/** the unique identifier for this site */
		"siteId"        : null,
		"siteName"      : null,
		/** the content version  */
		"cntVer"        : null,
		"layouts"       : new Array(),
		"notFound"      : null,
		"defaultLayout" : null,
		"pages"         : new Array(),
		"welcomePage"   : null,
		"notFoundPage"  : null
	}

	/**  */
	this.init = function() {

		let jdlod = new JsonDefinitionLoader(siteData);
		let xmlLoader = new XmlDefinitionLoader(siteData);

		let prom = null;
		if(typeof defnData.all.path === "string") {
			let path = defnData.all.path, format = defnData.all.format;
			if(format === "xml") {
				prom = fetchDefinition(path, "xml").then(xmlLoader.loadAll);
			}
			else if(format === "json") {
				prom = fetchDefinition(path, "json").then(jdlod.loadAll);
			}
			else {
				_L.error("bad configuration - definitions format must be either 'xml' or 'json'");
				return Promise.reject("bad_configuration");
			}
			return prom;
		}

		if(typeof defnData.template.path !== "string" || typeof defnData.content.path !== "string") {
			_L.error("bad configuration - both template and content definitions path must be specified");
			return Promise.reject("bad_configuration");
		}

		let tplPath = defnData.template.path, tplFmt = defnData.template.format;
		if(tplFmt == "xml") {
			prom = fetchDefinition(tplPath, "xml").then(xmlLoader.loadTemplate);
		}
		else if(tplFmt == "json") {
			prom = fetchDefinition(tplPath, "json").then(jdlod.loadTemplate);
		}
		else {
			_L.error("bad configuration - template definitions format must be either 'xml' or 'json'");
			return Promise.reject("bad_configuration");
		}

		prom = prom.then(function() {
			let cntPath = defnData.content.path, cntFmt = defnData.content.format;
			if(cntFmt == "xml") {
				return fetchDefinition(cntPath, "xml").then(xmlLoader.loadContent);
			}
			else if(cntFmt == "json") {
				return fetchDefinition(cntPath, "json").then(jdlod.loadContent);
			}
			else {
				_L.error("bad configuration - content definitions format must be either 'xml' or 'json'");
				return Promise.reject("bad_configuration");
			}
		});

		return prom.then(resolveSiteNames);
	}

	/**  */
	this.siteId = function() {
		return siteData.siteId;
	}

	/**  */
	this.currentVersion = function() {
		if(siteData.tplId == null || siteData.tplVer == null || siteData.cntVer == null) {
			return null;
		}
		return siteData.tplId + ":" + siteData.tplVer + ":" + siteData.cntVer;
	}

	/**  */
	this.listPages = function() {
		return siteData.pages;
	}

	this.welcomePage = function() {
		if(siteData.welcomePage) {
			for(var i=0; i<siteData.pages.length; i++) {
				if(siteData.pages[i].slug === siteData.welcomePage) {
					return siteData.pages[i];
				}
			}
		}
		return null;
	}

	this.notFoundPage = function() {
		let nfpg = null;
		if(siteData.notFoundPage) {
			for(var i=0; i<siteData.pages.length; i++) {
				if(siteData.pages[i].slug === siteData.notFoundPage) {
					nfpg = siteData.pages[i];
					break;
				}
			}
		}
		if(nfpg != null) {
			return nfpg;
		}
		return siteData.notFound;
	}

	this.dumpSiteData = function() {
		_L.info("-- dumping site data --");
		_L.info(siteData);
		_L.info("-- end dump --");
	}

	//// HELPER METHODS ////////////////////////////////////////////////////////////////////////////

	function fetchDefinition(path, format) {
		let prom = new Promise((resolve, reject) => {
			_L.debug("fetching definitions as " + format);
			$.ajax({
				cache: false, url: path, dataType: format,
				success: function(data) {
					_L.debug("definitions fetched from " + path);
					resolve(data);
				},
				error : function(xhdr, textStatus, error) {
					_L.error("error fetching definitions from " + path);
					_L.error("    status : " + textStatus);
					_L.error("    description : " + error);
					reject(path + " : " + textStatus + " - " + error);
				}
			});
		});
		return prom;
	}

	function resolveSiteNames() {
		if(siteData.siteName != null && siteData.siteName.length > 0) {
			siteData.pages.forEach(pg => {
				if(pg.title) {
					pg.title = pg.title.replace("_siteName_", siteData.siteName);
				}
			});
		}
		return Promise.resolve();
	}
}

/**
 * @description the definition object that is used to configure latinum
 * @type { module:latinum-definition~Definition}
 */

export const definition = new Definition();

/**
 * the one and only instance of the definitions loader
 *
 * @type { module:latinum-definition~DefinitionLoader}
 */

export const defnLoader = new DefinitionLoader();
