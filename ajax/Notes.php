<?

$http_request->checkPermissions(array(102));

include_once(SE\BASE_DIR. '/lib/class.notes.php');
try { $no = new twigNotes(); } catch (Exception $e) {
    $response['status'] = 0;
    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error initializing note object';
    $featcmd = 'none';
}

switch ($featcmd) {
case 'searchNotes':
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
		$response['notes'] = $no->searchNotes($criteria);
	} catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error searching for notes';
        $response['status'] = 0;
        break;
    }
   
    $response['status'] = 1;
    break;

case 'getNote':
	if (!isset($_POST['noteid'])) { 
        $response['error'] = 'Note ID not specified';
        $response['status'] = 0;
        break;
    }

	if (!is_numeric($_POST['noteid'])) { 
        $response['error'] = 'Invalid note ID specified';
        $response['status'] = 0;
        break;
    }

    $noteid = intval($_POST['noteid']);
	try {
		$response['note'] = $no->getNote($noteid);
    } catch (Exception $e) {
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error getting note';
    	$response['status'] = 0;
        break;
	}
 
    $response['status'] = 1;
	break;

case 'saveNote':
	if (!isset($_POST['note'])) {
        $response['error'] = 'Note info not specified';
        $response['status'] = 0;
        break;
	}

	if (!is_array($_POST['note'])) { 
        $response['error'] = 'Invalid note info specified';
        $response['status'] = 0;
        break;
    }

	$note = $_POST['note'];
	if (!isset($note['noteid'])) {
        $response['error'] = 'Note ID not specified';
        $response['status'] = 0;
        break;
	}

	$noteid = $note['noteid'];

	if (!is_numeric($noteid)) { 
        $response['error'] = 'Invalid note ID specified';
        $response['status'] = 0;
        break;
    }

	try {
		if ($note['noteid'] == 0) { 
			$response['note'] = $no->addNote($note);
		} else {
			$response['note'] = $no->editNote($note);
		}
    } catch (Exception $e) {
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error saving note';
    	$response['status'] = 0;
        break;
	}
 
	$response['status'] = 1;
	break;

case 'deleteNote':
	if (!isset($_POST['noteid'])) { 
        $response['error'] = 'Note ID not specified';
        $response['status'] = 0;
        break;
    }

	if (!is_numeric($_POST['noteid'])) { 
        $response['error'] = 'Invalid note ID specified';
        $response['status'] = 0;
        break;
    }

    $noteid = intval($_POST['noteid']);
	
	try {
		$no->deleteNote($noteid);
    } catch (Exception $e) {
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error deleting note';
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
