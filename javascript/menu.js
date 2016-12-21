/*
 * Builds a single menu system that is light weight and simple
 */
var SEMenu = new Class({
    Implements: Options,
    options: {
		menu_items: null, // an array of items that will go in the menu
		event_type: 'mouseover', // the event type to display the menu
		menu_link: null, // the parent link for the menu
		menu_body: null, // the div that will contain the menu items
		offset: {'x':5, 'y':5},
		hide_delay: 1000,
		onclicks: null,
		zindex: 5
    },

	/*
	 * Menu init
	 * @params object options
	 */
    initialize: function (options){
		// set options
		this.setOptions(options);

		// verify options
		if (this.options.menu_items == null && this.options.menu_body == null) { return false; }

		// create the body if necessary
		if (this.options.menu_body == null) {
			this.menu_cont_id = randomString(8);
			this.options.menu_body = newEl({"type":"div", "class":"iframe ddmenubody", "id":this.menu_cont_id, "style":{"display":"none"}}, document.body);

			// build menu
			this.buildMenu(this.options.menu_body);
		} else {
			// get the container ID for BROKEN IE
			this.menu_cont_id = this.options.menu_body.getAttribute('id');
			if (this.menu_cont_id == null || this.menu_cont_id == '') {
				// set a container ID if necessary for BROKEN IE
				this.menu_cont_id = randomString(8); 
				this.options.menu_body.setAttribute('id', this.menu_cont_id);
			}
		}

		// set events on the body
		try {
			this.options.menu_body.addEvent('mouseenter', function(e) { clearTimeout(this.delayid); }.bind(this));
			this.options.menu_body.addEvent('mouseleave', function(e) { this.blurMenu(e); }.bind(this));
		} catch (err) {
			$(this.menu_cont_id).addEvent('mouseenter', function(e) { clearTimeout(this.delayid); }.bind(this));
			$(this.menu_cont_id).addEvent('mouseleave', function(e) { this.blurMenu(e); }.bind(this));
		}

		// set event
		if (this.options.menu_link != null) { this.setShowEvents(this.options.menu_link); }

		// set z-index on menu body
		this.options.menu_body.style.zIndex = this.options.zindex;
	},

	/*
	 * Sets the event to show the menu (currently hidden)
	 */
	setShowEvents: function (menu_link) {
		var evtype = '';
		switch (this.options.event_type) {
		case 'mouseover':
			evtype = 'mouseenter';
			menu_link.onmouseover = function(e) { this.showMenu(e); }.bind(this);
			break;
		case 'leftclick':
			evtype = 'click';
			menu_link.onclick = function(e) { this.showMenu(e); }.bind(this);
			break;
		case 'rightclick':
			evtype = 'contextmenu';
			menu_link.oncontextmenu = function(e) { this.showMenu(e); }.bind(this);
			break;
		default:
			evtype = 'click';
		}
	},

	/*
	 * Populate the menu items in the menu body
	 * @params object (the div) // useful for recursion when we support submenus
	 */
	buildMenu: function (box) {
		var mitem = null, lnk = null, elinfo = null;

		// clear out the box
		box.innerHTML = '';

		for (var i=0; i<this.options.menu_items.length; i++) {
			mitem = this.options.menu_items[i];
			elinfo = {"type":"div", "class":"a ddmenuitem", "attributes":mitem['attributes']}
			// add text
			if (mitem['text'] && !mitem['href']) {
				elinfo['text'] = mitem['text'];
				if (mitem['nobr'] != false) { elinfo['nobr'] = 1; }
			}

			// create the div
			lnk = newEl(elinfo, box);

			// setup the link inside if needed
			if (mitem['href']) {
				newEl({"type":"a", "class":"ddlink", "text":mitem['text'], "attributes":{"href":mitem['href']}}, lnk);
				lnk.setAttribute('href', mitem['href']); 
				// open new window if necessary
				if (mitem['target']) {
					lnk.lastChild.setAttribute('target', mitem['target']);
					lnk.setAttribute('target', mitem['target']);
				}
			}

			// set the class
			if (mitem['classname']) { lnk.className = lnk.className +' '+ mitem['classname']; }

			// setup the event handler
			if (this.options.onclicks) {
				lnk.onclick = this.options.onclicks;
			} else if (mitem['href']) {
				lnk.onclick = function (e) {
					var lnk = findTarget(e, 'div', 'href');
					if (!lnk) { return false; }
					if (checkAttr(lnk, 'target')) {
						window.open(lnk.getAttribute('href'), lnk.getAttribute('target'));
						this.hideMenu();
					} else {
						window.location = lnk.getAttribute('href');
					}
				}.bind(this);
			}
			
		}

		if (this.options.event_type == 'leftclick' && this.options.menu_items[0]['href']) {
			this.options.menu_link.ondblclick = function (e) {
				if (this.options.menu_items[0]['target']) {
					window.open(this.options.menu_items[0]['href'], this.options.menu_items[0]['target']);
					this.hideMenu();
				} else {
					window.location = this.options.menu_items[0]['href'];
				}
			}.bind(this);
		}
	},

	/*
	 * Rebuild menu
	 * @params object list (new menu list)
	 */
	rebuildMenu: function (list) {
		this.options.menu_items = list;
		this.buildMenu(this.options.menu_body)
	},

	/*
	 * Figures out the coordinates of the link and shows the menu under it
	 */
	showMenu: function (e) {
		// clear the hide
		if (this.delayid) { clearTimeout(this.delayid); }

		// find the link
		var menu_link = this.options.menu_link;
		if (menu_link == null) { return false; }
		
		// get link info
		var lcoor = menu_link.getCoordinates();
		var rspace = window.getScrollSize().x - lcoor['left'];

		// show the menu
		this.options.menu_body.style.display = '';
		this.options.menu_body.style.visibility = 'visible';

		var menu_width = this.options.menu_body.getSize().x;

		// find position for the menu
		var mpos = {};
		mpos['x'] = this.options.offset['x'] + lcoor['left']; 
		mpos['y'] = this.options.offset['y'] + lcoor['top'] + lcoor['height']; 

		// make sure the menu is not off the window
		if (menu_width > (rspace -20)) { mpos['x'] = mpos['x'] - (menu_width - rspace) -20; }

		// set the menu
		try {
			this.options.menu_body.setPosition(mpos);

			// provide a reference from the menu back to the link
			this.options.menu_body.menu_link = menu_link;
		} catch (err) {
			// BROKEN IE
			$(this.menu_cont_id).setPosition(mpos);

			// provide a reference from the menu back to the link
			$(this.menu_cont_id).menu_link = menu_link;
		}

		menu_link.onmouseout = function (e) { this.blurMenu(e); }.bind(this);
	},

	/*
	 * Sets the delay to hide the menu
	 */
	blurMenu: function (e) {
		this.delayid = this.hideMenu.delay(this.options.hide_delay, this, 1);
	},

	/*
	 * Hides the menu
	 */
	hideMenu: function (e) {
		this.options.menu_body.style.display = 'none';
	}
});
