var seSuggest = new Class({
	Implements: Options,
	options: {
		mainContainer: null, // main container for all the stuff
		cssPrefix: null,
		zeroSearch: false, // search when you have no characters (to show initial list)
		maxBits: 0, // max bits allowed
		hideDelay: 500,
		localSuggestions: null, // list of local suggestions
        bitsOnPage: 10, // number of bits displayed on the list before displaying like to show more
        allowPaging: true, // show prev next pages
		minInputSize: 10, // initial and min input width
		maxInputSize: 50, // max input size
		bitDisplayCharLimit: 50, // limit length of chars on a bit (tooltip will show full)
		allowUserBits: true, // are user's allowed to create new bits?
		defaultMessage: '', // default instructions when nothing else to display
		newBitMessage: 'Press "Enter" to finish adding this item', // message to alert the user to press enter to add the item
		forceBitMessage: null, // message to show the user how to force the text they are typing and not the suggestion
		suggestionsLocation: 'container', // location of suggestions ('input' || 'container')
		selectFirstSuggestion: false, // select the first suggestion by default
		bitDeletable: true // is the user able to delete bits
	},

	remoteSearch: null, // contains search criteria used for remoteSuggestions
	remoteSuggestions: null, // cached suggestions from remote query
	delayid: null, // timeout to hide suggestions box
	lastInput: null, // last input in the autosuggest box
	searchInput: null, // input we are currently working with

	/*
	 * Init
	 */
	initialize: function (options) {
		// set options
		this.setOptions(options);

		// make sure all the pieces we need are available
		if (!this.options.mainContainer) { alert('Main container not specified'); return false; }

		if (!inArray(this.options.suggestionsLocation, ['input', 'container'])) { this.options.suggestionsLocation = 'input'; }

		// create the suggestions box
		var mc = this.options.mainContainer;
		var prnt = (this.options.suggestinbody)?document.body:this.options.mainContainer.parentNode;
		mc.suggestionsBox = newEl({'type':'div', 'id':this.sbid, 'class':'suggestions_box', 'style':{'display':'none'}}, prnt);
		if (this.options.cssPrefix) { mc.suggestionsBox.className += ' '+ this.options.cssPrefix +'_suggestions_box'; }
		$(mc.suggestionsBox).addEvent('mouseenter', function(e) { clearTimeout(this.delayid); }.bind(this));
		$(mc.suggestionsBox).addEvent('mouseleave', function(e) { this.blurSuggestions(e); }.bind(this));
		mc.onclick = function (e) { this.lastInput.focus(); }.bind(this);

		// clear out the container
		mc.innerHTML = '';

		// setup the initial input element
		this.lastInput = this.createInput();
		mc.appendChild(this.lastInput);

		if (this.lastInput) { this.lastInput.focus(); }
	},

	/*
	 * Gets number of items in the list
	 */
	getNumberItems: function () {
		var total_items = 0;
		var bit = null;

		// go through list and get keys from valid bits
		for (var i=0; i<this.options.mainContainer.childNodes.length; i++) {
			bit = this.options.mainContainer.childNodes[i];
			if (!checkAttr(bit, 'as_value')) { continue; }

			total_items++;
		}

		return total_items;
	},

	/*
	 * Gets all keys [1, 2, 9]
	 * @return array
	 */
	getKeys: function () {
		var keys = [];
		var bit = null;

		// go through list and get keys from valid bits
		for (var i=0; i<this.options.mainContainer.childNodes.length; i++) {
			bit = this.options.mainContainer.childNodes[i];
			if (!checkAttr(bit, 'as_key')) { continue; }

			keys.push(bit.getAttribute('as_key'));
		}

		return keys;
	},

	/*
	 * Gets all values [name1, name2]
	 * @return array
	 */
	getValues: function () {
		var values = [];
		var bit = null;

		// go through list and get keys from valid bits
		for (var i=0; i<this.options.mainContainer.childNodes.length; i++) {
			bit = this.options.mainContainer.childNodes[i];
			if (!checkAttr(bit, 'as_value')) { continue; }

			values.push(bit.getAttribute('as_value'));
		}

		return values;
	},

	/*
	 * Gets all key:value pairs {1:name1, 2:name2}
	 * @return associative array (hash)
	 */
	getKeyValues: function () {
		var info = {};
		var bit = null;
		var key = null;

		// go through list and get keys from valid bits
		for (var i=0; i<this.options.mainContainer.childNodes.length; i++) {
			bit = this.options.mainContainer.childNodes[i];
			if (!checkAttr(bit, 'as_value')) { continue; }

			key = bit.getAttribute('as_key');
			info[key] = bit.getAttribute('as_value');
		}

		return info;
	},

	/*
	 * Returns the classname for a bit
	 * @param array (bit info)
	 * @return string (class names)
	 */
	getBitClassname: function (info) {
		// this method will be overwritten by extending class

		return '';
	},

	/*
	 * Adds bits (initital population)
	 * @param array info
	 */
	addBits: function (list) {
		var bit = spacer = null;

		// go through all bit info
		for (var i=0; i<list.length; i++) {
			// create bit
			bit = this.createBit(list[i]);
			this.options.mainContainer.insertBefore(bit, this.lastInput);
			spacer = this.createSpacer();
			this.options.mainContainer.insertBefore(spacer, this.lastInput);
		}
	},

	/*
	 * Creates the DOM elements for a bit
	 * @param array info {key:1, value:name1, ..}
	 * @return object (HTML bit)
	 */
	createBit: function (info) {
		var bitC = null;

		var cnames = 'autosuggest_bit '+ this.getBitClassname();

		// create span container
		bitC = newEl({'type':'span', 'class':cnames, 'attributes':{'as_key':info['key'], 'as_value':info['value'], 'tabindex':0}});

		var txt = info['value'];
		// if the value is longer than we want
		if (this.options.bitDisplayCharLimit && info['value'].length > this.options.bitDisplayCharLimit) {
			// shorten to the # chars that we want
			var txt = info['value'].substr(0, (this.options.bitDisplayCharLimit -3)) + '...';

			// set tooltip to the full value if there is no tooltip defined
			if (!info['title']) { info['title'] = info['value']; }
		}

		// set a tooltip if defined
		if (info['title'] && info['title'].length) {
			bitC.setAttribute('title', info['title']);
		}

		// create value container
		newEl({'type':'span', 'text':txt}, bitC);

		// create delete container
		if (this.options.bitDeletable) {
			var dc = newEl({'type':'span', 'class':'autosuggest_bit_close', 'text':'\u0020\u00d7', 'attribute':{'closebit':1}}, bitC);
			dc.onclick = function (e) { this.removeBit(e); }.bind(this);

			bitC.onkeydown = function (e) { this.bitKeyHandler(e); }.bind(this);
			bitC.onclick = bitC.onfocus = function (e) { this.selectBit(e); }.bind(this);
			bitC.onblur = function (e) { this.unselectBit(e); }.bind(this);
		}

		return bitC;
	},

	/*
	 * Selects bit (to delete or using keyboard)
	 * @param event (JS event)
	 */
	selectBit: function (e) {
		// if we are trying to remove it, do not go through the selection
		if (checkAttr(e, 'closebit')) { return true; }

		var bit = findTarget(e, 'span', 'as_value');
		if (bit) {
			// stop propogation
			if (Browser.ie) {
				// BROKEN IE
				e.cancelBubble = true;
				e.returnValue = false;
			} else {
				e.stopPropagation();
			}
		} else if (checkAttr(e, 'as_value')) {
			bit = e;
		}

		if (!bit) { return; }

		if (this.selectedBit && this.selectedBit.parentNode) { this.unselectBit(); }

		bit.addClass('selected_bit');

		this.selectedBit = bit;

		bit.focus();
	},

	/*
	 * Selects next bit
	 * @param event (JS event)
	 */
	selectNextBit: function (e) {
		if (this.selectedBit) {
			if (this.selectedBit.nextSibling &&
			this.selectedBit.nextSibling.nextSibling &&
			checkAttr(this.selectedBit.nextSibling.nextSibling, 'as_value')) {
				this.selectBit(this.selectedBit.nextSibling.nextSibling);
			}
		}
	},

	/*
	 * Selects previous bit
	 * @param event (JS event)
	 */
	selectPrevBit: function (e) {
		if (this.selectedBit) {
			if (this.selectedBit.previousSibling &&
			this.selectedBit.previousSibling.previousSibling &&
			checkAttr(this.selectedBit.previousSibling.previousSibling, 'as_value')) {
				this.selectBit(this.selectedBit.previousSibling.previousSibling);
			}
	   	}
	},

	/*
	 * Unselect bit
	 */
	unselectBit: function () {
		this.selectedBit.removeClass('selected_bit');

		this.selectedBit = null;
	},

	/*
	 * Handles key events on bits
	 */
	bitKeyHandler: function (e) {
		// get bit element
		var bit = findTarget(e, 'span', 'as_value');
		if (!bit) { alert('ERROR: Bit not found'); return false; }

		// find keycode so we can do do something with it
		var code = null;
		if (!e) { e = window.event; }
		if (e.keyCode) { code = e.keyCode; }
		else if (e.which) { code = e.which; }

		switch (code) {
		case 8: // backspace
		case 46: // delete
			this.removeBit(e);
			e.preventDefault();
			break;

		case 27:
			this.unselectBit();
			break;

		case 37:
			// left arrow
			// provide input before this
			var psi = bit.previousSibling;
			if (psi && checkAttr(psi, 'as_spacer')) {
				this.spacerToInput(psi);
			}
			break;

		case 39:
			// right arrow
			this.selectNextBit();
			break;

		default:
			return true;
		}

		return false;
	},

	/*
	 * Remvoes a bit when the user wants to delete
	 * @param mixed (JS event || HTML element)
	 */
	removeBit: function (e) {
		var bit = findTarget(e, 'span', 'as_value');

		if (!bit && checkAttr(e, 'as_value')) {
			bit = e;
		} else {
			// stop propogation so it does not select
			if (Browser.ie) {
				// BROKEN IE
				e.cancelBubble = true;
				e.returnValue = false;
			} else {
				e.stopPropagation();
			}
		}

		if (!bit || !bit.parentNode) { return; }

		// find the next element that should get focus
		var nextel = (bit.nextSibling && bit.nextSibling.nextSibling)?bit.nextSibling.nextSibling:false;

		// remove the next spacer
		if (bit.nextSibling) { this.options.mainContainer.removeChild(bit.nextSibling); }

		// remove the bit
		this.options.mainContainer.removeChild(bit);

		this.selectedBit = null;

		// focus on the next appropriate element
		if (checkAttr(nextel, 'as_value')) {
			this.selectBit.delay(250, this, nextel);
		} else if (nextel.nodeName && nextel.nodeName.toLowerCase() == 'input') {
			nextel.focus();
		}

		this.changed('removed');
	},

	/*
	 * Creates the DOM elements for a spacer
	 * @return object (HTML spacer)
	 */
	createSpacer: function () {
		var spacer = newEl({'type':'span', 'class':'autosuggest_spacer', 'text':'\u00a0\u00a0', 'attributes':{'as_spacer':1}});
		spacer.onclick = function (e) { this.spacerToInput(e); }.bind(this);

		return spacer;
	},

	/*
	 * Creates the DOM elements for a spacer
	 * @return object (HTML spacer)
	 */
	createInput: function () {
		var inp = newEl({'type':'input', 'class':'autosuggest_blank', 'attributes':{'type':'text', 'isfocused':0, 'size':this.options.minInputSize}});

		// setup events
		inp.onfocus = function (e) { this.inputFocus(e); }.bind(this);
		inp.onblur = function(e) { this.inputBlur(e); this.blurSuggestions(e); }.bind(this)
		inp.onkeyup = function (e) { this.inputKeyHandler(e); }.bind(this);

		return inp;
	},

	/*
	 * Handles focus on an input
	 * @param event
	 */
	inputFocus: function (e) {
		// get input element
		var si = findTarget(e, 'input');
		if (!si) {
			alert('ERROR: Input not found on focus');
			return false;
		}

		si.setAttribute('isfocused', 1);
		var osi = this.options.mainContainer.searchInput;

		// if this is the initial focus, clear the suggestions from the last time
		if (osi != si) {
			this.options.mainContainer.suggestionsBox.innerHTML = '';
		}

		// if the previous input exists, remove it
		if (osi && this.options.mainContainer.lastChild != osi) { this.removeInput(osi); }

		this.selectedBit = null;

		// mark input we are working with
		this.options.mainContainer.searchInput = si;

		if (trim(si.value).length > 0) {
			this.search(trim(si.value));
		} else if (this.options.defaultMessage.length > 0) {
			this.showSuggestions([]);
		}
	},

	/*
	 * Handles blur on an input
	 * @param event
	 */
	inputBlur: function (e) {
		var si = findTarget(e, 'input');
		if (!si) {
			alert('ERROR: Input not found on blur');
			return false;
		}

		si.setAttribute('isfocused', 0);
 
 		// convert to bit if we allow user bits
 		if (this.options.allowUserBits && trim(si.value).length > 0) {
 			this.inputToBit(e);
 		} 
	},

	/*
	 * Removes the input once it is not necessary
	 * @param object (HTML input)
	 */
	removeInput: function (inp) {
		if (!inp || this.lastInput == inp) { return false; }

		var mc = this.options.mainContainer;

		if (inp.nextSibling && checkAttr(inp.nextSibling, 'as_spacer')) { mc.removeChild(inp.nextSibling); }

		// if there are suggestions, clear them
		if (mc.searchInput == inp) { this.hideSuggestions(); }

		mc.removeChild(inp);
	},

	/*
	 * Adds input between bits (or before or after)
	 * @param mixed (JS event || HTML spacer element)
	 * @return object (HTML input)
	 */
	spacerToInput: function (e) {
		// find spacer
		var spacer = findTarget(e, 'span', 'as_spacer');
		if (!spacer && checkAttr(e, 'as_spacer')) { spacer = e; }
		if (!spacer) { return; }

		// make sure this is not next to an input
		if (spacer.previousSibling && spacer.previousSibling.nodeName && spacer.previousSibling.nodeName.toLowerCase() == 'input') { return; }
		if (spacer.nextSibling && spacer.nextSibling.nodeName && spacer.nextSibling.nodeName.toLowerCase() == 'input') { return; }

		// create new input
		var inp = this.createInput();
		insertAfter(spacer, inp);

		// add spacer after
		var space = this.createSpacer();
		insertAfter(inp, space)

		inp.focus();
	},

	/*
	 * Converts a text input to a bit
	 * @param mixed (JS event || HTML input element)
	 */
	inputToBit: function (e) {
		// get input element
		var inp = findTarget(e, 'input');
		if (!inp && e && e.nodeName && e.nodeName.toLowerCase() == 'input') { inp = e; }

		// if this is called from the mouse event, we need to find input another way
		if (!inp && findTarget(e, 'div', 'as_value')) { inp = this.options.mainContainer.searchInput; }

		// get value
		var key = 0;
		var txt = trim(inp.value);
		if (this.selectedSuggestion) {
			// if a suggestion is selected, use it
			key = this.selectedSuggestion.getAttribute('as_key');
			txt = this.selectedSuggestion.getAttribute('as_value');
		} else if (txt.length == 0) {
			// if there is nothing selected, don't do anything
			return false;
		} else if (!this.options.allowUserBits) {
			// if the user cannot create new bits, don't do anything
			return false
		}

		// hide suggestions
		this.hideSuggestions();

		// create bit
		var bit = this.createBit({'key':key, 'value':txt});

		// insert before input
		this.options.mainContainer.insertBefore(bit, inp);

		// if input was the last one, do not remove it
		if (inp == this.lastInput) {
			// add a spacer between bit and last input
			var spacer = this.createSpacer();
			this.options.mainContainer.insertBefore(spacer, inp);

			// clear last input
			inp.value = '';
		} else {
			// remove input element since it isn't the last node
			this.options.mainContainer.removeChild(inp);
			this.options.mainContainer.searchInput = null;
		}

		this.changed('added');
	},

	/*
	 * Handles key events on input
	 */
	inputKeyHandler: function (e) {
		// get input element
		var si = findTarget(e, 'input');
		if (!si) {
			alert('ERROR: Input not found for key handler');
			return false;
		}
		var psi = si.previousSibling;

		// get search string
		var search = trim(si.value);

		// find keycode so we can do do something with it
		var code = null;
		if (!e) { e = window.event; }
		if (e.keyCode) { code = e.keyCode; }
		else if (e.which) { code = e.which; }

		switch (code) {
		case 8:
			// backspace
			if (search.length > 0) {
				this.search(search);
			} else {
				if (this.selectedBit) {
					// if a bit is selected, remove it
					this.removeBit(this.selectedBit);
				} else {
					// if a bit is not selected, select it
					if (psi && checkAttr(psi, 'as_value')) { this.selectBit(psi); }
					else if (psi && psi.previousSibling && checkAttr(psi.previousSibling, 'as_value')) { this.selectBit(psi.previousSibling); }
				}
			}
			break;

		case 13:
			// enter key
			// if the shift key is also used, unselect current to force text in the input to be used as bit
			if (this.options.allowUserBits && e.shiftKey) { this.unSelectSuggestion(); }
			this.inputToBit(e);
			return false;
			break;

		case 27:
			// escape key
			si.value = '';
			this.hideSuggestions();
			this.removeInput(si);
			e.stop();
			return false;
			break;

		case 33:
			// page up
			return false;
			break;

		case 34:
			// page down
			return false;
			break;

		case 37:
			// left arrow
			if (this.selectedBit) {
				// create input before it and focus on that
				psi = this.selectedBit.previousSibling;
				if (psi && checkAttr(psi, 'as_spacer')) {
					this.spacerToInput(psi);
				}
			} else {
				if (psi && psi.previousSibling) { psi = psi.previousSibling; }
				if (psi && checkAttr(psi, 'as_value')) {
					this.selectBit(psi);
				}
			}
			break;

		case 38:
			// up arrow
			this.selectPrevSuggestion(e);
			return false;
			break;

		case 39:
			// right arrow
			break;

		case 40:
			// down arrow
			this.selectNextSuggestion(e);
			return false;
			break;

		case 46:
			// delete
			if (search.length > 0) { this.search(search); }
			break;

		default:
			this.search(search);
		}

		var inpsize = search.length;
		if (inpsize < this.options.minInputSize) { inpsize = this.options.minInputSize; }
		if (inpsize > this.options.maxInputSize) { inpsize = this.options.maxInputSize; }
		si.setAttribute('size', inpsize)

		return true;
	},

	/*
	 * Kicks of search as the user types
	 * @param string (search string)
	 */
	search: function (search) {
		if (search.length == 0 && !this.options.zeroSearch) { return false; }

		// local or remote?
		if (this.options.localSuggestions) {
			// go through and filter suggestions
			this.showSuggestions(this.filterSuggestions(this.options.localSuggestions));
		} else {
			if (this.useCachedSuggestions(search)) {
   				this.showSuggestions(this.filterSuggestions(search, this.remoteSuggestions));
			} else {
				// mark the search we are getting suggestions for
				this.remoteSearch = search;

				// make the ajax request
				this.makeRequest(search, 0);
			}
		}
	},

	/*
	 * Checks if there is cached data for suggestions for this search
	 * @param string search
	 */
	useCachedSuggestions: function (search) {
		// check if we need to make a remote request
		if (this.remoteSearch && search.length >= this.remoteSearch.length && search.indexOf(this.remoteSearch) == 0) {
			return true;
		}

		return false;
	},

	/*
	 * Make the request to get suggestions
	 * @param string (search text)
	 * @param int (offset)
	 */
	makeRequest: function (search, offset) {
		// this method will be overwritten by extending class
		alert('Request method not defined, cannot search for "'+ search +'"');
	},

	/*
	 * Filters local or cached remote suggestions to remove items that do not match
	 * @param string (latest search string)
	 * @param array (list of suggestions)
	 * @return array (list of matching suggestions)
	 */
	filterSuggestions: function (search, suggestions) {
		// handle garbage data
		if (!suggestions) { suggestions = []; }

		var fsuggestions = [];

		for (var i=0; i<suggestions.length; i++) {
			if (suggestions[i]['value'].indexOf(search) != -1) { fsuggestions.push(suggestions[i]); }
		}

		return fsuggestions;
	},

	/*
	 * Returns the class for a suggestion
	 * @param array (suggestion info)
	 * @return string (class names)
	 */
	getSuggestionClassname: function (info) {
		// this method will be overwritten by extending class

		return '';
	},

	/*
	 * Displays suggestions
	 * @param array [{id, name}, {id, name}, ...]
	 */
	showSuggestions: function (suggestions) {
		// unmark selected suggestion
		this.selectedSuggestion = null;

		// create suggestions box
		var sb = this.options.mainContainer.suggestionsBox;
		sb.innerHTML = '';

		// make sure we have some suggestions
		if (!suggestions || !suggestions.length || suggestions.length == 0) {
			if (this.options.allowUserBits) {
				newEl({'type':'div', 'class':'as_notice', 'text':this.options.newBitMessage}, sb);
			} else if (this.options.defaultMessage.length > 0) {
				newEl({'type':'div', 'class':'as_notice', 'text':this.options.defaultMessage}, sb);
			}
		} else {
			// go through all suggestions
			var sug = null
			for (var i=0; i<suggestions.length; i++) {
				// get suggestion classname
				var cname = this.getSuggestionClassname();

				// create suggestion
				sug = newEl({'type':'div', 'class':'as_suggestion', 'text':suggestions[i]['value'], 'attributes':{'as_key':suggestions[i]['key'], 'as_value':suggestions[i]['value']}}, sb);
				sug.onmouseover = function (e) { this.selectSuggestion(e); }.bind(this);
				sug.onclick = function (e) { this.selectSuggestion(e); this.inputToBit(e); }.bind(this);
			}

			// allow user to force a new bit
			// useful if the user has something@what.com as a suggestion and they would like to force thing@what.com
			if (this.options.forceBitMessage && this.options.allowUserBits) {
				newEl({'type':'div', 'class':'as_notice', 'text':this.options.forceBitMessage}, sb);
			}

			// select the first suggestion if that is the default
			if (this.options.selectFirstSuggestion) { this.selectSuggestion(findChild(sb, 'div', 'as_value')); }

			// show prev next based on location in total list
		}

		// make it visible
		sb.style.display = '';

		// get input element position
		// {"left":305,"top":120,"width":220,"height":15,"right":525,"bottom":135}
		var correl = (this.options.suggestionsLocation == 'input')?this.options.mainContainer.searchInput:this.options.mainContainer;
 		var pos = correl.getCoordinates();

		sb.style.top = pos['bottom'] + 1 +'px';
		sb.style.left = pos['left'] +'px';

		clearTimeout(this.delayid);
	},

	/*
	 * Selects a suggestion
	 * @param mixed object (HTML suggestion) | event (JS mouseevent)
	 */
	selectSuggestion: function (e) {
		var suggestion = findTarget(e, 'div', 'as_value');
		if (!suggestion && checkAttr(e, 'as_value')) { suggestion = e; }
		if (!suggestion) { return false; }

		this.unSelectSuggestion();

		// mark next selection
		$(suggestion).addClass('as_selsug');
		this.selectedSuggestion = suggestion;
	},

	/*
	 * Unselects a suggestion
	 */
	unSelectSuggestion: function () {
		if (!this.selectedSuggestion) { return false; }

 		// unmark currently selected item
		this.selectedSuggestion.removeClass('as_selsug');
    	
		this.selectedSuggestion = null;
	},

	/*
	 * Selects the previous suggestion
	 */
	selectPrevSuggestion: function () {
		if (this.selectedSuggestion &&
			this.selectedSuggestion.previousSibling &&
			checkAttr(this.selectedSuggestion.previousSibling, 'as_value')) {
				this.selectSuggestion(this.selectedSuggestion.previousSibling);
		}
	},

	/*
	 * Selects the next suggestion
	 */
	selectNextSuggestion: function () {
		// if nothing is selected, go to the first option
		if (!this.selectedSuggestion) {
			this.selectSuggestion(findChild(this.options.mainContainer.suggestionsBox, 'div', 'as_value'));
		} else if (this.selectedSuggestion &&
			this.selectedSuggestion.nextSibling &&
			checkAttr(this.selectedSuggestion.nextSibling, 'as_value')) {
				this.selectSuggestion(this.selectedSuggestion.nextSibling);
		}
	},

	/*
	 * Handles click to show next page
	 */
	showNextPage: function () {
	},

	/*
	 * Handles click to show prev page
	 */
	showPrevPage: function () {
	},

	/*
	 * Delay the hiding for a split second
	 */
	blurSuggestions: function () {
		// make sure the input still does not have focus

		this.delayid = this.hideSuggestions.delay(this.options.hideDelay, this, 1);
	},

	/*
	 * Hide the suggestions
	 */
	hideSuggestions: function () {
		// unmark selected suggestion
		this.selectedSuggestion = null;

		// hide the box
		this.options.mainContainer.suggestionsBox.style.display = 'none';
	},

	/*
	 * Called on update
	 * @param string (removed|added)
	 */
	changed: function (action) {
		// this should be extended
	}
});
