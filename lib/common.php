<?

/*
 * Sends an alert to a user (email/text)
 */
function alert_user() {

}

/*
 * Logs a message
 */
function to_log ($log_string) {
	global $feat, $featcmd;

    $ts = time();

    error_log($ts.' Feature = "' .$feat. '" Command = "' .$featcmd. '" '.$log_string."\n", 3, SE\ERROR_LOG);
}

/*
 * Finds the static (JS/CSS) file to be used
 * @param string (relative directory from basedir)
 * @param string (basename of file)
 * @return string (filename)
 */
function find_static_file ($reldir, $file) {
	$fullpath = SE\BASE_DIR .'/' .$reldir. '/' .$file;
	if (!is_file($fullpath)) {
		error_log('Could not find static file "' .$fullpath. '"');
		return false;
	}

	$cmd = 'ls -t ' .SE\BASE_DIR .'/' .$reldir. '/*' .$file. ' | head -1';
	exec ($cmd, $output, $retval);

	if ($retval > 0) {
		error_log('Error getting static file info with "' .$cmd. '", return val = "' .$retval. '"');
		return $file;
	} else if (count($output) == 0) {
		return $file;
	}

	return basename(trim($output[0]));
}

/*
 * Check feature for the current company
 * @param array (required roles)
 * @param bool
 */
/*
function allow_feature($requiredRoles) {
    if (!isset($_SESSION) || !isset($_SESSION['userperms']) || !is_array($_SESSION['userperms'][$_SESSION['current_company']]) || !is_array($requiredRoles)) {
		error_log('Invalid request, exiting');
		exit();
	}
    if (count(array_diff($requiredRoles, $_SESSION['userperms'][$_SESSION['current_company']])) < count($requiredRoles)) { return true; }
   
    exit();
}   
    
function check_permissions($requiredRoles, $company=false) {
    if ($company == false) { $company = $_SESSION['current_company']; }
    if (!is_array($_SESSION['userperms'][$company]) || !is_array($requiredRoles)) { return false; }
    if (count(array_diff($requiredRoles, $_SESSION['userperms'][$company])) < count($requiredRoles)) { return true; }
    return false;
}
*/

/*
 * Checks if string is a valid email address
 * @param string
 * @return bool
 */
function validEmailAddress ($email='') {
    $email = trim($email);
    if (strlen($email) == 0) { return false; }

    if (preg_match('/^[a-z0-9][a-z0-9.\\\+-_=\']+@[a-z0-9._-]+\.[a-z0-9]{2,4}$/i', $email)) {
        return true;
    } else {
        return false;
    }
}

/*
 * Parses out the name and email from a string
 * @param string
 * @return array {name:'', email:''}
 */
function parseEmailAddress($eaddr) {
    $einfo = array('name'=>'', 'email'=>iconv_mime_decode(trim($eaddr), 0, 'UTF-8'));

    if (preg_match('/[\'"](.*)[\'"]\s<(.*)>/', $einfo['email'], $matches)) { // "John Doe" <john@doe.com>
        $einfo['name'] = trim($matches[1]);
        $einfo['email'] = trim($matches[2]);
    } else if (preg_match('/(.*)\s<(.*)>/', $einfo['email'], $matches)) { // John Doe <john@doe.com>
        $einfo['name'] = trim($matches[1]);
        $einfo['email'] = trim($matches[2]);
    } else if (preg_match('/<(.*)>/', $einfo['email'], $matches)) { // <john@doe.com>
        $einfo['name'] = '';
        $einfo['email'] = trim($matches[1]);
    }

    if (validEmailAddress ($einfo['email'])) {
        return $einfo;
    } else {
        return false;
    }
}

/*
 * Takes a string filled with email addresses and returns valid emails
 * @param string $emails
 * @param string [optional] (regular expression string)
 * @param array [email1@domain.com, email2@domain2.com]
 */
function getEmailAddresses($emails, $splitreg='/[,;\s]+/') {
    $valid_emails = array();

    if (!is_string($emails) || strlen(trim($emails)) == 0) { return $valid_emails; }

    // split the string by , or ;
    $email_list = preg_split ($splitreg, trim($emails));

    foreach ($email_list as $email_address) {
        $email_info = parseEmailAddress($email_address);

        if ($email_info) {
            $valid_emails[$email_info['email']] = $email_info['name'];
        }
    }

    return $valid_emails;
}

?>
