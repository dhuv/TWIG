<?

$http_request->checkPermissions(array(102));

include_once(SE\BASE_DIR. '/lib/class.weather.php');
try { $wo = new twigWeather(); } catch (Exception $e) {
    $response['status'] = 0;
    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error initializing weather object';
    $featcmd = 'none';
}

switch ($featcmd) {
case 'searchLocations':
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
		$response['locations'] = $wo->searchLocations($criteria);
	} catch (Exception $e) {
        $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error searching for locations';
        $response['status'] = 0;
        break;
    }
   
    $response['status'] = 1;
    break;

case 'getForecast':
	if (!isset($_POST['location'])) { 
        $response['error'] = 'Location not specified';
        $response['status'] = 0;
        break;
    }

	// unblock session if request to ext servers takes time
	session_write_close();

    $location = $_POST['location'];
	try {
		$winfo = $wo->getForecast($location);
		$response['sun'] = $winfo['sun'];
		$response['utcoffsetmins'] = $winfo['utcoffsetmins'];
		$response['forecast'] = $winfo['forecast'];
		$response['city'] = $winfo['city'];
		$response['state'] = $winfo['state'];
		$response['country'] = $winfo['country'];
    } catch (Exception $e) {
	    $response['error'] = ($e->getCode() == 1001)?$e->getMessage():'Error getting forecast';
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
