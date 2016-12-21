<?

/*
 * Class to manage users (authentication, management)
 */
class seUsers {
	protected $status_message = null; // contains message after authenticate
	protected $status_code = null; // contains code from (0 = good, everything else = bad)
	protected $active_codes = array('Disabled'=>0, 'Enabled'=>1, 'Pending'=>2);
	protected $user_columns = array('userid'=>'user_id', 'username'=>'username', 'firstname'=>'firstname', 'lastname'=>'lastname', 'active'=>'active', 'email'=>'email', 'homephone'=>'homephone', 'cellphone'=>'cellphone', 'street'=>'street', 'city'=>'city', 'state'=>'state', 'zip'=>'zip');
	protected $trusted_request = false;
	protected $db = null;

	function __construct() {
		$this->db = new DB();
	}

	/*
	 * Authenticates the user and does some initial stuff
	 * @param string $username
	 * @param string $password
	 * @return bool true on success false on error
	 */
	public function authenticate($username, $password) {
		return false;
	}

	/*
	 * Sets request to be trusted for Squareweave integration
	 */
	public function setTrustedRequest() {
		$this->trusted_request = true;
	}

	/*
	 * Sends authentication status code
	 * @return int $code
	 */
	public function statusCode() { return $this->status_code; }

	/*
	 * Sends authentication status message
	 * @return string $message
	 */
	public function statusMessage() { return $this->status_message; }

	/*
	 * Allows searching for users
	 * @param array $criteria (contains user attributes to search for) [username, firstname, lastname, email, active, companyid, rolegroupid]
	 * @return $users (contains basic user attributes)
	 */
	public function searchUsers($criteria) {
		// basic checks
		if (!is_array($criteria)) { throw new Exception ('Search information not provided', 1001); }
		if (!isset($criteria['username']) && !isset($criteria['firstname']) && !isset($criteria['lastname']) && !isset($criteria['email']) && !isset($criteria['companyid']) && !isset($criteria['rolegroupid'])) { throw new Exception ('Invalid search information provided', 1001); }

		// limit by company if needed
		if (!$this->isAdmin()) { $criteria['companyid'] = $_SESSION['current_company']; }

		// see if we need to filter by companies and/or rolegroupids
		$tables = 'users AS u';
		if (isset($criteria['companyid']) && is_numeric($criteria['companyid'])) { $tables .= ', permissions AS p, workgroup_companies AS wc'; }
		else if (isset($criteria['rolegroupid']) && is_numeric($criteria['rolegroupid'])) { $tables .= ', permissions AS p'; }

		// escape input
		$criteria = $this->db->escape($criteria);

		// build the query
		$query_parts = array();
		if (isset($criteria['username'])) { $query_parts[] = 'u.username LIKE "' .dbSearchString($criteria['username']). '"'; }
		if (isset($criteria['firstname'])) { $query_parts[] = 'u.firstname LIKE "' .dbSearchString($criteria['firstname']). '"'; }
		if (isset($criteria['lastname'])) { $query_parts[] = 'u.lastname LIKE "' .dbSearchString($criteria['lastname']). '"'; }
		if (isset($criteria['email'])) { $query_parts[] = 'u.email LIKE "' .dbSearchString($criteria['email']). '"'; }
		if (isset($criteria['active']) && in_array(array_keys($this->active_codes), $criteria['active'])) { $query_parts[] = 'u.active = "' .$this->active_codes[$criteria['active']]. '"'; }

		if (isset($criteria['companyid']) && is_numeric($criteria['companyid'])) {
			// handle companyid
			$query_parts[] = 'wc.company_id = "' .$criteria['companyid']. '"';
			$query_parts[] = 'p.workgroup_id = wc.workgroup_id';
			$query_parts[] = 'p.user_id = u.user_id';

			// handle companyid + rolegroupid
			if (isset($criteria['rolegroupid']) && is_numeric($criteria['rolegroupid'])) { $query_parts[] = 'p.rolegroup_id = "' .$criteria['rolegroupid']. '"'; }
		} else if (isset($criteria['rolegroupid']) && is_numeric($criteria['rolegroupid'])) {
			// handle rolegroupid without companyid
			$query_parts[] = 'p.user_id = u.user_id';
			$query_parts[] = 'p.rolegroup_id = "' .$criteria['rolegroupid']. '"';
		}

		$query = 'SELECT u.user_id as userid, username, u.firstname, u.lastname, u.email, u.active FROM ' .$tables. ' WHERE ';
		$query .= implode(' AND ', $query_parts);
		$orderby = (isset($criteria['orderby']) && isset($this->user_columns[$criteria['orderby']]))?$criteria['orderby']:'username';
		$query .= ' ORDER BY ' .$orderby;
		$orderdir = (isset($criteria['orderdir']) && in_array(strtolower($criteria['orderdir']), array('desc', 'asc')))?$criteria['orderdir']:'DESC';
		$query .= ' ' .$orderdir;
		try {
			$result = $this->db->query($query);
		} catch (Exception $e) {
			to_log('Query "' .$query. '" produced errors while searching for users');
			throw new Exception('An internal error occurred', 1001);
		}

		$users = array();
		$active_codes = array_keys($this->active_codes);
		while ($row = $this->db->getRow($result)) {
			$row['active'] = $active_codes[$row['active']];
			$users[] = $row;
		}

		return $users;
	}

	/*
	 * Gets all details for a specific user
	 * @param int $userid
	 * @return array $user_info (contains all user attributes including permissions)
	 */
	public function userDetails($userid) {
		if (!isset($userid) || !is_numeric($userid)) { throw new Exception ('Invalid User ID provided', 1001); }

		//
		// get user info
		//
		$query = 'SELECT u.user_id AS userid, u.username, u.firstname, u.lastname, u.active, u.email, u.homephone, u.cellphone, u.street, u.city, u.state, u.zip ';
		if (!$this->isAdmin()) {
			$query .= 'FROM users AS u, permissions AS p, workgroup_companies AS wc ';
			$query .= 'WHERE u.user_id = ' .$userid. ' AND p.user_id = u.user_id AND wc.workgroup_id = p.workgroup_id AND wc.company_id = ' .$_SESSION['current_company'];
		} else {
			$query .= 'FROM users AS u WHERE u.user_id = ' .$userid;
		}

        try {
			$result = $this->db->query($query);
		} catch (Exception $e) {
			to_log('Error finding user details with query "' .$query. '"');
			throw new Exception ('User not found by ID', 1001);
		}

		$user_info = $this->db->getRow($result);

		//
		// get user permissions
		//
		$query = 'SELECT p.user_id AS userid, p.rolegroup_id AS rolegroupid, r.name AS rolegroup, p.workgroup_id AS workgroupid, w.name AS workgroup ';
		$query .= 'FROM permissions as p, rolegroups as r, workgroups as w ';
		$query .= 'WHERE p.user_id = ' .$userid. ' AND r.rolegroup_id = p.rolegroup_id AND w.workgroup_id = p.workgroup_id';
		$user_info['permissions'] = $this->db->getTable($query);

		return $user_info;
	}

	/*
	 * Adds user info to the database
	 * @param array $info (contains user attributes that need to be saved)
	 * @return result of userDetails($userid)
	 */
	public function addUser($info) {
		// basic checks
		if (isset($info['userid']) && $info['userid'] != 0) { throw new Exception('Invalid user ID specified for new user', 1001); }
		if (!isset($info['username']) || strlen(trim($info['username'])) == 0) { throw new Exception('Username required but not specified', 1001); }
		if (!isset($info['email']) || strlen(trim($info['email'])) == 0) { throw new Exception('Email required but not specified', 1001); }
		if ($this->checkDupInfo($info)) { throw new Exception('Duplicate username or email specified', 1001); }
		if (!isset($info['active']) || !in_array($info['active'], array_keys($this->active_codes))) { throw new Exception('User status required but not specified', 1001); }

		// permissions check
		if (!$this->isAdmin()) {
			throw new Exception ('Insufficient permissions to create new user', 1001);
		}

		// escape input
		$info = $this->db->escape($info);

		// remove userid from info since we do not need it
		if (isset($info['userid'])) { delete($info['userid']); }

		// compile inserts
		$valid_keys = array_keys($this->user_columns);
		$valid_keys = array_diff($valid_keys, array('userid'));
		$inserts = array();

		// compile inserts
		foreach ($info as $key => $val) {
			// only insert valid keys
			if (!in_array($key, $valid_keys)) { continue; }

			// find the real key
			$real_key = $this->user_columns[$key];

			// add to inserts																												
			$inserts[$real_key] = '"' .$val. '"';																							
		}

		// fix active
		$inserts['active'] = $this->active_codes[$info['active']];
		
		// fix password
		if (!isset($info['password'])) { $info['password'] = $this->getRandomPassword(8); }
		// change password to md5
		$info['password'] = md5($info['password']);

		// build the query
		$query = 'INSERT INTO users ';
		$query .= '(' .implode(', ', array_keys($inserts)) .') VALUES ';
		$query .= '(' .implode(', ', array_values($inserts)) .')';

		// insert the item
		try {
			$info['userid'] = $this->db->insert($insert);
		} catch (Exception $e) {
			to_log('Error inserting user with query "' .$query. '"');
			throw new Exception ('An error occurred when creating the new user', 1001);
		}

		// add permissions
		if (isset($info['permissions'])) { 
			try { 
				$this->setPermissions($info['userid'], $info['permissions']);
			} catch (Exception $e) {
				if ($e->getCode() == 1001) { throw new Exception ($e->getMessage(), 1001); }
				else { throw new Exception('Error adding permissions for this user', 1001); }
			}
		}

		// get info to return
		return $info;
	}

	/*
	 * Updates user info to the database
	 * @param array $info (contains user attributes that need to be saved)
	 * @return result of userDetails($userid)
	 */
	public function editUser($info) {
		// basic checks
		if (!isset($info['userid']) || !is_numeric($info['userid']) || $info['userid'] <= 0) { throw new Exception('Invalid user ID specified', 1001); }
		if (isset($info['username']) && strlen(trim($info['username'])) == 0) { throw new Exception('Invalid username specified', 1001); }
		if (isset($info['email']) && strlen(trim($info['email'])) == 0) { throw new Exception('Invalid email specified', 1001); }
		if ($this->checkDupInfo($info)) { throw new Exception('Duplicate username or email specified', 1001); }
		if (isset($info['active']) && !in_array(array_keys($this->active_codes), $info['active'])) { throw new Exception('Invalid user status specified', 1001); }

		// permissions check
		if (!$this->trusted_request) {
			if (!check_permissions(array(6, 109))) { throw new Exception('Insufficient permissions to update user', 1001); }
		}

		// escape info
		$info = $this->db->escape($info);

		// compile updates
		$valid_keys = array_keys($this->user_columns);
		$valid_keys = array_diff($valid_keys, array('userid'));
		$updates = array();

		// compile updates
		foreach ($info as $key => $val) {
			// only update valid keys
			if (!in_array($key, $valid_keys)) { continue; }
																																			 
			// find the real key																											 
			$real_key = $this->user_columns[$key];
			$updates[] = ' ' .$real_key. ' = "' .$val. '"';
			$update_cols[] = $key;
		}

		// handle no updates
		if (count($updates) == 0) { throw new Exception('Could not find valid data for user update', 1001); }

		// build query
		$query = 'UPDATE users SET ';
		$query .= implode(', ', $updates);
		$query .= ' WHERE user_id = ' .$info['userid'];
		try {
			$affrows = $this->db->update($query);
		} catch (Exception $e) {
			to_log('Error updating user with query "' .$query. '"');
			throw new Exception ('Error updating user', 1001);
		}

		// update permissions
		if (isset($info['permissions']) && is_array($info['permissions'])) {
			try {
				$this->setPermissions($info['permissions']);
			} catch (Exception $e) {
				if ($e->getCode() == 1001) { throw new Exception ($e->getMessage(), 1001); }
				else { throw new Exception('Error updating permissions for this user', 1001); }
			}
		}

		// return user info
		return $info;
	}

	/*
	 * Gives a user permissions, adds an account if non-existant
	 * @param string $email
	 * @params int $companyid 
	 * @params array $rolegroups [1, 2, 3]
	 * @return result of userDetails($userid)
	 */
	public function givePermissions($email, $companyid, $rolegroups) {
		// basic checks
		if (!validEmailAddress($email)) { throw new Exception('Invalid email address specified', 1001); }
		if (!is_numeric($companyid)) { throw new Exception('Invalid Company ID specified', 1001); }
		if (!is_array($rolegroups) || count($rolegroups) == 0) { throw new Exception('Invalid type for Roles specified', 1001); }

		// permissions check
		// ???

		//
		// Get userid, add the user if he does not exist
		//
		$status = $this->checkDupInfo(array('email'=>$email));
		if ($status == false) {
			try {
				$info = array('username'=>$email, 'email'=>$email, 'active'=>1);
				$uinfo = $this->addUser($info);
				$userid = $uinfo['userid'];
			} catch (Exception $e) {
				throw new Exception ($e->getMessage(), $e->getCode());
			}
		} else if (is_numeric($status)) {
			$userid = $status;
		} else { // $status == true if there are multiple rows
			to_log('ERROR: Found multiple accounts using "' .$email. '"');
			throw new Exception('Error assigning permission to this user. Please contact the admin', 1001);
		}

		//
		// Find the workgroup we should put this user into
		//
		$query = 'SELECT workgroup_id, count(*) AS count FROM workgroup_companies WHERE workgroup_id IN (SELECT workgroup_id FROM workgroup_companies WHERE company_id = ' .$companyid. ') GROUP BY workgroup_id';
		$result = $this->db->query($query);
		$workgroupid = 0;
		$count = 99999999;
		while ($row = $this->db->getRow($result)) {
			if ($row['count'] < $count) {
				$workgroupid = $row['workgroup_id'];
				$count = $row['count'];
			}
		}
		if ($workgroupid = 0) { throw new Exception('Could not find the workgroup associated with this company', 1001); }

		//
		// Build the permissions array
		//
		$permissions = array();
		for ($i=0; $i<count($rolegroups); $i++) { $permissions[] = array('rolegroupid'=>$rolegroups[$i], 'workgroupid'=>$workgroupid); }

		//
		// Give the user permissions
		//
		if (isset($companyid) && is_array($permissions)) {
			try {
				$this->addPermissions($userid, $permissions);
			} catch (Exception $e) {
				if ($e->getCode() == 1001) { throw new Exception ($e->getMessage(), 1001); }
				else { throw new Exception('Error adding permissions for this user', 1001); }
			}
		}
 
		return $this->userDetails($userid);
	}

	/*
	 * Gets called before delete to do other things
	 * @param int $userid
	 * @return bool (true to continue delete, false to stop)
	 */
	public function preDeleteUser() {
		return true;
	}

	/*
	 * Gets called after delete to do other things
	 * @param int $userid
	 * @return bool (true if all good, false otherwise)
	 */
	public function postDeleteUser() {
		return true;
	}
  
	/*
	 * Deletes an existing user
	 * @param int $userid
	 * @return bool true false
	 */
	public function deleteUser($userid) {
		// basic checks
		if (!isset($userid) || !is_numeric($userid)) { throw new Exception('Invalid user ID specified', 1001); }

		// permissions check
		if (!$this->isAdmin()) { throw new Exception('Insufficient permissions to delete user', 1001); }

		// make sure the user does not have any permissions
		if (count($this->getPermissions($userid)) > 0) { throw new Exception('User has existing permissions', 1001); }

		if (!$this->preDeleteUser($userid)) { return false; }

		// delete the user
		$query = 'DELETE FROM user WHERE user_id = ' .$userid;
		try {
			$affrows = $this->db->update($query);
		} catch (Exception $e) {
			to_log('Error deleting user with query "' .$query. '"');
			throw new Exception ('Error deleting user', 1001);
		}

		to_log('Deleted user with "' .$query. '"');

		$this->postDeleteUser($userid);

		return true;
	}

	/*
	 * Resets the user's password
	 * @param int $userid
	 * @param string $password [optional] chooses random password
	 * @param bool $email [optional] emails user the new password
	 * @return bool true on success
	 */
	public function resetPassword($userid, $password=false, $email=true) {
		return false;
	}

	/*
	 * Emails the user their info for new accounts or password resets
	 * @param array $info [fullname, email, subject, body]
	 * @return bool
	 */	
	public function emailUser($info) {
		if (!$this->trusted_request) { return false; }

		include_once('smtp.php');
		$mail = new MyMail;
		$mail->AddAddress($info['email'], $info['fullname']);
		$mail->Subject = $info['subject'];
		$mail->Body = $info['body'];
		$mail->From = SE\FROM_ADDR;
		$mail->FromName = SE\FROM_NAME;
		$mail->Priority = 1;

		if(!$mail->Send()) {
			to_log('Error sending mail ' . $mail->ErrorInfo);
			throw new Exception('Password reset email not sent', 1001);
		}

		return true;
	}

	/*
	 * Adds new permissions to a user (on top of any existing)
	 * @param int $userid
	 * @param array $info [{"rolegroupid":4, "workgroupid":44}, ...]
	 * @return result of getPermissions($userid)
	 */
	public function addPermissions($userid, $info) {
		// basic checks
		if (!isset($userid) || !is_numeric($userid)) { throw new Exception('Invalid userid specified while setting permissions', 1001); }
		if (!isset($info) || !is_array($info)) { throw new Exception('Insufficient data specified while setting permissions', 1001); }

		// build inserts
		$inserts = array();
		for ($i=0; $i<count($info); $i++) {
			if (!isset($info['rolegroupid']) || !is_numeric($info['rolegroupid'])) { throw new Exception('Rolegroup ID missing from permissions info'); }
			if (!isset($info['workgroupid']) || !is_numeric($info['workgroupid'])) { throw new Exception('Workgroup ID missing from permissions info'); }
		   	$inserts = '(' .$userid. ', ' .$info['rolegroupid']. ', ' .$info['workgroupid']. ')';
		}

		// build the query
		$query = 'INSERT INTO permissions (user_id, rolegroup_id, workgroup_id) VALUES ';
		$query .= implode($inserts, ', ');
		try {
			$this->db->query($query);
		} catch (Exception $e) {
			to_log('Error inserting permissions with query "' .$query. '"');
			throw new Exception ('Error adding permissions to the user', 1001);
		}

		return true;
	}
 
	/*
	 * Sets permissions for a user (removing existing)
	 * @param int $userid
	 * @param array $info [{"rolegroupid":4, "workgroupid":44}]
	 * @param int $companyid OPTIONAL to only remove existing permissions from this company
	 * @return result of getPermissions($userid)
	 */
	public function setPermissions($userid, $info, $companyid=null) {
		// basic checks
		if (!isset($userid) || !is_numeric($userid)) { throw new Exception('Invalid User ID specified while setting permissions', 1001); }
		if (!isset($info) || !is_array($info)) { throw new Exception('Insufficient data specified while setting permissions', 1001); }
		if ($companyid != null && !is_numeric($companyid)) { throw new Exception('Invalid Company ID specified while setting permissions', 1001); }

		// delete existing items
		$query = 'DELETE FROM permissions WHERE user_id = ' .$userid;
		// remove permissions specific to a companyid if specified
		if ($companyid !=null) {
			$query .= ' AND workgroup_id IN (SELECT workgroup_id FROM workgroup_companies WHERE company_id = ' .$companyid. ')';
		}
		try {
			$this->db->query($query);
		} catch (Exception $e) {
			to_log('Error deleteing permisions with query "' .$query. '"');
			throw new Exception ('Error updating permissions for the user', 1001);
		}

		// add new permissions
		try {
			$this->addPermissions($userid, $info);
		} catch (Exception $e) {
			if ($e->getCode() == 1001) { throw new Exception ($e->getMessage(), 1001); }
			else {
				to_log('Geting "' .$e->getMessage(). '" when adding permissions for new user');
				throw new Exception('Error adding new permissions for this user', 1001);
			}
		}

		return true;
	}

	/*
	 * Gets settings for a user
	 */
	public function getSettings($labels=null) {
		$query = 'SELECT label, value FROM settings WHERE user_id = ' .$_SESSION['vid'];
		if (is_array($labels) && count($labels) > 0) {
			$labels = $this->db->escape($labels);
			$query .= ' AND label IN ("' .implode('", "', $labels). '")';
		}
		$settings = $this->db->getKeyValueMap($query);

		return $settings;
	}

	/*
	 * Saves settings for a user
	 */
	public function saveSettings($pairs) {
		$pairs = $this->db->escape($pairs);

		$this->deleteSettings(array_keys($pairs));

		$query = 'INSERT INTO settings (user_id, label, value) VALUES ';
		foreach ($pairs as $label => $value) {
			$query .= '(' .$_SESSION['vid']. ', "' .$this->db->escape($label). '", "' .$this->db->escape($value). '")';
		}

		try {
			$this->db->query($query);
		} catch (Exception $e) {
			to_log('Error saving settings with query "' .$query. '"');
			throw new Exception('Error saving settings', 1001);
		}

		return true;
	}

	/*
	 * Delete settings for a user
	 * @param array $labels
	 */
	protected function deleteSettings($labels) {
		if (!is_array($labels)) { throw new Exception('Invalid format specified for labels "' .$labels. '"'); }
		if (count($labels) == 0) { throw new Exception('Labels not specified for delete'); }

		$query = 'DELETE FROM settings WHERE label IN ("' .implode('", "', $this->db->escape($labels)). '") AND user_id = ' .$_SESSION['vid'];
		try {
			$affrows = $this->db->update($query);
		} catch (Exception $e) {
			to_log('Could not delete settings with "' .$query. '"'); 
			throw new Exception ('Error deleting settings.', 1001);
		}

		return true;
	}
 
	/*
 	 * Gets a list of permissions companies and features for this user
	 * @param int userid
	 * @return array {perms:[], cnames:[], menu:[]}
	 */
	public function getUserFeatures($userid) {
 		// basic checks
		if (!isset($userid) || !is_numeric($userid)) { throw new Exception('Invalid userid specified while getting permissions', 1001); }
 
		$query = 'SELECT f.name, f.link, f.parent_name, r.role_id, wc.company_id, c.name AS cname ';
		$query .= 'FROM rolegroup_roles AS rgr, permissions AS p, workgroup_companies AS wc, companies AS c, roles AS r LEFT OUTER JOIN features AS f on r.feature_id = f.feature_id ';
		$query .= 'WHERE p.user_id = ' .$userid. ' AND p.workgroup_id = wc.workgroup_id AND wc.company_id = c.company_id AND c.active = 1 AND p.rolegroup_id = rgr.rolegroup_id AND rgr.role_id = r.role_id';
		//$result = $this->db->query($query);
		$result = $this->db->query($query);
    
		$perms = array();
		$cnames = array();
		$menu = array();
    
		while ($row = $this->db->getRow($result)) {
			// fill the perms array
			$perms[$row['company_id']][] = $row['role_id'];
        
			// get company names
			$cnames[$row['company_id']] = $row['cname'];
        
			// fill the menu 
			if ($row['name'] == '' || $row['link'] == '') { continue; }
			if ($row['parent_name'] == '') {
				$menu[$row['name']] = $row['link'];
			} else {
				$menu[$row['parent_name']][$row['name']] = $row['link'];
			}
		}
    
		// sort the menu items
		if (count($menu) > 0) { ksort($menu); }
    
		// sort the company names
		if (count($cnames) > 0) { asort($cnames); }
    
		return array('perms' => $perms, 'cnames' => $cnames, 'menu' => $menu);
	}

	/*
	 * Gets current permissions for a user
	 * @param int $userid
	 * @result array $info [{"userid":3, "rolegroup":"RG1", "rolegroupid":"3", "workgroup":"WG1", "workgroupid":1}, ...]
	 */
	protected function getPermissions($userid) {
		// basic checks
		if (!isset($userid) || !is_numeric($userid)) { throw new Exception('Invalid userid specified while getting permissions', 1001); }

		// run query
		$query = 'SELECT p.user_id AS userid, p.rolegroup_id AS rolegroupid, r.name AS rolegroup, p.workgroup_id AS workgroupid, w.name AS workgroup ';
		$query .= 'FROM permissions AS p, rolegroups AS r, workgroups AS w ';
		$query .= 'WHERE p.user_id = ' .$userid. ' AND r.rolegroup_id = p.rolegroup_id AND w.workgroup_id = p.workgroup_id';
		try {
			$permissions = $this->db->getTable($query);
		} catch (Exception $e) {
			to_log('Error getting permissions with query "' .$query. '"');
			throw new Exception ('Error getting user permissions', 1001);
		}

		return $permissions;
	}
 
	/*
	 * Find out how restrictive the search is for users or user details
	 * return bool
	 */
	protected function isAdmin() {
		return true;
	}
 
	/*
	 * Checks user's info (phone, email, etc) to see if everything is OK
	 * @param int $userid
	 * @param optional array $info (user's info to verify that it is OK)
	 * @return array (list of keys that have issues)
	 */
	protected function checkInfo($userid, $uinfo=null) {
		// basic checks
		if (!isset($userid) || !is_numeric($userid)) { throw new Exception('Invalid user ID specified when checking info', 1001); }
		if (isset($uinfo) && $uinfo != null && !is_array($uinfo)) { throw new Exception('Invalid user info specified while checking', 1001); }

		// permissions check
		if ($userid != $_SESSION['current_user'] || !checkPermissions(array(6))) { throw new Exception('Insufficient permission to check information for this user', 1001); }

		// get info
		$query = 'SELECT username, title, firstname, lastname, email, street, city, state, zip, homephone, cellphone, workphone, description FROM users';
		$query .= ' WHERE user_id = ' .$userid;

		// look for problems

		// return results
	}

	/*
	 * Checks if users already exist with this info
	 * @param array $info [email, username, userid]
	 * @return bool|int ($userid $userid if only 1 matching user found, true if duplicate false otherwise)
	 */
	protected function checkDupInfo($info) {
		// basic checks
		if (!is_array($info)) { throw new Exception('Invalid info type while checking for duplicate users', 1001); }
		if (!isset($info['email']) && !isset($info['username'])) { throw new Exception('Info not specified in check for duplicate users', 1001); }
		if ($info['email'] && !validEmailAddress($info['email'])) { throw new Exception('Invalid email address specified while checking for duplicate users', 1001); }
		if (isset($info['userid']) && !is_numeric($info['userid'])) { throw new Exception('Invalid userid specified when checking for duplicates', 1001); }

		// escape info
		$info = $this->db->escape($info);

		// build query
		$query = 'SELECT user_id AS userid FROM users AS u WHERE (';
		if (isset($info['email'])) { $query .= 'u.email = ' .$info['email']; }
		if (isset($info['email']) && isset($info['username'])) { $query .= ' OR '; }
		if (isset($info['username'])) { $query .= ' username = ' .$info['username']; }
		$query .= ') ';
		if (isset($info['userid'])) { $query .= 'AND user_id != ' .$info['userid']; } 

		try {
			$result = $this->db->query($query);
		} catch (Exception $e) {
			to_log('Error finding duplicate with query "' .$query. '"');
			throw new Exception ('Error finding duplicate entries');
		}

		$numrows = $this->db->getNumRows($result);

		// check if there were any results (duplicates)
		if ($numrows == 1) {
			$row = $this->db->getRow($result);
			$userid = $row['userid'];
			return $userid;
		} else if ($numrows > 1) {
			return true;
		}

		return false;
	}

	/*
	 * Generates a random password
	 * @param int (#chars in password)
	 * @return string
	 */
	protected function getRandomPassword($length=8) {
		$vowels = 'aeuyAEUY2345';
		$consonants = 'bcdfghjkmnpqrstvwxzBCDFGHJKMNPQRSTVWXZ6789';
		$password = '';

		// pick which string to use
		$alt = time() % 2;

		// seed the random # generator for rand used later
		srand(time());

		for ($i = 0; $i < $length; $i++) {
			if ($alt == 1) {
				$password .= $consonants[(rand() % 42)];
				$alt = 0;
			} else {
				$password .= $vowels[(rand() % 12)];
				$alt = 1;
			} // end if alt is 1
		} // end for 

		return $password;
	}
}

?>
