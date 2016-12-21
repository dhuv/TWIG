<?

$http_request->checkPermissions(array(102));

include_once(SE\BASE_DIR. '/lib/class.tasks.php');
try { $no = new twigTasks(); } catch (Exception $e) {
    $response['status'] = 0;
    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error initializing task object';
    $featcmd = 'none';
}

switch ($featcmd) {
case 'searchTasks':
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
		$response['tasks'] = $no->searchTasks($criteria);
	} catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error searching for tasks';
        $response['status'] = 0;
        break;
    }
   
    $response['status'] = 1;
    break;

case 'saveTaskOrder':
	if (!isset($_POST['tasks'])) { 
        $response['error'] = 'Tasks not specified';
        $response['status'] = 0;
        break;
    }

	if (!is_array($_POST['tasks'])) { 
        $response['error'] = 'Invalid data format for tasks specified';
        $response['status'] = 0;
        break;
    }

    $tasks = $_POST['tasks'];
	
	try {
		$no->saveTaskOrder($tasks);
    } catch (Exception $e) {
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error reordering tasks';
    	$response['status'] = 0;
        break;
	}

    $response['status'] = 1;  
	break;

case 'saveTask':
	if (!isset($_POST['task'])) {
        $response['error'] = 'Task info not specified';
        $response['status'] = 0;
        break;
	}

	if (!is_array($_POST['task'])) { 
        $response['error'] = 'Invalid task info specified';
        $response['status'] = 0;
        break;
    }

	$task = $_POST['task'];
	if (!isset($task['taskid'])) {
        $response['error'] = 'Task ID not specified';
        $response['status'] = 0;
        break;
	}

	$taskid = $task['taskid'];

	if (!is_numeric($taskid)) { 
        $response['error'] = 'Invalid task ID specified';
        $response['status'] = 0;
        break;
    }

	try {
		if ($task['taskid'] == 0) { 
			$response['task'] = $no->addTask($task);
		} else {
			$response['task'] = $no->editTask($task);
		}
    } catch (Exception $e) {
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error saving task';
    	$response['status'] = 0;
        break;
	}
 
	$response['status'] = 1;
	break;

case 'deleteTask':
	if (!isset($_POST['taskid'])) { 
        $response['error'] = 'Task ID not specified';
        $response['status'] = 0;
        break;
    }

	if (!is_numeric($_POST['taskid'])) { 
        $response['error'] = 'Invalid task ID specified';
        $response['status'] = 0;
        break;
    }

    $taskid = intval($_POST['taskid']);
	
	try {
		$no->deleteTask($taskid);
    } catch (Exception $e) {
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error deleting task';
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
