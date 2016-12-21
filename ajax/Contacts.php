<?

$http_request->checkPermissions(array(102));

include_once(SE\BASE_DIR. '/lib/class.contacts.php');
try { $co = new twigContacts(); } catch (Exception $e) {
    $response['status'] = 0;
    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error initializing contact object';
    $featcmd = 'none';
}

switch ($featcmd) {
case 'searchContacts':
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
		$organize = (isset($_POST['organize']) && $_POST['organize']);

		// we may want to try and first and or if we get no contacts
		if (isset($criteria['andor']) && $criteria['andor'] == 'or' && isset($criteria['tryandfirst']) && $criteria['tryandfirst']) {
			$criteria['andor'] = 'and';
			$response['contacts'] = $co->searchContacts($criteria, $organize);

			// if there are no contacts with and, try or
			if (count($response['contacts']) == 0) {
				$criteria['andor'] = 'or';
				$response['contacts'] = $co->searchContacts($criteria, $organize);
			}
		} else {
			$response['contacts'] = $co->searchContacts($criteria, $organize);
		}

		// getting contact info like this returns data similar to the organized format
		// only do this if the data is supposed to be organized
		if ($organize && count($response['contacts']) == 1) {
			$contact = $co->getContact($response['contacts'][0]['contactid']);
			$response['contacts'] = array($contact);
		}
	} catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error searching for contacts';
        $response['status'] = 0;
        break;
    }
   
    $response['status'] = 1;
    break;

case 'getContact':
	if (!isset($_POST['contactid'])) { 
        $response['error'] = 'Contact ID not specified';
        $response['status'] = 0;
        break;
    }

	if (!is_numeric($_POST['contactid'])) { 
        $response['error'] = 'Invalid contact ID specified';
        $response['status'] = 0;
        break;
    }

    $contactid = intval($_POST['contactid']);
	$response['contact'] = $co->getContact($contactid);

    $response['status'] = 1;
	break;

case 'saveContact':
	if (!isset($_POST['contact'])) {
        $response['error'] = 'Contact info not specified';
        $response['status'] = 0;
        break;
	}

	if (!is_array($_POST['contact'])) { 
        $response['error'] = 'Invalid contact info specified';
        $response['status'] = 0;
        break;
    }

	$contact = $_POST['contact'];
	if (!isset($contact['contactid'])) {
        $response['error'] = 'Contact ID not specified';
        $response['status'] = 0;
        break;

	}

	if (!is_numeric($contact['contactid'])) { 
        $response['error'] = 'Invalid contact ID specified';
        $response['status'] = 0;
        break;
    }

	try {
		if ($contact['contactid'] == 0) { 
			$response['contact'] = $co->addContact($contact);
		} else {
			$response['contact'] = $co->editContact($contact);
		}
    } catch (Exception $e) {
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error saving contact';
    	$response['status'] = 0;
        break;
	}
 
	$response['status'] = 1;
	break;

case 'deleteContact':
	if (!isset($_POST['contactid'])) { 
        $response['error'] = 'Contact ID not specified';
        $response['status'] = 0;
        break;
    }

	if (!is_numeric($_POST['contactid'])) { 
        $response['error'] = 'Invalid contact ID specified';
        $response['status'] = 0;
        break;
    }

    $contactid = intval($_POST['contactid']);
	try {
		$response['contact'] = $co->deleteContact($contactid);
    } catch (Exception $e) {
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error deleting contact';
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
