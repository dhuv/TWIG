<?

/*
 * Class to access IMAP mailbox
 */

class TWIGContacts {
    protected $contact_columns = array('contactid'=>'contact_id', 'authorid'=>'owner_id', 'created'=>'created', 'updated'=>'updated', 'nickname'=>'nickname', 'firstname'=>'firstname', 'lastname'=>'lastname', 'company'=>'company_name', 'description'=>'description'); 

	protected $db = null;
   
    function __construct () {
		$this->db = new DB();
	}

	/*
	 * Add contact
	 * @param array $contact
	 * @return array $contact
	 */
	public function addContact ($contact) {
		// basic checks
		if (!is_array($contact)) { throw new Exception ('Contact info has invalid format', 1001); }
		if (strlen($contact['firstname']) == 0 && strlen($contact['lastname'] == 0)) { throw new Exception ('First or lastname required', 1001); }
		if (!isset($contact['contactid'])) { throw new Exception ('Contact ID required but not specified', 1001); }
		if ($contact['contactid'] != 0) { throw new Exception ('Contact ID invalid', 1001); }

		$contact = $this->db->escape($contact);
		unset($contact['contactid']);
		$contact['authorid'] = $_SESSION['vid'];

        $valid_keys = array_keys($this->contact_columns);
        $inserts = array();
        // compile inserts
        foreach ($contact as $key => $val) {
            // only insert valid keys
            if (!in_array($key, $valid_keys)) { continue; }
            // find the real key
            $real_key = $this->contact_columns[$key];
            // add to inserts
            $inserts[$real_key] = '"' .$val. '"';
        }

        // build the query
        $query = 'INSERT INTO contacts ';
        $query .= '(' .implode(', ', array_keys($inserts)) .') VALUES ';
        $query .= '(' .implode(', ', array_values($inserts)) .')';

        // insert item
		try {
			$contactid = $this->db->insert($query);
		} catch (Exception $e) {
            error_log('Error inserting contact with query "' .$query. '"');
            throw new Exception ('Error adding contact', 1001);                                                                                                    
		}

		try {
			$this->saveContactDetails($contactid, $contact['emails'], $contact['numbers'], $contact['ims'], $contact['addresses']);
		} catch (Exception $e) {
			$mesg = ($e->getCode() == 1001)?$e->getMessage():'Error adding additional contact info';
			throw new Exception ($mesg, 1001);
		} 

		return $this->getContact($contactid);
	}

	/*
	 * Update contact
	 * @param array $contact
	 * @param bool
	 */
	public function editContact ($contact) {
		// basic checks
		if (!is_array($contact)) { throw new Exception ('Contact info has invalid format', 1001); }
		if (strlen($contact['firstname']) == 0 && strlen($contact['lastname'] == 0)) { throw new Exception ('First or lastname required', 1001); }
		if (!isset($contact['contactid'])) { throw new Exception ('Contact ID required but not specified', 1001); }
		$contactid = $contact['contactid'];
		if ($contactid < 1) { throw new Exception ('Contact ID invalid', 1001); }
		if (!$this->checkPermission($contactid, 'edit')) { throw new Exception ('Insufficient permission to update contact', 1001); }

		$contact = $this->db->escape($contact);
		unset($contact['contactid']);
 
		// compile updates
        $valid_keys = array_keys($this->contact_columns);
        foreach ($contact as $key => $val) {
            // only update valid keys
            if (!in_array($key, $valid_keys)) { continue; }
            // find the real key                                                                                                                                  
            $real_key = $this->contact_columns[$key];                                                                                                               
            $updates[] = ' ' .$real_key. ' = "' .$val. '"';                                                                                                       
        }    

        // handle no updates
        if (count($updates) == 0) { throw new Exception('Could not find valid data', 1001); }

        // build the query
        $query = 'UPDATE contacts SET ';
        $query .= implode(', ', $updates);
        $query .= ' WHERE contact_id = ' .$contactid;

        // update contact
		try {
			$affrows = $this->db->update($query);
		} catch (Exception $e) {
            error_log('Error updating contact with query "' .$query. '"');
            throw new Exception ('Error updating contact', 1001);                                                                                                    
		}

		try {
			$this->saveContactDetails($contactid, $contact['emails'], $contact['numbers'], $contact['ims'], $contact['addresses']);
		} catch (Exception $e) {
			$mesg = ($e->getCode() == 1001)?$e->getMessage():'Error updating additional contact info';
			throw new Exception ($mesg, 1001);
		}

		return $this->getContact($contactid);
	}

	/*
	 * Gets all contact info in one go
	 * @return array $contacts
	 */
	public function getAllContacts () {
		$contacts = array();
		$contactids = array();

		//
		// get all contacts
		//
		$query = 'SELECT DISTINCT c.contact_id AS contact_id, owner_id AS authorid, created AS created, updated AS updated, nickname, firstname, lastname, company_name AS company, description FROM contacts AS c, contact_teams AS ct ';
		$query .= 'WHERE (c.owner_id = ' .$_SESSION['vid']. ' OR (c.contact_id = ct.contact_id AND ct.team_id IN (SELECT team_id FROM team_users WHERE user_id = ' .$_SESSION['vid']. ')))';
		$result = $this->db->query($query);

		while ($row = $this->db->getRow($result)) {
			$contactids[] = $row['contactid'];

			$row['numbers'] = array();
			$row['emails'] = array();
			$row['ims'] = array();
			$row['addresses'] = array();
			$row['teams'] = array();
			$contacts['contactid_' .$row['contactid']] = $row;
		}

		//
		// get all other contact info
		//
		$ids = implode(', ', $contactids);
        $query = 'SELECT n.contact_id AS contactid, n.phonenumber, n.description FROM contact_numbers AS n WHERE contact_id IN (' .$ids. ')';
        $result = $this->db->query($query);
        $contact['numbers'] = array();
        while ($row = $this->db->getRow($result)) {
			$cid = 'contactid_' .$row['contactid'];
			unset($row['contactid']);
			$contacts[$cid]['numbers'][] = $row;
		}
              
        $query = 'SELECT e.email, e.description FROM contact_emails AS e WHERE contact_id IN (' .$ids. ')';
        $contact['emails'] = array();
        $result = $this->db->query($query);
        while ($row = $this->db->getRow($result)) {
			$cid = 'contactid_' .$row['contactid'];
			unset($row['contactid']);
			$contact['emails'][] = $row;
		}
        
        $query = 'SELECT a.contact_id AS contactid, a.address, a.description FROM contact_addresses AS a WHERE contact_id IN (' .$ids. ')';
        $contact['addresses'] = array();
        $result = $this->db->query($query);
        while ($row = $this->db->getRow($result)) {
			$cid = 'contactid_' .$row['contactid'];
			unset($row['contactid']);
			$contact['addresses'][] = $row;
		}

        $query = 'SELECT i.contact_id AS contactid, i.im_platform, i.im_name FROM contact_ims AS i WHERE contact_id IN (' .$ids. ')';
        $contact['ims'] = array();
        $result = $this->db->query($query);
        while ($row = $this->db->getRow($result)) {
			$cid = 'contactid_' .$row['contactid'];
			unset($row['contactid']);
			$contact['ims'][] = $row;
		}

        $query = 'SELECT t.contact_id AS contactid, t.team_id FROM contact_teams AS t WHERE contact_id IN (' .$ids. ')';
        $contact['teams'] = array();
        $result = $this->db->query($query);
        while ($row = $this->db->getRow($result)) {
			$cid = 'contactid_' .$row['contactid'];
			unset($row['contactid']);
			$contact['teams'][] = $row;
		}

		return $contacts;
	}
 
	/*
	 * Search for contacts
	 * @param array $criteria {'email':'%sear%', 'firstname':'%sear%', 'lastname':'%sear%'}
	 * @param bool (reorganize info so it is not scattered over multiple items)
	 * @return array $contacts [{
	 */
	public function searchContacts ($criteria, $organize=false) {
		// basic checks
		if (!is_array($criteria)) { throw new Exception ('Search criteria not specified', 1001); }

		$criteria = $this->db->escape($criteria);

		if (!isset($criteria['andor']) || !in_array(strtoupper($criteria['andor']), array('AND', 'OR'))) { $criteria['andor'] = 'AND'; }

		$columns = array('c.contact_id AS contactid', 'c.firstname', 'c.lastname', 'c.nickname', 'c.company_name AS company');
		$tables = array('contacts AS c', 'contact_teams AS ct');
		$joins = array();

		$filters = array();
		if (isset($criteria['firstname'])) {
			$txt = '(c.firstname';
			$txt .= (strpos($criteria['firstname'], '%') === false)?' = ':' LIKE ';
			$txt .= '"' .$criteria['firstname']. '")';
			$filters[] = $txt;
		} 
		if (isset($criteria['lastname'])) {
			$txt = '(c.lastname';
			$txt .= (strpos($criteria['lastname'], '%') === false)?' = ':' LIKE ';
			$txt .= '"' .$criteria['lastname']. '")';
			$filters[] = $txt;
		} 
		if (isset($criteria['email'])) {
			$columns[] = 'ce.email';
			$tables[] = 'contact_emails AS ce';
			$joins[] = 'c.contact_id = ce.contact_id';

			$txt = '(ce.email';
			$txt .= (strpos($criteria['email'], '%') === false)?' = ':' LIKE ';
			$txt .= '"' .$criteria['email']. '")';
			$filters[] = $txt;
		}
		if (isset($criteria['number'])) {
			$columns[] = 'cn.phonenumber AS number, cn.description AS number_type';
			$tables[] = 'contact_numbers AS cn';
			$joins[] = 'c.contact_id = cn.contact_id';

			$txt = '(cn.phonenumber';
			$txt .= (strpos($criteria['number'], '%') === false)?' = ':' LIKE ';
			$txt .= '"' .$criteria['number']. '")';
			$filters[] = $txt;
		} 
		if (isset($criteria['im'])) {
			$columns[] = 'ci.im_name, ci.im_platform AS im_type';
			$tables[] = 'contact_ims AS ci';
			$joins[] = 'c.contact_id = ci.contact_id';

			$txt = '(ci.im_name';
			$txt .= (strpos($criteria['im'], '%') === false)?' = ':' LIKE ';
			$txt .= '"' .$criteria['im']. '")';
			$filters[] = $txt;
		}  
		if (isset($criteria['address'])) {
			$columns[] = 'ca.address, ca.description AS address_type';
			$tables[] = 'contact_addresses AS ca';
			$joins[] = 'c.contact_id = ca.contact_id';

			$txt = '(ca.address';
			$txt .= (strpos($criteria['address'], '%') === false)?' = ':' LIKE ';
			$txt .= '"' .$criteria['address']. '")';
			$filters[] = $txt;
		}   
		$team_txt = (isset($criteria['teamid']))?' AND team_id = ' .$criteria['teamid']:'';

		$query = 'SELECT DISTINCT ' .implode(', ', $columns). ' ';
		$query .= 'FROM ' .implode(', ', $tables). ' ';
		$query .= 'WHERE ';
		if (count($joins) > 0) { $query .= implode(' AND ', $joins). ' AND '; }
		$query .= '(c.owner_id = ' .$_SESSION['vid']. ' OR (c.contact_id = ct.contact_id AND ct.team_id IN (SELECT team_id FROM team_users WHERE user_id = ' .$_SESSION['vid'].$team_txt. '))) ';
		if (count($filters) > 0) { $query .= 'AND (' .implode(' ' .$criteria['andor']. ' ', $filters). ') '; }
		$query .= 'ORDER BY firstname, lastname';
    	$result = $this->db->query($query);

		$contacts = $this->db->getTable($query); 

		// when doing a join with other tables, data comes in over multiple rows
		if ($organize && count($filters > 0)) {
			$cts = array();

			for ($i=0; $i<count($contacts); $i++) {
				$contactid = $contacts[$i]['contactid'];
				if (!isset($cts[$contacts[$i]['contactid']])) {
					$cts[$contactid] = array('contactid'=>$contactid, 'firstname'=>$contacts[$i]['firstname'], 'lastname'=>$contacts[$i]['lastname'], 'nickname'=>$contacts[$i]['nickname'], 'company'=>$contacts[$i]['company'], 'emails'=>array(), 'numbers'=>array(), 'ims'=>array(), 'addresses'=>array(), 'dupinfo'=>array());
				}

  				if (isset($contacts[$i]['email']) && strlen(($contacts[$i]['email'])) > 0) {
					if (!in_array($contacts[$i]['email'], $cts[$contactid]['emails'])) {
						$cts[$contactid]['emails'][] = $contacts[$i]['email'];
					}
				}  
				if (isset($contacts[$i]['number']) && strlen(($contacts[$i]['number'])) > 0) {
					$tmp = $contacts[$i]['number']. ' ' .$contacts[$i]['number_type'];
					if (!in_array($tmp, $cts[$contactid]['dupinfo'])) {
						$cts[$contactid]['dupinfo'][] = $tmp;
						$cts[$contactid]['numbers'][] = array('number'=>$contacts[$i]['number'], 'number_type'=>$contacts[$i]['number_type']);
					}
				}
 				if (isset($contacts[$i]['im_name']) && strlen(($contacts[$i]['im_name'])) > 0) {
					$tmp = $contacts[$i]['im_name']. ' ' .$contacts[$i]['im_type'];
					if (!in_array($tmp, $cts[$contactid]['dupinfo'])) {
						$cts[$contactid]['dupinfo'][] = $tmp;
						$cts[$contactid]['ims'][] = array('im_name'=>$contacts[$i]['im_name'], 'im_type'=>$contacts[$i]['im_type']);
					}
				} 
 				if (isset($contacts[$i]['address']) && strlen(($contacts[$i]['address'])) > 0) {
					$tmp = $contacts[$i]['address'];
					if (!in_array($tmp, $cts[$contactid]['dupinfo'])) {
						$cts[$contactid]['dupinfo'][] = $tmp;
						$cts[$contactid]['addresses'][] = array('address'=>$contacts[$i]['address'], 'address_type'=>$contacts[$i]['address_type']);
					}
                }
			}

			$contacts = array();
			foreach ($cts as $contactid => $cinfo) {
				unset($cinfo['dupinfo']);
				$contacts[] = $cinfo; 
			}
		}

		return $contacts;
	}

	/*
	 * Get contact details
	 * @param int $contactid
	 * @return array $contact
	 */
	public function getContact ($contactid) {
		// basic checks
		if (!is_numeric($contactid)) { throw new Exception ('Invalid contact ID specified (' .$contactid. ')', 1001); }

		// get contact info with permission check
		$query = 'SELECT DISTINCT c.contact_id AS contactid, owner_id AS ownerid, UNIX_TIMESTAMP(created) AS created, UNIX_TIMESTAMP(updated) AS updated, nickname, firstname, lastname, company_name AS company, description ';
		$query .= 'FROM contacts AS c, contact_teams AS ct ';
		$query .= 'WHERE c.contact_id = ' .$contactid. ' ';
		$query .= 'AND (c.owner_id = ' .$_SESSION['vid']. ' OR (c.contact_id = ct.contact_id AND ct.team_id IN (SELECT team_id FROM team_users WHERE user_id = ' .$_SESSION['vid']. '))) ';
		try {
			$contact = $this->db->getRow($query);
		} catch (Exception $e) {
			error_log('Error getting contact info with query "' .$query. '"');
			throw new Exception ('Error getting contact information', 1001);
		}

		// get other info for contact
        $query = 'SELECT n.phonenumber AS number, n.description AS number_type FROM contact_numbers AS n WHERE contact_id = ' .$contactid;
		$contact['numbers'] = $this->db->getTable($query);

        $query = 'SELECT e.email FROM contact_emails AS e WHERE contact_id = ' .$contactid;
		$contact['emails'] = $this->db->getColumn($query);

        $query = 'SELECT a.address, a.description AS address_type FROM contact_addresses AS a WHERE contact_id = ' .$contactid;
		$contact['addresses'] = $this->db->getTable($query);

        $query = 'SELECT i.im_platform AS im_type, i.im_name FROM contact_ims AS i WHERE contact_id = ' .$contactid;
		$contact['ims'] = $this->db->getTable($query);

        $query = 'SELECT t.team_id AS teamid FROM contact_teams AS t WHERE contact_id = ' .$contactid;
		$contact['teams'] = $this->db->getTable($query);

		return $contact;
	}

	/*
	 * Delete a contact
	 * @param int $contactid
	 */
	public function deleteContact ($contactid) {
		// basic checks
		if (!is_numeric($contactid)) { throw new Exception ('Invalid contact ID specified (' .$contactid. ')', 1001); }
		if (!$this->checkPermission($contactid, 'delete')) { throw new Exception ('Insufficient privileges to delete this contact', 1001); }

		$query = 'DELETE FROM contacts WHERE contact_id = ' .$contactid;
		try {
			$affrows = $this->db->update($query);
		} catch (Exception $e) {
			error_log ('Error deleting contact with query "' .$query. '"');
			throw new Exception ('Error deleting contact', 1001);
		}

		$blank = array();
		$this->saveContactDetails ($contactid);

		return true;
	}

	/*
	 * Clear/Insert extra contact info
	 * @param int $contactid
	 * @param array $emails (contact emails)
	 * @param array $numbers (contact numbers)
	 * @param array $ims (contact ims)
	 * @param array $addresses (contact addresses)
	 */
	protected function saveContactDetails ($contactid, $emails=null, $numbers=null, $ims=null, $addresses=null) {
		// basic checks
		if (!is_numeric($contactid)) { throw new Exception('Invalid contact ID specified'); }

		// remove all other info
		$query = 'DELETE FROM contact_emails WHERE contact_id = ' .$contactid;
        $this->db->update($query);
		$query = 'DELETE FROM contact_numbers WHERE contact_id = ' .$contactid;
        $this->db->update($query);
		$query = 'DELETE FROM contact_ims WHERE contact_id = ' .$contactid;
        $this->db->update($query);
		$query = 'DELETE FROM contact_addresses WHERE contact_id = ' .$contactid;
        $this->db->update($query);

		// insert emails
		if (isset($emails) && is_array($emails) && count($emails) > 0) {
			$emails = $this->db->escape($emails);	
			$vals = array();
			for ($i=0; $i<count($emails); $i++) {
				if (strlen(trim($emails[$i])) == 0) { continue; }
				$vals[] = '(' .$contactid. ', "' .$emails[$i]. '")';
			}
			if (count($vals) > 0) {
				$query = 'INSERT INTO contact_emails (contact_id, email) VALUES ' .implode(', ', $vals);
				$this->db->query($query);
			}
		}

		// insert numbers
		if (isset($numbers) && is_array($numbers) && count($numbers) > 0) {
			$vals = array();
			for ($i=0; $i<count($numbers); $i++) {
				$number = $this->db->escape($numbers[$i]);
				if (!isset($number['number']) || strlen(trim($number['number'])) == 0) { continue; }
				$vals[] = '(' .$contactid. ', "' .$number['number']. '", "' .$number['number_type'] .'")';
			}
			if (count($vals) > 0) {
				$query = 'INSERT INTO contact_numbers (contact_id, phonenumber, description) VALUES ' .implode(', ', $vals);
				$this->db->query($query);
			}
		}

		// insert ims
		if (isset($ims) && is_array($ims) && count($ims) > 0) {
			$vals = array();
			for ($i=0; $i<count($ims); $i++) {
				$im = $this->db->escape($ims[$i]);
				if (!isset($im['im']) || strlen(trim($im['im'])) == 0) { continue; }
				$vals[] = '(' .$contactid. ', "' .$im['im']. '", "' .$im['im_type'] .'")';
			}
			if (count($vals) > 0) {
				$query = 'INSERT INTO contact_ims (contact_id, im_name, im_platform) VALUES ' .implode(', ', $vals);
				$this->db->query($query);
			} 
		}

		// insert addresses
		if (isset($addresses) && is_array($addresses) && count($addresses) > 0) {
			$vals = array();
			for ($i=0; $i<count($addresses); $i++) {
				$address = $this->db->escape($addresses[$i]);
				if (!isset($address['address']) || strlen(trim($address['address'])) == 0) { continue; }
				$vals[] = '(' .$contactid. ', "' .$address['address']. '", "' .$address['address_type'] .'")';
			}
			if (count($vals) > 0) {
				$query = 'INSERT INTO contact_addresses (contact_id, address, description) VALUES ' .implode(', ', $vals);
				$this->db->query($query);
			}  
		} 

		return true;
	}

	/*
	 * Checks of this user can do $action on a $contact
	 * @param int $contactid
	 * @param string $action ['update', 'delete']
	 * @return bool (true if enough permission)
	 */
	protected function checkPermission ($contactid, $action) {
		// get contact info with permission check
		$query = 'SELECT DISTINCT c.* FROM contacts AS c, contact_teams AS ct ';
		$query .= 'WHERE c.contact_id = ' .$contactid. ' ';
		$query .= 'AND (c.owner_id = ' .$_SESSION['vid']. ' OR (ct.team_id IN (SELECT team_id FROM team_users WHERE user_id = ' .$_SESSION['vid']. '))) ';
		if ($action == 'delete') { $query .= 'AND c.owner_id = ' .$_SESSION['vid']. ' '; }

		$result = $this->db->query($query);
		if ($this->db->getNumRows($result) == 1) { return true; }

		return false;
	}
}

?>
