<?

/*
 * Class to access IMAP mailbox
 */

class TWIGTasks {
    protected $task_columns = array('taskid'=>'task_id', 'authorid'=>'owner_id', 'task'=>'task', 'priority'=>'priority', 'expected'=>'expected', 'completed'=>'completed'); 
	protected $db = null;
   
    function __construct () {
		$this->db = new DB();
	}

	/*
	 * Add task
	 * @param array $task
	 * @return array $task
	 */
	public function addTask ($task) {
		// basic checks
		if (!is_array($task)) { throw new Exception ('Invalid format for task information', 1001); }
		if (!isset($task['taskid'])) { throw new Exception ('Task ID required but not specified', 1001); }
		if (!is_numeric($task['taskid'])) { throw new Exception ('Task ID invalid', 1001); }
		if (!isset($task['priority'])) { throw new Exception ('Task priority required but not specified', 1001); }
		if (!is_numeric($task['priority'])) { throw new Exception ('Task priority invalid', 1001); }
		if (!isset($task['expected'])) { throw new Exception ('Task date required but not specified', 1001); }
		if (!is_numeric($task['expected'])) { throw new Exception ('Task date invalid', 1001); }
		if (!isset($task['completed'])) { throw new Exception ('Task status required but not specified', 1001); }
		if (!is_numeric($task['completed']) || !in_array($task['completed'], array(0, 1))) { throw new Exception ('Task status invalid', 1001); }

		// build the query
		$task = $this->db->escape($task);
		$query = 'INSERT INTO tasks (owner_id, task, priority, expected, completed) VALUES (' .$_SESSION['vid']. ', "' .$task['task']. '", "' .$task['priority']. '", FROM_UNIXTIME(' .$task['expected']. '), ' .$task['completed']. ')';
		try {
			$taskid = $this->db->insert($query);
		} catch (Exception $e) {
            error_log('Error adding task with query "' .$query. '"');
            throw new Exception ('Error adding task', 1001);
		}

		return array_shift($this->searchTasks(array('taskid'=>$taskid)));
	}

	/*
	 * Update task
	 * @param array $task
	 * @param bool
	 */
	public function editTask ($task) {
		// basic checks
		if (!is_array($task)) { throw new Exception ('Invalid format for task information', 1001); }
		if (!isset($task['taskid'])) { throw new Exception ('Task ID required but not specified', 1001); }
		if (!is_numeric($task['taskid']) || $task['taskid'] < 1) { throw new Exception ('Task ID invalid', 1001); }
		if (isset($task['priority']) && !is_numeric($task['priority'])) { throw new Exception ('Task priority invalid', 1001); }
		if (isset($task['expected']) && !is_numeric($task['expected'])) { throw new Exception ('Task date invalid', 1001); }

		// escape all input
		$task = $this->db->escape($task);

		$valid_keys = array_keys($this->task_columns);
        // we do not want certain fields to be updated
        $valid_keys = array_diff($valid_keys, array('taskid', 'authorid', 'expected'));
        $updates = array();
        // compile updates
        foreach ($task as $key => $val) {
            // only update valid keys
            if (!in_array($key, $valid_keys)) { continue; }
            // find the real key                                                                                                                                  
            $real_key = $this->task_columns[$key];                                                                                                               
            $updates[] = ' ' .$real_key. ' = "' .$val. '"';                                                                                                       
        }                                                                                                                                                         
		// handle expected
		if (isset($task['expected'])) { $updates[] = ' expected = FROM_UNIXTIME(' .$task['expected']. ')'; }
                                                                                                                                                                 
        // handle no updates                                                                                                                                      
        if (count($updates) == 0) { throw new Exception('Could not find valid data to update task', 1001); }
                                                                                                                                                                  
        // build the query                                                                                                                                        
        $query = 'UPDATE tasks SET ';                                                                                                                         
        $query .= implode(', ', $updates);                                                                                                                        
        $query .= ' WHERE task_id = ' .$task['taskid']. ' AND owner_id = ' .$_SESSION['vid'];
		try {
			$affrows = $this->db->update($query);
		} catch (Exception $e) {
            error_log('Error updating task with query "' .$query. '" affrows = "' .$affrows. '"');
            throw new Exception ('Error editing task', 1001);
		}

		return array_shift($this->searchTasks(array('taskid'=>$task['taskid'])));
	}

	/*
	 * Set the order for a list of tasks
	 * @param array [{priority:1, taskid:3}, {priority:2, taskid:4})]
	 * @return bool
	 */
	public function saveTaskOrder ($info) {
		// basic checks
		if (!is_array($info)) { throw new Exception ('Invalid format for data'); }

		// compile all updates
		$updates = array();
		for ($i=0; $i<count($info); $i++) {
			if (!is_numeric($info[$i]['priority']) || !is_numeric($info[$i]['taskid'])) {
				error_log('Invalid data priority = "' .$info[$i]['priority']. '", taskid = "' .$info[$i]['taskid']. '"');
				throw new Exception ('Invalid data received when reordering tasks', 1001);
			}

			// run the query 
			$updates[] = 'UPDATE tasks SET priority = ' .$info[$i]['priority']. ' WHERE task_id = ' .$info[$i]['taskid']. ' AND owner_id = ' .$_SESSION['vid'];
		}

		// run the updates
		for ($i=0; $i<count($updates); $i++) {
			try {
				$affrows = $this->db->update($updates[$i]);
			} catch (Exception $e) {
				throw new Exception ('Error reording tasks', 1001);
			} 
		}

		return true;
	}

	/*
	 * Search for tasks
	 * @param array $criteria {'expected':1234567890, 'taskid':123}
	 * @return array $tasks [{...}, ...]
	 */
	public function searchTasks ($criteria) {
		// basic checks
		if (!is_array($criteria)) { throw new Exception ('Search criteria not specified', 1001); }
		if (isset($criteria['expected']) && !is_numeric($criteria['expected'])) { throw new Exception ('Invalid search date specified', 1001); }

		//$criteria = $this->db->escape($criteria);

		$query = 'SELECT task_id AS taskid, task, priority, UNIX_TIMESTAMP(expected) AS expected, completed FROM tasks WHERE owner_id = ' .$_SESSION['vid'];
		if (isset($criteria['expected']) && is_numeric($criteria['expected'])) { $query .= ' AND expected = "' .date('Y-m-d', $criteria['expected']). '"'; }
		if (isset($criteria['taskid']) && is_numeric($criteria['taskid'])) { $query .= ' AND task_id = "' .$criteria['taskid']. '"'; }
		$query .= ' ORDER by priority';
		$tasks = $this->db->getTable($query);

		return $tasks;
	}

	/*
	 * Delete a task
	 * @param int $taskid
	 * @return bool true on success
	 */ 
	public function deleteTask ($taskid) {
		if (!is_numeric($taskid)) { throw new Exception ('Invalid task ID specified', 1001); }

		$query = 'DELETE FROM tasks WHERE task_id = ' .$taskid. ' AND owner_id = ' .$_SESSION['vid'];
		try {
			$afforws = $this->db->update($query);
    	} catch (Exception $e) {
			error_log('Could not delete task with query "' .$query. '"');
			throw new Exception ('Error deleting the task. Please refresh your list.', 1001);
		}

		return true;
	}
}

?>
