var weatherSuggest = new Class({
	Extends: seSuggest,
    Implements: Options,

	initialize: function (options) {
		options['suggestinbody'] = true;
		options['suggestionsLocation'] = 'input';
		options['allowUserBits'] = false;
		options['defaultMessage'] = 'Type City or State';
		this.parent(options);
	},

    /*
     * Checks if there is cached data for suggestions for this search
     * @param string search
     */
    useCachedSuggestions: function (search) {
		if (search.length < 4) { return false; }

		this.parent(search);
	},

    /*
     * Make the request to get suggestions
     * @param string (search text)
     * @param int (offset)
     */
	makeRequest: function (search, offset) {
		if (search.length < 3) { return; }

		// make the service request
		var that = this;
		var postData = {'feat':'Weather', 'command':'searchLocations', 'criteria':{'city':search, 'state':search}};
		new Request({method:'post', url:'ajax.php', 'data':postData, 'onComplete': function (r) {
            // handle response
            if (!r) { alert('An error occurred getting the list of locations "'+ r +'"'); return false; }
            var resp = JSON.decode(r);
			var locations = resp['locations'];

            var suggestions = [];
            for (var i=0; i<locations.length; i++) {
                suggestions.push({'key':locations[i]['place'], 'value':locations[i]['city'] +', '+ locations[i]['state']});
            }

            that.remoteSuggestions = suggestions;
            that.showSuggestions(suggestions);
		}}).send();
	},

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

	/*
	 * Called when something has changed
	 * @param string (removed|added)
	 */
	changed: function (action) {
	}
});
