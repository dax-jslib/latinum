/**
 * @module latinum-director
 */

import Logger from "./js-logger.mod.js";
import Navigo from "./navigo.mod.js";
import { defnLoader } from "./latinum-definition.mod.js";
import contentLoader from "./latinum-content.mod.js";
import renderers from "./latinum-renderer.mod.js";

var _L = Logger.get("L.direct");

var Director = function() {

	var rootTag = $("[latinum-root]").first();
	var hasRootTag = (rootTag.length > 0);
	var originalRootCnt = null;
	if(hasRootTag) {
		originalRootCnt = rootTag.html();
	}

	var actionCtxt = null;

	this.init = function(ctxt) {
		actionCtxt = ctxt;
		_L.debug("director", "setting up routes");

		var navigo = new Navigo(null, true, "#!");
		navigo.hooks({
			"before" : exitPage
		});

		var pages = defnLoader.listPages();
		pages.forEach(function(pg) {
			var chngPg = function(params, query) {
				changePage(pg, params, query);
			};

			var npath = "/" + pg.slug;
			if(pg.parameters) {
				if(Array.isArray(pg.parameters)) {
					pg.parameters.forEach( param => {
						npath += "/:" + param;
					});
				}
				else {
					npath += "/:" + pg.parameters;
				}
			}
			//navigo.on(npath, chngPg, {
			//	"before" : exitPage
			//});
			// clean the above 3 lines if everything is working fine.
			navigo.on(npath, chngPg);
			_L.debug("done with page : " + pg.slug);
		});

		navigo.on(function(query) {
			var welPage = defnLoader.welcomePage();
			if(welPage != null) {
				_L.debug("welcome page is : " + welPage.slug);
				changePage(welPage, null, query);
			}
		});

		navigo.notFound(function(query) {
			_L.warn("page not found", query);
			var notFound = defnLoader.notFoundPage();
			if(notFound != null) {
				if(typeof notFound === "string") {
					window.location.replace(notFound);
				}
				else {
					changePage(notFound, null, query);
				}
			}
			else {
				_L.warn("cannot display not found");
			}
		});

		navigo.resolve();
	}

	//// HELPER STUFF //////////////////////////////////////////////////////////////////////////////

	var lastPage = null;
	var lastParams = null;
	var lastQuery = null;

	function exitPage(done, params) {
		_L.debug("exiting from previous page");
		if(lastPage == null) {
			done();
			return;
		}
		lastPage.exitAxns.forEach(function(fncName) {
			_L.debug("executing function " + fncName + " from local scope");
			if(!executeFunctionByName(fncName, actionCtxt, lastPage, lastParams, lastQuery)) {
				_L.debug("executing function " + fncName + " from global scope");
				if(!executeFunctionByName(fncName, window, lastPage, lastParams, lastQuery)) {
					_L.warn("failed to execute " + fncName);
				}
			}
		});
		done();
	}

	function changePage(page, params, query) {
		_L.debug("changing to page: " + page.slug);
		if(!hasRootTag) {
			_L.warn("root tag not found. nothing doing.");
			return;
		}

		if(lastPage != null && page.layout != lastPage.layout) {
			// We are transitioning from a previous layout. Hence execute the previous layout-level
			// exit methods.
			lastPage.exitLayoutAxns.forEach(function(fncName) {
				_L.debug("executing function " + fncName + " from local scope");
				if(!executeFunctionByName(fncName, actionCtxt, lastPage)) {
					_L.debug("executing function " + fncName + " from global scope");
					if(!executeFunctionByName(fncName, window, lastPage)) {
						_L.warn("failed to execute " + fncName);
					}
				}
			});
		}

		if(lastPage == null || page.layout != lastPage.layout) {
			_L.debug("full layout change");
			contentLoader.fetch(page.layout).then(function(data) {
				//populate the layout into the containing HTML
				rootTag.html(data);
				// We are transitioning to a new layout. Hence execute the new layout-level enter methods.
				page.enterLayoutAxns.forEach(function(fncName) {
					_L.debug("executing function " + fncName + " from local scope");
					if(!executeFunctionByName(fncName, actionCtxt, page, params, query)) {
						_L.debug("executing function " + fncName + " from global scope");
						if(!executeFunctionByName(fncName, window, page, params, query)) {
							_L.warn("failed to execute " + fncName);
						}
					}
				});
				replaceOnPageAndEnter(page, params, query);
			}).catch(err => {
				_L.warn("unable to load layout : " + page.layout, err);
				return;
			});
		}
		else {
			_L.debug("no layout change");
			replaceOnPageAndEnter(page, params, query);
		}

		if(page.title !== null) {
			$(document).attr("title", page.title);
		}
		window.scrollTo(0, 0);

		lastPage = page;
		lastParams = params;
		lastQuery = query;
	}

	function replaceOnPageAndEnter(page, params, query) {
		var promArr = [];

		var cntTag = $("[latinum-content]").first();
		if(cntTag.length > 0) {
			_L.debug("DOM node found to insert main content");
			var extn = contentLoader.getFileExtension(page.path);
			if(extn != null) {
				let rend = renderers.getRenderer(extn);
				if(rend != null) {
					_L.debug("renderer for main content is : " + rend.constructor.name);
					let prom = rend.populate(cntTag, page.path);
					promArr.push(prom);
				}
			}
		}

		$("[latinum-insert]").each(function() {
			var insTag  = $(this);
			var insertKey = $(this).attr("latinum-insert");
			if(typeof insertKey !== "string") {
				return;
			}
			var insertVal = page.inserts[insertKey];
			if(typeof insertVal !== "string" || insertVal == null || insertVal.trim().length == 0) {
				return;
			}
			_L.debug("inserting {name=" + insertKey + ", value=" + insertVal + "}");

			//Check if the insert value represents a path to a known file type.
			var extn = contentLoader.getFileExtension(insertVal);
			if(extn != null) {
				let rend = renderers.getRenderer(extn);
				if(rend != null) {
					let prom = rend.populate(insTag, insertVal);
					promArr.push(prom);
				}
				else {
					insTag.html(insertVal);
				}
			}
			else {
				insTag.html(insertVal);
			}
		});

		//// this part applies a style for the fragment being loaded
		var dupStyles = JSON.parse(JSON.stringify(page.styles)); // make a clone of view styles
		$("style[latinum-style-id]").each(function() {
			var htmlTag  = $(this);
			var styleId = $(this).attr("latinum-style-id");
			if(dupStyles[styleId]) {
				delete dupStyles[styleId];
			}
			else {
				htmlTag.remove();
			}
		});
		for(var styleId in dupStyles) {
			var htmlTag = $( "<style latinum-style-id='" + styleId + "' type='text/css'></style>" );
			htmlTag.appendTo("head");
			let rend = renderers.getRenderer(".css");
			if(rend != null) {
				var prom = rend.populate(htmlTag, dupStyles[styleId]);
				promArr.push(prom);
			}
		}
		//// end style fragment

		Promise.all(promArr).catch(err => {
			_L.warn("error encountered", err);
		}).finally(function() {
			rootTag.trigger("LatinumTransition");
			_L.debug("replacement complete");

			page.enterAxns.forEach(function(fncName) {
				_L.debug("executing function " + fncName + " from local scope");
				if(!executeFunctionByName(fncName, actionCtxt, page, params, query)) {
					_L.debug("executing function " + fncName + " from global scope");
					if(!executeFunctionByName(fncName, window, page, params, query)) {
						_L.warn("failed to execute " + fncName);
					}
				}
			});
		});
	}

	function executeFunctionByName(functionName, context /*, args */) {
		var args = Array.prototype.slice.call(arguments, 2);
		var namespaces = functionName.split(".");
		var func = namespaces.pop();
		for (var i = 0; i < namespaces.length; i++) {
			context = context[namespaces[i]];
			if(typeof context === "undefined" || context == null) {
				_L.debug("unable to execute " + functionName + ". Context not found.");
				return false;
			}
		}
		if(typeof context[func] === "undefined") {
			_L.debug("unable to execute " + functionName + ". Method does not exist.")
			return false;
		}
		else {
			context[func].apply(context, args);
			return true;
		}
	}
}

let director = new Director();
export default director;