<?

$http_request->checkPermissions(array(102));

?>

<link rel="stylesheet" type="text/css" href="css/<? echo find_static_file('css', 'twig.css'); ?>">
<script type="text/javascript" src="javascript/<? echo find_static_file('javascript', 'twig.js'); ?>"></script>
<script type="text/javascript" src="javascript/<? echo find_static_file('javascript', 'shortcuts.js'); ?>"></script>
<script type="text/javascript" src="javascript/<? echo find_static_file('javascript', 'menu.js'); ?>"></script>
<script type="text/javascript" src="javascript/<? echo find_static_file('javascript', 'autosuggest.js'); ?>"></script>
<script type="text/javascript" src="javascript/<? echo find_static_file('javascript', 'email-suggest.js'); ?>"></script>
<script type="text/javascript" src="javascript/<? echo find_static_file('javascript', 'weather-suggest.js'); ?>"></script>

<div id="left_column">
	<div id="folders_list">
		<div id="current_folder">Loading...</div>
		<div id="set_folder" fullpath="" style="display:none"></div>
	</div>

	<div id="email_list"></div>
</div>

<div id="right_column">
	<div id="default_actions">
		<div id="tasks_box" style="display:none;"></div>
		<div class="act_title">Available Actions</div>
		<div id="folder_details"></div>
		<div id="default_options"></div>
		<div id="weather_info"></div>
	</div>

	<div id="selected_actions" style="display:none;">
		<div class="act_title"><div id="num_emails_selected"></div></div>
		<div id="selected_options"></div>
	</div>

	<div id="email_viewer" style="display:none;"> </div>
</div>

<div id="change_folder_box" style="display:none;">
	<div id="change_folder_input_box">
		<input type="text" id="change_folder_input" />
	</div>

	<div id="change_folder_list_box">
	</div>
</div>

<div id="manage_folders_box" style="display:none;"></div>
 
<div id="contacts_box" style="display:none;"></div> 

<div id="notes_box" style="display:none;"></div>

<div id="settings_box" style="display:none;"></div>

<div id="weather_box" style="display:none;"></div>

<div id="help_box" style="display:none;">
	<span class="xlink" id="close_help_lnk" title="Esc to close">&times;</span>

	<div class="scroller">
		<div class="section_title first">Shortcuts</div>
		<div class="shortcut_section">Email List</div>
		<div class="shortcut"><span class="shortcut_key">c</span><span>Compose a new email (Esc to cancel)</span></div>
		<div class="shortcut"><span class="shortcut_key">f</span><span>Switch folders quickly  (Esc to cancel)</span></div>
		<div class="shortcut"><span class="shortcut_key">s</span><span>View email search (Enter to search, Esc to cancel)</span></div>
		<div class="shortcut"><span class="shortcut_key">n</span><span>View notes</span></div>
		<div class="shortcut"><span class="shortcut_key">1</span><span>View top email in the list</span></div>
		<div class="shortcut"><span class="shortcut_key">w</span><span>View 10 day weather</span></div>
		<div>&nbsp;</div> <div>&nbsp;</div> <div>&nbsp;</div> <div>&nbsp;</div>
		<div class="shortcut_section">Viewing Email</div>
		<div class="shortcut"><span class="shortcut_key">j</span><span>Go to previous email (down)</span></div>
		<div class="shortcut"><span class="shortcut_key">k</span><span>Go to next email (up)</span></div>
		<div class="shortcut"><span class="shortcut_key">r</span><span>Reply</span></div>
		<div class="shortcut"><span class="shortcut_key">a</span><span>Reply to All</span></div>
		<div class="shortcut"><span class="shortcut_key">f</span><span>Forward</span></div>
		<div class="shortcut"><span class="shortcut_key">t</span><span>Send to Trash</span></div>
		<div class="shortcut"><span class="shortcut_key">s</span><span>Mark as Spam</span></div>
    	<div class="shortcut"><span class="shortcut_key">Esc</span><span>Go back to Email List view</span></div>
		<div>&nbsp;</div> <div>&nbsp;</div> <div>&nbsp;</div> <div>&nbsp;</div> <div>&nbsp;</div> <div>&nbsp;</div>
		<div class="shortcut_section">Contacts/Notes/Settings/Help</div>
    	<div class="shortcut long"><span class="shortcut_key">Esc</span><span>Closes the modal box (unless you have a contact or note in edit mode)</span></div> 

		<div style="clear:both;">&nbsp;</div>
 
		<div class="section_title">FAQs</div>
		<div class="question">
			<span class="char">Q</span>
			<span class="text">Why the change?</span>
		</div>
		<div class="answer">
			<span class="char">A</span>
			<ul class="text">
				<li>Usability and aesthetics improvements</li>
				<li>Better handling of HTML emails (viewing and editing)</li>
				<li>Better compatibility with newer browsers (tablets and phones)</li>
			</ul>
		</div>

 		<div class="question">
			<span class="char">Q</span>
			<span class="text">Why are the scrollbars so thin in Chrome/Safari?</span>
		</div>
		<div class="answer">
			<span class="char">A</span>
			<span class="text">Most devices allow scrolling (mouse, trackpad, touchscreen). You can always use the arrow or page up/down keys.</span>
		</div>

 		<div class="question">
			<span class="char">Q</span>
			<span class="text">What about features or bugs?</span>
		</div>
		<div class="answer">
			<span class="char">A</span>
			<span class="text">Contact me about it.</span>
		</div>
 		<div class="question">
			<span class="char">Q</span>
			<span class="text">How do I setup my phone?</span>
		</div>
		<div class="answer">
			<span class="char">A</span>
			<span class="text">Email Type: IMAP</span><br/>
			<span class="text">Incoming/Outgoing Server: secure.consoe.com</span><br/>
			<span class="text">Use SSL: {Yes}</span><br/>
			<span class="text">Incoming Server Port: 993</span><br/>
			<span class="text">Outgoing Server Port: 587</span><br/>
			<span class="text">Username: {Your Webmail Login}</span><br/>
			<span class="text">Outgoing Authentication: Password</span><br/>
		</div>
		<div class="answer">
	</div>
</div>

<div id="folders_box" style="display:none;"></div>

<iframe id="hidframe" name="hidframe" style="width: 0px; height:0px; border:0px" frameborder="0" src="blank.php"></iframe>

<script type="text/javascript">
	var myTWIG = null;
	function twigInit() { myTWIG = new twigApp(); }
	addLoadEvent(twigInit());
</script>
