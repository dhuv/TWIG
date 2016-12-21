<?

/*
 * Class to manage external companies
 */
class soeCompanies {
	private $settings_columns = array('companyid'=>'company_id', 'name'=>'name', 'daily_type'=>'daily_type', 'monthly_type'=>'monthly_type');
	protected $db = null;

	function __construct() {
		$this->db = new DB();
	}

	/*
	 * 
	 * @param array $info (business info)
	 */
	public function addCompany($info) {
		// basic checks
		if (!is_array($info)) { throw new Exception ('Invalid data format'); }
		if (!isset($info['name']) || strlen(trim($info['name'])) == 0) { throw new Exception('Invalid data specified for business name', 1001); }
		if (!isset($info['daily_type']) || !in_array($info['daily_type'], array(0,1))) { throw new Exception('Invalid data specified for daily type', 1001); }
		if (!isset($info['monthly_type']) || !in_array($info['monthly_type'], array(0,1))) { throw new Exception('Invalid data specified for monthly type', 1001); }

		// escape input
		$info = $this->db->escape($info);
	
		// build the query
		$query = 'INSERT INTO companies (name, daily_type, monthly_type) VALUES ("' .$info['name']. '", ' .$info['daily_type']. ', ' .$info['monthly_type']. ')';
		try {
			$info['companyid'] = $this->db->insert($query);
		} catch (Exception $e) {
			to_log('Error inserting business with query "' .$query. '" affrows = "' .$affrows. '"');
			throw new Exception ('An error occurred when adding the new business', 1001);
		}

		return $info;
	}


	/*
	 * Update an business
	 * @param array $info (business info)
	 */
	public function updateCompany($info) {
		// basic checks
		if (!is_array($info)) { throw new Exception ('Invalid data format'); }
		if (!isset($info['name']) || strlen(trim($info['name'])) == 0) { throw new Exception('Invalid data specified for business name', 1001); }
		if (!isset($info['daily_type']) || !in_array($info['daily_type'], array(0,1))) { throw new Exception('Invalid data specified for daily type', 1001); }
		if (!isset($info['monthly_type']) || !in_array($info['monthly_type'], array(0,1))) { throw new Exception('Invalid data specified for monthly type', 1001); }

		// escape input
		$info = $this->db->escape($info);

		// build the query
		$query = 'UPDATE companies SET name = "' .$info['name']. '", daily_type = ' .$info['daily_type']. ', monthly_type = ' .$info['monthly_type']. ' WHERE company_id = ' .$info['companyid'];
		try {
			$affrows = $this->db->update($query);
		} catch (Exception $e) {
			to_log('Error updating item with query "' .$query. '"');
			throw new Exception('Error updating business', 1001);
		}

		return ($affrows == 1);
	}

	/*
	 * Delete company
	 * @param array $info (company info)
	 */
	public function deleteCompany($companyid) {
		// basic checks
		if (!is_numeric($companyid)) { throw new Exception('Invalid business ID specified', 1001); }

		// delete the entry
		$query = 'DELETE FROM companies WHERE company_id = ' .$companyid;
		try {
			$affrows = $this->db->update($query);
		} catch (Exception $e) {
			to_log('An error occurred deleteing the business with query "' .$query. '" affrows = "' .$affrows. '"');
			throw new Exception ('Could not delete the business.', 1001);
		}

		return true;
	}

	/*
	 * Search company
	 * @param array $criteria (search info)
	 */
	public function searchCompanies($criteria) {
		// basic checks
		if (!is_array($criteria)) { throw new Exception ('Invalid data format'); }

		$query = 'SELECT company_id AS companyid, daily_type, monthly_type FROM companies WHERE company_id > 0';
		if (isset($criteria['companyid']) && is_numeric($criteria['companyid'])) { $query .= ' AND company_id = ' .$criteria['companyid']; }
		if (isset($criteria['daily_type']) && is_numeric($criteria['daily_type'])) { $query .= ' AND daily_type = ' .$criteria['daily_type']; }
		if (isset($criteria['monthly_type']) && is_numeric($criteria['monthly_type'])) { $query .= ' AND monthly_type = ' .$criteria['monthly_type']; }
		$companies = $this->db->getTable($query);

		return $companies;
	}
}

?>
