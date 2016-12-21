var emailSuggest = new Class({
	Extends: seSuggest,
    Implements: Options,

	initialize: function (options) {
		this.parent(options);
	},

    /*
     * Checks if there is cached data for suggestions for this search
     * @param string search
     */
    useCachedSuggestions: function (search) {
		if (this.remoteSearch && this.remoteSearch.length < 3 & search >= 3) { return false; }
		if (this.remoteSearch && this.remoteSearch.length >= 3 & search < 3) { return false; }

		this.parent(search);
	},

    /*
     * Make the request to get suggestions
     * @param string (search text)
     * @param int (offset)
     */
	makeRequest: function (search, offset) {
		// make the service request

		var that = this;
		var postData = {'feat':'Contacts', 'command':'searchContacts', 'criteria':{'email':'%'+ search +'%', 'firstname':'%'+ search +'%', 'lastname':'%'+ search +'%', 'andor':'OR'}};
		if (search.length < 3) { postData['criteria'] = {'email':search +'%', 'firstname':search +'%', 'lastname':search +'%', 'andor':'OR'}; }
		this.emailsuggest_request = new Request({'method':'post', 'url':'ajax.php', 'data':postData, 'onComplete': function (r) {
            // handle response
            if (!r) { alert('An error occurred getting the list of email addresses "'+ r +'"'); return false; }
            var resp = JSON.decode(r);
            if (!handleResponse(resp)) { return false; }

			var suggestions = [];

			var contacts = resp['contacts'];
			for (var i=0; i<contacts.length; i++) {
				suggestions.push({'key':contacts[i]['contactid'], 'value':contacts[i]['firstname'] +' '+ contacts[i]['lastname'] +' <'+ contacts[i]['email'] +'>'});
			}
    
        	that.remoteSuggestions = suggestions;
        	that.showSuggestions(suggestions); 
		}}).send();
	}

    /*
     * Returns the classname for a bit
     * @param array (bit info)
     * @return string (class names)
     */
    //getBitClassname: function (info) { return 'monochrome_bit'; },

    /*
     * Returns the class for a suggestion
     * @param array (suggestion info)
     * @return string (class names)
     */
    //getSuggestionClassname: function (info) { return ''; }
});
