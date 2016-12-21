<?

include_once(SE\BASE_DIR. '/config/config.php');
include_once(SE\BASE_DIR. '/lib/common.php');
include_once(SE\BASE_DIR. '/lib/class.db.php');

/*
 * Class to help respond to HTTP request for web pages
 */
class HTTPRequest {
	public $pageTitle = SE\APP_TITLE;
	protected $responseType = 'html'; // to be used later
	protected $featureName = null; // contains the page expected to be loaded
	protected $subFeature = null; // contains the command expected to be executed
	protected $response = null; // contains info for ajax request

	function __construct($type='html') {
		$this->responseType = $type;
		$this->featureDir = ($type == 'json')?SE\BASE_DIR .'/ajax/':SE\BASE_DIR .'/features';

		if (isset($_GET['feat'])) { $this->featureName = $_GET['feat']; }
		else if (isset($_POST['feat'])) { $this->featureName = $_POST['feat']; }
		else { $this->featureName = ''; }

		if (isset($_GET['command'])) { $this->subFeature = $_GET['command']; }
		else if (isset($_POST['command'])) { $this->subFeature = $_POST['command']; }
		else { $this->subFeature = ''; }
	}

	/*
	 * Sets the response type
	 * @param string $type
	 */
	public function setResponseType($type) { $this->responseType = $type; }

	/*
	 * Sets response object (for AJAX calls)
	 */
	public function setResponse($response) { $this->response = $response; }

	/*
	 * Gets response object (for AJAX calls)
	 */
	public function getResponse() { return $this->response; } 

	/*
	 * Verify that a valid session exists
	 * @return bool true on success false on error
	 */
	public function checkSession() {
		if (isset($_SESSION['app_title']) && $_SESSION['app_title'] == SE\APP_TITLE) { return true; }

		header('Location:' .SE\LOGIN_URL);

		return false;
	}

	/*
	 * Checks if a user has any of a given set of permissions
	 * @param array $permissions
	 * @param bool $kickout
	 * @return bool true on success false on failure
	 */
	public function checkPermissions($permissions, $kickout=true) {
		if (!is_array($permissions)) {
			if ($kickout) { error_log('Kicking out because permissions is not an array'); exit(); }
			return false;
		}

		if (!isset($_SESSION)) {
			if ($kickout) { error_log('Kicking out because SESSION does not exist'); exit(); }
			return false;
		}

		if (!isset($_SESSION['current_company'])) {
			//error_log(print_r($_SESSION, true));
			if ($kickout) { error_log('Kicking out because SESSION does not contain company data'); exit(); }
			return false;
		}

	    $company = $_SESSION['current_company'];
    	if (!is_array($_SESSION['userperms'][$company]) || !is_array($permissions)) {
			if ($kickout) { error_log('Kicking out because values are not arrays'); exit(); }
			return false;
		}

		// do the actual check
    	if (count(array_diff($permissions, $_SESSION['userperms'][$company])) < count($permissions)) { return true; }

		// obviously the above check did not go through
		if ($kickout) { error_log('Kicking out because of permissions'); exit(); }
    	return false;
	}

	/*
	 * Start writing HTML
	 */ 
	public function writeHTMLHeader() {
		$mypage_title = $this->pageTitle;

		include_once(SE\BASE_DIR. '/header.php');
	}

	/*
	 *
	 */
	public function writeMenu() {
		if (!isset($_SESSION['menu_html'])) {
			$this->getMenuStr();
		}

		echo $_SESSION['menu_html'];
	}
 
	/*
	 * Load the actual feature we want or default to something
	 */ 
	public function loadFeature() {
		//
		// Set subfeature
		//
		$featcmd = $this->subFeature;
		$response = $this->response;
		$http_request = $this;

		//
		// Verify that the feature actually exists
		//
		if ($this->featureName && is_file($this->featureDir. '/' .$this->featureName. '.php')) {
			include_once($this->featureDir. '/' .$this->featureName. '.php');
		} else {
			include_once($this->featureDir. '/blank.php');
		}

		$this->response = $response;
	}
 
	/*
	 * Finish writing HTML
	 */ 
	public function writeHTMLFooter() {
		include_once(SE\BASE_DIR. '/footer.php');
	}
		
	/*
	 * Builds the menu string
	 */
	protected function getMenuStr() {
		//
		// get the menu list based on permissions
		//
	    $query = 'SELECT f.name, f.link, f.parent_name, r.role_id, wc.company_id, c.name AS cname ';
	    $query .= 'FROM rolegroup_roles AS rgr, permissions AS p, workgroup_companies AS wc, companies AS c, roles AS r LEFT OUTER JOIN features AS f on r.feature_id = f.feature_id ';
	    $query .= 'WHERE p.user_id = ' .$_SESSION['vid']. ' AND p.workgroup_id = wc.workgroup_id AND wc.company_id = c.company_id AND c.active = 1 AND p.rolegroup_id = rgr.rolegroup_id AND rgr.role_id = r.role_id';
	    $result = DB::query($query);
	     
	    $perms = array();
	    $cnames = array();
	    $menu = array();
	    
	    if ($result->num_rows == 0) {
			return false;
		}
	        
	    while ($row = DB::getRow($result)) {
	        // fill the perms array
	        $perms[$row['company_id']][] = $row['role_id'];
	        
	        // get company names
	        $cnames[$row['company_id']] = $row['cname'];
	    }
	}
}
