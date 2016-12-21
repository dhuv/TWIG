<?

/*
 * Class to access IMAP mailbox
 */

class TWIGNotes {
    protected $note_columns = array('noteid'=>'note_id', 'authorid'=>'owner_id', 'created'=>'created', 'updated'=>'updated', 'name'=>'name', 'description'=>'description', 'pinned'=>'pinned'); 
	protected $db = null;
   
    function __construct () {
		$this->db = new DB();
	}

	/*
	 * Add note
	 * @param array $note
	 * @return array $note
	 */
	public function addNote ($note) {
		// basic checks
		if (!is_array($note)) { throw new Exception ('Invalid format for note information', 1001); }
		if (!isset($note['noteid'])) { throw new Exception ('Note ID required but not specified', 1001); }
		if (!is_numeric($note['noteid'])) { throw new Exception ('Note ID invalid', 1001); }
		if (!in_array($note['pinned'], array(0, 1))) { throw new Exception ('Invalid pinned value specified', 1001); }

		// build the query
		$note = $this->db->escape($note);
		$query = 'INSERT INTO notes (owner_id, name, description, created, updated, pinned) VALUES (' .$_SESSION['vid']. ', "' .$note['name']. '", "' .$note['description']. '", NOW(), NOW(), ' .$note['pinned']. ')';
		try {
			$noteid = $this->db->insert($query);
		} catch (Exception $e) {
            error_log('Error adding note with query "' .$query. '"');
            throw new Exception ('Error adding note', 1001);
		}

		if (isset($note['teams']) && is_array($note['teams'])) { 
	        try {
    	        $this->updateNoteTeams($noteid, $note['teams']);
        	} catch (Exception $e) {
            	$mesg = ($e->getCode() == 1001)?$e->getMessage():'Error setting teams to the note';
	            throw new Exception ($mesg, 1001);
			}
        }

		return $this->getNote($noteid);
	}

	/*
	 * Update note
	 * @param array $note
	 * @param bool
	 */
	public function editNote ($note) {
		// basic checks
		if (!is_array($note)) { throw new Exception ('Invalid format for note information', 1001); }
		if (!isset($note['noteid'])) { throw new Exception ('Note ID required but not specified', 1001); }
		if (!is_numeric($note['noteid']) || $note['noteid'] < 1) { throw new Exception ('Note ID invalid', 1001); }
		if (!$this->checkPermission($note['noteid'], 'edit')) { throw new Exception ('Insufficient privileges to update this note', 1001); }
		if (isset($note['pinned']) && !in_array($note['pinned'], array(0, 1))) { throw new Exception ('Invalid pinned value specified', 1001); }

		// escape all input
		$note = $this->db->escape($note);

		$valid_keys = array_keys($this->note_columns);
        // we do not want certain fields to be updated
        $valid_keys = array_diff($valid_keys, array('noteid', 'authorid'));
        $updates = array();
        // compile updates
        foreach ($note as $key => $val) {
            // only update valid keys
            if (!in_array($key, $valid_keys)) { continue; }
            // find the real key                                                                                                                                  
            $real_key = $this->note_columns[$key];                                                                                                               
            $updates[] = ' ' .$real_key. ' = "' .$val. '"';                                                                                                       
        }                                                                                                                                                         
                                                                                                                                                                 
        // handle no updates                                                                                                                                      
        if (count($updates) == 0) { throw new Exception('Could not find valid data to update note', 1001); }
                                                                                                                                                                  
        // build the query                                                                                                                                        
        $query = 'UPDATE notes SET ';                                                                                                                         
        $query .= implode(', ', $updates);                                                                                                                        
        $query .= ' WHERE note_id = ' .$note['noteid'];
		try {
			$affrows = $this->db->update($query);
		} catch (Exception $e) {
            error_log('Error updating note with query "' .$query. '" affrows = "' .$affrows. '"');
            throw new Exception ('Error editing note', 1001);
		}

		if (isset($note['teams']) && is_array($note['teams'])) { 
	        try {
            	$this->updateNoteTeams($noteid, $note['teams']);
        	} catch (Exception $e) {
            	$mesg = ($e->getCode() == 1001)?$e->getMessage():'Error setting teams to the note';
	            throw new Exception ($mesg, 1001);
    	    }
		}

		return $this->getNote($note['noteid']);
	}

	/*
	 * Gets all note info in one go
	 * @return array $notes
	 */
	public function getAllNotes () {
		$notes = array();
		$noteids = array();

		//
		// get all notes
		//
		$query = 'SELECT DISTINCT n.note_id, n.name, n.pinned ';
		$query .= 'FROM notes AS n, note_teams AS nt ';
		$query .= 'WHERE (n.owner_id = ' .$_SESSION['vid']. ' OR (n.note_id = nt.note_id AND nt.team_id IN (SELECT team_id FROM team_users where user_id = ' .$_SESSION['vid']. '))) ';
		$query .= 'ORDER BY pinned DESC, updated DESC';

		$notes = $this->db->getTable($query);

		return $notes;
	}
 
	/*
	 * Search for notes
	 * @param array $criteria {'name':'%sear%', 'description':'%sear%'}
	 * @return array $notes [{...}, ...]
	 */
	public function searchNotes ($criteria, $organize=false) {
		// basic checks
		if (!is_array($criteria)) { throw new Exception ('Search criteria not specified', 1001); }

		$criteria = $this->db->escape($criteria);
		$where = array();
		if (isset($criteria['name'])) { $where[] = 'n.name LIKE "%' .$criteria['name']. '%"'; }
		if (isset($criteria['noteid'])) { $where[] = 'n.note_id = "' .$criteria['noteid']. '"'; }
		if (isset($criteria['description'])) { $where[] = 'n.description LIKE "%' .$criteria['description']. '%"'; }

		$query = 'SELECT DISTINCT n.note_id AS noteid, n.name, n.description, UNIX_TIMESTAMP(created) AS created, UNIX_TIMESTAMP(updated) AS updated, n.owner_id AS ownerid, n.pinned ';
		$query .= 'FROM notes AS n, note_teams AS nt ';
		$query .= 'WHERE (n.owner_id = ' .$_SESSION['vid']. ' OR (n.note_id = nt.note_id AND nt.team_id IN (SELECT team_id FROM team_users where user_id = ' .$_SESSION['vid']. '))) ';
		if (count($where) > 0) { $query .= ' AND (' .implode(' OR ', $where). ') '; }
		$query .= 'ORDER BY pinned DESC, updated DESC';

		$notes = $this->db->getTable($query);

		return $notes;
	}

	/*
	 * Get note details
	 * @param int $noteid
	 * @return array $note
	 */
	public function getNote ($noteid) {
		// basic checks
		if (!is_numeric($noteid)) { throw new Exception ('Invalid note ID specified (' .$noteid. ')', 1001); }

		$notes = $this->searchNotes(array('noteid'=>$noteid));

		return $notes[0];
	}
 
	/*
	 * Delete a note
	 * @param int $noteid
	 * @return bool true on success
	 */ 
	public function deleteNote ($noteid) {
		if (!is_numeric($noteid)) { throw new Exception ('Invalid note ID specified', 1001); }
		if (!$this->checkPermission($noteid, 'delete')) { throw new Exception ('You do not have permission to delete this note. Please ask the owner to do so.', 1001); }

		$query = 'DELETE FROM notes WHERE note_id = ' .$noteid;
		try {
			$afforws = $this->db->update($query);
    	} catch (Exception $e) {
			error_log('Could not delete note with query "' .$query. '"');
			throw new Exception ('Error deleting the note. Please refresh your list.', 1001);
		}

		$query = 'DELETE FROM note_teams WHERE note_id = ' .$noteid;
		$afforws = $this->db->update($query);

		return true;
	}

	/*
	 * Add teams to note
	 * @param int $noteid
	 * @param array $teams (teams that note belongs in)
	 */
	protected function updateNoteTeams($noteid, $teams) {

	}

	/*
	 * Checks of this user can do $action on a $note
	 * @param int $noteid
	 * @param string $action ['update', 'delete']
	 * @return bool (true if enough permission)
	 */
	protected function checkPermission ($noteid, $action) {
		// get note info with permission check
		$query = 'SELECT DISTINCT n.* FROM notes AS n, note_teams AS nt ';
		$query .= 'WHERE n.note_id = ' .$noteid. ' ';
		$query .= 'AND (n.owner_id = ' .$_SESSION['vid']. ' OR (n.note_id = nt.note_id AND nt.team_id IN (SELECT team_id FROM team_users WHERE user_id = ' .$_SESSION['vid']. '))) ';
		if ($action == 'delete') { $query .= 'AND n.owner_id = ' .$_SESSION['vid']. ' '; }

		$result = $this->db->query($query);
		if ($result->num_rows == 1) { return true; }

		return false;
	}
}

?>
