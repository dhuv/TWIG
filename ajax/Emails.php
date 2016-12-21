<?

$http_request->checkPermissions(array(102));

include_once(SE\BASE_DIR. '/lib/class.emails.php');
try { $io = new twigEmails(); } catch (Exception $e) {
	$response['status'] = 0;
    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error opening mailbox';
	$featcmd = 'none';
}

switch ($featcmd) {

case 'getEmails':
    $info = $_POST['info'];
    if (!is_array($info)) {
        $response['error'] = 'Range not specified';
        $response['status'] = 0;
        break;
    }

	if (isset($_POST['folder']) && $_POST['folder'] != $_SESSION['mailfolder']) {
		try {
			$io->setMailFolder($_POST['folder']);
	    } catch (Exception $e) {
    	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Could not change to folder (' .$info['folder']. ')';
        	$response['status'] = 0;
        	break;
    	}
	}

	// this feature gets emails from a given folder in the reverse order of when they came in 
	// it does not use any sorting but because we get the list in reverse of when emails came in
	// it should be sorted by date with latest emails on top
	// we need to translate 0-12 out of 100 message to 88 - 100

	// find total
	$total_msgs = $io->getTotalMessages();
	$response['totalEmails'] = $total_msgs;
	$response['folder'] = $_SESSION['mailfolder'];

	if ($total_msgs == 0) {
		$response['emails'] = array();
		$response['status'] = 1;
		break;
	}

	// make sure we are not asking to start beyond the total
	// could happen when doing get more emails
	if ($info['start'] > $total_msgs) {
		$response['error'] = 'This folder only has (' .$total_msgs. ') messages.';
		$response['status'] = 0;
		break;
	}

	// readjust start
	$info['start'] = $total_msgs - $info['start'] - $info['count'] +1;

	// handle the case where we are asking for more than we already have
	// when start is towards the end count throws it over the total
	if ($info['start'] < 1) {
		if ($info['count'] > $total_msgs) {
			$info['count'] = $total_msgs -1;
		} else {
			$info['count'] = $info['count'] + $info['start'];
		}
		$info['start'] = 1; 
	}

    try {
        $response['emails'] = $io->getHeaders(intval($info['start']), intval($info['count']));
    } catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error getting emails';
        $response['status'] = 0;
        break;
    }

    $response['status'] = 1;
	break;

case 'searchEmails':
    $criteria = $_POST['criteria'];
    if (!is_array($criteria)) {
        $response['error'] = 'Range not specified';
        $response['status'] = 0;
        break;
    }

	if (isset($_POST['folder']) && $_POST['folder'] != $_SESSION['mailfolder']) {
		try {
			$io->setMailFolder($_POST['folder']);
	    } catch (Exception $e) {
    	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Could not change to folder (' .$info['folder']. ')';
        	$response['status'] = 0;
        	break;
    	}
	}
 
    try {
        $response['emails'] = $io->searchEmails($criteria);
    } catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error searching for emails';
        $response['status'] = 0;
        break;
    }

    $response['status'] = 1; 
	break;

case 'getLatestEmails':
    if (!isset($_POST['latest_msguid'])) {
        $response['error'] = 'Message ID not specified';
        $response['status'] = 0;
        break;
    }

	// this feature gets latest messages since message X
	try {
    	$msguid = $_POST['latest_msguid'];
		$start = $io->getMsgNo($msguid);
	} catch (Exception $e) {
    	$response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error getting message number';
    	$response['status'] = 0;
	    break;
    }

	// find total
	$total_msgs = $io->getTotalMessages();
	$count = $total_msgs - $start;

	if ($total_msgs > $start) {
	    try {
        	$response['emails'] = $io->getHeaders(intval($start +1), ($count -1));
    	} catch (Exception $e) {
        	$response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error getting emails';
        	$response['status'] = 0;
    	    break;
	    }
	}

	$response['folder'] = $_SESSION['mailfolder'];
	$response['totalEmails'] = $total_msgs;
    $response['status'] = 1; 
	break;

case 'getEmail':
    $msguid = $_POST['msguid'];
    if (!$msguid) {
        $response['error'] = 'Message UID not specified';
        $response['status'] = 0;
        break;
    }

    try {
        $response['email'] = $io->getEmail($msguid);
    } catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error getting email';
        $response['status'] = 0;
        break;
    }

    $response['status'] = 1;  
	break;

case 'downloadAttachments':
	if (!isset($_POST['info'])) {
		$response['error'] = 'Download info not specified';
        $response['status'] = 0;
        break;
	}

    $info = json_decode($_POST['info'], true);
    if (!is_array($info)) {
        $response['error'] = 'Download info in invalid format';
        $response['status'] = 0;
        break;
    }
 
    if (!isset($info['msguid'])) {
        $response['error'] = 'Message UID not specified';
        $response['status'] = 0;
        break;
    }

    if (!isset($info['parts']) || !is_array($info['parts'])) {
        $response['error'] = 'Message parts not specified';
        $response['status'] = 0;
        break;
    }
 
    try {
        $response['emails'] = $io->downloadAttachments($info['msguid'], $info['parts']);
    } catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error getting attachments';
        $response['status'] = 0;
        break;
    }

    $response['status'] = 1;   
	break;

case 'viewAttachment':
	if (!isset($_GET['msguid'])) {
		$response['error'] = 'Message UID not specified';
		$response['status'] = 0;
		break;
	}

	if (!isset($_GET['part'])) {
		$response['error'] = 'Message part not specified';
		$response['status'] = 0;
		break;
	}
 
	// this method sends the image
	$io->getAttachment($_GET['msguid'], $_GET['part']);
	break;

case 'getAttachedData':
	if (!isset($_POST['msguid'])) { 
		$response['error'] = 'Message ID not specified';
        $response['status'] = 0;
        break;
	}

	if (!isset($_POST['parts'])) { 
		$response['error'] = 'Attachment ID not specified';
        $response['status'] = 0;
        break;
	}
  
	// this sends the binary data wrapped in JSON
	try {
    	$response['attachments'] = $io->getAttachmentData($_POST['msguid'], $_POST['parts']);
    } catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error getting attachments';
        $response['status'] = 0;
        break;
	}

    $response['status'] = 1;   
	break;

case 'sendEmail':
    $compose = $_POST['compose'];
    if (!is_array($compose)) {
        $response['error'] = 'Email info not specified';
        $response['status'] = 0;
        break;
    }

    try {
        $status = $io->sendEmail($compose);
		if (is_array($status)) { $response['messages'] = $status; }
    } catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error sending email;';
        $response['status'] = 0;
        break;
    }

    $response['status'] = 1;
	break;

case 'updateEmails':
    $info = $_POST['info'];
    if (!is_array($info)) {
        $response['error'] = 'Update info not specified';
        $response['status'] = 0;
        break;
    }

	if (!isset($info['msguids']) || !is_array($info['msguids'])) {
        $response['error'] = 'Emails not specified';
        $response['status'] = 0;
        break;
	}
 
	if (!isset($info['action'])) {
        $response['error'] = 'Action required but not specified';
        $response['status'] = 0;
        break;
	}
  
    try {
		if ($info['action'] == 'set') {
        	$io->setEmailFlag($info['msguids'], $info['flag']);
		} else if ($info['action'] == 'unset') {
        	$io->clearEmailFlag($info['msguids'], $info['flag']);
		} else if ($info['action'] == 'trash') {
        	if (!$io->trashEmails($info['msguids'])) {
        		$response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error sending emails to trash';
        		$response['status'] = 0;
			} else {
				$response['totalEmails'] = $io->getTotalMessages();
			}
		} else if ($info['action'] == 'spam') {
        	if (!$io->spamEmails($info['msguids'])) {
        		$response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error marking emails as spam';
        		$response['status'] = 0;
			} else {
				$response['totalEmails'] = $io->getTotalMessages();
			}
 		} else if ($info['action'] == 'delete') {
        	if (!$io->deleteEmails($info['msguids'])) {
        		$response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error deleting emails';
        		$response['status'] = 0;
			} else {
				$response['totalEmails'] = $io->getTotalMessages();
			} 
		} else {
        	$response['error'] = 'Invalid action specified';
        	$response['status'] = 0;
        	break;
		}
    } catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error updating emails';
        $response['status'] = 0;
        break;
    }

    $response['status'] = 1; 
	break;

case 'copyEmails':
    $info = $_POST['info'];
    if (!is_array($info)) {
        $response['error'] = 'Update info not specified';
        $response['status'] = 0;
        break;
    }

	if (!isset($info['msguids']) || !is_array($info['msguids'])) {
        $response['error'] = 'Emails not specified';
        $response['status'] = 0;
        break;
	}

	if (!$info['destFolder']) {
        $response['error'] = 'Destination folder not specified';
        $response['status'] = 0;
        break;
	}

    try {
        $io->copyEmails($info['msguids'], $info['destFolder']);
    } catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error copying email;';
        $response['status'] = 0;
        break;
    }

    $response['status'] = 1;
	break;

case 'moveEmails':
    $info = $_POST['info'];
    if (!is_array($info)) {
        $response['error'] = 'Update info not specified';
        $response['status'] = 0;
        break;
    }

	if (!isset($info['msguids']) || !is_array($info['msguids'])) {
        $response['error'] = 'Emails not specified';
        $response['status'] = 0;
        break;
	}

	if (!$info['destFolder']) {
        $response['error'] = 'Destination folder not specified';
        $response['status'] = 0;
        break;
	}
 
    try {
        $io->moveEmails($info['msguids'], $info['destFolder']);
		$response['totalEmails'] = $io->getTotalMessages();
    } catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error moving email;';
        $response['status'] = 0;
        break;
    }

    $response['status'] = 1; 
	break;

case 'test':
	echo '<pre>';
	/*
	// show folder list 
	$folders = $io->getFoldersList();
	echo json_encode($folders);
	*/

	/*
	// show search emails
	$headers = $io->searchEmails(array('from'=>'laju'));
	echo json_encode($headers);
	*/

	/*
	// get headers
	$headers = $io->getHeaders(19748, 100);
	echo json_encode($headers);
	*/

	//$email = $io->getEmail(25543);
	//print_r($email);

	//$htmltext = $email['html'];
	//error_log($htmltext);
	/*
    for ($i=0; $i<strlen($htmltext); $i++) {
		if (ord($htmltext{$i}) > 127) {
			if ($i - 5 > 0) { echo '"' .$htmltext{$i-5}. '" = "' .ord($htmltext{$i-5}). '"' ."\n"; }
			if ($i - 4 > 0) { echo '"' .$htmltext{$i-4}. '" = "' .ord($htmltext{$i-4}). '"' ."\n"; }
			if ($i - 3 > 0) { echo '"' .$htmltext{$i-3}. '" = "' .ord($htmltext{$i-3}). '"' ."\n"; }
			if ($i - 2 > 0) { echo '"' .$htmltext{$i-2}. '" = "' .ord($htmltext{$i-2}). '"' ."\n"; }
			if ($i - 1 > 0) { echo '"' .$htmltext{$i-1}. '" = "' .ord($htmltext{$i-1}). '"' ."\n"; }
			echo $i. '. "' .$htmltext{$i}. '" = "' .ord($htmltext{$i}). '"' ."\n";
		}
	}
	*/

	echo json_encode($io->getFoldersList(false));
	echo '</pre>';
	exit();
	break;

case 'initOptions':
	$info = array();

	$info['fullurl'] = SE\FULL_URL;
	$info['emailviewercss'] = find_static_file('css', 'emailviewer.css');
	$info['commonjs'] = find_static_file('javascript', 'common.js');
	$info['commoncss'] = find_static_file('css', 'common.css');
	$info['menujs'] = find_static_file('javascript', 'menu.js');
	$info['mootoolscorejs'] = find_static_file('javascript', 'mootools.core.js');

	$info['mbox_seperator'] = TWIG\MBOX_SEPERATOR;
	$info['sent_folder'] = TWIG\SENT_FOLDER;
	$info['folders'] = $io->getFoldersList();
	$info['from_addresses'] = $io->getFromAddresses(true);

	include_once(SE\BASE_DIR. '/lib/class.users.php');
	$uo = new twigUsers();
	$prefs = $uo->getSettings();
	if (isset($prefs['weather_locations'])) { $info['weather_locations'] = json_decode($prefs['weather_locations'], true); }
	if (isset($prefs['tasks'])) { $info['show_tasks'] = 1; }

	if (defined('TWIG\FEATURE_LINKS')) { $info['feature_links'] = json_decode(TWIG\FEATURE_LINKS, true); }

	$response['options'] = $info;
	$response['status'] = 1;

	break;

case 'updateFromAddress':
    $address = $_POST['address'];
 
    try {
        $response['from_addresses'] = $io->updateFromAddress($address);
    } catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error saving address;';
        $response['status'] = 0;
        break;
    }

    $response['status'] = 1;  
	break;

case 'createFolder':
	if (!isset($_GET['parentfolder'])) {
		$response['error'] = 'Parent folder not specified';
		$response['status'] = 0;
		break;
	}

	if (!isset($_GET['newfolder'])) {
		$response['error'] = 'New folder not specified';
		$response['status'] = 0;
		break;
	}
 
    try {
		$io->createFolder($_GET['parentfolder'], $_GET['newfolder']);
	} catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error creating folder;';
        $response['status'] = 0;
		break;
	}

    $response['status'] = 1; 
	break;
 
case 'renameFolder':
	if (!isset($_GET['folder'])) {
		$response['error'] = 'Folder not specified, could not rename';
		$response['status'] = 0;
		break;
	}

	if (!isset($_GET['newfolder'])) {
		$response['error'] = 'New folder not specified, could not rename';
		$response['status'] = 0;
		break;
	}
   
    try {
		$io->renameFolder($_GET['folder'], $_GET['newfolder']);
	} catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error renaming folder;';
        $response['status'] = 0;
		break;
	}

    $response['status'] = 1;  
	break;
 
case 'deleteFolder':
	if (!isset($_GET['folder'])) {
		$response['error'] = 'Folder not specified, could not delete';
		$response['status'] = 0;
		break;
	}
  
    try {
		$io->deleteFolder($_GET['folder']);
	} catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error deleting folder;';
        $response['status'] = 0;
		break;
	}

    $response['status'] = 1;  
	break;
 
default:
	$response['error'] = 'Undefined request "' .$featcmd. '"';
	break;
}

?>
