<?

include_once('config/config.php');
include_once(SE\BASE_DIR. '/lib/class.httpRequest.php');

session_set_cookie_params(SE\SESS_LIFE, SE\SESS_PATH, SE\SESS_DOMAIN);
session_start();

$http_request = new HTTPRequest();

/*
 * Verify that this is a valid session
 */
$http_request->checkSession();

/*
 * Load header (check auth, includes, start HTML)
 */
$http_request->writeHTMLHeader();

/*
 * Load the actual feature we want or default to something
 */
$http_request->loadFeature();

/*
 * Load the footer (footer JS, end HTML)
 */
$http_request->writeHTMLFooter();

?>
