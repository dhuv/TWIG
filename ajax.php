<?

include_once('config/config.php');
session_set_cookie_params(SE\SESS_LIFE, SE\SESS_PATH, SE\SESS_DOMAIN);
session_start();

include_once(SE\BASE_DIR. '/lib/class.httpRequest.php');
$http_request = new HTTPRequest('json');

/*
 * Verify that this is a valid session
 */
$http_request->checkSession();

/*
 * Response object
 */
$response = array('status'=>0);

/*
 * Set it for the class
 */
$http_request->setResponse($response);

/*
 * Load the actual feature we want or default to something
 */
$http_request->loadFeature();

/*
 * Get it from the class
 */
$response = $http_request->getResponse();
 
/*
 * handle error (remove it if empty OR convert to string)
 */
if (isset($response['error'])) { 
    if (is_array($response['error'])) {
        if (count($response['error']) == 0) {
            unset($response['error']);
        } else {
            $response['error'] = implode("\n\n", $response['error']);
        }
    } else if (is_string($response['error'])) {
        if (strlen(trim($response['error'])) == 0) {
            unset($response['error']);
        }
    }
}

if (isset($response['messages'])) {
    if (is_array($response['messages'])) {
        if (count($response['messages']) == 0) {
            unset($response['messages']);
        } else {
            $messages = implode("\n\n", $response['messages']);
            $response['messages'] = $messages;
        }
    } else if (is_string($response['messages'])) {
        if (strlen(trim($response['messages'])) == 0) {
            unset($response['messages']);
        }
    } 
}

/*
 * handle callbacks
 */
if (isset($_GET['callback']) || isset($_POST['callback'])) {
    $callback = isset($_POST['callback'])?htmlspecialchars($_POST['callback']):htmlspecialchars($_GET['callback']);
    // send the response with callback
    echo '<script type="text/javascript">' .preg_replace('/[^\w\.]/', '', $callback). '(' .json_encode($response). '); </script>';
} else {
    // send the response
    echo json_encode($response);
}


?>
