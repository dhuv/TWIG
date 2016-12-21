<?

$http_request->checkPermissions(array(102));

include_once(SE\BASE_DIR. '/lib/class.users.php');
try { $uo = new twigUsers(); } catch (Exception $e) {
    $response['status'] = 0;
    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error initializing users object';
    $featcmd = 'none';
}

switch ($featcmd) {
case 'searchusers':
	if (!isset($_POST['criteria'])) {
        $response['error'] = 'Search criteria not specified';
        $response['status'] = 0;
        break;
	}

    $criteria = $_POST['criteria'];
    if (!is_array($criteria)) {
        $response['error'] = 'Invalid format for search criteria';
        $response['status'] = 0;
        break;
    }

	try {
		$response['users'] = $uo->searchUsers($criteria);
	} catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error searching for users';
        $response['status'] = 0;
        break;
    }
   
    $response['status'] = 1;
    break;

case 'getUser':
	if (!isset($_POST['userid'])) { 
        $response['error'] = 'User ID not specified';
        $response['status'] = 0;
        break;
    }

	if (!is_numeric($_POST['userid'])) { 
        $response['error'] = 'Invalid user ID specified';
        $response['status'] = 0;
        break;
    }

    $userid = intval($_POST['userid']);
	$response['user'] = $uo->getUser($userid);

    $response['status'] = 1;
	break;

case 'saveUser':
	if (!isset($_POST['user'])) {
        $response['error'] = 'User info not specified';
        $response['status'] = 0;
        break;
	}

	if (!is_array($_POST['user'])) { 
        $response['error'] = 'Invalid user info specified';
        $response['status'] = 0;
        break;
    }

	$user = $_POST['user'];
	if (!isset($user['userid'])) {
        $response['error'] = 'User ID not specified';
        $response['status'] = 0;
        break;

	}

	$userid = $user['userid'];

	if (!is_numeric($userid)) { 
        $response['error'] = 'Invalid user ID specified';
        $response['status'] = 0;
        break;
    }

	try {
		if ($user['userid'] == 0) { 
			$response['user'] = $uo->addUser($user);
		} else {
			$response['user'] = $uo->editUser($user);
		}
    } catch (Exception $e) {
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error saving user';
    	$response['status'] = 0;
        break;
	}
 
	$response['status'] = 1;
	break;

case 'deleteUser':
	if (!isset($_POST['userid'])) { 
        $response['error'] = 'User ID not specified';
        $response['status'] = 0;
        break;
    }

	if (!is_numeric($_POST['userid'])) { 
        $response['error'] = 'Invalid user ID specified';
        $response['status'] = 0;
        break;
    }

	try {
	    $userid = intval($_POST['userid']);
		$uo->deleteUser($userid);
    } catch (Exception $e) {
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error deleting user';
    	$response['status'] = 0;
        break;
	}
 
    $response['status'] = 1; 
	break;

case 'changePassword':
	if (!isset($_POST['oldpass'])) { 
        $response['error'] = 'Old password not specified';
        $response['status'] = 0;
        break;
    }

	if (!isset($_POST['newpass'])) { 
        $response['error'] = 'New password not specified';
        $response['status'] = 0;
        break;
    }

	$user = $_SESSION['vuser'];
	$userid = $_SESSION['vid'];
	$oldpass = $_POST['oldpass'];
	$newpass = $_POST['newpass'];

	// confirm the old password
	try {
		if ($uo->authenticate($user, $oldpass) === false) {
			$response['error'] = 'Incorrect password specified';
			$response['status'] = 0;
			break;
		}
    } catch (Exception $e) {
		error_log('Error authenticating. Status = "' .$uo->statusMessage(). '"');
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error confirming old password';
    	$response['status'] = 0;
        break;
	}

	// set the new password
	try {
		$uo->resetPassword($_SESSION['vid'], $newpass, false);
    } catch (Exception $e) {
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error resetting password';
    	$response['status'] = 0;
        break;
	}

	$_SESSION['vpass'] = $newpass;

    $response['status'] = 1;  
	break;

case 'getSettings':
	$labels = (isset($_POST['labels']) && count($_POST['labels']))?$_POST['labels']:null;

	try {
 		$response['settings'] = $uo->getUser($labels);
    } catch (Exception $e) {
		if ($e->getCode() != 1001) { error_log($e->getMessage()); }
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error gettings settings';
    	$response['status'] = 0;
        break;
	}

    $response['status'] = 1; 	
	break;

case 'saveSettings':
	if (!isset($_POST['settings'])) {
        $response['error'] = 'Settings not specified';
        $response['status'] = 0;
        break;
	}

	if (!is_array($_POST['settings'])) { 
        $response['error'] = 'Invalid settings info specified';
        $response['status'] = 0;
        break;
    }
 
	try {
		$settings = $_POST['settings'];
 		$response['settings'] = $uo->saveSettings($settings);
    } catch (Exception $e) {
		if ($e->getCode() != 1001) { error_log($e->getMessage()); }
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error saving settings';
    	$response['status'] = 0;
        break;
	}

    $response['status'] = 1; 	 
	break;

case 'resetPassword':
	break;

default:
    $response['error'] = 'Undefined request "' .$featcmd. '"';
    break;
}

?>
