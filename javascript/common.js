/*
 * Finds HTML element involved with JS event
 * @param object (JS event)
 * @param string (HTML node type:'div', 'span', 'input')
 * @param string [optional] (attribute the parent element must have)
 * @return object (HTML element)
 */
function findTarget() {
	var e = arguments[0];
	var nodeType = arguments[1];

	var target = false;
	// the try statements are for broken IE
	if (window.event && window.event.srcElement) {
		try { target = window.event.srcElement; }
		catch (err) { alert('window.event '+ err.description); }
	} else {
		try { target = e.target; }
		catch (err) { alert('target error:'+ err.description); }
	}

	if (!target || !target.nodeName) { return false; }
	if (target.nodeName == '#document') { return false; }

	while (target != document.body && target.nodeName.toLowerCase() != nodeType) {
		target = target.parentNode;
	}

	if (target == document.body) { return false; }

	// check for the attribute if needed
	if (arguments.length > 2 && !checkAttr(target, arguments[2])) {
   		target = target.parentNode;
		while (true) {
			if (target == document.body) { return null; }
			if (target.nodeName.toLowerCase() == nodeType && checkAttr(target, arguments[2])) { return target; }
   			target = target.parentNode;
		}
	}

	if (target.nodeName.toLowerCase() != nodeType) { return null; }
	return target;
}

/*
 * Finds a parent element 
 * @param object (HTML element in question)
 * @param string (node type:'div', 'span', 'input')
 * @param string [optional] (attribute the parent element must have)
 * @return object (HTML element)
 */
function findParent() {
	var obj = arguments[0];
	var nodeType = arguments[1];

	if (!obj) { return false; }

	while (obj != document.body && obj.nodeName.toLowerCase() != nodeType) {
		obj = obj.parentNode;
	}

	// check for the attribute if needed
	if (arguments.length > 2 && !checkAttr(obj, arguments[2])) {
   		obj = obj.parentNode;
		while (true) {
			if (obj == document.body) { return false; }
			if (obj.nodeName.toLowerCase() == nodeType && checkAttr(obj, arguments[2])) { return obj; }
   			obj = obj.parentNode;
		}
	}

	if (obj.nodeName.toLowerCase() != nodeType) { return false; }
	return obj;
}

/*
 * Finds a child element (directly under parent) 
 * @param object (HTML element in question)
 * @param string (node type:'div', 'span', 'input')
 * @param string [optional] (attribute the parent element must have)
 * @return object (HTML element)
 */
function findChild() {
	var obj = arguments[0];
	var nodeType = arguments[1];

	if (!obj) { return false; }

	for (var i=0; i<obj.childNodes.length; i++) {
		// compare type
		if (obj.childNodes[i].nodeName.toLowerCase() == nodeType) {
			// check for the attribute if needed
			if (arguments.length > 2) {
				if (!checkAttr(obj.childNodes[i], arguments[2])) { continue; }
			}
			return obj.childNodes[i];
		}
	}

	return false;
}

/*
 * Checks if an array contains a value
 * @param string (to be found in the array)
 * @param array (JS array [])
 * @return bool
 */
function inArray(needle, haystack) {
	for (var h in haystack) {
		if (haystack[h] == needle) { return true; }
	}
	return false;
}

/*
 * Gets length of hash
 * @param object (JS Hash)
 * @return int
 */
function hashSize(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
}

/*
 * Checks if string is a valid number (negative and decimal)
 * @param string
 * @return bool
 */
function isNumeric(x) {
	if (x == null || x == undefined) { return false; }

	var y = parseFloat(x);

	return (y.toString() == x);
}

/*
 * Checks if string is a valid integer
 * @param mixed (string/int)
 * @return bool
 */
function isInt(x) {
	if (x == null || x == undefined) { return false; }

	var y = parseInt(x, 10);

	return (y.toString() == x);
}

/*
 * Trim implemented in JS
 * @param string (string to be trimmed)
 * @return string
 */
function trim(stringToTrim) {
	if (typeof(stringToTrim) != "string") { return stringToTrim; }
	return stringToTrim.replace(/^\s+|\s+$/g,"");
}

/*
 * Creates a new HTML element
 * @param object (JS object which contains HTML object attributes)
 * @param object [optional] (parent element to append new element to)
 * @return object (HTML element)
 */
function newEl() {
	params = arguments[0];
	theDoc = (arguments[0]['doc'] && arguments[0]['doc'])?arguments[0]['doc']:document;
	newElement = theDoc.createElement(params['type']);
	// hack for IE and hidden inputs
	if(params['attributes'] && params['attributes']['type']) { newElement.setAttribute('type', params['attributes']['type']); }
	// if we have a second argument, its the parent
	if (arguments.length == 2 && arguments[1] != false) { arguments[1].appendChild(newElement); }
	
	if (params['id']) { newElement.setAttribute('id', params['id']); }
	if (params['class']) { newElement.className = params['class']; }
	if (params['text'] && params['text'].length > 0) {
		if (params['nobr']) {
			var noBr = theDoc.createElement('nobr');
			noBr.appendChild(theDoc.createTextNode(params['text']));
			newElement.appendChild(noBr);
		} else {
			newElement.appendChild(theDoc.createTextNode(params['text']));
		}
	}
	if (params['attributes']) {
		for (var attrs in params['attributes']) {
			try {
				newElement.setAttribute(attrs, params['attributes'][attrs]);
			} catch (err) {
				alert('Cannot set '+ attrs +' to '+ params['attributes'][attrs]);
			}
		}
	}
	if (params['value']) { newElement.value = params['value']; }
	if (params['style']) { for (var attrs in params['style']) { newElement['style'][attrs] = params['style'][attrs]; }}
	if (params['src']) { newElement.src = params['src']; }
	if (params['title']) { newElement.setAttribute('title', params['title']); }

	return newElement;
}
 
/*
 * Turns # bytes to readable size with K/M/G/...
 * @param int size (in bytes)
 * @return string (in readable size)
 */
function readableSize(size) {
	size = parseInt(size, 10);
	if (!isNumeric(size)) { return '0 B'; }
	var addcommas = (arguments.length > 1 && arguments[1]);

	var iec = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	var i=0;
	while ((size/1024)>1) {
		size=size/1024;
		i++;
	}

	size = Math.round(size*100)/100;
	if (addcommas) { size = addCommas(size); }
	return size+ ' ' +iec[i];
}
 
/*
 * Adds commas to string to make it readable (1002495 -> 1,002,495)
 * @param string
 * @return string (with commas inserted)
 */
function addCommas(nStr) {
	nStr += '';
	var x = nStr.split('.');
	var x1 = x[0];
	var x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) { x1 = x1.replace(rgx, '$1' + ',' + '$2'); }
	return x1 + x2;
}
 
/*
 * Generates a random string
 * @param int (length of characters)
 */
function randomString(slength) {
	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
	var randomstring = '';
	for (var i=0; i<slength; i++) {
		var rnum = Math.floor(Math.random() * chars.length);
		randomstring += chars.charAt(rnum);
	}
	return randomstring;
}
 
/*
 * Adds text string to HTML element
 * @param object (HTML element)
 * @param string (text to put into the object)
 */
function setText(theObj, theText) {
	theObj.innerHTML = '';
	theObj.appendChild(document.createTextNode(theText));
}

/*
 * Gets text from HTML element
 * @param object (HTML element)
 */
function getText(theObj) {
	if (theObj.childNodes.length == 0) { return false; }
	if (theObj.firstChild.nodeName.toLowerCase() == '#text') { return theObj.firstChild.nodeValue; }
	for (var i=0; i<theObj.childNodes.length; i++) {
		if (theObj.firstChild.nodeName.toLowerCase() != '#text') { continue; }
		return theObj.childNodes[i].nodeValue;
	}
}

/*
 * Insert new element after another (sibling)
 * @param object (existing HTML object)
 * @param object (new HTML object)
 */
function insertAfter(referenceNode, newnode) {
	if (referenceNode.nextSibling) { referenceNode.parentNode.insertBefore(newnode, referenceNode.nextSibling); }
	else { referenceNode.parentNode.appendChild(newnode); }
}

/*
 * Checks if an HTML element contains an attribute
 * @param object (HTML element)
 * @param string (the attribute to check for)
 */
function checkAttr(theElement, theAttr) {
	try { if (theElement.getAttribute(theAttr) == null) { return false; } } catch (err) { return false; }
	return true;
}

/*
 * Stacks window.onload events
 * @param function
 */
function addLoadEvent(func) {
	var oldonload = window.onload;
	if (typeof window.onload != 'function') {
		try { window.onload = func; } catch (err) { }
	} else {
		window.onload = function() {
			if (oldonload) {
				oldonload();
			}
			func();
		}
	}
}

/*
 * Stacks window.onunload events
 * @param function
 */
function addunLoadEvent(func) {
	var oldunload = window.onunload;
	if (typeof window.onunload != 'function') {
		try { window.onunload = func; } catch (err) { }
	} else {
		window.onunload = function() {
			if (oldunload) {
				oldunload();
			}
			func();
		}
	}
}
 
/*
 * Hides an HTML object setting style and visibility
 * @param object (HTML element)
 */
function hideContainer(theContainer) {
	theContainer.style.left = '10px';
	theContainer.style.top = '10px';
	theContainer.style.visibility = 'hidden';
	theContainer.style.display = 'none';
}

/*
 * Gets base filename from fullpath
 * @param string (fullpath to file - from file input)
 * @return string (filename)
 */
function getFilename(fullpath) {
	if (fullpath.lastIndexOf('/') == -1) { // if windir
		return fullpath.substring(fullpath.lastIndexOf('\\')+1, fullpath.length);
	} else if (fullpath.lastIndexOf('\\') == -1) { // if unixdir
		return fullpath.substring(fullpath.lastIndexOf('/')+1, fullpath.length);
	} else { // do more checks
		return 'na';
	}
}

/*
 * Show shadow box
 * @param object (HTML box)
 */
function showCover(box) {
	var cover = $('coverall'); 

    // cover the page
	if (!cover) {
    	cover = newEl({"type":"div", "attributes":{"id":"coverall"}}, document.body);
    	cover.ondblclick = function (e) { document.body.removeChild($('coverall')); };
	}

    // show the box
    box.style.visibility = 'visible';
    box.style.display = ''; 
}

/*
 * Hide shadow box
 * @param object (HTML box)
 * @param bool kill (optional kills the box)
 */
function hideCover() {
	var box = arguments[0];
	var kill = (arguments.length > 1 && arguments[1]);
	if (kill) { box.parentNode.removeChild(box); } else { box.style.display = 'none'; }

    document.body.removeChild($('coverall'));
}

/*
 * Handles AJAX response
 * @param array response (from AJAX call)
 * @return bool (true if there was no error)
 */
function handleResponse(response) {
	if (!response) { alert('Invalid response received from web service call'); }

	if (response['messages']) { alert(response['messages'].join("\n\n")); }

    if (response['status'] == 0) {
		if (response['error']) { alert(response['error']); }
        return false;
    }

    return true;
}

/*
 * Resize textarea vertically
 * @param mixed event || object (textarea object)
 */
function resizeTextarea(e) {
	var txtarea = findTarget(e, 'textarea');
	if (!txtarea && e.nodeName && e.nodeName.toLowerCase() == 'textarea') { txtarea = e; }

	if (!txtarea) { alert('area not found'); return false; }

	var str = txtarea.value;
	var cols = txtarea.cols;
	var linecount = 0;
	var minrows = (checkAttr(txtarea, 'minrows'))?txtarea.getAttribute('minrows'):0;
	var hardlines = str.split("\n");

	for (var i=0; i<hardlines.length; i++) {
		linecount += 1 + Math.floor(hardlines[i].length / cols); // take into account long lines
	}
	linecount++;

	if (linecount < minrows) { linecount = minrows; }

	txtarea.rows = linecount;
}

/*
 * Resize input horizontally
 * @param mixed event || object (input object)
 */
function resizeInput(e) {
	var txtinput = findTarget(e, 'input');
	if (!txtinput && e.nodeName && e.nodeName.toLowerCase() == 'input') { txtinput = e; }

	if (!txtinput) { alert('input not found'); return false; }

	var str = trim(txtinput.value);
	if (str.length == 0 && checkAttr(txtinput, 'placeholder')) { str = txtinput.getAttribute('placeholder'); }

	var minsize = (checkAttr(txtinput, 'minsize'))?txtinput.getAttribute('minsize'):0;
	var maxsize = (checkAttr(txtinput, 'maxsize'))?txtinput.getAttribute('maxsize'):0;

	var strcount = str.length;

	if (minsize > 0 && strcount < minsize) { strcount = minsize; }
	if (maxsize > 0 && strcount > maxsize) { strcount = maxsize; }

	txtinput.setAttribute('size', strcount);

	return true;
}

/*
 * Performs a task when the user presses Enter
 * Useful for setting events on a text field
 * @param JS event
 * @param JS function 
 * @params array (parameters)
 * @param object [optional] (to bind to)
 */
function eventOnEnter (e, func, params, bnd) {
    var code = null;
    if (!e) { e = window.event; }
    if (e.keyCode) { code = e.keyCode; }
    else if (e.which) { code = e.which; }
    else { return true; }

    if (code == 13) {
        if (bnd) {
			if (params) {
				func.apply(bnd, params);
			} else {
				func.apply(bnd, e);
			}
        } else {
			if (params) {
				func.apply(params);
			} else {
            	func.call(e);
			}
        }
    }
    
    return true;
}

/*
 * Safe cross browser way to allow users to copy to clipboard
 */
function copyToClipboard(text) {
  window.prompt("Copy to clipboard: Ctrl+C, Enter", text);
}
