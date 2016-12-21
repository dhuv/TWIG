var twigApp = new Class({
	Implements: Options,
	options: {
		email_list_num: 50,
		feature_links: []
	},

	choosenEmail: null, // keeps track of which email is currently being viewed
	selectedMessagesNum: 0,
	folderTotalEmails: 0,
	blurFoldersTimeoutID: null,
	latestEmailTimeoutID: null, // timer to check for new emails
	attachmentsListTimeoutID: null, // timer to check for new emails
	tasksPriorityTimeoutID: null, // timer to save priority changes
	queuedImages: [], // staggers loading images in an email
	weatherLocationNum: 0, // weather location index
	weatherLastUpdate: 0, // time of last weather update
 
	// AJAX request handles
	get_email_request: null,
	get_notes_request: null,
	get_images_request: null,
	update_email_request: null,
	get_more_request: null,
	get_latest_request: null,
	search_request: null,

	/*
	 * TWIG init
	 * @params object options
	 */
	initialize: function () {
		// get options
		var that = this;
		var postData = {'feat':'Emails', 'command':'initOptions'};
		new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			// handle response
			if (!r) { return; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; } 

			that.setOptions(resp['options']);

			//
			// setup default actions link
			//
			that.initActionLinks();
	
			//
			// setup folder list
			//
			that.initFolders(that.options.folders);
	 
			//
			// show folder and allow changing folders
			//
			$('current_folder').onclick = function (e) {
				var sbox = $('set_folder');
				sbox.style.display = (sbox.style.display == 'none')?'':'none';
			}
	
			$('current_folder').onmouseover = function (e) { clearTimeout(this.blurFoldersTimeoutID); }.bind(that);
			$('set_folder').onmouseover = function (e) { clearTimeout(this.blurFoldersTimeoutID); }.bind(that);
			$('current_folder').onmouseout = function (e) { this.blurFolderMenu(e); }.bind(that);
			$('set_folder').onmouseout = function (e) { this.blurFolderMenu(e); }.bind(that);
	
			//
			// Set the correct scroll and shortcuts
			//
			that.toggleRightColumn('default_actions');
	 
			//
			// get initial list of emails
			//
			that.searchEmails({});  
	
			//
			// get weather info
			//
			that.getWeather(0);

			//
			// setup tasks
			//
			if (that.options.show_tasks) { that.refreshTasks(); }
		}}).send();
 
		//
		// detect placeholder support
		//
		var test = newEl({'type':'input'}, $('default_options'));
		this.placeholderSupport = ('placeholder' in test);
		test.parentNode.removeChild(test);
	},

	/*
	 * Creates action links
	 */
	initActionLinks: function () {
		//
		// setup default actions
		//
		var abox = $('default_options');
		abox.innerHTML = '';
		var tmp = null;
		var line = null;

		newEl({'type':'div', 'class':'act_subtitle', 'text':'Email Functions'}, abox);
		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'id':'compose_link', 'text':'Compose', 'attributes':{'tabindex':'0'}}, line);
		tmp.onclick = function (e) { this.composeEmail(null, 'new'); }.bind(this);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Search Emails ...'}, line);
		tmp.onclick = function (e) { this.showEmailSearch(e); }.bind(this);
		newEl({'type':'div', 'id':'search_emails_box', 'style':{'display':'none'}}, abox);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Manage Folders'}, line);
		tmp.onclick = function (e) { this.showManageFolders(e); }.bind(this);

		newEl({'type':'div', 'class':'act_subtitle', 'text':'Other Features'}, abox);
		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Manage Contacts'}, line);
		tmp.onclick = function (e) { this.showContacts(); }.bind(this);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Manage Notes'}, line);
		tmp.onclick = function (e) { this.showNotes(e); }.bind(this);

		if (this.options.feature_links && this.options.feature_links.length > 0) {
			var txt = '';
			var href = '';
			for (var i=0; i<this.options.feature_links.length; i++) {
				// skip invalid links
				if (!this.options.feature_links[i]['text'] || !this.options.feature_links[i]['href']) { continue; }

				txt = this.options.feature_links[i]['text'];
				href = this.options.feature_links[i]['href'];
				line = newEl({'type':'div', 'class':'act_link'}, abox);
				tmp = newEl({'type':'a', 'text':txt, 'attributes':{'href':href}}, line);
				if (this.options.feature_links[i]['target']) { tmp.setAttribute('target', this.options.feature_links[i]['href']); }

				// add a title if there is one specified
				if (this.options.feature_links[i]['title']) { line.firstChild.setAttribute('title', this.options.feature_links[i]['title']); }
			}
		}
   
		newEl({'type':'div', 'class':'act_subtitle', 'text':'System'}, abox);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Preferences'}, line);
		tmp.onclick = function (e) { this.showSettings(e); }.bind(this);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Help'}, line);
		tmp.onclick = function (e) { this.showHelp(e); }.bind(this);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'a', 'id':'twig_logout', 'text':'Logout', 'attributes':{'href':'logout.php'}}, line);

		//
		// set selected actions
		//
		var abox = $('selected_options');
		abox.innerHTML = '';
		var tmp = null;

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Select All'}, line);
		tmp.onclick = function (e) { this.refreshSelectedActions('all'); }.bind(this);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Unselect All'}, line);
		tmp.onclick = function (e) { this.refreshSelectedActions('none'); }.bind(this);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Copy To ...'}, line);
		newEl({'type':'div', 'id':'copyto_folder', 'style':{'display':'none'}}, abox);
		tmp.onclick = function (e) { var box = $('copyto_folder'); box.style.display = (box.style.display == 'none')?'':'none'; }.bind(this);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Move To ...'}, line);
		newEl({'type':'div', 'id':'moveto_folder', 'style':{'display':'none'}}, abox);
		tmp.onclick = function (e) { var box = $('moveto_folder'); box.style.display = (box.style.display == 'none')?'':'none'; }.bind(this);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Move to Trash'}, line);
		newEl({'type':'span', 'text':'\u00a0', 'style':{'backgroundColor':'#000', 'marginLeft':'5px', 'borderRadius':'2px'}}, tmp);
		tmp.onclick = function (e) { this.updateEmails({'cmd':'trash'}); }.bind(this);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Mark as Spam'}, line);
		newEl({'type':'span', 'text':'\u00a0', 'style':{'backgroundColor':'#ff0000', 'marginLeft':'5px', 'borderRadius':'2px'}}, tmp);
		tmp.onclick = function (e) { this.updateEmails({'cmd':'spam'}); }.bind(this);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Mark as Read'}, line);
		tmp.onclick = function (e) { this.updateEmails({'cmd':'read'}); }.bind(this);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Mark as Unread'}, line);
		tmp.onclick = function (e) { this.updateEmails({'cmd':'unread'}); }.bind(this);
   
		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Flag'}, line);
		tmp.onclick = function (e) { this.updateEmails({'cmd':'flag'}); }.bind(this);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Unflag'}, line);
		tmp.onclick = function (e) { this.updateEmails({'cmd':'unflag'}); }.bind(this);

		line = newEl({'type':'div', 'class':'act_link'}, abox);
		tmp = newEl({'type':'span', 'text':'Delete'}, line);
		tmp.onclick = function (e) { this.updateEmails({'cmd':'delete'}); }.bind(this);
	},

	/*
	 * Sets up the dropdown for folders
	 * @param array folders
	 */
	initFolders: function (folders) {
		var set_box = $('set_folder');
		var copyto_box = $('copyto_folder');
		var moveto_box = $('moveto_folder');
		var change_box = $('change_folder_list_box');

		for (var folder in folders) {
			this.createFolderElement(folder, folders[folder], set_box, true, this.setEmailFolder);
			this.createFolderElement(folder, folders[folder], copyto_box, true, this.copyEmailTo);
			this.createFolderElement(folder, folders[folder], moveto_box, true, this.moveEmailTo);
			// this is for the element that allows to quickly change folders because it does not have a tree
			this.createFolderLine([], folder, folders[folder], change_box);
		}
	},

	/*
	 * Setup contacts box and events
	 */
	initContacts: function () {
		var cbox = $('contacts_box');
		cbox.innerHTML = '';
		// close contacts link
		var tmp = newEl({'type':'span', 'class':'xlink', 'text':'\u00D7', 'attributes':{'title':'Esc to close'}}, cbox);
		tmp.onclick = function (e) { this.hideContacts(); }.bind(this);

		// contacts search
		var sbox = newEl({'type':'div', 'class':'contacts_search'}, cbox);
		newEl({'type':'div', 'id':'contacts_filter_title', 'text':'Loading...'}, sbox);
		tmp = newEl({'type':'input', 'class':'fakelink', 'id':'contacts_new_link', 'attributes':{'value':'+', 'type':'button'}}, sbox);
		tmp.onclick = function (e) { this.newContact(e); }.bind(this);
		
		var line = newEl({'type':'div'}, sbox);
		if (!this.placeholderSupport) { newEl({'type':'label', 'text':'Firstname:'}, line); }
		tmp = newEl({'type':'input', 'id':'contacts_search_firstname', 'attributes':{'type':'text', 'placeholder':'Firstname', 'title':'Firstname'}}, line);
		tmp.onkeydown = function (e) { eventOnEnter(e, this.searchContacts, this); }.bind(this);

		line = newEl({'type':'div'}, sbox);
		if (!this.placeholderSupport) { newEl({'type':'label', 'text':'Lastname:'}, line); }
		tmp = newEl({'type':'input', 'id':'contacts_search_lastname', 'attributes':{'type':'text', 'placeholder':'Lastname', 'title':'Lastname'}}, line);
		tmp.onkeydown = function (e) { eventOnEnter(e, this.searchContacts, this); }.bind(this);

		line = newEl({'type':'div'}, sbox);
		if (!this.placeholderSupport) { newEl({'type':'label', 'text':'Email:'}, line); }
		tmp = newEl({'type':'input', 'id':'contacts_search_email', 'attributes':{'type':'text', 'placeholder':'Email', 'title':'Email'}}, line);
		tmp.onkeydown = function (e) { eventOnEnter(e, this.searchContacts, this); }.bind(this);

		line = newEl({'type':'div'}, sbox);
		if (!this.placeholderSupport) { newEl({'type':'label', 'text':'Number:'}, line); }
		tmp = newEl({'type':'input', 'id':'contacts_search_number', 'attributes':{'type':'text', 'placeholder':'Number', 'title':'Number'}}, line);
		tmp.onkeydown = function (e) { eventOnEnter(e, this.searchContacts, this); }.bind(this);

		line = newEl({'type':'div'}, sbox);
		if (!this.placeholderSupport) { newEl({'type':'label', 'text':'IM:'}, line); }
		tmp = newEl({'type':'input', 'id':'contacts_search_im', 'attributes':{'type':'text', 'placeholder':'IM', 'title':'IM'}}, line);
		tmp.onkeydown = function (e) { eventOnEnter(e, this.searchContacts, this); }.bind(this);

		line = newEl({'type':'div'}, sbox);
		if (!this.placeholderSupport) { newEl({'type':'label', 'text':'Address:'}, line); }
		tmp = newEl({'type':'input', 'id':'contacts_search_address', 'attributes':{'type':'text', 'placeholder':'Address', 'title':'Address'}}, line);
		tmp.onkeydown = function (e) { eventOnEnter(e, this.searchContacts, this); }.bind(this);

		line = newEl({'type':'div', 'style':{'textAlign':'center'}}, sbox);
 		tmp = newEl({'type':'input', 'id':'rand', 'class':'fakelink', 'attributes':{'type':'button', 'value':'Search'}}, line);
		tmp.onclick = function (e) { this.searchContacts(e); }.bind(this);
		tmp = newEl({'type':'input', 'class':'fakelink', 'attributes':{'type':'button', 'value':'Clear'}}, line);
		tmp.onclick = function (e) { this.clearContactsSearch(e); }.bind(this);

		newEl({'type':'div', 'id':'contacts_list'}, cbox);
	},

	/*
	 * Setup notes box and events
	 */
	initNotes: function () {
 		var nbox = $('notes_box');
		nbox.innerHTML = '';
		// close notes link
		var tmp = newEl({'type':'span', 'class':'xlink', 'text':'\u00D7', 'attributes':{'title':'Esc to close'}}, nbox);
		tmp.onclick = function (e) { this.hideNotes(); }.bind(this);

		// notes search
		var sbox = newEl({'type':'div', 'class':'notes_search'}, nbox);
		newEl({'type':'div', 'id':'notes_filter_title', 'text':'Loading...'}, sbox);
		tmp = newEl({'type':'input', 'class':'fakelink', 'id':'notes_new_link', 'attributes':{'value':'+', 'type':'button'}}, sbox);
		tmp.onclick = function (e) { this.newNote(e); }.bind(this);
		tmp = newEl({'type':'input', 'id':'notes_filter_input', 'attributes':{'type':'text', 'placeholder':'Filter Notes', 'title':'Filter Notes', 'spellcheck':false}}, sbox);
		tmp.onkeyup = function (e) { this.searchNotesKeyHandler(e); }.bind(this);

		newEl({'type':'div', 'id':'notes_list'}, nbox);
	},

	/*
	 * Setup preferences box and events
	 */
	initSettings: function () {
		var sbox = $('settings_box');
		sbox.innerHTML = '';
		// close settings link
		var tmp = newEl({'type':'span', 'class':'xlink', 'text':'\u00D7', 'attributes':{'title':'Esc to close'}}, sbox);
		tmp.onclick = function (e) { this.hideSettings(); }.bind(this);

		// make a wrapper so scrolling does not go to the corners
		sbox = newEl({'type':'div', 'class':'scroller'}, sbox);
 
		// change password form
		newEl({'type':'div', 'class':'section_title', 'text':'Change Password'}, sbox);
		var line = newEl({'type':'div', 'class':'settings_formbox'}, sbox);
		if (!this.placeholderSupport) { newEl({'type':'label', 'text':'Old Password:'}, line); }
		newEl({'type':'input', 'id':'pref_oldpass', 'attributes':{'value':'', 'type':'password', 'placeholder':'Old Password', 'title':'Old Password'}}, line);
		if (!this.placeholderSupport) { newEl({'type':'label', 'text':'New Password:'}, line); }
		newEl({'type':'input', 'id':'pref_newpass1', 'attributes':{'value':'', 'type':'password', 'placeholder':'New Password', 'title':'New Password'}}, line);
		if (!this.placeholderSupport) { newEl({'type':'label', 'text':'New Password:'}, line); }
		tmp = newEl({'type':'input', 'id':'pref_newpass2', 'attributes':{'value':'', 'type':'password', 'placeholder':'New Password', 'title':'New Password'}}, line);
		tmp.onkeydown = function (e) { eventOnEnter(e, this.changePassword, this); }.bind(this);
		newEl({'type':'div', 'id':'changepass_status'}, line);
   				
		// manage sync
		newEl({'type':'div', 'class':'section_title', 'text':'Google Sync'}, sbox);
		line = newEl({'type':'div', 'class':'settings_formbox'}, sbox);  

		// weather locations
		newEl({'type':'div', 'class':'section_title', 'text':'Weather Locations'}, sbox);
		line = newEl({'type':'div', 'class':'settings_formbox'}, sbox);  
		var asbox = newEl({'type':'div', 'class':'weathersuggest_box'}, line);  
		this.weatheras = new weatherSuggest({'mainContainer':asbox});
		this.weatheras.changed = function (action) { this.saveLocations(action); }.bind(this);
		if (this.options.weather_locations) {
			var bits = [];

			for (var place in this.options.weather_locations) {
				bits.push({'key':place, 'value':this.options.weather_locations[place]});
			}

			this.weatheras.addBits(bits);
		}
		newEl({'type':'a', 'text':'Weather forecast from yr.no, delivered by the Norwegian Meteorological Institute and the NRK', 'attributes':{'href':'http://www.yr.no', 'target':'_new'}}, line);

		// manage from addresses
		newEl({'type':'div', 'class':'section_title', 'text':'From Addresses'}, sbox);
		var addrs = this.options.from_addresses;
		var count = 0;
		for (var addr in this.options.from_addresses) { count++; }
		var tbl = newEl({'type':'table', 'id':'from_addr_list', 'style':{'borer-spacing':'0 5px', 'display':'none'}}, sbox);

		line = newEl({'type':'div', 'class':'settings_formbox'}, sbox); 
		tmp = newEl({'type':'input', 'class':'fakelink', 'id':'from_addr_button', 'attributes':{'value':'Manage ('+ count +') Addresses', 'type':'button', 'numcount':count}}, line);
		tmp.onclick = function (e) { this.toggleFromAddresses(true); }.bind(this); 
		var btn = $('from_addr_button');
	},

	/*
	 * Converts weather date string to date object
	 * @param string
	 */
	weatherStringDate: function (str) {
		var dobj = new Date(str.replace('T', ' ').replace('-', '/'));

		// Safari and possibly IE
		if (isNaN(dobj.getTime())) {
			var datestr = str.split(/[-T.]/);
			dobj = new Date(datestr.slice(0,3).join('/')+' '+datestr[3]);
		} 

		return dobj;
	},

	/*
	 * Displays weather info if needed
	 */
	getWeather: function (num) {
		if (!isNumeric(num)) {
			num = this.weatherLocationNum;
			// only allow forced refresh after 1min
			if ((this.weatherLastUpdate + 60000) > (new Date().getTime())) { return false; }
		}

		// make sure we have locations
		if (!this.options.weather_locations || this.options.weather_locations.length > 0) { return false; }

		// find location to get
		var i=0;
		var loc_url = false;
		for (var url in this.options.weather_locations) {
			if (i == num) { var loc_name = this.options.weather_locations[url]; loc_url = url; }
			i++;
		}

		// if the num is off, use the first location
		if (!loc_url) { this.getWeather(0); return; }

		// save the num for refreshes
		this.weatherLocationNum = num;
 
		var wbox = $('weather_info');
		wbox.innerHTML = '';
		setText(wbox, 'Loading weather...');

		//
		// make the request
		//
		that = this;
		if (this.weather_request && this.weather_request.isRunning()) { return; }
		var postData = {'feat':'Weather', 'command':'getForecast', 'location':loc_url};
		this.weather_request = new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			// handle response
			if (!r) { return; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }

			var ts = new Date();
			that.weatherLastUpdate = ts.getTime();

			// clear out wbox
			wbox.innerHTML = '';

			// use the first location since the file is always updated
			var winfo = resp['forecast'][0];
			var ftemp = Math.round((winfo['temperature_celsius'].toFloat() * 1.8) + 32);
			var wmph = Math.round(winfo['wind']['speed_mps'].toFloat() * 2.23694);

			// show night or day icon
			var secoffset = ((ts.getTimezoneOffset() *-1) - resp['utcoffsetmins']) *60000;
			var now = ts.getTime() - secoffset;
			var srise = that.weatherStringDate(resp['sun']['rise']).getTime();
			var sset = that.weatherStringDate(resp['sun']['set']).getTime();
			var imgsrc = 'images/weather_icons/'+ winfo['symbol'];
			imgsrc += (srise > now || now > sset)?'n.png':'d.png';

			// write the current info
			var line = newEl({'type':'div', 'class':'weather_city'}, wbox);
			newEl({'type':'span', 'class':'weather_city', 'text':resp['city'], 'attributes':{'title':resp['city'] +', '+ resp['state'] +' '+ resp['country']}}, line);
			if (i > 1) {
				var next = newEl({'type':'span', 'class':'weather_next', 'text':'\u27a4'}, line);
				next.onclick = function (e) {
					var nextnum = this.weatherLocationNum +1;
					this.getWeather(nextnum);
				}.bind(that);
			}

			line = newEl({'type':'div', 'class':'wicon'}, wbox);
			var suntxt = new Date(srise).format('%l:%M %p') +' \u2013 '+ new Date(sset).format('%l:%M %p')
			var wlink = newEl({'type':'img', 'attributes':{'src':imgsrc, 'width':'64px', 'height':'64px', 'title':suntxt}}, line);
			wlink.onclick = function (e) { this.showWeather(e); }.bind(that);

			line = newEl({'type':'div', 'style':{'float':'left', 'marginTop':'10px', 'marginLeft':'5px'}}, wbox);
			newEl({'type':'span', 'class':'weather_desc', 'text':winfo['description'], 'attributes':{'title':winfo['symbol'] +'. '+ winfo['description']}}, line);
			newEl({'type':'span', 'class':'weather_temp', 'text':ftemp +'\u00b0', 'attributes':{'title':winfo['temperature_celsius'] +'\u00b0 C'}}, line);
			newEl({'type':'br'}, line);
			newEl({'type':'span', 'class':'weather_direction', 'text':winfo['wind']['code'], 'attributes':{'title':winfo['wind']['direction']}}, line);
			newEl({'type':'span', 'class':'weather_speed', 'text':wmph +' mph', 'attributes':{'title':winfo['wind']['speed_mps'] +' mps'}}, line);

			if (winfo['precipitation_mm'] > 0) {
				var wprec = (winfo['precipitation_mm'].toFloat() * 0.0393701).toFixed(2);
				newEl({'type':'br'}, line);
				newEl({'type':'span', 'class':'weather_precipitation', 'text':wprec +'\u2033', 'attributes':{'title':winfo['precipitation_mm'] +' mm'}}, line);
			}

			if (secoffset != 0) {
				newEl({'type':'br'}, line);
				var dt = new Date(now);
				newEl({'type':'span', 'class':'weather_ltime', 'text':dt.format('%l:%M %p')}, line);
			}

			// set control click to refresh
			$('weather_info').onclick = function (e) {
				if (e && e.ctrlKey) { this.getWeather(); }
			}.bind(that);
		}}).send(); 
	},

	/*
	 * Shows weather details
	 */
	showWeather: function (num) {
		if (!isInt(num)) { num = this.weatherLocationNum; }

		// make sure we have locations
		if (!this.options.weather_locations || this.options.weather_locations.length > 0) { return false; }
		var wbox = $('weather_box');
		wbox.innerHTML = '';
		this.setShortcuts('weather');
		showCover(wbox);

		// find location to get
		var i=0;
		var loc_url = false;
		var loc = '';
		var loc_num = 0;
		for (var url in this.options.weather_locations) {
			if (i == num) {
				loc = this.options.weather_locations[url];
				loc_url = url;
				loc_num = i;
			}
			i++;
		}

		// if the num is off, use the first location
		if (!loc) { return; }
  
		var xlink = newEl({'type':'span', 'class':'xlink', 'text':'\u00D7', 'attributes':{'title':'Esc to close'}}, wbox);
		xlink.onclick = function (e) { this.hideWeather(); }.bind(that);

		var title = newEl({'type':'div', 'class':'section_title', 'text':loc}, wbox);
		if (i > 1) {
			var next = newEl({'type':'span', 'class':'weather_next', 'text':'\u27a4'}, title);
			next.onclick = function (e) {
				// check if we are at the end of the list
				var nextnum = ((i-1) > loc_num)?loc_num+1:0;
				this.showWeather(nextnum);
			}.bind(that); 
		}

		//
		// make the request
		//
		that = this;
		if (this.weather_request && this.weather_request.isRunning()) { return; }
		var postData = {'feat':'Weather', 'command':'getForecast', 'location':loc_url};
		this.weather_request = new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			// handle response
			if (!r) { return; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }

			var forecast = resp['forecast'];
			var fdbox = newEl({'type':'div', 'class':'forecast_details'}, wbox);
			var dbox = newEl({'type':'div', 'class':'forecast_days'}, fdbox);
			dbox.style.width = (51 * forecast.length) +'px';
			var fcbox = newEl({'type':'div', 'class':'forecast_container'}, fdbox);
			fcbox.style.width = (51 * forecast.length) +'px';

			// create the box for the first day
			var d = that.weatherStringDate(forecast[0]['from']);

			var fbox = ftemp = prec = imgsrc = tmp = null;
			for (var i=0; i<forecast.length; i++) {
				// create/update the date box
				d = that.weatherStringDate(forecast[i]['from']);
				if (dbox.lastChild && d.format('%Y-%m-%d') == dbox.lastChild.getAttribute('day')) {
					// update
					dbox.lastChild.style.width = (dbox.lastChild.style.width.replace('px', '').toInt() + 51) +'px';
				} else {
					// create
					newEl({'type':'div', 'nobr':1, 'class':'forecast_day', 'text':d.format('%a %e%o'), 'attributes':{'day':d.format('%Y-%m-%d')}, 'style':{'width':'51px'}}, dbox);
					if (fcbox.lastChild) { fcbox.lastChild.className += ' endday'; }
				}

				tmp = d.format('%k');
				imgsrc = 'images/weather_icons/'+ forecast[i]['symbol'];
				imgsrc += (tmp < 6 || tmp > 18)?'n.png':'d.png';

				ftemp = Math.round((forecast[i]['temperature_celsius'].toFloat() * 1.8) + 32);

				// convert rainfall to snow for snowfall
				if (forecast[i]['description'].toLowerCase() == 'snow') { forecast[i]['precipitation_mm'] = forecast[i]['precipitation_mm'] * 10; }
				prec = (forecast[i]['precipitation_mm'] > 0)?(forecast[i]['precipitation_mm'].toFloat() * 0.0393701).toFixed(1):0;
 
				fbox = newEl({'type':'div', 'class':'forecast_period'}, fcbox);
				newEl({'type':'img', 'attributes':{'src':imgsrc, 'width':'30px', 'title':forecast[i]['description']}}, fbox);
				tmp = newEl({'type':'div', 'class':'bar'}, fbox);
				// show freezing temperatures
				if (ftemp < 33) { tmp.className = 'bar freezing'; }
				tmp.style.height = (ftemp *2) +'px';
				newEl({'type':'div', 'class':'temperature', 'text':ftemp.toString(), 'attributes':{'title':forecast[i]['temperature_celsius'] +'C'}}, tmp);
				if (prec > 0) { newEl({'type':'div', 'class':'precipitation', 'text':prec +'\u2033'}, tmp); }
				// if the bar is going to be really small, put the tempreature (and precp) above it
				if (prec > 0 && ftemp > 11 && ftemp < 21) {
					while (tmp.childNodes.length > 1) { fbox.insertBefore(tmp.firstChild, tmp); }
				} else if ((prec == 0 && ftemp < 12) || (prec > 0 && ftemp < 21)) {
					while (tmp.childNodes.length > 0) { fbox.insertBefore(tmp.firstChild, tmp); }
				}
				newEl({'type':'div', 'class':'time', 'text':d.format('%l%p').replace('AM', 'a').replace('PM', 'p')}, fbox);
			}

			var lnkbox = newEl({'type':'div', 'class':'weather_link'}, wbox);
			newEl({'type':'a', 'text':'Weather forecast from yr.no, delivered by the Norwegian Meteorological Institute and the NRK', 'attributes':{'href':'http://www.yr.no', 'target':'_new'}}, lnkbox);
		}}).send();
	},

	/*
	 * Hides the weather details
	 */
	hideWeather: function () {
		hideCover($('weather_box'));

		this.toggleRightColumn('smart');
	},

	/*
	 * Creates the HTML elements for the folder tree
	 * @param string folder name
	 * @param array folders (subfolders in this folder)
	 * @param object prnt (HTML div that this will go in)
	 * @param bool open (closed by default or open it)
	 */
	createFolderElement: function (folder, folders, prnt, open, click_handle) {
		// find the full path to this folder
		var parentpath = (checkAttr(prnt, 'fullpath'))?prnt.getAttribute('fullpath'):'';
		parentpath += (parentpath.length > 0)?this.options.mbox_seperator:'';
		var fullpath = parentpath + folder;
		var imgsrc = (open)?'minus.gif':'plus.gif';
		imgsrc = this.options.fullurl +'/images/'+ imgsrc;

		// create a box for name and more folders
		var fbox = newEl({'type':'div', 'attributes':{'folder':folder, 'fullpath':fullpath}}, prnt);
		var tbox = newEl({'type':'div', 'class':'foldername'}, fbox);
		var img = newEl({'type':'img', 'attributes':{'src':imgsrc}}, tbox);
		img.onclick = function (e) { this.toggleFolderView(e); }.bind(this);
		var title = newEl({'type':'span', 'class':'foldername', 'text':folder}, tbox);
		title.onclick = function (e) { click_handle(e, this) }.bind(this);

		if (JSON.encode(folders) != '[]') {
			var sfbox = newEl({'type':'div', 'class':'subfolders', 'attributes':{'folder':folder, 'fullpath':fullpath}}, fbox);
			sfbox.style.display = (open)?'':'none';
			for (var folder in folders) {
				this.createFolderElement(folder, folders[folder], sfbox, false, click_handle);
			}
		} else {
			img.style.visibility = 'hidden';
		}
	},

	/*
	 * Creates the HTML elements for a list of folders
	 * @param array previous folders [INBOX, sent-mail]
	 * @param string folder
	 * @param array subfolders {Drafts:[], ...}
	 * @param object prnt (HTML div that this will go in)
	 */
	createFolderLine: function (prevfolders, folder, subfolders, prnt) {
		var fullpath = prevfolders.join(this.options.mbox_seperator);
		if (fullpath.length > 0) { fullpath += this.options.mbox_seperator; }
		fullpath = fullpath + folder;
		var line = newEl({'type':'div', 'class':'change_folder_line', 'attributes':{'folder':folder.toLowerCase(), 'fullpath':fullpath}}, prnt);
		
		// write all subfolders
		var newprev = [];
		for (var i=0; i<prevfolders.length; i++) {
			newprev.push(prevfolders[i]);
			newEl({'type':'span', 'class':'prnt_folder', 'text':prevfolders[i]}, line);
			newEl({'type':'span', 'class':'prnt_folder_sep', 'text':' \u00a0\u203A\u00a0 '}, line);
		}

		// write folder name
		newEl({'type':'span', 'class':'folder', 'text':folder}, line);

		// recurse if necessary
		// folders without any subfolders are empty arrays which show up as []
		if (JSON.encode(subfolders) != '[]') {
			newprev.push(folder);
			for (var subfolder in subfolders) {
				this.createFolderLine(newprev, subfolder, subfolders[subfolder], prnt);
			}
		}
	},

	/*
	 * Expands/Collapses the subfolder in tree
	 */
	toggleFolderView: function (e) {
		if (!e) { e = window.event; }

		if (Browser.ie) {
			// BROKEN IE
			e.cancelBubble = true;
			e.returnValue = false;
		} else {
			e.stopPropagation();
		} 
 
		var img = findTarget(e, 'img');
		if (!img) { return false; }

		if (!img.parentNode.nextSibling) { return false; }

		var subfolders = img.parentNode.nextSibling;
		if (subfolders.style.display == 'none') {
			subfolders.style.display = '';
			img.src = this.options.fullurl +'/images/minus.gif';
		} else {
			subfolders.style.display = 'none';
			img.src = this.options.fullurl +'/images/plus.gif';
		}
	},

	/*
	 * Displays quick folder change UI
	 */
	gotoFolder: function () {
		// show cover + input + folders
		showCover($('change_folder_box'));

		// set shortcuts
		this.setShortcuts('changefolder');

		// set events to filter folders by input
		var cf_input = $('change_folder_input');
		cf_input.onkeyup = function (e) {
			var code = null;
			if (!e) { e = window.event; }
			if (e.keyCode) { code = e.keyCode; }
			else if (e.which) { code = e.which; }
			else { return true; }

			if (code == 13) { // go to first folder
				var list_box = $('change_folder_list_box');
				var line = null;

				// find the first visible line
				for (var i=0; i<list_box.childNodes.length; i++) {
					line = list_box.childNodes[i];

					if (!checkAttr(line, 'fullpath')) { continue; }

					if (line.style.display == 'none') { continue; }

					this.setShortcuts('list');
					this.setEmailFolder(line);
					hideCover($('change_folder_box'));
					$('change_folder_input').blur();

					return true;
				}

			} else {
				this.filterFolders();
			}

			return true;
		}.bind(this);

		// clear input
		cf_input.value = '';
		this.filterFolders();

		// set focus
		cf_input.focus();
	},

	/*
	 * Handles keyboard events to filter folders
	 */
	filterFolders: function () {
		var search = trim($('change_folder_input').value);
		if (search.length > 0) { search = search.toLowerCase(); }

		var list_box = $('change_folder_list_box');
		var line = null;
		var stat = null;
		var displayed = 0;
		var lastfolder = null;

		// find the first visible line
		for (var i=0; i<list_box.childNodes.length; i++) {
			line = list_box.childNodes[i];

			if (!checkAttr(line, 'fullpath')) { continue; }

			if (search.length == 0 || line.getAttribute('folder').toLowerCase().indexOf(search) ==0) {
				displayed++;
				lastfolder = line;
				line.style.display = '';
				continue;
			}

			line.style.display = 'none';
		}

		// if there is only one foler displayed, go to it
		if (displayed == 1) {
			this.setShortcuts('list');
			this.setEmailFolder(lastfolder);
			hideCover($('change_folder_box'));
			$('change_folder_input').blur();
		}
	},

	/*
	 * Handles click to change folder
	 */
	setEmailFolder: function (e) {
		if (!this.folderTotalEmails && arguments.length > 1) {
			var that = arguments[1];
			that.setEmailFolder(e);
			return;
		}
		
		var fbox = findTarget(e, 'div', 'fullpath');
		if (!fbox) {
			if (checkAttr(e, 'fullpath')) { fbox = e; }
			else { return; }
		}

		// get the folder
		var fullpath = fbox.getAttribute('fullpath');

		// hide select folder box
		$('set_folder').style.display = 'none';

		// unset the choosen email
		this.choosenEmail = null;

		// display default actions
		this.toggleRightColumn('default_actions');

		// get the new emails for that folder
		this.searchEmails({'folder':fullpath});
	},

	/*
	 * Gets search criteria
	 * @return array {'from':'test'}
	 */
	getSearchCriteria: function () {
		var criteria = {};

		if ($('search_emails_box').style.display != 'none') {
			if ($('search_isflagged').checked) { criteria['flagged'] = 1; }
			if ($('search_isnew').checked) { criteria['new'] = 1; }
			if (trim($('search_from').value).length > 0) { criteria['from'] = trim($('search_from').value); }
			if (trim($('search_to').value).length > 0) { criteria['to'] = trim($('search_to').value); }
			if (trim($('search_cc').value).length > 0) { criteria['cc'] = trim($('search_cc').value); }
			if (trim($('search_subject').value).length > 0) { criteria['subject'] = trim($('search_subject').value); }
			if (trim($('search_body').value).length > 0) { criteria['body'] = trim($('search_body').value); }
			if (trim($('search_since').value).length > 0) {
				var dt = new Date().decrement('day', trim($('search_since').value).toInt());
				criteria['since'] = dt.format('%d-%b-%Y');
				
			}
		}
 
		return criteria;
	},

	/*
	 * Gets and displays emails
	 */
	searchEmails: function (opts) {
		//
		// find search criteria
		//
		var criteria = this.getSearchCriteria();

		//
		// kill the current list and show loading
		//
		var ebox = $('email_list');
		ebox.innerHTML = '';
		newEl({'type':'div', 'text':'Loading....', 'style':{'marginTop':'3em'}}, ebox);

		//
		// get request info
		//
		var that = this;
		var postData = {};
		var isFiltered = (JSON.encode(criteria) != '{}');
		if (isFiltered) {
			postData = {'feat':'Emails', 'command':'searchEmails', 'criteria':criteria};
		} else {
			postData = {'feat':'Emails', 'command':'getEmails', 'info':{'start':1, 'count':this.options.email_list_num}};
		}

		// add the folder info if specified
		if (opts && opts['folder']) { postData['folder'] = opts['folder']; }

		// shift to the left
		document.body.scrollLeft = 0;

		//
		// make request
		//
		if (this.search_request && this.search_request.isRunning()) { return; }
		clearTimeout(this.latestEmailTimeoutID);
		this.search_request = new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			that.selectedMessagesNum = 0;

			// handle response
			if (!r) { that.searchEmails(opts); return; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }

			// clear loading
			ebox.innerHTML = '';

			// set folder name if specified
			if (resp['folder'] != undefined) {
				var parts = resp['folder'].split(that.options.mbox_seperator);
				setText($('current_folder'), parts.join('\u00a0\u203A\u00a0'));
				that.currentFolder = resp['folder'];
			}

			if (resp['totalEmails']) {
				that.folderTotalEmails = resp['totalEmails'];
				var txt = '('+ addCommas(that.folderTotalEmails) +')  Emails in this folder.';
				setText($('folder_details'), txt);
			}

			if (!resp['emails']) { alert('Search produced no emails \n\n'+ JSON.encode(resp)); }

			// handle no emails
			if (resp['emails'].length == 0) {
				if (isFiltered) {
					newEl({'type':'div', 'text':'No emails found', 'class':'alignc mfont thick', 'style':{'marginTop':'3em'}}, ebox);
				} else {
					newEl({'type':'div', 'text':'No emails in this folder', 'class':'alignc mfont thick', 'style':{'marginTop':'3em'}}, ebox);
				}
				return;
			}

			// kick off the process of getting latest emails if we need to
			if (isFiltered) {
				clearTimeout(that.latestEmailTimeoutID);
				$('email_list').onscroll = null;
			} else {
				// we have an unfiltered list so set getLatest and getMore
				that.latestEmailTimeoutID = that.getLatestEmails.delay(30000, that); 
				$('email_list').onscroll = function (e) { that.getMoreEmails(); }.bind(this);
			}

			// show emails
			that.expandEmailList(resp['emails'], false);
		}}).send();
	},

	/*
	 * Shows options to search 
	 */
	showEmailSearch: function () {
		var sbox = $('search_emails_box');
		sbox.style.display = '';

		this.setShortcuts('search');

		// set the search link to toggle
		sbox.previousSibling.firstChild.onclick = function (e) { this.clearEmailSearch(e); }.bind(this);

		if ($('search_isflagged')) {
			// set the focus on the first element so the user can tab through
			$('search_isflagged').focus();

			return;
		}

		var cell = newEl({'type':'div'}, sbox);
		newEl({'type':'label', 'class':'search_label', 'text':'Flagged:'}, cell);
		if (this.placeholderSupport) { cell.lastChild.style.visibility = 'hidden'; }
		newEl({'type':'input', 'id':'search_isflagged', 'attributes':{'type':'checkbox'}}, cell);
		if (this.placeholderSupport) { newEl({'type':'label', 'class':'search_label search-chkbx', 'text':'(Flagged)'}, cell); }
		else { newEl({'type':'span', 'class':'xlfont', 'style':{'color':'#aaa'}, 'text':'\u2691'}, cell); }

		cell = newEl({'type':'div'}, sbox);
		newEl({'type':'label', 'class':'search_label', 'text':'New Emails:'}, cell);
		if (this.placeholderSupport) { cell.lastChild.style.visibility = 'hidden'; }
		newEl({'type':'input', 'id':'search_isnew', 'attributes':{'type':'checkbox'}}, cell);
		if (this.placeholderSupport) { newEl({'type':'label', 'class':'search_label search-chkbx', 'nobr':'1', 'text':'(Only New Emails)'}, cell); }

		cell = newEl({'type':'div'}, sbox);
		newEl({'type':'label', 'class':'search_label', 'text':'From:'}, cell);
		if (this.placeholderSupport) { cell.lastChild.style.visibility = 'hidden'; }
		newEl({'type':'input', 'id':'search_from', 'attributes':{'type':'text', 'placeholder':'From', 'title':'From', 'spellcheck':false}}, cell);

		cell = newEl({'type':'div'}, sbox);
		newEl({'type':'label', 'class':'search_label', 'text':'To:'}, cell);
		if (this.placeholderSupport) { cell.lastChild.style.visibility = 'hidden'; }
		newEl({'type':'input', 'id':'search_to', 'attributes':{'type':'text', 'placeholder':'To', 'title':'To', 'spellcheck':false}}, cell);

		cell = newEl({'type':'div'}, sbox);
		newEl({'type':'label', 'class':'search_label', 'text':'CC:'}, cell);
		if (this.placeholderSupport) { cell.lastChild.style.visibility = 'hidden'; }
		newEl({'type':'input', 'id':'search_cc', 'attributes':{'type':'text', 'placeholder':'CC', 'title':'CC', 'spellcheck':false}}, cell);

		cell = newEl({'type':'div'}, sbox);
		newEl({'type':'label', 'class':'search_label', 'text':'Subject:'}, cell);
		if (this.placeholderSupport) { cell.lastChild.style.visibility = 'hidden'; }
		newEl({'type':'input', 'id':'search_subject', 'attributes':{'type':'text', 'placeholder':'Subject', 'title':'Subject', 'spellcheck':false}}, cell);

		cell = newEl({'type':'div'}, sbox);
		newEl({'type':'label', 'class':'search_label', 'text':'Body:'}, cell);
		if (this.placeholderSupport) { cell.lastChild.style.visibility = 'hidden'; }
		newEl({'type':'input', 'id':'search_body', 'attributes':{'type':'text', 'placeholder':'Body', 'title':'Body', 'spellcheck':false}}, cell);

		cell = newEl({'type':'div'}, sbox);
		newEl({'type':'label', 'class':'search_label', 'text':'Since:'}, cell);
		if (this.placeholderSupport) { cell.lastChild.style.visibility = 'hidden'; }
		var sel = newEl({'type':'select', 'id':'search_since'}, cell);
		sel.options[0] = new Option('Today', '1');
		sel.options[1] = new Option('Past Week', '7');
		sel.options[2] = new Option('Past Month', '30');
		sel.options[3] = new Option('Past 6 Month', '180');
		sel.options[4] = new Option('Past Year', '365');
		sel.options[5] = new Option('Everything', '');
		sel.value = '30';
		

		cell = newEl({'type':'div'}, sbox);
		if (this.placeholderSupport) { cell.style.textAlign = 'center'; }
		newEl({'type':'label', 'class':'search_label', 'text':' ', 'style':{'visibility':'hidden'}}, cell);
		var tmp = newEl({'type':'input', 'class':'fakelink', 'attributes':{'type':'button', 'value':'Search'}}, cell);
		tmp.onclick = function (e) { this.searchEmails(e); }.bind(this);
		tmp = newEl({'type':'input', 'class':'fakelink', 'attributes':{'type':'button', 'value':'Clear'}}, cell);
		tmp.onclick = function (e) { this.clearEmailSearch(); }.bind(this);

		$('search_isflagged').focus();
	},

	/*
	 * Hides the search box which means filtering is disabled
	 */
	clearEmailSearch: function () {
		var sbox = $('search_emails_box');
		// hide the search box so search criteria is not taken into account
		sbox.style.display = 'none';

		// reset the shortcuts
		this.setShortcuts('list');

		// set the search link to toggle
		sbox.previousSibling.firstChild.onclick = function (e) { this.showEmailSearch(e); }.bind(this);

		// get a fresh list
		this.searchEmails(); 
	},

	/*
	 * Gets latests email for unfiltered lists
	 */
	getLatestEmails: function () {
		var vbox = $('email_list');
		if (vbox.childNodes.length == 0) { return false; }

		var lbox = vbox.firstChild;
		if (!checkAttr(lbox, 'msguid')) {
			// try the second box incase we have messages on the first one
			if (vbox.childNodes.length > 1 && checkAttr(vbox.childNodes[1], 'msguid')) {
				lbox = vbox.childNodes[1];
			} else {
				return false;
			}
		}

		var msguid = lbox.getAttribute('msguid');

		var that = this;
		var postData = {'feat':'Emails', 'command':'getLatestEmails', 'latest_msguid':msguid};
		// if we are already searching, then let that one finish
		if ((this.get_latest_request && this.get_latest_request.isRunning())) { return; }
		this.get_latest_request = new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			that.latestEmailTimeoutID = that.getLatestEmails.delay(30000, that);

			var txt = '';
			// handle response
			if (!r) {
				var txt = 'An error occurred getting the list of latest emails "'+ r +'"';
				setText($('folder_details'), txt);
				return false;
			}
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }

			if (resp['totalEmails']) {
				that.folderTotalEmails = resp['totalEmails'];
				txt = '('+ addCommas(that.folderTotalEmails) +')  Emails in this folder.';
				setText($('folder_details'), txt);
			}

			// show emails
			that.expandEmailList(resp['emails'], true);
		}}).send();  
	},

	/*
	 * Expands the list when the user scrolls down
	 * @param string ('force' to force the download)
	 */
	getMoreEmails: function (force) {
		var lc = $('email_list');

		if (!force || force != 'force') {
			var lcscrollsize = lc.getScrollSize();
			var lcscroll = lc.getScroll();
			var lcsize = lc.getSize();
			var sleft = (lcscrollsize['y'] - lcscroll['y'] - lcsize['y']);
		}

		// only get more if we are at the bottom
		if (sleft > 800) { return; }

		// find out where to start
		var start = $('email_list').childNodes.length +1;

		// if we already have all of them, do not ask for more
		if (start >= this.folderTotalEmails) {
			$('email_list').onscroll = null;
			return;
		}

		var that = this;
		var postData = {'feat':'Emails', 'command':'getEmails', 'info':{'start':start, 'count':this.options.email_list_num}};
		// if we are already searching, then let that one finish
		if (this.get_more_request && this.get_more_request.isRunning()) { return; }
		this.get_more_request = new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			// handle response
			if (!r) { alert('An error occurred getting the list of more emails "'+ r +'"'); return false; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }

			if (resp['totalEmails']) {
				var txt = '('+ addCommas(resp['totalEmails']) +')  Emails in this folder.';
				setText($('folder_details'), txt);
			}
 
			// show emails
			that.expandEmailList(resp['emails'], false);
		}}).send(); 
	},

	/*
	 * Adds to list of emails
	 * @param array (list of emails)
	 * @param bool (if we should prepend messages rather than append)
	 */
	expandEmailList: function (emails, prepend) {
		if (!emails) { return false; }

		var ebox = $('email_list');
		var mbox = null;
		var tmp = null;
		var tmpbox = null;
		var dt = null;
		var dttxt = '';
		var dttitle = '';

		// if we are supposed to prepend, find the email to put things in front of
		if (prepend) { var firstmbox = ebox.firstChild; }		

		//
		// add each email to the list
		//
		for (var i=0; i<emails.length; i++) {
			var read = (emails[i]['seen'] == 0)?'unread':'read';
			var flagged = (emails[i]['flagged'] == 0)?'unflagged':'flagged';

			// create the message box
			mbox = newEl({'type':'div', 'class':'message '+ read +' ' +flagged, 'attributes':{'msguid':emails[i]['uid']}}, ebox);
			mbox.onclick = function (e) { this.viewEmail(e); }.bind(this);
			if (prepend) { ebox.insertBefore(mbox, firstmbox); }

			// unread mark
			newEl({'type':'div', 'class':'email_read'}, mbox);
 
			// show checkbox
			tmpbox = newEl({'type':'div', 'class':'email_check'}, mbox);
			tmp = newEl({'type':'input', 'attributes':{'type':'checkbox'}}, tmpbox);
			tmp.onclick = function (e) { this.selectEmail(e); }.bind(this);

			// write name
			var tmp = emails[i]['from'];
			if (!tmp) { tmp = 'Not Specified'; }
			if (emails[i]['frominfo']) {
				if (emails[i]['frominfo']['name'].length > 0) { tmp = emails[i]['frominfo']['name']; }
				else if (emails[i]['frominfo']['email'].length > 0) { tmp = emails[i]['frominfo']['email']; }
			} else if (emails[i]['toinfo']) {
				tip = emails[i]['to'];
				if (emails[i]['toinfo']['name'].length > 0) { tmp = emails[i]['toinfo']['name']; }
				else if (emails[i]['toinfo']['email'].length > 0) { tmp = emails[i]['toinfo']['email']; }
			}
			tmpbox = newEl({'type':'div', 'class':'email_name', 'text':tmp}, mbox);
			if (tmp.length > 25) { tmpbox.setAttribute('title', tmp); }

			// write date
			dt = new Date(emails[i]['udate'] *1000);
			dttxt = dt.format('%b.%e %l:%M') + dt.format('%p').toLowerCase().substr(0, 1);
			dttitle = dt.format('%b %e, %Y %l:%M %p');
			newEl({'type':'div', 'class':'email_date', 'text':dttxt, 'attributes':{'title':dttitle}}, mbox);

			// write subject
			if (!emails[i]['subject']) { emails[i]['subject'] = 'Not Specified'; }
			tmpbox = newEl({'type':'div', 'class':'email_subject', 'text':emails[i]['subject']}, mbox);
			if (emails[i]['subject'].length > 50) { tmpbox.setAttribute('title', emails[i]['subject']); }

			// 2691 is a flag - 2605 is a star
			newEl({'type':'div', 'class':'email_flag', 'text':'\u2691'}, mbox);

			newEl({'type':'div', 'class':'clear'}, mbox);
		}

		// only focus on the top box if we are not composing or reading an email
		if ($('default_actions').style.display != 'none') {
			this.focusTopCheckbox();
		}
	},

	/*
	 * Wrapper for viewEmail to go prev next
	 * @param string [prev|next]
	 */
	prevNextEmail: function (dir) {
		if (!this.choosenEmail) { return; }

		var newmbox = null;

		if (dir == 'next') {
			if (!this.choosenEmail.previousSibling || !checkAttr(this.choosenEmail.previousSibling, 'msguid')) { return false; }
			newmbox = this.choosenEmail.previousSibling;
		} else if (dir == 'prev') {
			if (!this.choosenEmail.nextSibling || !checkAttr(this.choosenEmail.nextSibling, 'msguid')) { return false; }
			newmbox = this.choosenEmail.nextSibling;
		} else {
			alert('Invalid parameter specified in prev next email selection');
			return false;
		}

		this.viewEmail(newmbox);
	},

	/*
	 * Wrapper for viewEmail (shortcut to view first)
	 */
	viewFirstEmail: function () {
		if ($('email_list').childNodes.length > 0) { this.viewEmail($('email_list').childNodes[0]); }
	},

	/*
	 * Handle click on a message
	 */
	viewEmail: function (e) {
		// find the message
		var mbox = findTarget(e, 'div', 'msguid');
		if (!mbox) {
			// we can pass in the message box as the parameter
			if (checkAttr(e, 'msguid')) {
				mbox = e;
			} else {
				// if that was not the case then exit
				alert('An error occurred finding the message you want to view');
				return false;
			}
		} else {
			if (e.ctrlKey) {
				mbox.childNodes[1].firstChild.checked = true;
				this.selectEmail(mbox.childNodes[1].firstChild);
				return;
			}
		}

		var msguid = mbox.getAttribute('msguid');
		var vbox = $('email_viewer');

		if (this.choosenEmail) { 
			// unselect it
			this.choosenEmail.removeClass('choosen');

			// if this is the same one as selected
			if (this.choosenEmail == mbox) {
				// unmark it
				this.choosenEmail = null;

				// we are definitely unvieweing an email so scroll to the left
				document.body.scrollLeft = 0;

				// close the email viewer
				vbox.style.display = 'none';
				vbox.innerHTML = '';
				this.toggleRightColumn('smart');
				return;
			}

		}

		// we are definitely viewing a new email so scroll to the right
		document.body.scrollLeft = 400;
 
		// select the new email
		this.choosenEmail = mbox;
		this.choosenEmail.addClass('choosen'); 

		// make the request to get email details
		var that = this;
		var postData = {'feat':'Emails', 'command':'getEmail', 'msguid':msguid};
		// cancel and existin request
		if (this.get_email_request && this.get_email_request.isRunning()) { this.get_email_request.cancel(); }
		this.get_email_request = new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			// handle response
			if (!r) { alert('An error occurred getting details of this email'); return false; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; } 

			// mark as seen
			mbox.className = mbox.className.replace('unread', 'read');

			// clear the viewer
			var vbox = $('email_viewer');
			vbox.innerHTML = '';
			vbox.style.display = '';

			// create the new iframe
			var viewFrame = newEl({'type':'iframe', 'class':'email_viewer_frame'}, vbox)

			// get the html of the email
			var theText = '';
			var isHTML = 0;
			if (trim(resp['email']['html']).length > 1) {
				theText += resp['email']['html'];
				isHTML = 1;
			} else if (trim(resp['email']['text']).length > 1) {
				theText = resp['email']['text'];
				theText = theText.replace(/&(?!amp;)/gi, "&amp;");
				theText = theText.replace(/<(?!lt;)/gi, "&lt;");
				theText = theText.replace(/>(?!gt;)/gi, "&gt;");
				theText = theText.replace(/"(?!quot;)/gi, "&quot;");
				theText = theText.replace(/'(?!#039;)/gi, "&#039;"); 
				theText = theText.replace(/(ftp|http|https|file):\/\/[\S]+(\b|$)/gim, '<a href="$&" class="blend" target="_blank">$&</a>').replace(/([^\/])(www[\S]+(\b|$))/gim, '$1<a href="http://$2" class="blend" target="_blank">$2</a>');
				theText = theText.replace(/([a-zA-Z0-9_\.\-]+\@[a-zA-Z0-9\-]+\.+[a-zA-Z0-9]{2,4})/gim, '<a href="mailto:$&" class="blend">$&</a>');
				theText = theText.replace(/\r\n/gim, '<br>');
				theText = theText.replace(/\n/gim, '<br>');

				var header = '<!DOCTYPE html><html><head><meta http-equiv="content-type" content="text/html;charset=UTF-8" /></head><body class="emailtext"><div class="emailtext" emailtext="1">';
				var footer = '</div></body></html>';
				theText = header + theText + footer;
			} else {
				theText = '<!DOCTYPE html><html><head><meta http-equiv="content-type" content="text/html;charset=UTF-8" /></head><body class="emailtext"><div class="emailtext" emailtext="1">No text to display.</div></body></html>';
			}

			// set html to the frame
			viewFrame.contentWindow.document.write(theText);

			// add the spacer div to the html
			var bdy = viewFrame.contentWindow.document.body;

			if (bdy) {
				// add box to contain menu and header info
				var eheadbox = newEl({'type':'div', 'id':'email_header_box', 'attributes':{'headerbox':1, 'ishtml':isHTML, 'headers':JSON.encode(resp['email']['fullheaders'])}});
				bdy.insertBefore(eheadbox, bdy.firstChild);

				var insertel = newEl({'type':'link', 'attributes':{'href':'https://fonts.googleapis.com/css?family=Open+Sans:300,400,600', 'rel':'stylesheet', 'type':'text/css'}});
				bdy.insertBefore(insertel, bdy.firstChild);
 
				var insertel = newEl({'type':'link', 'attributes':{'href':that.options.fullurl +'/css/'+ that.options.emailviewercss, 'rel':'stylesheet', 'type':'text/css'}});
				bdy.insertBefore(insertel, bdy.firstChild);

				var insertel = newEl({'type':'script', 'attributes':{'src':that.options.fullurl +'/javascript/'+ that.options.mootoolscorejs, 'type':'text/javascript'}});
				bdy.insertBefore(insertel, bdy.firstChild);

				insertel = newEl({'type':'script', 'attributes':{'src':that.options.fullurl +'/javascript/'+ that.options.commonjs, 'type':'text/javascript'}});
				bdy.insertBefore(insertel, bdy.firstChild);

				if (isHTML) {
					eheadbox.setAttribute('emailhtml', resp['email']['html']);
				} else {
					eheadbox.setAttribute('emailtext', resp['email']['text']);
				}

				var focuslink = newEl({'type':'a', 'attributes':{'href':'#'}}, eheadbox);

				// close link
				var xlink = newEl({'type':'span', 'class':'xlink', 'text':'\u00D7', 'attributes':{'title':'Esc to close'}}, eheadbox);
				xlink.onclick = function (e) { this.viewEmail(this.choosenEmail); }.bind(that);

				// header from
				newEl({'type':'div', 'class':'eheaderkey', 'text':'From:'}, eheadbox);
				var emailbits = [];
				if (!resp['email']['fullheaders']['From']) { resp['email']['fullheaders']['From'] = ''; }
				var emailbits = that.emailsToBits(resp['email']['fullheaders']['From'], false);
				var emailbit = null;
				resp['email']['fullheaders']['From'] = resp['email']['fullheaders']['From'].replace(/"/g, '').replace(/'/g, '');
				var tmpbox = newEl({'type':'div', 'class':'eheadervalue'}, eheadbox);
				for (var i=0; i<emailbits.length; i++) {
					emailbit = newEl({'type':'span', 'class':'headercontact', 'text':emailbits[i]['value']}, tmpbox);
					emailbit.onclick = function (e) { this.manageContact(e); }.bind(that);
					if (i < emailbits.length -1) { newEl({'type':'span', 'class':'headercontactspacer', 'text':', '}, tmpbox); }
				}
				
				newEl({'type':'div', 'class':'headerspace', 'text':'\u00a0'}, eheadbox);

				// header to
				newEl({'type':'div', 'class':'eheaderkey', 'text':'To:'}, eheadbox);
				if (!resp['email']['fullheaders']['To']) { resp['email']['fullheaders']['To'] = ''; }
				emailbits = that.emailsToBits(resp['email']['fullheaders']['To'], false);
				resp['email']['fullheaders']['To'] = resp['email']['fullheaders']['To'].replace(/"/g, '').replace(/'/g, '');
				tmpbox = newEl({'type':'div', 'class':'eheadervalue'}, eheadbox);
				for (i=0; i<emailbits.length; i++) {
					emailbit = newEl({'type':'span', 'class':'headercontact', 'text':emailbits[i]['value']}, tmpbox);
					emailbit.onclick = function (e) { this.manageContact(e); }.bind(that);
					if (i < emailbits.length -1) { newEl({'type':'span', 'class':'headercontactspacer', 'text':', '}, tmpbox); }
				}

				newEl({'type':'div', 'class':'headerspace', 'text':'\u00a0'}, eheadbox);

				// header cc
				if (resp['email']['fullheaders']['Cc'] && resp['email']['fullheaders']['Cc'].length > 0) {
					emailbits = that.emailsToBits(resp['email']['fullheaders']['Cc'], false);
					newEl({'type':'div', 'class':'eheaderkey', 'text':'Cc:'}, eheadbox);
					tmpbox = newEl({'type':'div', 'class':'eheadervalue'}, eheadbox);
					for (i=0; i<emailbits.length; i++) {
					    emailbit = newEl({'type':'span', 'class':'headercontact', 'text':emailbits[i]['value']}, tmpbox);
						emailbit.onclick = function (e) { this.manageContact(e); }.bind(that);
						if (i < emailbits.length -1) { newEl({'type':'span', 'class':'headercontactspacer', 'text':', '}, tmpbox); }
					}
					newEl({'type':'div', 'class':'headerspace', 'text':'\u00a0'}, eheadbox);
				} 

				// header subject
				if (!resp['email']['fullheaders']['Subject']) { resp['email']['fullheaders']['Subject'] = ''; }
				newEl({'type':'div', 'class':'eheaderkey', 'text':'Subject:'}, eheadbox);
				newEl({'type':'div', 'class':'eheadervalue', 'text':resp['email']['fullheaders']['Subject']}, eheadbox);
				newEl({'type':'div', 'class':'headerspace', 'text':'\u00a0'}, eheadbox);
					
				// write all the other headers
				var skipheaders = ['From', 'To', 'Cc', 'Subject'];
				var altheadbox = null;
				for (var hkey in resp['email']['fullheaders']) {
					if (inArray(hkey, skipheaders)) { continue; }

					altheadbox = newEl({'type':'div', 'class':'altheader', 'style':{'display':'none'}}, eheadbox);
					newEl({'type':'span', 'text':hkey +': '}, altheadbox);
					newEl({'type':'span', 'text':resp['email']['fullheaders'][hkey]}, altheadbox);
				}
 
				// actions
				newEl({'type':'div', 'class':'eheaderkey', 'text':'Actions:'}, eheadbox);
				var actbox = newEl({'type':'div', 'class':'eheadervalue'}, eheadbox);

				var actel = newEl({'type':'span', 'class':'eactions', 'text':'Show All Headers'}, actbox);
				actel.onclick = function (e) {
					var lnk = findTarget(e, 'span');
					if (!lnk) { alert('Link not found'); return false; }
					var headerbox = findParent(lnk, 'div', 'headerbox');
					if (!headerbox) { alert('Header container not found'); return false; }

					// show all headers
					for (var i=0; i<headerbox.childNodes.length; i++) { if (headerbox.childNodes[i].style.display == 'none') { headerbox.childNodes[i].style.display = 'block'; } }

					lnk.parentNode.removeChild(lnk);
				}

				// create attachments list
				if (resp['email']['attachments'].length > 0) {
					var filelnk = null;
					var attlnk = newEl({'type':'span', 'class':'eactions', 'text':'Attachments ('+ resp['email']['attachments'].length +')'}, actbox);
					var attlist = newEl({'type':'div', 'class':'ddmenu', 'style':{'display':'none'}}, $('email_viewer'));
					var attnames = {};
					var attfile = null;
					var imageParts = [];
					var imgreg = /.*(\.jpg|\.png|\.gif)$/i;

					for (var i=0; i<resp['email']['attachments'].length; i++) {
						attfile = resp['email']['attachments'][i];
						filelnk = newEl({'type':'div', 'class':'ddlink', 'nobr':'1', 'text':attfile['filename'] +'\u00a0\u00a0'+ readableSize(attfile['bytes']), 'attributes':{'filename':attfile['filename'], 'part':attfile['part'], 'msguid':msguid, 'title':attfile['mimetype']}}, attlist);
						filelnk.onclick = function (e) { this.downloadAttachment(e); }.bind(that);
						attnames[attfile['filename']] = attfile['part'];

						// add image previews
						
						if (attfile['mimetype'].toLowerCase() == 'image' || imgreg.test(attfile['filename'])) { imageParts.push(attfile['part']); }
					}

					if (imageParts.length > 0) {
						var imgtext = 'View '+ imageParts.length +' Image';
						if (imageParts.length > 1) { imgtext += 's'; }
						filelnk = newEl({'type':'div', 'class':'ddlink', 'text':imgtext, 'attributes':{'filename':attfile['filename'], 'parts':JSON.encode(imageParts), 'msguid':msguid}}, attlist);
						filelnk.onclick = function (e) { this.viewImages(e, bdy); }.bind(that);
					}

					// save attachments info for responding
					eheadbox.setAttribute('attachments', JSON.encode(attnames));
					 
					// fix img src for attached images
					try {
					var imgs = bdy.getElementsByTagName('img');
					var name_split = null;
					var img_name = '';
					for (i=0; i<imgs.length; i++) {
						if (imgs[i].src.indexOf('cid:') != -1) {
							name_split = imgs[i].src.split('@');
							img_name = name_split[0].replace('cid:', '');
							if (attnames[img_name]) {
								imgs[i].setAttribute('src', that.options.fullurl +'/ajax.php?feat=Emails&command=viewAttachment&msguid='+ msguid +'&part='+ attnames[img_name] +'&nodownload=1');
								that.queuedImages.push(imgs[i]);
							}
						}
					}

					// load queued images
					that.loadQueuedImages.delay(1000, that);

					} catch (err) { }
 
					// make the ddmenu for attachments
					attlnk.onclick = function (e) {
						var fcoor = viewFrame.getCoordinates();
						var lcoor = attlnk.getCoordinates();
						var total = {'left':fcoor['left'] + lcoor['left'], 'top':lcoor['bottom']};
						attlist.style.display = '';
						attlist.style.visibility = 'visible';
						attlist.setPosition({'x':total['left'], 'y':total['top']});
					}.bind(that);

					attlnk.onmouseover = function (e) { clearTimeout(this.attachmentsListTimeoutID); }.bind(that);
					attlnk.onmouseout = function (e) { this.blurAttachmentsMenu(attlist); }.bind(that);
					attlist.onmouseover = function (e) { clearTimeout(this.attachmentsListTimeoutID); }.bind(that);
					attlist.onmouseout = function (e) { this.blurAttachmentsMenu(attlist); }.bind(that);
				}

				actel = newEl({'type':'span', 'class':'eactions', 'text':'Reply'}, actbox);
				actel.onclick = function (e) { this.emailAction({'cmd':'reply'}); }.bind(that);

				actel = newEl({'type':'span', 'class':'eactions', 'text':'Reply All'}, actbox);
				actel.onclick = function (e) { this.emailAction({'cmd':'replyall'}); }.bind(that);

				actel = newEl({'type':'span', 'class':'eactions', 'text':'Forward'}, actbox);
				actel.onclick = function (e) { this.emailAction({'cmd':'forward'}); }.bind(that);

				actel = newEl({'type':'span', 'class':'eactions', 'text':'Send to Trash'}, actbox);
				actel.onclick = function (e) { this.emailAction({'cmd':'trash', 'showemail':true}); }.bind(that);

				actel = newEl({'type':'span', 'class':'eactions', 'text':'Mark as Spam'}, actbox);
				actel.onclick = function (e) { this.emailAction({'cmd':'spam', 'showemail':true}); }.bind(that);

				newEl({'type':'div', 'class':'headerspace', 'text':'\u00a0'}, eheadbox);

				// hide other boxes
				that.toggleRightColumn('email_viewer'); 
				that.setShortcuts('view');
				focuslink.focus();

				// some crappy emails hide the header
				eheadbox.style.display = '';
			}
		}}).send();  
	},

	/*
	 * Handles click to view all images
	 */
	viewImages: function (e, bdy) {
		var lnk = findTarget(e, 'div', 'parts');
		if (!lnk) { return false; }

		var msguid = lnk.getAttribute('msguid');
		var parts = JSON.decode(lnk.getAttribute('parts'));

		if (!bdy) { return false; }

		// hide the dropdown menu
		if (lnk.parentNode.className.indexOf('ddmenu') != -1) { lnk.parentNode.style.display = 'none'; }

		// create the loading images message
		var ld_msg = newEl({'type':'div', 'class':'images_loading_box', 'text':'Loading '+ parts.length +' Images...'}, bdy);

		// make the call to get image data
		var that = this;
		var postData = {'feat':'Emails', 'command':'getAttachedData', 'msguid':msguid, 'parts':parts};
		if (this.get_images_request && this.get_images_request.isRunning()) { this.get_images_request.cancel(); }
		this.get_images_request = new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) { 
			// handle response
			if (!r) { alert('An error occurred getting images of this email'); return false; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }  

			// remove the loading message
			bdy.removeChild(ld_msg);

			var ic = aimg = null;
			for (var i=0; i<resp['attachments'].length; i++) {
				ic = newEl({'type':'div', 'class':'imagecontainer'}, bdy);
				aimg = newEl({'type':'img', 'attributes':{'src':'data:image/png;base64,'+ resp['attachments'][i]['data']}}, ic);
				aimg.setAttribute('title', resp['attachments'][i]['filename']);
			}
		}}).send();  
	},

	/*
	 * Handles events to manage actions in email viewer
	 * @param array options {'cmd':'trash|spam|...', showemail:true}
	 */
	emailAction: function(opts) {
		if (!this.choosenEmail) { alert('No email selected'); return false; }

		var msguid = this.choosenEmail.getAttribute('msguid');
		var cmd = opts['cmd']

		switch (cmd) {
		case 'trash':
		case 'spam':
			var conf = (cmd == 'trash')?'Send to trash?':'Mark as spam?';
			if (!confirm(conf)) { return false; }
			var showemail = (opts['showemail'])?true:false; 
			this.updateEmails({'cmd':cmd, 'msguid':msguid, 'showemail':showemail});
			this.setShortcuts('list');
			break;

		case 'reply':
		case 'replyall':
		case 'forward':
			var viewFrame = findChild($('email_viewer'), 'iframe');
			if (!viewFrame) { alert('Error setting up reply form (1)'); return false; }
			var eheadbox = viewFrame.contentWindow.document.getElementById('email_header_box');
			if (!eheadbox) { alert('Error setting up reply form (2)'); return false; }

			this.composeEmail(eheadbox, cmd);
			break;

		default:
			alert('Invalid email action "'+ cmd +'"');
		}
	},

	/*
	 * Writes the HTML elements for email recepients
	 * @param HTML object (header container)
	 * @param string (reply|replyall|forward)
	 */
	composeEmail: function (eheadbox, type) {
		var headers = null;
		var isHTML = 0;
		var emailbody = '';
		var attachments = {};
		var viewFrame = false;
		var msguid = 0;

		if (eheadbox == null && type == 'new') {
			headers = {};
			eheadbox = $('email_viewer');
			eheadbox.style.backgroundColor = '#eee';
			this.toggleRightColumn('email_compose');
		} else {
			msguid = this.choosenEmail.getAttribute('msguid');
			viewFrame = findChild($('email_viewer'), 'iframe');
			attachments = JSON.decode(eheadbox.getAttribute('attachments'));
			headers = JSON.decode(eheadbox.getAttribute('headers'));
			isHTML = eheadbox.getAttribute('ishtml').toInt();
			if (isHTML == '0') {
				emailbody = eheadbox.getAttribute('emailtext');
				if (eheadbox.nextSibling) { eheadbox.parentNode.removeChild(eheadbox.nextSibling); }
			}
			this.toggleRightColumn('email_respond');
		}

		// clear out the box for new stuff
		eheadbox.innerHTML = '';

		// create the form
		var composeform = newEl({'type':'form', 'attributes':{'method':'post', 'action':this.options.fullurl +'/ajax.php', 'enctype':'multipart/form-data'}}, eheadbox);
		if (type == 'new') { composeform.setAttribute('target', 'hidframe'); }

		// submit destination and callback
		newEl({'type':'input', 'attributes':{'type':'hidden', 'name':'feat', 'value':'Emails'}}, composeform);
		newEl({'type':'input', 'attributes':{'type':'hidden', 'name':'command', 'value':'sendEmail'}}, composeform);
		newEl({'type':'input', 'attributes':{'type':'hidden', 'name':'callback', 'value':'window.parent.sentEmailHandler'}}, composeform);

		// autosuggest hidden fields
		newEl({'type':'input', 'attributes':{'type':'hidden', 'name':'compose[to]', 'value':''}}, composeform);
		newEl({'type':'input', 'attributes':{'type':'hidden', 'name':'compose[cc]', 'value':''}}, composeform);
		newEl({'type':'input', 'attributes':{'type':'hidden', 'name':'compose[bcc]', 'value':''}}, composeform);
 
		// write all compose backend stuff
		newEl({'type':'input', 'attributes':{'type':'hidden', 'name':'compose[msguid]', 'value':msguid}}, composeform);
		newEl({'type':'input', 'attributes':{'type':'hidden', 'name':'compose[ishtml]', 'value':isHTML.toString()}}, composeform);
		if (headers['Message-Id'] && headers['Message-Id'].length > 1) { newEl({'type':'input', 'attributes':{'type':'hidden', 'name':'compose[in-reply-to]', 'value':headers['Message-Id']}}, composeform); }
		// Outlook sends it as Message-id rather than Message-Id
		else if (headers['Message-id'] && headers['Message-id'].length > 1) { newEl({'type':'input', 'attributes':{'type':'hidden', 'name':'compose[in-reply-to]', 'value':headers['Message-id']}}, composeform); }
		var refvalue = '';
		if (headers['References'] && headers['References'].length > 1) { refvalue += headers['References']; }
		if (headers['In-Reply-To'] && headers['In-Reply-To'].length > 1) {
			if (refvalue.length > 2) { refvalue += ', '; }
			refvalue += headers['In-Reply-To'];
		}
		if (refvalue.length > 2) {
			var refinput = newEl({'type':'input', 'attributes':{'type':'hidden', 'name':'compose[references]', 'value':refvalue}}, composeform);
		}
 
		// create a box for all header stuff to go into (to, cc, bcc, subject, actions)
		headersbox = newEl({'type':'div', 'class':'erespheader'}, composeform);

		// get subject, from, additional text
		var refwreg = null;
		var subject_text = '';
		var to_emails = '';
		var cc_emails = '';
		var add_text = '';

		// handle cases where subject is not specified
		if (!headers['Subject']) { headers['Subject'] = ''; }

		if (type == 'forward') {
			// subject
			refwreg = /^\s*FWD?:.*/i;
			if (refwreg.test(headers['Subject'])) { subject_text = headers['Subject']; }
			else { subject_text = 'Fwd: ' +headers['Subject']; }

			// additional text
			add_text = 'Begin forwarded message ';
			add_text += (headers['From'] && headers['From'].length > 1)?headers['From'].replace(/["']/g, '') +' wrote:':''; 
		} else if (type == 'reply' || type == 'replyall') {
			// subject
			refwreg = /^\s*RE:.*/i;
			if (refwreg.test(headers['Subject'])) { subject_text = headers['Subject']; }
			else { subject_text = 'Re: ' +headers['Subject']; }

			if (headers['Reply-To'] && headers['Reply-To'].length > 1) { to_emails = headers['Reply-To'].replace(/["']/g, ''); }
			else if (headers['From'] && headers['From'].length > 1) { to_emails = headers['From'].replace(/["']/g, ''); }
			else if (headers['Return-Path'] && headers['Return-Path'].length > 1) { to_emails = headers['Return-Path'].replace(/["']/g, ''); }

			// to and cc
			if (type == 'replyall') {
				to_emails += ', '+ headers['To'];

				if (headers['Cc']) {
					cc_emails = (headers['Cc'] && headers['Cc'].length > 1)?headers['Cc']:'';
				}
			}

			this.sentToEmail = null;
			to_emails = this.emailsToBits(to_emails, true);
			cc_emails = this.emailsToBits(cc_emails, true);

			// unless we replyall, the from email does not get picked up
			// use this to pick it up so that we can select it in the dropdown
			if (!this.sentToEmail) {
				var tmptxt = headers['To'] || '';
				if (headers['X-MS-Exchange-Inbox-Rules-Loop']) { tmptxt += ', '+ headers['X-MS-Exchange-Inbox-Rules-Loop']; }
				this.emailsToBits(tmptxt, true);
			}

			// additional text
			if (headers['From']) { add_text = headers['From'].replace(/["']/g, '') + ' wrote:';  }
		} 

		// create the fields for recipients
		newEl({'type':'div', 'class':'eheaderkey', 'text':'From:'}, headersbox);
		var contentbox = newEl({'type':'div', 'class':'eheadervalue'}, headersbox);
		var fromfield = newEl({'type':'select', 'class':'fromemails', 'attributes':{'name':'compose[fromemail]'}}, contentbox);
		newEl({'type':'div', 'class':'headerspace', 'text':'\u00a0'}, headersbox);
		for (var email in this.options.from_addresses) {
			// hide this option if needed
			if (this.options.from_addresses[email]['hidden'] == 1 && this.sentToEmail != email) { continue; }

			fromfield[fromfield.options.length] = new Option(this.options.from_addresses[email]['name'] +' ('+ email +')', email);

			// pick the email from the from dropdown
			if (this.sentToEmail && email.indexOf(this.sentToEmail) != -1) { fromfield[fromfield.options.length -1].selected = true; }
			else if (this.sentToEmail == null && this.options.from_addresses[email]['isdefault'] == 1) { fromfield[fromfield.options.length -1].selected = true; }
		}

		var asopts = {'selectFirstSuggestion':true, 'newBitMessage':'Press "Enter" to finish adding this email address'};

		newEl({'type':'div', 'class':'eheaderkey', 'text':'To:'}, headersbox);
		contentbox = newEl({'type':'div', 'class':'eheadervalue autosuggest_box'}, headersbox);
		asopts['mainContainer'] = contentbox;
		this.to_suggest = new emailSuggest(asopts);
		if (to_emails.length) { this.to_suggest.addBits(to_emails); }
		newEl({'type':'div', 'class':'headerspace', 'text':'\u00a0'}, headersbox);

		newEl({'type':'div', 'class':'eheaderkey', 'text':'CC:', 'style':{'display':'none'}}, headersbox);
		contentbox = newEl({'type':'div', 'class':'eheadervalue autosuggest_box', 'style':{'display':'none'}}, headersbox);
		asopts['mainContainer'] = contentbox;
		this.cc_suggest = new emailSuggest(asopts);
		if (cc_emails.length) { this.cc_suggest.addBits(cc_emails); }
		newEl({'type':'div', 'class':'headerspace', 'text':'\u00a0', 'style':{'display':'none'}}, headersbox);

		newEl({'type':'div', 'class':'eheaderkey', 'text':'BCC:', 'style':{'display':'none'}}, headersbox);
		contentbox = newEl({'type':'div', 'class':'eheadervalue autosuggest_box', 'style':{'display':'none'}}, headersbox);
		asopts['mainContainer'] = contentbox;
		this.bcc_suggest = new emailSuggest(asopts);
		newEl({'type':'div', 'class':'headerspace', 'text':'\u00a0', 'style':{'display':'none'}}, headersbox);

		// create the subject
		newEl({'type':'div', 'class':'eheaderkey', 'text':'Subject:'}, headersbox);
		contentbox = newEl({'type':'div', 'class':'eheadervalue'}, headersbox);
		newEl({'type':'input', 'class':'emailsubject', 'attributes':{'type':'text', 'name':'compose[subject]', 'value':subject_text}}, contentbox);
		newEl({'type':'div', 'class':'headerspace', 'text':'\u00a0'}, headersbox);

		// action elements
		newEl({'type':'div', 'class':'eheaderkey', 'text':'Actions:'}, headersbox);
		contentbox = newEl({'type':'div', 'class':'eheadervalue'}, headersbox);
		var send = newEl({'type':'span', 'class':'eactions sendemail', 'text':'Send'}, contentbox);
		send.onclick = function (e) { this.sendEmail(composeform, add_text); }.bind(this);
		newEl({'type':'span', 'class':'eactions cancelemail', 'text':'Cancel'}, contentbox).onclick = function (e) { this.cancelEmailCompose(); }.bind(this);

		// make the ddmenu for attachments
		var num_attached = 0;
		var attlist = newEl({'type':'div', 'class':'ddmenu', 'style':{'display':'none'}, 'attributes':{'ddmenu':1}}, composeform);
		for (var attachment in attachments) {
			filelnk = newEl({'type':'div', 'class':'ddlink', 'attributes':{'filename':attachment, 'part':attachments[attachment]}}, attlist);
			chkbx = newEl({'type':'input', 'attributes':{'type':'checkbox', 'name':'compose[parts]['+ attachments[attachment] +']'}}, filelnk);
			if (type == 'forward') { chkbx.checked = true; num_attached++; }
			chkbx.onclick = function (e) { this.attachmentsUpdated(e); }.bind(this);
			newEl({'type':'span', 'text':attachment}, filelnk);
		}
		var attachbox = newEl({'type':'div', 'class':'ddlink'}, attlist);
		var attachinput = newEl({'type':'input', 'attributes':{'type':'file', 'name':'userfile[]', 'multiple':'multiple', 'size':25}}, attachbox);
		attachinput.onchange = function (e) { this.attachmentsUpdated(e); }.bind(this);

		var attlnk = newEl({'type':'span', 'class':'eactions attachments', 'text':'Attachments ('+ num_attached +')'}, contentbox);
		new SEMenu({'menu_body':attlist, 'menu_link':attlnk, 'event_type':'leftclick'});

		if (cc_emails.length == 0) {
			newEl({'type':'span', 'class':'eactions', 'text':'Show Cc'}, contentbox).onclick = function (e) {
				headersbox.childNodes[7].style.display = '';
				headersbox.childNodes[8].style.display = '';
				headersbox.childNodes[10].style.display = '';

				var lnk = findTarget(e, 'span');
				if (lnk) { lnk.style.display = 'none'; }

				headersbox.childNodes[8].firstChild.focus();
			};
		} else {
			headersbox.childNodes[7].style.display = '';
			headersbox.childNodes[8].style.display = '';
			headersbox.childNodes[10].style.display = '';
		}
		newEl({'type':'span', 'class':'eactions', 'text':'Show Bcc'}, contentbox).onclick = function (e) {
			headersbox.childNodes[11].style.display = '';
			headersbox.childNodes[12].style.display = '';
			headersbox.childNodes[14].style.display = '';

			var lnk = findTarget(e, 'span');
			if (lnk) { lnk.style.display = 'none'; }

			headersbox.childNodes[12].firstChild.focus();
		};
		newEl({'type':'div', 'class':'headerspace', 'text':'\u00a0'}, headersbox);

		var txtarea = null;
		if (isHTML) {
			// is an HTML email
			txtarea = newEl({'type':'textarea', 'class':'email_body', 'attributes':{'rows':4, 'cols':100, 'name':'compose[body]', 'minrows':4}}, composeform);
			txtarea.onkeyup = function (e) { resizeTextarea(e); };
			txtarea.value = '';
			txtarea.focus();
			newEl({'type':'br'}, composeform);
		} else {
			txtarea = newEl({'type':'textarea', 'class':'text_email_body', 'attributes':{'rows':20, 'cols':100, 'name':'compose[body]', 'minrows':20}}, composeform);
			txtarea.onkeyup = function (e) { resizeTextarea(e); };
			if (add_text.length > 0 || emailbody.length > 0) {
				txtarea.value = '\r\n\r\n\r\n'+ add_text +'\r\n\r\n'+ emailbody;
			}
			txtarea.focus();
		} 

		resizeTextarea(txtarea);

		// set the focus on the correct field
		if (type == 'forward' || type == 'new') {
			this.to_suggest.lastInput.focus();
		} else {
			txtarea.focus();
		}
	},

	/*
	 * Called when attachments change (displays total attached number)
	 * @param event (change on checkbox or file input)
	 */
	attachmentsUpdated: function (e) {
		//
		// find the menu and link
		//
		var ddmenu = findTarget(e, 'div', 'ddmenu');
		if (!ddmenu || !ddmenu.menu_link) { return false; }
		var lnk = ddmenu.menu_link;

		// go through and count up the attachments
		var mitem = null;
		var num_attached = 0;
		var has_blank = false;
		for (var i=0; i<ddmenu.childNodes.length; i++) {
			mitem = ddmenu.childNodes[i];
			if (mitem.childNodes.length == 0 || mitem.firstChild.nodeName.toLowerCase() != 'input') { continue; } 

			if (mitem.firstChild.getAttribute('type') == 'checkbox') {
				if (mitem.firstChild.checked) { num_attached++; }
			} else {
				// go through all files in the file input
				if (mitem.firstChild.files) {
					if (mitem.firstChild.files.length > 0) {
						num_attached = num_attached + mitem.firstChild.files.length;
					} else {
						has_blank = true;
					}
				} else {
					if (trim(mitem.firstChild.value).length > 0) {
						num_attached++;
					} else {
						has_blank = true;
					}
				}
			}

		}

		// update the link
		setText(lnk, 'Attachments ('+ num_attached +')');

		// add another file input if needed
		if (!has_blank) {
			var attachbox = newEl({'type':'div', 'class':'ddlink'}, ddmenu);
			var inp = newEl({'type':'input', 'attributes':{'type':'file', 'name':'userfile[]', 'multiple':'multiple', 'size':25}}, attachbox);
			inp.onchange = function (e) { this.attachmentsUpdated(e); }.bind(this);
		}
	},

	/*
	 * Removes the user's email from the list
	 * @param string list (to/cc from email header)
	 * @param bool (strip user's email if true)
	 * @return string list (with this user's email removed)
	 */
	emailsToBits: function (list, strip) {
		// handle empty strings
		if (list && trim(list).length == 0) { return list; }

		// split all emails
		var emails = list.split(/[,;]+/);
		var matches = false;
		var emails_list = [];
		var leftover = '';

		// if we only have 1 email, just use it
		if (emails.length > 0) {
			// go through all emails in the to field
			for (var i=0; i<emails.length; i++) {
				matches = false;

				// skip blank items
				if (trim(emails[i]).length == 0) { continue; }

				if (emails[i].indexOf('@') == -1) {
					leftover = emails[i];
					continue;
				} else {
					emails[i] = trim(leftover) +' '+ trim(emails[i]);
					leftover = '';
				}

				if (strip) {
					// check against all the from addresses for this user
					for (var email in this.options.from_addresses) {
						if (emails[i].indexOf(email) != -1) {
							matches = true;
							this.sentToEmail = email;
						}
					}

					// if it does not match then it's not the user's email so add it to to_emails
					if (matches) { continue; }
				}

				emails_list.push({'key':0, 'value':emails[i].replace(/"/g, '').replace(/'/g, '')});
			}				
		} 

		return emails_list;
	},

	/*
	 * Cancel compose/reply/forward email
	 */
	cancelEmailCompose: function () {
		if (!confirm('Discard email?')) { return false; }

		// unselect this email
		if (this.choosenEmail) {
			this.viewEmail(this.choosenEmail);
		} else {
			$('email_viewer').innerHTML = '';
			this.toggleRightColumn('smart');
		}

		return;
	},
 
	/*
	 * Handles click on the checkbox
	 */
	selectEmail: function (e) {
		if (!e) { e = window.event; }

		try {
		if (Browser.ie) {
			// BROKEN IE
			e.cancelBubble = true;
			e.returnValue = false;
		} else {
			e.stopPropagation();
		} 
		} catch (err) { }

		// find input
		var inp = findTarget(e, 'input');

		// check if input was sent in as a parameter
		if (!inp && checkAttr(e, 'type')) { inp = e; }

		// we need the input
		if (!inp) { return false; }

		// get message
		var mbox = findParent(inp, 'div', 'msguid');
		if (!mbox) { return false; }

		var ebox = mbox.parentNode;
 
		// find out if the shift key was pressed
		if (inp.checked && e.shiftKey) {
			var found = false;
			var ombox = mbox;
			
			// search going up
			while (ombox.previousSibling && !found) {
				// look at the previous message
				ombox = ombox.previousSibling;

				// make sure its a message
				if (!checkAttr(ombox, 'msguid')) { continue; }

				// check the input box
				if (ombox.childNodes[1].firstChild.checked) { found = ombox; }
			}

			if (found) {
				while (ombox.nextSibling != mbox) {
					// check off the next sibling
					ombox = ombox.nextSibling;

					// make sure its a message
					if (!checkAttr(ombox, 'msguid')) { continue; }

					// check the input box
					ombox.childNodes[1].firstChild.checked = true;
				}
			} else {
				ombox = mbox;
				// search going down
				while (ombox.nextSibling && !found) {
					// look at the previous message
					ombox = ombox.nextSibling;

					// make sure its a message
					if (!checkAttr(ombox, 'msguid')) { continue; }

					// check the input box
					if (ombox.childNodes[1].firstChild.checked) { found = ombox; } 
				}

				if (found) {
					while (ombox.previousSibling != mbox) {
						// check off the next sibling
						ombox = ombox.previousSibling;

						// make sure its a message
						if (!checkAttr(ombox, 'msguid')) { continue; }

						// check the input box
						ombox.childNodes[1].firstChild.checked = true;
					} 
				}
			}
		} // end if checked and shiftKey

		this.refreshSelectedActions('check');
	},

	/*
	 * Handle click to download attachment
	 */
	downloadAttachment: function (e) {
		var lnk = findTarget(e, 'div', 'filename');
		if (!lnk) { return false; }

		var msguid = lnk.getAttribute('msguid')
		var part = lnk.getAttribute('part');
		var frm = null;

		// hide the dropdown menu
		if (lnk.parentNode.className.indexOf('ddmenu') != -1) { lnk.parentNode.style.display = 'none'; }

		// create a form that can download a file through the hidframe
		if ($('download_attachments_form')) { 
			frm = $('download_attachments_form');
			frm.parentNode.removeChild(frm);
		}

		frm = newEl({'type':'form', 'id':'download_attachments_form', 'attributes':{'method':'post', 'action':'ajax.php', 'target':'hidframe'}}, document.body);
		newEl({'type':'input', 'attributes':{'type':'hidden', 'name':'feat', 'value':'Emails'}}, frm);
		newEl({'type':'input', 'attributes':{'type':'hidden', 'name':'command', 'value':'downloadAttachments'}}, frm);
		newEl({'type':'input', 'attributes':{'type':'hidden', 'name':'info', 'value':JSON.encode({'msguid':msguid, 'parts':[part]})}}, frm);
		frm.submit();
	},

	/*
	 * Refreshes the select actions texts
	 * @param string ['all', 'none', 'check']
	 */
	refreshSelectedActions: function (cmd) {
		// find how many items are selected
		var ebox = $('email_list');
		var msgselected = 0;
		var mbox = null;
		for (var i=0; i<ebox.childNodes.length; i++) {
			mbox = ebox.childNodes[i];
			if (!checkAttr(mbox, 'msguid')) { continue; }
			if (cmd == 'check' && mbox.childNodes[1].firstChild.checked) { msgselected++; }
			else if (cmd == 'all') { mbox.childNodes[1].firstChild.checked = true; msgselected++; }
			else if (cmd == 'none') { mbox.childNodes[1].firstChild.checked = false; msgselected = 0; }
		}

		this.selectedMessagesNum = msgselected;

		// if we have none selected, show default actions
		if (msgselected == 0) {
			if (this.choosenEmail) {
				// if an email was selected, show it again
				this.toggleRightColumn('email_viewer');
			} else {
				// if nothing was selected before show the default actions
				this.toggleRightColumn('default_actions');
			}
		} else {
			var txt = '('+ msgselected.toString() +')\u00a0\u00a0';
			txt += (msgselected > 1)?'Emails Selected':'Email Selected';
			setText($('num_emails_selected'), txt);

			// display the actions page
			this.toggleRightColumn('selected_actions');
		}
	},

	/*
	 * Sends an email
	 */
	sendEmail: function (frm, addtxt) {
		// set to cc and bcc
		frm['compose[to]'].value = this.to_suggest.getValues();
		frm['compose[cc]'].value = this.cc_suggest.getValues();
		frm['compose[bcc]'].value = this.bcc_suggest.getValues();

		// warn if there is nothing in To
		if (frm['compose[to]'].value.length == 0) {
			alert('Please select an email in the To field');
			return false;
		}

		//
		// warn the user if needed
		//
		var subject = trim(frm['compose[subject]'].value);
		if (subject.length == 0) {
			if (!confirm('Send email without subject?')) { return false; }
		}

		if (addtxt.length > 0) { addtxt = '<div>'+ addtxt +'</div><br/>'; }

		//
		// get proper HTML if needed
		if (frm['compose[ishtml]'].value == '1') {
			var origHTML = frm.parentNode.getAttribute('emailhtml');
			var bdy = trim(frm['compose[body]'].value)
 				bdy = bdy.replace(/&(?!amp;)/gi, "&amp;");
				bdy = bdy.replace(/</gi, "&lt;");
				bdy = bdy.replace(/>/gi, "&gt;");
				bdy = bdy.replace(/"/gi, "&quot;");
				bdy = bdy.replace(/'/gi, "&#039;");  
				bdy = bdy.replace(/\r\n/gim, '<br>')
				bdy = bdy.replace(/\n/gim, '<br>');
			var finalhtml = '';

			// handle different HTML cases
			if (origHTML.match(/\<body.*\>/i)) {
				if (bdy.length == 0) {
					// if there is no additional content
					finalhtml = origHTML;
				} else {
					// if we have a body tag, put the content inside
					var tagstart = origHTML.toLowerCase().indexOf('<body');
					var tagend = origHTML.indexOf('>', tagstart);

					var firstpart = origHTML.substr(0, tagend+1);
					var secondpart = origHTML.substr(tagend+1);
					finalhtml = firstpart +'<div>'+ bdy +'</div><br/><br/>'+ addtxt + secondpart;
				}
			} else {
				if (bdy.length == 0) {
					finalhtml = origHTML;
				} else {
					finalhtml = '<div>'+ bdy +'</div><br/><br/>'+ addtxt + origHTML;
				}
			}

			frm['compose[body]'].style.visibility = 'hidden';
			frm['compose[body]'].value = trim(finalhtml);
		}

		// unselect the choosen email
		if (this.choosenEmail) {
			this.choosenEmail.removeClass('choosen');
			this.choosenEmail = null;
		}

		//
		// submit the form
		//
		frm.submit();
	},

	/*
	 * Copies emails to another folder (Wrapper for updateEmails)
	 * @param event (JS event on a div with folder info)
	 */
	copyEmailTo: function (e) {
		var that = this;
		if (!this.folderTotalEmails && arguments.length > 1) { var that = arguments[1]; }
 
		var fbox = findTarget(e, 'div', 'fullpath');
		if (!fbox) {
			if (checkAttr(e, 'fullpath')) { fbox = e; }
			return;
		}

		// get the folder
		var fullpath = fbox.getAttribute('fullpath');
 
		that.updateEmails({'cmd':'copy', 'folder':fullpath});
	},

	/*
	 * Moves emails to another folder (Wrapper for updateEmails)
	 * @param event (JS event on a div with folder info)
	 */
	moveEmailTo: function (e) {
		var that = this;
		if (!this.folderTotalEmails && arguments.length > 1) { var that = arguments[1]; }
 
		var fbox = findTarget(e, 'div', 'fullpath');
		if (!fbox) {
			if (checkAttr(e, 'fullpath')) { fbox = e; }
			return;
		}

		// get the folder
		var fullpath = fbox.getAttribute('fullpath');
 
		that.updateEmails({'cmd':'move', 'folder':fullpath}); 
	},

	/*
	 * Perform action on selected emails
	 * @param string {cmd:'trash|spam|flag|unflag|delete|read|unread', msguid, folder, showemail}
	 */
	updateEmails: function (opts) {
		// get selected msguids
		var ebox = $('email_list');
		var mbox = null;
		var mboxes = []
		var msguids = [];
		var cmd = opts['cmd'];
		if (opts['msguid'] == undefined) {
			for (var i=0; i<ebox.childNodes.length; i++) {
				mbox = ebox.childNodes[i];
				if (!checkAttr(mbox, 'msguid')) { continue; }
				if (mbox.childNodes[1].firstChild.checked) {
					msguids.push(mbox.getAttribute('msguid'));
					mboxes.push(mbox);
				}
			}
		} else {
			if (!this.choosenEmail) { return false; }

			var curr_msguid = this.choosenEmail.getAttribute('msguid');
			var msguid = trim(opts['msguid']);

			// this should be the currently selected message
			if (msguid != curr_msguid) { alert('Error finding the right message'); return false; }

			mboxes.push(this.choosenEmail);
			msguids.push(msguid);
		}

		// make sure we have some messages
		if (msguids.length == 0) { alert('No messages selected'); return false; }
 
		var postData = {'feat':'Emails', 'command':'updateEmails', 'info':{}};

		switch (cmd) {
		case 'trash':
			postData['info']['action'] = 'trash';
			break;

		case 'spam':
			postData['info']['action'] = 'spam';
			break;

		case 'delete':
			postData['info']['action'] = 'delete';
			break;

		case 'flag':
			postData['info']['action'] = 'set';
			postData['info']['flag'] = 'Flagged';
			break;

		case 'unflag':
			postData['info']['action'] = 'unset';
			postData['info']['flag'] = 'Flagged';
			break;

		case 'read':
			postData['info']['action'] = 'set';
			postData['info']['flag'] = 'Seen';
			break;

		case 'unread':
			postData['info']['action'] = 'unset';
			postData['info']['flag'] = 'Seen';
			break;

		case 'copy':
			postData['command'] = 'copyEmails';
			postData['info']['destFolder'] = opts['folder'];
			break;

		case 'move':
			postData['command'] = 'moveEmails';
			postData['info']['destFolder'] = opts['folder'];
			break;
 
		default:
			alert('Invalid action "'+ cmd +'"');
			return false;
		}

		// set the message ids after the action in case we have a large number of messages
		postData['info']['msguids'] = msguids;

		// unchoose the email if it is selected and we are about to perform an action on it
		if (this.choosenEmail && inArray(this.choosenEmail.getAttribute('msguid'), msguids)) { this.viewEmail(this.choosenEmail); }

		if (this.update_email_request && this.update_email_request.isRunning()) { alert('Easy there, I already sent the request once'); return false; }
		var that = this;
		this.update_email_request = new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			// handle response
			if (!r) { alert('An error occurred getting the list of emails after update "'+ r +'"'); return false; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }
			
			// update total emails for this folder
			if (resp['totalEmails']) {
				that.folderTotalEmails = resp['totalEmails'];
				var txt = '('+ addCommas(that.folderTotalEmails) +')  Emails in this folder.';
				setText($('folder_details'), txt);
			}
 
			// we want to just remove the few messages that need to be moved
			// but we should just get the new list if the remaining list will be small
			if (inArray(cmd, ['trash', 'spam', 'delete', 'move'])) {
				// find the next email to display if we need to display it
				if (opts['showemail']) { 
					var nextemail = null;
					// only show the next/prev email if it is unread
					if (mboxes[0].nextSibling && mboxes[0].nextSibling.className.indexOf('unread') != -1) { nextemail = mboxes[0].nextSibling; }
					else if (mboxes[0].previousSibling && mboxes[0].previousSibling.className.indexOf('unread') != -1) { nextemail = mboxes[0].previousSibling; }
				}

				for (var i=0; i<mboxes.length; i++) { ebox.removeChild(mboxes[i]); }

				// select the next email
				if (opts['showemail'] && nextemail) { that.viewEmail(nextemail); }
			} else if (cmd == 'flag') {
				for (var i=0; i<mboxes.length; i++) { mboxes[i].className = mboxes[i].className.replace('unflagged', 'flagged'); }
			} else if (cmd == 'unflag') {
				for (var i=0; i<mboxes.length; i++) { mboxes[i].className = mboxes[i].className.replace('flagged', 'unflagged'); }
			} else if (cmd == 'read') {
				for (var i=0; i<mboxes.length; i++) { mboxes[i].className = mboxes[i].className.replace('unread', 'read'); }
			} else if (cmd == 'unread') {
				for (var i=0; i<mboxes.length; i++) { mboxes[i].className = mboxes[i].className.replace('read', 'unread'); }
			}

			// hide the copy and move to folders
			$('copyto_folder').style.display = 'none';
			$('moveto_folder').style.display = 'none';

			that.refreshSelectedActions('none');

			// if there are only a few emails to display (get more)
			if (ebox.childNodes.length - mboxes.length < 20) {
				if (JSON.encode(that.getSearchCriteria()) == '{}') {
					that.getMoreEmails('force');
				} else {
					that.searchEmails();
				} 
			}
		}}).send();  
	},

	/*
	 * Set email shortcuts for a particular section
	 */
	setShortcuts: function (section) {
		shortcut.remove('A');
		shortcut.remove('C');
		shortcut.remove('F');
		shortcut.remove('J');
		shortcut.remove('K');
		shortcut.remove('N');
		shortcut.remove('R');
		shortcut.remove('S');
		shortcut.remove('T');
		shortcut.remove('W');
		shortcut.remove('Esc');
		shortcut.remove('Enter');
		shortcut.remove('1');
   
		switch (section) {
		case 'list':
			shortcut.add('C', function (e) {this.composeEmail(null, 'new');}.bind(this));
			shortcut.add('F', function (e) {this.gotoFolder();}.bind(this));
			shortcut.add('K', function (e) {this.showContacts();}.bind(this));
			shortcut.add('N', function (e) {this.showNotes();}.bind(this));
			shortcut.add('S', function (e) {this.showEmailSearch();}.bind(this));
			shortcut.add('T', function (e) {this.focusTasks(true);}.bind(this));
			shortcut.add('W', function (e) {this.showWeather();}.bind(this));
			shortcut.add('1', function (e) {this.viewFirstEmail();}.bind(this));

			// if the search is visible, have Esc hide it
			if ($('search_emails_box').style.display != 'none') {
				shortcut.add('Esc', function (e) {this.clearEmailSearch();}.bind(this));
			}
			break;

		case 'compose':
			shortcut.add('Esc', function (e) {this.cancelEmailCompose();}.bind(this));
			break;

		case 'respond':
			var viewFrame = findChild($('email_viewer'), 'iframe');
			var bdy = viewFrame.contentWindow.document.body;
			shortcut.add('Esc', function (e) {var t=myTWIG; t.cancelEmailCompose();}, {'target':bdy}); 
			break;

		case 'view':
			var viewFrame = findChild($('email_viewer'), 'iframe');
			var bdy = viewFrame.contentWindow.document.body;
			var opts = {'target':bdy};

			shortcut.add('J', function (e) {this.prevNextEmail('prev');}.bind(this), opts);
			shortcut.add('K', function (e) {this.prevNextEmail('next');}.bind(this), opts);
			shortcut.add('R', function (e) {this.emailAction({'cmd':'reply'});}.bind(this), opts);
			shortcut.add('A', function (e) {this.emailAction({'cmd':'replyall'});}.bind(this), opts);
			shortcut.add('F', function (e) {this.emailAction({'cmd':'forward'});}.bind(this), opts);
			shortcut.add('T', function (e) {this.emailAction({'cmd':'trash', 'showemail':true});}.bind(this), opts);
			shortcut.add('S', function (e) {this.emailAction({'cmd':'spam', 'showemail':true});}.bind(this), opts);
			shortcut.add('Esc', function (e) {if (this.choosenEmail){this.viewEmail(this.choosenEmail);}}.bind(this), {'target':bdy, 'target2':document.body}); 
			break;

		case 'search':
			shortcut.add('Esc', function (e) {this.clearEmailSearch();}.bind(this));
			shortcut.add('Enter', function (e) {this.searchEmails();}.bind(this));
			break;

		case 'changefolder':
			shortcut.add('Esc', function (e) {hideCover($('change_folder_box')); this.setShortcuts('list');}.bind(this));
			break;

		case 'contacts':
			shortcut.add('Esc', function (e) {this.hideContacts();}.bind(this));
			break;

		case 'contact':
			shortcut.add('Esc', function (e) {this.hideContacts();}.bind(this));
			break;

		case 'notes':
			// handle Esc with focus on search rather than globally
			//shortcut.add('Esc', function (e) {this.hideNotes();}.bind(this));
			break;

		case 'note':
			break;

		case 'settings':
			shortcut.add('Esc', function (e) {this.hideSettings();}.bind(this));
			break;

		case 'help':
			shortcut.add('Esc', function (e) {this.hideHelp();}.bind(this));
			break;

		case 'tasks':
			shortcut.add('Esc', function (e) {this.focusTasks(false);}.bind(this));
			break;

		case 'weather':
			shortcut.add('Esc', function (e) {this.hideWeather();}.bind(this));
			shortcut.add('K', function (e) {this.prevNextEmail('next');}.bind(this), opts);
			break;

		case 'folders':
			shortcut.add('Esc', function (e) {this.hideManageFolders();}.bind(this));
			break;

		default:
			break;
		}
	},

	/*
	 * Populates Manage Folders box
	 */
	initManageFolders: function (e) {
 		var fbox = $('folders_box');
		fbox.innerHTML = '';
		// close folders link
		var tmp = newEl({'type':'span', 'class':'xlink', 'text':'\u00D7', 'attributes':{'title':'Esc to close'}}, fbox);
		tmp.onclick = function (e) { this.hideManageFolders(); }.bind(this);
 
		var scrolldiv = newEl({'type':'div', 'class':'scroller'}, fbox);
		newEl({'type':'div', 'class':'section_title first', 'text':'Manage Folders'}, scrolldiv);
	},
   
	/*
	 * Dislays the manage folders box
	 */
	showManageFolders: function (e) {
		var box = $('folders_box');
		if (box.childNodes.length == 0) { this.initManageFolders(); }
		
		showCover(box);
		this.setShortcuts('folders');
	},

	/*
	 * Hide Manage Folders box
	 */
	hideManageFolders: function (e) {
   		hideCover($('folders_box'));

		this.toggleRightColumn('smart');    
	},
 
	/*
	 * Display Contacts list
	 * @param object (default values set in search)
	 */
	showContacts: function (defvalues) {
		var box = $('contacts_box');
		if (box.childNodes.length == 0) { this.initContacts(); }

		showCover(box);

		this.setShortcuts('contacts');

		if (defvalues) {
			// set default values
    		var fields = ['firstname', 'lastname', 'email', 'number', 'im', 'address'];
			for (var i=0; i<fields.length; i++) {
				$('contacts_search_'+ fields[i]).value = (defvalues[fields[i]])?defvalues[fields[i]]:'';
			}
			
			this.searchContacts(true, true);
		} else if ($('contacts_list').childNodes.length == 0) {
			this.searchContacts();
		}

		$('contacts_search_firstname').focus();

		return;
	},

	/*
	 * Hide Contacts list
	 */
	hideContacts: function () {
		hideCover($('contacts_box'));

		this.toggleRightColumn('smart');
	},

	/*
	 * Handles event to create a new contact
	 */
	newContact: function () {
		var clistbox = $('contacts_list');

		// create the new contact box
		var cbox = newEl({'type':'div', 'class':'contact_open', 'attributes':{'contactid':0, 'firstname':'', 'lastname':'', 'nickname':'', 'company':''}});

		// put it at the top
		if (clistbox.childNodes.length > 0) {
			clistbox.insertBefore(cbox, clistbox.firstChild);
		} else {
			clistbox.appendChild(cbox);
		}
		
		// scroll to the top
		clistbox.scrollTop = 0;
 
		// if search fields are filled out, use them as default
		var defaults = {};
		defaults['firstname'] = trim($('contacts_search_firstname').value);
		defaults['lastname'] = trim($('contacts_search_lastname').value);
		defaults['emails'] = [trim($('contacts_search_email').value)];
 
		var inp = this.writeContactForm(cbox, defaults);
		inp.focus();

		this.setShortcuts('contact');
	},

	/*
	 * Manage contact that is clicked on when viewing email
	 * @param event (JS event on contact element)
	 */
	manageContact: function (e) {
		var ctxt = findTarget(e, 'span');
		if (!ctxt) { return false; }

		// get contact text
		var txt = trim(getText(ctxt));

		// get email address
		var eregex = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4})\b/i;
		if (!eregex.test(txt)) { alert('Valid email not found in "'+ txt +'"'); return false; }
		var tmp = eregex.exec(txt);
		var email = tmp[0];

		// get first and last name
		var fullname = txt.replace(email, '').replace('<', '').replace('>', '').replace(',', '');
		var names = fullname.split(/\s/);

		var firstname = lastname = '';
		try {
			if (names.length > 0) { firstname = names[0]; }
			if (names.length > 1) { lastname = names[1]; }
			console.log(txt.indexOf(','));
			if (txt.indexOf(',') != -1) {
		   		firstname = names[1]; 
				lastname = names[0];
			}
		} catch (err) {}

		this.showContacts({'firstname':firstname, 'lastname':lastname, 'email':email});
	},

	/*
	 * Clears the contacts filter
	 */
	clearContactsSearch: function (e) {
		var fields = ['firstname', 'lastname', 'email', 'number', 'im', 'address'];
		var tmp = '';

		for (var i=0; i<fields.length; i++) {
			$('contacts_search_'+ fields[i]).value = ''; 
		}

		this.searchContacts(e);
		$('contacts_search_firstname').focus();
	},

	/*
	 * Gets and displays contacts
	 * @param bool orsearch
	 */
	searchContacts: function () {
		//
		// get search criteria
		//
		var search = {'andor':'and'};
		var fields = ['firstname', 'lastname', 'email', 'number', 'im', 'address'];
		var tmp = '';
		for (var i=0; i<fields.length; i++) {
			tmp = trim($('contacts_search_'+ fields[i]).value);
			if (tmp.length >= 3) { search[fields[i]] = '%'+ tmp +'%'; }
			else if (tmp.length >= 1) { search[fields[i]] = tmp +'%'; }
		}

		// set or if we need to
		if (arguments.length > 0 && arguments[0]) { search['andor'] = 'or'; } 
		if (arguments.length > 1 && arguments[1]) { search['tryandfirst'] = 1; } 

		var clistbox = $('contacts_list');
		clistbox.innerHTML = '';

		//
		// make the request
		//
		var that = this;
		var postData = {'feat':'Contacts', 'command':'searchContacts', 'criteria':search};
		postData['organize'] = (search['blank'])?0:1;
		new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			//
 			// handle response
			//
			if (!r) { alert('An error occurred getting the list of contacts "'+ r +'"'); return false; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }
 
			// clear the list
			clistbox.innerHTML = '';

			var contacts = resp['contacts'];
			var contact = null;

			// set contacts title
			var txt = '('+ contacts.length +') Contacts';
			setText($('contacts_filter_title'), txt);

			//
			// display contact list
			//
			var cbox = null;
			var im = null;

			for (var c=0; c<contacts.length; c++) {
				contact = contacts[c];

				cbox = newEl({'type':'div', 'class':'contact'}, clistbox);
				cbox.setAttribute('contactid', contact['contactid']);
				cbox.setAttribute('firstname', contact['firstname']);
				cbox.setAttribute('lastname', contact['lastname']);
				cbox.setAttribute('nickname', contact['nickname']);
				cbox.onclick = function (e) { this.editContact(e); }.bind(that);
				that.writeContactInfo(cbox, contact);
			}
		}}).send();
	},

	/*
	 * Handle click to edit a contact
	 * @param event (JS event on contact box)
	 */
	editContact: function (e) {
		var cbox = findTarget(e, 'div', 'contactid');
		if (!cbox) { return false; }
		var contactid = cbox.getAttribute('contactid');

		cbox.className = 'contact_open';
		cbox.onclick = null;

		setText(cbox, 'Loading...');

		this.setShortcuts('contact');

		//
		// make the request
		//
		var that = this;
		var postData = {'feat':'Contacts', 'command':'getContact', 'contactid':contactid};
		new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			//
 			// handle response
			//
			if (!r) { alert('An error occurred getting the list of emails after update "'+ r +'"'); return false; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }

			var contact = resp['contact'];
			that.writeContactForm(cbox, contact);
		}}).send(); 		 
	},

	/*
	 * Display the edit contact form
	 * @param object (HTML contact box)
	 * @param array contact info {contactid, firstname, lastname, emails, numbers, ims, addresses, teams}
	 * @return object (first HTML input)
	 */
	writeContactForm: function (cbox, contact) {
		//
		// display contact
		//
		cbox.innerHTML = '';

		var line = null;
		var list = null;
		var sec = null;
		var sub = null;
		var tmp = null;

		//
		// write basic info (first/last/nick)
		//
		line = newEl({'type':'div', 'class':'names', 'attributes':{'names':1}}, cbox);
		if (!this.placeholderSupport) { newEl({'type':'label', 'class':'contact_label', 'text':'Firstname'}, line); }
		tmp = newEl({'type':'input', 'class':'firstname', 'attributes':{'type':'text', 'placeholder':'Firstname', 'title':'Firstname', 'origvalue':''}}, line);
		if (contact['firstname'] && contact['firstname'].length > 0) { tmp.value = trim(contact['firstname']); tmp.setAttribute('origvalue', tmp.value); }
		inp = tmp;

		if (!this.placeholderSupport) { newEl({'type':'label', 'class':'contact_label', 'text':'Lastname'}, line); }
		tmp = newEl({'type':'input', 'class':'lastname', 'attributes':{'type':'text', 'placeholder':'Lastname', 'title':'Lastname', 'origvalue':''}}, line);
		if (contact['lastname'] && contact['lastname'].length > 0) { tmp.value = trim(contact['lastname']); tmp.setAttribute('origvalue', tmp.value); }

		if (!this.placeholderSupport) { newEl({'type':'label', 'class':'contact_label', 'text':'Nickname'}, line); }
		tmp = newEl({'type':'input', 'class':'nickname', 'attributes':{'type':'text', 'placeholder':'Nickname', 'title':'Nickname', 'origvalue':''}}, line);
		if (contact['nickname'] && contact['nickname'].length > 0) { tmp.value = trim(contact['nickname']); tmp.setAttribute('origvalue', tmp.value); }

		//
		// write company
		//
		if (!this.placeholderSupport) { newEl({'type':'label', 'class':'contact_label', 'text':'Company'}, line); }
		tmp = newEl({'type':'input', 'class':'company', 'attributes':{'type':'text', 'placeholder':'Company', 'title':'Company', 'origvalue':''}}, line);
		if (contact['company'] && contact['company'].length > 0) { tmp.value = trim(contact['company']); tmp.setAttribute('origvalue', tmp.value); }
	
		//
		// write emails
		//
		sec = newEl({'type':'div', 'attributes':{'emails':1}}, cbox);

		sub = newEl({'type':'div', 'class':'contact_subtitle'}, sec);
		newEl({'type':'span', 'class':'contact_subtitle', 'text':'Emails'}, sub);
		tmp = newEl({'type':'input', 'class':'fakelink', 'attributes':{'type':'button', 'value':'+', 'sectype':'emails', 'newval':'[""]'}}, sub);
		tmp.onclick = function (e) { this.contactFormWrapper(e); }.bind(this);

		list = newEl({'type':'div', 'class':'list', 'attributes':{'list':1}}, sec);
		this.contactFormElements(list, 'emails', contact['emails']); 

		//
		// write numbers
		//
		sec = newEl({'type':'div', 'attributes':{'numbers':1, 'section':'numbers'}}, cbox);

		sub = newEl({'type':'div', 'class':'contact_subtitle'}, sec);
		newEl({'type':'span', 'class':'contact_subtitle', 'text':'Numbers'}, sub);
		tmp = newEl({'type':'input', 'class':'fakelink', 'attributes':{'type':'button', 'value':'+', 'sectype':'numbers', 'newval':'[{"number":"", "number_type":""}]'}}, sub);
		tmp.onclick = function (e) { this.contactFormWrapper(e); }.bind(this);
		if (!this.placeholderSupport) {
			newEl({'type':'label', 'class':'number', 'text':'(Number, Number Type)'}, sub);
		}

		list = newEl({'type':'div', 'class':'list', 'attributes':{'list':1}}, sec);
		this.contactFormElements(list, 'numbers', contact['numbers']); 

		//
		// write ims
		//
		sec = newEl({'type':'div', 'attributes':{'ims':1}}, cbox);

		sub = newEl({'type':'div', 'class':'contact_subtitle'}, sec);
		newEl({'type':'span', 'class':'contact_subtitle', 'text':'IMs'}, sub);
		tmp = newEl({'type':'input', 'class':'fakelink', 'attributes':{'type':'button', 'value':'+', 'sectype':'ims', 'newval':'[{"im":"", "im_type":""}]'}}, sub);
		tmp.onclick = function (e) { this.contactFormWrapper(e); }.bind(this);
		if (!this.placeholderSupport) {
			newEl({'type':'label', 'class':'number', 'text':'(IM, IM Type)'}, sub);
		}

		list = newEl({'type':'div', 'class':'list', 'attributes':{'list':1}}, sec);
		this.contactFormElements(list, 'ims', contact['ims']); 

		//
		// write addresses
		//
		sec = newEl({'type':'div', 'attributes':{'addresses':1}}, cbox);

		sub = newEl({'type':'div', 'class':'contact_subtitle'}, sec);
		newEl({'type':'span', 'class':'contact_subtitle', 'text':'Addresses'}, sub);
		tmp = newEl({'type':'input', 'class':'fakelink', 'attributes':{'type':'button', 'value':'+', 'sectype':'addresses', 'newval':'[{"address":"", "address_type":""}]'}}, sub);
		tmp.onclick = function (e) { this.contactFormWrapper(e); }.bind(this);
		if (!this.placeholderSupport) {
			newEl({'type':'label', 'class':'number', 'text':'(Street, City, State, Zip, Country)'}, sub);
		}

		list = newEl({'type':'div', 'class':'list', 'attributes':{'list':1}}, sec);
		this.contactFormElements(list, 'addresses', contact['addresses']);  		

		//
		// save and cancel buttons
		//
		sbox = newEl({'type':'div', 'class':'commandbar'}, cbox);
		tmp = newEl({'type':'input', 'class':'fakelink', 'attributes':{'type':'button', 'value':'Save'}}, sbox);
		tmp.onclick = function (e) { this.saveContact(e); }.bind(this);
		tmp = newEl({'type':'input', 'class':'fakelink', 'attributes':{'type':'button', 'value':'Cancel'}}, sbox);
		tmp.onclick = function (e) { this.collapseContact(e); }.bind(this);
		tmp = newEl({'type':'input', 'class':'fakelink', 'attributes':{'type':'button', 'value':'Delete'}}, sbox);
		tmp.onclick = function (e) { this.deleteContact(e); }.bind(this); 

		return inp;
	},

	/*
	 * Wrapper to add item to contact form
	 * @param event (JS click)
	 */
	contactFormWrapper: function (e) {
		var inp = findTarget(e, 'input', 'sectype');
		if (!inp) { alert('no input'); return false; }

		var sectype = inp.getAttribute('sectype');
		var section = findParent(inp, 'div', sectype);
		if (!section) { alert('no section'); return false; }

		var list = findChild(section, 'div', 'list');
		if (!list) { alert('no list'); return false; }

		var data = JSON.decode(inp.getAttribute('newval'));

		var inp = this.contactFormElements(list, sectype, data);
		inp.focus();
	},

	/*
	 * Write contact form
	 * @param object box (HTML box for form elements)
	 * @param string type (emails, numbers, ims, addresses)
	 * @param array (contact info)
	 * @return mixed object (HTML input) || false on error 
	 */
	contactFormElements: function (box, type, info) {
		if (!info || info.length == 0) { return; }

		var tmp = '';
		var inp = null;
		var i=0;
		switch (type) {
		case 'emails':
			for (i=0; i<info.length; i++) {
				line = newEl({'type':'div'}, box);
				tmp = info[i] || '';
				inp = newEl({'type':'input', 'class':'email', 'attributes':{'type':'text', 'placeholder':'Email', 'title':'Email', 'value':tmp, 'origvalue':tmp}}, line);
			}
			break;
		case 'numbers':
			for (i=0; i<info.length; i++) {
				line = newEl({'type':'div'}, box);
				tmp = info[i]['number'] || '';
				inp = newEl({'type':'input', 'class':'number', 'attributes':{'type':'text', 'placeholder':'Number', 'title':'Number', 'value':tmp, 'origvalue':tmp}}, line);
				tmp = info[i]['number_type'] || '';
				newEl({'type':'input', 'class':'number_type', 'attributes':{'type':'text', 'placeholder':'Type', 'title':'Number Type', 'value':tmp, 'origvalue':tmp}}, line);
			} 
			break;
		case 'ims':
			for (i=0; i<info.length; i++) {
				line = newEl({'type':'div'}, box);
				tmp = info[i]['im_name'] || '';
				inp = newEl({'type':'input', 'class':'im', 'attributes':{'type':'text', 'placeholder':'IM', 'title':'IM', 'value':tmp, 'origvalue':tmp}}, line);
				tmp = info[i]['im_type'] || '';
				newEl({'type':'input', 'class':'im_type', 'attributes':{'type':'text', 'placeholder':'Type', 'title':'IM Type', 'value':tmp, 'origvalue':tmp}}, line);
			}
			break;
		case 'addresses':
			for (i=0; i<info.length; i++) {
				line = newEl({'type':'div', 'class':'address'}, box);
				tmp = info[i]['address'] || '';
				inp = newEl({'type':'input', 'class':'address', 'attributes':{'type':'text', 'placeholder':'Address', 'title':'Address', 'value':tmp, 'origvalue':tmp}}, line);
				tmp = info[i]['address_type'] || '';
				newEl({'type':'input', 'class':'address_type', 'attributes':{'type':'text', 'placeholder':'Type', 'title':'Address Type', 'value':tmp, 'origvalue':tmp}}, line);
			} 
			break;
		default:
			alert('undefined type "'+  type +'"');
			return false;
		}

		return inp;
	},

	/*
	 * Writes contact info in the box
	 * @param object (HTML contact box)
	 * @param array (contact info)
	 */
	writeContactInfo: function (cbox, cinfo) {
		var subbox = null;

		var sbox = newEl({'type':'div', 'class':'section basic'}, cbox);
		newEl({'type':'span', 'class':'firstname', 'text':cinfo['firstname']}, sbox);
		newEl({'type':'span', 'class':'lastname', 'text':cinfo['lastname']}, sbox);
		if (cinfo['nickname'] && cinfo['nickname'].length > 0) {
			newEl({'type':'span', 'class':'nickname', 'text':cinfo['nickname']}, sbox);
		}
		if (cinfo['company'] && cinfo['company'].length > 0) {
			newEl({'type':'span', 'class':'company', 'text':'@ '+ cinfo['company']}, sbox);
		}

		// write all the other stuff
		if (cinfo['emails'] && cinfo['emails'].length > 0) {
			sbox = newEl({'type':'div', 'class':'section emails'}, cbox);
			for (var i=0; i<cinfo['emails'].length; i++) {
				newEl({'type':'div', 'class':'subinfo'}, sbox);
				newEl({'type':'span', 'class':'email', 'text':cinfo['emails'][i]}, sbox);
			}
		}

		if (cinfo['ims'] && cinfo['ims'].length > 0) {
			sbox = newEl({'type':'div', 'class':'section ims'}, cbox);
			for (i=0; i<cinfo['ims'].length; i++) {
				subbox = newEl({'type':'div', 'class':'subinfo'}, sbox);
				newEl({'type':'span', 'class':'im_name', 'text':cinfo['ims'][i]['im_name']}, subbox);
				newEl({'type':'span', 'class':'im_type', 'text':'('+ cinfo['ims'][i]['im_type'] +')'}, subbox);
			}
		}

		if (cinfo['numbers'] && cinfo['numbers'].length > 0) {
			sbox = newEl({'type':'div', 'class':'section numbers'}, cbox);
			for (i=0; i<cinfo['numbers'].length; i++) {
				subbox = newEl({'type':'div', 'class':'subinfo'}, sbox);
				newEl({'type':'span', 'class':'number', 'text':cinfo['numbers'][i]['number']}, subbox);
				newEl({'type':'span', 'class':'number_type', 'text':'('+ cinfo['numbers'][i]['number_type'] +')'}, subbox);
			}
		}

		if (cinfo['addresses'] && cinfo['addresses'].length > 0) {
			sbox = newEl({'type':'div', 'class':'section addresses'}, cbox);
			for (i=0; i<cinfo['addresses'].length; i++) {
				subbox = newEl({'type':'div', 'class':'subinfo'}, sbox);
				var address = trim(cinfo['addresses'][i]['address']);
				newEl({'type':'a', 'class':'address', 'text':address, 'attributes':{'target':'map', 'href':'https://maps.google.com/maps?q='+ address.replace(/\s/g, '+')}}, subbox);
				if (cinfo['addresses'][i]['address_type'] && cinfo['addresses'][i]['address_type'].length > 0) { subbox.lastChild.setAttribute('title', cinfo['addresses'][i]['address_type']); }
			}
		} 
	},   

	/*
	 * Collapse contact
	 */
	collapseContact: function (e) {
		var cbox = findTarget(e, 'div', 'contactid');
		if (cbox) {
		   if (Browser.ie) {
				// BROKEN IE
				e.cancelBubble = true;
				e.returnValue = false;
			} else {
				e.stopPropagation();
			} 
		}  
		if (!cbox) { return false; }
		var contactid = cbox.getAttribute('contactid');

		// if this is a new contacts, just remove it
		if (contactid == 0) {
			cbox.parentNode.removeChild(cbox);
			return;
		}

		cbox.className = 'contact';
		cbox.onclick = function (e) { this.editContact(e); }.bind(this);

		cbox.innerHTML = '';
		this.writeContactInfo(cbox, {'contactid':contactid, 'firstname':cbox.getAttribute('firstname'), 'lastname':cbox.getAttribute('lastname'), 'nickname':cbox.getAttribute('nickname')});		

		this.setContactShortcut();
	},

	/*
	 * Save a contact
	 */
	saveContact: function (e) {
		var cbox = findTarget(e, 'div', 'contactid');
		if (!cbox) { return false; }

		//
		// gather contact info
		//
		var contactid = cbox.getAttribute('contactid').toInt();
		var contact = {'firstname':'', 'lastname':'', 'contactid':contactid, 'emails':[], 'numbers':[], 'ims':[], 'addresses':[]};
		var inputs = cbox.getElementsByTagName('input');
		var inp = null;
		var txt = '';
		var typetxt = '';
		for (var i=0; i<inputs.length; i++) {
			inp = inputs[i];
			txt = trim(inp.value);
			if (!checkAttr(inp, 'title')) { continue; }

			switch (inp.getAttribute('title')) {
			case 'Firstname':
				contact['firstname'] = txt;
				break;

			case 'Lastname':
				contact['lastname'] = txt;
				break;

			case 'Nickname':
				contact['nickname'] = txt;
				break;

			case 'Company':
				contact['company'] = txt;
				break;

			case 'Email':
				if (txt.length == 0) { break; }
				contact['emails'].push(txt);
				break;

			case 'Number':
				if (txt.length == 0) { break; }
				typetxt = trim(inp.nextSibling.value);
				contact['numbers'].push({'number':txt, 'number_type':typetxt});
				
				break;

			case 'IM':
				if (txt.length == 0) { break; }
				typetxt = trim(inp.nextSibling.value);
				contact['ims'].push({'im':txt, 'im_type':typetxt});
				break;

			case 'Address':
				if (txt.length == 0) { break; }
				typetxt = trim(inp.nextSibling.value);
				contact['addresses'].push({'address':txt, 'address_type':typetxt});
				break;

			default:
				break;
			}
		}

		// basic checks
		if (contact['firstname'].length == 0 && contact['lastname'].length == 0) { alert('First or lastname required'); return false; }

		//
		// make the request
		//
		var that = this;
		var postData = {'feat':'Contacts', 'command':'saveContact', 'contact':contact};
		new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) { 
			//
			// handle the response
			//
			if (!r) { alert('An error occurred getting the list of notes "'+ r +'"'); return false; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }

			cbox.innerHTML = '';
			cbox.className = 'contact';
			cbox.onclick = function (e) { this.editContact(e); }.bind(that);

			that.writeContactInfo(cbox, resp['contact']);
			that.setContactShortcut();
		}}).send();
	},

	/*
	 * Handles deleting contact
	 */
	deleteContact: function (e) {
		var cbox = findTarget(e, 'div', 'contactid');
		if (!cbox) { return false; }

		if (!confirm('Delete '+ cbox.getAttribute('firstname') +' '+ cbox.getAttribute('lastname'))) { return false; }

		var contactid = cbox.getAttribute('contactid').toInt();
		var that = this;
		var postData = {'feat':'Contacts', 'command':'deleteContact', 'contactid':contactid};
		new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) { 
			//
			// handle the response
			//
			if (!r) { alert('An error occurred getting the list of notes "'+ r +'"'); return false; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }

			// remove the cbox
			cbox.parentNode.removeChild(cbox);

			that.setContactShortcut();
		}}).send(); 
	},

	/*
	 * Sets shortcuts to contacts or contact
	 */
	setContactShortcut: function () {
		// check if any others are open to reset shortcuts
		var clist = $('contacts_list');
		var shcut = 'contacts';
		for (var i=0; i<clist.childNodes.length; i++) {
			if (clist.childNodes[i].className == 'contact_open') {
				shcut = 'contact';
				i = clist.childNodes.length;
			}
		}

		this.setShortcuts(shcut); 

		// also update the title
		var txt = '('+ clist.childNodes.length +') Contacts';
		setText($('contacts_filter_title'), txt);
	},
  
	/*
	 * Display Notes view
	 */
	showNotes: function () {
		var box = $('notes_box');
		if (box.childNodes.length == 0) { this.initNotes(); }

		showCover(box);

		this.setShortcuts('notes');

		if ($('notes_list').childNodes.length == 0) { this.searchNotes(); } 

		$('notes_filter_input').focus();
	},
	
	/*
	 * Hide Notes list
	 */
	hideNotes: function () {
		hideCover($('notes_box'));

		this.toggleRightColumn('smart');
	},

	/*
	 * Handles adding a new note
	 */
	newNote: function () {
		var nlistbox = $('notes_list');

		// create the new note box
		var nbox = newEl({'type':'div', 'class':'note_open', 'attributes':{'noteid':0, 'note_name':'', 'note_desc':''}});

		// put it at the top
		if (nlistbox.childNodes.length > 0) {
			nlistbox.insertBefore(nbox, nlistbox.firstChild);
		} else {
			nlistbox.appendChild(nbox);
		}
		
		// scroll to the top
		nlistbox.scrollTop = 0;

		inp = this.editNote(nbox);
		inp.focus();
	},
	
	/*
	 * Collapse note
	 */
	collapseNote: function (e) {
		var nbox = findTarget(e, 'div', 'noteid');
		if (nbox) {
		   if (Browser.ie) {
				// BROKEN IE
				e.cancelBubble = true;
				e.returnValue = false;
			} else {
				e.stopPropagation();
			} 
		} 
		if (!nbox) { return false; }
		var noteid = nbox.getAttribute('noteid');

		// if this is a new note, just remove it
		if (noteid == 0) {
			nbox.parentNode.removeChild(nbox);
		} else {
			this.viewNote(nbox);
		}

		$('notes_filter_input').select();
	},
	 
	/*
	 * Gets and displays contacts
	 */
	searchNotes: function () {
		var searchtxt = trim($('notes_filter_input').value);
		if (searchtxt == this.notes_search) { return true; } else { this.notes_search = searchtxt; }

		var search = {'name':searchtxt, 'description':searchtxt};

		var nlistbox = $('notes_list');
		nlistbox.innerHTML = '';

		//
		// make the request
		//
		var that = this;
		var postData = {'feat':'Notes', 'command':'searchNotes', 'criteria':search};
		postData['organize'] = (search['blank'])?0:1;
		if (this.get_notes_request && this.get_notes_request.isRunning()) { this.get_notes_request.cancel(); }
		this.get_notes_request = new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			//
 			// handle response
			//
			if (!r) { alert('An error occurred getting the list of notes "'+ r +'"'); return false; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }
 
			// clear the list
			nlistbox.innerHTML = '';

			var notes = resp['notes'];
			var note = null;

			// set notes title
			var txt = '('+ notes.length +') Notes';
			setText($('notes_filter_title'), txt);

			//
			// display contact list
			//
			var nbox = null;
			for (var n=0; n<notes.length; n++) {
				note = notes[n];

				nbox = newEl({'type':'div', 'class':'note', 'text':note['name'], 'attributes':{'noteid':note['noteid'], 'note_name':note['name'], 'note_desc':note['description'], 'note_pinned':note['pinned']}}, nlistbox);

				that.viewNote(nbox);
			}

			if (notes.length == 1) { that.editNote(nbox); }

			$('notes_filter_input').focus();

			that.setShortcuts('notes'); 
		}}).send(); 
	},

	/*
	 * Handle key events in notes search input
	 */
	searchNotesKeyHandler: function (e) {
        // find keycode
        var code = null;
        if (!e) { e = window.event; }
        if (e.keyCode) { code = e.keyCode; }
        else if (e.which) { code = e.which; }

		// if the Ctrl + arrow keys are used, do something
		switch (code) {
		case 13: 
			if (this.highlightedNote) {
				this.editNote(this.highlightedNote);
			   	this.highlightedNote = false;
			} else {
   				this.searchNotes();
			}
			break;

		case 27:
			// handle esc
			if (this.highlightedNote) {
				this.highlightNote('none');
				return false;
			} else {
   				this.hideNotes();
				return false;
			}
			break;

		case 38:
			// handle up arrow
			this.highlightNote('prev');
			return false;
			break;

		case 40:
			// handle down arrow
			this.highlightNote('next');
			return false;
			break;

		default:
		}

		this.searchNotes();
		return true;
	},

	/*
	 * Handles highlighting new notes
	 * @param string {'next'|'prev'|'none'}
	 */
	highlightNote: function (note) {
		var highlightNext = false;
		var nlist = $('notes_list');

		// do not nighlight if any notes are open
		for (var i=0; i<nlist.childNodes.length; i++) {
			if (nlist.childNodes[i].className == 'note_open') { return false; }
		}
 
		// highlight the right one
		switch (note) {
		case 'next':
			if (this.highlightedNote && checkAttr(this.highlightedNote, 'noteid') && this.highlightedNote.nextSibling && checkAttr(this.highlightedNote.nextSibling, 'noteid')) {
				highlightNext = this.highlightedNote.nextSibling;
			} else {
				if (nlist && nlist.firstChild && checkAttr(nlist.firstChild, 'noteid')) {
					highlightNext = nlist.firstChild;
				}
			}
			break;

		case 'prev':
			if (this.highlightedNote && checkAttr(this.highlightedNote, 'noteid') && this.highlightedNote.previousSibling && checkAttr(this.highlightedNote.previousSibling, 'noteid')) {
				highlightNext = this.highlightedNote.previousSibling;
			} else {
				if (nlist && nlist.lastChild && checkAttr(nlist.lastChild, 'noteid')) {
					highlightNext = nlist.lastChild;
				}
			} 
			break;

		case 'none':
			break;

		default:
		}

		// un highlight the note
		if (this.highlightedNote && checkAttr(this.highlightedNote, 'noteid')) {
			// remove the classname
			this.highlightedNote.className = this.highlightedNote.className.replace(' selected', '');

			this.highlightedNote = false;
		}
 
		// highlight the appropriate note
		if (highlightNext) {
			highlightNext.className = highlightNext.className +' selected';
			this.highlightedNote = highlightNext;
		}

		return true;
	},

	/*
	 * Set the note to view mode
	 * @param event (JS event) || object (HTML note box)
	 */
	viewNote: function (e) {
 		var nbox = findTarget(e, 'div', 'noteid');
		if (!nbox && checkAttr(e, 'noteid')) { nbox = e; } 
		if (!nbox) { return false; }

		nbox.innerHTML = '';

		nbox.className = 'note';
		nbox.onclick = function (e) { this.editNote(e); }.bind(this);
		newEl({'type':'div', 'class':'note_name', 'text':nbox.getAttribute('note_name')}, nbox);

		// find the optimal width for the desc
		try {
			var nsize = nbox.getSize();
			var tsize = nbox.firstChild.getSize();
			var width_left = nsize.x - tsize.x - 70;
			var txt = trim(nbox.getAttribute('note_desc'));
			var tmp = newEl({'type':'div', 'class':'note_desc', 'text':txt}, nbox);
			tmp.style.width = width_left +'px';
		} catch (err) { alert(err.description); }

		this.setNoteShortcut();
	},

	/*
	 * Set note to edit mode
	 * @param event (JS event) || object (HTML note box)
	 */
	editNote: function (e) {
		var nbox = findTarget(e, 'div', 'noteid');		
		if (!nbox && checkAttr(e, 'noteid')) { nbox = e; } 
		if (!nbox) { alert('note box not found'); return false; }

		nbox.innerHTML = '';
		nbox.className = 'note_open';
		nbox.onclick = null;

		// name
		var inp = newEl({'type':'input', 'class':'note_name', 'attributes':{'type':'text', 'value':nbox.getAttribute('note_name'), 'notename':'1'}}, nbox);

		// save
		var tmp = newEl({'type':'input', 'class':'fakelink', 'attributes':{'type':'button', 'value':'Save'}}, nbox);
		tmp.onclick = function (e) { this.saveNote(e); }.bind(this);

		// cancel
		tmp = newEl({'type':'input', 'class':'fakelink', 'attributes':{'type':'button', 'value':'Cancel'}}, nbox);
		tmp.onclick = function (e) { this.collapseNote(e); }.bind(this);

		// delete
		tmp = newEl({'type':'input', 'class':'fakelink', 'attributes':{'type':'button', 'value':'Delete'}}, nbox);
		tmp.onclick = function (e) { this.deleteNote(e); }.bind(this);

		// pin
		if (nbox.getAttribute('noteid').toInt() > 0) {
			tmp = newEl({'type':'input', 'class':'fakelink', 'attributes':{'type':'button', 'value':''}}, nbox);
			tmp.value = (nbox.getAttribute('note_pinned') == '1')?'Unpin from top':'Pin to top';
			tmp.onclick = function (e) { this.pinUnNote(e); }.bind(this);
		}

		// text
		tmp = newEl({'type':'textarea', 'class':'note_desc', 'attributes':{'cols':65, 'minrows':4}}, nbox);
		tmp.value = trim(nbox.getAttribute('note_desc'));
		tmp.onkeydown = function (e) { resizeTextarea(e); }

		setTimeout(function(){resizeTextarea(tmp)}, 100);
		tmp.focus();

		this.setShortcuts('note'); 

		return inp;
	},

	/*
	 * Pin or Unpin a note
	 * @param event (JS event)
	 */
	pinUnNote: function (e) {
		var btn = findTarget(e, 'input');
		if (!btn) { return false; }

		var nbox = findTarget(e, 'div', 'noteid');
		if (!nbox) { return false; }

		//
		// get note info
		//
		var noteid = nbox.getAttribute('noteid').toInt();
		var pin = (nbox.getAttribute('note_pinned') == '1')?0:1;
 
		var note = {'noteid':noteid, 'pinned':pin};

		//
		// make the request
		//
 		var that = this;
		var postData = {'feat':'Notes', 'command':'saveNote', 'note':note};
		new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) { 
			//
			// handle the response
			//
			if (!r) { alert('An error occurred getting the list of notes "'+ r +'"'); return false; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }
 
			// update the button value
			btn.value = (resp['note']['pinned'] == 1)?'Unpin from top':'Pin to top';

			// move the note to the top or down
			var notes = nbox.parentNode;
			if (resp['note']['pinned'] == 1) {
				// move to the top
				if (notes.firstChild != nbox) { notes.insertBefore(nbox, notes.firstChild); }

				// set the correct attribute
				nbox.setAttribute('note_pinned', 1);
			} else {
				// find the first unpinned note
				var firstunpin = false;
				for (var i=0; i<notes.childNodes.length; i++) {
					if (notes.childNodes[i].getAttribute('note_pinned') == '1') { continue; }

					firstunpin = notes.childNodes[i];
					i = notes.childNodes.length;
				}

				if (firstunpin) {
					// put before the firstunpin
					if (nbox != firstunpin) { notes.insertBefore(nbox, firstunpin); }
				} else {
					// put at the end
					insertAfter(notes.lastChild, nbox);
				}

				// set the correct attribute
				nbox.setAttribute('note_pinned', 0);
			}
		}}).send();  		
	},

	/*
	 * Save Note
	 */
	saveNote: function (e) {
		var nbox = findTarget(e, 'div', 'noteid');
		if (!nbox) { return false; }

		//
		// get note info
		//
		var noteid = nbox.getAttribute('noteid').toInt();
		var nname = findChild(nbox, 'input', 'notename');
		if (!nname) { return false; }
		var ntxt = findChild(nbox, 'textarea');
		if (!ntxt) { return false; }

		var note = {'noteid':noteid, 'name':trim(nname.value), 'description':trim(ntxt.value), 'pinned':0};

		//
		// make the request
		//
 		var that = this;
		var postData = {'feat':'Notes', 'command':'saveNote', 'note':note};
		new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) { 
			//
			// handle the response
			//
			if (!r) { alert('An error occurred getting the list of notes "'+ r +'"'); return false; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }

			nbox.innerHTML = '';

			nbox.setAttribute('note_name', resp['note']['name']);
			nbox.setAttribute('note_desc', resp['note']['description']);
			nbox.setAttribute('noteid', resp['note']['noteid']);

			that.viewNote(nbox);

			// update the # of notes
			var txt = '('+ nbox.parentNode.childNodes.length +') Notes';
			setText($('notes_filter_title'), txt);

			that.setNoteShortcut();
		}}).send(); 
	},

	/*
	 * Deletes a note
	 */
	deleteNote: function (e) {
		var nbox = findTarget(e, 'div', 'noteid');		
		if (!nbox && checkAttr(e, 'noteid')) { nbox = e; } 
		if (!nbox) { alert('note box not found'); return false; }

		if (!confirm('Delete note ('+ nbox.getAttribute('note_name') +')')) { return false; }

		var noteid = nbox.getAttribute('noteid');

		if (noteid == 0) {
			nbox.parentNode.removeChild(nbox);
			return;
		}

		//
		// make the request to delete the note
		//
 		var that = this;
		var postData = {'feat':'Notes', 'command':'deleteNote', 'noteid':noteid};
		new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) { 
			//
			// handle the response
			//
			if (!r) { alert('An error occurred getting the list of notes "'+ r +'"'); return false; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }

			// remove the note
			nbox.parentNode.removeChild(nbox);

			// set shortcut
			that.setNoteShortcut();
		}}).send();  
	},

	/*
	 * Sets shortcuts to contacts or contact
	 */
	setNoteShortcut: function () {
		// check if any others are open to reset shortcuts
		var nlist = $('notes_list');
		var shcut = 'notes';
		for (var i=0; i<nlist.childNodes.length; i++) {
			if (nlist.childNodes[i].className == 'note_open') {
				shcut = 'note';
				i = nlist.childNodes.length;
			}
		}

		this.setShortcuts(shcut); 

		// also update the title
		var txt = '('+ nlist.childNodes.length +') Notes';
		setText($('notes_filter_title'), txt);
	},
	   
	/*
	 * Display settings page
	 */
	showSettings: function () {
		var box = $('settings_box');
		if (box.childNodes.length == 0) { this.initSettings(); }

		showCover(box);

		this.setShortcuts('settings'); 
	},
	   
	/*
	 * Hide settings page
	 */
	hideSettings: function () {
		hideCover($('settings_box'));

		this.toggleRightColumn('smart');

		this.toggleFromAddresses(false);
	},

	/*
	 * Handles changing password
	 */
	changePassword: function () {
		var oldpass = trim($('pref_oldpass').value);
		var newpass1 = trim($('pref_newpass1').value);
		var newpass2 = trim($('pref_newpass2').value);

		var stat = $('changepass_status');

		if (oldpass.length == 0) { setText(stat, 'Please enter your old password'); return false; }
		if (newpass1.length == 0 || newpass2.length == 0) { setText(stat, 'Please enter your new password twice'); return false; }
		if (newpass1 != newpass2) { setText(stat, 'New passwords do not match'); return false; }

		// clear the status
		setText(stat, '');

		// make the request
 		var that = this;
		var postData = {'feat':'Users', 'command':'changePassword', 'oldpass':oldpass, 'newpass':newpass1};
		new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) { 
			//
			// handle the response
			//
			if (!r) { alert('An error occurred while changing your password "'+ r +'"'); return false; }
			var resp = JSON.decode(r);
			if (resp['status'] == 0) { setText(stat, resp['error']); return false; }

			// clear the fields
			$('pref_oldpass').value = '';
			$('pref_newpass1').value = '';
			$('pref_newpass2').value = '';

			that.settingsSaveSuccess();
		}}).send();   
	},

	/*
	 * Save weather locations
	 */
	saveLocations: function (action) {
		var locations = this.weatheras.getKeyValues();

		// make the service request
		var that = myTWIG;
		var postData = {'feat':'Users', 'command':'saveSettings', 'settings':{'weather_locations':JSON.encode(locations)}};
		new Request({method:'post', url:'ajax.php', 'data':postData, 'onComplete': function (r) {
			// handle response
			if (!r) { return; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }

			that.settingsSaveSuccess();
			that.options.weather_locations = locations;
			that.getWeather(0);
		}}).send();
	},

	/*
	 * Show/Hide from Addresses
	 * @param bool (true = show/false = hide)
	 */
	toggleFromAddresses: function (showhide) {
		var btn = $('from_addr_button');
		if (!btn) { return; }

		var count = 0;
		var addrs = this.options.from_addresses;

		if (showhide) {
			var tbl = $('from_addr_list');
			tbl.style.display = '';

			// clear things out
			while (tbl.childNodes.length > 0) { tbl.removeChild(tbl.lastChild); }

			var tbdy = newEl({'type':'tbody'}, tbl);

			var row = newEl({'type':'tr', 'class':'head'}, tbdy);
   			var cell = newEl({'type':'td', 'text':'Email'}, row);
	   		cell = newEl({'type':'td', 'text':'From Name'}, row);
			cell = newEl({'type':'td', 'text':'Reply To'}, row);
			cell = newEl({'type':'td', 'text':'Default'}, row);
			cell = newEl({'type':'td', 'text':'Hide'}, row);

			for (var addr in addrs) {
				count++;

				row = newEl({'type':'tr', 'attributes':{'email':addr, 'title':addr}}, tbdy);

				tmp = (addr.length > 20)?addr.substr(0, 17) +'...':addr;
				cell = newEl({'type':'td', 'text':tmp}, row);

				cell = newEl({'type':'td'}, row);
				tmp = newEl({'type':'input', 'attributes':{'type':'text', 'placeholder':'From Name', 'value':addrs[addr]['name'], 'size':'15'}}, cell);
				tmp.onchange = function (e) { this.saveFromAddress(e); }.bind(this);

				cell = newEl({'type':'td'}, row);
				tmp = newEl({'type':'input', 'attributes':{'type':'text', 'placeholder':addr, 'value':addrs[addr]['replyto'], 'size':'15'}}, cell);
				tmp.onchange = function (e) { this.saveFromAddress(e); }.bind(this);

				cell = newEl({'type':'td', 'class':'alignc'}, row);
				tmp = newEl({'type':'input', 'attributes':{'type':'radio', 'name':'fromaddrdef', 'title':'Make Default'}}, cell);
				tmp.checked = (addrs[addr]['isdefault'] == 1);
				tmp.onchange = function (e) { this.saveFromAddress(e); }.bind(this);

				cell = newEl({'type':'td', 'class':'alignc'}, row);
				tmp = newEl({'type':'input', 'attributes':{'type':'checkbox', 'title':'Hide from list'}}, cell);
				tmp.checked = (addrs[addr]['hidden'] == 1);
				tmp.onchange = function (e) { this.saveFromAddress(e); }.bind(this);
			}

			btn.style.display = 'none';
		} else {
			// hide the table
			$('from_addr_list').style.display = 'none';

			// get count
			for (var addr in addrs) { count++; }
			btn.style.display = '';
			btn.value = 'Manage ('+ btn.getAttribute('numcount') +') Addresses';
		}
	},

	/*
	 * Save From Address info on change
	 * @param object (JS event)
	 */
	saveFromAddress: function(e) {
		// find the element
		var row = findTarget(e, 'tr', 'email');
		if (!row) { return false; }

		// get address info
		var faddr = {};
		faddr['email'] = row.getAttribute('email');
		faddr['name'] = trim(row.childNodes[1].firstChild.value);
		faddr['replyto'] = trim(row.childNodes[2].firstChild.value);
		faddr['isdefault'] = (row.childNodes[3].firstChild.checked)?1:0;
		faddr['hidden'] = (row.childNodes[4].firstChild.checked)?1:0;

		// make the request to save
		that = this;
		var postData = {'feat':'Emails', 'command':'updateFromAddress', 'address':faddr}; 
		new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			// handle response
			if (!r) { return; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }

			that.options.from_addresses = resp['from_addresses'];

			that.toggleFromAddresses(true);

			// show save success
			that.settingsSaveSuccess();
		}}).send();

		return true; 		
	},

	/*
	 * Change the settings box to show successful
	 */
	settingsSaveSuccess: function () {
		$('settings_box').className = 'success';

		setTimeout((function(){$('settings_box').className = '';}), 250);
	},

	/*
	 * Display help page
	 */
	showHelp: function () {
		var box = $('help_box');

		showCover(box);

		this.setShortcuts('help');  

		$('close_help_lnk').onclick = function (e) { this.hideHelp(e); }.bind(this);
	},

	/*
	 * Hide help page
	 */
	hideHelp: function () {
		hideCover($('help_box'));

		this.toggleRightColumn('smart');
	},
 
	/*
	 * Focus/Un tasks
	 * @param bool
	 */
	focusTasks: function (focus) {
		var tbox = $('tasks_box');

		if (focus) {
			if (tbox.hasClass('focused')) { return; }
			// set shortcuts and scroll
			this.toggleRightColumn('tasks');
			// update class
			tbox.addClass('focused');
			// focus on the add button
			tbox.lastChild.firstChild.focus();
		} else {
			// unselect for good measure
			this.selectTask(false);
			// set shortcuts and scroll
			this.toggleRightColumn('smart');
			// update class
			tbox.removeClass('focused');
		}
	},

	/*
	 * Adds a new task to the new
	 */
	addTask: function (taskinfo) {
		var tbox = $('tasks_box');

		// main task box
		task = newEl({'type':'div', 'class':'task', 'attributes':{'taskid':taskinfo['taskid'], 'expected':taskinfo['expected'], 'completed':taskinfo['completed']}});
		if (taskinfo['completed'] && isNumeric(taskinfo['completed']) && taskinfo['completed'].toInt() == 1) { task.addClass('completed'); }
		tbox.insertBefore(task, tbox.lastChild);

		// task description
		tmp = newEl({'type':'input', 'class':'task-text', 'title':'Task description', 'attributes':{'placeholder':'Something to do'}}, task);
		if (taskinfo['task']) {
			tmp.value = taskinfo['task'];
			if (taskinfo['task'].length > 50) { tmp.setAttribute('title', taskinfo['task']); }
		}
		tmp.onkeydown = function (e) { this.tasksKeyHandler(e); }.bind(this);
		tmp.onfocus = function (e) { this.selectTask(e); }.bind(this);
		tmp.onchange = function (e) { this.saveTask(e); }.bind(this);

		// add command links
		var cmdbox = newEl({'type':'div', 'class':'task-links'}, task);
		tmp = newEl({'type':'span', 'text':'\u25b4', 'title':'Raise priority'}, cmdbox);
     	tmp.onclick = function (e) { this.taskActions(e, 'raise'); }.bind(this);
		tmp = newEl({'type':'span', 'text':'\u25be', 'title':'Lower priority'}, cmdbox);
     	tmp.onclick = function (e) { this.taskActions(e, 'lower'); }.bind(this);
		tmp = newEl({'type':'span', 'text':'\u25b8', 'title':'Push to tomorrow'}, cmdbox);
     	tmp.onclick = function (e) { this.taskActions(e, 'tomorrow'); }.bind(this);
		tmp = newEl({'type':'span', 'text':'\u2714', 'title':'Mark as complete'}, cmdbox);
     	tmp.onclick = function (e) { this.taskActions(e, 'complete'); }.bind(this);

		if (tbox.childNodes.length < 5) { this.showNoTasks(); }

		if (taskinfo['taskid'] == 0) {
			this.selectTask(task);
			task.firstChild.focus();
		}
	},  

	/*
	 * Handles key events while focus is on tasks
	 */
	tasksKeyHandler: function (e) {
        // find keycode
        var code = null;
        if (!e) { e = window.event; }
        if (e.keyCode) { code = e.keyCode; }
        else if (e.which) { code = e.which; }
       
		// find the task
		var task = findTarget(e, 'div', 'taskid');

		// if the Ctrl + arrow keys are used, do something
		if (e.ctrlKey) {
			if (code == 8) {
				// delete with backspace
				this.deleteTask(task);
			} else if (code == 13) {
				this.saveTask(task);
			} else if (code == 37) {
				// un/mark as completed
				this.taskActions(task, 'complete');
			} else if (code == 39) {
				// send to the next day
				this.taskActions(task, 'tomorrow');
			} else if (code == 38) {
				// raise priority
				this.taskActions(task, 'raise');
			} else if (code == 40) {
				// lower priority
				this.taskActions(task, 'lower');
			} else if (code == 46) {
				// delete with delete
				this.deleteTask(task);
			}

			// we took care of the task so return false
			return false;
		}

		return true;
	},

	/*
	 * Perform actions on a task
	 * @param mixed JS event | HTML element
	 * @param string (raise|lower|complete|tomorrow)
	 */
	taskActions: function (e, action) {
		var task = findTarget(e, 'div', 'taskid');
		if (!task && checkAttr(e, 'taskid')) { task = e; }
		if (!task || !checkAttr(task, 'taskid')) { return false; }

		// raise priority
		switch (action) {
		case 'raise':
			if (task.previousSibling && checkAttr(task.previousSibling, 'taskid')) {
				task.parentNode.insertBefore(task, task.previousSibling);
				findChild(task, 'input').focus();
				clearTimeout(this.tasksPriorityTimeoutID);
				this.tasksPriorityTimeoutID = setTimeout((function(){this.saveTasksOrder();}.bind(this)), 1000);
			} 
			break;

		case 'lower':
			if (task.nextSibling && checkAttr(task.nextSibling, 'taskid')) {
				insertAfter(task.nextSibling, task);
				findChild(task, 'input').focus();
				clearTimeout(this.tasksPriorityTimeoutID);
				this.tasksPriorityTimeoutID = setTimeout((function(){this.saveTasksOrder();}.bind(this)), 1000);
			}  
			break;

		case 'complete':
			var complete = (task.getAttribute('completed').toInt() == 1)?0:1;
			task.setAttribute('completed', complete);
			this.saveTask(task); 
			break;

		case 'tomorrow':
			var expected = new Date(task.getAttribute('expected') *1000).increment('day', 1);
			task.setAttribute('expected', expected.format('%s'));
			this.saveTask(task);
			task.style.display = 'none'; 
			break;

		case 'delete':
			break;

		default:
			return false;
		}
	},
    
	/*
	 * Setup tasks
	 */
	refreshTasks: function (start) {
		if (!start) { start = new Date().clearTime(); }

		// setup the HTML elements
		var tbox = $('tasks_box');
		tbox.innerHTML = '';

		that = this;
		var postData = {'feat':'Tasks', 'command':'searchTasks', 'criteria':{'expected':start.format('%s')}};
		new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			// handle response
			if (!r) { return; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }

			// show the tasks box
			tbox.style.display = '';
 
			// write the header
			var datetxt = start.format('%a %b %e%o');
			var datetitle = start.format('%B %e, %Y');

			// header elements
			var header = newEl({'type':'div', 'class':'task-header'}, tbox);
			var prev = newEl({'type':'span', 'class':'task-prev', 'text':'\u25c0'}, header);
			prev.onclick = function (e) { this.refreshTasks(start.decrement('day', 1)); }.bind(that);
			newEl({'type':'span', 'class':'task-date', 'text':datetxt, 'attributes':{'title':datetitle}}, header);
			var next = newEl({'type':'span', 'class':'task-next', 'text':'\u25b6'}, header);
			next.onclick = function (e) { this.refreshTasks(start.increment('day', 1)); }.bind(that);

			// show new task link
			var newbox = newEl({'type':'div', 'class':'new-task-link'}, tbox);
			var newbtn = newEl({'type':'input', 'class':'new-task-button', 'attributes':{'type':'button', 'value':'Add Task'}}, newbox);
			newbtn.onclick = function (e) { this.addTask({'taskid':0, 'expected':start.format('%s'), 'completed':0}); }.bind(that);  		
			newbtn.onfocus = function (e) { this.selectTask(false); }.bind(that);

			// write tasks
			var tasks = resp['tasks'];
			var task = tmp = null;
			for (var i=0; i<tasks.length; i++) {
				that.addTask(tasks[i]);
			}

			// set focus events
			tbox.addEvent('mouseenter', function (e) { this.focusTasks(true); }.bind(that));
			tbox.addEvent('mouseleave', function (e) { this.focusTasks(false); }.bind(that));

			that.showNoTasks();
		}}).send();
 
        //
		// create action links for tasks
		//
		/*
		var tactions = newEl({'type':'div', 'id':'tasks_actions'}, document.body);
		tmp = newEl({'type':'span', 'class':'task-up', 'text':'\u25b4', 'title':'Make higher priority'}, tactions);
		tmp.onclick = function (e) { }.bind(this);
		tmp = newEl({'type':'span', 'class':'task-down', 'text':'\u25be', 'title':'Make lower priority'}, tactions);
		tmp.onclick = function (e) { }.bind(this);
		tmp = newEl({'type':'span', 'class':'task-tomorrow', 'text':'\u25b8', 'title':'Send to tomorrow'}, tactions);
		tmp.onclick = function (e) { }.bind(this);
		tmp = newEl({'type':'span', 'class':'task-link', 'text':'Done', 'title':'Mark as complete'}, tactions);
		tmp.onclick = function (e) { }.bind(this);
		*/
	},

	/*
	 * Display "No tasks" text if none exist for the day
	 */
	showNoTasks: function () {
		var tbox = $('tasks_box');

		var notasks = true;
		for (var i=0; i<tbox.childNodes.length; i++) {
			if (checkAttr(tbox.childNodes[i], 'taskid')) {
				notasks = false;
				i = tbox.childNodes.length;
			}
		}

		if (notasks) {
			var ntb = newEl({'type':'div', 'id':'no-tasks-box', 'text':'No tasks yet!'});
			tbox.insertBefore(ntb, tbox.lastChild);
		} else {
			if ($('no-tasks-box')) {
				tbox.removeChild($('no-tasks-box'));
			}
		}
	},

	/*
	 * Shows the focus indicator on a task
	 * @param mixed JS event | HTML element
	 */
	selectTask: function (e) {
		var newtask = findTarget(e, 'div', 'taskid');
		if (!newtask && checkAttr(e, 'taskid')) { newtask = e; }

		/*
		// hide task actions
		var tactions = $('tasks_actions');
		tactions.style.display = 'none';
		*/
		
		// check if we need to even do anything
		if (this.selectedTask && this.selectedTask == newtask) { return false; }

		// unselect the existing task
		if (this.selectedTask) {
			// remove the class
			this.selectedTask.removeClass('selected');

			// unlselect here incase there is not newtask (we want to unselect)
			this.selectedTask = null;
		}

		// basic checks
		if (newtask && checkAttr(newtask, 'taskid')) {
			// select the next task
			newtask.addClass('selected');
			this.selectedTask = newtask;

			/*
			// show task actions
			var coor = newtask.getCoordinates();
			tactions.style.display = '';
			tactions.setPosition({'x':coor['left'], 'y':coor['bottom']});
			*/
		}

		return true;
	},

	/*
	 * Save task order
	 */
	saveTasksOrder: function (e) {
		var tbox = $('tasks_box');
		var tasks = [];

		var task = taskid = null;
		var priority = 1;
		for (var i=0; i<tbox.childNodes.length; i++) {
			task = tbox.childNodes[i];
			if (!checkAttr(task, 'taskid')) { continue; }
			taskid = task.getAttribute('taskid').toInt();
			if (taskid == 0) { continue; }

			tasks.push({'taskid':taskid, 'priority':priority});
			priority++;
		}

		// make the request to save
		that = this;
		var postData = {'feat':'Tasks', 'command':'saveTaskOrder', 'tasks':tasks}; 
		new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			// handle response
			if (!r) { return; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) { return false; }

			// show save success
			$('tasks_box').addClass('success');
			setTimeout((function(){$('tasks_box').removeClass('success');}), 250);

			if (that.selectedTask) {
				findChild(that.selectedTask, 'input').focus();
			}
		}}).send();

		return true;
	},

	/*
	 * Saves task information
	 * @param mixed JS event | HTML element
	 */
	saveTask: function (e) {
		var task = findTarget(e, 'div', 'taskid');
		if (!task && checkAttr(e, 'taskid')) { task = e; }
		if (!task || !checkAttr(task, 'taskid')) { return false; }
		
		// get task info
		var tasktxt = trim(findChild(task, 'input').value);
		var taskid = task.getAttribute('taskid');
		var expected = task.getAttribute('expected');
		var completed = task.getAttribute('completed');

		// find task priority
		var priority = 1;
		var tbox = $('tasks_box');
		for (var i=0; i<tbox.childNodes.length; i++) {
			if (checkAttr(tbox.childNodes[i], 'taskid')) {
				// if this is the task, we have our priority
				if (task == tbox.childNodes[i]) {
					i = tbox.childNodes.length;				
				} else {
					priority++;
				}
			}
		}
 
		// make the request to save
		that = this;
		var postData = {'feat':'Tasks', 'command':'saveTask', 'task':{'taskid':taskid, 'task':tasktxt, 'expected':expected, 'completed':completed, 'priority':priority}};
		new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			// handle response
			if (!r) { return; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) {
				// if we had an error, display the task again
				task.style.display = '';

				return false;
			}

			// save the task id for new tasks
			if (isNumeric(resp['task']['taskid'])) {
				task.setAttribute('taskid', resp['task']['taskid']);
			}

			// if the task is completed set the class 
			if (task.getAttribute('completed').toInt() == 1 && !task.hasClass('completed')) { task.addClass('completed'); } 
			// if the task is uncompleted remove the class 
			else if (task.getAttribute('completed').toInt() == 0 && task.hasClass('completed')) { task.removeClass('completed'); } 

			// update the tooltip
			if (tasktxt.length > 50) { findChild(task, 'input').value = tasktxt; }

			// if it saved properly and the task is currently hidden, remove it
			if (task.style.display == 'none') {
				task.parentNode.removeChild(task);
				if (that.selectedTask == task) { that.selectedTask = null; }
			}
 
			// show save success
			task.addClass('success');
			setTimeout((function(){task.removeClass('success');}), 250);
		}}).send();

		return;
	},

	/*
	 * Deletes a task
	 * @param mixed JS event | HTML element
	 */
	deleteTask: function (e) {
		var task = findTarget(e, 'div', 'taskid');
		if (!task && checkAttr(e, 'taskid')) { task = e; }
		if (!task || !checkAttr(task, 'taskid')) { return false; }
		
		// get task info
		var taskid = task.getAttribute('taskid');

		if (taskid  == 0) {
			task.parentNode.removeChild(task);
			return;
		}

		// hide while we are saving
		task.style.display = 'none';

		// make the request to delete
		that = this;
		var postData = {'feat':'Tasks', 'command':'deleteTask', 'taskid':taskid};
		new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
			// handle response
			if (!r) { return; }
			var resp = JSON.decode(r);
			if (!handleResponse(resp)) {
				// if we had an error, display the task again
				task.style.display = '';

				return false;
			}

			// unselect the task if needed
			if (that.selectedTask == task) { that.selectedTask = null; }

			// if it saved properly and the task is currently hidden, remove it
			if (task.style.display == 'none') { task.parentNode.removeChild(task); }

			// show save success
			$('tasks_box').addClass('success');
			setTimeout((function(){$('tasks_box').removeClass('success');}), 250);
		}}).send();

		return;
	},

	/*
	 * Sets focus on top most checkbox
	 */
	focusTopCheckbox: function (e) {
		// focus on the first visible checkbox
		var lc = $('email_list');
		var listscroll = lc.getScroll();
		var email_num = 0;
		if (listscroll['y'] > 60) { email_num = Math.floor(listscroll['y'] / 60); }
		if (lc.childNodes.length >= email_num) {
			try { lc.childNodes[email_num].childNodes[1].firstChild.focus(); } catch (err) {}
		} else {
			try { lc.lastChild.childNodes[1].firstChild.focus(); } catch (err) {}
		} 

		return true;
	},
 
	/*
	 * Toggle the box in the right column
	 */
	toggleRightColumn: function (view) {
		$('default_actions').style.display = 'none';
		$('selected_actions').style.display = 'none';
		$('email_viewer').style.display = 'none';

		switch (view) {
		case 'default_actions':
			$('default_actions').style.display = '';
			this.setShortcuts('list');
			try { document.body.scrollLeft = 0; } catch (err) {}
			try { document.documentElement.scrollLeft = 0; } catch (err) {}

			this.getWeather();
			this.focusTopCheckbox();

			break;

		case 'selected_actions':
			$('selected_actions').style.display = '';
			this.setShortcuts('list');
			this.scrollToLeft(0);
			break;

		case 'email_viewer':
			$('email_viewer').style.display = '';
			this.setShortcuts('view');
			this.scrollToLeft(400);
			break;

		case 'email_compose':
			$('email_viewer').style.display = '';
			this.setShortcuts('compose');
			this.scrollToLeft(400);
			break;

		case 'email_respond':
			$('email_viewer').style.display = '';
			this.setShortcuts('respond');
			this.scrollToLeft(400);
			break;

		case 'contacts':
			$('default_actions').style.display = '';
			this.setShortcuts('contacts');
			this.scrollToLeft(0);
			break;
 
		case 'tasks':
			$('default_actions').style.display = '';
			this.setShortcuts('tasks');
			this.scrollToLeft(400);
			break;
 
		case 'search':
			$('default_actions').style.display = '';
			this.setShortcuts('search');
			this.scrollToLeft(0);
			$('search_isflagged').focus();
			break;
  
		case 'smart':
			if (this.choosenEmail) {
				this.toggleRightColumn('email_viewer');
			} else if (this.selectedMessagesNum > 0) {
				this.toggleRightColumn('selected_actions');
			} else if ($('search_emails_box').style.display != 'none') {
				this.toggleRightColumn('search');
			} else {
				this.toggleRightColumn('default_actions');
			}
			break;

		default:
			break;
		}
	},

	/*
	 * Scroll left amt pixels
	 * @param int (number of pixels to scroll)
	 */
	scrollToLeft: function (amt) {
		if (!isInt(amt)) { amt = 0; }
		try { document.body.scrollLeft = amt; } catch (err) {}
		try { document.documentElement.scrollLeft = amt; } catch (err) {}
	},
 
	/*
	 * Handles the hiding of folder list on mouseout 
	 */
	blurFolderMenu: function (e) {
		this.blurFoldersTimeoutID = (function () { $('set_folder').style.display = 'none'; }).delay(500, this);
	},

	/*
	 * Handles the hiding of attachments list on mouseout 
	 */
	blurAttachmentsMenu: function (listbox) {
		this.attachmentsListTimeoutID = (function () { listbox.style.display = 'none'; }).delay(500, this);
	}
});

// callback when sending emails
function sentEmailHandler(r) {
	handleResponse(r);
	myTWIG.toggleRightColumn('smart');
} 
