<?

include_once('class.seusers.php');

/*
 * Class to manage users (authentication, management)
 */
class twigUsers extends seUsers {
	/*
	 * Authenticates the user and does some initial stuff
	 * @param string $username
	 * @param string $password
	 * @return bool true on success false on error
	 */
	public function authenticate($username, $password) {
		$query = 'SELECT user_id as userid, username, CONCAT(firstname, " ", lastname) as fullname, active, MD5("' .$password. '") AS  mpass, password FROM users WHERE (username = "' .$username. '" OR email = "' .$username. '")';
		$result = $this->db->query($query);
		$numrows = $this->db->getNumRows($result);

		if ($numrows == 0) {
			$this->status_message = 'Invalid username or password';
			$this->status_code = 1;
			return false;
		} else if ($numrows == 1) {
			$row = $this->db->getRow($result);

			// bad password
			if ($row['mpass'] != $row['password']) {
				$this->status_message = 'Bad username or password';
				$this->status_code = 1;
				return false;
			}

			// disabled
			if ($row['active'] != '1') {
				$this->status_message = 'User is disabled';
				$this->status_code = 2;
				return false;
			}

			$this->status_message = '';
			$this->status_code = 0;
			return true;
		} else if ($numrows > 1) { // this is a problem, it should not happen
			$this->status_message = 'Account inconsistent';
			$this->status_code = 3;
			email_admin($user. ' is logging in and I am getting multiple rows when performing authentication. Please check it out.');
			return false;
		} else {
			$this->status_message = 'Unknown error';
			$this->status_code = 4;
			return false;
		}
	}

	/*
	 * Resets the user's password
	 * @param int $userid
	 * @param string $password [optional] chooses random password
	 * @param bool $email [optional] emails user the new password
	 * @return bool true on success
	 */
	public function resetPassword($userid, $password=false, $email=true) {
		if (!isset($userid) || !is_numeric($userid)) { throw new Exception('Invalid userid specified while resetting password', 1001); }

		// make sure we have a password
		if (!$password) { $password = $this->getRandomPassword(8); }

		// update the DB
		$query = 'UPDATE users SET password = MD5("' .$this->db->escape($password). '") WHERE user_id = ' .$userid;
		try {
			$affrows = $this->db->update($query);
		} catch (Exception $e) {
			error_log('Error updating password with query "' .$query. '"');
			throw new Exception ('Error updating password', 1001);
		}

		// update the auth DB
		$authdb = new DB(array('host'=>SE\AUTH_DB_SERVER, 'user'=>SE\AUTH_DB_USER, 'password'=>SE\AUTH_DB_PASS, 'dbname'=>SE\AUTH_DB_DBASE));
		$query = 'UPDATE vusers SET password = "' .$authdb->escape($password). '" WHERE username = "' .$authdb->escape($_SESSION['vuser']). '"';

		try {
			$affrows = $authdb->update($query);
		} catch (Exception $e) {
			// put the password back
			$query = 'UPDATE users SET password = MD5("' .$this->db->escape($_SESSION['vpass']). '") WHERE user_id = ' .$userid;
			$affrows = $this->db->update($query);

			error_log('Error updating password with query "' .$query. '"');
			throw new Exception ('Error updating password', 1001);
		}

		if ($email) {
			// get user's info
			$uinfo = $this->userDetails($userid);
			$body = 'Username: ' .$uinfo['username']. "\r\n";
			$body .= 'Password: ' .$password. "\r\n";
			$einfo = array('fullname'=>$uinfo['firstname']. ' ' .$uinfo['lastname'], 'email'=>$uinfo['email'], 'subject'=>'TWIG password reset', 'body'=>$body);

			// email the user
			try {
				$this->emailUser($info);
			} catch (Exception $e) {
				error_log($e->getMessage());
				throw new Exception('Updated password for user but could not send email', 1001);
			}
		}

		return true;
	}
}

?>
